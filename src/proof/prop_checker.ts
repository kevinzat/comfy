import { Prop } from '../facts/prop';

export class PropCheckError extends Error {
  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, PropCheckError.prototype);
  }
}

export interface VerumNode {
  kind: 'verum';
}

export interface ExFalsoNode {
  kind: 'ex_falso';
  factIndex: number;
}

export interface ContradictionNode {
  kind: 'contradiction';
  factA: number;
  factB: number;
}

export interface PropCaseBlock {
  proof: PropProofNode;
}

export interface CasesNode {
  kind: 'cases';
  factIndex: number;
  cases: PropCaseBlock[];
}

export type PropProofNode =
  | VerumNode
  | ExFalsoNode
  | ContradictionNode
  | CasesNode;

function getPremise(premises: Prop[], index: number): Prop {
  if (index < 1 || index > premises.length) {
    throw new PropCheckError(
        `fact ${index} is out of range (have ${premises.length} facts)`);
  }
  return premises[index - 1];
}

/** Returns true if a and b are a contradictory pair (P and not-P). */
function areContradictory(a: Prop, b: Prop): boolean {
  if (a.tag === 'atom' && b.tag === 'not') {
    return a.formula.to_string() === b.formula.to_string();
  }
  if (a.tag === 'not' && b.tag === 'atom') {
    return a.formula.to_string() === b.formula.to_string();
  }
  if (a.tag === 'const' && b.tag === 'const') {
    return a.value !== b.value;
  }
  return false;
}

function doCheck(goal: Prop, premises: Prop[], node: PropProofNode): void {
  if (node.kind === 'verum') {
    if (goal.tag !== 'const' || !goal.value) {
      throw new PropCheckError(`verum: goal must be true`);
    }

  } else if (node.kind === 'ex_falso') {
    const fact = getPremise(premises, node.factIndex);
    if (fact.tag !== 'const' || fact.value) {
      throw new PropCheckError(`ex falso: fact ${node.factIndex} must be false`);
    }

  } else if (node.kind === 'contradiction') {
    const factA = getPremise(premises, node.factA);
    const factB = getPremise(premises, node.factB);
    if (!areContradictory(factA, factB)) {
      throw new PropCheckError(
          `contradiction: facts ${node.factA} and ${node.factB} are not contradictory`);
    }

  } else {
    const fact = getPremise(premises, node.factIndex);
    if (fact.tag !== 'or') {
      throw new PropCheckError(
          `cases: fact ${node.factIndex} must be an OR fact`);
    }
    if (node.cases.length !== fact.disjuncts.length) {
      throw new PropCheckError(
          `cases: expected ${fact.disjuncts.length} cases, got ${node.cases.length}`);
    }
    for (let i = 0; i < fact.disjuncts.length; i++) {
      const casePremises = [...premises, fact.disjuncts[i]];
      doCheck(goal, casePremises, node.cases[i].proof);
    }
  }
}

/**
 * Checks a propositional proof, throwing PropCheckError on failure.
 *
 * @param goal     The proposition to prove.
 * @param premises The known facts (1-indexed).
 * @param node     The proof tree.
 */
export function checkPropProof(
    goal: Prop, premises: Prop[], node: PropProofNode): void {
  doCheck(goal, premises, node);
}
