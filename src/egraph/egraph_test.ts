import * as assert from 'assert';
import { Constant, Variable, Call } from '../facts/exprs';
import { EGraph } from './egraph';


describe('EGraph: basic add / find', function() {

  it('creates distinct classes for distinct leaves', function() {
    const g = new EGraph();
    const a = g.add(Variable.of('a'));
    const b = g.add(Variable.of('b'));
    assert.notStrictEqual(g.find(a), g.find(b));
  });

  it('dedupes structurally equal variables', function() {
    const g = new EGraph();
    const a1 = g.add(Variable.of('a'));
    const a2 = g.add(Variable.of('a'));
    assert.strictEqual(a1, a2);
  });

  it('distinguishes constants by value', function() {
    const g = new EGraph();
    const c1 = g.add(Constant.of(1n));
    const c2 = g.add(Constant.of(2n));
    assert.notStrictEqual(g.find(c1), g.find(c2));
  });

  it('distinguishes variables from nullary functions with the same name', function() {
    const g = new EGraph();
    const v = g.add(Variable.of('a'));
    const f = g.add(Call.of('a'));
    assert.notStrictEqual(g.find(v), g.find(f));
  });

  it('dedupes structurally equal compound expressions', function() {
    const g = new EGraph();
    const e1 = g.add(Call.add(Variable.of('a'), Variable.of('b')));
    const e2 = g.add(Call.add(Variable.of('a'), Variable.of('b')));
    assert.strictEqual(e1, e2);
  });

  it('find returns id for a fresh class', function() {
    const g = new EGraph();
    const a = g.add(Variable.of('a'));
    assert.strictEqual(g.find(a), a);
  });

});


describe('EGraph: union', function() {

  it('makes two classes equivalent', function() {
    const g = new EGraph();
    const a = g.add(Variable.of('a'));
    const b = g.add(Variable.of('b'));
    g.union(a, b);
    assert.strictEqual(g.find(a), g.find(b));
  });

  it('is a no-op when classes are already equal', function() {
    const g = new EGraph();
    const a = g.add(Variable.of('a'));
    const before = g.classCount();
    const r = g.union(a, a);
    assert.strictEqual(r, g.find(a));
    assert.strictEqual(g.classCount(), before);
  });

  it('is transitive', function() {
    const g = new EGraph();
    const a = g.add(Variable.of('a'));
    const b = g.add(Variable.of('b'));
    const c = g.add(Variable.of('c'));
    g.union(a, b);
    g.union(b, c);
    assert.strictEqual(g.find(a), g.find(c));
  });

  it('equiv reflects union status', function() {
    const g = new EGraph();
    const a = g.add(Variable.of('a'));
    const b = g.add(Variable.of('b'));
    assert.strictEqual(g.equiv(a, b), false);
    g.union(a, b);
    assert.strictEqual(g.equiv(a, b), true);
  });

  it('union-by-rank handles both orderings', function() {
    // Build two subtrees of different depths so ranks differ,
    // then union in both orders.
    const g = new EGraph();
    const a = g.add(Variable.of('a'));
    const b = g.add(Variable.of('b'));
    const c = g.add(Variable.of('c'));
    const d = g.add(Variable.of('d'));
    g.union(a, b); // ranks: a=1, b=0
    g.union(c, d); // ranks: c=1, d=0
    g.union(a, c); // equal ranks -> one becomes root, rank increments
    assert.strictEqual(g.find(a), g.find(d));

    // Now union a deeper tree on the left, shallower on the right, and vice versa.
    const g2 = new EGraph();
    const p = g2.add(Variable.of('p'));
    const q = g2.add(Variable.of('q'));
    const r = g2.add(Variable.of('r'));
    g2.union(p, q);  // p rank 1
    g2.union(p, r);  // rank(p)=1 > rank(r)=0, so r attaches to p
    assert.strictEqual(g2.find(r), g2.find(p));

    const g3 = new EGraph();
    const x = g3.add(Variable.of('x'));
    const y = g3.add(Variable.of('y'));
    const z = g3.add(Variable.of('z'));
    g3.union(x, y);  // x rank 1
    g3.union(z, x);  // rank(z)=0 < rank(x)=1, so z attaches to x
    assert.strictEqual(g3.find(z), g3.find(x));
  });

});


describe('EGraph: rebuild / congruence', function() {

  it('detects that f(a) and f(b) are equal after a = b', function() {
    const g = new EGraph();
    const a = g.add(Variable.of('a'));
    const b = g.add(Variable.of('b'));
    const fa = g.add(Call.of('f', Variable.of('a')));
    const fb = g.add(Call.of('f', Variable.of('b')));
    assert.notStrictEqual(g.find(fa), g.find(fb));
    g.union(a, b);
    g.rebuild();
    assert.strictEqual(g.find(fa), g.find(fb));
  });

  it('propagates congruence upward through multiple levels', function() {
    const g = new EGraph();
    const a = g.add(Variable.of('a'));
    const b = g.add(Variable.of('b'));
    const ffa = g.add(Call.of('f', Call.of('f', Variable.of('a'))));
    const ffb = g.add(Call.of('f', Call.of('f', Variable.of('b'))));
    g.union(a, b);
    g.rebuild();
    assert.strictEqual(g.find(ffa), g.find(ffb));
  });

  it('detects congruence when only one of several arguments changes', function() {
    const g = new EGraph();
    const c = g.add(Variable.of('c'));
    const d = g.add(Variable.of('d'));
    const e1 = g.add(Call.add(Variable.of('a'), Call.multiply(Variable.of('b'), Variable.of('c'))));
    const e2 = g.add(Call.add(Variable.of('a'), Call.multiply(Variable.of('b'), Variable.of('d'))));
    assert.notStrictEqual(g.find(e1), g.find(e2));
    g.union(c, d);
    g.rebuild();
    assert.strictEqual(g.find(e1), g.find(e2));
  });

  it('rebuild is a no-op when the worklist is empty', function() {
    const g = new EGraph();
    g.add(Variable.of('a'));
    const before = g.classCount();
    g.rebuild();
    g.rebuild();
    assert.strictEqual(g.classCount(), before);
  });

  it('handles chains of unions in a single rebuild', function() {
    const g = new EGraph();
    const a = g.add(Variable.of('a'));
    const b = g.add(Variable.of('b'));
    const c = g.add(Variable.of('c'));
    const fa = g.add(Call.of('f', Variable.of('a')));
    const fb = g.add(Call.of('f', Variable.of('b')));
    const fc = g.add(Call.of('f', Variable.of('c')));
    g.union(a, b);
    g.union(b, c);
    g.rebuild();
    assert.strictEqual(g.find(fa), g.find(fb));
    assert.strictEqual(g.find(fb), g.find(fc));
  });

  it('cascades: congruence at one level triggers congruence at the next', function() {
    // g(f(a)) and g(f(b)) become equal after a = b, via f(a)=f(b) first.
    const g = new EGraph();
    const a = g.add(Variable.of('a'));
    const b = g.add(Variable.of('b'));
    const gfa = g.add(Call.of('g', Call.of('f', Variable.of('a'))));
    const gfb = g.add(Call.of('g', Call.of('f', Variable.of('b'))));
    g.union(a, b);
    g.rebuild();
    assert.strictEqual(g.find(gfa), g.find(gfb));
  });

});


describe('EGraph: lookup', function() {

  it('returns undefined for an unknown node', function() {
    const g = new EGraph();
    g.add(Variable.of('a'));
    const r = g.lookup({ op: 'v:missing', children: [] });
    assert.strictEqual(r, undefined);
  });

  it('returns the canonical class for an existing node', function() {
    const g = new EGraph();
    const a = g.add(Variable.of('a'));
    const r = g.lookup({ op: 'v:a', children: [] });
    assert.strictEqual(r, g.find(a));
  });

  it('survives unions on child classes', function() {
    const g = new EGraph();
    const a = g.add(Variable.of('a'));
    const b = g.add(Variable.of('b'));
    const fa = g.add(Call.of('f', Variable.of('a')));
    g.union(a, b);
    g.rebuild();
    // After rebuild, looking up f(b) should give f(a)'s class.
    const r = g.lookup({ op: 'f:f', children: [g.find(b)] });
    assert.strictEqual(r, g.find(fa));
  });

});


describe('EGraph: extract', function() {

  it('round-trips a simple variable', function() {
    const g = new EGraph();
    const id = g.add(Variable.of('x'));
    const out = g.extract(id);
    assert.strictEqual(out.to_string(), 'x');
  });

  it('round-trips a constant', function() {
    const g = new EGraph();
    const id = g.add(Constant.of(42n));
    const out = g.extract(id);
    assert.strictEqual(out.to_string(), '42');
  });

  it('round-trips a compound expression', function() {
    const g = new EGraph();
    const expr = Call.add(Variable.of('a'), Call.multiply(Variable.of('b'), Variable.of('c')));
    const id = g.add(expr);
    const out = g.extract(id);
    assert.strictEqual(out.to_string(), 'a + b*c');
  });

  it('picks the smaller representation after a union', function() {
    // add f(a) and x; union them; extracting the class should prefer x (size 1)
    // over f(a) (size 2).
    const g = new EGraph();
    const fa = g.add(Call.of('f', Variable.of('a')));
    const x = g.add(Variable.of('x'));
    g.union(fa, x);
    g.rebuild();
    const out = g.extract(fa);
    assert.strictEqual(out.to_string(), 'x');
  });

  it('handles a generic function call', function() {
    const g = new EGraph();
    const expr = Call.of('foo', Variable.of('a'), Variable.of('b'));
    const id = g.add(expr);
    const out = g.extract(id);
    assert.strictEqual(out.to_string(), 'foo(a, b)');
  });

  it('handles a nullary function call', function() {
    const g = new EGraph();
    const id = g.add(Call.of('nil'));
    const out = g.extract(id);
    assert.strictEqual(out.to_string(), 'nil()');
  });

});


describe('EGraph: repair edge cases', function() {

  it('extract handles nodes whose child cost is not yet computed', function() {
    // Construct a class ordering where some node's children have higher ids,
    // forcing the cost fixpoint to make multiple passes.
    const g = new EGraph();
    const a = g.add(Variable.of('a'));        // id 0
    g.add(Variable.of('b'));                  // id 1
    const fb = g.add(Call.of('f', Variable.of('b'))); // id 2
    g.union(a, fb);                           // a's class now also contains f(b)
    g.rebuild();
    // Iteration order starts with class 0 (containing v:a and f(b)); the
    // f(b) node references class 1, which isn't costed on the first pass.
    const out = g.extract(a);
    assert.strictEqual(out.to_string(), 'a');
  });

  it('tolerates a todo class being absorbed by another during the same pass', function() {
    // Enqueue three classes [0, 2, 3] onto the worklist such that repair(0)
    // unions classes 2 and 3, making class 3 non-canonical before its own
    // repair call.
    const g = new EGraph();
    const a = g.add(Variable.of('a'));                    // 0
    const b = g.add(Variable.of('b'));                    // 1
    const fa = g.add(Call.of('f', Variable.of('a')));     // 2
    const fb = g.add(Call.of('f', Variable.of('b')));     // 3
    const x = g.add(Variable.of('x'));                    // 4
    const y = g.add(Variable.of('y'));                    // 5
    g.union(a, b);   // worklist push: root of {0, 1} = 0
    g.union(fa, x);  // worklist push: root of {2, 4} = 2
    g.union(fb, y);  // worklist push: root of {3, 5} = 3
    g.rebuild();
    // repair(0) must have found f(a) ≡ f(b) and unioned class 2 with class 3.
    assert.strictEqual(g.find(fa), g.find(fb));
  });

  it('handles e-nodes with repeated children (f(a, a))', function() {
    // f(a, a) records 'a' as its own parent twice. After a union involving a,
    // repair must tolerate duplicate parent entries that already share a class.
    const g = new EGraph();
    const a = g.add(Variable.of('a'));
    const b = g.add(Variable.of('b'));
    const faa = g.add(Call.of('f', Variable.of('a'), Variable.of('a')));
    const fbb = g.add(Call.of('f', Variable.of('b'), Variable.of('b')));
    g.union(a, b);
    g.rebuild();
    assert.strictEqual(g.find(faa), g.find(fbb));
  });

});


describe('EGraph: introspection', function() {

  it('reports class and node counts', function() {
    const g = new EGraph();
    assert.strictEqual(g.classCount(), 0);
    assert.strictEqual(g.nodeCount(), 0);
    const a = g.add(Variable.of('a'));
    const b = g.add(Variable.of('b'));
    g.add(Call.add(Variable.of('a'), Variable.of('b')));
    assert.strictEqual(g.classCount(), 3);
    assert.strictEqual(g.nodeCount(), 3);
    g.union(a, b);
    g.rebuild();
    assert.strictEqual(g.classCount(), 2);
  });

  it('lists canonical class ids', function() {
    const g = new EGraph();
    const a = g.add(Variable.of('a'));
    const b = g.add(Variable.of('b'));
    const ids = g.classIds();
    assert.strictEqual(ids.length, 2);
    assert.ok(ids.includes(g.find(a)));
    assert.ok(ids.includes(g.find(b)));
  });

  it('lists nodes in a class', function() {
    const g = new EGraph();
    const a = g.add(Variable.of('a'));
    const b = g.add(Variable.of('b'));
    g.union(a, b);
    g.rebuild();
    const nodes = g.classNodes(g.find(a));
    assert.strictEqual(nodes.length, 2);
    const ops = nodes.map(n => n.op).sort();
    assert.deepStrictEqual(ops, ['v:a', 'v:b']);
  });

  it('classNodes on a non-canonical id still works', function() {
    const g = new EGraph();
    const a = g.add(Variable.of('a'));
    const b = g.add(Variable.of('b'));
    g.union(a, b);
    g.rebuild();
    // Whichever of a, b is not the canonical one — classNodes should still resolve.
    const nodes = g.classNodes(a);
    assert.strictEqual(nodes.length, 2);
  });

});


describe('EGraph: addNode (low-level)', function() {

  it('inserts e-nodes directly', function() {
    const g = new EGraph();
    const a = g.addNode({ op: 'v:a', children: [] });
    const b = g.addNode({ op: 'v:b', children: [] });
    const fab = g.addNode({ op: 'f:f', children: [a, b] });
    assert.notStrictEqual(a, b);
    assert.notStrictEqual(a, fab);
  });

  it('dedupes e-nodes using canonical child ids', function() {
    const g = new EGraph();
    const a = g.addNode({ op: 'v:a', children: [] });
    const b = g.addNode({ op: 'v:b', children: [] });
    const fa1 = g.addNode({ op: 'f:f', children: [a] });
    g.union(a, b);
    g.rebuild();
    // Adding f(b) after a=b should return the same id as f(a).
    const fb = g.addNode({ op: 'f:f', children: [b] });
    assert.strictEqual(g.find(fb), g.find(fa1));
  });

});
