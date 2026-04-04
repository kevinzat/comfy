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
  conditions: Formula[];
}

export interface PolarizedCandidate extends RewriteCandidate {
  positive: boolean;
}

function isPolarized(c: RewriteCandidate): c is PolarizedCandidate {
  return 'positive' in c;
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
  abstract tryMatch(node: Expression): { replacement: Expression; conditions: Formula[] } | undefined;

  /**
   * Enumerates all single-replacement candidates. The default implementation
   * walks the expression tree and calls tryMatch() at each node.
   */
  enumerate(): RewriteCandidate[] {
    return this.enumerateIn(this.ex);
  }

  /** Validates conditions on the chosen candidate. Override if needed. */
  validateConditions(conditions: Formula[]): void {
    if (conditions.length > 0) {
      throw new UserError(
        `${this.label}: unexpected condition ${conditions[0].to_string()}`);
    }
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

    if (chosen.conditions.length > 0) {
      this.validateConditions(chosen.conditions);
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
      candidates.push({ result: match.replacement, conditions: match.conditions });
    }

    if (ex.variety === EXPR_FUNCTION) {
      for (let i = 0; i < ex.args.length; i++) {
        for (const c of this.enumerateIn(ex.args[i])) {
          const newArgs = ex.args.slice();
          newArgs[i] = c.result;
          candidates.push({
            result: new Call(ex.name, newArgs),
            conditions: c.conditions,
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
      candidates.push({ result: match.replacement, positive, conditions: match.conditions });
    }

    if (ex.variety !== EXPR_FUNCTION) return candidates;

    if (ex.name === FUNC_ADD) {
      for (let i = 0; i < ex.args.length; i++) {
        for (const c of this.enumerateWithPolarity(ex.args[i], positive)) {
          const newArgs = ex.args.slice();
          newArgs[i] = c.result;
          candidates.push({ result: new Call(ex.name, newArgs), positive: c.positive, conditions: c.conditions });
        }
      }
    } else if (ex.name === FUNC_SUBTRACT && ex.args.length === 2) {
      for (const c of this.enumerateWithPolarity(ex.args[0], positive)) {
        candidates.push({
          result: new Call(ex.name, [c.result, ex.args[1]]),
          positive: c.positive, conditions: c.conditions,
        });
      }
      for (const c of this.enumerateWithPolarity(ex.args[1], !positive)) {
        candidates.push({
          result: new Call(ex.name, [ex.args[0], c.result]),
          positive: c.positive, conditions: c.conditions,
        });
      }
    } else if (ex.name === FUNC_NEGATE && ex.args.length === 1) {
      for (const c of this.enumerateWithPolarity(ex.args[0], !positive)) {
        candidates.push({ result: new Call(ex.name, [c.result]), positive: c.positive, conditions: c.conditions });
      }
    } else if (ex.name === FUNC_MULTIPLY && ex.args.length === 2) {
      const [a, b] = ex.args;
      if (a.variety === EXPR_CONSTANT) {
        const childPositive = a.value >= 0n ? positive : !positive;
        for (const c of this.enumerateWithPolarity(b, childPositive)) {
          candidates.push({ result: new Call(ex.name, [a, c.result]), positive: c.positive, conditions: c.conditions });
        }
      } else if (b.variety === EXPR_CONSTANT) {
        const childPositive = b.value >= 0n ? positive : !positive;
        for (const c of this.enumerateWithPolarity(a, childPositive)) {
          candidates.push({ result: new Call(ex.name, [c.result, b]), positive: c.positive, conditions: c.conditions });
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
    return node.equals(this.from) ? { replacement: this.to, conditions: [] } : undefined;
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
    return node.equals(this.from) ? { replacement: this.to, conditions: [] } : undefined;
  }

  /** Whether the chosen match was at a positive position. */
  get positive(): boolean {
    if (this._chosen === undefined || !isPolarized(this._chosen)) throw new Error('unreachable');
    return this._chosen.positive;
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
  conditions: Formula[],
): {
  matchSide: Expression;
  replSide: Expression;
  freeVars: Set<string>;
  conditionsFreshened: [Expression, Expression][];
  conditionOps: FormulaOp[];
} {
  const origMatch = right ? formula.left : formula.right;
  const origRepl = right ? formula.right : formula.left;
  const origVars = new Set(
    origMatch.var_refs().filter(v => !env.hasConstructor(v)));

  const toFreshen = [origMatch, origRepl];
  for (const c of conditions) {
    toFreshen.push(c.left, c.right);
  }
  const [freshened, freeVars] = FreshenVarsMany(toFreshen, origVars);

  const conditionsFreshened: [Expression, Expression][] = conditions.map(
    (_, i) => [freshened[2 + i * 2], freshened[2 + i * 2 + 1]]);

  return {
    matchSide: freshened[0],
    replSide: freshened[1],
    freeVars,
    conditionsFreshened,
    conditionOps: conditions.map(c => c.op),
  };
}

function unifyTryMatch(
  node: Expression,
  matchSide: Expression,
  replSide: Expression,
  freeVars: Set<string>,
  conditionsFreshened: [Expression, Expression][],
  conditionOps: FormulaOp[],
): { replacement: Expression; conditions: Formula[] } | undefined {
  const subst = UnifyExprs(node, matchSide, freeVars);
  if (subst === undefined) return undefined;
  const replacement = ApplySubst(replSide, subst);
  const conditions = conditionsFreshened.map((pair, i) =>
    new Formula(ApplySubst(pair[0], subst), conditionOps[i], ApplySubst(pair[1], subst)));
  return { replacement, conditions };
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
  private conditionsFreshened: [Expression, Expression][];
  private conditionOps: FormulaOp[];
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
    const u = setupUnification(env, defFormula, right, condition ? [condition] : []);
    this.matchSide = u.matchSide;
    this.replSide = u.replSide;
    this.freeVars = u.freeVars;
    this.conditionsFreshened = u.conditionsFreshened;
    this.conditionOps = u.conditionOps;
  }

  tryMatch(node: Expression) {
    return unifyTryMatch(node, this.matchSide, this.replSide, this.freeVars,
        this.conditionsFreshened, this.conditionOps);
  }

  validateConditions(conditions: Formula[]): void {
    validateWithInequalityImplied(this.label, this.knownFacts, conditions[0]);
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
  private conditionsFreshened: [Expression, Expression][];
  private conditionOps: FormulaOp[];
  private knownFacts: Formula[];

  constructor(
    label: string,
    env: { hasConstructor(name: string): boolean },
    ex: Expression,
    conclusion: Formula,
    right: boolean,
    premises: Formula[],
    knownFacts: Formula[],
  ) {
    super(label, ex);
    this.knownFacts = knownFacts;
    const u = setupUnification(env, conclusion, right, premises);
    this.matchSide = u.matchSide;
    this.replSide = u.replSide;
    this.freeVars = u.freeVars;
    this.conditionsFreshened = u.conditionsFreshened;
    this.conditionOps = u.conditionOps;
  }

  tryMatch(node: Expression) {
    return unifyTryMatch(node, this.matchSide, this.replSide, this.freeVars,
        this.conditionsFreshened, this.conditionOps);
  }

  validateConditions(conditions: Formula[]): void {
    for (const condition of conditions) {
      validatePremise(this.label, this.knownFacts, condition);
    }
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
  private conditionsFreshened: [Expression, Expression][];
  private conditionOps: FormulaOp[];
  private knownFacts: Formula[];

  constructor(
    label: string,
    env: { hasConstructor(name: string): boolean },
    ex: Expression,
    conclusion: Formula,
    right: boolean,
    premises: Formula[],
    knownFacts: Formula[],
  ) {
    super(label, ex);
    this.knownFacts = knownFacts;
    const u = setupUnification(env, conclusion, right, premises);
    this.matchSide = u.matchSide;
    this.replSide = u.replSide;
    this.freeVars = u.freeVars;
    this.conditionsFreshened = u.conditionsFreshened;
    this.conditionOps = u.conditionOps;
  }

  tryMatch(node: Expression) {
    return unifyTryMatch(node, this.matchSide, this.replSide, this.freeVars,
        this.conditionsFreshened, this.conditionOps);
  }

  /** Whether the chosen match was at a positive position. */
  get positive(): boolean {
    if (this._chosen === undefined || !isPolarized(this._chosen)) throw new Error('unreachable');
    return this._chosen.positive;
  }

  enumerate(): PolarizedCandidate[] {
    return this.enumerateWithPolarity(this.ex, true);
  }

  validateConditions(conditions: Formula[]): void {
    for (const condition of conditions) {
      validatePremise(this.label, this.knownFacts, condition);
    }
  }
}
