import * as assert from 'assert';
import { Step, applyForwardRule, applyBackwardRule, topFrontier, botFrontier, isComplete, checkValidity } from './calc_proof';
import { TopLevelEnv } from '../types/env';
import { ParseFormula } from '../facts/formula_parser';
import { TypeDeclAst, ConstructorAst } from '../lang/type_ast';
import { FuncAst, TypeAst, CaseAst, ExprBody, ParamVar } from '../lang/func_ast';
import { Constant, Variable, Call } from '../facts/exprs';


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
    const env = new TopLevelEnv([], [], [ParseFormula('x = 3')]);
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
    const env = new TopLevelEnv([], [], [ParseFormula('x = 3')]);
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
    const env = new TopLevelEnv([], [], [ParseFormula('x < y')]);
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
    const env = new TopLevelEnv([], [], [ParseFormula('a = b')]);
    const goal = ParseFormula('a + 1 = b + 1');
    const step = applyForwardRule('subst 1', goal.left, env);
    assert.strictEqual(topFrontier(goal, [step]).to_string(), 'b + 1');
  });
});


