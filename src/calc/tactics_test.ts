import * as assert from 'assert';
import { ParseBackwardRule, CreateCalcTactic } from './calc_backward';
import { TopLevelEnv } from '../types/env';
import { TheoremAst } from '../lang/theorem_ast';
import { Formula, OP_EQUAL, OP_LESS_THAN, OP_LESS_EQUAL } from '../facts/formula';
import { AtomProp, NotProp } from '../facts/prop';
import { ParseExpr } from '../facts/exprs_parser';
import { ParseFormula } from '../facts/formula_parser';
import { TypeDeclAst, ConstructorAst } from '../lang/type_ast';
import { FuncAst, TypeAst, CaseAst, ExprBody, IfElseBody, ParamVar, ParamConstructor } from '../lang/func_ast';
import { Constant, Variable, Call } from '../facts/exprs';
import { RULE_ALGEBRA, RULE_SUBSTITUTE, RULE_DEFINITION, RULE_APPLY } from './rules_ast';


describe('AlgebraCalcTactic with inequality', function() {

  it('algebra < succeeds when implied', function() {
    const ast = ParseBackwardRule('(x) < since 1');
    const goal = ParseExpr('3');
    const env = new TopLevelEnv([], [], [new AtomProp(ParseFormula('x < 3'))]);
    const tactic = CreateCalcTactic(ast, goal, env);
    const result = tactic.apply();
    assert.strictEqual(result.op, '<');
  });

  it('algebra reverse with knowns maps indices', function() {
    const ast = ParseBackwardRule('(5) = since 1');
    const goal = ParseExpr('x + y');
    const env = new TopLevelEnv([], [], [new AtomProp(ParseFormula('5 = x + y'))]);
    const tactic = CreateCalcTactic(ast, goal, env);
    const rev = tactic.reverse();
    assert.strictEqual(rev.variety, RULE_ALGEBRA);
    assert.ok(rev.to_string().includes('since'));
  });

  it('algebra < rejects when not implied', function() {
    const ast = ParseBackwardRule('(x) < since 1');
    const goal = ParseExpr('2');
    const env = new TopLevelEnv([], [], [new AtomProp(ParseFormula('x < 3'))]);
    assert.throws(() => CreateCalcTactic(ast, goal, env), /algebra/);
  });

});


describe('DefinitionCalcTactic edge cases', function() {

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

  it('backward defof unconditional rejects when knowns provided', function() {
    const env = new TopLevelEnv([listType], [lenFunc],
        [new AtomProp(ParseFormula('x = 0'))]);
    const ast = ParseBackwardRule('defof len_1 since 1');
    const goal = Constant.of(0n);
    assert.throws(() => CreateCalcTactic(ast, goal, env), /must not be provided/);
  });

});


describe('ApplyCalcTactic edge cases', function() {

  it('backward apply rejects when premise not cited', function() {
    const thm = new TheoremAst('foo', [['n', 'Int']],
        [new AtomProp(ParseFormula('0 < n'))], new AtomProp(ParseFormula('n = n')));
    const env = new TopLevelEnv([], [], [], [thm]);
    const ast = ParseBackwardRule('apply foo');
    assert.throws(() => CreateCalcTactic(ast, ParseExpr('x'), env), /premise.*must be provided/);
  });

  it('backward apply rejects when no premise but facts cited', function() {
    const comm = new TheoremAst('comm', [['a', 'Int'], ['b', 'Int']],
        [], new AtomProp(ParseFormula('a + b = b + a')));
    const env = new TopLevelEnv([], [], [new AtomProp(ParseFormula('x = 1'))], [comm]);
    const ast = ParseBackwardRule('apply comm since 1');
    assert.throws(() => CreateCalcTactic(ast, ParseExpr('y + x'), env), /no premise.*must not be provided/);
  });

  it('backward apply rejects theorem with non-atomic conclusion', function() {
    const thm = new TheoremAst('bad', [['n', 'Int']],
        [], new NotProp(ParseFormula('n = 0')));
    const env = new TopLevelEnv([], [], [], [thm]);
    const ast = ParseBackwardRule('apply bad');
    assert.throws(() => CreateCalcTactic(ast, ParseExpr('x'), env), /non-atomic conclusion/);
  });

  it('backward apply with non-atom premise throws', function() {
    const thm = new TheoremAst('foo', [['n', 'Int']],
        [new NotProp(ParseFormula('n = 0'))],
        new AtomProp(ParseFormula('n + 1 = n + 1')));
    const env = new TopLevelEnv([], [], [new AtomProp(ParseFormula('x = 1'))], [thm]);
    const ast = ParseBackwardRule('apply foo since 1');
    const goal = ParseExpr('x + 1');
    assert.throws(() => CreateCalcTactic(ast, goal, env),
        /non-atomic premise/);
  });

  it('backward apply < theorem at negative position flips to <=', function() {
    const thm = new TheoremAst('succ', [['n', 'Int']],
        [], new AtomProp(ParseFormula('n < n + 1')));
    const env = new TopLevelEnv([], [], [], [thm]);
    // Backward apply replaces right→left. In 5 - (x + 1), n+1 at negative position.
    const ast = ParseBackwardRule('apply succ => 5 - x');
    const goal = ParseExpr('5 - (x + 1)');
    const tactic = CreateCalcTactic(ast, goal, env);
    const result = tactic.apply();
    assert.strictEqual(result.op, '<=');
  });

  it('backward apply <= theorem at negative position flips to <', function() {
    const thm = new TheoremAst('bound', [['n', 'Int']],
        [], new AtomProp(ParseFormula('n <= n + 1')));
    const env = new TopLevelEnv([], [], [], [thm]);
    const ast = ParseBackwardRule('apply bound => 5 - x');
    const goal = ParseExpr('5 - (x + 1)');
    const tactic = CreateCalcTactic(ast, goal, env);
    const result = tactic.apply();
    assert.strictEqual(result.op, '<');
  });

  it('backward apply reverse() returns ApplyAst', function() {
    const comm = new TheoremAst('comm', [['a', 'Int'], ['b', 'Int']],
        [], new AtomProp(ParseFormula('a + b = b + a')));
    const env = new TopLevelEnv([], [], [], [comm]);
    const ast = ParseBackwardRule('apply comm');
    const goal = ParseExpr('y + x');
    const tactic = CreateCalcTactic(ast, goal, env);
    const rev = tactic.reverse();
    assert.strictEqual(rev.variety, RULE_APPLY);
  });

});
