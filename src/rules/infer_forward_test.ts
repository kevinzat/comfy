import * as assert from 'assert';
import { ParseForwardRule, CreateRule } from './infer_forward';
import { AlgebraAst, SubstituteAst, DefinitionAst, RULE_ALGEBRA, RULE_SUBSTITUTE, RULE_DEFINITION } from './rules_ast';
import { TopLevelEnv } from '../types/env';
import { OP_EQUAL } from '../facts/formula';
import { ParseExpr } from '../facts/exprs_parser';
import { ParseFormula } from '../facts/formula_parser';
import { TypeDeclAst, ConstructorAst } from '../lang/type_ast';
import { FuncAst, TypeAst, CaseAst, ParamVar, ParamConstructor } from '../lang/func_ast';
import { Constant, Variable, Call } from '../facts/exprs';


describe('ParseForwardRule', function() {

  // --- Algebra rules ---

  it('parses = Expr with no refs', function() {
    const ast = ParseForwardRule('= x + 1');
    assert.strictEqual(ast.variety, RULE_ALGEBRA);
    const a = ast as AlgebraAst;
    assert.strictEqual(a.op, '=');
    assert.strictEqual(a.expr.to_string(), 'x + 1');
    assert.deepStrictEqual(a.refs, []);
  });

  it('parses = Expr with refs', function() {
    const ast = ParseForwardRule('= x + 1 1 2');
    assert.strictEqual(ast.variety, RULE_ALGEBRA);
    const a = ast as AlgebraAst;
    assert.strictEqual(a.op, '=');
    assert.strictEqual(a.expr.to_string(), 'x + 1');
    assert.deepStrictEqual(a.refs, [1, 2]);
  });

  it('parses < Expr', function() {
    const ast = ParseForwardRule('< y^2');
    const a = ast as AlgebraAst;
    assert.strictEqual(a.op, '<');
    assert.deepStrictEqual(a.refs, []);
  });

  it('parses <= Expr with ref', function() {
    const ast = ParseForwardRule('<= 2*x + 3 1');
    const a = ast as AlgebraAst;
    assert.strictEqual(a.op, '<=');
    assert.deepStrictEqual(a.refs, [1]);
  });

  it('parses = with complex expression', function() {
    const ast = ParseForwardRule('= (x + y)^2');
    const a = ast as AlgebraAst;
    assert.strictEqual(a.expr.to_string(), '(x + y)^2');
  });

  // --- Substitute rules ---

  it('parses subst N', function() {
    const ast = ParseForwardRule('subst 1');
    assert.strictEqual(ast.variety, RULE_SUBSTITUTE);
    const s = ast as SubstituteAst;
    assert.strictEqual(s.index, 1);
    assert.strictEqual(s.right, true);
  });

  it('parses unsub N', function() {
    const ast = ParseForwardRule('unsub 3');
    assert.strictEqual(ast.variety, RULE_SUBSTITUTE);
    const s = ast as SubstituteAst;
    assert.strictEqual(s.index, 3);
    assert.strictEqual(s.right, false);
    assert.strictEqual(s.expr, undefined);
  });

  it('parses subst N Expr', function() {
    const ast = ParseForwardRule('subst 1 (3 + 1)');
    assert.strictEqual(ast.variety, RULE_SUBSTITUTE);
    const s = ast as SubstituteAst;
    assert.strictEqual(s.index, 1);
    assert.strictEqual(s.right, true);
    assert.strictEqual(s.expr!.to_string(), '3 + 1');
  });

  it('parses unsub N Expr', function() {
    const ast = ParseForwardRule('unsub 2 (2*b+b)');
    assert.strictEqual(ast.variety, RULE_SUBSTITUTE);
    const s = ast as SubstituteAst;
    assert.strictEqual(s.index, 2);
    assert.strictEqual(s.right, false);
    assert.strictEqual(s.expr!.to_string(), '2*b + b');
  });

  // --- Error cases ---

  it('throws on empty input', function() {
    assert.throws(() => ParseForwardRule(''), /syntax error/);
  });

  it('throws on garbage', function() {
    assert.throws(() => ParseForwardRule('blah blah'), /syntax error/);
  });

  it('handles whitespace', function() {
    const ast = ParseForwardRule('  = x  ');
    assert.strictEqual(ast.variety, RULE_ALGEBRA);
  });

  it('parses defof name', function() {
    const ast = ParseForwardRule('defof echo_2');
    assert.strictEqual(ast.variety, RULE_DEFINITION);
  });

  it('parses undef name', function() {
    const ast = ParseForwardRule('undef len_1');
    assert.strictEqual(ast.variety, RULE_DEFINITION);
  });

});


describe('CreateRule', function() {

  it('algebra = tautology (no givens, no refs)', function() {
    const ast = ParseForwardRule('= x + y');
    const current = ParseExpr('y + x');
    const env = new TopLevelEnv([], [], [], []);
    const rule = CreateRule(ast, current, env);
    const result = rule.apply();
    assert.strictEqual(result.right.to_string(), 'x + y');
  });

  it('algebra = citing a given', function() {
    const ast = ParseForwardRule('= 5 1');
    const current = ParseExpr('x + y');
    const env = new TopLevelEnv([], [], [], [ParseFormula('x + y = 5')]);
    const rule = CreateRule(ast, current, env);
    const result = rule.apply();
    assert.strictEqual(result.right.to_string(), '5');
  });

  it('algebra = rejects wrong equation', function() {
    const ast = ParseForwardRule('= 6 1');
    const current = ParseExpr('x + y');
    const env = new TopLevelEnv([], [], [], [ParseFormula('x + y = 5')]);
    assert.throws(() => CreateRule(ast, current, env), /algebra/);
  });

  it('algebra = rejects when ref not cited', function() {
    const ast = ParseForwardRule('= 5');
    const current = ParseExpr('x + y');
    const env = new TopLevelEnv([], [], [], [ParseFormula('x + y = 5')]);
    // No refs cited, so it's treated as a tautology check — which fails
    assert.throws(() => CreateRule(ast, current, env), /algebra/);
  });

  it('subst replaces left with right', function() {
    const ast = ParseForwardRule('subst 1');
    const current = ParseExpr('x + 1');
    const env = new TopLevelEnv([], [], [], [ParseFormula('x = 3')]);
    const rule = CreateRule(ast, current, env);
    const result = rule.apply();
    assert.strictEqual(result.op, OP_EQUAL);
    assert.strictEqual(result.left.to_string(), 'x + 1');
    assert.strictEqual(result.right.to_string(), '3 + 1');
  });

  it('unsub replaces right with left', function() {
    const ast = ParseForwardRule('unsub 1');
    const current = ParseExpr('3 + 1');
    const env = new TopLevelEnv([], [], [], [ParseFormula('x = 3')]);
    const rule = CreateRule(ast, current, env);
    const result = rule.apply();
    assert.strictEqual(result.right.to_string(), 'x + 1');
  });

  it('subst with explicit result (partial substitution)', function() {
    // Given x = 3, current is x + x, only replace first x
    const ast = ParseForwardRule('subst 1 (3 + x)');
    const current = ParseExpr('x + x');
    const env = new TopLevelEnv([], [], [], [ParseFormula('x = 3')]);
    const rule = CreateRule(ast, current, env);
    const result = rule.apply();
    assert.strictEqual(result.right.to_string(), '3 + x');
  });

  it('subst rejects invalid explicit result', function() {
    const ast = ParseForwardRule('subst 1 (y + 1)');
    const current = ParseExpr('x + 1');
    const env = new TopLevelEnv([], [], [], [ParseFormula('x = 3')]);
    assert.throws(() => CreateRule(ast, current, env), /cannot be produced/);
  });

  it('subst rejects non-equation given', function() {
    const ast = ParseForwardRule('subst 1');
    const current = ParseExpr('x + 1');
    const env = new TopLevelEnv([], [], [], [ParseFormula('x < 3')]);
    assert.throws(() => CreateRule(ast, current, env), /equation/);
  });

  it('subst rejects when nothing to substitute', function() {
    const ast = ParseForwardRule('subst 1');
    const current = ParseExpr('y + 1');
    const env = new TopLevelEnv([], [], [], [ParseFormula('x = 3')]);
    assert.throws(() => CreateRule(ast, current, env), /not found/);
  });

  it('subst rejects out of range index', function() {
    const ast = ParseForwardRule('subst 2');
    const current = ParseExpr('x + 1');
    const env = new TopLevelEnv([], [], [], [ParseFormula('x = 3')]);
    assert.throws(() => CreateRule(ast, current, env), /out of range/);
  });

});


describe('CreateRule - definition', function() {

  const listType = new TypeDeclAst('List', [
    new ConstructorAst('nil', [], 'List'),
    new ConstructorAst('cons', ['Int', 'List'], 'List'),
  ]);

  const lenFunc = new FuncAst('len', new TypeAst(['List'], 'Int'), [
    new CaseAst([new ParamVar('nil')], Constant.of(0n)),
    new CaseAst(
        [new ParamConstructor('cons', [new ParamVar('a'), new ParamVar('L')])],
        Call.add(Constant.of(1n), Call.of('len', Variable.of('L')))),
  ]);

  const echoFunc = new FuncAst('echo', new TypeAst(['List'], 'List'), [
    new CaseAst([new ParamVar('nil')], Variable.of('nil')),
    new CaseAst(
        [new ParamConstructor('cons', [new ParamVar('a'), new ParamVar('L')])],
        Call.of('cons', Variable.of('a'),
            Call.of('cons', Variable.of('a'), Call.of('echo', Variable.of('L'))))),
  ]);

  const env = new TopLevelEnv([listType], [lenFunc, echoFunc], [], []);

  it('defof len_1 on len(nil) produces 0', function() {
    const ast = ParseForwardRule('defof len_1');
    const current = Call.of('len', Variable.of('nil'));
    const rule = CreateRule(ast, current, env);
    const result = rule.apply();
    assert.strictEqual(result.op, OP_EQUAL);
    assert.ok(result.right.equals(Constant.of(0n)));
  });

  it('defof len_2 freshens variables (a appears in both pattern and target)', function() {
    const ast = ParseForwardRule('defof len_2');
    const current = Call.of('len', Call.of('cons', Variable.of('a'), Variable.of('nil')));
    const rule = CreateRule(ast, current, env);
    const result = rule.apply();
    assert.strictEqual(result.op, OP_EQUAL);
    // Should produce 1 + len(nil)
    assert.ok(result.right.equals(
        Call.add(Constant.of(1n), Call.of('len', Variable.of('nil')))));
  });

  it('undef len_1 on 0 produces len(nil)', function() {
    const ast = ParseForwardRule('undef len_1');
    const current = Constant.of(0n);
    const rule = CreateRule(ast, current, env);
    const result = rule.apply();
    assert.ok(result.right.equals(Call.of('len', Variable.of('nil'))));
  });

  it('defof with explicit result', function() {
    const ast = new DefinitionAst('len_1', true,
        Call.add(Constant.of(1n), Constant.of(0n)));
    const current = Call.add(Constant.of(1n), Call.of('len', Variable.of('nil')));
    const rule = CreateRule(ast, current, env);
    const result = rule.apply();
    assert.ok(result.right.equals(Call.add(Constant.of(1n), Constant.of(0n))));
  });

  it('defof len_3 fails (only 2 cases)', function() {
    const ast = ParseForwardRule('defof len_3');
    const current = Call.of('len', Variable.of('nil'));
    assert.throws(() => CreateRule(ast, current, env), /2 cases/);
  });

  it('defof unknown_1 fails for unknown function', function() {
    const ast = ParseForwardRule('defof unknown_1');
    const current = Constant.of(0n);
    assert.throws(() => CreateRule(ast, current, env), /unknown function/);
  });

  it('defof len_1 fails when no matches', function() {
    const ast = ParseForwardRule('defof len_1');
    // len(cons(...)) doesn't match len(nil) pattern
    const current = Call.of('len', Call.of('cons', Variable.of('a'), Variable.of('nil')));
    assert.throws(() => CreateRule(ast, current, env), /no matches/);
  });

  it('defof echo_2 works with shared variable names', function() {
    const ast = ParseForwardRule('defof echo_2');
    const current = Call.of('echo', Call.of('cons', Variable.of('a'), Variable.of('nil')));
    const rule = CreateRule(ast, current, env);
    const result = rule.apply();
    // echo(cons(a, nil)) = cons(a, cons(a, echo(nil)))
    assert.ok(result.right.equals(
        Call.of('cons', Variable.of('a'),
            Call.of('cons', Variable.of('a'), Call.of('echo', Variable.of('nil'))))));
  });

});
