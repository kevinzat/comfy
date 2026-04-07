
import * as assert from 'assert';
import { Constant, Variable, Call } from '../facts/exprs';
import { Formula } from '../facts/formula';
import { AtomProp, NotProp, OrProp, ConstProp } from '../facts/prop';
import { RelAst, TrueCondAst, FalseCondAst, AndCondAst, OrCondAst, NotCondAst, ClauseLiteral, clauseToProp, negRel, substRel, formulaToRel, relToFormula, condToProps } from './code_ast';

describe('negRel', function() {

  it('negates ==', function() {
    const cond = new RelAst(Variable.of('x'), '==', Constant.of(0n));
    const neg = negRel(cond);
    assert.equal(neg.op, '!=');
    assert.ok(neg.left.equals(Variable.of('x')));
    assert.ok(neg.right.equals(Constant.of(0n)));
  });

  it('negates !=', function() {
    const cond = new RelAst(Variable.of('x'), '!=', Constant.of(0n));
    assert.equal(negRel(cond).op, '==');
  });

  it('negates <', function() {
    const cond = new RelAst(Variable.of('x'), '<', Constant.of(0n));
    assert.equal(negRel(cond).op, '>=');
  });

  it('negates <=', function() {
    const cond = new RelAst(Variable.of('x'), '<=', Constant.of(0n));
    assert.equal(negRel(cond).op, '>');
  });

  it('negates >', function() {
    const cond = new RelAst(Variable.of('x'), '>', Constant.of(0n));
    assert.equal(negRel(cond).op, '<=');
  });

  it('negates >=', function() {
    const cond = new RelAst(Variable.of('x'), '>=', Constant.of(0n));
    assert.equal(negRel(cond).op, '<');
  });

  it('double negation returns original op', function() {
    for (const op of ['==', '!=', '<', '<=', '>', '>='] as const) {
      const cond = new RelAst(Variable.of('x'), op, Constant.of(0n));
      assert.equal(negRel(negRel(cond)).op, op);
    }
  });

  it('preserves left and right expressions', function() {
    const cond = new RelAst(Variable.of('a'), '<', Variable.of('b'));
    const neg = negRel(cond);
    assert.ok(neg.left.equals(Variable.of('a')));
    assert.ok(neg.right.equals(Variable.of('b')));
  });

});

describe('substRel', function() {

  it('substitutes variable in left expression', function() {
    const cond = new RelAst(Variable.of('x'), '<', Constant.of(10n));
    const result = substRel(cond, 'x', Constant.of(5n));
    assert.ok(result.left.equals(Constant.of(5n)));
    assert.ok(result.right.equals(Constant.of(10n)));
    assert.equal(result.op, '<');
  });

  it('substitutes variable in right expression', function() {
    const cond = new RelAst(Constant.of(0n), '<=', Variable.of('n'));
    const result = substRel(cond, 'n', Constant.of(3n));
    assert.ok(result.left.equals(Constant.of(0n)));
    assert.ok(result.right.equals(Constant.of(3n)));
  });

  it('substitutes in both sides', function() {
    const cond = new RelAst(Variable.of('x'), '==', Variable.of('x'));
    const result = substRel(cond, 'x', Constant.of(1n));
    assert.ok(result.left.equals(Constant.of(1n)));
    assert.ok(result.right.equals(Constant.of(1n)));
  });

  it('substitutes into compound expression', function() {
    const sum = Call.add(Variable.of('x'), Constant.of(1n));
    const cond = new RelAst(sum, '<', Constant.of(10n));
    const result = substRel(cond, 'x', Constant.of(4n));
    assert.ok(result.left.equals(Call.add(Constant.of(4n), Constant.of(1n))));
  });

  it('leaves unrelated variables unchanged', function() {
    const cond = new RelAst(Variable.of('y'), '>', Constant.of(0n));
    const result = substRel(cond, 'x', Constant.of(5n));
    assert.ok(result.left.equals(Variable.of('y')));
  });

  it('preserves op and line/col', function() {
    const cond = new RelAst(Variable.of('x'), '!=', Constant.of(0n), 7, 3);
    const result = substRel(cond, 'x', Constant.of(1n));
    assert.equal(result.op, '!=');
    assert.equal(result.line, 7);
    assert.equal(result.col, 3);
  });

});

describe('formulaToRel', function() {

  it('converts = to ==', function() {
    const f = new Formula(Variable.of('x'), '=', Constant.of(0n));
    const c = formulaToRel(f);
    assert.equal(c.op, '==');
    assert.ok(c.left.equals(Variable.of('x')));
    assert.ok(c.right.equals(Constant.of(0n)));
  });

  it('converts < to <', function() {
    const f = new Formula(Variable.of('x'), '<', Constant.of(1n));
    assert.equal(formulaToRel(f).op, '<');
  });

  it('converts <= to <=', function() {
    const f = new Formula(Variable.of('x'), '<=', Constant.of(1n));
    assert.equal(formulaToRel(f).op, '<=');
  });

  it('preserves left and right expressions', function() {
    const f = new Formula(Variable.of('a'), '=', Variable.of('b'));
    const c = formulaToRel(f);
    assert.ok(c.left.equals(Variable.of('a')));
    assert.ok(c.right.equals(Variable.of('b')));
  });

});

describe('clauseToProp', function() {

  const atom = new AtomProp(new Formula(Variable.of('x'), '=', Constant.of(0n)));
  const neg  = new NotProp(new Formula(Variable.of('x'), '=', Constant.of(0n)));

  it('single atom → that atom', function() {
    const result = clauseToProp([atom]);
    assert.ok(result instanceof AtomProp);
  });

  it('single not → that not', function() {
    const result = clauseToProp([neg]);
    assert.ok(result instanceof NotProp);
  });

  it('multiple atoms → OrProp', function() {
    const atom2 = new AtomProp(new Formula(Variable.of('y'), '<', Constant.of(1n)));
    const result = clauseToProp([atom, atom2]);
    assert.ok(result instanceof ConstProp === false);
    assert.ok('disjuncts' in result);
  });

  it('ConstProp(true) alone → ConstProp(true)', function() {
    const result = clauseToProp([new ConstProp(true)]);
    assert.ok(result instanceof ConstProp);
    assert.equal((result as ConstProp).value, true);
  });

  it('ConstProp(false) alone → ConstProp(false)', function() {
    const result = clauseToProp([new ConstProp(false)]);
    assert.ok(result instanceof ConstProp);
    assert.equal((result as ConstProp).value, false);
  });

  it('ConstProp(true) among others → ConstProp(true)', function() {
    const result = clauseToProp([new ConstProp(true), atom]);
    assert.ok(result instanceof ConstProp);
    assert.equal((result as ConstProp).value, true);
  });

  it('ConstProp(false) among others → others kept', function() {
    const result = clauseToProp([new ConstProp(false), atom]);
    assert.ok(result instanceof AtomProp);
  });

  it('ConstProp(false) with multiple others → OrProp of others', function() {
    const atom2 = new AtomProp(new Formula(Variable.of('y'), '<', Constant.of(1n)));
    const result = clauseToProp([new ConstProp(false), atom, atom2]);
    assert.ok('disjuncts' in result);
    assert.equal((result as any).disjuncts.length, 2);
  });

  it('all ConstProp(false) → ConstProp(false)', function() {
    const result = clauseToProp([new ConstProp(false), new ConstProp(false)]);
    assert.ok(result instanceof ConstProp);
    assert.equal((result as ConstProp).value, false);
  });

  it('empty clause → ConstProp(false)', function() {
    const result = clauseToProp([]);
    assert.ok(result instanceof ConstProp);
    assert.equal((result as ConstProp).value, false);
  });

});

describe('condToProps with constants', function() {

  it('true converts to [ConstProp(true)]', function() {
    const props = condToProps(new TrueCondAst());
    assert.equal(props.length, 1);
    const p = props[0];
    assert.ok(p instanceof ConstProp);
    assert.equal((p as ConstProp).value, true);
  });

  it('false converts to [ConstProp(false)]', function() {
    const props = condToProps(new FalseCondAst());
    assert.equal(props.length, 1);
    const p = props[0];
    assert.ok(p instanceof ConstProp);
    assert.equal((p as ConstProp).value, false);
  });

  it('not true converts to [ConstProp(false)]', function() {
    const props = condToProps(new NotCondAst(new TrueCondAst()));
    assert.equal(props.length, 1);
    const p = props[0];
    assert.ok(p instanceof ConstProp);
    assert.equal((p as ConstProp).value, false);
  });

  it('not false converts to [ConstProp(true)]', function() {
    const props = condToProps(new NotCondAst(new FalseCondAst()));
    assert.equal(props.length, 1);
    const p = props[0];
    assert.ok(p instanceof ConstProp);
    assert.equal((p as ConstProp).value, true);
  });

  it('true and x > 0 produces two props: ConstProp(true) and AtomProp', function() {
    const cond = new RelAst(Variable.of('x'), '>', Constant.of(0n));
    const props = condToProps(new AndCondAst(new TrueCondAst(), cond));
    assert.equal(props.length, 2);
    const constProp = props.find(p => p instanceof ConstProp) as ConstProp;
    assert.ok(constProp);
    assert.equal(constProp.value, true);
  });

  it('false or x > 0 simplifies to just AtomProp (false dropped from OR)', function() {
    const cond = new RelAst(Variable.of('x'), '>', Constant.of(0n));
    const props = condToProps(new OrCondAst(new FalseCondAst(), cond));
    assert.equal(props.length, 1);
    assert.ok(props[0] instanceof AtomProp);
  });

  it('true or x > 0 simplifies to ConstProp(true) (true absorbs OR)', function() {
    const cond = new RelAst(Variable.of('x'), '>', Constant.of(0n));
    const props = condToProps(new OrCondAst(new TrueCondAst(), cond));
    assert.equal(props.length, 1);
    assert.ok(props[0] instanceof ConstProp);
    assert.equal((props[0] as ConstProp).value, true);
  });

  it('not true or x > 0 simplifies to just AtomProp (not true = false, dropped from OR)', function() {
    const cond = new RelAst(Variable.of('x'), '>', Constant.of(0n));
    const props = condToProps(new OrCondAst(new NotCondAst(new TrueCondAst()), cond));
    assert.equal(props.length, 1);
    assert.ok(props[0] instanceof AtomProp);
  });

  it('not false or x > 0 simplifies to ConstProp(true) (not false = true, absorbs OR)', function() {
    const cond = new RelAst(Variable.of('x'), '>', Constant.of(0n));
    const props = condToProps(new OrCondAst(new NotCondAst(new FalseCondAst()), cond));
    assert.equal(props.length, 1);
    assert.ok(props[0] instanceof ConstProp);
    assert.equal((props[0] as ConstProp).value, true);
  });

});


describe('relToFormula', function() {

  it('converts == to = formula', function() {
    const cond = new RelAst(Variable.of('x'), '==', Constant.of(0n));
    const f = relToFormula(cond);
    assert.strictEqual(f.op, '=');
    assert.ok(f.left.equals(Variable.of('x')));
    assert.ok(f.right.equals(Constant.of(0n)));
  });

  it('converts < to < formula', function() {
    const cond = new RelAst(Variable.of('x'), '<', Constant.of(1n));
    const f = relToFormula(cond);
    assert.strictEqual(f.op, '<');
  });

  it('converts <= to <= formula', function() {
    const cond = new RelAst(Variable.of('x'), '<=', Constant.of(1n));
    const f = relToFormula(cond);
    assert.strictEqual(f.op, '<=');
  });

  it('converts > to < formula with swapped sides', function() {
    const cond = new RelAst(Variable.of('x'), '>', Constant.of(0n));
    const f = relToFormula(cond);
    assert.strictEqual(f.op, '<');
    assert.ok(f.left.equals(Constant.of(0n)));
    assert.ok(f.right.equals(Variable.of('x')));
  });

  it('converts >= to <= formula with swapped sides', function() {
    const cond = new RelAst(Variable.of('x'), '>=', Constant.of(0n));
    const f = relToFormula(cond);
    assert.strictEqual(f.op, '<=');
    assert.ok(f.left.equals(Constant.of(0n)));
    assert.ok(f.right.equals(Variable.of('x')));
  });

  it('throws for != condition', function() {
    const cond = new RelAst(Variable.of('x'), '!=', Constant.of(0n));
    assert.throws(() => relToFormula(cond), /Cannot convert/);
  });

});


describe('condToProps with == and < operators', function() {

  it('== produces AtomProp with = op', function() {
    const cond = new RelAst(Variable.of('x'), '==', Constant.of(0n));
    const props = condToProps(cond);
    assert.equal(props.length, 1);
    assert.ok(props[0] instanceof AtomProp);
    assert.equal((props[0] as AtomProp).formula.op, '=');
  });

  it('< produces AtomProp with < op', function() {
    const cond = new RelAst(Variable.of('x'), '<', Constant.of(5n));
    const props = condToProps(cond);
    assert.equal(props.length, 1);
    assert.ok(props[0] instanceof AtomProp);
    assert.equal((props[0] as AtomProp).formula.op, '<');
  });

});


describe('condToProps with != operator', function() {

  it('!= condition produces NotProp', function() {
    const cond = new RelAst(Variable.of('x'), '!=', Constant.of(0n));
    const props = condToProps(cond);
    assert.equal(props.length, 1);
    assert.ok(props[0] instanceof NotProp);
    assert.equal((props[0] as NotProp).formula.op, '=');
  });

  it('negated != produces AtomProp with = op', function() {
    const cond = new RelAst(Variable.of('x'), '!=', Constant.of(0n));
    const props = condToProps(new NotCondAst(cond));
    assert.equal(props.length, 1);
    assert.ok(props[0] instanceof AtomProp);
    assert.equal((props[0] as AtomProp).formula.op, '=');
  });

});


describe('condToProps with AND/OR and negation', function() {

  it('not(a and b) produces two clauses via de Morgan (distribute)', function() {
    const a = new RelAst(Variable.of('x'), '>', Constant.of(0n));
    const b = new RelAst(Variable.of('y'), '>', Constant.of(0n));
    // not(a and b) = not(a) or not(b) → one clause with two disjuncts
    const props = condToProps(new NotCondAst(new AndCondAst(a, b)));
    assert.equal(props.length, 1);
    // Should be OrProp([NotProp(x>0), NotProp(y>0)])
    assert.ok('disjuncts' in props[0]);
    const or = props[0] as OrProp;
    assert.equal(or.disjuncts.length, 2);
    assert.ok(or.disjuncts[0] instanceof NotProp);
    assert.ok(or.disjuncts[1] instanceof NotProp);
  });

  it('not(a or b) produces two separate clauses via de Morgan', function() {
    const a = new RelAst(Variable.of('x'), '>', Constant.of(0n));
    const b = new RelAst(Variable.of('y'), '>', Constant.of(0n));
    // not(a or b) = not(a) and not(b) → two clauses
    const props = condToProps(new NotCondAst(new OrCondAst(a, b)));
    assert.equal(props.length, 2);
    assert.ok(props[0] instanceof NotProp);
    assert.ok(props[1] instanceof NotProp);
  });

  it('(a or b) produces one OrProp clause', function() {
    const a = new RelAst(Variable.of('x'), '>', Constant.of(0n));
    const b = new RelAst(Variable.of('y'), '>', Constant.of(0n));
    const props = condToProps(new OrCondAst(a, b));
    assert.equal(props.length, 1);
    assert.ok('disjuncts' in props[0]);
  });

});
