import * as assert from 'assert';
import { ParseFormula } from './formula_parser';
import { OP_EQUAL, OP_LESS_THAN, OP_LESS_EQUAL } from './formula';


describe('ParseFormula', function() {

  it('parses equation', function() {
    const f = ParseFormula("x + 1 = y");
    assert.strictEqual(f.op, OP_EQUAL);
    assert.strictEqual(f.left.to_string(), "x + 1");
    assert.strictEqual(f.right.to_string(), "y");
  });

  it('parses less-than', function() {
    const f = ParseFormula("x < y + 2");
    assert.strictEqual(f.op, OP_LESS_THAN);
    assert.strictEqual(f.left.to_string(), "x");
    assert.strictEqual(f.right.to_string(), "y + 2");
  });

  it('parses less-equal', function() {
    const f = ParseFormula("x + y <= 5");
    assert.strictEqual(f.op, OP_LESS_EQUAL);
    assert.strictEqual(f.left.to_string(), "x + y");
    assert.strictEqual(f.right.to_string(), "5");
  });

  it('handles constants on both sides', function() {
    const f = ParseFormula("3 = 3");
    assert.strictEqual(f.op, OP_EQUAL);
    assert.strictEqual(f.left.to_string(), "3");
    assert.strictEqual(f.right.to_string(), "3");
  });

  it('handles complex expressions', function() {
    const f = ParseFormula("(x + y)^2 = x^2 + 2*x*y + y^2");
    assert.strictEqual(f.op, OP_EQUAL);
  });

  it('prefers <= over <', function() {
    const f = ParseFormula("x <= y");
    assert.strictEqual(f.op, OP_LESS_EQUAL);
  });

  it('throws on missing operator', function() {
    assert.throws(() => ParseFormula("x + y"), /no operator/);
  });

  it('throws on missing left expression', function() {
    assert.throws(() => ParseFormula("= 5"), /missing expression/);
  });

  it('throws on missing right expression', function() {
    assert.throws(() => ParseFormula("x ="), /missing expression/);
  });

});
