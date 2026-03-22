import * as assert from 'assert';
import { Constant, Variable, Call } from './exprs';
import { UnifyExprs, EnumerateReplacements, ApplySubst, SubstAll,
    FreshenVars, FreshenVarsPair } from './unify';

const x = Variable.of("x");
const y = Variable.of("y");
const z = Variable.of("z");
const ZERO = Constant.ZERO;
const ONE = Constant.ONE;


describe('UnifyExprs', function() {

  it('unifies variables', function() {
    const subst = UnifyExprs(
        Variable.of("a"), x, new Set(["a"]));
    assert.ok(subst !== undefined);
    assert.strictEqual(subst!.size, 1);
    assert.ok(subst!.get("a")!.equals(x));
  });

  it('unifies nested expressions', function() {
    // a + b unified with x*y + z, allowing a and b
    const pattern = Call.add(Variable.of("a"), Variable.of("b"));
    const target = Call.add(Call.multiply(x, y), z);
    const subst = UnifyExprs(pattern, target, new Set(["a", "b"]));
    assert.ok(subst !== undefined);
    assert.ok(subst!.get("a")!.equals(Call.multiply(x, y)));
    assert.ok(subst!.get("b")!.equals(z));
  });

  it('unifies repeated variable', function() {
    // a + a unified with x + x
    const pattern = Call.add(Variable.of("a"), Variable.of("a"));
    const target = Call.add(x, x);
    const subst = UnifyExprs(pattern, target, new Set(["a"]));
    assert.ok(subst !== undefined);
    assert.ok(subst!.get("a")!.equals(x));
  });

  it('fails on repeated variable mismatch', function() {
    // a + a does not unify with x + y
    const pattern = Call.add(Variable.of("a"), Variable.of("a"));
    const target = Call.add(x, y);
    const subst = UnifyExprs(pattern, target, new Set(["a"]));
    assert.strictEqual(subst, undefined);
  });

  it('fails on operator mismatch', function() {
    const subst = UnifyExprs(
        Call.add(x, y), Call.multiply(x, y), new Set([]));
    assert.strictEqual(subst, undefined);
  });

  it('unifies constants', function() {
    const subst = UnifyExprs(ZERO, ZERO, new Set([]));
    assert.ok(subst !== undefined);
    assert.strictEqual(subst!.size, 0);
  });

  it('fails on constant mismatch', function() {
    const subst = UnifyExprs(ZERO, ONE, new Set([]));
    assert.strictEqual(subst, undefined);
  });

  it('non-allowed variables must match exactly', function() {
    // x unified with y, but neither is allowed
    const subst = UnifyExprs(x, y, new Set([]));
    assert.strictEqual(subst, undefined);

    // x unified with x, neither allowed — succeeds
    const subst2 = UnifyExprs(x, x, new Set([]));
    assert.ok(subst2 !== undefined);
  });

});


describe('EnumerateReplacements', function() {

  it('returns original when no matches', function() {
    const results = EnumerateReplacements(x, () => undefined);
    assert.strictEqual(results.length, 1);
    assert.ok(results[0].equals(x));
  });

  it('replaces at root', function() {
    const results = EnumerateReplacements(x,
        (e) => e.equals(x) ? ONE : undefined);
    assert.strictEqual(results.length, 2);
    assert.ok(results[0].equals(ONE));  // replaced
    assert.ok(results[1].equals(x));    // original
  });

  it('replaces in children', function() {
    // x + y, replace x with 1
    const expr = Call.add(x, y);
    const results = EnumerateReplacements(expr,
        (e) => e.equals(x) ? ONE : undefined);
    // Should get: (1+y) from replacing left, (x+y) from no replacement
    assert.strictEqual(results.length, 2);
    const strs = results.map((r) => r.to_string()).sort();
    assert.ok(strs.indexOf("1 + y") >= 0);
    assert.ok(strs.indexOf("x + y") >= 0);
  });

  it('enumerates combinations in children', function() {
    // x + x, replace x with 1
    const expr = Call.add(x, x);
    const results = EnumerateReplacements(expr,
        (e) => e.equals(x) ? ONE : undefined);
    // Should get: (1+x), (x+1), (1+1), (x+x)
    const strs = results.map((r) => r.to_string()).sort();
    assert.strictEqual(strs.length, 4);
    assert.ok(strs.indexOf("1 + 1") >= 0);
    assert.ok(strs.indexOf("1 + x") >= 0);
    assert.ok(strs.indexOf("x + 1") >= 0);
    assert.ok(strs.indexOf("x + x") >= 0);
  });

});


describe('ApplySubst', function() {

  it('substitutes single variable', function() {
    const subst = new Map([['a', x]]);
    const result = ApplySubst(Variable.of('a'), subst);
    assert.ok(result.equals(x));
  });

  it('substitutes in nested expression', function() {
    const subst = new Map<string, any>([['a', x], ['b', y]]);
    const result = ApplySubst(Call.add(Variable.of('a'), Variable.of('b')), subst);
    assert.ok(result.equals(Call.add(x, y)));
  });

  it('leaves unmatched variables alone', function() {
    const subst = new Map([['a', x]]);
    const result = ApplySubst(Variable.of('b'), subst);
    assert.ok(result.equals(Variable.of('b')));
  });

});


describe('SubstAll', function() {

  it('substitutes at root', function() {
    const pattern = Call.of('f', Variable.of('a'));
    const repl = Call.add(Variable.of('a'), ONE);
    const result = SubstAll(Call.of('f', x), pattern, repl, new Set(['a']));
    assert.ok(result.equals(Call.add(x, ONE)));
  });

  it('substitutes in children', function() {
    const pattern = Call.of('f', Variable.of('a'));
    const repl = Call.add(Variable.of('a'), ONE);
    const expr = Call.add(Call.of('f', x), Call.of('f', y));
    const result = SubstAll(expr, pattern, repl, new Set(['a']));
    assert.ok(result.equals(Call.add(Call.add(x, ONE), Call.add(y, ONE))));
  });

  it('returns original when no match', function() {
    const pattern = Call.of('f', Variable.of('a'));
    const repl = Variable.of('a');
    const result = SubstAll(x, pattern, repl, new Set(['a']));
    assert.ok(result.equals(x));
  });

});


describe('FreshenVars', function() {

  it('renames variables to fresh names', function() {
    const [result, freshNames] = FreshenVars(Call.add(Variable.of('a'), Variable.of('b')));
    assert.equal(freshNames.size, 2);
    // Fresh names should start with _v
    for (const name of freshNames) {
      assert.ok(name.startsWith('_v'));
    }
    // Original variable names should not appear
    assert.ok(!result.var_refs().includes('a'));
    assert.ok(!result.var_refs().includes('b'));
  });

  it('preserves expression structure', function() {
    const [result, _] = FreshenVars(Call.add(x, y));
    // Should still be an addition of two variables
    assert.equal(result.variety, 3); // EXPR_FUNCTION
    assert.equal((result as any).name, '_add_');
    assert.equal((result as any).args.length, 2);
  });

  it('handles expression with no variables', function() {
    const [result, freshNames] = FreshenVars(ONE);
    assert.equal(freshNames.size, 0);
    assert.ok(result.equals(ONE));
  });

});


describe('FreshenVarsPair', function() {

  it('renames consistently across both expressions', function() {
    const e1 = Call.add(Variable.of('a'), Variable.of('b'));
    const e2 = Call.multiply(Variable.of('a'), Variable.of('b'));
    const [r1, r2, freshNames] = FreshenVarsPair(e1, e2, new Set(['a', 'b']));
    assert.equal(freshNames.size, 2);
    // Both should use the same fresh names
    const vars1 = r1.var_refs();
    const vars2 = r2.var_refs();
    assert.deepEqual(new Set(vars1), new Set(vars2));
    // No original names remain
    assert.ok(!vars1.includes('a'));
    assert.ok(!vars1.includes('b'));
  });

  it('only renames specified vars', function() {
    const e1 = Call.add(Variable.of('a'), Variable.of('b'));
    const e2 = Variable.of('a');
    const [r1, r2, freshNames] = FreshenVarsPair(e1, e2, new Set(['a']));
    assert.equal(freshNames.size, 1);
    // b should remain
    assert.ok(r1.var_refs().includes('b'));
    // a should be gone
    assert.ok(!r1.var_refs().includes('a'));
    assert.ok(!r2.var_refs().includes('a'));
  });

});
