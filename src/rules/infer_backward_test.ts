import * as assert from 'assert';
import { ParseBackwardRule, CreateTactic } from './infer_backward';
import { AlgebraTacticAst, SubstituteTacticAst, DefinitionTacticAst, ApplyTacticAst, TACTIC_ALGEBRA, TACTIC_SUBSTITUTE, TACTIC_DEFINITION, TACTIC_APPLY } from './tactics_ast';
import { TopLevelEnv } from '../types/env';
import { TheoremAst } from '../lang/theorem_ast';
import { Formula, OP_EQUAL, OP_LESS_THAN } from '../facts/formula';
import { ParseExpr } from '../facts/exprs_parser';
import { ParseFormula } from '../facts/formula_parser';
import { TypeDeclAst, ConstructorAst } from '../lang/type_ast';
import { FuncAst, TypeAst, CaseAst, ExprBody, IfElseBody, ParamVar, ParamConstructor } from '../lang/func_ast';
import { Constant, Variable, Call } from '../facts/exprs';


describe('ParseBackwardRule', function() {

  // --- Algebra tactics ---

  it('parses Expr = with no refs', function() {
    const ast = ParseBackwardRule('(x + 1) =');
    assert.strictEqual(ast.variety, TACTIC_ALGEBRA);
    const a = ast as AlgebraTacticAst;
    assert.strictEqual(a.op, '=');
    assert.strictEqual(a.expr.to_string(), 'x + 1');
    assert.deepStrictEqual(a.refs, []);
  });

  it('parses Expr = with refs', function() {
    const ast = ParseBackwardRule('(x + 1) = since 1 2');
    assert.strictEqual(ast.variety, TACTIC_ALGEBRA);
    const a = ast as AlgebraTacticAst;
    assert.strictEqual(a.op, '=');
    assert.strictEqual(a.expr.to_string(), 'x + 1');
    assert.deepStrictEqual(a.refs, [1, 2]);
  });

  it('parses Expr <', function() {
    const ast = ParseBackwardRule('(y^2) <');
    const a = ast as AlgebraTacticAst;
    assert.strictEqual(a.op, '<');
    assert.deepStrictEqual(a.refs, []);
  });

  it('parses Expr <= with ref', function() {
    const ast = ParseBackwardRule('(2*x + 3) <= since 1');
    const a = ast as AlgebraTacticAst;
    assert.strictEqual(a.op, '<=');
    assert.deepStrictEqual(a.refs, [1]);
  });

  // --- Substitute tactics ---

  it('parses subst N', function() {
    const ast = ParseBackwardRule('subst 1');
    assert.strictEqual(ast.variety, TACTIC_SUBSTITUTE);
    const s = ast as SubstituteTacticAst;
    assert.strictEqual(s.index, 1);
    assert.strictEqual(s.right, true);
  });

  it('parses unsub N', function() {
    const ast = ParseBackwardRule('unsub 3');
    assert.strictEqual(ast.variety, TACTIC_SUBSTITUTE);
    const s = ast as SubstituteTacticAst;
    assert.strictEqual(s.index, 3);
    assert.strictEqual(s.right, false);
    assert.strictEqual(s.expr, undefined);
  });

  it('parses subst N Expr', function() {
    const ast = ParseBackwardRule('subst 1 => x + 1');
    assert.strictEqual(ast.variety, TACTIC_SUBSTITUTE);
    const s = ast as SubstituteTacticAst;
    assert.strictEqual(s.index, 1);
    assert.strictEqual(s.right, true);
    assert.strictEqual(s.expr!.to_string(), 'x + 1');
  });

  it('parses unsub N Expr with no spaces in expr', function() {
    const ast = ParseBackwardRule('unsub 2 => 2*b+b');
    assert.strictEqual(ast.variety, TACTIC_SUBSTITUTE);
    const s = ast as SubstituteTacticAst;
    assert.strictEqual(s.index, 2);
    assert.strictEqual(s.right, false);
    assert.strictEqual(s.expr!.to_string(), '2*b + b');
  });

  it('parses unsub N => variable', function() {
    const ast = ParseBackwardRule('unsub 2 => b');
    assert.strictEqual(ast.variety, TACTIC_SUBSTITUTE);
    const s = ast as SubstituteTacticAst;
    assert.strictEqual(s.expr!.to_string(), 'b');
  });

  it('parses unsub N => Expr', function() {
    const ast = ParseBackwardRule('unsub 2 => 2*b+b');
    assert.strictEqual(ast.variety, TACTIC_SUBSTITUTE);
    const s = ast as SubstituteTacticAst;
    assert.strictEqual(s.expr!.to_string(), '2*b + b');
  });

  it('parses unsub N => Expr with parens', function() {
    const ast = ParseBackwardRule('unsub 2 => (y + 3)');
    assert.strictEqual(ast.variety, TACTIC_SUBSTITUTE);
    const s = ast as SubstituteTacticAst;
    assert.strictEqual(s.index, 2);
    assert.strictEqual(s.right, false);
    assert.strictEqual(s.expr!.to_string(), 'y + 3');
  });

  // --- Definition tactics ---

  it('parses defof name', function() {
    const ast = ParseBackwardRule('defof echo_2');
    assert.strictEqual(ast.variety, TACTIC_DEFINITION);
  });

  it('parses undef name', function() {
    const ast = ParseBackwardRule('undef len_1');
    assert.strictEqual(ast.variety, TACTIC_DEFINITION);
  });

  // --- Error cases ---

  it('throws on empty input', function() {
    assert.throws(() => ParseBackwardRule(''), /syntax error/);
  });

  it('throws on garbage', function() {
    assert.throws(() => ParseBackwardRule('blah blah'), /syntax error/);
  });

});


describe('CreateTactic', function() {

  it('algebra = tautology (no givens, no refs)', function() {
    const ast = ParseBackwardRule('(y + x) =');
    const goal = ParseExpr('x + y');
    const env = new TopLevelEnv([], []);
    const tactic = CreateTactic(ast, goal, env);
    const formula = tactic.apply();
    assert.strictEqual(formula.left.to_string(), 'y + x');
  });

  it('algebra = citing a given', function() {
    const ast = ParseBackwardRule('(5) = since 1');
    const goal = ParseExpr('x + y');
    const env = new TopLevelEnv([], [], [ParseFormula('5 = x + y')]);
    const tactic = CreateTactic(ast, goal, env);
    const formula = tactic.apply();
    assert.strictEqual(formula.left.to_string(), '5');
  });

  it('algebra = rejects wrong equation', function() {
    const ast = ParseBackwardRule('(6) = since 1');
    const goal = ParseExpr('x + y');
    const env = new TopLevelEnv([], [], [ParseFormula('5 = x + y')]);
    assert.throws(() => CreateTactic(ast, goal, env), /algebra/);
  });

  it('backward subst undoes forward subst (replaces R with L)', function() {
    // Given x = 3, goal is 3 + 1, backward subst replaces 3 -> x
    const ast = ParseBackwardRule('subst 1');
    const goal = ParseExpr('3 + 1');
    const env = new TopLevelEnv([], [], [ParseFormula('x = 3')]);
    const tactic = CreateTactic(ast, goal, env);
    const formula = tactic.apply();
    assert.strictEqual(formula.left.to_string(), 'x + 1');
  });

  it('backward unsub undoes forward unsub (replaces L with R)', function() {
    // Given x = 3, goal is x + 1, backward unsub replaces x -> 3
    const ast = ParseBackwardRule('unsub 1');
    const goal = ParseExpr('x + 1');
    const env = new TopLevelEnv([], [], [ParseFormula('x = 3')]);
    const tactic = CreateTactic(ast, goal, env);
    const formula = tactic.apply();
    assert.strictEqual(formula.left.to_string(), '3 + 1');
  });

  it('backward subst with explicit premise (partial substitution)', function() {
    // Given x = 3, goal is 3 + 3*x, backward subst replaces 3 -> x
    // Default would replace all 3s, but explicit premise keeps the first 3
    const ast = ParseBackwardRule('subst 1 => 3 + x*x');
    const goal = ParseExpr('3 + 3*x');
    const env = new TopLevelEnv([], [], [ParseFormula('x = 3')]);
    const tactic = CreateTactic(ast, goal, env);
    const formula = tactic.apply();
    assert.strictEqual(formula.left.to_string(), '3 + x*x');
  });

  it('backward subst rejects invalid explicit premise', function() {
    const ast = ParseBackwardRule('subst 1 => y + 1');
    const goal = ParseExpr('3 + 1');
    const env = new TopLevelEnv([], [], [ParseFormula('x = 3')]);
    assert.throws(() => CreateTactic(ast, goal, env), /cannot be produced/);
  });

  it('backward subst with inequality in positive position', function() {
    const ast = ParseBackwardRule('subst 1');
    const goal = ParseExpr('x + 1');
    const env = new TopLevelEnv([], [], [ParseFormula('x < 3')]);
    const tactic = CreateTactic(ast, goal, env);
    const result = tactic.apply();
    assert.strictEqual(result.op, '<');
    assert.ok(result.left.equals(ParseExpr('3 + 1')));
    assert.ok(result.right.equals(ParseExpr('x + 1')));
  });

  it('backward subst with inequality in negative position', function() {
    const ast = ParseBackwardRule('subst 1');
    const goal = ParseExpr('5 - x');
    const env = new TopLevelEnv([], [], [ParseFormula('x < 3')]);
    const tactic = CreateTactic(ast, goal, env);
    const result = tactic.apply();
    assert.strictEqual(result.op, '<=');
    assert.ok(result.left.equals(ParseExpr('5 - x')));
    assert.ok(result.right.equals(ParseExpr('5 - 3')));
  });

  it('backward subst with inequality in negate', function() {
    const ast = ParseBackwardRule('subst 1');
    const goal = ParseExpr('-x');
    const env = new TopLevelEnv([], [], [ParseFormula('x <= 3')]);
    const tactic = CreateTactic(ast, goal, env);
    const result = tactic.apply();
    assert.strictEqual(result.op, '<');
    assert.ok(result.left.equals(ParseExpr('-x')));
    assert.ok(result.right.equals(ParseExpr('-3')));
  });

  it('backward subst with inequality multiply by positive constant', function() {
    const ast = ParseBackwardRule('subst 1');
    const goal = ParseExpr('2*x');
    const env = new TopLevelEnv([], [], [ParseFormula('x <= 3')]);
    const tactic = CreateTactic(ast, goal, env);
    const result = tactic.apply();
    assert.strictEqual(result.op, '<=');
    assert.ok(result.left.equals(ParseExpr('2*3')));
    assert.ok(result.right.equals(ParseExpr('2*x')));
  });

  it('backward subst with inequality multiply by negative constant flips', function() {
    const ast = ParseBackwardRule('subst 1');
    const goal = ParseExpr('-2*x');
    const env = new TopLevelEnv([], [], [ParseFormula('x <= 3')]);
    const tactic = CreateTactic(ast, goal, env);
    const result = tactic.apply();
    assert.strictEqual(result.op, '<');
    assert.ok(result.left.equals(ParseExpr('-2*x')));
    assert.ok(result.right.equals(ParseExpr('-2*3')));
  });

  it('backward subst with inequality rejects mixed positions', function() {
    const ast = ParseBackwardRule('subst 1');
    const goal = ParseExpr('x - x');
    const env = new TopLevelEnv([], [], [ParseFormula('x < 3')]);
    assert.throws(() => CreateTactic(ast, goal, env), /multiple matches/);
  });

  it('backward subst with inequality not found', function() {
    const ast = ParseBackwardRule('subst 1');
    const goal = ParseExpr('y + 1');
    const env = new TopLevelEnv([], [], [ParseFormula('x < 3')]);
    assert.throws(() => CreateTactic(ast, goal, env), /no matches found/);
  });

  it('backward subst with inequality does not recurse into user functions', function() {
    const ast = ParseBackwardRule('subst 1');
    const goal = ParseExpr('f(x)');
    const env = new TopLevelEnv([], [], [ParseFormula('x < 3')]);
    assert.throws(() => CreateTactic(ast, goal, env), /no matches found/);
  });

  it('subst rejects when nothing to substitute', function() {
    const ast = ParseBackwardRule('subst 1');
    const goal = ParseExpr('y + 1');
    const env = new TopLevelEnv([], [], [ParseFormula('x = 3')]);
    assert.throws(() => CreateTactic(ast, goal, env), /no matches found/);
  });

  it('subst rejects out of range index', function() {
    const ast = ParseBackwardRule('subst 2');
    const goal = ParseExpr('x + 1');
    const env = new TopLevelEnv([], [], [ParseFormula('x = 3')]);
    assert.throws(() => CreateTactic(ast, goal, env), /out of range/);
  });

  it('reverse of backward algebra produces forward algebra AST', function() {
    const ast = ParseBackwardRule('(y + x) =');
    const goal = ParseExpr('x + y');
    const env = new TopLevelEnv([], []);
    const tactic = CreateTactic(ast, goal, env);
    const rev = tactic.reverse();
    assert.strictEqual(rev.to_string(), '= x + y');
  });

  it('reverse of backward subst produces forward subst AST', function() {
    const ast = ParseBackwardRule('subst 1');
    const goal = ParseExpr('3 + 1');
    const env = new TopLevelEnv([], [], [ParseFormula('x = 3')]);
    const tactic = CreateTactic(ast, goal, env);
    const rev = tactic.reverse();
    assert.strictEqual(rev.to_string(), 'subst 1');
  });

});


describe('CreateTactic - definition', function() {

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

  it('backward defof len_1 on goal 0 gives premise len(nil)', function() {
    // Forward defof replaces pattern→body. Backward defof replaces body→pattern.
    // len_1: len(nil) = 0. Backward defof on goal 0 replaces 0→len(nil).
    const ast = ParseBackwardRule('defof len_1');
    const goal = Constant.of(0n);
    const tactic = CreateTactic(ast, goal, env);
    const formula = tactic.apply();
    assert.ok(formula.left.equals(Call.of('len', Variable.of('nil'))));
    assert.ok(formula.right.equals(Constant.of(0n)));
  });

  it('backward undef len_1 on goal len(nil) gives premise 0', function() {
    // Forward undef replaces body→pattern. Backward undef replaces pattern→body.
    // len_1: len(nil) = 0. Backward undef on goal len(nil) replaces len(nil)→0.
    const ast = ParseBackwardRule('undef len_1');
    const goal = Call.of('len', Variable.of('nil'));
    const tactic = CreateTactic(ast, goal, env);
    const formula = tactic.apply();
    assert.ok(formula.left.equals(Constant.of(0n)));
  });

  it('backward defof len_2 freshens variables', function() {
    // len_2: len(cons(a, L)) = 1 + len(L)
    // Backward defof on goal 1 + len(nil): replace (1 + len(L)) with len(cons(a, L))
    const goal = Call.add(Constant.of(1n), Call.of('len', Variable.of('nil')));
    const ast = ParseBackwardRule('defof len_2');
    const tactic = CreateTactic(ast, goal, env);
    const formula = tactic.apply();
    // Premise should be len(cons(a, nil)) for some a
    // The formula.left is the premise
    assert.ok(formula.left.to_string().includes('len(cons('));
  });

  it('backward defof fails when no matches', function() {
    const ast = ParseBackwardRule('defof len_1');
    const goal = Constant.of(5n);  // 5 doesn't match 0
    assert.throws(() => CreateTactic(ast, goal, env), /no matches/);
  });

  it('reverse of backward defof produces forward defof AST', function() {
    const ast = ParseBackwardRule('defof len_1');
    const goal = Constant.of(0n);
    const tactic = CreateTactic(ast, goal, env);
    const rev = tactic.reverse();
    assert.strictEqual(rev.to_string(), 'defof len_1');
  });

});


describe('CreateTactic - conditional definition', function() {

  const listType = new TypeDeclAst('List', [
    new ConstructorAst('nil', [], 'List'),
    new ConstructorAst('cons', ['Int', 'List'], 'List'),
  ]);

  const positivesFunc = new FuncAst('positives', new TypeAst(['List'], 'List'), [
    new CaseAst([new ParamVar('nil')], new ExprBody(Variable.of('nil'))),
    new CaseAst(
        [new ParamConstructor('cons', [new ParamVar('a'), new ParamVar('L')])],
        new IfElseBody(
            new Formula(Variable.of('a'), OP_LESS_THAN, Constant.of(0n)),
            Call.of('positives', Variable.of('L')),
            Call.of('cons', Variable.of('a'), Call.of('positives', Variable.of('L'))))),
  ]);

  it('backward defof positives_2a with satisfied condition', function() {
    const env = new TopLevelEnv([listType], [positivesFunc],
        [ParseFormula('a < 0')]);
    const ast = ParseBackwardRule('defof positives_2a since 1');
    const goal = Call.of('positives', Variable.of('L'));
    const tactic = CreateTactic(ast, goal, env);
    const formula = tactic.apply();
    // Backward defof replaces body→pattern: positives(L) → positives(cons(a', L'))
    assert.ok(formula.left.to_string().includes('positives(cons('));
  });

  it('backward defof conditional fails when condition not implied', function() {
    const env = new TopLevelEnv([listType], [positivesFunc],
        [ParseFormula('a <= 0')]);
    const ast = ParseBackwardRule('defof positives_2a since 1');
    const goal = Call.of('positives', Variable.of('L'));
    assert.throws(() => CreateTactic(ast, goal, env), /condition/);
  });

  it('backward defof conditional fails when no knowns provided', function() {
    const env = new TopLevelEnv([listType], [positivesFunc]);
    const ast = ParseBackwardRule('defof positives_2a');
    const goal = Call.of('positives', Variable.of('L'));
    assert.throws(() => CreateTactic(ast, goal, env), /known facts must be provided/);
  });

});


describe('CreateTactic - apply theorem', function() {

  it('backward apply equation theorem (replaces right with left)', function() {
    const comm = new TheoremAst('comm', [['a', 'Int'], ['b', 'Int']],
        undefined, ParseFormula('a + b = b + a'));
    const env = new TopLevelEnv([], [], [], [comm]);
    // Goal is y + x. Backward apply comm: replaces b+a (right side) with a+b (left side).
    const ast = ParseBackwardRule('apply comm');
    const goal = ParseExpr('y + x');
    const tactic = CreateTactic(ast, goal, env);
    const formula = tactic.apply();
    assert.strictEqual(formula.left.to_string(), 'x + y');
    assert.strictEqual(formula.right.to_string(), 'y + x');
  });

  it('backward unapp equation theorem', function() {
    const comm = new TheoremAst('comm', [['a', 'Int'], ['b', 'Int']],
        undefined, ParseFormula('a + b = b + a'));
    const env = new TopLevelEnv([], [], [], [comm]);
    // Backward unapp: replaces a+b (left side) with b+a (right side).
    const ast = ParseBackwardRule('unapp comm');
    const goal = ParseExpr('x + y');
    const tactic = CreateTactic(ast, goal, env);
    const formula = tactic.apply();
    assert.strictEqual(formula.left.to_string(), 'y + x');
  });

  it('backward apply rejects unknown theorem', function() {
    const env = new TopLevelEnv([], []);
    const ast = ParseBackwardRule('apply nonexistent');
    assert.throws(() => CreateTactic(ast, ParseExpr('x'), env), /unknown theorem/);
  });

  it('backward apply with premise', function() {
    const thm = new TheoremAst('foo', [['n', 'Int']],
        ParseFormula('0 < n'), ParseFormula('n = n'));
    const env = new TopLevelEnv([], [], [ParseFormula('0 < x')], [thm]);
    // Goal is x. Backward apply foo: replaces right (n) with left (n), trivially.
    const ast = ParseBackwardRule('apply foo since 1');
    const goal = ParseExpr('x');
    const tactic = CreateTactic(ast, goal, env);
    const formula = tactic.apply();
    assert.strictEqual(formula.left.to_string(), 'x');
  });

  it('backward apply inequality theorem', function() {
    const thm = new TheoremAst('succ', [['n', 'Int']],
        undefined, ParseFormula('n < n + 1'));
    const env = new TopLevelEnv([], [], [], [thm]);
    // Goal is x + 1. Backward apply succ: replaces n+1 (right) with n (left).
    const ast = ParseBackwardRule('apply succ');
    const goal = ParseExpr('x + 1');
    const tactic = CreateTactic(ast, goal, env);
    const result = tactic.apply();
    assert.strictEqual(result.op, '<');
    assert.strictEqual(result.left.to_string(), 'x');
  });

});
