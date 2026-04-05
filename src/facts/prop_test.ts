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
