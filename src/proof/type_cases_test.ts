import * as assert from 'assert';
import { TypeDeclAst, ConstructorAst } from '../lang/type_ast';
import { FuncAst, TypeAst, CaseAst, ExprBody, ParamVar } from '../lang/func_ast';
import { Constant, Variable, Call } from '../facts/exprs';
import { AtomProp } from '../facts/prop';
import { Formula } from '../facts/formula';
import { ParseFormula } from '../facts/formula_parser';
import { TopLevelEnv, NestedEnv } from '../types/env';
import { ParseProofMethod, FindProofMethodMatches, parseTacticMethod } from './proof_tactic';
import { typeCasesParser } from './type_cases';


const listType = new TypeDeclAst('List', [
  new ConstructorAst('nil', [], 'List'),
  new ConstructorAst('cons', ['Int', 'List'], 'List'),
]);

const lenFunc = new FuncAst('len', new TypeAst(['List'], 'Int'), [
  new CaseAst([new ParamVar('nil')], new ExprBody(Constant.of(0n))),
  new CaseAst([new ParamVar('x')],
      new ExprBody(Call.add(Constant.of(1n), Call.of('len', Variable.of('x'))))),
]);


describe('parseTacticMethod for type_cases', function() {

  it('parses "cases on xs"', function() {
    const method = parseTacticMethod('cases on xs');
    assert.ok(method !== null);
    assert.strictEqual(method.kind, 'type_cases');
    if (method.kind === 'type_cases') {
      assert.strictEqual(method.varName, 'xs');
      assert.strictEqual(method.argNames, undefined);
    }
  });

  it('parses "cases on xs (a, L)"', function() {
    const method = parseTacticMethod('cases on xs (a, L)');
    assert.ok(method !== null);
    assert.strictEqual(method.kind, 'type_cases');
    if (method.kind === 'type_cases') {
      assert.strictEqual(method.varName, 'xs');
      assert.deepStrictEqual(method.argNames, ['a', 'L']);
    }
  });

  it('does not conflict with "cases P or Q"', function() {
    const method = parseTacticMethod('cases x < 0 or 0 <= x');
    assert.ok(method !== null);
    assert.strictEqual(method.kind, 'disj_cases');
  });
});


describe('type_cases tactic', function() {

  const env = new NestedEnv(new TopLevelEnv([listType], [lenFunc]), [['xs', 'List']]);
  const formula = ParseFormula('len(xs) = len(xs)');

  it('parses "cases on xs" via ParseProofMethod', function() {
    const result = ParseProofMethod('cases on xs', new AtomProp(formula), env, []);
    assert.ok(typeof result !== 'string');
    assert.strictEqual(result.kind, 'tactic');
  });

  it('returns error for unknown variable', function() {
    const result = ParseProofMethod('cases on ys', new AtomProp(formula), env, []);
    assert.ok(typeof result === 'string');
    assert.ok(result.includes('unknown variable'));
  });

  it('returns error for built-in type', function() {
    const intEnv = new NestedEnv(new TopLevelEnv([listType], [lenFunc]), [['n', 'Int']]);
    const result = ParseProofMethod('cases on n', new AtomProp(formula), intEnv, []);
    assert.ok(typeof result === 'string');
    assert.ok(result.includes('built-in type'));
  });

  it('decompose generates one case per constructor with no IH', function() {
    const result = ParseProofMethod('cases on xs', new AtomProp(formula), env, []);
    assert.ok(typeof result !== 'string' && result.kind === 'tactic');
    const goals = result.tactic.decompose();
    assert.strictEqual(goals.length, 2);

    // nil case
    assert.strictEqual(goals[0].label, 'nil');
    assert.strictEqual(goals[0].goal.to_string(), 'len(nil) = len(nil)');
    assert.strictEqual(goals[0].newTheorems.length, 0);  // no IH

    // cons case
    assert.strictEqual(goals[1].label, 'cons(a, L)');
    assert.strictEqual(goals[1].goal.to_string(), 'len(cons(a, L)) = len(cons(a, L))');
    assert.strictEqual(goals[1].newTheorems.length, 0);  // no IH
  });

  it('autocompletes "cases on" with inductive variables', function() {
    const matches = typeCasesParser.getMatches('cases on', formula, env);
    assert.ok(matches.length >= 2);
    assert.ok(matches.some(m => m.completion === 'cases on xs'));
    assert.ok(matches.some(m => m.completion === 'cases on xs (a, L)'));
  });

  it('autocompletes "cases o" with partial on', function() {
    const matches = typeCasesParser.getMatches('cases o', formula, env);
    assert.ok(matches.length >= 1);
    assert.ok(matches.some(m => m.completion === 'cases on xs'));
  });

  it('decompose with explicit arg names', function() {
    const result = ParseProofMethod('cases on xs (x, R)', new AtomProp(formula), env, []);
    assert.ok(typeof result !== 'string' && result.kind === 'tactic');
    const goals = result.tactic.decompose();
    assert.strictEqual(goals[1].label, 'cons(x, R)');
    assert.strictEqual(goals[1].goal.to_string(), 'len(cons(x, R)) = len(cons(x, R))');
  });

  it('errors when default names clash with formula vars', function() {
    // Formula uses 'a' which would be the default Int arg name
    const clashFormula = ParseFormula('a + len(xs) = a + len(xs)');
    const clashEnv = new NestedEnv(
        new TopLevelEnv([listType], [lenFunc]),
        [['xs', 'List'], ['a', 'Int']]);
    const result = ParseProofMethod('cases on xs', new AtomProp(clashFormula), clashEnv, []);
    assert.ok(typeof result !== 'string' && result.kind === 'tactic');
    assert.throws(() => result.tactic.decompose(), /clashes/);
  });

  it('autocompletes partial "cas" to "cases on xs"', function() {
    const matches = typeCasesParser.getMatches('cas', formula, env);
    assert.ok(matches.some(m => m.completion === 'cases on xs'));
  });

  it('autocompletes "cases on x" with partial var name', function() {
    const matches = typeCasesParser.getMatches('cases on x', formula, env);
    assert.ok(matches.some(m => m.completion === 'cases on xs'));
  });

  it('autocompletes with exact var name match', function() {
    const matches = typeCasesParser.getMatches('cases on xs', formula, env);
    assert.ok(matches.some(m => m.completion === 'cases on xs'));
  });

  it('returns no type_cases matches for bare "cases"', function() {
    // "cases" alone — length 1 and p0 === 'cases', skips both branches
    const matches = typeCasesParser.getMatches('cases', formula, env);
    assert.strictEqual(matches.length, 0);
  });

  it('returns no matches for "cases foo" (not "on")', function() {
    // parts = ['cases', 'foo'], p1 !== 'on' and !'on'.startsWith('foo')
    const matches = typeCasesParser.getMatches('cases foo', formula, env);
    assert.strictEqual(matches.length, 0);
  });

  it('returns no matches for non-matching prefix', function() {
    const matches = typeCasesParser.getMatches('induction', formula, env);
    assert.strictEqual(matches.length, 0);
  });

  it('returns no matches for too many parts', function() {
    const matches = typeCasesParser.getMatches('cases on xs extra', formula, env);
    assert.strictEqual(matches.length, 0);
  });

  it('handles type with no constructor params', function() {
    const unitType = new TypeDeclAst('Unit', [
      new ConstructorAst('unit', [], 'Unit'),
    ]);
    const unitEnv = new NestedEnv(
        new TopLevelEnv([unitType], []),
        [['u', 'Unit']]);
    // Need a formula that references u so casesVars finds it
    // Use a function that takes Unit — but simpler: just use a variable expression
    // Actually casesVars looks at formula.left.vars() and formula.right.vars()
    // We need 'u' in the formula. We can't use ParseFormula for that since 'u' isn't
    // a numeric expression. Let's create a formula directly.
    const unitFormula = new Formula(Variable.of('u'), '=', Variable.of('u'));
    const matches = typeCasesParser.getMatches('cases on', unitFormula, unitEnv);
    assert.ok(matches.some(m => m.completion === 'cases on u'));
    // Should NOT have a version with default args
    assert.ok(!matches.some(m => m.completion.includes('(')));
  });

  it('skips non-inductive variables in autocomplete', function() {
    // Int variable z is not inductive, should not appear in suggestions
    const envWithInt = new NestedEnv(
        new TopLevelEnv([listType], [lenFunc]),
        [['xs', 'List'], ['z', 'Int']]);
    const mixFormula = ParseFormula('z + len(xs) = z + len(xs)');
    const matches = typeCasesParser.getMatches('cases on z', mixFormula, envWithInt);
    assert.strictEqual(matches.length, 0);
  });

  it('sorts multiple inductive variables', function() {
    const envMulti = new NestedEnv(
        new TopLevelEnv([listType], [lenFunc]),
        [['ys', 'List'], ['xs', 'List']]);
    const multiFormula = ParseFormula('len(xs) + len(ys) = len(ys) + len(xs)');
    const matches = typeCasesParser.getMatches('cases on', multiFormula, envMulti);
    // Both xs and ys should appear
    assert.ok(matches.some(m => m.completion.includes('xs')));
    assert.ok(matches.some(m => m.completion.includes('ys')));
  });
});
