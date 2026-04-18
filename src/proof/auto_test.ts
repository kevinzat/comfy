import * as assert from 'assert';
import { ParseFormula } from '../facts/formula_parser';
import { AtomProp, NotProp, ConstProp } from '../facts/prop';
import { Formula, OP_LESS_THAN } from '../facts/formula';
import { TopLevelEnv, NestedEnv } from '../types/env';
import { ParseProofMethod, FindProofMethodMatches, CreateProofTactic } from './proof_tactic';
import { AutoTactic } from './auto';
import { UserError } from '../facts/user_error';


function mkEnv(facts: Formula[] = []) {
  return new NestedEnv(
      new TopLevelEnv([], []),
      [['a', 'Int'], ['b', 'Int'], ['c', 'Int'], ['d', 'Int'], ['x', 'Int'], ['y', 'Int']],
      facts.map(f => new AtomProp(f)));
}


describe('auto: algebraic goals (no knowns)', function() {

  it('proves the trivial tautology a = a', function() {
    const env = mkEnv();
    const goal = new AtomProp(ParseFormula('a = a'));
    const tactic = new AutoTactic(env, goal, []);
    assert.deepStrictEqual(tactic.decompose(), []);
  });

  it('proves commutativity of addition', function() {
    const env = mkEnv();
    const goal = new AtomProp(ParseFormula('a + b = b + a'));
    const tactic = new AutoTactic(env, goal, []);
    assert.deepStrictEqual(tactic.decompose(), []);
  });

  it('proves additive identity a + 0 = a', function() {
    const env = mkEnv();
    const goal = new AtomProp(ParseFormula('a + 0 = a'));
    const tactic = new AutoTactic(env, goal, []);
    assert.deepStrictEqual(tactic.decompose(), []);
  });

  it('proves distributive expansion', function() {
    const env = mkEnv();
    const goal = new AtomProp(ParseFormula('2*(a + b) = 2*a + 2*b'));
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


describe('auto: algebra + congruence combined', function() {

  it('proves f(a + b) = f(c) given a + b = c', function() {
    const env = mkEnv([ParseFormula('a + b = c')]);
    const goal = new AtomProp(ParseFormula('f(a + b) = f(c)'));
    const tactic = new AutoTactic(env, goal, [1]);
    assert.deepStrictEqual(tactic.decompose(), []);
  });

  it('proves f(2*a) = f(a + a) with no knowns (algebra finds subterm equivalence)', function() {
    const env = mkEnv();
    const goal = new AtomProp(ParseFormula('f(2*a) = f(a + a)'));
    const tactic = new AutoTactic(env, goal, []);
    assert.deepStrictEqual(tactic.decompose(), []);
  });

  it('proves f(a) = f(b + c) given a = b + c', function() {
    const env = mkEnv([ParseFormula('a = b + c')]);
    const goal = new AtomProp(ParseFormula('f(a) = f(b + c)'));
    const tactic = new AutoTactic(env, goal, [1]);
    assert.deepStrictEqual(tactic.decompose(), []);
  });

});


describe('auto: textbook problems', function() {

  it('proves sec2 task1a: a = 2*b - 1 given a = 1, b = 2*a - 1', function() {
    const env = mkEnv([ParseFormula('a = 1'), ParseFormula('b = 2*a - 1')]);
    const goal = new AtomProp(ParseFormula('a = 2*b - 1'));
    const tactic = new AutoTactic(env, goal, [1, 2]);
    assert.deepStrictEqual(tactic.decompose(), []);
  });

  it('proves sec2 task1c: e = c + 8*d given d = b+1, c = a-8, e = a+8*b', function() {
    const env = mkEnv([
      ParseFormula('d = b + 1'),
      ParseFormula('c = a - 8'),
      ParseFormula('e = a + 8*b'),
    ]);
    const goal = new AtomProp(ParseFormula('e = c + 8*d'));
    const tactic = new AutoTactic(env, goal, [1, 2, 3]);
    assert.deepStrictEqual(tactic.decompose(), []);
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

  it('throws when the goal is not an equation (inequality)', function() {
    const env = mkEnv();
    const goal = new AtomProp(new Formula(
        ParseFormula('a = a').left, OP_LESS_THAN, ParseFormula('a = a').right));
    assert.throws(
        () => new AutoTactic(env, goal, []),
        (e: unknown) => e instanceof UserError && /equation/.test(e.message));
  });

  it('throws when the goal is not an atom', function() {
    const env = mkEnv();
    const goal = new NotProp(ParseFormula('a = b'));
    assert.throws(
        () => new AutoTactic(env, goal, []),
        (e: unknown) => e instanceof UserError && /equation/.test(e.message));
  });

  it('throws when the goal is a constant prop', function() {
    const env = mkEnv();
    assert.throws(
        () => new AutoTactic(env, new ConstProp(true), []),
        (e: unknown) => e instanceof UserError);
  });

  it('throws when a cited fact is not an equation', function() {
    const env = mkEnv([new Formula(
        ParseFormula('a = a').left, OP_LESS_THAN, ParseFormula('a = b').right)]);
    const goal = new AtomProp(ParseFormula('a = a'));
    assert.throws(
        () => new AutoTactic(env, goal, [1]),
        (e: unknown) => e instanceof UserError && /not an equation/.test(e.message));
  });

  it('throws when a cited fact is not an atomic prop', function() {
    const nestedEnv = new NestedEnv(
        new TopLevelEnv([], []),
        [['a', 'Int'], ['b', 'Int']],
        [new NotProp(ParseFormula('a = b'))]);
    const goal = new AtomProp(ParseFormula('a = a'));
    assert.throws(
        () => new AutoTactic(nestedEnv, goal, [1]),
        (e: unknown) => e instanceof UserError && /not an equation/.test(e.message));
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

  it('rejects "auto" when the goal is not an equation', function() {
    const ineqGoal = new AtomProp(new Formula(
        ParseFormula('a = a').left, OP_LESS_THAN, ParseFormula('a = a').right));
    const result = ParseProofMethod('auto', ineqGoal, env, []);
    assert.ok(typeof result === 'string');
    assert.ok(/equation/.test(result));
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
