
import * as assert from 'assert';
import { Constant, Variable, Call } from '../facts/exprs';
import { FormulaOp } from '../facts/formula';
import { AtomProp, NotProp, OrProp, Prop } from '../facts/prop';
import { ParseCode } from '../lang/code_parser';
import { ProofObligation, oblKey, getProofObligations, TheoremObligation, getTheoremObligations, theoremToProofObligation } from './obligations';
import { DeclsAst } from '../lang/decls_ast';
import { TheoremAst } from '../lang/theorem_ast';
import { ParseDecls } from '../lang/decls_parser';
import { FuncDef, Param, DeclStmt, IfStmt, ReturnStmt, WhileStmt, RelAst, OrCondAst, NotCondAst } from '../lang/code_ast';
import { ConstProp } from '../facts/prop';

function propAtomEq(p: Prop, left: string | bigint, op: FormulaOp, right: string | bigint): boolean {
  if (p.tag !== 'atom') return false;
  const l = typeof left === 'bigint' ? Constant.of(left) : Variable.of(left);
  const r = typeof right === 'bigint' ? Constant.of(right) : Variable.of(right);
  const f = (p as AtomProp).formula;
  return f.left.equals(l) && f.op === op && f.right.equals(r);
}

function propNotEq(p: Prop, left: string | bigint, op: FormulaOp, right: string | bigint): boolean {
  if (p.tag !== 'not') return false;
  const l = typeof left === 'bigint' ? Constant.of(left) : Variable.of(left);
  const r = typeof right === 'bigint' ? Constant.of(right) : Variable.of(right);
  const f = (p as NotProp).formula;
  return f.left.equals(l) && f.op === op && f.right.equals(r);
}

function parse(src: string): ReturnType<typeof getProofObligations> {
  const { ast } = ParseCode(src);
  assert.ok(ast, 'parse failed');
  return getProofObligations(ast);
}

describe('getProofObligations', function() {

  it('produces no obligations when there are no ensures', function() {
    const obls = parse(`Int f(Int x) requires x >= 0 { return x; }`);
    assert.equal(obls.length, 0);
  });

  it('produces no obligations for empty body', function() {
    const obls = parse(`Int f(Int x) ensures x >= 0 { }`);
    assert.equal(obls.length, 0);
  });

  it('simple return: requires becomes premise, ensures becomes goal', function() {
    const obls = parse(`Int f(Int x) requires x >= 0 ensures rv >= 0 { return x; }`);
    assert.equal(obls.length, 1);
    assert.equal(obls[0].premises.length, 1);
    // requires: x >= 0 → AtomProp(Formula(0, '<=', x))
    assert.ok(propAtomEq(obls[0].premises[0], 0n, '<=', 'x'));
    // ensures: rv >= 0, after subst rv→x: AtomProp(Formula(0, '<=', x))
    assert.ok(propAtomEq(obls[0].goal, 0n, '<=', 'x'));
  });

  it('return with multiple ensures produces one obligation per ensures item', function() {
    const obls = parse(`Int f(Int x) requires x >= 0 ensures rv >= 0, rv <= 10 { return x; }`);
    assert.equal(obls.length, 2);
    // rv >= 0 after subst rv→x: AtomProp(Formula(0, '<=', x))
    assert.ok(propAtomEq(obls[0].goal, 0n, '<=', 'x'));
    // rv <= 10 after subst rv→x: AtomProp(Formula(x, '<=', 10))
    assert.ok(propAtomEq(obls[1].goal, 'x', '<=', 10n));
  });

  it('pass does not change the obligation', function() {
    const obls = parse(`Int f(Int x) ensures rv >= 0 { pass; return x; }`);
    assert.equal(obls.length, 1);
    assert.ok(propAtomEq(obls[0].goal, 0n, '<=', 'x'));
  });

  it('decl substitutes variable into goal', function() {
    const obls = parse(`Int f(Int x) ensures rv >= 0 { Int y = x; return y; }`);
    assert.equal(obls.length, 1);
    assert.ok(propAtomEq(obls[0].goal, 0n, '<=', 'x'));
  });

  it('assign substitutes variable into goal', function() {
    const obls = parse(`Int f(Int x) ensures rv >= 0 { Int y = 0; y = x; return y; }`);
    assert.equal(obls.length, 1);
    assert.ok(propAtomEq(obls[0].goal, 0n, '<=', 'x'));
  });

  it('if: then branch gets cond as premise', function() {
    const obls = parse(`
      Int f(Int x) ensures rv >= 0 {
        if (x >= 0) { return x; } else { return 0; }
      }`);
    assert.equal(obls.length, 2);

    // then branch: x >= 0 → AtomProp(Formula(0, '<=', x)) is premise, goal is x >= 0
    const thenObl = obls.find(o => o.premises.some(p => propAtomEq(p, 0n, '<=', 'x')));
    assert.ok(thenObl);
    assert.ok(propAtomEq(thenObl!.goal, 0n, '<=', 'x'));

    // else branch: not (x >= 0) → NotProp(Formula(0, '<=', x)), goal is 0 >= 0
    const elseObl = obls.find(o => o.premises.some(p => propNotEq(p, 0n, '<=', 'x')));
    assert.ok(elseObl);
    assert.ok(propAtomEq(elseObl!.goal, 0n, '<=', 0n));
  });

  it('while: produces after-loop, maintenance, and establishment obligations', function() {
    const obls = parse(`
      Int f(Int n) requires n >= 0 ensures rv >= 0 {
        while (n > 0) invariant n >= 0 { n = n - 1; }
        return n;
      }`);
    assert.equal(obls.length, 3);

    // establishment: requires implies invariant holds before loop
    const establishment = obls[0];
    assert.equal(establishment.premises.length, 1);
    assert.ok(propAtomEq(establishment.premises[0], 0n, '<=', 'n'));  // requires: n >= 0
    assert.ok(propAtomEq(establishment.goal, 0n, '<=', 'n'));

    // maintenance: cond + invariant implies invariant holds after body
    const maintenance = obls[1];
    assert.equal(maintenance.premises.length, 2);
    assert.ok(propAtomEq(maintenance.premises[0], 0n, '<', 'n'));   // cond: n > 0
    assert.ok(propAtomEq(maintenance.premises[1], 0n, '<=', 'n'));  // invariant: n >= 0
    // goal: invariant n >= 0 after subst n→n-1: AtomProp(Formula(0, '<=', n-1))
    assert.ok(maintenance.goal instanceof AtomProp);
    assert.ok((maintenance.goal as AtomProp).formula.left.equals(Constant.of(0n)));
    assert.equal((maintenance.goal as AtomProp).formula.op, '<=');
    assert.ok((maintenance.goal as AtomProp).formula.right.equals(
        Call.subtract(Variable.of('n'), Constant.of(1n))));

    // after-loop: invariant + not cond implies the goal from below the loop
    const afterLoop = obls[2];
    assert.equal(afterLoop.premises.length, 2);
    assert.ok(propAtomEq(afterLoop.premises[0], 0n, '<=', 'n'));  // invariant: n >= 0
    assert.ok(propNotEq(afterLoop.premises[1], 0n, '<', 'n'));    // not (n > 0)
    assert.ok(propAtomEq(afterLoop.goal, 0n, '<=', 'n'));
  });

  it('line number is set to return statement line', function() {
    const obls = parse(`Int f(Int x) requires x >= 0 ensures rv >= 0 { return x; }`);
    assert.equal(obls.length, 1);
    assert.equal(obls[0].line, 1);
  });

  it('params includes only function params that appear in the obligation', function() {
    const obls = parse(`Int f(Int x, Int y) ensures rv >= 0 { return x; }`);
    assert.equal(obls.length, 1);
    // y does not appear in the obligation
    assert.deepEqual(obls[0].params, [['x', 'Int']]);
  });

  it('params includes all params that appear across premises and goal', function() {
    const obls = parse(`Int f(Int x, Int y) requires x >= 0 ensures rv >= y { return x; }`);
    assert.equal(obls.length, 1);
    // premises: x >= 0 (x appears), goal: x >= y (x, y appear)
    assert.deepEqual(obls[0].params, [['x', 'Int'], ['y', 'Int']]);
  });

  it('decl before if: substitutes into premises (AtomProp and NotProp)', function() {
    // z is declared as x, then used in if condition — this forces substProp on premises
    const obls = parse(`
      Int f(Int x) ensures rv >= 0 {
        Int z = x;
        if (z >= 0) { return z; } else { return 0; }
      }`);
    // then branch: premise is z >= 0 (AtomProp), subst z→x gives x >= 0
    // else branch: premise is not(z >= 0) (NotProp), subst z→x gives not(x >= 0)
    assert.ok(obls.length >= 2);
    const thenObl = obls.find(o => o.premises.some(p => p.tag === 'atom' && propAtomEq(p, 0n, '<=', 'x')));
    assert.ok(thenObl, 'expected then branch obligation with AtomProp premise');
    const elseObl = obls.find(o => o.premises.some(p => p.tag === 'not' && propNotEq(p, 0n, '<=', 'x')));
    assert.ok(elseObl, 'expected else branch obligation with NotProp premise');
  });

  it('while with empty body: uses stmt.line for maintenance obligations', function() {
    const x = Variable.of('x');
    const zero = Constant.of(0n);
    const rv = Variable.of('rv');

    const cond = new RelAst(x, '>', zero);         // x > 0
    const invariant = new RelAst(x, '>=', zero);   // invariant x >= 0
    const whileStmt = new WhileStmt(cond, [invariant], [], 5);  // empty body, line 5
    const returnStmt = new ReturnStmt(x);
    const ensures = new RelAst(rv, '>=', zero);

    const func = new FuncDef('Int', 'f',
      [new Param('Int', 'x')],
      [whileStmt, returnStmt],
      [new RelAst(x, '>=', zero)],  // requires x >= 0
      [ensures],
    );

    const obls = getProofObligations(func);
    // Maintenance obligation should use stmt.line (5) since body is empty
    const maintenanceObl = obls.find(o => o.line === 5 && o.premises.length === 2);
    assert.ok(maintenanceObl, 'expected maintenance obligation at while stmt line');
  });

  it('ensures true: ConstProp goal passes through substProp', function() {
    // ensures true produces ConstProp(true) as goal; decl forces substProp on that goal
    const obls = parse(`Int f(Int x) ensures true { Int y = x; return y; }`);
    assert.equal(obls.length, 1);
    assert.equal(obls[0].goal.tag, 'const');
    assert.equal((obls[0].goal as any).value, true);
  });

});

describe('getProofObligations with OrProp premises', function() {

  it('or-condition in if: decl before if substitutes into OrProp premise', function() {
    // Build AST directly: function with Int z = x; if (z >= 0 || y >= 0) {...}
    // This creates OrProp in premises and forces substProp on it (lines 71 and 63/64)
    const x = Variable.of('x');
    const y = Variable.of('y');
    const z = Variable.of('z');
    const zero = Constant.of(0n);
    const rv = Variable.of('rv');

    const condA = new RelAst(z, '>=', zero);   // z >= 0
    const condB = new RelAst(y, '>=', zero);   // y >= 0
    const orCond = new OrCondAst(condA, condB); // z >= 0 || y >= 0

    const returnZ = new ReturnStmt(z);
    const returnZero = new ReturnStmt(zero);
    const ifStmt = new IfStmt(orCond, [returnZ], [returnZero]);
    const decl = new DeclStmt('Int', 'z', x);
    const ensures = new RelAst(rv, '>=', zero); // ensures rv >= 0

    const func = new FuncDef('Int', 'f',
      [new Param('Int', 'x'), new Param('Int', 'y')],
      [decl, ifStmt],
      [],        // requires
      [ensures], // ensures rv >= 0
    );

    const obls = getProofObligations(func);

    // Then branch has OrProp([AtomProp(0<=z), AtomProp(0<=y)]) as premise
    // after decl (z→x), OrProp([AtomProp(0<=x), AtomProp(0<=y)])
    const thenObl = obls.find(o => o.premises.some(p => p.tag === 'or'));
    assert.ok(thenObl, 'expected obligation with OrProp premise');
    const orPrem = thenObl!.premises.find(p => p.tag === 'or') as OrProp;
    assert.ok(orPrem.disjuncts.length >= 2);
  });

  it('not-or-condition in if else: decl substitutes into NotProp literal in OrProp', function() {
    // OrCondAst(NotCondAst(z>=0), y>=0) produces OrProp([NotProp(0<=z), AtomProp(0<=y)])
    // After decl z→x: OrProp([NotProp(0<=x), AtomProp(0<=y)]) — covers substLiteral NotProp branch
    const x = Variable.of('x');
    const y = Variable.of('y');
    const z = Variable.of('z');
    const zero = Constant.of(0n);
    const rv = Variable.of('rv');

    const condA = new RelAst(z, '>=', zero);   // z >= 0
    const condB = new RelAst(y, '>=', zero);   // y >= 0
    // not(z>=0) or (y>=0) — produces OrProp([NotProp, AtomProp])
    const orCond = new OrCondAst(new NotCondAst(condA), condB);

    const returnZ = new ReturnStmt(z);
    const returnZero = new ReturnStmt(zero);
    const ifStmt = new IfStmt(orCond, [returnZ], [returnZero]);
    const decl = new DeclStmt('Int', 'z', x);
    const ensures = new RelAst(rv, '>=', zero);

    const func = new FuncDef('Int', 'f',
      [new Param('Int', 'x'), new Param('Int', 'y')],
      [decl, ifStmt],
      [], [ensures],
    );

    const obls = getProofObligations(func);
    const thenObl = obls.find(o => o.premises.some(p => p.tag === 'or'));
    assert.ok(thenObl, 'expected obligation with OrProp premise');
    const orPrem = thenObl!.premises.find(p => p.tag === 'or') as OrProp;
    // Should have NotProp disjunct (covered substLiteral not-branch)
    assert.ok(orPrem.disjuncts.some(d => d.tag === 'not'));
  });

});

describe('oblKey', function() {

  it('returns consistent key for obligation with AtomProp goal', function() {
    const obls = parse(`Int f(Int x) requires x >= 0 ensures rv >= 0 { return x; }`);
    assert.equal(obls.length, 1);
    const key = oblKey(obls[0]);
    assert.ok(typeof key === 'string');
    assert.ok(key.includes('|'));
  });

  it('key includes premises and goal separated by pipe', function() {
    const obls = parse(`Int f(Int x) requires x >= 0 ensures rv >= 0 { return x; }`);
    const key = oblKey(obls[0]);
    const [premStr, goalStr] = key.split('|');
    assert.ok(premStr.length > 0 || goalStr.length > 0);
  });

  it('key includes NotProp (negated premise from else branch)', function() {
    const obls = parse(`
      Int f(Int x) ensures rv >= 0 {
        if (x >= 0) { return x; } else { return 0; }
      }`);
    // The else obligation has a NotProp premise
    const elseObl = obls.find(o => o.premises.some(p => p.tag === 'not'));
    assert.ok(elseObl);
    const key = oblKey(elseObl!);
    assert.ok(key.includes('!'));  // propStr uses '!' for NotProp
  });

  it('key includes ConstProp true (from ensures true)', function() {
    const obls = parse(`Int f(Int x) ensures true { return x; }`);
    assert.equal(obls.length, 1);
    const key = oblKey(obls[0]);
    assert.ok(key.includes('true'));
  });

  it('key includes ConstProp false', function() {
    const goal = new ConstProp(false);
    const obl = new ProofObligation([], goal, 1);
    const key = oblKey(obl);
    assert.ok(key.includes('false'));
  });

  it('key includes OrProp (from or-condition)', function() {
    const x = Variable.of('x');
    const y = Variable.of('y');
    const zero = Constant.of(0n);
    const rv = Variable.of('rv');

    const orCond = new OrCondAst(
      new RelAst(x, '>=', zero),
      new RelAst(y, '>=', zero),
    );
    const ifStmt = new IfStmt(orCond, [new ReturnStmt(x)], [new ReturnStmt(zero)]);
    const ensures = new RelAst(rv, '>=', zero);
    const func = new FuncDef('Int', 'f',
      [new Param('Int', 'x'), new Param('Int', 'y')],
      [ifStmt], [], [ensures],
    );
    const obls2 = getProofObligations(func);
    const orObl = obls2.find(o => o.premises.some(p => p.tag === 'or'));
    if (orObl) {
      const key = oblKey(orObl);
      assert.ok(key.includes('('));  // OrProp uses '(' in propStr
    }
  });

  it('same premises and goal produce same key', function() {
    const obls = parse(`Int f(Int x) requires x >= 0 ensures rv >= 0 { return x; }`);
    const key1 = oblKey(obls[0]);
    const key2 = oblKey(obls[0]);
    assert.strictEqual(key1, key2);
  });

});


describe('getTheoremObligations', function() {

  it('returns empty array for declarations with no theorems', function() {
    const decls = new DeclsAst([], [], []);
    const obls = getTheoremObligations(decls);
    assert.equal(obls.length, 0);
  });

  it('returns one obligation per theorem', function() {
    const { ast } = ParseDecls(`theorem foo (x : Int) | x = 0`);
    assert.ok(ast);
    const obls = getTheoremObligations(ast);
    assert.equal(obls.length, 1);
    assert.ok(obls[0] instanceof TheoremObligation);
    assert.equal(obls[0].theorem, ast.theorems[0]);
  });

  it('returns obligations in the same order as theorems', function() {
    const { ast } = ParseDecls(`theorem foo (x : Int) | x = 0\ntheorem bar (x : Int) | x = 0`);
    assert.ok(ast);
    const obls = getTheoremObligations(ast);
    assert.equal(obls.length, 2);
    assert.equal(obls[0].theorem, ast.theorems[0]);
    assert.equal(obls[1].theorem, ast.theorems[1]);
  });

  it('ignores types and functions in declarations', function() {
    const { ast } = ParseDecls(`theorem foo (x : Int) | x = 0`);
    assert.ok(ast);
    const declsWithOnlyTheorem = new DeclsAst([], [], ast.theorems);
    const obls = getTheoremObligations(declsWithOnlyTheorem);
    assert.equal(obls.length, 1);
  });

  it('obligation line matches the theorem declaration line', function() {
    const { ast } = ParseDecls(`theorem foo (x : Int) | x = 0`);
    assert.ok(ast);
    const obls = getTheoremObligations(ast);
    assert.equal(obls[0].line, 1);
  });

  it('obligation line is correct for theorem on a later line', function() {
    const { ast } = ParseDecls(`theorem foo (x : Int) | x = 0\ntheorem bar (x : Int) | x = 0`);
    assert.ok(ast);
    const obls = getTheoremObligations(ast);
    assert.equal(obls[1].line, 2);
  });

});

describe('theoremToProofObligation', function() {

  it('converts conclusion to goal using formulaToRel', function() {
    const { ast } = ParseDecls(`theorem foo (x : Int) | x = 0`);
    assert.ok(ast);
    const obl = theoremToProofObligation(ast.theorems[0]);
    assert.ok(propAtomEq(obl.goal, 'x', '=', 0n));
  });

  it('has no premises when theorem has no premise', function() {
    const { ast } = ParseDecls(`theorem foo (x : Int) | x = 0`);
    assert.ok(ast);
    const obl = theoremToProofObligation(ast.theorems[0]);
    assert.equal(obl.premises.length, 0);
  });

  it('converts premise to AtomProp when theorem has a premise', function() {
    const { ast } = ParseDecls(`theorem foo (x : Int) | 0 <= x => x = 0`);
    assert.ok(ast);
    const obl = theoremToProofObligation(ast.theorems[0]);
    assert.equal(obl.premises.length, 1);
    assert.ok(propAtomEq(obl.premises[0], 0n, '<=', 'x'));
  });

  it('params includes only theorem params that appear in premises or goal', function() {
    const { ast } = ParseDecls(`theorem foo (x, y : Int) | x = 0`);
    assert.ok(ast);
    const obl = theoremToProofObligation(ast.theorems[0]);
    // y does not appear in the goal
    assert.deepEqual(obl.params, [['x', 'Int']]);
  });

  it('preserves line number', function() {
    const { ast } = ParseDecls(`theorem foo (x : Int) | x = 0`);
    assert.ok(ast);
    const obl = theoremToProofObligation(ast.theorems[0]);
    assert.equal(obl.line, 1);
  });

});
