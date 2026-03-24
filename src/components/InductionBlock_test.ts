import * as assert from 'assert';
import { TypeDeclAst, ConstructorAst } from '../lang/type_ast';
import { FuncAst, TypeAst, CaseAst, ExprBody, ParamVar } from '../lang/func_ast';
import { Constant, Variable, Call } from '../facts/exprs';
import { Formula, OP_EQUAL } from '../facts/formula';
import { ParseFormula } from '../facts/formula_parser';
import { TopLevelEnv } from '../types/env';
import { buildCases } from './InductionBlock';


const listType = new TypeDeclAst('List', [
  new ConstructorAst('nil', [], 'List'),
  new ConstructorAst('cons', ['Int', 'List'], 'List'),
]);

const lenFunc = new FuncAst('len', new TypeAst(['List'], 'Int'), [
  new CaseAst([new ParamVar('nil')], new ExprBody(Constant.of(0n))),
  new CaseAst([new ParamVar('x')],
      new ExprBody(Call.add(Constant.of(1n), Call.of('len', Variable.of('x'))))),
]);


describe('buildCases', function() {

  it('generates cases for each constructor', function() {
    const formula = ParseFormula('len(xs) = len(xs)');
    const env = new TopLevelEnv([listType], [lenFunc], [['xs', 'List']]);
    const cases = buildCases(formula, env, 'xs');

    assert.equal(cases.length, 2);
    assert.equal(cases[0].ctor.name, 'nil');
    assert.equal(cases[1].ctor.name, 'cons');
  });

  it('nil case has no args and no IH', function() {
    const formula = ParseFormula('len(xs) = len(xs)');
    const env = new TopLevelEnv([listType], [lenFunc], [['xs', 'List']]);
    const cases = buildCases(formula, env, 'xs');

    const nilCase = cases[0];
    assert.equal(nilCase.argNames.length, 0);
    assert.equal(nilCase.ihFacts.length, 0);
    // Goal should substitute nil for xs.
    assert.equal(nilCase.goal.to_string(), 'len(nil) = len(nil)');
  });

  it('cons case has two args and one IH for the recursive arg', function() {
    const formula = ParseFormula('len(xs) = len(xs)');
    const env = new TopLevelEnv([listType], [lenFunc], [['xs', 'List']]);
    const cases = buildCases(formula, env, 'xs');

    const consCase = cases[1];
    assert.equal(consCase.argNames.length, 2);
    assert.equal(consCase.argTypes[0], 'Int');
    assert.equal(consCase.argTypes[1], 'List');

    // Should have 1 IH for the List-typed argument.
    assert.equal(consCase.ihFacts.length, 1);
    assert.equal(consCase.ihArgNames.length, 1);
  });

  it('picks lowercase for Int args and uppercase for non-Int args', function() {
    const formula = ParseFormula('len(xs) = len(xs)');
    const env = new TopLevelEnv([listType], [lenFunc], [['xs', 'List']]);
    const cases = buildCases(formula, env, 'xs');

    const consCase = cases[1];
    // First arg is Int -> lowercase, second arg is List -> uppercase.
    const intArg = consCase.argNames[0];
    const listArg = consCase.argNames[1];
    assert.ok(intArg === intArg.toLowerCase(),
        `expected lowercase for Int arg, got "${intArg}"`);
    assert.ok(listArg === listArg.toUpperCase(),
        `expected uppercase for List arg, got "${listArg}"`);
  });

  it('errors when default names clash with formula vars', function() {
    // Default Int arg is "a", which clashes with formula variable "a".
    const formula = ParseFormula('a + b + c + len(xs) = 0');
    const env = new TopLevelEnv([listType], [lenFunc],
        [['a', 'Int'], ['b', 'Int'], ['c', 'Int'], ['xs', 'List']]);
    assert.throws(() => buildCases(formula, env, 'xs'),
        /default argument name "a" clashes/);
  });

  it('uses explicit names to avoid formula var clash', function() {
    const formula = ParseFormula('a + b + c + len(xs) = 0');
    const env = new TopLevelEnv([listType], [lenFunc],
        [['a', 'Int'], ['b', 'Int'], ['c', 'Int'], ['xs', 'List']]);
    const cases = buildCases(formula, env, 'xs', ['d', 'Y']);

    const consCase = cases[1];
    assert.equal(consCase.argNames[0], 'd');
    assert.equal(consCase.argNames[1], 'Y');
  });

  it('goal substitutes constructor call for variable', function() {
    const formula = ParseFormula('len(xs) + 1 = len(xs) + 1');
    const env = new TopLevelEnv([listType], [lenFunc], [['xs', 'List']]);
    const cases = buildCases(formula, env, 'xs');

    const consCase = cases[1];
    const a = consCase.argNames[0]; // Int arg
    const b = consCase.argNames[1]; // List arg (recursive)
    assert.equal(consCase.goal.to_string(),
        `len(cons(${a}, ${b})) + 1 = len(cons(${a}, ${b})) + 1`);
  });

  it('IH replaces variable with recursive arg', function() {
    const formula = ParseFormula('len(xs) + 1 = len(xs) + 1');
    const env = new TopLevelEnv([listType], [lenFunc], [['xs', 'List']]);
    const cases = buildCases(formula, env, 'xs');

    const consCase = cases[1];
    const b = consCase.ihArgNames[0]; // The List-typed arg
    assert.equal(consCase.ihFacts[0].to_string(),
        `len(${b}) + 1 = len(${b}) + 1`);
  });

  it('nested env has correct number of facts', function() {
    const given = ParseFormula('1 = 1');
    const env = new TopLevelEnv([listType], [lenFunc], [['xs', 'List']], [given]);
    const formula = ParseFormula('len(xs) = len(xs)');
    const cases = buildCases(formula, env, 'xs');

    // nil case: no IH, so env has 1 parent fact.
    assert.equal(cases[0].env.numFacts(), 1);

    // cons case: 1 IH, so env has 1 parent fact + 1 local fact = 2.
    assert.equal(cases[1].env.numFacts(), 2);
    // Parent fact is at index 1.
    assert.equal(cases[1].env.getFact(1).to_string(), '1 = 1');
    // IH is at index 2.
    assert.equal(cases[1].env.getFact(2), cases[1].ihFacts[0]);
  });

  it('nested env has constructor arg variables', function() {
    const formula = ParseFormula('len(xs) = len(xs)');
    const env = new TopLevelEnv([listType], [lenFunc], [['xs', 'List']]);
    const cases = buildCases(formula, env, 'xs');

    const consCase = cases[1];
    for (const name of consCase.argNames) {
      assert.ok(consCase.env.hasVariable(name),
          `env should have variable "${name}"`);
    }
  });

  it('throws for non-named type variable', function() {
    // Can't easily test this since TopLevelEnv only stores named types for variables,
    // but we can test the error for built-in type.
    const formula = ParseFormula('n = n');
    const env = new TopLevelEnv([], [], [['n', 'Int']]);
    assert.throws(() => buildCases(formula, env, 'n'),
        /cannot induct on built-in type/);
  });

  it('handles type with multiple recursive constructors', function() {
    const treeType = new TypeDeclAst('Tree', [
      new ConstructorAst('leaf', [], 'Tree'),
      new ConstructorAst('node', ['Tree', 'Int', 'Tree'], 'Tree'),
    ]);
    const formula = ParseFormula('size(t) = size(t)');
    const sizeFunc = new FuncAst('size', new TypeAst(['Tree'], 'Int'), [
      new CaseAst([new ParamVar('leaf')], new ExprBody(Constant.of(0n))),
      new CaseAst([new ParamVar('x')], new ExprBody(Constant.of(1n))),
    ]);
    const env = new TopLevelEnv([treeType], [sizeFunc], [['t', 'Tree']]);
    const cases = buildCases(formula, env, 't');

    assert.equal(cases.length, 2);

    // node case should have 3 args and 2 IHs (for the two Tree-typed args).
    const nodeCase = cases[1];
    assert.equal(nodeCase.argNames.length, 3);
    assert.equal(nodeCase.ihFacts.length, 2);
    assert.equal(nodeCase.ihArgNames.length, 2);

    // Tree args uppercase, Int arg lowercase.
    assert.ok(nodeCase.argNames[0] === nodeCase.argNames[0].toUpperCase(),
        `expected uppercase for Tree arg, got "${nodeCase.argNames[0]}"`);
    assert.ok(nodeCase.argNames[1] === nodeCase.argNames[1].toLowerCase(),
        `expected lowercase for Int arg, got "${nodeCase.argNames[1]}"`);
    assert.ok(nodeCase.argNames[2] === nodeCase.argNames[2].toUpperCase(),
        `expected uppercase for Tree arg, got "${nodeCase.argNames[2]}"`);
  });

});
