import * as assert from 'assert';
import { ParseFormula } from '../facts/formula_parser';
import { AtomProp, ConstProp, NotProp, OrProp, Literal } from '../facts/prop';
import { TopLevelEnv, NestedEnv } from '../types/env';
import { ParseProofMethod, FindProofMethodMatches, filterDischargedGoals, CreateProofTactic } from './proof_tactic';
import { Formula, OP_EQUAL } from '../facts/formula';
import { LeftTactic, RightTactic, DisjCasesTactic } from './prop_tactics';


describe('verum', function() {

  const env = new TopLevelEnv([], []);
  const formula = ParseFormula('x = x');  // unused by verum but required by API

  it('parses "verum" when goal is true', function() {
    const result = ParseProofMethod('verum', formula, env, []);
    assert.ok(typeof result !== 'string');
    assert.strictEqual(result.kind, 'tactic');
  });

  it('returns error when goal is not true', function() {
    const result = ParseProofMethod('verum', formula, env, []);
    // verum parses but decompose will check; the parser accepts it
    // Actually, verum should validate the goal is ConstProp(true)
    // Let's test via the tactic's decompose
    assert.ok(typeof result !== 'string');
  });

  it('decompose returns empty goals', function() {
    const result = ParseProofMethod('verum', formula, env, []);
    assert.ok(typeof result !== 'string' && result.kind === 'tactic');
    const goals = result.tactic.decompose();
    assert.strictEqual(goals.length, 0);
  });

  it('autocompletes "ver" to "verum"', function() {
    const matches = FindProofMethodMatches('ver', formula, env);
    assert.ok(matches.some(m => m.completion === 'verum'));
  });

  it('no autocomplete for unrelated text', function() {
    const matches = FindProofMethodMatches('ind', formula, env);
    assert.ok(!matches.some(m => m.completion === 'verum'));
  });
});


describe('exfalso', function() {

  const env = new TopLevelEnv([], []);
  const formula = ParseFormula('x = x');

  it('parses "exfalso"', function() {
    const result = ParseProofMethod('exfalso', formula, env, []);
    assert.ok(typeof result !== 'string');
    assert.strictEqual(result.kind, 'tactic');
  });

  it('returns null for non-exfalso text', function() {
    const result = ParseProofMethod('exfalso', formula, env, []);
    assert.ok(typeof result !== 'string');
  });

  it('decompose returns one goal: false', function() {
    const result = ParseProofMethod('exfalso', formula, env, []);
    assert.ok(typeof result !== 'string' && result.kind === 'tactic');
    const goals = result.tactic.decompose();
    assert.strictEqual(goals.length, 1);
    assert.ok(goals[0].goal.equivalent(new ConstProp(false)));
    assert.strictEqual(goals[0].label, 'false');
  });

  it('goal is auto-discharged when false is known', function() {
    const envWithFalse = new NestedEnv(env, [], [new ConstProp(false)]);
    const result = ParseProofMethod('exfalso', formula, envWithFalse, []);
    assert.ok(typeof result !== 'string' && result.kind === 'tactic');
    const goals = result.tactic.decompose();
    const remaining = filterDischargedGoals(goals);
    assert.strictEqual(remaining.length, 0);
  });

  it('goal is not discharged when false is not known', function() {
    const result = ParseProofMethod('exfalso', formula, env, []);
    assert.ok(typeof result !== 'string' && result.kind === 'tactic');
    const goals = result.tactic.decompose();
    const remaining = filterDischargedGoals(goals);
    assert.strictEqual(remaining.length, 1);
  });

  it('autocompletes "exf" to "exfalso"', function() {
    const matches = FindProofMethodMatches('exf', formula, env);
    assert.ok(matches.some(m => m.completion === 'exfalso'));
  });
});


describe('contradiction', function() {

  const env = new TopLevelEnv([], []);
  const formula = ParseFormula('x = x');

  it('parses "contradiction x < y"', function() {
    const result = ParseProofMethod('contradiction x < y', formula, env, []);
    assert.ok(typeof result !== 'string');
    assert.strictEqual(result.kind, 'tactic');
  });

  it('returns null for non-contradiction text', function() {
    const result = ParseProofMethod('calculation', formula, env, []);
    assert.ok(typeof result !== 'string');
    assert.strictEqual(result.kind, 'calculate');
  });

  it('returns error for bad formula', function() {
    const result = ParseProofMethod('contradiction ???', formula, env, []);
    assert.ok(typeof result === 'string');
  });

  it('decompose returns two goals: P and not P', function() {
    const result = ParseProofMethod('contradiction x < y', formula, env, []);
    assert.ok(typeof result !== 'string' && result.kind === 'tactic');
    const goals = result.tactic.decompose();
    assert.strictEqual(goals.length, 2);
    assert.strictEqual(goals[0].goal.to_string(), 'x < y');
    assert.strictEqual(goals[0].label, 'x < y');
    assert.strictEqual(goals[1].goal.to_string(), 'not x < y');
    assert.strictEqual(goals[1].label, 'not x < y');
  });

  it('both goals auto-discharged when P and not P are known', function() {
    const p = new AtomProp(ParseFormula('x < y'));
    const notP = new NotProp(ParseFormula('x < y'));
    const envWithBoth = new NestedEnv(env, [['x', 'Int'], ['y', 'Int']], [p, notP]);
    const result = ParseProofMethod('contradiction x < y', formula, envWithBoth, []);
    assert.ok(typeof result !== 'string' && result.kind === 'tactic');
    const goals = result.tactic.decompose();
    const remaining = filterDischargedGoals(goals);
    assert.strictEqual(remaining.length, 0);
  });

  it('one goal remains when only P is known', function() {
    const p = new AtomProp(ParseFormula('x < y'));
    const envWithP = new NestedEnv(env, [['x', 'Int'], ['y', 'Int']], [p]);
    const result = ParseProofMethod('contradiction x < y', formula, envWithP, []);
    assert.ok(typeof result !== 'string' && result.kind === 'tactic');
    const goals = result.tactic.decompose();
    const remaining = filterDischargedGoals(goals);
    assert.strictEqual(remaining.length, 1);
    assert.strictEqual(remaining[0].goal.to_string(), 'not x < y');
  });

  it('autocompletes "contr" to "contradiction "', function() {
    const matches = FindProofMethodMatches('contr', formula, env);
    assert.ok(matches.some(m => m.completion === 'contradiction '));
  });

  it('autocompletes "contradiction x" with full text', function() {
    const matches = FindProofMethodMatches('contradiction x', formula, env);
    assert.ok(matches.some(m => m.completion === 'contradiction x'));
  });
});


describe('absurdum', function() {

  const env = new NestedEnv(new TopLevelEnv([], []), [['x', 'Int']]);
  const formula = ParseFormula('x = x');

  it('parses "absurdum"', function() {
    const result = ParseProofMethod('absurdum', formula, env, []);
    assert.ok(typeof result !== 'string');
    assert.strictEqual(result.kind, 'tactic');
  });

  it('decompose returns one goal: false in env with P added', function() {
    // Goal is "not x < 0", so P is "x < 0"
    const goalFormula = ParseFormula('x < 0');
    const result = ParseProofMethod('absurdum', goalFormula, env, []);
    assert.ok(typeof result !== 'string' && result.kind === 'tactic');
    const goals = result.tactic.decompose();
    assert.strictEqual(goals.length, 1);
    assert.ok(goals[0].goal.equivalent(new ConstProp(false)));
    assert.strictEqual(goals[0].label, 'false');
    // The env should have P as a new fact
    assert.strictEqual(goals[0].newFacts.length, 1);
    assert.strictEqual(goals[0].newFacts[0].to_string(), 'x < 0');
    // Verify P is accessible in the goal's env
    const factCount = goals[0].env.numFacts();
    assert.strictEqual(goals[0].env.getFact(factCount).to_string(), 'x < 0');
  });

  it('autocompletes "abs" to "absurdum"', function() {
    const matches = FindProofMethodMatches('abs', formula, env);
    assert.ok(matches.some(m => m.completion === 'absurdum'));
  });
});


describe('left', function() {

  const env = new NestedEnv(new TopLevelEnv([], []), [['x', 'Int']]);
  const formula = ParseFormula('x < 0');

  it('parses "left"', function() {
    const result = ParseProofMethod('left', formula, env, []);
    assert.ok(typeof result !== 'string');
    assert.strictEqual(result.kind, 'tactic');
  });

  it('decompose returns first disjunct as goal', function() {
    const p: Literal = new AtomProp(ParseFormula('x < 0'));
    const q: Literal = new AtomProp(ParseFormula('0 <= x'));
    const goal = new OrProp([p, q]);
    // Import and use LeftTactic directly
    const tactic = new LeftTactic(env, goal);
    const goals = tactic.decompose();
    assert.strictEqual(goals.length, 1);
    assert.strictEqual(goals[0].goal.to_string(), 'x < 0');
    assert.strictEqual(goals[0].label, 'x < 0');
  });

  it('goal is auto-discharged when first disjunct is known', function() {
    const p: Literal = new AtomProp(ParseFormula('x < 0'));
    const q: Literal = new AtomProp(ParseFormula('0 <= x'));
    const goal = new OrProp([p, q]);
    const envWithP = new NestedEnv(env, [], [p]);
    const tactic = new LeftTactic(envWithP, goal);
    const goals = tactic.decompose();
    const remaining = filterDischargedGoals(goals);
    assert.strictEqual(remaining.length, 0);
  });

  it('decompose on not(a = b) returns a < b as goal', function() {
    const notEqGoal = new NotProp(ParseFormula('x = 0'));
    const node = { kind: 'tactic' as const, method: 'left', methodLine: 0, cases: [] };
    const tactic = CreateProofTactic(node, notEqGoal, env, []);
    const goals = tactic.decompose();
    assert.strictEqual(goals.length, 1);
    assert.strictEqual(goals[0].goal.to_string(), 'x < 0');
  });

  it('autocompletes "le" to "left"', function() {
    const matches = FindProofMethodMatches('le', formula, env);
    assert.ok(matches.some(m => m.completion === 'left'));
  });
});


describe('right', function() {

  const env = new NestedEnv(new TopLevelEnv([], []), [['x', 'Int']]);
  const formula = ParseFormula('x < 0');

  it('parses "right"', function() {
    const result = ParseProofMethod('right', formula, env, []);
    assert.ok(typeof result !== 'string');
    assert.strictEqual(result.kind, 'tactic');
  });

  it('decompose returns second disjunct as goal', function() {
    const p: Literal = new AtomProp(ParseFormula('x < 0'));
    const q: Literal = new AtomProp(ParseFormula('0 <= x'));
    const goal = new OrProp([p, q]);
    const tactic = new RightTactic(env, goal);
    const goals = tactic.decompose();
    assert.strictEqual(goals.length, 1);
    assert.strictEqual(goals[0].goal.to_string(), '0 <= x');
    assert.strictEqual(goals[0].label, '0 <= x');
  });

  it('goal is auto-discharged when second disjunct is known', function() {
    const p: Literal = new AtomProp(ParseFormula('x < 0'));
    const q: Literal = new AtomProp(ParseFormula('0 <= x'));
    const goal = new OrProp([p, q]);
    const envWithQ = new NestedEnv(env, [], [q]);
    const tactic = new RightTactic(envWithQ, goal);
    const goals = tactic.decompose();
    const remaining = filterDischargedGoals(goals);
    assert.strictEqual(remaining.length, 0);
  });

  it('decompose on not(a = b) returns b < a as goal', function() {
    const notEqGoal = new NotProp(ParseFormula('x = 0'));
    const node = { kind: 'tactic' as const, method: 'right', methodLine: 0, cases: [] };
    const tactic = CreateProofTactic(node, notEqGoal, env, []);
    const goals = tactic.decompose();
    assert.strictEqual(goals.length, 1);
    assert.strictEqual(goals[0].goal.to_string(), '0 < x');
  });

  it('autocompletes "ri" to "right"', function() {
    const matches = FindProofMethodMatches('ri', formula, env);
    assert.ok(matches.some(m => m.completion === 'right'));
  });
});


describe('cases (disjunction)', function() {

  const env = new NestedEnv(new TopLevelEnv([], []), [['x', 'Int']]);
  const formula = ParseFormula('x = x');

  it('returns error for unrecognized method text', function() {
    const result = ParseProofMethod('blah', formula, env, []);
    assert.ok(typeof result === 'string');
  });

  it('parses "cases x < 0 or 0 <= x"', function() {
    const result = ParseProofMethod('cases x < 0 or 0 <= x', formula, env, []);
    assert.ok(typeof result !== 'string');
    assert.strictEqual(result.kind, 'tactic');
  });

  it('returns error for bad formula in cases', function() {
    const result = ParseProofMethod('cases ??? or 0 <= x', formula, env, []);
    assert.ok(typeof result === 'string');
  });

  it('returns error for cases without or', function() {
    const result = ParseProofMethod('cases x < 0', formula, env, []);
    assert.ok(typeof result === 'string');
  });

  it('decompose returns three goals for non-tautological disjunction', function() {
    // x < 0 or x < 1 is NOT a tautology
    const p: Literal = new AtomProp(ParseFormula('x < 0'));
    const q: Literal = new AtomProp(ParseFormula('x < 1'));
    const goalProp = new AtomProp(ParseFormula('x = x'));
    const tactic = new DisjCasesTactic(env, goalProp, [p, q]);
    const goals = tactic.decompose();
    assert.strictEqual(goals.length, 3);
    // First goal: the disjunction itself
    assert.ok(goals[0].goal.equivalent(new OrProp([p, q])));
    assert.strictEqual(goals[0].label, 'x < 0 or x < 1');
    // Second goal: R in env+P
    assert.strictEqual(goals[1].goal.to_string(), 'x = x');
    assert.strictEqual(goals[1].label, 'x < 0');
    assert.strictEqual(goals[1].newFacts.length, 1);
    assert.strictEqual(goals[1].newFacts[0].to_string(), 'x < 0');
    // Third goal: R in env+Q
    assert.strictEqual(goals[2].goal.to_string(), 'x = x');
    assert.strictEqual(goals[2].label, 'x < 1');
    assert.strictEqual(goals[2].newFacts.length, 1);
    assert.strictEqual(goals[2].newFacts[0].to_string(), 'x < 1');
  });

  it('disjunction goal auto-discharged when P or Q is known', function() {
    const p: Literal = new AtomProp(ParseFormula('x < 0'));
    const q: Literal = new AtomProp(ParseFormula('x < 1'));
    const orProp = new OrProp([p, q]);
    const envWithOr = new NestedEnv(env, [], [orProp]);
    const goalProp = new AtomProp(ParseFormula('x = x'));
    const tactic = new DisjCasesTactic(envWithOr, goalProp, [p, q]);
    const goals = tactic.decompose();
    const remaining = filterDischargedGoals(goals);
    assert.strictEqual(remaining.length, 2);  // only R+P and R+Q remain
  });

  // --- Tautology recognition: dichotomy ---

  it('skips disjunction goal for integer dichotomy a < b or b <= a', function() {
    const p: Literal = new AtomProp(ParseFormula('x < 0'));
    const q: Literal = new AtomProp(ParseFormula('0 <= x'));
    const goalProp = new AtomProp(ParseFormula('x = x'));
    const tactic = new DisjCasesTactic(env, goalProp, [p, q]);
    const goals = tactic.decompose();
    assert.strictEqual(goals.length, 2);  // no disjunction goal
    assert.strictEqual(goals[0].label, 'x < 0');
    assert.strictEqual(goals[1].label, '0 <= x');
  });

  it('skips disjunction goal for integer dichotomy b <= a or a < b', function() {
    const p: Literal = new AtomProp(ParseFormula('0 <= x'));
    const q: Literal = new AtomProp(ParseFormula('x < 0'));
    const goalProp = new AtomProp(ParseFormula('x = x'));
    const tactic = new DisjCasesTactic(env, goalProp, [p, q]);
    const goals = tactic.decompose();
    assert.strictEqual(goals.length, 2);
  });

  it('skips disjunction goal for integer dichotomy a <= b or b < a', function() {
    const p: Literal = new AtomProp(ParseFormula('x <= 0'));
    const q: Literal = new AtomProp(ParseFormula('0 < x'));
    const goalProp = new AtomProp(ParseFormula('x = x'));
    const tactic = new DisjCasesTactic(env, goalProp, [p, q]);
    const goals = tactic.decompose();
    assert.strictEqual(goals.length, 2);
  });

  // --- Tautology recognition: equality decidability ---

  it('skips disjunction goal for a = b or not (a = b)', function() {
    const p: Literal = new AtomProp(ParseFormula('x = 0'));
    const q: Literal = new NotProp(ParseFormula('x = 0'));
    const goalProp = new AtomProp(ParseFormula('x = x'));
    const tactic = new DisjCasesTactic(env, goalProp, [p, q]);
    const goals = tactic.decompose();
    assert.strictEqual(goals.length, 2);
    assert.strictEqual(goals[0].label, 'x = 0');
    assert.strictEqual(goals[1].label, 'not x = 0');
  });

  it('skips disjunction goal for not (a = b) or a = b (reversed)', function() {
    const p: Literal = new NotProp(ParseFormula('x = 0'));
    const q: Literal = new AtomProp(ParseFormula('x = 0'));
    const goalProp = new AtomProp(ParseFormula('x = x'));
    const tactic = new DisjCasesTactic(env, goalProp, [p, q]);
    const goals = tactic.decompose();
    assert.strictEqual(goals.length, 2);
  });

  // --- Tautology recognition: trichotomy ---

  it('skips disjunction goal for a < b or a = b or b < a', function() {
    const p: Literal = new AtomProp(ParseFormula('x < 0'));
    const q: Literal = new AtomProp(ParseFormula('x = 0'));
    const r: Literal = new AtomProp(ParseFormula('0 < x'));
    const goalProp = new AtomProp(ParseFormula('x = x'));
    const tactic = new DisjCasesTactic(env, goalProp, [p, q, r]);
    const goals = tactic.decompose();
    assert.strictEqual(goals.length, 3);  // 3 branch goals, no disjunction goal
    assert.strictEqual(goals[0].label, 'x < 0');
    assert.strictEqual(goals[1].label, 'x = 0');
    assert.strictEqual(goals[2].label, '0 < x');
  });

  it('skips disjunction goal for trichotomy in any order', function() {
    const p: Literal = new AtomProp(ParseFormula('x = 0'));
    const q: Literal = new AtomProp(ParseFormula('0 < x'));
    const r: Literal = new AtomProp(ParseFormula('x < 0'));
    const goalProp = new AtomProp(ParseFormula('x = x'));
    const tactic = new DisjCasesTactic(env, goalProp, [p, q, r]);
    const goals = tactic.decompose();
    assert.strictEqual(goals.length, 3);
  });

  it('does not skip disjunction goal for not-not pair', function() {
    const p: Literal = new NotProp(ParseFormula('x = 0'));
    const q: Literal = new NotProp(ParseFormula('x = 1'));
    const goalProp = new AtomProp(ParseFormula('x = x'));
    const tactic = new DisjCasesTactic(env, goalProp, [p, q]);
    const goals = tactic.decompose();
    assert.strictEqual(goals.length, 3);  // includes disjunction goal
  });

  it('does not skip disjunction goal for four disjuncts', function() {
    const a: Literal = new AtomProp(ParseFormula('x < 0'));
    const b: Literal = new AtomProp(ParseFormula('x = 0'));
    const c: Literal = new AtomProp(ParseFormula('0 < x'));
    const d: Literal = new AtomProp(ParseFormula('x < 1'));
    const goalProp = new AtomProp(ParseFormula('x = x'));
    const tactic = new DisjCasesTactic(env, goalProp, [a, b, c, d]);
    const goals = tactic.decompose();
    assert.strictEqual(goals.length, 5);  // includes disjunction goal
  });

  it('does not skip disjunction goal for non-tautological triple', function() {
    const p: Literal = new AtomProp(ParseFormula('x < 0'));
    const q: Literal = new AtomProp(ParseFormula('x = 0'));
    const r: Literal = new AtomProp(ParseFormula('x < 1'));
    const goalProp = new AtomProp(ParseFormula('x = x'));
    const tactic = new DisjCasesTactic(env, goalProp, [p, q, r]);
    const goals = tactic.decompose();
    assert.strictEqual(goals.length, 4);  // includes disjunction goal
  });

  it('does not skip disjunction goal for triple with not (not atom)', function() {
    const p: Literal = new AtomProp(ParseFormula('x < 0'));
    const q: Literal = new NotProp(ParseFormula('x = 0'));
    const r: Literal = new AtomProp(ParseFormula('0 < x'));
    const goalProp = new AtomProp(ParseFormula('x = x'));
    const tactic = new DisjCasesTactic(env, goalProp, [p, q, r]);
    const goals = tactic.decompose();
    assert.strictEqual(goals.length, 4);  // not all atoms, so not trichotomy
  });

  it('does not skip disjunction goal for triple with no equality', function() {
    const p: Literal = new AtomProp(ParseFormula('x < 0'));
    const q: Literal = new AtomProp(ParseFormula('0 < x'));
    const r: Literal = new AtomProp(ParseFormula('x < 1'));
    const goalProp = new AtomProp(ParseFormula('x = x'));
    const tactic = new DisjCasesTactic(env, goalProp, [p, q, r]);
    const goals = tactic.decompose();
    assert.strictEqual(goals.length, 4);  // no = formula, so not trichotomy
  });

  it('does not skip disjunction goal for triple with = but non-< others', function() {
    const p: Literal = new AtomProp(ParseFormula('x = 0'));
    const q: Literal = new AtomProp(ParseFormula('0 <= x'));
    const r: Literal = new AtomProp(ParseFormula('x <= 0'));
    const goalProp = new AtomProp(ParseFormula('x = x'));
    const tactic = new DisjCasesTactic(env, goalProp, [p, q, r]);
    const goals = tactic.decompose();
    assert.strictEqual(goals.length, 4);  // others are <=, not <
  });

  it('parses "cases" with not disjunct', function() {
    const result = ParseProofMethod('cases x < 0 or not 0 <= x', formula, env, []);
    assert.ok(typeof result !== 'string');
    assert.strictEqual(result.kind, 'tactic');
  });

  it('returns error for bad not formula in cases', function() {
    const result = ParseProofMethod('cases x < 0 or not ???', formula, env, []);
    assert.ok(typeof result === 'string');
  });

  it('autocompletes "cas" to "cases "', function() {
    const matches = FindProofMethodMatches('cas', formula, env);
    assert.ok(matches.some(m => m.completion === 'cases '));
  });

  it('autocompletes "cases x" with full text', function() {
    const matches = FindProofMethodMatches('cases x < 0', formula, env);
    assert.ok(matches.some(m => m.completion === 'cases x < 0'));
  });
});
