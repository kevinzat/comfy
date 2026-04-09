import * as assert from 'assert';
import { negateCondition, casesParser } from './cases';
import { Formula, OP_LESS_THAN, OP_LESS_EQUAL } from '../facts/formula';
import { ParseFormula } from '../facts/formula_parser';
import { TopLevelEnv } from '../types/env';


describe('negateCondition', function() {

  it('negates < to >=  (i.e. right <= left)', function() {
    const cond = ParseFormula('x < y');
    assert.strictEqual(cond.op, OP_LESS_THAN);
    const neg = negateCondition(cond);
    assert.strictEqual(neg.op, OP_LESS_EQUAL);
    assert.strictEqual(neg.left.to_string(), 'y');
    assert.strictEqual(neg.right.to_string(), 'x');
  });

  it('negates <= to > (i.e. right < left)', function() {
    const cond = ParseFormula('a <= b + 1');
    assert.strictEqual(cond.op, OP_LESS_EQUAL);
    const neg = negateCondition(cond);
    assert.strictEqual(neg.op, OP_LESS_THAN);
    assert.strictEqual(neg.left.to_string(), 'b + 1');
    assert.strictEqual(neg.right.to_string(), 'a');
  });

  it('double negation returns equivalent formula', function() {
    const cond = ParseFormula('x < y');
    const neg = negateCondition(cond);
    const doubleNeg = negateCondition(neg);
    // x < y  ->  y <= x  ->  x < y
    assert.strictEqual(doubleNeg.op, OP_LESS_THAN);
    assert.strictEqual(doubleNeg.left.to_string(), 'x');
    assert.strictEqual(doubleNeg.right.to_string(), 'y');
  });
});


describe('casesParser', function() {

  const env = new TopLevelEnv([], []);
  const formula = ParseFormula('x = x');

  it('parses "simple cases on x < y"', function() {
    const result = casesParser.tryParse('simple cases on x < y', formula, env, []);
    assert.ok(result !== null && typeof result !== 'string');
    assert.strictEqual(result.kind, 'tactic');
  });

  it('parses "simple cases on x <= y"', function() {
    const result = casesParser.tryParse('simple cases on x <= y', formula, env, []);
    assert.ok(result !== null && typeof result !== 'string');
    assert.strictEqual(result.kind, 'tactic');
  });

  it('returns error for bad condition', function() {
    const result = casesParser.tryParse('simple cases on ???', formula, env, []);
    assert.strictEqual(result, 'syntax error in cases condition');
  });

  it('returns error for non-inequality condition', function() {
    const result = casesParser.tryParse('simple cases on x = y', formula, env, []);
    assert.strictEqual(result, 'cases condition must use < or <=');
  });

  it('returns null for non-cases text', function() {
    assert.strictEqual(casesParser.tryParse('calculation', formula, env, []), null);
  });

  it('matches prefix of "simple cases on"', function() {
    const matches = casesParser.getMatches('sim', formula, env);
    assert.strictEqual(matches.length, 1);
    assert.strictEqual(matches[0].completion, 'simple cases on ');
  });

  it('matches when condition started', function() {
    const matches = casesParser.getMatches('simple cases on x < y', formula, env);
    assert.strictEqual(matches.length, 1);
    assert.strictEqual(matches[0].completion, 'simple cases on x < y');
  });

  it('no matches for unrelated text', function() {
    const matches = casesParser.getMatches('induction', formula, env);
    assert.strictEqual(matches.length, 0);
  });
});
