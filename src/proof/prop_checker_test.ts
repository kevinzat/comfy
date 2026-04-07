import * as assert from 'assert';
import { Prop, AtomProp, NotProp, OrProp, ConstProp } from '../facts/prop';
import { Formula, OP_LESS_THAN, OP_EQUAL } from '../facts/formula';
import { Variable } from '../facts/exprs';
import { checkPropProof, PropCheckError, PropProofNode } from './prop_checker';

const x = Variable.of('x');
const y = Variable.of('y');
const fLT = new Formula(x, OP_LESS_THAN, y);  // x < y
const fEQ = new Formula(x, OP_EQUAL, y);        // x = y

const atomLT = new AtomProp(fLT);   // x < y
const notLT  = new NotProp(fLT);    // not x < y
const atomEQ = new AtomProp(fEQ);   // x = y
const trueProp  = new ConstProp(true);
const falseProp = new ConstProp(false);

function shouldPass(goal: Prop, premises: Prop[], node: PropProofNode): void {
  checkPropProof(goal, premises, node);
}

function shouldFail(
    goal: Prop, premises: Prop[], node: PropProofNode, pattern: RegExp): void {
  assert.throws(() => checkPropProof(goal, premises, node),
    (e: unknown) => {
      assert.ok(e instanceof PropCheckError,
        `expected PropCheckError, got ${(e as Error).constructor.name}: ${(e as Error).message}`);
      assert.ok(pattern.test((e as Error).message),
        `expected message matching ${pattern}, got: ${(e as Error).message}`);
      return true;
    });
}


describe('verum', function() {

  it('proves ConstProp(true)', function() {
    shouldPass(trueProp, [], { kind: 'verum' });
  });

  it('proves ConstProp(true) even with irrelevant premises', function() {
    shouldPass(trueProp, [atomLT, notLT], { kind: 'verum' });
  });

  it('fails when goal is not true', function() {
    shouldFail(atomLT, [], { kind: 'verum' }, /verum/);
  });

  it('fails when goal is false', function() {
    shouldFail(falseProp, [], { kind: 'verum' }, /verum/);
  });
});


describe('ex falso', function() {

  it('proves anything when a premise is false', function() {
    shouldPass(atomLT, [falseProp], { kind: 'ex_falso', factIndex: 1 });
  });

  it('proves true when a premise is false', function() {
    shouldPass(trueProp, [falseProp], { kind: 'ex_falso', factIndex: 1 });
  });

  it('works with false in the middle of premises', function() {
    shouldPass(atomLT, [atomEQ, falseProp, notLT],
      { kind: 'ex_falso', factIndex: 2 });
  });

  it('fails when fact is not false', function() {
    shouldFail(atomLT, [trueProp], { kind: 'ex_falso', factIndex: 1 }, /ex falso/);
  });

  it('fails when fact is an atom, not false', function() {
    shouldFail(atomLT, [atomLT], { kind: 'ex_falso', factIndex: 1 }, /ex falso/);
  });

  it('fails when fact index is out of range', function() {
    shouldFail(atomLT, [falseProp], { kind: 'ex_falso', factIndex: 2 }, /out of range/);
  });
});


describe('contradiction', function() {

  it('proves anything from AtomProp and NotProp of same formula', function() {
    shouldPass(atomEQ, [atomLT, notLT], { kind: 'contradiction', factA: 1, factB: 2 });
  });

  it('works with NotProp before AtomProp', function() {
    shouldPass(atomEQ, [notLT, atomLT], { kind: 'contradiction', factA: 1, factB: 2 });
  });

  it('works with ConstProp(true) and ConstProp(false)', function() {
    shouldPass(atomEQ, [trueProp, falseProp], { kind: 'contradiction', factA: 1, factB: 2 });
  });

  it('works with ConstProp(false) and ConstProp(true)', function() {
    shouldPass(atomEQ, [falseProp, trueProp], { kind: 'contradiction', factA: 1, factB: 2 });
  });

  it('fails when facts are two atoms (no negation)', function() {
    shouldFail(atomEQ, [atomLT, atomEQ],
      { kind: 'contradiction', factA: 1, factB: 2 }, /contradiction/);
  });

  it('fails when facts are atoms of different formulas', function() {
    shouldFail(atomEQ, [atomLT, notLT],
      { kind: 'contradiction', factA: 1, factB: 3 }, /out of range/);
  });

  it('fails when the formulas differ', function() {
    const notEQ = new NotProp(fEQ);
    shouldFail(atomEQ, [atomLT, notEQ],
      { kind: 'contradiction', factA: 1, factB: 2 }, /contradiction/);
  });

  it('fails when fact index is out of range', function() {
    shouldFail(atomLT, [atomLT, notLT],
      { kind: 'contradiction', factA: 1, factB: 3 }, /out of range/);
  });
});


describe('cases', function() {

  it('splits on a 2-disjunct OR fact, each case proved by ex_falso', function() {
    // Premises: [false, x < y or x = y]
    // Goal: anything
    const orFact = new OrProp([atomLT, atomEQ]);
    shouldPass(atomEQ, [falseProp, orFact], {
      kind: 'cases',
      factIndex: 2,
      cases: [
        { proof: { kind: 'ex_falso', factIndex: 1 } },
        { proof: { kind: 'ex_falso', factIndex: 1 } },
      ],
    });
  });

  it('splits on a 3-disjunct OR fact', function() {
    const notEQ = new NotProp(fEQ);
    const orFact = new OrProp([atomLT, atomEQ, notEQ]);
    shouldPass(trueProp, [falseProp, orFact], {
      kind: 'cases',
      factIndex: 2,
      cases: [
        { proof: { kind: 'ex_falso', factIndex: 1 } },
        { proof: { kind: 'ex_falso', factIndex: 1 } },
        { proof: { kind: 'ex_falso', factIndex: 1 } },
      ],
    });
  });

  it('adds the disjunct as the last premise in each case', function() {
    // Premises: [x < y or x = y]
    // Case 1: [x < y or x = y, x < y] → contradiction between disjunct and not x < y
    // Case 2: [x < y or x = y, x = y] → contradiction between x = y and not x = y
    const orFact = new OrProp([atomLT, atomEQ]);
    // For this test, the disjunct added is the last premise
    // Case 1 has premises [orFact, atomLT], contradiction with notLT (doesn't exist...)
    // Let me use: premises [notLT, notEQ, orFact] and in each case use contradiction
    const notEQ = new NotProp(fEQ);
    shouldPass(trueProp, [notLT, notEQ, orFact], {
      kind: 'cases',
      factIndex: 3,
      cases: [
        // Case adds atomLT as premise 4; premises = [notLT, notEQ, orFact, atomLT]
        // contradiction: facts 1 (notLT) and 4 (atomLT)
        { proof: { kind: 'contradiction', factA: 1, factB: 4 } },
        // Case adds atomEQ as premise 4; premises = [notLT, notEQ, orFact, atomEQ]
        // contradiction: facts 2 (notEQ) and 4 (atomEQ)
        { proof: { kind: 'contradiction', factA: 2, factB: 4 } },
      ],
    });
  });

  it('supports nested cases', function() {
    // Premises: [P or Q, false]
    // Prove anything by nested cases
    const orFact = new OrProp([atomLT, atomEQ]);
    shouldPass(trueProp, [orFact, falseProp], {
      kind: 'cases',
      factIndex: 1,
      cases: [
        { proof: { kind: 'ex_falso', factIndex: 2 } },
        { proof: { kind: 'ex_falso', factIndex: 2 } },
      ],
    });
  });

  it('fails when fact is not an OR fact', function() {
    shouldFail(atomLT, [atomLT],
      { kind: 'cases', factIndex: 1, cases: [] }, /cases.*OR/);
  });

  it('fails when wrong number of cases', function() {
    const orFact = new OrProp([atomLT, atomEQ]);
    shouldFail(atomLT, [orFact], {
      kind: 'cases',
      factIndex: 1,
      cases: [{ proof: { kind: 'verum' } }],
    }, /expected 2 cases, got 1/);
  });

  it('fails when fact index is out of range', function() {
    shouldFail(atomLT, [],
      { kind: 'cases', factIndex: 1, cases: [] }, /out of range/);
  });

  it('fails when a sub-case proof is invalid', function() {
    const orFact = new OrProp([atomLT, atomEQ]);
    // Both cases try verum but goal is atomLT (not true)
    shouldFail(atomLT, [orFact], {
      kind: 'cases',
      factIndex: 1,
      cases: [
        { proof: { kind: 'verum' } },
        { proof: { kind: 'verum' } },
      ],
    }, /verum/);
  });
});
