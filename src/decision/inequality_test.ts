import * as assert from 'assert';
import { ParseFormula } from '../facts/formula_parser';
import { IsInequalityImplied, IsInequalityChainValid } from './inequality';


describe('inequality', function() {

  // -- Equations only (should still work) --

  it('equations imply equation', function() {
    assert.ok(IsInequalityImplied(
        [ParseFormula("x + y = 5"), ParseFormula("y = 2")],
        ParseFormula("x = 3")));
  });

  it('equations do not imply wrong equation', function() {
    assert.ok(!IsInequalityImplied(
        [ParseFormula("x + y = 5"), ParseFormula("y = 2")],
        ParseFormula("x = 4")));
  });

  // -- Equations implying inequalities --

  it('x = 3 implies 3 <= x', function() {
    assert.ok(IsInequalityImplied(
        [ParseFormula("x = 3")],
        ParseFormula("3 <= x")));
  });

  it('x = 3 implies x <= 3', function() {
    assert.ok(IsInequalityImplied(
        [ParseFormula("x = 3")],
        ParseFormula("x <= 3")));
  });

  it('x = 3 does not imply 4 <= x', function() {
    assert.ok(!IsInequalityImplied(
        [ParseFormula("x = 3")],
        ParseFormula("4 <= x")));
  });

  // -- Inequalities implying inequalities --

  it('3 <= x implies 2 <= x', function() {
    assert.ok(IsInequalityImplied(
        [ParseFormula("3 <= x")],
        ParseFormula("2 <= x")));
  });

  it('3 <= x does not imply 5 <= x', function() {
    assert.ok(!IsInequalityImplied(
        [ParseFormula("3 <= x")],
        ParseFormula("5 <= x")));
  });

  it('5 <= x + y, 1 <= x - y implies 3 <= x', function() {
    assert.ok(IsInequalityImplied(
        [ParseFormula("5 <= x + y"), ParseFormula("1 <= x - y")],
        ParseFormula("3 <= x")));
  });

  it('5 <= x + y, 1 <= x - y does not imply 4 <= x', function() {
    assert.ok(!IsInequalityImplied(
        [ParseFormula("5 <= x + y"), ParseFormula("1 <= x - y")],
        ParseFormula("4 <= x")));
  });

  // -- Strict inequalities --

  it('2 < x implies 3 <= x', function() {
    assert.ok(IsInequalityImplied(
        [ParseFormula("2 < x")],
        ParseFormula("3 <= x")));
  });

  it('2 < x does not imply 4 <= x', function() {
    assert.ok(!IsInequalityImplied(
        [ParseFormula("2 < x")],
        ParseFormula("4 <= x")));
  });

  it('3 <= x does not imply 3 < x', function() {
    assert.ok(!IsInequalityImplied(
        [ParseFormula("3 <= x")],
        ParseFormula("3 < x")));
  });

  // -- Mixed equations and inequalities --

  it('x + y = 5, 3 <= x implies y <= 2', function() {
    assert.ok(IsInequalityImplied(
        [ParseFormula("x + y = 5"), ParseFormula("3 <= x")],
        ParseFormula("y <= 2")));
  });

  it('x + y = 5, 3 <= x does not imply y <= 1', function() {
    assert.ok(!IsInequalityImplied(
        [ParseFormula("x + y = 5"), ParseFormula("3 <= x")],
        ParseFormula("y <= 1")));
  });

  // -- Contradictory premises (vacuously true) --

  it('5 <= x, x <= 2 vacuously implies anything', function() {
    assert.ok(IsInequalityImplied(
        [ParseFormula("5 <= x"), ParseFormula("x <= 2")],
        ParseFormula("100 <= x")));
  });

  // -- No premises --

  it('no premises does not imply 1 <= x', function() {
    assert.ok(!IsInequalityImplied(
        [],
        ParseFormula("1 <= x")));
  });

  // -- Goal is an equality from inequalities --

  it('3 <= x, x <= 3 implies x = 3', function() {
    assert.ok(IsInequalityImplied(
        [ParseFormula("3 <= x"), ParseFormula("x <= 3")],
        ParseFormula("x = 3")));
  });

  it('a <= b, b <= a implies a = b', function() {
    assert.ok(IsInequalityImplied(
        [ParseFormula("a <= b"), ParseFormula("b <= a")],
        ParseFormula("a = b")));
  });

  it('x <= y, y <= x does not imply x = y + 1', function() {
    assert.ok(!IsInequalityImplied(
        [ParseFormula("x <= y"), ParseFormula("y <= x")],
        ParseFormula("x = y + 1")));
  });

  it('3 <= x does not imply x = 3', function() {
    assert.ok(!IsInequalityImplied(
        [ParseFormula("3 <= x")],
        ParseFormula("x = 3")));
  });

});


describe('IsInequalityChainValid', function() {

  it('accepts all-equals chain for = goal', function() {
    assert.strictEqual(IsInequalityChainValid([
      ParseFormula('a = b'),
      ParseFormula('b = c'),
    ], '='), undefined);
  });

  it('rejects < step in = goal', function() {
    const err = IsInequalityChainValid([
      ParseFormula('a = b'),
      ParseFormula('b < c'),
    ], '=');
    assert.ok(err !== undefined);
  });

  it('rejects <= step in = goal', function() {
    const err = IsInequalityChainValid([
      ParseFormula('a <= b'),
    ], '=');
    assert.ok(err !== undefined);
  });

  it('accepts chain with < for < goal', function() {
    assert.strictEqual(IsInequalityChainValid([
      ParseFormula('a = b'),
      ParseFormula('b < c'),
      ParseFormula('c = d'),
    ], '<'), undefined);
  });

  it('rejects chain without < for < goal', function() {
    const err = IsInequalityChainValid([
      ParseFormula('a = b'),
      ParseFormula('b <= c'),
    ], '<');
    assert.ok(err !== undefined);
    assert.ok(err!.includes('<'));
  });

  it('accepts any mix for <= goal', function() {
    assert.strictEqual(IsInequalityChainValid([
      ParseFormula('a = b'),
      ParseFormula('b <= c'),
      ParseFormula('c < d'),
    ], '<='), undefined);
  });

  it('rejects disconnected chain', function() {
    const err = IsInequalityChainValid([
      ParseFormula('a = b'),
      ParseFormula('c < d'),
    ], '<');
    assert.ok(err !== undefined);
  });

});
