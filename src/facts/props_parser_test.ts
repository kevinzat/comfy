import * as assert from 'assert';
import { Prop, AtomProp, NotProp, OrProp } from './prop';
import { Formula } from './formula';
import { ParseProp } from './props_parser';


/** Converts a Prop to a string for structural comparison in tests. */
function propString(p: Prop): string {
  if (p instanceof AtomProp) return p.formula.to_string();
  if (p instanceof NotProp) return `not(${p.formula.to_string()})`;
  if (p instanceof OrProp) return `(${p.disjuncts.map(propString).join(' or ')})`;
  return p.value ? 'true' : 'false';
}

function AssertParseProp(text: string, expected: string): void {
  const result = ParseProp(text);
  const actual = propString(result);
  if (actual !== expected) {
    console.log('actual:  ', actual);
    console.log('expected:', expected);
  }
  assert.strictEqual(actual, expected);
}


describe('props_parser', function() {

  it('parse atomic formulas', function() {
    AssertParseProp('x = y', 'x = y');
    AssertParseProp('x < y', 'x < y');
    AssertParseProp('x <= y', 'x <= y');
  });

  it('parse not', function() {
    AssertParseProp('not x = y', 'not(x = y)');
    AssertParseProp('not x < y', 'not(x < y)');
    AssertParseProp('not x <= y', 'not(x <= y)');
  });

  it('parse not with parenthesized formula', function() {
    AssertParseProp('not (x = y)', 'not(x = y)');
    AssertParseProp('not (f(x) = g(y))', 'not(f(x) = g(y))');
    AssertParseProp('not (x + 1 <= y)', 'not(x + 1 <= y)');
  });

  it('parse /= as NotProp of equality', function() {
    AssertParseProp('x /= y', 'not(x = y)');
    AssertParseProp('f(x) /= 0', 'not(f(x) = 0)');
    AssertParseProp('x + 1 /= y * 2', 'not(x + 1 = y*2)');
  });

  it('parse /= combines with or', function() {
    AssertParseProp('x /= 0 or y = 0', '(not(x = 0) or y = 0)');
    AssertParseProp('x = 0 or y /= 0', '(x = 0 or not(y = 0))');
  });

  it('parse or', function() {
    AssertParseProp('x = 0 or y = 0', '(x = 0 or y = 0)');
    AssertParseProp('x < 0 or y < 0 or z < 0', '(x < 0 or y < 0 or z < 0)');
  });

  it('or accumulates into a single OrProp', function() {
    const result = ParseProp('x = 0 or y = 0 or z = 0');
    assert.ok(result instanceof OrProp);
    assert.strictEqual((result as OrProp).disjuncts.length, 3);
  });

  it('parse or with not', function() {
    AssertParseProp('not x = 0 or y < 1', '(not(x = 0) or y < 1)');
    AssertParseProp('x = 0 or not y = 0', '(x = 0 or not(y = 0))');
  });

  it('parse formulas with expressions', function() {
    AssertParseProp('x + 1 = y', 'x + 1 = y');
    AssertParseProp('x * 2 <= y + 3', 'x*2 <= y + 3');
    AssertParseProp('0 = n', '0 = n');
  });

  it('parse formulas with function calls', function() {
    AssertParseProp('f(x) = 0', 'f(x) = 0');
    AssertParseProp('gcd(a, b) = 1', 'gcd(a, b) = 1');
  });

  it('produces AtomProp for single formula', function() {
    const result = ParseProp('x = 1');
    assert.ok(result instanceof AtomProp);
    assert.ok((result as AtomProp).formula instanceof Formula);
    assert.strictEqual((result as AtomProp).formula.op, '=');
  });

  it('produces NotProp for negated formula', function() {
    const result = ParseProp('not x < 5');
    assert.ok(result instanceof NotProp);
    assert.strictEqual((result as NotProp).formula.op, '<');
  });

  it('throws syntax error on empty input', function() {
    assert.throws(() => ParseProp(''), /syntax error/);
  });

  it('throws syntax error on incomplete proposition', function() {
    assert.throws(() => ParseProp('x = '), /syntax error/);
  });

});
