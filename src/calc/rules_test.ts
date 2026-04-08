import * as assert from 'assert';
import { ParseForwardRule, CreateCalcRule } from './calc_forward';
import { AlgebraAst, SubstituteAst, DefinitionAst, ApplyAst } from './rules_ast';
import { AlgebraCalcRule, SubstituteCalcRule, DefinitionCalcRule, ApplyCalcRule } from './rules';
import { TheoremAst } from '../lang/theorem_ast';
import { TopLevelEnv, NestedEnv } from '../types/env';
import { OP_EQUAL, OP_LESS_THAN, OP_LESS_EQUAL } from '../facts/formula';
import { AtomProp, NotProp, OrProp } from '../facts/prop';
import { ParseExpr } from '../facts/exprs_parser';
import { ParseFormula } from '../facts/formula_parser';
import { UserError } from '../facts/user_error';
import { TypeDeclAst, ConstructorAst } from '../lang/type_ast';
import { FuncAst, TypeAst, CaseAst, ExprBody, IfBranch, IfElseBody, ParamVar, ParamConstructor } from '../lang/func_ast';
import { Constant, Variable, Call } from '../facts/exprs';
import { TACTIC_ALGEBRA, TACTIC_SUBSTITUTE, TACTIC_DEFINITION, TACTIC_APPLY } from './tactics_ast';


describe('non-atom fact cited', function() {

  it('algebra rejects non-atom known fact', function() {
    const ast = ParseForwardRule('= x since 1');
    const current = ParseExpr('x');
    const env = new TopLevelEnv([], [], [new NotProp(ParseFormula('x = y'))]);
    assert.throws(() => CreateCalcRule(ast, current, env),
        (e: any) => e instanceof UserError && /algebra: fact 1 is not a formula/.test(e.message));
  });

  it('substitute rejects non-atom known fact', function() {
    const ast = ParseForwardRule('subst 1');
    const current = ParseExpr('x');
    const env = new TopLevelEnv([], [], [new NotProp(ParseFormula('x = y'))]);
    assert.throws(() => CreateCalcRule(ast, current, env),
        (e: any) => e instanceof UserError && /subst: fact 1 is not a formula/.test(e.message));
  });

  it('defof rejects negated equality known fact', function() {
    const listType = new TypeDeclAst('List', [
      new ConstructorAst('nil', [], 'List'),
      new ConstructorAst('cons', ['Int', 'List'], 'List'),
    ]);
    const positivesFunc = new FuncAst('positives', new TypeAst(['List'], 'List'), [
      new CaseAst([new ParamVar('nil')], new ExprBody(Variable.of('nil'))),
      new CaseAst(
          [new ParamConstructor('cons', [new ParamVar('a'), new ParamVar('L')])],
          new IfElseBody(
              [new IfBranch(
                  [new AtomProp(ParseFormula('a < 0'))],
                  Call.of('positives', Variable.of('L')))],
              Call.of('cons', Variable.of('a'), Call.of('positives', Variable.of('L'))))),
    ]);
    const env = new TopLevelEnv([listType], [positivesFunc],
        [new NotProp(ParseFormula('x = y'))]);
    const ast = ParseForwardRule('defof positives_2a since 1');
    const current = Call.of('positives', Call.of('cons', Variable.of('x'), Variable.of('L')));
    assert.throws(() => CreateCalcRule(ast, current, env),
        (e: any) => e instanceof UserError && /not implied/.test(e.message));
  });

  it('apply rejects non-atom known fact when premise not implied', function() {
    const thm = new TheoremAst('foo', [['n', 'Int']],
        [new AtomProp(ParseFormula('0 < n'))], new AtomProp(ParseFormula('n = n')));
    const env = new TopLevelEnv([], [], [new NotProp(ParseFormula('x = y'))], [thm]);
    const ast = ParseForwardRule('apply foo since 1');
    const current = ParseExpr('x');
    assert.throws(() => CreateCalcRule(ast, current, env),
        (e: any) => e instanceof UserError && /not implied/.test(e.message));
  });


});


describe('AlgebraCalcRule with inequality', function() {

  it('algebra < succeeds when implied', function() {
    const ast = ParseForwardRule('< 3 since 1');
    const current = ParseExpr('x');
    const env = new TopLevelEnv([], [], [new AtomProp(ParseFormula('x < 3'))]);
    const rule = CreateCalcRule(ast, current, env);
    const result = rule.apply();
    assert.strictEqual(result.op, '<');
  });

  it('algebra < rejects when not implied', function() {
    const ast = ParseForwardRule('< 5 since 1');
    const current = ParseExpr('x');
    const env = new TopLevelEnv([], [], [new AtomProp(ParseFormula('x < 3'))]);
    // x < 3 does NOT imply x < 5... wait, it does. Use a wrong direction.
    // x < 3 does NOT imply x < 2
    const ast2 = ParseForwardRule('< 2 since 1');
    assert.throws(() => CreateCalcRule(ast2, current, env), /algebra/);
  });

});


describe('Rule.reverse()', function() {

  it('AlgebraCalcRule.reverse() returns AlgebraTacticAst', function() {
    const ast = ParseForwardRule('= x + y');
    const current = ParseExpr('y + x');
    const env = new TopLevelEnv([], []);
    const rule = CreateCalcRule(ast, current, env);
    const tactic = rule.reverse();
    assert.strictEqual(tactic.variety, TACTIC_ALGEBRA);
  });

  it('SubstituteCalcRule.reverse() returns SubstituteTacticAst', function() {
    const ast = ParseForwardRule('subst 1');
    const current = ParseExpr('x + 1');
    const env = new TopLevelEnv([], [], [new AtomProp(ParseFormula('x = 3'))]);
    const rule = CreateCalcRule(ast, current, env);
    const tactic = rule.reverse();
    assert.strictEqual(tactic.variety, TACTIC_SUBSTITUTE);
  });

  it('DefinitionCalcRule.reverse() returns DefinitionTacticAst', function() {
    const listType = new TypeDeclAst('List', [
      new ConstructorAst('nil', [], 'List'),
      new ConstructorAst('cons', ['Int', 'List'], 'List'),
    ]);
    const lenFunc = new FuncAst('len', new TypeAst(['List'], 'Int'), [
      new CaseAst([new ParamVar('nil')], new ExprBody(Constant.of(0n))),
      new CaseAst(
          [new ParamConstructor('cons', [new ParamVar('a'), new ParamVar('L')])],
          new ExprBody(Call.add(Constant.of(1n), Call.of('len', Variable.of('L'))))),
    ]);
    const env = new TopLevelEnv([listType], [lenFunc]);
    const ast = ParseForwardRule('defof len_1');
    const current = Call.of('len', Variable.of('nil'));
    const rule = CreateCalcRule(ast, current, env);
    const tactic = rule.reverse();
    assert.strictEqual(tactic.variety, TACTIC_DEFINITION);
  });

  it('ApplyCalcRule.reverse() returns ApplyTacticAst', function() {
    const comm = new TheoremAst('comm', [['a', 'Int'], ['b', 'Int']],
        [], new AtomProp(ParseFormula('a + b = b + a')));
    const env = new TopLevelEnv([], [], [], [comm]);
    const ast = ParseForwardRule('apply comm');
    const current = ParseExpr('x + y');
    const rule = CreateCalcRule(ast, current, env);
    const tactic = rule.reverse();
    assert.strictEqual(tactic.variety, TACTIC_APPLY);
  });

});


describe('ApplyCalcRule inequality negative position', function() {

  it('apply < theorem at negative position flips to <=', function() {
    const thm = new TheoremAst('succ', [['n', 'Int']],
        [], new AtomProp(ParseFormula('n < n + 1')));
    const env = new TopLevelEnv([], [], [], [thm]);
    const ast = ParseForwardRule('apply succ => 5 - (x + 1)');
    const current = ParseExpr('5 - x');
    const rule = CreateCalcRule(ast, current, env);
    const result = rule.apply();
    assert.strictEqual(result.op, '<=');
    assert.strictEqual(result.left.to_string(), '5 - (x + 1)');
    assert.strictEqual(result.right.to_string(), '5 - x');
  });

  it('apply <= theorem at negative position flips to <', function() {
    const thm = new TheoremAst('bound', [['n', 'Int']],
        [], new AtomProp(ParseFormula('n <= n + 1')));
    const env = new TopLevelEnv([], [], [], [thm]);
    const ast = ParseForwardRule('apply bound => 5 - (x + 1)');
    const current = ParseExpr('5 - x');
    const rule = CreateCalcRule(ast, current, env);
    const result = rule.apply();
    assert.strictEqual(result.op, '<');
    assert.strictEqual(result.left.to_string(), '5 - (x + 1)');
    assert.strictEqual(result.right.to_string(), '5 - x');
  });

});


describe('ApplyCalcRule edge cases', function() {

  it('apply rejects theorem with non-atomic conclusion', function() {
    const thm = new TheoremAst('bad', [['n', 'Int']],
        [], new NotProp(ParseFormula('n = 0')));
    const env = new TopLevelEnv([], [], [], [thm]);
    const ast = ParseForwardRule('apply bad');
    assert.throws(() => CreateCalcRule(ast, ParseExpr('x'), env), /non-atomic conclusion/);
  });

  it('apply with negated equality premise not implied throws', function() {
    const thm = new TheoremAst('foo', [['n', 'Int']],
        [new NotProp(ParseFormula('n = 0'))],
        new AtomProp(ParseFormula('n + 1 = n + 1')));
    const topEnv = new TopLevelEnv([], [], [], [thm]);
    const env = new NestedEnv(topEnv, [['x', 'Int']],
        [new AtomProp(ParseFormula('0 <= x'))]);
    const ast = ParseForwardRule('apply foo since 1');
    const current = ParseExpr('x + 1');
    assert.throws(() => CreateCalcRule(ast, current, env),
        /not implied/);
  });

});


describe('Rule.apply() caching', function() {

  it('apply() returns same result on second call', function() {
    const ast = ParseForwardRule('= x + y');
    const current = ParseExpr('y + x');
    const env = new TopLevelEnv([], []);
    const rule = CreateCalcRule(ast, current, env);
    const result1 = rule.apply();
    const result2 = rule.apply();
    assert.strictEqual(result1, result2);
  });

});
