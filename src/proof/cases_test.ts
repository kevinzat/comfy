import * as assert from 'assert';
import { negateCondition } from './cases';
import { Formula, OP_LESS_THAN, OP_LESS_EQUAL } from '../facts/formula';
import { ParseFormula } from '../facts/formula_parser';


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
