import * as assert from 'assert';
import { Constant, Variable, Call } from './exprs';
import { Formula, OP_LESS_THAN } from './formula';
import { UnifyExprs, EnumerateReplacements, ApplySubst, SubstAll,
    SubstAllWithCheck, SubstPositive, SubstNegative,
    FreshenVars, FreshenVarsMany, FreshVarName } from './unify';

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

  it('unifies variable with constant', function() {
    // UnifyVar("a", ONE) triggers OccursCheck on a constant (line 133)
    const subst = UnifyExprs(Variable.of('a'), ONE, new Set(['a']));
    assert.ok(subst !== undefined);
    assert.ok(subst!.get('a')!.equals(ONE));
  });

  it('fails on circular reference (occurs check)', function() {
    // a = f(a) should fail via OccursCheck (line 113)
    const subst = UnifyExprs(Variable.of('a'), Call.of('f', Variable.of('a')), new Set(['a']));
    assert.strictEqual(subst, undefined);
  });

  it('unifies via variable chain in substitution', function() {
    // unify add(a, b) with add(c, a) where {a, b} are allowed
    // Step 1: a unifies with c → bind a = c
    // Step 2: b unifies with a → a is already in subst → UnifyVar("b", c) (line 111)
    const subst = UnifyExprs(
        Call.add(Variable.of('a'), Variable.of('b')),
        Call.add(Variable.of('c'), Variable.of('a')),
        new Set(['a', 'b']));
    assert.ok(subst !== undefined);
    assert.ok(subst!.get('a')!.equals(Variable.of('c')));
    assert.ok(subst!.get('b')!.equals(Variable.of('c')));
  });

  it('fails when functions have different arities', function() {
    // Line 92: expr1.args.length !== expr2.args.length
    const subst = UnifyExprs(Call.of('f', x), Call.of('f', x, y), new Set([]));
    assert.strictEqual(subst, undefined);
  });

  it('fails with transitive circular reference via substitution', function() {
    // add(b, a) vs add(f(a), f(b)) with {a,b} allowed:
    // 1) bind b = f(a);  2) OccursCheck("a", f(b)) → follows chain b→f(a) → finds "a" (line 125)
    const subst = UnifyExprs(
        Call.add(Variable.of('b'), Variable.of('a')),
        Call.add(Call.of('f', Variable.of('a')), Call.of('f', Variable.of('b'))),
        new Set(['a', 'b']));
    assert.strictEqual(subst, undefined);
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

  it('returns original function when no children match', function() {
    // add(x, y) — top level and both children don't match f(a); changed=false, falls through (lines 218)
    const pattern = Call.of('f', Variable.of('a'));
    const result = SubstAll(Call.add(x, y), pattern, ONE, new Set(['a']));
    assert.ok(result.equals(Call.add(x, y)));
  });

  it('substitutes only matching children', function() {
    // add(f(x), y) — f(x) matches → changed=true; y doesn't → unchanged child (line 215)
    const pattern = Call.of('f', Variable.of('a'));
    const repl = Call.add(Variable.of('a'), ONE);
    const result = SubstAll(Call.add(Call.of('f', x), y), pattern, repl, new Set(['a']));
    assert.ok(result.equals(Call.add(Call.add(x, ONE), y)));
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
    assert.equal((result as Call).name, '_add_');
    assert.equal((result as Call).args.length, 2);
  });

  it('handles expression with no variables', function() {
    const [result, freshNames] = FreshenVars(ONE);
    assert.equal(freshNames.size, 0);
    assert.ok(result.equals(ONE));
  });

  it('skips variable whose name collides with an earlier fresh name', function() {
    // Probe the counter so we know the next two fresh names
    const probe = FreshVarName();               // consumes _v{N}
    const nextFresh = `_v${parseInt(probe.slice(2)) + 1}`;  // _v{N+1}
    // expr: add('x', nextFresh). Processing 'x' first generates nextFresh, then
    // the loop sees nextFresh as the next variable and freshNames.has(nextFresh) is true → continue
    const expr = Call.add(Variable.of('x'), Variable.of(nextFresh));
    const [, freshNames] = FreshenVars(expr);
    assert.ok(freshNames.has(nextFresh));
  });

});


describe('FreshenVarsMany', function() {

  it('renames consistently across all expressions', function() {
    const e1 = Call.add(Variable.of('a'), Variable.of('b'));
    const e2 = Call.multiply(Variable.of('a'), Variable.of('b'));
    const [results, freshNames] = FreshenVarsMany([e1, e2], new Set(['a', 'b']));
    assert.equal(freshNames.size, 2);
    // Both should use the same fresh names
    const vars1 = results[0].var_refs();
    const vars2 = results[1].var_refs();
    assert.deepEqual(new Set(vars1), new Set(vars2));
    // No original names remain
    assert.ok(!vars1.includes('a'));
    assert.ok(!vars1.includes('b'));
  });

  it('only renames specified vars', function() {
    const e1 = Call.add(Variable.of('a'), Variable.of('b'));
    const e2 = Variable.of('a');
    const [results, freshNames] = FreshenVarsMany([e1, e2], new Set(['a']));
    assert.equal(freshNames.size, 1);
    // b should remain
    assert.ok(results[0].var_refs().includes('b'));
    // a should be gone
    assert.ok(!results[0].var_refs().includes('a'));
    assert.ok(!results[1].var_refs().includes('a'));
  });

});


describe('SubstPositive', function() {

  it('replaces in both args of add', function() {
    const expr = Call.add(Variable.of('x'), Variable.of('x'));
    const result = SubstPositive(expr, Variable.of('x'), Constant.of(3n));
    assert.ok(result.equals(Call.add(Constant.of(3n), Constant.of(3n))));
  });

  it('replaces in first arg of subtract but not second', function() {
    const expr = Call.subtract(Variable.of('x'), Variable.of('x'));
    const result = SubstPositive(expr, Variable.of('x'), Constant.of(3n));
    assert.ok(result.equals(Call.subtract(Constant.of(3n), Variable.of('x'))));
  });

  it('does not replace inside negate', function() {
    const expr = Call.negate(Variable.of('x'));
    const result = SubstPositive(expr, Variable.of('x'), Constant.of(3n));
    assert.ok(result.equals(expr));
  });

  it('replaces inside multiply by positive constant', function() {
    const expr = Call.multiply(Constant.of(2n), Variable.of('x'));
    const result = SubstPositive(expr, Variable.of('x'), Constant.of(3n));
    assert.ok(result.equals(Call.multiply(Constant.of(2n), Constant.of(3n))));
  });

  it('does not replace inside multiply by negative constant', function() {
    const expr = Call.multiply(Constant.of(-2n), Variable.of('x'));
    const result = SubstPositive(expr, Variable.of('x'), Constant.of(3n));
    assert.ok(result.equals(expr));
  });

  it('does not recurse into user functions', function() {
    const expr = Call.of('f', Variable.of('x'));
    const result = SubstPositive(expr, Variable.of('x'), Constant.of(3n));
    assert.ok(result.equals(expr));
  });

  it('returns original subtract when from not present', function() {
    const expr = Call.subtract(Variable.of('x'), Variable.of('y'));
    const result = SubstPositive(expr, Variable.of('z'), Constant.of(3n));
    assert.ok(result === expr);
  });

  it('replaces inside multiply when variable * constant', function() {
    // b is the constant; cover the b.variety === EXPR_CONSTANT branch
    const expr = Call.multiply(Variable.of('x'), Constant.of(2n));
    const result = SubstPositive(expr, Variable.of('x'), Constant.of(3n));
    assert.ok(result.equals(Call.multiply(Constant.of(3n), Constant.of(2n))));
  });

  it('does not replace inside multiply variable * negative constant', function() {
    const expr = Call.multiply(Variable.of('x'), Constant.of(-2n));
    const result = SubstPositive(expr, Variable.of('x'), Constant.of(3n));
    assert.ok(result.equals(expr));
  });

  it('replaces at top level', function() {
    const result = SubstPositive(Variable.of('x'), Variable.of('x'), Constant.of(3n));
    assert.ok(result.equals(Constant.of(3n)));
  });

  it('does not recurse into multiply with two non-constant args', function() {
    // Neither arg is a constant — falls through the multiply constant checks (line 299 false branch)
    const expr = Call.multiply(Variable.of('x'), Variable.of('y'));
    const result = SubstPositive(expr, Variable.of('z'), Constant.of(3n));
    assert.ok(result === expr);
  });

});


describe('SubstNegative', function() {

  it('does not replace in add args', function() {
    const expr = Call.add(Variable.of('x'), Variable.of('x'));
    const result = SubstNegative(expr, Variable.of('x'), Constant.of(3n));
    assert.ok(result.equals(expr));
  });

  it('replaces in second arg of subtract but not first', function() {
    const expr = Call.subtract(Variable.of('x'), Variable.of('x'));
    const result = SubstNegative(expr, Variable.of('x'), Constant.of(3n));
    assert.ok(result.equals(Call.subtract(Variable.of('x'), Constant.of(3n))));
  });

  it('replaces inside negate', function() {
    const expr = Call.negate(Variable.of('x'));
    const result = SubstNegative(expr, Variable.of('x'), Constant.of(3n));
    assert.ok(result.equals(Call.negate(Constant.of(3n))));
  });

  it('replaces inside multiply by negative constant', function() {
    const expr = Call.multiply(Constant.of(-2n), Variable.of('x'));
    const result = SubstNegative(expr, Variable.of('x'), Constant.of(3n));
    assert.ok(result.equals(Call.multiply(Constant.of(-2n), Constant.of(3n))));
  });

  it('does not replace at top level', function() {
    const result = SubstNegative(Variable.of('x'), Variable.of('x'), Constant.of(3n));
    assert.ok(result.equals(Variable.of('x')));
  });

});


describe('SubstAllWithCheck', function() {

  it('replaces and calls onMatch at each site', function() {
    const matchSide = Variable.of('_v1');
    const replSide = Constant.of(0n);
    const freeVars = new Set(['_v1']);
    const matches: string[] = [];
    const expr = Call.add(Variable.of('x'), Variable.of('y'));
    // Neither x nor y matches _v1 at the top, but the whole expression
    // is add(x, y) which doesn't unify with _v1... actually _v1 is a free var
    // so it unifies with anything at the outermost level.
    const result = SubstAllWithCheck(expr, matchSide, replSide, freeVars, (subst) => {
      matches.push(subst.get('_v1')!.to_string());
    });
    assert.ok(result.equals(Constant.of(0n)));
    assert.equal(matches.length, 1);
    assert.equal(matches[0], 'x + y');
  });

  it('throws from onMatch propagates', function() {
    const matchSide = Variable.of('_v1');
    const replSide = Constant.of(0n);
    const freeVars = new Set(['_v1']);
    const expr = Variable.of('x');
    assert.throws(() => {
      SubstAllWithCheck(expr, matchSide, replSide, freeVars, () => {
        throw new Error('condition failed');
      });
    }, /condition failed/);
  });

  it('returns original variable when no match', function() {
    // Variable.of('x') does not unify with a+b (not a function), so returns expr
    const matchSide = Call.add(Variable.of('a'), Variable.of('b'));
    const replSide = Constant.of(0n);
    const freeVars = new Set(['a', 'b']);
    const result = SubstAllWithCheck(Variable.of('x'), matchSide, replSide, freeVars, () => {});
    assert.ok(result.equals(Variable.of('x')));
  });

  it('substitutes inside function children', function() {
    // expr = add(f(x), f(y)) — top level doesn't match f(a), but children do (lines 237-244, changed=true)
    const matchSide = Call.of('f', Variable.of('a'));
    const replSide = Call.add(Variable.of('a'), ONE);
    const freeVars = new Set(['a']);
    const matches: string[] = [];
    const expr = Call.add(Call.of('f', x), Call.of('f', y));
    const result = SubstAllWithCheck(expr, matchSide, replSide, freeVars, (subst) => {
      matches.push(subst.get('a')!.to_string());
    });
    assert.ok(result.equals(Call.add(Call.add(x, ONE), Call.add(y, ONE))));
    assert.equal(matches.length, 2);
  });

  it('returns original function when no match in children', function() {
    // expr = add(x, y) — top level doesn't match f(a), children don't either (lines 237-244, changed=false)
    const matchSide = Call.of('f', Variable.of('a'));
    const replSide = ONE;
    const freeVars = new Set(['a']);
    const expr = Call.add(x, y);
    const result = SubstAllWithCheck(expr, matchSide, replSide, freeVars, () => {});
    assert.ok(result === expr);
  });

});
