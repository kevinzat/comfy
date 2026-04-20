import * as assert from 'assert';
import { ParseFormula } from '../facts/formula_parser';
import { AtomProp, NotProp, ConstProp, OrProp } from '../facts/prop';
import { Formula, OP_EQUAL, OP_LESS_THAN, OP_LESS_EQUAL } from '../facts/formula';
import { TopLevelEnv, NestedEnv } from '../types/env';
import { ParseProofMethod, FindProofMethodMatches, CreateProofTactic } from './proof_tactic';
import { AutoTactic } from './auto';
import { UserError } from '../facts/user_error';
import { TypeDeclAst, ConstructorAst } from '../lang/type_ast';
import {
  FuncAst, TypeAst, CaseAst, ExprBody, IfBranch, IfElseBody,
  ParamVar, ParamConstructor,
} from '../lang/func_ast';
import { Constant, Variable, Call } from '../facts/exprs';


function mkEnv(facts: Formula[] = []) {
  return new NestedEnv(
      new TopLevelEnv([], []),
      [['a', 'Int'], ['b', 'Int'], ['c', 'Int'], ['d', 'Int'], ['x', 'Int'], ['y', 'Int']],
      facts.map(f => new AtomProp(f)));
}


// List type with nil/cons and the suite of functions used by the defof tests.
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

const sumFunc = new FuncAst('sum', new TypeAst(['List'], 'Int'), [
  new CaseAst([new ParamVar('nil')], new ExprBody(Constant.of(0n))),
  new CaseAst(
      [new ParamConstructor('cons', [new ParamVar('x'), new ParamVar('L')])],
      new ExprBody(Call.add(Variable.of('x'), Call.of('sum', Variable.of('L'))))),
]);

const keepFunc = new FuncAst('keep', new TypeAst(['List'], 'List'), [
  new CaseAst([new ParamVar('nil')], new ExprBody(Variable.of('nil'))),
  new CaseAst(
      [new ParamConstructor('cons', [new ParamVar('x'), new ParamVar('L')])],
      new ExprBody(Call.of('cons', Variable.of('x'),
          Call.of('skip', Variable.of('L'))))),
]);

const skipFunc = new FuncAst('skip', new TypeAst(['List'], 'List'), [
  new CaseAst([new ParamVar('nil')], new ExprBody(Variable.of('nil'))),
  new CaseAst(
      [new ParamConstructor('cons', [new ParamVar('x'), new ParamVar('L')])],
      new ExprBody(Call.of('keep', Variable.of('L')))),
]);

const echoFunc = new FuncAst('echo', new TypeAst(['List'], 'List'), [
  new CaseAst([new ParamVar('nil')], new ExprBody(Variable.of('nil'))),
  new CaseAst(
      [new ParamConstructor('cons', [new ParamVar('x'), new ParamVar('L')])],
      new ExprBody(Call.of('cons', Variable.of('x'),
          Call.of('cons', Variable.of('x'),
              Call.of('echo', Variable.of('L')))))),
]);

// abs has conditional definitions (abs_1a if x<0, abs_1b if 0<=x).
const absFunc = new FuncAst('abs', new TypeAst(['Int'], 'Int'), [
  new CaseAst([new ParamVar('x')],
      new IfElseBody(
          [new IfBranch(
              [new AtomProp(
                  new Formula(Variable.of('x'), OP_LESS_THAN, Constant.of(0n)))],
              Call.negate(Variable.of('x')))],
          Variable.of('x'))),
]);

function mkListEnv(vars: [string, string][] = [], facts: Formula[] = []) {
  return new NestedEnv(
      new TopLevelEnv([listType],
          [lenFunc, sumFunc, keepFunc, skipFunc, echoFunc, absFunc]),
      vars,
      facts.map(f => new AtomProp(f)));
}


// --- Fixtures for hw2.prf ---

const natType = new TypeDeclAst('Nat', [
  new ConstructorAst('zero', [], 'Nat'),
  new ConstructorAst('succ', ['Nat'], 'Nat'),
]);

const addFunc = new FuncAst('add', new TypeAst(['Nat', 'Nat'], 'Nat'), [
  new CaseAst(
      [new ParamVar('zero'), new ParamVar('m')],
      new ExprBody(Variable.of('m'))),
  new CaseAst(
      [new ParamConstructor('succ', [new ParamVar('n')]), new ParamVar('m')],
      new ExprBody(Call.of('succ',
          Call.of('add', Variable.of('n'), Variable.of('m'))))),
]);

const headFunc = new FuncAst('head', new TypeAst(['List'], 'Int'), [
  new CaseAst(
      [new ParamConstructor('cons', [new ParamVar('x'), new ParamVar('L')])],
      new ExprBody(Variable.of('x'))),
]);

const tailFunc = new FuncAst('tail', new TypeAst(['List'], 'List'), [
  new CaseAst(
      [new ParamConstructor('cons', [new ParamVar('x'), new ParamVar('L')])],
      new ExprBody(Variable.of('L'))),
]);

const concatFunc = new FuncAst('concat', new TypeAst(['List', 'List'], 'List'), [
  new CaseAst(
      [new ParamVar('nil'), new ParamVar('R')],
      new ExprBody(Variable.of('R'))),
  new CaseAst(
      [new ParamConstructor('cons', [new ParamVar('x'), new ParamVar('L')]),
       new ParamVar('R')],
      new ExprBody(Call.of('cons', Variable.of('x'),
          Call.of('concat', Variable.of('L'), Variable.of('R'))))),
]);

const lenFuncHw2 = new FuncAst('len', new TypeAst(['List'], 'Int'), [
  new CaseAst([new ParamVar('nil')], new ExprBody(Constant.of(0n))),
  new CaseAst(
      [new ParamConstructor('cons', [new ParamVar('x'), new ParamVar('L')])],
      new ExprBody(Call.add(Constant.of(1n), Call.of('len', Variable.of('L'))))),
]);

const lastFunc = new FuncAst('last', new TypeAst(['List'], 'Int'), [
  new CaseAst(
      [new ParamConstructor('cons',
          [new ParamVar('x'), new ParamVar('nil')])],
      new ExprBody(Variable.of('x'))),
  new CaseAst(
      [new ParamConstructor('cons',
          [new ParamVar('x'),
           new ParamConstructor('cons',
               [new ParamVar('y'), new ParamVar('L')])])],
      new ExprBody(Call.of('last',
          Call.of('cons', Variable.of('y'), Variable.of('L'))))),
]);

const initFunc = new FuncAst('init', new TypeAst(['List'], 'List'), [
  new CaseAst(
      [new ParamConstructor('cons',
          [new ParamVar('x'), new ParamVar('nil')])],
      new ExprBody(Variable.of('nil'))),
  new CaseAst(
      [new ParamConstructor('cons',
          [new ParamVar('x'),
           new ParamConstructor('cons',
               [new ParamVar('y'), new ParamVar('L')])])],
      new ExprBody(Call.of('cons', Variable.of('x'),
          Call.of('init',
              Call.of('cons', Variable.of('y'), Variable.of('L')))))),
]);

const shiftLeftFunc = new FuncAst('shift_left',
    new TypeAst(['List'], 'List'), [
  new CaseAst([new ParamVar('nil')], new ExprBody(Variable.of('nil'))),
  new CaseAst(
      [new ParamConstructor('cons', [new ParamVar('x'), new ParamVar('L')])],
      new ExprBody(Call.of('concat', Variable.of('L'),
          Call.of('cons', Variable.of('x'), Variable.of('nil'))))),
]);

const shiftRightFunc = new FuncAst('shift_right',
    new TypeAst(['List'], 'List'), [
  new CaseAst([new ParamVar('nil')], new ExprBody(Variable.of('nil'))),
  new CaseAst(
      [new ParamConstructor('cons', [new ParamVar('x'), new ParamVar('L')])],
      new ExprBody(Call.of('cons',
          Call.of('last',
              Call.of('cons', Variable.of('x'), Variable.of('L'))),
          Call.of('init',
              Call.of('cons', Variable.of('x'), Variable.of('L')))))),
]);

function mkHw2Env(vars: [string, string][] = [], facts: Formula[] = []) {
  return new NestedEnv(
      new TopLevelEnv([listType, natType],
          [headFunc, tailFunc, concatFunc, lenFuncHw2, addFunc,
           shiftLeftFunc, shiftRightFunc, lastFunc, initFunc]),
      vars,
      facts.map(f => new AtomProp(f)));
}


function ineq(left: string, op: typeof OP_LESS_THAN | typeof OP_LESS_EQUAL,
              right: string): Formula {
  return new Formula(ParseFormula(`${left} = x`).left, op,
                     ParseFormula(`x = ${right}`).right);
}


describe('auto: reflexive equalities', function() {

  it('proves the trivial tautology a = a', function() {
    const env = mkEnv();
    const goal = new AtomProp(ParseFormula('a = a'));
    const tactic = new AutoTactic(env, goal, []);
    assert.deepStrictEqual(tactic.decompose(), []);
  });

});


describe('auto: congruence from cited equations', function() {

  it('proves f(a) = f(b) given a = b', function() {
    const env = mkEnv([ParseFormula('a = b')]);
    const goal = new AtomProp(ParseFormula('f(a) = f(b)'));
    const tactic = new AutoTactic(env, goal, [1]);
    assert.deepStrictEqual(tactic.decompose(), []);
  });

  it('proves g(f(a)) = g(f(b)) given a = b (multi-level congruence)', function() {
    const env = mkEnv([ParseFormula('a = b')]);
    const goal = new AtomProp(ParseFormula('g(f(a)) = g(f(b))'));
    const tactic = new AutoTactic(env, goal, [1]);
    assert.deepStrictEqual(tactic.decompose(), []);
  });

  it('proves f(a, c) = f(b, c) given a = b (partial argument change)', function() {
    const env = mkEnv([ParseFormula('a = b')]);
    const goal = new AtomProp(ParseFormula('f(a, c) = f(b, c)'));
    const tactic = new AutoTactic(env, goal, [1]);
    assert.deepStrictEqual(tactic.decompose(), []);
  });

  it('chains three cited equations: f(a) = f(d) given a = b, b = c, c = d', function() {
    const env = mkEnv([
      ParseFormula('a = b'),
      ParseFormula('b = c'),
      ParseFormula('c = d'),
    ]);
    const goal = new AtomProp(ParseFormula('f(a) = f(d)'));
    const tactic = new AutoTactic(env, goal, [1, 2, 3]);
    assert.deepStrictEqual(tactic.decompose(), []);
  });

});


describe('auto: congruence over compound subterms', function() {

  it('proves f(a + b) = f(c) given a + b = c', function() {
    const env = mkEnv([ParseFormula('a + b = c')]);
    const goal = new AtomProp(ParseFormula('f(a + b) = f(c)'));
    const tactic = new AutoTactic(env, goal, [1]);
    assert.deepStrictEqual(tactic.decompose(), []);
  });

  it('proves f(a) = f(b + c) given a = b + c', function() {
    const env = mkEnv([ParseFormula('a = b + c')]);
    const goal = new AtomProp(ParseFormula('f(a) = f(b + c)'));
    const tactic = new AutoTactic(env, goal, [1]);
    assert.deepStrictEqual(tactic.decompose(), []);
  });

  it('proves f(c) = 10 given f(a+b) = 10, a+b = c', function() {
    const env = mkEnv([ParseFormula('f(a + b) = 10'), ParseFormula('a + b = c')]);
    const goal = new AtomProp(ParseFormula('f(c) = 10'));
    const tactic = new AutoTactic(env, goal, [1, 2]);
    assert.deepStrictEqual(tactic.decompose(), []);
  });

});


describe('auto: inequality goals and knowns', function() {

  it('proves a < b given a = 0 and b = 1', function() {
    const env = mkEnv([ParseFormula('a = 0'), ParseFormula('b = 1')]);
    const goal = new AtomProp(ineq('a', OP_LESS_THAN, 'b'));
    const tactic = new AutoTactic(env, goal, [1, 2]);
    assert.deepStrictEqual(tactic.decompose(), []);
  });

  it('proves a <= b from inequality knowns: a <= c and c <= b', function() {
    const env = new NestedEnv(
        new TopLevelEnv([], []),
        [['a', 'Int'], ['b', 'Int'], ['c', 'Int']],
        [new AtomProp(ineq('a', OP_LESS_EQUAL, 'c')),
         new AtomProp(ineq('c', OP_LESS_EQUAL, 'b'))]);
    const goal = new AtomProp(ineq('a', OP_LESS_EQUAL, 'b'));
    const tactic = new AutoTactic(env, goal, [1, 2]);
    assert.deepStrictEqual(tactic.decompose(), []);
  });

  it('proves a < c from strict inequality chain: a < b and b < c', function() {
    const env = new NestedEnv(
        new TopLevelEnv([], []),
        [['a', 'Int'], ['b', 'Int'], ['c', 'Int']],
        [new AtomProp(ineq('a', OP_LESS_THAN, 'b')),
         new AtomProp(ineq('b', OP_LESS_THAN, 'c'))]);
    const goal = new AtomProp(ineq('a', OP_LESS_THAN, 'c'));
    const tactic = new AutoTactic(env, goal, [1, 2]);
    assert.deepStrictEqual(tactic.decompose(), []);
  });

  it('fails when the inequality goal is not derivable', function() {
    const env = mkEnv([ParseFormula('a = 1'), ParseFormula('b = 1')]);
    const goal = new AtomProp(ineq('a', OP_LESS_THAN, 'b'));
    assert.throws(
        () => new AutoTactic(env, goal, [1, 2]).decompose(),
        (e: unknown) => e instanceof UserError);
  });

});


describe('auto: failure cases', function() {

  it('throws when the equation is not provable', function() {
    const env = mkEnv();
    const goal = new AtomProp(ParseFormula('a = b'));
    assert.throws(
        () => new AutoTactic(env, goal, []).decompose(),
        (e: unknown) => e instanceof UserError && /could not prove/.test(e.message));
  });

  it('throws when knowns are insufficient', function() {
    const env = mkEnv([ParseFormula('a = b')]);
    const goal = new AtomProp(ParseFormula('c = d'));
    assert.throws(
        () => new AutoTactic(env, goal, [1]).decompose(),
        (e: unknown) => e instanceof UserError);
  });

  it('throws when the goal is not an atom', function() {
    const env = mkEnv();
    const goal = new NotProp(ParseFormula('a = b'));
    assert.throws(
        () => new AutoTactic(env, goal, []),
        (e: unknown) => e instanceof UserError);
  });

  it('throws when the goal is a constant prop', function() {
    const env = mkEnv();
    assert.throws(
        () => new AutoTactic(env, new ConstProp(true), []),
        (e: unknown) => e instanceof UserError);
  });

  it('throws when a cited fact is not an atomic prop', function() {
    const nestedEnv = new NestedEnv(
        new TopLevelEnv([], []),
        [['a', 'Int'], ['b', 'Int']],
        [new NotProp(ParseFormula('a = b'))]);
    const goal = new AtomProp(ParseFormula('a = a'));
    assert.throws(
        () => new AutoTactic(nestedEnv, goal, [1]),
        (e: unknown) => e instanceof UserError);
  });

  it('throws when the fact index is out of range', function() {
    const env = mkEnv();
    const goal = new AtomProp(ParseFormula('a = a'));
    assert.throws(
        () => new AutoTactic(env, goal, [99]),
        (e: unknown) => e instanceof UserError);
  });

});


describe('auto: ParseProofMethod integration', function() {

  const env = mkEnv();
  const goal = new AtomProp(ParseFormula('a = a'));

  it('parses bare "auto"', function() {
    const result = ParseProofMethod('auto', goal, env, []);
    assert.ok(typeof result !== 'string' && result.kind === 'tactic');
  });

  it('parses "auto 1 2 3" with cited facts', function() {
    const envWithFacts = mkEnv([ParseFormula('a = b'), ParseFormula('b = c'), ParseFormula('c = d')]);
    const g = new AtomProp(ParseFormula('a = d'));
    const result = ParseProofMethod('auto 1 2 3', g, envWithFacts, []);
    assert.ok(typeof result !== 'string' && result.kind === 'tactic');
  });

  it('accepts "auto" with an inequality goal', function() {
    const ineqGoal = new AtomProp(new Formula(
        ParseFormula('a + 1 = a + 1').left, OP_LESS_EQUAL,
        ParseFormula('a + 1 = a + 1').right));
    const result = ParseProofMethod('auto', ineqGoal, env, []);
    assert.ok(typeof result !== 'string' && result.kind === 'tactic');
  });

  it('rejects "auto" when the goal is not an atom', function() {
    const notGoal = new NotProp(ParseFormula('a = b'));
    const result = ParseProofMethod('auto', notGoal, env, []);
    assert.ok(typeof result === 'string');
    assert.ok(/equation or inequality/.test(result));
  });

  it('returns the UserError message when a cited fact is out of range', function() {
    const result = ParseProofMethod('auto 99', goal, env, []);
    assert.ok(typeof result === 'string');
    assert.ok(/out of range/.test(result));
  });

  it('returns null for non-auto text', function() {
    const result = ParseProofMethod('blah', goal, env, []);
    assert.ok(typeof result === 'string');  // falls through parser list
  });

  it('creates an AutoTactic via CreateProofTactic', function() {
    const node = {
      kind: 'tactic' as const,
      method: 'auto',
      methodLine: 0,
      cases: [],
    };
    const tactic = CreateProofTactic(node, goal, env, []);
    assert.ok(tactic instanceof AutoTactic);
  });

});


describe('auto: defof-based equality proofs', function() {

  it('proves len(nil) = 0 by unfolding len_1', function() {
    const env = mkListEnv();
    const goal = new AtomProp(ParseFormula('len(nil) = 0'));
    const tactic = new AutoTactic(env, goal, []);
    assert.deepStrictEqual(tactic.decompose(), []);
  });

  it('proves 0 = len(nil) by unfolding len_1 on the RHS', function() {
    const env = mkListEnv();
    const goal = new AtomProp(ParseFormula('0 = len(nil)'));
    const tactic = new AutoTactic(env, goal, []);
    assert.deepStrictEqual(tactic.decompose(), []);
  });

  it('proves len(cons(a, nil)) = 1 + 0 by chained defof', function() {
    const env = mkListEnv([['a', 'Int']]);
    const goal = new AtomProp(ParseFormula('len(cons(a, nil)) = 1 + 0'));
    const tactic = new AutoTactic(env, goal, []);
    assert.deepStrictEqual(tactic.decompose(), []);
  });

  it('proves sum(skip(echo(nil))) = sum(nil) (task3 base case)', function() {
    const env = mkListEnv();
    const goal = new AtomProp(ParseFormula('sum(skip(echo(nil))) = sum(nil)'));
    const tactic = new AutoTactic(env, goal, []);
    assert.deepStrictEqual(tactic.decompose(), []);
  });

  it('proves task3 inductive step using IH as an equation known', function() {
    // IH: sum(skip(echo(M))) = sum(M).
    // Goal: sum(skip(echo(cons(a, M)))) = sum(cons(a, M)).
    // LHS defof-unfolds through echo_2, skip_2, keep_2, sum_2 to a + sum(skip(echo(M))).
    // RHS defof-unfolds through sum_2 to a + sum(M).
    // The IH union makes sum(skip(echo(M))) ~ sum(M), closing congruence.
    const env = mkListEnv(
        [['a', 'Int'], ['M', 'List']],
        [ParseFormula('sum(skip(echo(M))) = sum(M)')]);
    const goal = new AtomProp(
        ParseFormula('sum(skip(echo(cons(a, M)))) = sum(cons(a, M))'));
    const tactic = new AutoTactic(env, goal, [1]);
    assert.deepStrictEqual(tactic.decompose(), []);
  });

  it('still supports pure congruence (no defs needed)', function() {
    const env = mkListEnv([['P', 'List'], ['Q', 'List']],
        [ParseFormula('P = Q')]);
    const goal = new AtomProp(ParseFormula('len(P) = len(Q)'));
    const tactic = new AutoTactic(env, goal, [1]);
    assert.deepStrictEqual(tactic.decompose(), []);
  });

  it('fails on an equality that only defof cannot prove (needs algebra)', function() {
    const env = mkListEnv([['a', 'Int'], ['L', 'List']]);
    // len(cons(a, L)) defof-unfolds to 1 + len(L); without algebra this is not 0.
    const goal = new AtomProp(ParseFormula('len(cons(a, L)) = 0'));
    assert.throws(
        () => new AutoTactic(env, goal, []).decompose(),
        (e: unknown) => e instanceof UserError && /could not prove/.test(e.message));
  });

  it('skips conditional defs: abs goals are unprovable for now', function() {
    // abs has conditional defs (abs_1a if x<0, abs_1b if 0<=x). This version
    // of auto skips all defs with conditions, so nothing unfolds.
    const env = mkListEnv([['z', 'Int']]);
    const goal = new AtomProp(ParseFormula('abs(abs(z)) = abs(z)'));
    assert.throws(
        () => new AutoTactic(env, goal, []).decompose(),
        (e: unknown) => e instanceof UserError && /could not prove/.test(e.message));
  });

});


describe('auto: autocompletion', function() {

  const env = mkEnv();
  const formula = ParseFormula('a = a');

  it('autocompletes "au" to "auto"', function() {
    const matches = FindProofMethodMatches('au', formula, env);
    assert.ok(matches.some(m => m.completion === 'auto'));
  });

  it('autocompletes "aut" to "auto"', function() {
    const matches = FindProofMethodMatches('aut', formula, env);
    assert.ok(matches.some(m => m.completion === 'auto'));
  });

  it('offers "auto" as-is when the text already starts with "auto "', function() {
    const matches = FindProofMethodMatches('auto 1', formula, env);
    assert.ok(matches.some(m => m.completion === 'auto 1'));
  });

  it('offers no auto matches for unrelated text', function() {
    const matches = FindProofMethodMatches('blah', formula, env);
    assert.ok(!matches.some(m => m.completion.startsWith('auto')));
  });

});


// One test per calculation block in src/proof/proofs/sec2.prf. Each asserts
// that `auto` with the same knowns available at the start of the block can
// discharge the block's goal. Tests currently expected to fail (algebra or
// conditional defs required) are noted in comments.

describe('auto: sec2.prf calculation blocks', function() {

  it('task1a: a = 2*b - 1 given a = 1, b = 2*a - 1', function() {
    const env = mkListEnv([['a', 'Int'], ['b', 'Int']],
        [ParseFormula('a = 1'), ParseFormula('b = 2*a - 1')]);
    const goal = new AtomProp(ParseFormula('a = 2*b - 1'));
    const tactic = new AutoTactic(env, goal, [1, 2]);
    assert.deepStrictEqual(tactic.decompose(), []);
  });

  it('task1b inner1: b = 1 given a = 1, b = 2*a - 1, 0 < c', function() {
    const env = mkListEnv([['a', 'Int'], ['b', 'Int'], ['c', 'Int']],
        [ParseFormula('a = 1'), ParseFormula('b = 2*a - 1'),
         ineq('0', OP_LESS_THAN, 'c')]);
    const goal = new AtomProp(ParseFormula('b = 1'));
    const tactic = new AutoTactic(env, goal, [1, 2, 3]);
    assert.deepStrictEqual(tactic.decompose(), []);
  });

  it('task1b inner2: (b - 1)^2 < c given a = 1, b = 2*a - 1, 0 < c, b = 1',
      function() {
    const env = mkListEnv([['a', 'Int'], ['b', 'Int'], ['c', 'Int']],
        [ParseFormula('a = 1'), ParseFormula('b = 2*a - 1'),
         ineq('0', OP_LESS_THAN, 'c'), ParseFormula('b = 1')]);
    const goal = new AtomProp(ineq('(b - 1)^2', OP_LESS_THAN, 'c'));
    const tactic = new AutoTactic(env, goal, [1, 2, 3, 4]);
    assert.deepStrictEqual(tactic.decompose(), []);
  });

  it('task1c: e = c + 8*d given d = b + 1, c = a - 8, e = a + 8*b', function() {
    const env = mkListEnv(
        [['a', 'Int'], ['b', 'Int'], ['c', 'Int'], ['d', 'Int'], ['e', 'Int']],
        [ParseFormula('d = b + 1'), ParseFormula('c = a - 8'),
         ParseFormula('e = a + 8*b')]);
    const goal = new AtomProp(ParseFormula('e = c + 8*d'));
    const tactic = new AutoTactic(env, goal, [1, 2, 3]);
    assert.deepStrictEqual(tactic.decompose(), []);
  });

  it('task1d: (a + 1)^2 < c given b = 2*a - 1, d = a^2, d + b + 2 < c',
      function() {
    const env = mkListEnv(
        [['a', 'Int'], ['b', 'Int'], ['c', 'Int'], ['d', 'Int']],
        [ParseFormula('b = 2*a - 1'), ParseFormula('d = a^2'),
         ineq('d + b + 2', OP_LESS_THAN, 'c')]);
    const goal = new AtomProp(ineq('(a + 1)^2', OP_LESS_THAN, 'c'));
    const tactic = new AutoTactic(env, goal, [1, 2, 3]);
    assert.deepStrictEqual(tactic.decompose(), []);
  });

  it('task2 case x < 0: abs(abs(x)) = abs(x) given x < 0', function() {
    const env = mkListEnv([['x', 'Int']], [ineq('x', OP_LESS_THAN, '0')]);
    const goal = new AtomProp(ParseFormula('abs(abs(x)) = abs(x)'));
    const tactic = new AutoTactic(env, goal, [1]);
    assert.deepStrictEqual(tactic.decompose(), []);
  });

  it('task2 case 0 <= x inner1: abs(x) = x given 0 <= x', function() {
    const env = mkListEnv([['x', 'Int']], [ineq('0', OP_LESS_EQUAL, 'x')]);
    const goal = new AtomProp(ParseFormula('abs(x) = x'));
    const tactic = new AutoTactic(env, goal, [1]);
    assert.deepStrictEqual(tactic.decompose(), []);
  });

  it('task2 case 0 <= x inner2: abs(abs(x)) = abs(x) given 0 <= x, abs(x) = x',
      function() {
    const env = mkListEnv([['x', 'Int']],
        [ineq('0', OP_LESS_EQUAL, 'x'), ParseFormula('abs(x) = x')]);
    const goal = new AtomProp(ParseFormula('abs(abs(x)) = abs(x)'));
    const tactic = new AutoTactic(env, goal, [1, 2]);
    assert.deepStrictEqual(tactic.decompose(), []);
  });

  it('task3 case nil: sum(skip(echo(nil))) = sum(nil)', function() {
    const env = mkListEnv();
    const goal = new AtomProp(ParseFormula('sum(skip(echo(nil))) = sum(nil)'));
    const tactic = new AutoTactic(env, goal, []);
    assert.deepStrictEqual(tactic.decompose(), []);
  });

  it('task3 case cons(a, M): sum(skip(echo(cons(a, M)))) = sum(cons(a, M)) ' +
      'given IH', function() {
    const env = mkListEnv([['a', 'Int'], ['M', 'List']],
        [ParseFormula('sum(skip(echo(M))) = sum(M)')]);
    const goal = new AtomProp(
        ParseFormula('sum(skip(echo(cons(a, M)))) = sum(cons(a, M))'));
    const tactic = new AutoTactic(env, goal, [1]);
    assert.deepStrictEqual(tactic.decompose(), []);
  });

});


// One test per calculation block in src/proof/proofs/hw2.prf.

describe('auto: hw2.prf calculation blocks', function() {

  it('task1a: head(concat(nil, cons(x, nil))) = x', function() {
    const env = mkHw2Env([['x', 'Int']]);
    const goal = new AtomProp(
        ParseFormula('head(concat(nil, cons(x, nil))) = x'));
    const tactic = new AutoTactic(env, goal, []);
    assert.deepStrictEqual(tactic.decompose(), []);
  });

  it('task1b: tail(concat(nil, cons(x, nil))) = nil', function() {
    const env = mkHw2Env([['x', 'Int']]);
    const goal = new AtomProp(
        ParseFormula('tail(concat(nil, cons(x, nil))) = nil'));
    const tactic = new AutoTactic(env, goal, []);
    assert.deepStrictEqual(tactic.decompose(), []);
  });

  it('task1c: head(concat(cons(y, L), cons(x, nil))) = y', function() {
    const env = mkHw2Env([['x', 'Int'], ['y', 'Int'], ['L', 'List']]);
    const goal = new AtomProp(
        ParseFormula('head(concat(cons(y, L), cons(x, nil))) = y'));
    const tactic = new AutoTactic(env, goal, []);
    assert.deepStrictEqual(tactic.decompose(), []);
  });

  it('task1d: tail(concat(cons(y, L), cons(x, nil))) = concat(L, cons(x, nil))',
      function() {
    const env = mkHw2Env([['x', 'Int'], ['y', 'Int'], ['L', 'List']]);
    const goal = new AtomProp(ParseFormula(
        'tail(concat(cons(y, L), cons(x, nil))) = concat(L, cons(x, nil))'));
    const tactic = new AutoTactic(env, goal, []);
    assert.deepStrictEqual(tactic.decompose(), []);
  });

  it('task1e: len(tail(concat(cons(x, cons(y, nil)), L))) = 1 + len(L)',
      function() {
    const env = mkHw2Env([['x', 'Int'], ['y', 'Int'], ['L', 'List']]);
    const goal = new AtomProp(ParseFormula(
        'len(tail(concat(cons(x, cons(y, nil)), L))) = 1 + len(L)'));
    const tactic = new AutoTactic(env, goal, []);
    assert.deepStrictEqual(tactic.decompose(), []);
  });

  it('task2 case nil: concat(nil, cons(x, nil)) = cons(x, nil)', function() {
    const env = mkHw2Env([['x', 'Int']]);
    const goal = new AtomProp(
        ParseFormula('concat(nil, cons(x, nil)) = cons(x, nil)'));
    const tactic = new AutoTactic(env, goal, []);
    assert.deepStrictEqual(tactic.decompose(), []);
  });

  it('task2 case cons(a, M): concat(cons(a, M), cons(x, nil)) = ' +
      'cons(a, concat(M, cons(x, nil)))', function() {
    const env = mkHw2Env([['x', 'Int'], ['a', 'Int'], ['M', 'List']]);
    const goal = new AtomProp(ParseFormula(
        'concat(cons(a, M), cons(x, nil)) = ' +
        'cons(a, concat(M, cons(x, nil)))'));
    const tactic = new AutoTactic(env, goal, []);
    assert.deepStrictEqual(tactic.decompose(), []);
  });

  it('task3 case zero: add(succ(zero), m) = add(zero, succ(m))', function() {
    const env = mkHw2Env([['m', 'Nat']]);
    const goal = new AtomProp(
        ParseFormula('add(succ(zero), m) = add(zero, succ(m))'));
    const tactic = new AutoTactic(env, goal, []);
    assert.deepStrictEqual(tactic.decompose(), []);
  });

  it('task3 case succ(N): add(succ(succ(N)), m) = add(succ(N), succ(m)) ' +
      'given IH', function() {
    const env = mkHw2Env([['N', 'Nat'], ['m', 'Nat']],
        [ParseFormula('add(succ(N), m) = add(N, succ(m))')]);
    const goal = new AtomProp(
        ParseFormula('add(succ(succ(N)), m) = add(succ(N), succ(m))'));
    const tactic = new AutoTactic(env, goal, [1]);
    assert.deepStrictEqual(tactic.decompose(), []);
  });

  it('task4a case zero: add(zero, zero) = zero', function() {
    const env = mkHw2Env();
    const goal = new AtomProp(ParseFormula('add(zero, zero) = zero'));
    const tactic = new AutoTactic(env, goal, []);
    assert.deepStrictEqual(tactic.decompose(), []);
  });

  it('task4a case succ(N): add(succ(N), zero) = succ(N) given IH', function() {
    const env = mkHw2Env([['N', 'Nat']],
        [ParseFormula('add(N, zero) = N')]);
    const goal = new AtomProp(ParseFormula('add(succ(N), zero) = succ(N)'));
    const tactic = new AutoTactic(env, goal, [1]);
    assert.deepStrictEqual(tactic.decompose(), []);
  });

  it('task4b case zero: add(zero, m) = add(m, zero) given task4a', function() {
    const env = mkHw2Env([['m', 'Nat']],
        [ParseFormula('add(m, zero) = m')]);
    const goal = new AtomProp(ParseFormula('add(zero, m) = add(m, zero)'));
    const tactic = new AutoTactic(env, goal, [1]);
    assert.deepStrictEqual(tactic.decompose(), []);
  });

  it('task4b case succ(N): add(succ(N), m) = add(m, succ(N)) ' +
      'given IH and task3', function() {
    const env = mkHw2Env([['N', 'Nat'], ['m', 'Nat']],
        [ParseFormula('add(N, m) = add(m, N)'),
         ParseFormula('add(succ(m), N) = add(m, succ(N))')]);
    const goal = new AtomProp(
        ParseFormula('add(succ(N), m) = add(m, succ(N))'));
    const tactic = new AutoTactic(env, goal, [1, 2]);
    assert.deepStrictEqual(tactic.decompose(), []);
  });

  it('task5ahelper case nil: last(cons(x, concat(nil, cons(y, nil)))) = ' +
      'last(concat(nil, cons(y, nil)))', function() {
    const env = mkHw2Env([['x', 'Int'], ['y', 'Int']]);
    const goal = new AtomProp(ParseFormula(
        'last(cons(x, concat(nil, cons(y, nil)))) = ' +
        'last(concat(nil, cons(y, nil)))'));
    const tactic = new AutoTactic(env, goal, []);
    assert.deepStrictEqual(tactic.decompose(), []);
  });

  it('task5ahelper case cons(a, M): last(cons(x, concat(cons(a, M), ' +
      'cons(y, nil)))) = last(concat(cons(a, M), cons(y, nil)))', function() {
    const env = mkHw2Env(
        [['x', 'Int'], ['y', 'Int'], ['a', 'Int'], ['M', 'List']]);
    const goal = new AtomProp(ParseFormula(
        'last(cons(x, concat(cons(a, M), cons(y, nil)))) = ' +
        'last(concat(cons(a, M), cons(y, nil)))'));
    const tactic = new AutoTactic(env, goal, []);
    assert.deepStrictEqual(tactic.decompose(), []);
  });

  it('task5bhelper case nil: init(cons(x, concat(nil, cons(y, nil)))) = ' +
      'cons(x, init(concat(nil, cons(y, nil))))', function() {
    const env = mkHw2Env([['x', 'Int'], ['y', 'Int']]);
    const goal = new AtomProp(ParseFormula(
        'init(cons(x, concat(nil, cons(y, nil)))) = ' +
        'cons(x, init(concat(nil, cons(y, nil))))'));
    const tactic = new AutoTactic(env, goal, []);
    assert.deepStrictEqual(tactic.decompose(), []);
  });

  it('task5bhelper case cons(a, M): init(cons(x, concat(cons(a, M), ' +
      'cons(y, nil)))) = cons(x, init(concat(cons(a, M), cons(y, nil))))',
      function() {
    const env = mkHw2Env(
        [['x', 'Int'], ['y', 'Int'], ['a', 'Int'], ['M', 'List']]);
    const goal = new AtomProp(ParseFormula(
        'init(cons(x, concat(cons(a, M), cons(y, nil)))) = ' +
        'cons(x, init(concat(cons(a, M), cons(y, nil))))'));
    const tactic = new AutoTactic(env, goal, []);
    assert.deepStrictEqual(tactic.decompose(), []);
  });

  it('task5a case nil: last(concat(nil, cons(x, nil))) = x', function() {
    const env = mkHw2Env([['x', 'Int']]);
    const goal = new AtomProp(
        ParseFormula('last(concat(nil, cons(x, nil))) = x'));
    const tactic = new AutoTactic(env, goal, []);
    assert.deepStrictEqual(tactic.decompose(), []);
  });

  it('task5a case cons(a, M): last(concat(cons(a, M), cons(x, nil))) = x ' +
      'given IH and task5ahelper', function() {
    const env = mkHw2Env([['x', 'Int'], ['a', 'Int'], ['M', 'List']],
        [ParseFormula('last(concat(M, cons(x, nil))) = x'),
         ParseFormula(
             'last(cons(a, concat(M, cons(x, nil)))) = ' +
             'last(concat(M, cons(x, nil)))')]);
    const goal = new AtomProp(
        ParseFormula('last(concat(cons(a, M), cons(x, nil))) = x'));
    const tactic = new AutoTactic(env, goal, [1, 2]);
    assert.deepStrictEqual(tactic.decompose(), []);
  });

  it('task5b case nil: init(concat(nil, cons(x, nil))) = nil', function() {
    const env = mkHw2Env([['x', 'Int']]);
    const goal = new AtomProp(
        ParseFormula('init(concat(nil, cons(x, nil))) = nil'));
    const tactic = new AutoTactic(env, goal, []);
    assert.deepStrictEqual(tactic.decompose(), []);
  });

  it('task5b case cons(a, M): init(concat(cons(a, M), cons(x, nil))) = ' +
      'cons(a, M) given IH and task5bhelper', function() {
    const env = mkHw2Env([['x', 'Int'], ['a', 'Int'], ['M', 'List']],
        [ParseFormula('init(concat(M, cons(x, nil))) = M'),
         ParseFormula(
             'init(cons(a, concat(M, cons(x, nil)))) = ' +
             'cons(a, init(concat(M, cons(x, nil))))')]);
    const goal = new AtomProp(ParseFormula(
        'init(concat(cons(a, M), cons(x, nil))) = cons(a, M)'));
    const tactic = new AutoTactic(env, goal, [1, 2]);
    assert.deepStrictEqual(tactic.decompose(), []);
  });

  it('task5chelper case nil: shift_right(concat(nil, cons(x, nil))) = ' +
      'cons(last(concat(nil, cons(x, nil))), init(concat(nil, cons(x, nil))))',
      function() {
    const env = mkHw2Env([['x', 'Int']]);
    const goal = new AtomProp(ParseFormula(
        'shift_right(concat(nil, cons(x, nil))) = ' +
        'cons(last(concat(nil, cons(x, nil))), ' +
        'init(concat(nil, cons(x, nil))))'));
    const tactic = new AutoTactic(env, goal, []);
    assert.deepStrictEqual(tactic.decompose(), []);
  });

  it('task5chelper case cons(a, M): shift_right(concat(cons(a, M), ' +
      'cons(x, nil))) = cons(last(concat(cons(a, M), cons(x, nil))), ' +
      'init(concat(cons(a, M), cons(x, nil))))', function() {
    const env = mkHw2Env([['x', 'Int'], ['a', 'Int'], ['M', 'List']]);
    const goal = new AtomProp(ParseFormula(
        'shift_right(concat(cons(a, M), cons(x, nil))) = ' +
        'cons(last(concat(cons(a, M), cons(x, nil))), ' +
        'init(concat(cons(a, M), cons(x, nil))))'));
    const tactic = new AutoTactic(env, goal, []);
    assert.deepStrictEqual(tactic.decompose(), []);
  });

  it('task5c case nil: shift_right(shift_left(nil)) = nil', function() {
    const env = mkHw2Env();
    const goal = new AtomProp(
        ParseFormula('shift_right(shift_left(nil)) = nil'));
    const tactic = new AutoTactic(env, goal, []);
    assert.deepStrictEqual(tactic.decompose(), []);
  });

  it('task5c case cons(a, M): shift_right(shift_left(cons(a, M))) = ' +
      'cons(a, M) given IH, task5chelper, task5a, task5b', function() {
    const env = mkHw2Env([['a', 'Int'], ['M', 'List']],
        [ParseFormula('shift_right(shift_left(M)) = M'),
         ParseFormula(
             'shift_right(concat(M, cons(a, nil))) = ' +
             'cons(last(concat(M, cons(a, nil))), ' +
             'init(concat(M, cons(a, nil))))'),
         ParseFormula('last(concat(M, cons(a, nil))) = a'),
         ParseFormula('init(concat(M, cons(a, nil))) = M')]);
    const goal = new AtomProp(
        ParseFormula('shift_right(shift_left(cons(a, M))) = cons(a, M)'));
    const tactic = new AutoTactic(env, goal, [1, 2, 3, 4]);
    assert.deepStrictEqual(tactic.decompose(), []);
  });

});


describe('auto: function definitions with unsupported conditions', function() {

  // `f(x) = if x = 0 then 0 else x`. The else branch carries condition
  // NOT(x = 0); compileDefs compiles it as a `neq` condition and
  // conditionsHold discharges it via the two strict-inequality directions.
  const fFunc = new FuncAst('f', new TypeAst(['Int'], 'Int'), [
    new CaseAst([new ParamVar('x')],
        new IfElseBody(
            [new IfBranch(
                [new AtomProp(
                    new Formula(Variable.of('x'), OP_EQUAL, Constant.of(0n)))],
                Constant.of(0n))],
            Variable.of('x'))),
  ]);

  it('takes the equality branch when the condition is known', function() {
    const env = new NestedEnv(
        new TopLevelEnv([], [fFunc]),
        [],
        []);
    const goal = new AtomProp(ParseFormula('f(0) = 0'));
    const tactic = new AutoTactic(env, goal, []);
    assert.deepStrictEqual(tactic.decompose(), []);
  });

  it('takes the else branch when the negated equality is known', function() {
    // With no premises the decision procedure still discharges `0 < 5`, so
    // the `/=` condition on the else branch holds and `f(5) = 5` is proved.
    const env = new NestedEnv(
        new TopLevelEnv([], [fFunc]),
        [],
        []);
    const goal = new AtomProp(ParseFormula('f(5) = 5'));
    const tactic = new AutoTactic(env, goal, []);
    assert.deepStrictEqual(tactic.decompose(), []);
  });

  it('takes the else branch using a known strict inequality', function() {
    const env = new NestedEnv(
        new TopLevelEnv([], [fFunc]),
        [['y', 'Int']],
        [new AtomProp(
            new Formula(Constant.of(0n), OP_LESS_THAN, Variable.of('y')))]);
    const goal = new AtomProp(ParseFormula('f(y) = y'));
    const tactic = new AutoTactic(env, goal, [1]);
    assert.deepStrictEqual(tactic.decompose(), []);
  });

  it('skips defs whose condition shape compileDefs does not support',
      function() {
    // `g(x) = if x = 0 or x = 1 then 7 else x`. The first branch's
    // condition is an OrProp — neither AtomProp nor NotProp-of-equality —
    // so compileDefs must drop that def. The else branch survives (two
    // /= conditions) but can't discharge its guard when `x = 0`, so
    // `g(0) = 7` has no applicable def and auto must fail.
    const gFunc = new FuncAst('g', new TypeAst(['Int'], 'Int'), [
      new CaseAst([new ParamVar('x')],
          new IfElseBody(
              [new IfBranch(
                  [new OrProp([
                    new AtomProp(
                        new Formula(Variable.of('x'), OP_EQUAL, Constant.of(0n))),
                    new AtomProp(
                        new Formula(Variable.of('x'), OP_EQUAL, Constant.of(1n))),
                  ])],
                  Constant.of(7n))],
              Variable.of('x'))),
    ]);
    const env = new NestedEnv(
        new TopLevelEnv([], [gFunc]),
        [],
        []);
    const goal = new AtomProp(ParseFormula('g(0) = 7'));
    const tactic = new AutoTactic(env, goal, []);
    assert.throws(() => tactic.decompose(), UserError);
  });

});
