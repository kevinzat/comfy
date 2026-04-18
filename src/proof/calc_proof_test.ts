import * as assert from 'assert';
import { Step, applyForwardRule, applyBackwardRule, topFrontier, botFrontier, isComplete, checkValidity, calculationParser } from './calc_proof';
import { TopLevelEnv } from '../types/env';
import { Formula } from '../facts/formula';
import { ParseFormula } from '../facts/formula_parser';
import { TypeDeclAst, ConstructorAst } from '../lang/type_ast';
import { FuncAst, TypeAst, CaseAst, ExprBody, ParamVar } from '../lang/func_ast';
import { Constant, Variable, Call } from '../facts/exprs';
import { AtomProp, NotProp } from '../facts/prop';
import { NestedEnv } from '../types/env';
import { validateCalculation } from './calc_proof';
import { CalcProofNode } from './proof_file';


const listType = new TypeDeclAst('List', [
  new ConstructorAst('nil', [], 'List'),
  new ConstructorAst('cons', ['Int', 'List'], 'List'),
]);

const lenFunc = new FuncAst('len', new TypeAst(['List'], 'Int'), [
  new CaseAst([new ParamVar('nil')], new ExprBody(Constant.of(0n))),
  new CaseAst([new ParamVar('x')],
      new ExprBody(Call.add(Constant.of(1n), Call.of('len', Variable.of('x'))))),
]);


describe('isComplete', function() {

  it('is not complete when sides differ', function() {
    const goal = ParseFormula('x + y = y + x');
    assert.ok(!isComplete(goal, [], []));
  });

  it('is complete when both sides are equal', function() {
    const goal = ParseFormula('x + y = x + y');
    assert.ok(isComplete(goal, [], []));
  });
});


describe('applyForwardRule', function() {

  it('algebra step', function() {
    const env = new TopLevelEnv([], []);
    const goal = ParseFormula('x + y = y + x');
    const step = applyForwardRule('= y + x', goal.left, env);
    assert.strictEqual(step.expr.to_string(), 'y + x');
    assert.ok(isComplete(goal, [step], []));
    assert.strictEqual(checkValidity(goal, [step], []), undefined);
  });

  it('subst step', function() {
    const env = new TopLevelEnv([], [], [new AtomProp(ParseFormula('x = 3'))]);
    const goal = ParseFormula('x + 1 = 3 + 1');
    const step = applyForwardRule('subst 1', goal.left, env);
    assert.ok(isComplete(goal, [step], []));
    assert.strictEqual(checkValidity(goal, [step], []), undefined);
  });

  it('defof step', function() {
    const env = new TopLevelEnv([listType], [lenFunc]);
    const goal = ParseFormula('len(nil) = 0');
    const step = applyForwardRule('defof len_1', goal.left, env);
    assert.ok(isComplete(goal, [step], []));
    assert.strictEqual(checkValidity(goal, [step], []), undefined);
  });

  it('rejects invalid rule', function() {
    const env = new TopLevelEnv([], []);
    const goal = ParseFormula('x + y = y + x');
    assert.throws(() => applyForwardRule('= z', goal.left, env), /algebra/);
  });
});


describe('applyBackwardRule', function() {

  it('algebra step', function() {
    const env = new TopLevelEnv([], []);
    const goal = ParseFormula('y + x = x + y');
    const step = applyBackwardRule('(y + x) =', goal.right, env);
    assert.ok(isComplete(goal, [], [step]));
    assert.strictEqual(checkValidity(goal, [], [step]), undefined);
  });

  it('rejects invalid tactic', function() {
    const env = new TopLevelEnv([], []);
    const goal = ParseFormula('x + y = y + x');
    assert.throws(() => applyBackwardRule('(z) =', goal.right, env), /algebra/);
  });
});


describe('multi-step proofs', function() {

  it('forward and backward meet in the middle', function() {
    const env = new TopLevelEnv([], [], [new AtomProp(ParseFormula('x = 3'))]);
    const goal = ParseFormula('x + 1 = 4');
    const top: Step[] = [];
    const bot: Step[] = [];

    top.push(applyForwardRule('= 3 + 1 since 1', topFrontier(goal, top), env));
    bot.push(applyBackwardRule('(3 + 1) =', botFrontier(goal, bot), env));

    assert.ok(isComplete(goal, top, bot));
    assert.strictEqual(checkValidity(goal, top, bot), undefined);
  });

  it('multi-step forward with definitions', function() {
    const env = new TopLevelEnv([listType], [lenFunc]);
    const goal = ParseFormula('len(nil) + len(nil) = 0');
    const top: Step[] = [];

    top.push(applyForwardRule('defof len_1 => len(nil) + 0', topFrontier(goal, top), env));
    top.push(applyForwardRule('defof len_1 => 0 + 0', topFrontier(goal, top), env));
    top.push(applyForwardRule('= 0', topFrontier(goal, top), env));

    assert.ok(isComplete(goal, top, []));
    assert.strictEqual(checkValidity(goal, top, []), undefined);
  });

  it('inequality proof with < chain', function() {
    const env = new TopLevelEnv([], [], [new AtomProp(ParseFormula('x < y'))]);
    const goal = ParseFormula('x < y + 1');
    const top: Step[] = [];

    top.push(applyForwardRule('< y since 1', topFrontier(goal, top), env));
    top.push(applyForwardRule('<= y + 1', topFrontier(goal, top), env));

    assert.ok(isComplete(goal, top, []));
    assert.strictEqual(checkValidity(goal, top, []), undefined);
  });
});


describe('topFrontier / botFrontier', function() {

  it('returns goal sides when no steps', function() {
    const goal = ParseFormula('a + 1 = b + 1');
    assert.strictEqual(topFrontier(goal, []).to_string(), 'a + 1');
    assert.strictEqual(botFrontier(goal, []).to_string(), 'b + 1');
  });

  it('returns last step expr after steps', function() {
    const env = new TopLevelEnv([], [], [new AtomProp(ParseFormula('a = b'))]);
    const goal = ParseFormula('a + 1 = b + 1');
    const step = applyForwardRule('subst 1', goal.left, env);
    assert.strictEqual(topFrontier(goal, [step]).to_string(), 'b + 1');
  });
});


describe('calculationParser', function() {

  const env = new TopLevelEnv([], []);
  const formula = ParseFormula('x = x');
  const goal = new AtomProp(formula);

  it('parses "calculation"', function() {
    const result = calculationParser.tryParse('calculation', goal, env, []);
    assert.deepStrictEqual(result, { kind: 'calculate' });
  });

  it('returns null for non-calculation text', function() {
    assert.strictEqual(calculationParser.tryParse('induction on x', goal, env, []), null);
  });

  it('matches prefix of "calculation"', function() {
    const matches = calculationParser.getMatches('calc', formula, env);
    assert.strictEqual(matches.length, 1);
    assert.strictEqual(matches[0].completion, 'calculation');
  });

  it('matches empty text', function() {
    const matches = calculationParser.getMatches('', formula, env);
    assert.strictEqual(matches.length, 1);
    assert.strictEqual(matches[0].completion, 'calculation');
  });

  it('no matches for unrelated text', function() {
    const matches = calculationParser.getMatches('induction', formula, env);
    assert.strictEqual(matches.length, 0);
  });
});


describe('validateCalculation with not-equal goal', function() {

  it('accepts a < proof for not(a = b) goal', function() {
    const env = new TopLevelEnv([], [], [new AtomProp(ParseFormula('x < y'))]);
    const goal = new NotProp(ParseFormula('x = y'));
    const node: CalcProofNode = {
      kind: 'calculate',
      forwardStart: null,
      forwardSteps: [{ ruleText: '< y since 1', line: 1 }],
      backwardStart: null,
      backwardSteps: [],
    };
    assert.doesNotThrow(() => validateCalculation(goal, env, node));
  });

  it('accepts b < a proof for not(a = b) goal', function() {
    const env = new TopLevelEnv([], [], [new AtomProp(ParseFormula('y < x'))]);
    const goal = new NotProp(ParseFormula('x = y'));
    const node: CalcProofNode = {
      kind: 'calculate',
      forwardStart: null,
      forwardSteps: [],
      backwardStart: { text: 'x', line: 1 },
      backwardSteps: [{ ruleText: '(y) < since 1', line: 2 }],
      // prove y < x, i.e., goal.right < goal.left
    };
    assert.doesNotThrow(() => validateCalculation(goal, env, node));
  });

  it('rejects calculation that proves = for not(a = b) goal', function() {
    const env = new TopLevelEnv([], []);
    const goal = new NotProp(ParseFormula('x = x'));
    const node: CalcProofNode = {
      kind: 'calculate',
      forwardStart: null,
      forwardSteps: [],
      backwardStart: null,
      backwardSteps: [],
    };
    assert.throws(() => validateCalculation(goal, env, node));
  });

  it('accepts equality to different constructor for not(a = b) goal', function() {
    const knownFact = new AtomProp(
        new Formula(Variable.of('xs'), '=', Call.of('nil')));
    const env = new NestedEnv(
        new TopLevelEnv([listType], [lenFunc]),
        [['xs', 'List']], [knownFact]);
    // Goal: not(xs = cons(a, L)), calculation proves xs = nil via subst
    const goal = new NotProp(
        new Formula(Variable.of('xs'), '=', Call.of('cons', Variable.of('a'), Variable.of('L'))));
    const node: CalcProofNode = {
      kind: 'calculate',
      forwardStart: null,
      forwardSteps: [{ ruleText: 'subst 1', line: 1 }],
      backwardStart: null,
      backwardSteps: [],
    };
    assert.doesNotThrow(() => validateCalculation(goal, env, node));
  });

  it('rejects bad rule in constructor discrimination', function() {
    const env = new NestedEnv(
        new TopLevelEnv([listType], [lenFunc]),
        [['xs', 'List']]);
    const goal = new NotProp(
        new Formula(Variable.of('xs'), '=', Call.of('cons', Variable.of('a'), Variable.of('L'))));
    const node: CalcProofNode = {
      kind: 'calculate',
      forwardStart: null,
      forwardSteps: [{ ruleText: '= z', line: 1 }],
      backwardStart: null,
      backwardSteps: [],
    };
    assert.throws(() => validateCalculation(goal, env, node));
  });

  it('rejects when chain reaches a non-constructor call', function() {
    const knownFact = new AtomProp(
        new Formula(Variable.of('xs'), '=', Call.of('len', Call.of('nil'))));
    const env = new NestedEnv(
        new TopLevelEnv([listType], [lenFunc]),
        [['xs', 'List']], [knownFact]);
    // Chain proves xs = len(nil), but len is a function, not a constructor
    const goal = new NotProp(
        new Formula(Variable.of('xs'), '=', Call.of('cons', Variable.of('a'), Variable.of('L'))));
    const node: CalcProofNode = {
      kind: 'calculate',
      forwardStart: null,
      forwardSteps: [{ ruleText: 'subst 1', line: 1 }],
      backwardStart: null,
      backwardSteps: [],
    };
    assert.throws(() => validateCalculation(goal, env, node));
  });

  it('rejects equality to same constructor for not(a = b) goal', function() {
    const knownFact = new AtomProp(
        new Formula(Variable.of('xs'), '=', Call.of('nil')));
    const env = new NestedEnv(
        new TopLevelEnv([listType], [lenFunc]),
        [['xs', 'List']], [knownFact]);
    // Goal: not(xs = nil()), calculation proves xs = nil() — same constructor, should fail
    const goal = new NotProp(
        new Formula(Variable.of('xs'), '=', Call.of('nil')));
    const node: CalcProofNode = {
      kind: 'calculate',
      forwardStart: null,
      forwardSteps: [{ ruleText: 'subst 1', line: 1 }],
      backwardStart: null,
      backwardSteps: [],
    };
    assert.throws(() => validateCalculation(goal, env, node));
  });
});


