import * as assert from 'assert';
import Tableau from './tableau';
import { SmithNormalForm, IsImplied } from './smith';


describe('smith', function() {

  it('SmithNormalForm on a zero matrix', function() {
    // All zeros: _ArgMinAbs returns [-1,-1] immediately, triggering the break
    let A = new Tableau([[0n, 0n], [0n, 0n]]);
    let [rk, indexes] = SmithNormalForm(A);
    assert.strictEqual(rk, 0);
    assert.deepEqual(indexes, [0, 1]);
  });

  it('SmithNormalForm with row Bezout s=0 (row swap)', function() {
    // [[6,9],[6,10]]: after column ops A[k][k] becomes 3, A[i][k] becomes 1,
    // so ext_gcd(3,1)=[1,0,1] triggers the s=0 row-swap branch (line 74)
    let A = new Tableau([[6n, 9n], [6n, 10n]]);
    let [rk, _] = SmithNormalForm(A);
    assert.strictEqual(rk, 2);
    assert.deepEqual(A.entries, [[1n, 0n], [0n, 6n]]);
  });

  it('SmithNormalForm with column Bezout s=0 (column swap)', function() {
    // [[4,5],[6,6]]: after row ops A[k]=[2,1], so ext_gcd(2,1)=[1,0,1]
    // triggers the s=0 column-swap branch (lines 103-106)
    let A = new Tableau([[4n, 5n], [6n, 6n]]);
    let [rk, _] = SmithNormalForm(A);
    assert.strictEqual(rk, 2);
    assert.deepEqual(A.entries, [[1n, 0n], [0n, -6n]]);
  });

  it('SmithNormalForm with nontrivial column Bezout', function() {
    // [[3, 2]] exercises the column loop where s!=0 and t!=0 (e.g. s=-1, t=1)
    let A = new Tableau([[3n, 2n]]);
    let [rk, _] = SmithNormalForm(A);
    assert.strictEqual(rk, 1);
    assert.strictEqual(A.entries[0][0], 1n);
    assert.strictEqual(A.entries[0][1], 0n);
  });

  it('SmithNormalForm', function() {
    let A = new Tableau([[2n, 4n, 4n],
                         [-6n, 6n, 12n],
                         [10n, -4n, -16n]]);
    let [_, indexes] = SmithNormalForm(A);
    assert.deepEqual(A.entries, [[2n, 0n, 0n],
                                 [0n, 6n, 0n],
                                 [0n, 0n, 12n]]);
    assert.deepEqual(indexes, [0, 1, 2]);

    A = new Tableau([[2n, 4n, 4n],
                     [-6n, 6n, 12n],
                     [10n, 4n, 16n]]);
    [_, indexes] = SmithNormalForm(A);
    assert.deepEqual(A.entries, [[2n, 0n, 0n],
                                 [0n, 4n, 0n],
                                 [0n, 0n, -78n]]);
    assert.deepEqual(indexes, [0, 2, 1]);

    A = new Tableau([[1n, 0n, -1n],
                     [4n, 3n, -1n],
                     [0n, 9n, 3n],
                     [3n, 12n, 3n]]);
    [_, indexes] = SmithNormalForm(A);
    assert.deepEqual(A.entries, [[1n, 0n, 0n],
                                 [0n, 3n, 0n],
                                 [0n, 0n, 6n],
                                 [0n, 0n, 0n]]);
    assert.deepEqual(indexes, [0, 1, 2]);
  });

  it('IsImplied', function() {
    assert.strictEqual(IsImplied([
          {coefs: [1n, 0n, 1n], value: 3n},
          {coefs: [0n, 1n, 1n], value: 5n}
        ],
        {coefs: [1n, 2n, 3n], value: 13n}), true);

    // Example from HW:
    //   x + y = 2a
    //   y + z = 2b
    //   => x + z = 2(a+b−y)
    // Variables in order [a, b, x, y, z]
    assert.strictEqual(IsImplied([
          {coefs: [-2n,  0n, 1n, 1n, 0n], value: 0n},
          {coefs: [ 0n, -2n, 0n, 1n, 1n], value: 0n}
        ],
        {coefs: [-2n, -2n, 1n, 2n, 1n], value: 0n}), true);

    // Example from Lecture:
    //   a − b = sm
    //   c − d = tm
    //   => (a + c) − (b + d) = (s + t)m
    // Variables in order [a, b, c, d, sm, tm]
    assert.strictEqual(IsImplied([
          {coefs: [1n, -1n, 0n, 0n, -1n, 0n], value: 0n},
          {coefs: [0n, 0n, 1n, -1n, 0n, -1n], value: 0n}
        ],
        {coefs: [1n, -1n, 1n, -1n, -1n, -1n], value: 0n}), true);

    // Example from Lecture:
    //   a − b = qm
    //   a = (a div m)m + (a mod m)
    //   => b = ((a div m) − q)m + (a mod m)
    // Variables in order [a, b, qm, (a div m)m, a mod m]
    assert.strictEqual(IsImplied([
          {coefs: [1n, -1n, -1n, 0n, 0n], value: 0n},
          {coefs: [1n, 0n, 0n, -1n, -1n], value: 0n}
        ],
        {coefs: [0n, 1n, 1n, -1n, -1n], value: 0n}), true);

    // Example from Lecture:
    //   a mod m = b mod m
    //   a = (a div m)m + (a mod m)
    //   b = (b div m)m + (b mod m)
    //   => a − b = ((a div m) − (b div m))m
    // Variables in order [a, (a div m)m, a mod m, b, (b div m)m, b mod m]
    assert.strictEqual(IsImplied([
          {coefs: [0n, 0n, 1n, 0n, 0n, -1n], value: 0n},
          {coefs: [1n, -1n, -1n, 0n, 0n, 0n], value: 0n},
          {coefs: [0n, 0n, 0n, 1n, -1n, -1n], value: 0n}
        ],
        {coefs: [1n, -1n, 0n, -1n, 1n, 0n], value: 0n}), true);

    // Example from Lecture:
    //   n^2 = 4(q^2+qr)+r^2
    //   r^2 = 1
    //   => n^2 − 1 = (q^2 + qr)4
    // Variables in order [n^2, q^2, r^2, qr]
    assert.strictEqual(IsImplied([
          {coefs: [1n, -4n, -1n, -4n], value: 0n},
          {coefs: [0n, 0n, 1n, 0n], value: 1n}
        ],
        {coefs: [1n, -4n, 0n, -4n], value: 1n}), true);

    // Free variable in conclusion => undefined (line 175)
    // x = 1 doesn't imply anything about y
    assert.strictEqual(IsImplied([
          {coefs: [1n, 0n], value: 1n}
        ],
        {coefs: [0n, 1n], value: 0n}), undefined);

    // Conclusion coefficient doesn't divide diagonal => undefined (line 183)
    // 2x = 4 doesn't imply 3x = 6 (coefficient 3 not divisible by 2 after SNF)
    assert.strictEqual(IsImplied([
          {coefs: [2n], value: 4n}
        ],
        {coefs: [3n], value: 6n}), undefined);
  });

});
