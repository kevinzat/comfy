import * as assert from 'assert';
import { TypeDeclAst, ConstructorAst } from '../lang/type_ast';
import { FuncAst, TypeAst, CaseAst, ExprBody, ParamVar } from '../lang/func_ast';
import { TheoremAst } from '../lang/theorem_ast';
import { Constant, Variable, Call } from '../facts/exprs';
import { Formula, OP_EQUAL } from '../facts/formula';
import { AtomProp } from '../facts/prop';
import { ParseFormula } from '../facts/formula_parser';
import { TopLevelEnv, NestedEnv } from '../types/env';
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
    const env = new NestedEnv(new TopLevelEnv([listType], [lenFunc]), [['xs', 'List']]);
    const cases = buildCases(formula, env, 'xs');

    assert.equal(cases.length, 2);
    assert.equal(cases[0].ctor.name, 'nil');
    assert.equal(cases[1].ctor.name, 'cons');
  });

  it('nil case has no args and no IH', function() {
    const formula = ParseFormula('len(xs) = len(xs)');
    const env = new NestedEnv(new TopLevelEnv([listType], [lenFunc]), [['xs', 'List']]);
    const cases = buildCases(formula, env, 'xs');

    const nilCase = cases[0];
    assert.equal(nilCase.argNames.length, 0);
    assert.equal(nilCase.ihTheorems.length, 0);
    // Goal should substitute nil for xs.
    assert.equal(nilCase.goal.to_string(), 'len(nil) = len(nil)');
  });

  it('cons case has two args and one IH theorem for the recursive arg', function() {
    const formula = ParseFormula('len(xs) = len(xs)');
    const env = new NestedEnv(new TopLevelEnv([listType], [lenFunc]), [['xs', 'List']]);
    const cases = buildCases(formula, env, 'xs');

    const consCase = cases[1];
    assert.equal(consCase.argNames.length, 2);
    assert.equal(consCase.argTypes[0], 'Int');
    assert.equal(consCase.argTypes[1], 'List');

    // Should have 1 IH theorem for the List-typed argument.
    assert.equal(consCase.ihTheorems.length, 1);
    assert.equal(consCase.ihArgNames.length, 1);
    assert.equal(consCase.ihTheorems[0].name, 'IH');
  });

  it('picks lowercase for Int args and uppercase for non-Int args', function() {
    const formula = ParseFormula('len(xs) = len(xs)');
    const env = new NestedEnv(new TopLevelEnv([listType], [lenFunc]), [['xs', 'List']]);
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
    const env = new NestedEnv(new TopLevelEnv([listType], [lenFunc]),
        [['a', 'Int'], ['b', 'Int'], ['c', 'Int'], ['xs', 'List']]);
    assert.throws(() => buildCases(formula, env, 'xs'),
        /default argument name "a" clashes/);
  });

  it('uses explicit names to avoid formula var clash', function() {
    const formula = ParseFormula('a + b + c + len(xs) = 0');
    const env = new NestedEnv(new TopLevelEnv([listType], [lenFunc]),
        [['a', 'Int'], ['b', 'Int'], ['c', 'Int'], ['xs', 'List']]);
    const cases = buildCases(formula, env, 'xs', ['d', 'Y']);

    const consCase = cases[1];
    assert.equal(consCase.argNames[0], 'd');
    assert.equal(consCase.argNames[1], 'Y');
  });

  it('goal substitutes constructor call for variable', function() {
    const formula = ParseFormula('len(xs) + 1 = len(xs) + 1');
    const env = new NestedEnv(new TopLevelEnv([listType], [lenFunc]), [['xs', 'List']]);
    const cases = buildCases(formula, env, 'xs');

    const consCase = cases[1];
    const a = consCase.argNames[0]; // Int arg
    const b = consCase.argNames[1]; // List arg (recursive)
    assert.equal(consCase.goal.to_string(),
        `len(cons(${a}, ${b})) + 1 = len(cons(${a}, ${b})) + 1`);
  });

  it('IH theorem replaces variable with recursive arg', function() {
    const formula = ParseFormula('len(xs) + 1 = len(xs) + 1');
    const env = new NestedEnv(new TopLevelEnv([listType], [lenFunc]), [['xs', 'List']]);
    const cases = buildCases(formula, env, 'xs');

    const consCase = cases[1];
    const b = consCase.ihArgNames[0]; // The List-typed arg
    assert.equal(consCase.ihTheorems[0].conclusion.to_string(),
        `len(${b}) + 1 = len(${b}) + 1`);
  });

  it('IH theorem is available via env.getTheorem', function() {
    const given = ParseFormula('1 = 1');
    const env = new NestedEnv(new TopLevelEnv([listType], [lenFunc]), [['xs', 'List']], [given]);
    const formula = ParseFormula('len(xs) = len(xs)');
    const cases = buildCases(formula, env, 'xs');

    // nil case: no IH theorems.
    assert.equal(cases[0].ihTheorems.length, 0);

    // cons case: 1 IH theorem, env has it accessible.
    assert.equal(cases[1].ihTheorems.length, 1);
    const ihName = cases[1].ihTheorems[0].name;
    assert.ok(cases[1].env.hasTheorem(ihName));
    assert.equal(cases[1].env.getTheorem(ihName).conclusion.to_string(),
        cases[1].ihTheorems[0].conclusion.to_string());

    // IH is not a fact — env facts are only from parent.
    assert.equal(cases[0].env.numFacts(), 1);
    assert.equal(cases[1].env.numFacts(), 1);
    assert.equal(cases[1].env.getFact(1).to_string(), '1 = 1');
  });

  it('nested env has constructor arg variables', function() {
    const formula = ParseFormula('len(xs) = len(xs)');
    const env = new NestedEnv(new TopLevelEnv([listType], [lenFunc]), [['xs', 'List']]);
    const cases = buildCases(formula, env, 'xs');

    const consCase = cases[1];
    for (const name of consCase.argNames) {
      assert.ok(consCase.env.hasVariable(name),
          `env should have variable "${name}"`);
    }
  });

  it('throws for non-named type variable', function() {
    const formula = ParseFormula('n = n');
    const env = new NestedEnv(new TopLevelEnv([], []), [['n', 'Int']]);
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
    const env = new NestedEnv(new TopLevelEnv([treeType], [sizeFunc]), [['t', 'Tree']]);
    const cases = buildCases(formula, env, 't');

    assert.equal(cases.length, 2);

    // node case should have 3 args and 2 IH theorems (for the two Tree-typed args).
    const nodeCase = cases[1];
    assert.equal(nodeCase.argNames.length, 3);
    assert.equal(nodeCase.ihTheorems.length, 2);
    assert.equal(nodeCase.ihArgNames.length, 2);

    // Tree args uppercase, Int arg lowercase.
    assert.ok(nodeCase.argNames[0] === nodeCase.argNames[0].toUpperCase(),
        `expected uppercase for Tree arg, got "${nodeCase.argNames[0]}"`);
    assert.ok(nodeCase.argNames[1] === nodeCase.argNames[1].toLowerCase(),
        `expected lowercase for Int arg, got "${nodeCase.argNames[1]}"`);
    assert.ok(nodeCase.argNames[2] === nodeCase.argNames[2].toUpperCase(),
        `expected uppercase for Tree arg, got "${nodeCase.argNames[2]}"`);

    // IH theorems are named after the recursive args.
    assert.equal(nodeCase.ihTheorems[0].name, 'IH_' + nodeCase.argNames[0]);
    assert.equal(nodeCase.ihTheorems[1].name, 'IH_' + nodeCase.argNames[2]);
  });

  it('single IH is named IH, multiple IH use IH_<name>', function() {
    // Single recursive arg: IH
    const formula = ParseFormula('len(xs) = len(xs)');
    const env = new NestedEnv(new TopLevelEnv([listType], [lenFunc]), [['xs', 'List']]);
    const cases = buildCases(formula, env, 'xs');
    assert.equal(cases[1].ihTheorems[0].name, 'IH');

    // Multiple recursive args: IH_<name>
    const treeType = new TypeDeclAst('Tree', [
      new ConstructorAst('leaf', [], 'Tree'),
      new ConstructorAst('node', ['Tree', 'Int', 'Tree'], 'Tree'),
    ]);
    const sizeFunc = new FuncAst('size', new TypeAst(['Tree'], 'Int'), [
      new CaseAst([new ParamVar('leaf')], new ExprBody(Constant.of(0n))),
      new CaseAst([new ParamVar('x')], new ExprBody(Constant.of(1n))),
    ]);
    const treeFormula = ParseFormula('size(t) = size(t)');
    const treeEnv = new NestedEnv(
        new TopLevelEnv([treeType], [sizeFunc]), [['t', 'Tree']]);
    const treeCases = buildCases(treeFormula, treeEnv, 't');
    assert.equal(treeCases[1].ihTheorems[0].name, 'IH_T');
    assert.equal(treeCases[1].ihTheorems[1].name, 'IH_U');
  });

  it('renames IH to IH2 when IH already exists as a theorem', function() {
    const formula = ParseFormula('len(xs) = len(xs)');
    const existingIH = new TheoremAst('IH', [], [],
        new AtomProp(ParseFormula('0 = 0')));
    const env = new NestedEnv(
        new TopLevelEnv([listType], [lenFunc], [], [existingIH]),
        [['xs', 'List']]);
    const cases = buildCases(formula, env, 'xs');
    // IH is taken, so should be IH2
    assert.equal(cases[1].ihTheorems[0].name, 'IH2');
  });

  it('renames IH_L to IH_L2 when IH_L already exists as a theorem', function() {
    const treeType = new TypeDeclAst('Tree', [
      new ConstructorAst('leaf', [], 'Tree'),
      new ConstructorAst('node', ['Tree', 'Int', 'Tree'], 'Tree'),
    ]);
    const sizeFunc = new FuncAst('size', new TypeAst(['Tree'], 'Int'), [
      new CaseAst([new ParamVar('leaf')], new ExprBody(Constant.of(0n))),
      new CaseAst([new ParamVar('x')], new ExprBody(Constant.of(1n))),
    ]);
    const existingIH = new TheoremAst('IH_T', [], [],
        new AtomProp(ParseFormula('0 = 0')));
    const formula = ParseFormula('size(t) = size(t)');
    const env = new NestedEnv(
        new TopLevelEnv([treeType], [sizeFunc], [], [existingIH]),
        [['t', 'Tree']]);
    const cases = buildCases(formula, env, 't');
    // IH_T is taken, so first IH becomes IH_T2; second is IH_U (not taken)
    assert.equal(cases[1].ihTheorems[0].name, 'IH_T2');
    assert.equal(cases[1].ihTheorems[1].name, 'IH_U');
  });

  it('IH theorem params include non-induction variables from formula', function() {
    const concatFunc = new FuncAst('concat', new TypeAst(['List', 'List'], 'List'), [
      new CaseAst([new ParamVar('nil'), new ParamVar('R')],
          new ExprBody(Variable.of('R'))),
      new CaseAst([new ParamVar('x'), new ParamVar('R')],
          new ExprBody(Variable.of('R'))),
    ]);
    const formula = ParseFormula('len(concat(S, T)) = len(S) + len(T)');
    const env = new NestedEnv(
        new TopLevelEnv([listType], [lenFunc, concatFunc]),
        [['S', 'List'], ['T', 'List']]);
    const cases = buildCases(formula, env, 'S');

    const consCase = cases[1];
    assert.equal(consCase.ihTheorems.length, 1);
    const ih = consCase.ihTheorems[0];
    // IH should have T as a param (universally quantified).
    assert.equal(ih.params.length, 1);
    assert.equal(ih.params[0][0], 'T');
    assert.equal(ih.params[0][1], 'List');
  });

  it('IH theorem includes substituted premise when premise is provided', function() {
    // Theorem: forall (xs : List) : xs = nil => len(xs) = 0
    // Induction on xs, cons case with cons(a, L):
    //   IH premise: cons(a, L) = nil  ... wait, that's wrong.
    //   Actually the premise gets the *recursive arg* substituted:
    //   IH premise: L = nil (replacing xs with L)
    //   IH conclusion: len(L) = 0 (replacing xs with L)
    const formula = ParseFormula('len(xs) = 0');
    const premise = ParseFormula('xs = nil');
    const env = new NestedEnv(new TopLevelEnv([listType], [lenFunc]), [['xs', 'List']]);
    const cases = buildCases(formula, env, 'xs', undefined, [premise]);

    // nil case: no IH
    assert.equal(cases[0].ihTheorems.length, 0);

    // cons case: IH has substituted premise
    const consCase = cases[1];
    assert.equal(consCase.ihTheorems.length, 1);
    const ih = consCase.ihTheorems[0];
    assert.equal(ih.premises.length, 1, 'IH should have a premise');
    const argName = consCase.ihArgNames[0]; // the List-typed arg
    assert.equal(ih.premises[0].to_string(), `${argName} = nil`);
    assert.equal(ih.conclusion.to_string(), `len(${argName}) = 0`);
  });

  it('assigns distinct names to multiple Int params', function() {
    const pairType = new TypeDeclAst('Pair', [
      new ConstructorAst('mkpair', ['Int', 'Int'], 'Pair'),
    ]);
    const fstFunc = new FuncAst('fst', new TypeAst(['Pair'], 'Int'), [
      new CaseAst([new ParamVar('x')], new ExprBody(Variable.of('x'))),
    ]);
    const formula = ParseFormula('fst(p) = fst(p)');
    const env = new NestedEnv(
        new TopLevelEnv([pairType], [fstFunc]), [['p', 'Pair']]);
    const cases = buildCases(formula, env, 'p');
    // mkpair has two Int params; they should get distinct lowercase names.
    assert.equal(cases[0].argNames.length, 2);
    assert.notEqual(cases[0].argNames[0], cases[0].argNames[1]);
  });

  it('renames IH to IH3 when IH and IH2 already exist', function() {
    const formula = ParseFormula('len(xs) = len(xs)');
    const ih1 = new TheoremAst('IH', [], [],
        new AtomProp(ParseFormula('0 = 0')));
    const ih2 = new TheoremAst('IH2', [], [],
        new AtomProp(ParseFormula('0 = 0')));
    const env = new NestedEnv(
        new TopLevelEnv([listType], [lenFunc], [], [ih1, ih2]),
        [['xs', 'List']]);
    const cases = buildCases(formula, env, 'xs');
    assert.equal(cases[1].ihTheorems[0].name, 'IH3');
  });

  it('IH theorem has no premise when none is provided', function() {
    const formula = ParseFormula('len(xs) = len(xs)');
    const env = new NestedEnv(new TopLevelEnv([listType], [lenFunc]), [['xs', 'List']]);
    const cases = buildCases(formula, env, 'xs');

    const consCase = cases[1];
    assert.deepEqual(consCase.ihTheorems[0].premises, []);
  });

});
