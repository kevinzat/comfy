import * as assert from 'assert';
import { TypeDeclAst, ConstructorAst } from '../lang/type_ast';
import { FuncAst, TypeAst, CaseAst, ExprBody, ParamVar } from '../lang/func_ast';
import { TheoremAst } from '../lang/theorem_ast';
import { Constant, Variable, Call } from '../facts/exprs';
import { Formula, OP_EQUAL } from '../facts/formula';
import { AtomProp, NotProp, OrProp } from '../facts/prop';
import { ParseFormula } from '../facts/formula_parser';
import { TopLevelEnv, NestedEnv } from '../types/env';
import { buildCases, inductionParser } from './induction';


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
    const formula = new AtomProp(ParseFormula('len(xs) = len(xs)'));
    const env = new NestedEnv(new TopLevelEnv([listType], [lenFunc]), [['xs', 'List']]);
    const cases = buildCases(formula, env, 'xs');

    assert.equal(cases.length, 2);
    assert.equal(cases[0].ctor.name, 'nil');
    assert.equal(cases[1].ctor.name, 'cons');
  });

  it('nil case has no args and no IH', function() {
    const formula = new AtomProp(ParseFormula('len(xs) = len(xs)'));
    const env = new NestedEnv(new TopLevelEnv([listType], [lenFunc]), [['xs', 'List']]);
    const cases = buildCases(formula, env, 'xs');

    const nilCase = cases[0];
    assert.equal(nilCase.argNames.length, 0);
    assert.equal(nilCase.ihTheorems.length, 0);
    // Goal should substitute nil for xs.
    assert.equal(nilCase.goal.to_string(), 'len(nil) = len(nil)');
  });

  it('cons case has two args and one IH theorem for the recursive arg', function() {
    const formula = new AtomProp(ParseFormula('len(xs) = len(xs)'));
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
    const formula = new AtomProp(ParseFormula('len(xs) = len(xs)'));
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
    const formula = new AtomProp(ParseFormula('a + b + c + len(xs) = 0'));
    const env = new NestedEnv(new TopLevelEnv([listType], [lenFunc]),
        [['a', 'Int'], ['b', 'Int'], ['c', 'Int'], ['xs', 'List']]);
    assert.throws(() => buildCases(formula, env, 'xs'),
        /default argument name "a" clashes/);
  });

  it('uses explicit names to avoid formula var clash', function() {
    const formula = new AtomProp(ParseFormula('a + b + c + len(xs) = 0'));
    const env = new NestedEnv(new TopLevelEnv([listType], [lenFunc]),
        [['a', 'Int'], ['b', 'Int'], ['c', 'Int'], ['xs', 'List']]);
    const cases = buildCases(formula, env, 'xs', ['d', 'Y']);

    const consCase = cases[1];
    assert.equal(consCase.argNames[0], 'd');
    assert.equal(consCase.argNames[1], 'Y');
  });

  it('goal substitutes constructor call for variable', function() {
    const formula = new AtomProp(ParseFormula('len(xs) + 1 = len(xs) + 1'));
    const env = new NestedEnv(new TopLevelEnv([listType], [lenFunc]), [['xs', 'List']]);
    const cases = buildCases(formula, env, 'xs');

    const consCase = cases[1];
    const a = consCase.argNames[0]; // Int arg
    const b = consCase.argNames[1]; // List arg (recursive)
    assert.equal(consCase.goal.to_string(),
        `len(cons(${a}, ${b})) + 1 = len(cons(${a}, ${b})) + 1`);
  });

  it('IH theorem replaces variable with recursive arg', function() {
    const formula = new AtomProp(ParseFormula('len(xs) + 1 = len(xs) + 1'));
    const env = new NestedEnv(new TopLevelEnv([listType], [lenFunc]), [['xs', 'List']]);
    const cases = buildCases(formula, env, 'xs');

    const consCase = cases[1];
    const b = consCase.ihArgNames[0]; // The List-typed arg
    assert.equal(consCase.ihTheorems[0].conclusion.to_string(),
        `len(${b}) + 1 = len(${b}) + 1`);
  });

  it('IH theorem is available via env.getTheorem', function() {
    const given = new AtomProp(ParseFormula('1 = 1'));
    const env = new NestedEnv(new TopLevelEnv([listType], [lenFunc]), [['xs', 'List']], [given]);
    const formula = new AtomProp(ParseFormula('len(xs) = len(xs)'));
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
    const formula = new AtomProp(ParseFormula('len(xs) = len(xs)'));
    const env = new NestedEnv(new TopLevelEnv([listType], [lenFunc]), [['xs', 'List']]);
    const cases = buildCases(formula, env, 'xs');

    const consCase = cases[1];
    for (const name of consCase.argNames) {
      assert.ok(consCase.env.hasVariable(name),
          `env should have variable "${name}"`);
    }
  });

  it('throws for non-named type variable', function() {
    const formula = new AtomProp(ParseFormula('n = n'));
    const env = new NestedEnv(new TopLevelEnv([], []), [['n', 'Int']]);
    assert.throws(() => buildCases(formula, env, 'n'),
        /cannot induct on built-in type/);
  });

  it('handles type with multiple recursive constructors', function() {
    const treeType = new TypeDeclAst('Tree', [
      new ConstructorAst('leaf', [], 'Tree'),
      new ConstructorAst('node', ['Tree', 'Int', 'Tree'], 'Tree'),
    ]);
    const formula = new AtomProp(ParseFormula('size(t) = size(t)'));
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
    const formula = new AtomProp(ParseFormula('len(xs) = len(xs)'));
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
    const treeFormula = new AtomProp(ParseFormula('size(t) = size(t)'));
    const treeEnv = new NestedEnv(
        new TopLevelEnv([treeType], [sizeFunc]), [['t', 'Tree']]);
    const treeCases = buildCases(treeFormula, treeEnv, 't');
    assert.equal(treeCases[1].ihTheorems[0].name, 'IH_T');
    assert.equal(treeCases[1].ihTheorems[1].name, 'IH_U');
  });

  it('renames IH to IH2 when IH already exists as a theorem', function() {
    const formula = new AtomProp(ParseFormula('len(xs) = len(xs)'));
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
    const formula = new AtomProp(ParseFormula('size(t) = size(t)'));
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
    const formula = new AtomProp(ParseFormula('len(concat(S, T)) = len(S) + len(T)'));
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
    const formula = new AtomProp(ParseFormula('len(xs) = 0'));
    const premise = new AtomProp(ParseFormula('xs = nil'));
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
    const formula = new AtomProp(ParseFormula('fst(p) = fst(p)'));
    const env = new NestedEnv(
        new TopLevelEnv([pairType], [fstFunc]), [['p', 'Pair']]);
    const cases = buildCases(formula, env, 'p');
    // mkpair has two Int params; they should get distinct lowercase names.
    assert.equal(cases[0].argNames.length, 2);
    assert.notEqual(cases[0].argNames[0], cases[0].argNames[1]);
  });

  it('renames IH to IH3 when IH and IH2 already exist', function() {
    const formula = new AtomProp(ParseFormula('len(xs) = len(xs)'));
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
    const formula = new AtomProp(ParseFormula('len(xs) = len(xs)'));
    const env = new NestedEnv(new TopLevelEnv([listType], [lenFunc]), [['xs', 'List']]);
    const cases = buildCases(formula, env, 'xs');

    const consCase = cases[1];
    assert.deepEqual(consCase.ihTheorems[0].premises, []);
  });

  it('works with NotProp goal', function() {
    const goal = new NotProp(ParseFormula('len(xs) = 0'));
    const env = new NestedEnv(new TopLevelEnv([listType], [lenFunc]), [['xs', 'List']]);
    const cases = buildCases(goal, env, 'xs');

    assert.equal(cases.length, 2);
    assert.equal(cases[0].goal.to_string(), 'not len(nil) = 0');
    assert.equal(cases[1].goal.to_string(), 'not len(cons(a, L)) = 0');
  });

  it('works with OrProp goal', function() {
    const goal = new OrProp([
      new AtomProp(ParseFormula('len(xs) = 0')),
      new AtomProp(ParseFormula('0 < len(xs)')),
    ]);
    const env = new NestedEnv(new TopLevelEnv([listType], [lenFunc]), [['xs', 'List']]);
    const cases = buildCases(goal, env, 'xs');

    assert.equal(cases.length, 2);
    assert.equal(cases[0].goal.to_string(), 'len(nil) = 0 or 0 < len(nil)');
    assert.equal(cases[1].goal.to_string(),
        'len(cons(a, L)) = 0 or 0 < len(cons(a, L))');
  });

});


describe('inductionParser', function() {

  const env = new NestedEnv(new TopLevelEnv([listType], [lenFunc]), [['xs', 'List']]);
  const formula = ParseFormula('len(xs) = len(xs)');

  it('parses "induction on xs"', function() {
    const result = inductionParser.tryParse('induction on xs', formula, env, []);
    assert.ok(result !== null && typeof result !== 'string');
    assert.strictEqual(result.kind, 'tactic');
  });

  it('parses "induction on xs (a, L)"', function() {
    const result = inductionParser.tryParse('induction on xs (a, L)', formula, env, []);
    assert.ok(result !== null && typeof result !== 'string');
    assert.strictEqual(result.kind, 'tactic');
  });

  it('returns error for unknown variable', function() {
    const result = inductionParser.tryParse('induction on zz', formula, env, []);
    assert.strictEqual(result, 'unknown variable "zz"');
  });

  it('returns error for built-in type', function() {
    const intEnv = new NestedEnv(new TopLevelEnv([listType], [lenFunc]), [['n', 'Int']]);
    const f = ParseFormula('n = n');
    const result = inductionParser.tryParse('induction on n', f, intEnv, []);
    assert.strictEqual(result, 'cannot do induction on built-in type "Int"');
  });

  it('returns null for non-induction text', function() {
    assert.strictEqual(inductionParser.tryParse('calculation', formula, env, []), null);
  });

  it('matches prefix of "induction"', function() {
    const matches = inductionParser.getMatches('ind', formula, env);
    assert.ok(matches.length > 0);
    assert.ok(matches[0].completion.startsWith('induction on'));
  });

  it('matches "induction on" with variable completions', function() {
    const matches = inductionParser.getMatches('induction on', formula, env);
    assert.ok(matches.length > 0);
    assert.ok(matches.some(m => m.completion === 'induction on xs'));
  });

  it('matches "induction on x" with partial variable', function() {
    const matches = inductionParser.getMatches('induction on x', formula, env);
    assert.ok(matches.length > 0);
    assert.ok(matches.some(m => m.completion === 'induction on xs'));
  });

  it('matches "induction on" with full keyword', function() {
    const matches = inductionParser.getMatches('induction on', formula, env);
    assert.ok(matches.length > 0);
    assert.ok(matches.some(m => m.completion === 'induction on xs'));
    assert.ok(matches.some(m => m.completion.includes('(')));
  });

  it('no matches past three words without parens', function() {
    const matches = inductionParser.getMatches('induction on xs extra', formula, env);
    assert.strictEqual(matches.length, 0);
  });

  it('matches with type that has no constructor args', function() {
    const boolType = new TypeDeclAst('Bool', [
      new ConstructorAst('true_val', [], 'Bool'),
      new ConstructorAst('false_val', [], 'Bool'),
    ]);
    const boolEnv = new NestedEnv(
        new TopLevelEnv([boolType], []), [['b', 'Bool']]);
    const f = ParseFormula('b = b');
    // prefix match
    const m1 = inductionParser.getMatches('ind', f, boolEnv);
    assert.ok(m1.length > 0);
    assert.ok(m1.every(m => !m.completion.includes('(')));
    // "induction o" match
    const m2 = inductionParser.getMatches('induction o', f, boolEnv);
    assert.ok(m2.length > 0);
    assert.ok(m2.every(m => !m.completion.includes('(')));
    // "induction on b" match
    const m3 = inductionParser.getMatches('induction on b', f, boolEnv);
    assert.ok(m3.length > 0);
    assert.ok(m3.every(m => !m.completion.includes('(')));
  });

  it('filters out variables not in env and built-in types', function() {
    // Formula references 'xs' (in env, List type), 'n' (Int, built-in), and 'y' (not in env)
    const f = ParseFormula('len(xs) + n + y = len(xs) + n + y');
    const mixedEnv = new NestedEnv(
        new TopLevelEnv([listType], [lenFunc]), [['xs', 'List'], ['n', 'Int']]);
    const matches = inductionParser.getMatches('ind', f, mixedEnv);
    // Should only show xs (inductive), not y (unknown) or n (built-in Int)
    assert.ok(matches.length > 0);
    assert.ok(matches.every(m => m.completion.includes('xs')));
  });

  it('no match for "induct o" (incomplete keyword)', function() {
    const matches = inductionParser.getMatches('induct o', formula, env);
    assert.strictEqual(matches.length, 0);
  });

  it('no match for "induction foo" where foo is not "on"', function() {
    const matches = inductionParser.getMatches('induction foo', formula, env);
    assert.strictEqual(matches.length, 0);
  });

  it('sorts multiple inductive variables', function() {
    const treeType = new TypeDeclAst('Tree', [
      new ConstructorAst('leaf', [], 'Tree'),
      new ConstructorAst('branch', ['Tree', 'Tree'], 'Tree'),
    ]);
    const multiEnv = new NestedEnv(
        new TopLevelEnv([listType, treeType], [lenFunc]),
        [['xs', 'List'], ['t', 'Tree']]);
    const f = ParseFormula('len(xs) + t = len(xs) + t');
    const matches = inductionParser.getMatches('ind', f, multiEnv);
    // Should have matches for both t and xs, sorted by name
    const completions = matches.map(m => m.completion);
    const tIdx = completions.findIndex(c => c.includes(' t'));
    const xsIdx = completions.findIndex(c => c.includes(' xs'));
    assert.ok(tIdx < xsIdx, 't should come before xs alphabetically');
  });

  it('no matches for unrelated text', function() {
    const matches = inductionParser.getMatches('cases', formula, env);
    assert.strictEqual(matches.length, 0);
  });

  it('matches empty text with induction suggestions', function() {
    const matches = inductionParser.getMatches('', formula, env);
    assert.ok(matches.length > 0);
    assert.ok(matches.every(m => m.completion.startsWith('induction on')));
    // Should include default args variant
    assert.ok(matches.some(m => m.completion.includes('(')));
  });

  it('matches "induction o" partial on', function() {
    const matches = inductionParser.getMatches('induction o', formula, env);
    assert.ok(matches.length > 0);
    assert.ok(matches.some(m => m.completion === 'induction on xs'));
    // Should include default args variant
    assert.ok(matches.some(m => m.completion.includes('(')));
  });

  it('matches "induction on xs" with exact variable', function() {
    const matches = inductionParser.getMatches('induction on xs', formula, env);
    assert.ok(matches.length > 0);
    assert.ok(matches.some(m => m.completion === 'induction on xs'));
    assert.ok(matches.some(m => m.completion.includes('(')));
  });
});
