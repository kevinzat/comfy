import * as assert from 'assert';
import { Constant, Variable, Call } from './exprs';
import { Formula, subst_formula } from './formula';
import { AtomProp, NotProp, OrProp, ConstProp } from './prop';

const x = Variable.of("x");
const y = Variable.of("y");
const one = Constant.of(1n);
const two = Constant.of(2n);

// x = 1
const f_x_eq_1 = new Formula(x, '=', one);
// y < x
const f_y_lt_x = new Formula(y, '<', x);


describe('subst_formula', function() {

  it('substitutes in left side', function() {
    const result = subst_formula(f_x_eq_1, x, two);
    assert.strictEqual(result.left.to_string(), "2");
    assert.strictEqual(result.right.to_string(), "1");
    assert.strictEqual(result.op, '=');
  });

  it('substitutes in right side', function() {
    const result = subst_formula(f_y_lt_x, x, two);
    assert.strictEqual(result.left.to_string(), "y");
    assert.strictEqual(result.right.to_string(), "2");
    assert.strictEqual(result.op, '<');
  });

  it('substitutes in both sides', function() {
    const result = subst_formula(f_y_lt_x, y, Call.add(x, one));
    assert.strictEqual(result.left.to_string(), "x + 1");
    assert.strictEqual(result.right.to_string(), "x");
  });

  it('returns same object when nothing changes', function() {
    const result = subst_formula(f_x_eq_1, y, two);
    assert.strictEqual(result, f_x_eq_1);
  });

});


describe('Prop.subst', function() {

  it('AtomProp substitutes in formula', function() {
    const p = new AtomProp(f_x_eq_1);
    const result = p.subst(x, two);
    assert.ok(result instanceof AtomProp);
    assert.strictEqual(result.formula.left.to_string(), "2");
    assert.strictEqual(result.formula.right.to_string(), "1");
  });

  it('AtomProp returns same object when nothing changes', function() {
    const p = new AtomProp(f_x_eq_1);
    const result = p.subst(y, two);
    assert.strictEqual(result, p);
  });

  it('NotProp substitutes in formula', function() {
    const p = new NotProp(f_y_lt_x);
    const result = p.subst(x, two);
    assert.ok(result instanceof NotProp);
    assert.strictEqual(result.formula.right.to_string(), "2");
  });

  it('NotProp returns same object when nothing changes', function() {
    const p = new NotProp(f_x_eq_1);
    const result = p.subst(y, two);
    assert.strictEqual(result, p);
  });

  it('OrProp substitutes in all disjuncts', function() {
    const p = new OrProp([new AtomProp(f_x_eq_1), new NotProp(f_y_lt_x)]);
    const result = p.subst(x, two);
    assert.ok(result instanceof OrProp);
    assert.strictEqual(result.disjuncts[0].formula.left.to_string(), "2");
    assert.strictEqual(result.disjuncts[1].formula.right.to_string(), "2");
  });

  it('OrProp returns same object when nothing changes', function() {
    const p = new OrProp([new AtomProp(f_x_eq_1)]);
    const result = p.subst(y, two);
    assert.strictEqual(result, p);
  });

  it('ConstProp returns same object', function() {
    const p = new ConstProp(true);
    const result = p.subst(x, two);
    assert.strictEqual(result, p);
  });

});


describe('Prop.vars', function() {

  it('AtomProp.vars returns variables from both sides', function() {
    const p = new AtomProp(f_y_lt_x);
    assert.deepStrictEqual(p.vars(), new Set(['y', 'x']));
  });

  it('NotProp.vars returns variables from both sides', function() {
    const p = new NotProp(f_y_lt_x);
    assert.deepStrictEqual(p.vars(), new Set(['y', 'x']));
  });

  it('OrProp.vars returns variables from all disjuncts', function() {
    const p = new OrProp([new AtomProp(f_x_eq_1), new NotProp(f_y_lt_x)]);
    assert.deepStrictEqual(p.vars(), new Set(['x', 'y']));
  });

  it('ConstProp.vars returns empty set', function() {
    const p = new ConstProp(true);
    assert.deepStrictEqual(p.vars(), new Set());
  });

});


describe('Prop.equivalent', function() {

  it('AtomProp equivalent to itself', function() {
    const p = new AtomProp(f_x_eq_1);
    assert.ok(p.equivalent(new AtomProp(f_x_eq_1)));
  });

  it('AtomProp not equivalent with different formula', function() {
    const p = new AtomProp(f_x_eq_1);
    assert.ok(!p.equivalent(new AtomProp(f_y_lt_x)));
  });

  it('AtomProp not equivalent to NotProp with equality', function() {
    const p = new AtomProp(f_x_eq_1);
    assert.ok(!p.equivalent(new NotProp(f_x_eq_1)));
  });

  it('AtomProp(x <= y) equivalent to NotProp(y < x)', function() {
    // not (y < x) means x <= y
    const p = new AtomProp(new Formula(x, '<=', y));
    assert.ok(p.equivalent(new NotProp(new Formula(y, '<', x))));
  });

  it('AtomProp(x < y) equivalent to NotProp(y <= x)', function() {
    // not (y <= x) means x < y
    const p = new AtomProp(new Formula(x, '<', y));
    assert.ok(p.equivalent(new NotProp(new Formula(y, '<=', x))));
  });

  it('AtomProp(x <= y) not equivalent to NotProp(x < y)', function() {
    // sides not swapped — not equivalent
    const p = new AtomProp(new Formula(x, '<=', y));
    assert.ok(!p.equivalent(new NotProp(new Formula(x, '<', y))));
  });

  it('NotProp equivalent to itself', function() {
    const p = new NotProp(f_y_lt_x);
    assert.ok(p.equivalent(new NotProp(f_y_lt_x)));
  });

  it('NotProp not equivalent with different formula', function() {
    const p = new NotProp(f_x_eq_1);
    assert.ok(!p.equivalent(new NotProp(f_y_lt_x)));
  });

  it('NotProp(y < x) equivalent to AtomProp(x <= y)', function() {
    const p = new NotProp(new Formula(y, '<', x));
    assert.ok(p.equivalent(new AtomProp(new Formula(x, '<=', y))));
  });

  it('NotProp(y <= x) equivalent to AtomProp(x < y)', function() {
    const p = new NotProp(new Formula(y, '<=', x));
    assert.ok(p.equivalent(new AtomProp(new Formula(x, '<', y))));
  });

  it('NotProp(x = y) not equivalent to AtomProp', function() {
    const p = new NotProp(f_x_eq_1);
    assert.ok(!p.equivalent(new AtomProp(f_x_eq_1)));
  });

  it('NotProp(x = y) equivalent to OrProp(x < y or y < x)', function() {
    const p = new NotProp(new Formula(x, '=', y));
    const or = new OrProp([
      new AtomProp(new Formula(x, '<', y)),
      new AtomProp(new Formula(y, '<', x)),
    ]);
    assert.ok(p.equivalent(or));
  });

  it('NotProp(x = y) equivalent to OrProp in reverse order', function() {
    const p = new NotProp(new Formula(x, '=', y));
    const or = new OrProp([
      new AtomProp(new Formula(y, '<', x)),
      new AtomProp(new Formula(x, '<', y)),
    ]);
    assert.ok(p.equivalent(or));
  });

  it('NotProp(x < y) not equivalent to OrProp', function() {
    const p = new NotProp(f_y_lt_x);
    const or = new OrProp([new AtomProp(f_x_eq_1)]);
    assert.ok(!p.equivalent(or));
  });

  it('OrProp(x < y or y < x) equivalent to NotProp(x = y)', function() {
    const or = new OrProp([
      new AtomProp(new Formula(x, '<', y)),
      new AtomProp(new Formula(y, '<', x)),
    ]);
    const p = new NotProp(new Formula(x, '=', y));
    assert.ok(or.equivalent(p));
  });

  it('OrProp equivalent regardless of order', function() {
    const a = new AtomProp(f_x_eq_1);
    const b = new NotProp(f_y_lt_x);
    const p1 = new OrProp([a, b]);
    const p2 = new OrProp([new NotProp(f_y_lt_x), new AtomProp(f_x_eq_1)]);
    assert.ok(p1.equivalent(p2));
  });

  it('OrProp not equivalent with different disjuncts', function() {
    const p1 = new OrProp([new AtomProp(f_x_eq_1)]);
    const p2 = new OrProp([new NotProp(f_y_lt_x)]);
    assert.ok(!p1.equivalent(p2));
  });

  it('OrProp not equivalent with different length', function() {
    const a = new AtomProp(f_x_eq_1);
    const p1 = new OrProp([a]);
    const p2 = new OrProp([a, new NotProp(f_y_lt_x)]);
    assert.ok(!p1.equivalent(p2));
  });

  it('ConstProp equivalent with same value', function() {
    assert.ok(new ConstProp(true).equivalent(new ConstProp(true)));
    assert.ok(new ConstProp(false).equivalent(new ConstProp(false)));
  });

  it('ConstProp not equivalent with different value', function() {
    assert.ok(!new ConstProp(true).equivalent(new ConstProp(false)));
  });

  it('different tags are not equivalent', function() {
    assert.ok(!new AtomProp(f_x_eq_1).equivalent(new ConstProp(true)));
    assert.ok(!new NotProp(f_y_lt_x).equivalent(new ConstProp(true)));
    assert.ok(!new ConstProp(true).equivalent(new AtomProp(f_x_eq_1)));
    assert.ok(!new OrProp([new AtomProp(f_x_eq_1)]).equivalent(new AtomProp(f_x_eq_1)));
  });

});


describe('Prop.to_string', function() {

  it('AtomProp.to_string delegates to formula', function() {
    const p = new AtomProp(f_x_eq_1);
    assert.strictEqual(p.to_string(), 'x = 1');
  });

  it('NotProp.to_string prepends "not "', function() {
    const p = new NotProp(f_x_eq_1);
    assert.strictEqual(p.to_string(), 'not x = 1');
  });

  it('OrProp.to_string joins disjuncts with " or "', function() {
    const p = new OrProp([new AtomProp(f_x_eq_1), new NotProp(f_y_lt_x)]);
    assert.strictEqual(p.to_string(), 'x = 1 or not y < x');
  });

  it('ConstProp.to_string returns "true" for true', function() {
    const p = new ConstProp(true);
    assert.strictEqual(p.to_string(), 'true');
  });

  it('ConstProp.to_string returns "false" for false', function() {
    const p = new ConstProp(false);
    assert.strictEqual(p.to_string(), 'false');
  });

});
