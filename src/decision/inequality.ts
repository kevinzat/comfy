import { Formula, FormulaOp, OP_EQUAL, OP_LESS_THAN, OP_LESS_EQUAL } from "../facts/formula";
import { Expression } from '../facts/exprs';
import { LinearEquation } from './smith';
import { LinearInequality, IsImplied } from './simplex';
import { _AddIndexes, _MakeEquation, _GetTerms, IsChainConnected } from './equation';


/**
 * Validates that a chain of formulas constitutes a valid inequality proof
 * for the given goal operator.
 *
 * - If goalOp is "=", no step may use "<" or "<=".
 * - If goalOp is "<", at least one step must use "<".
 * - If goalOp is "<=", steps may use any combination of "=", "<", "<=".
 *
 * Returns an error message or undefined if valid.
 */
export function IsInequalityChainValid(steps: Formula[], goalOp: FormulaOp): string | undefined {
  const connErr = IsChainConnected(steps);
  if (connErr !== undefined) return connErr;

  if (goalOp === OP_EQUAL) {
    for (let i = 0; i < steps.length; i++) {
      if (steps[i].op !== OP_EQUAL) {
        return `step ${i + 1} uses "${steps[i].op}" but equation proof requires all steps to use "="`;
      }
    }
  } else if (goalOp === OP_LESS_THAN) {
    const hasStrict = steps.some(s => s.op === OP_LESS_THAN);
    if (!hasStrict) {
      return `proof of "<" requires at least one step using "<"`;
    }
  }

  return undefined;
}


/**
 * Determines whether the goal equation or inequality is implied by the given
 * equations and inequalities. Each formula must use =, <, or <=.
 */
export function IsInequalityImplied(
    premises: Formula[], goal: Formula): boolean {

  // Normalize both sides of all predicates to put each in sum-of-products form.
  const premSides = premises.map(
      (p) => [p.left.normalize(), p.right.normalize()]);
  const goalSides = [goal.left.normalize(), goal.right.normalize()];

  // Index all of the terms appearing in any predicate.
  const indexes: Map<string, number> = new Map();
  for (const sides of premSides) {
    _AddIndexes(sides[0], indexes);
    _AddIndexes(sides[1], indexes);
  }
  _AddIndexes(goalSides[0], indexes);
  _AddIndexes(goalSides[1], indexes);

  // Split premises into equations and inequalities.
  const eqs: LinearEquation[] = [];
  const ineqs: LinearInequality[] = [];
  for (let i = 0; i < premises.length; i++) {
    const op = premises[i].op;
    const left = premSides[i][0];
    const right = premSides[i][1];

    if (op === OP_EQUAL) {
      eqs.push(_MakeEquation(left, right, indexes));
    } else if (op === OP_LESS_EQUAL) {
      // left <= right  =>  right - left >= 0
      ineqs.push(_MakeInequality(left, right, indexes, 0n));
    } else if (op === OP_LESS_THAN) {
      // left < right  =>  right - left >= 1
      ineqs.push(_MakeInequality(left, right, indexes, 1n));
    } else {
      throw new Error(`unsupported operator: ${op}`);
    }
  }

  // Build the goal.
  if (goal.op === OP_EQUAL) {
    // a = b  iff  a >= b and b >= a.
    const fwd = _MakeInequality(goalSides[1], goalSides[0], indexes, 0n);
    const bwd = _MakeInequality(goalSides[0], goalSides[1], indexes, 0n);
    return IsImplied(eqs, ineqs, fwd) && IsImplied(eqs, ineqs, bwd);
  } else if (goal.op === OP_LESS_EQUAL) {
    return IsImplied(eqs, ineqs, _MakeInequality(goalSides[0], goalSides[1], indexes, 0n));
  } else if (goal.op === OP_LESS_THAN) {
    return IsImplied(eqs, ineqs, _MakeInequality(goalSides[0], goalSides[1], indexes, 1n));
  } else {
    throw new Error(`unsupported goal operator: ${goal.op}`);
  }
}


/**
 * Returns a LinearInequality for (right - left >= minDiff).
 *
 * For left <= right, pass minDiff = 0 (right - left >= 0).
 * For left < right, pass minDiff = 1 (right - left >= 1).
 */
function _MakeInequality(
    left: Expression, right: Expression, indexes: Map<string, number>,
    minDiff: bigint): LinearInequality {

  const coefs = new Array<bigint>(indexes.size).fill(0n);
  let value = minDiff;

  // right - left >= minDiff, so right terms are positive, left terms negative.
  for (const term of _GetTerms(right)) {
    if (term[1] === undefined) {
      value -= term[0];
    } else {
      coefs[indexes.get(term[1])!] += term[0];
    }
  }

  for (const term of _GetTerms(left)) {
    if (term[1] === undefined) {
      value += term[0];
    } else {
      coefs[indexes.get(term[1])!] -= term[0];
    }
  }

  return {coefs, value};
}
