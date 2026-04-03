
import * as assert from 'assert';
import { Constant, Variable, Call } from '../facts/exprs';
import { Formula } from '../facts/formula';
import { Cond, negCond, substCond, formulaToCond } from './code_ast';

describe('negCond', function() {

  it('negates ==', function() {
    const cond = new Cond(Variable.of('x'), '==', Constant.of(0n));
    const neg = negCond(cond);
    assert.equal(neg.op, '!=');
    assert.ok(neg.left.equals(Variable.of('x')));
    assert.ok(neg.right.equals(Constant.of(0n)));
  });

  it('negates !=', function() {
    const cond = new Cond(Variable.of('x'), '!=', Constant.of(0n));
    assert.equal(negCond(cond).op, '==');
  });

  it('negates <', function() {
    const cond = new Cond(Variable.of('x'), '<', Constant.of(0n));
    assert.equal(negCond(cond).op, '>=');
  });

  it('negates <=', function() {
    const cond = new Cond(Variable.of('x'), '<=', Constant.of(0n));
    assert.equal(negCond(cond).op, '>');
  });

  it('negates >', function() {
    const cond = new Cond(Variable.of('x'), '>', Constant.of(0n));
    assert.equal(negCond(cond).op, '<=');
  });

  it('negates >=', function() {
    const cond = new Cond(Variable.of('x'), '>=', Constant.of(0n));
    assert.equal(negCond(cond).op, '<');
  });

  it('double negation returns original op', function() {
    for (const op of ['==', '!=', '<', '<=', '>', '>='] as const) {
      const cond = new Cond(Variable.of('x'), op, Constant.of(0n));
      assert.equal(negCond(negCond(cond)).op, op);
    }
  });

  it('preserves left and right expressions', function() {
    const cond = new Cond(Variable.of('a'), '<', Variable.of('b'));
    const neg = negCond(cond);
    assert.ok(neg.left.equals(Variable.of('a')));
    assert.ok(neg.right.equals(Variable.of('b')));
  });

});

describe('substCond', function() {

  it('substitutes variable in left expression', function() {
    const cond = new Cond(Variable.of('x'), '<', Constant.of(10n));
    const result = substCond(cond, 'x', Constant.of(5n));
    assert.ok(result.left.equals(Constant.of(5n)));
    assert.ok(result.right.equals(Constant.of(10n)));
    assert.equal(result.op, '<');
  });

  it('substitutes variable in right expression', function() {
    const cond = new Cond(Constant.of(0n), '<=', Variable.of('n'));
    const result = substCond(cond, 'n', Constant.of(3n));
    assert.ok(result.left.equals(Constant.of(0n)));
    assert.ok(result.right.equals(Constant.of(3n)));
  });

  it('substitutes in both sides', function() {
    const cond = new Cond(Variable.of('x'), '==', Variable.of('x'));
    const result = substCond(cond, 'x', Constant.of(1n));
    assert.ok(result.left.equals(Constant.of(1n)));
    assert.ok(result.right.equals(Constant.of(1n)));
  });

  it('substitutes into compound expression', function() {
    const sum = Call.add(Variable.of('x'), Constant.of(1n));
    const cond = new Cond(sum, '<', Constant.of(10n));
    const result = substCond(cond, 'x', Constant.of(4n));
    assert.ok(result.left.equals(Call.add(Constant.of(4n), Constant.of(1n))));
  });

  it('leaves unrelated variables unchanged', function() {
    const cond = new Cond(Variable.of('y'), '>', Constant.of(0n));
    const result = substCond(cond, 'x', Constant.of(5n));
    assert.ok(result.left.equals(Variable.of('y')));
  });

  it('preserves op and line/col', function() {
    const cond = new Cond(Variable.of('x'), '!=', Constant.of(0n), 7, 3);
    const result = substCond(cond, 'x', Constant.of(1n));
    assert.equal(result.op, '!=');
    assert.equal(result.line, 7);
    assert.equal(result.col, 3);
  });

});

describe('formulaToCond', function() {

  it('converts = to ==', function() {
    const f = new Formula(Variable.of('x'), '=', Constant.of(0n));
    const c = formulaToCond(f);
    assert.equal(c.op, '==');
    assert.ok(c.left.equals(Variable.of('x')));
    assert.ok(c.right.equals(Constant.of(0n)));
  });

  it('converts < to <', function() {
    const f = new Formula(Variable.of('x'), '<', Constant.of(1n));
    assert.equal(formulaToCond(f).op, '<');
  });

  it('converts <= to <=', function() {
    const f = new Formula(Variable.of('x'), '<=', Constant.of(1n));
    assert.equal(formulaToCond(f).op, '<=');
  });

  it('preserves left and right expressions', function() {
    const f = new Formula(Variable.of('a'), '=', Variable.of('b'));
    const c = formulaToCond(f);
    assert.ok(c.left.equals(Variable.of('a')));
    assert.ok(c.right.equals(Variable.of('b')));
  });

});
