/**
 * Rewriters: enumerate single-replacement candidates in an expression tree,
 * select one, and optionally validate a condition.
 *
 * Steps (executed by rewrite()):
 * 1. Call enumerate() to find all positions where a rewrite can occur.
 * 2. If no expected result was given, require exactly one candidate.
 * 3. If an expected result was given, verify it matches one of the candidates.
 * 4. If the chosen candidate has a condition, call validateCondition().
 */

import {
  Call,
  Constant,
  Expression,
  EXPR_CONSTANT,
  EXPR_FUNCTION,
  FUNC_ADD,
  FUNC_SUBTRACT,
  FUNC_MULTIPLY,
  FUNC_NEGATE,
} from '../facts/exprs';
import { Formula, FormulaOp, OP_EQUAL } from '../facts/formula';
import { UnifyExprs, ApplySubst, FreshenVarsMany } from '../facts/unify';
import { IsEquationImplied } from '../decision/equation';
import { IsInequalityImplied } from '../decision/inequality';
import { UserError } from '../facts/user_error';


export interface RewriteCandidate {
  result: Expression;
  condition?: Formula;
}

export interface PolarizedCandidate extends RewriteCandidate {
  positive: boolean;
}


/**
 * Base class for rewriters. Subclasses implement tryMatch() and optionally
 * override enumerate() and validateCondition(). Call rewrite() to execute.
 *
 * The default enumerate() walks the full expression tree and calls tryMatch()
 * at each node. For polarity-aware traversal, subclasses can override
 * enumerate() and call enumerateWithPolarity().
 */
export abstract class Rewriter {
  protected label: string;
  protected ex: Expression;
  private _result?: Expression;
  protected _chosen?: RewriteCandidate;

  constructor(label: string, ex: Expression) {
    this.label = label;
    this.ex = ex;
  }

  /**
   * Tests whether a rewrite applies at this node. Returns the replacement
   * expression and an optional condition, or undefined if no match.
   */
  abstract tryMatch(node: Expression): { replacement: Expression; condition?: Formula } | undefined;

  /**
   * Enumerates all single-replacement candidates. The default implementation
   * walks the expression tree and calls tryMatch() at each node.
   */
  enumerate(): RewriteCandidate[] {
    return this.enumerateIn(this.ex);
  }

  /** Validates a condition on the chosen candidate. Override if needed. */
  validateCondition(condition: Formula): void {
    throw new UserError(
      `${this.label}: unexpected condition ${condition.to_string()}`);
  }

  /**
   * Executes the rewrite: enumerate, select, validate.
   * Returns the result expression.
   */
  rewrite(expectedResult?: Expression): Expression {
    const candidates = this.enumerate();

    if (candidates.length === 0) {
      throw new UserError(
        `${this.label}: no matches found in ${this.ex.to_string()}`);
    }

    let chosen: RewriteCandidate;
    if (expectedResult !== undefined) {
      const found = candidates.find(c => c.result.equals(expectedResult));
      if (!found) {
        throw new UserError(
          `${this.label}: provided result ${expectedResult.to_string()} cannot be produced`);
      }
      chosen = found;
    } else {
      if (candidates.length > 1) {
        throw new UserError(
          `${this.label}: multiple matches found; provide an explicit result`);
      }
      chosen = candidates[0];
    }

    if (chosen.condition !== undefined) {
      this.validateCondition(chosen.condition);
    }

    this._chosen = chosen;
    this._result = chosen.result;
    return this._result;
  }

  get result(): Expression {
    if (this._result === undefined) {
      throw new Error(`${this.label}: rewrite() has not been called`);
    }
    return this._result;
  }

  /**
   * Recursive helper: walks the subtree calling tryMatch() at each node.
   * For each match, produces a candidate with the full subtree having
   * only that one node replaced.
   */
  private enumerateIn(ex: Expression): RewriteCandidate[] {
    const candidates: RewriteCandidate[] = [];

    const match = this.tryMatch(ex);
    if (match !== undefined) {
      candidates.push({ result: match.replacement, condition: match.condition });
    }

    if (ex.variety === EXPR_FUNCTION) {
      const call = ex as Call;
      for (let i = 0; i < call.args.length; i++) {
        for (const c of this.enumerateIn(call.args[i])) {
          const newArgs = call.args.slice();
          newArgs[i] = c.result;
          candidates.push({
            result: new Call(call.name, newArgs),
            condition: c.condition,
          });
        }
      }
    }

    return candidates;
  }

  /**
   * Polarity-aware enumeration. Walks the expression tree tracking polarity
   * through arithmetic operators and calls tryMatch() at each node.
   *
   * Polarity rules:
   * - add: both args keep polarity
   * - subtract: first arg keeps polarity, second arg flips
   * - negate: flips polarity
   * - multiply by constant: keeps polarity if constant >= 0, flips if < 0
   * - exponentiation, user-defined functions: don't recurse
   */
  protected enumerateWithPolarity(ex: Expression, positive: boolean): PolarizedCandidate[] {
    const candidates: PolarizedCandidate[] = [];

    const match = this.tryMatch(ex);
    if (match) {
      candidates.push({ result: match.replacement, positive, condition: match.condition });
    }

    if (ex.variety !== EXPR_FUNCTION) return candidates;
    const call = ex as Call;

    if (call.name === FUNC_ADD) {
      for (let i = 0; i < call.args.length; i++) {
        for (const c of this.enumerateWithPolarity(call.args[i], positive)) {
          const newArgs = call.args.slice();
          newArgs[i] = c.result;
          candidates.push({ result: new Call(call.name, newArgs), positive: c.positive, condition: c.condition });
        }
      }
    } else if (call.name === FUNC_SUBTRACT && call.args.length === 2) {
      for (const c of this.enumerateWithPolarity(call.args[0], positive)) {
        candidates.push({
          result: new Call(call.name, [c.result, call.args[1]]),
          positive: c.positive, condition: c.condition,
        });
      }
      for (const c of this.enumerateWithPolarity(call.args[1], !positive)) {
        candidates.push({
          result: new Call(call.name, [call.args[0], c.result]),
          positive: c.positive, condition: c.condition,
        });
      }
    } else if (call.name === FUNC_NEGATE && call.args.length === 1) {
      for (const c of this.enumerateWithPolarity(call.args[0], !positive)) {
        candidates.push({ result: new Call(call.name, [c.result]), positive: c.positive, condition: c.condition });
      }
    } else if (call.name === FUNC_MULTIPLY && call.args.length === 2) {
      const [a, b] = call.args;
      if (a.variety === EXPR_CONSTANT) {
        const childPositive = (a as Constant).value >= 0n ? positive : !positive;
        for (const c of this.enumerateWithPolarity(b, childPositive)) {
          candidates.push({ result: new Call(call.name, [a, c.result]), positive: c.positive, condition: c.condition });
        }
      } else if (b.variety === EXPR_CONSTANT) {
        const childPositive = (b as Constant).value >= 0n ? positive : !positive;
        for (const c of this.enumerateWithPolarity(a, childPositive)) {
          candidates.push({ result: new Call(call.name, [c.result, b]), positive: c.positive, condition: c.condition });
        }
      }
    }

    return candidates;
  }
}


/**
 * Rewrites by exact match: replaces one occurrence of `from` with `to`.
 */
export class EquationRewriter extends Rewriter {
  private from: Expression;
  private to: Expression;

  constructor(label: string, ex: Expression, from: Expression, to: Expression) {
    super(label, ex);
    this.from = from;
    this.to = to;
  }

  tryMatch(node: Expression) {
    return node.equals(this.from) ? { replacement: this.to } : undefined;
  }
}


/**
 * Rewrites by exact match at a single positive or negative position.
 */
export class InequalityRewriter extends Rewriter {
  private from: Expression;
  private to: Expression;

  constructor(label: string, ex: Expression, from: Expression, to: Expression) {
    super(label, ex);
    this.from = from;
    this.to = to;
  }

  tryMatch(node: Expression) {
    return node.equals(this.from) ? { replacement: this.to } : undefined;
  }

  /** Whether the chosen match was at a positive position. */
  get positive(): boolean {
    return (this._chosen as PolarizedCandidate).positive;
  }

  enumerate(): PolarizedCandidate[] {
    return this.enumerateWithPolarity(this.ex, true);
  }
}


/**
 * Helper mixin: sets up unification-based matching with freshened variables
 * and optional condition checking. Used by DefinitionRewriter and the
 * theorem rewriters.
 */
function setupUnification(
  env: { hasConstructor(name: string): boolean },
  formula: Formula,
  right: boolean,
  condition: Formula | undefined,
): {
  matchSide: Expression;
  replSide: Expression;
  freeVars: Set<string>;
  conditionFreshened?: [Expression, Expression];
  conditionOp?: FormulaOp;
} {
  const origMatch = right ? formula.left : formula.right;
  const origRepl = right ? formula.right : formula.left;
  const origVars = new Set(
    origMatch.var_refs().filter(v => !env.hasConstructor(v)));

  const toFreshen = [origMatch, origRepl];
  if (condition) {
    toFreshen.push(condition.left, condition.right);
  }
  const [freshened, freeVars] = FreshenVarsMany(toFreshen, origVars);

  return {
    matchSide: freshened[0],
    replSide: freshened[1],
    freeVars,
    conditionFreshened: condition ? [freshened[2], freshened[3]] : undefined,
    conditionOp: condition?.op,
  };
}

function unifyTryMatch(
  node: Expression,
  matchSide: Expression,
  replSide: Expression,
  freeVars: Set<string>,
  conditionFreshened?: [Expression, Expression],
  conditionOp?: FormulaOp,
): { replacement: Expression; condition?: Formula } | undefined {
  const subst = UnifyExprs(node, matchSide, freeVars);
  if (subst === undefined) return undefined;
  const replacement = ApplySubst(replSide, subst);
  let condition: Formula | undefined;
  if (conditionFreshened) {
    const condLeft = ApplySubst(conditionFreshened[0], subst);
    const condRight = ApplySubst(conditionFreshened[1], subst);
    condition = new Formula(condLeft, conditionOp!, condRight);
  }
  return { replacement, condition };
}

function validateWithInequalityImplied(
  label: string, knownFacts: Formula[], condition: Formula,
): void {
  if (!IsInequalityImplied(knownFacts, condition)) {
    throw new UserError(
      `${label}: condition ${condition.to_string()} is not implied by the cited facts: ${knownFacts.map(f => f.to_string()).join(' | ')}`);
  }
}

function validatePremise(
  label: string, knownFacts: Formula[], condition: Formula,
): void {
  if (condition.op === OP_EQUAL) {
    if (!IsEquationImplied(knownFacts, condition)) {
      throw new UserError(
        `${label}: premise ${condition.to_string()} is not implied by the cited facts: ${knownFacts.map(f => f.to_string()).join(' | ')}`);
    }
  } else {
    if (!IsInequalityImplied(knownFacts, condition)) {
      throw new UserError(
        `${label}: premise ${condition.to_string()} is not implied by the cited facts: ${knownFacts.map(f => f.to_string()).join(' | ')}`);
    }
  }
}


/**
 * Rewrites by unification with a definition pattern. Uses the default
 * full tree walk. Conditions are checked with IsInequalityImplied.
 */
export class DefinitionRewriter extends Rewriter {
  private matchSide: Expression;
  private replSide: Expression;
  private freeVars: Set<string>;
  private conditionFreshened?: [Expression, Expression];
  private conditionOp?: FormulaOp;
  private knownFacts: Formula[];

  constructor(
    label: string,
    env: { hasConstructor(name: string): boolean },
    ex: Expression,
    defFormula: Formula,
    right: boolean,
    condition: Formula | undefined,
    knownFacts: Formula[],
  ) {
    super(label, ex);
    this.knownFacts = knownFacts;
    const u = setupUnification(env, defFormula, right, condition);
    this.matchSide = u.matchSide;
    this.replSide = u.replSide;
    this.freeVars = u.freeVars;
    this.conditionFreshened = u.conditionFreshened;
    this.conditionOp = u.conditionOp;
  }

  tryMatch(node: Expression) {
    return unifyTryMatch(node, this.matchSide, this.replSide, this.freeVars,
        this.conditionFreshened, this.conditionOp);
  }

  validateCondition(condition: Formula): void {
    validateWithInequalityImplied(this.label, this.knownFacts, condition);
  }
}


/**
 * Rewrites by unification with a theorem equation. Uses the default
 * full tree walk. Premises are checked with IsEquationImplied or
 * IsInequalityImplied depending on the premise type.
 */
export class TheoremEquationRewriter extends Rewriter {
  private matchSide: Expression;
  private replSide: Expression;
  private freeVars: Set<string>;
  private conditionFreshened?: [Expression, Expression];
  private conditionOp?: FormulaOp;
  private knownFacts: Formula[];

  constructor(
    label: string,
    env: { hasConstructor(name: string): boolean },
    ex: Expression,
    conclusion: Formula,
    right: boolean,
    premise: Formula | undefined,
    knownFacts: Formula[],
  ) {
    super(label, ex);
    this.knownFacts = knownFacts;
    const u = setupUnification(env, conclusion, right, premise);
    this.matchSide = u.matchSide;
    this.replSide = u.replSide;
    this.freeVars = u.freeVars;
    this.conditionFreshened = u.conditionFreshened;
    this.conditionOp = u.conditionOp;
  }

  tryMatch(node: Expression) {
    return unifyTryMatch(node, this.matchSide, this.replSide, this.freeVars,
        this.conditionFreshened, this.conditionOp);
  }

  validateCondition(condition: Formula): void {
    validatePremise(this.label, this.knownFacts, condition);
  }
}


/**
 * Rewrites by unification with a theorem inequality. Uses polarity-aware
 * tree walk. Premises are checked with IsEquationImplied or
 * IsInequalityImplied depending on the premise type.
 */
export class TheoremInequalityRewriter extends Rewriter {
  private matchSide: Expression;
  private replSide: Expression;
  private freeVars: Set<string>;
  private conditionFreshened?: [Expression, Expression];
  private conditionOp?: FormulaOp;
  private knownFacts: Formula[];

  constructor(
    label: string,
    env: { hasConstructor(name: string): boolean },
    ex: Expression,
    conclusion: Formula,
    right: boolean,
    premise: Formula | undefined,
    knownFacts: Formula[],
  ) {
    super(label, ex);
    this.knownFacts = knownFacts;
    const u = setupUnification(env, conclusion, right, premise);
    this.matchSide = u.matchSide;
    this.replSide = u.replSide;
    this.freeVars = u.freeVars;
    this.conditionFreshened = u.conditionFreshened;
    this.conditionOp = u.conditionOp;
  }

  tryMatch(node: Expression) {
    return unifyTryMatch(node, this.matchSide, this.replSide, this.freeVars,
        this.conditionFreshened, this.conditionOp);
  }

  /** Whether the chosen match was at a positive position. */
  get positive(): boolean {
    return (this._chosen as PolarizedCandidate).positive;
  }

  enumerate(): PolarizedCandidate[] {
    return this.enumerateWithPolarity(this.ex, true);
  }

  validateCondition(condition: Formula): void {
    validatePremise(this.label, this.knownFacts, condition);
  }
}
