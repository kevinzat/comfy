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
  Variable,
  EXPR_CONSTANT,
  EXPR_FUNCTION,
  FUNC_ADD,
  FUNC_SUBTRACT,
  FUNC_MULTIPLY,
  FUNC_NEGATE,
} from '../facts/exprs';
import { Formula, FormulaOp, OP_EQUAL, OP_LESS_THAN, OP_LESS_EQUAL } from '../facts/formula';
import { Prop, AtomProp, NotProp } from '../facts/prop';
import { UnifyExprs, ApplySubst, FreshVarName } from '../facts/unify';
import { IsEquationImplied } from '../decision/equation';
import { IsInequalityImplied } from '../decision/inequality';
import { UserError } from '../facts/user_error';
import { Environment } from '../types/env';
import { checkExpr } from '../types/checker';


export interface RewriteCandidate {
  result: Expression;
  conditions: Prop[];
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
  abstract tryMatch(node: Expression): { replacement: Expression; conditions: Prop[] } | undefined;

  /**
   * Enumerates all single-replacement candidates. The default implementation
   * walks the expression tree and calls tryMatch() at each node.
   */
  enumerate(): RewriteCandidate[] {
    return this.enumerateIn(this.ex);
  }

  /** Validates conditions on the chosen candidate. Override if needed. */
  validateConditions(conditions: Prop[]): void {
    if (conditions.length > 0) {
      throw new UserError(
        `${this.label}: unexpected condition ${conditions[0].to_string()}`,
        this.ex.line, this.ex.col, this.ex.tokenLength);
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
        `${this.label}: no matches found in ${this.ex.to_string()}`,
        this.ex.line, this.ex.col, this.ex.tokenLength);
    }

    let chosen: RewriteCandidate;
    if (expectedResult !== undefined) {
      const found = candidates.find(c => c.result.equals(expectedResult));
      if (!found) {
        throw new UserError(
          `${this.label}: provided result ${expectedResult.to_string()} cannot be produced`,
          this.ex.line, this.ex.col, this.ex.tokenLength);
      }
      chosen = found;
    } else {
      if (candidates.length > 1) {
        throw new UserError(
          `${this.label}: multiple matches found; provide an explicit result`,
          this.ex.line, this.ex.col, this.ex.tokenLength);
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
    /* v8 ignore start */
    if (this._chosen === undefined || !isPolarized(this._chosen)) {
      throw new Error('unreachable');
    }
    /* v8 ignore stop */
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
  conditions: Prop[],
): {
  matchSide: Expression;
  replSide: Expression;
  freeVars: Set<string>;
  conditionsFreshened: Prop[];
} {
  const origMatch = right ? formula.left : formula.right;
  const origRepl = right ? formula.right : formula.left;
  const origVars = new Set(
    origMatch.var_refs().filter(v => !env.hasConstructor(v)));

  // Freshen variables in both expressions and conditions together.
  let matchSide = origMatch;
  let replSide = origRepl;
  let conditionsFreshened = conditions;
  const freeVars = new Set<string>();
  for (const v of origVars) {
    const fresh = FreshVarName();
    freeVars.add(fresh);
    const vExpr = Variable.of(v);
    const freshExpr = Variable.of(fresh);
    matchSide = matchSide.subst(vExpr, freshExpr);
    replSide = replSide.subst(vExpr, freshExpr);
    conditionsFreshened = conditionsFreshened.map(c => c.subst(vExpr, freshExpr));
  }

  return { matchSide, replSide, freeVars, conditionsFreshened };
}

function applySubstProp(prop: Prop, subst: Map<string, Expression>): Prop {
  let r = prop;
  for (const [v, val] of subst) {
    r = r.subst(Variable.of(v), val);
  }
  return r;
}

function unifyTryMatch(
  node: Expression,
  matchSide: Expression,
  replSide: Expression,
  freeVars: Set<string>,
  conditionsFreshened: Prop[],
): { replacement: Expression; conditions: Prop[] } | undefined {
  const subst = UnifyExprs(node, matchSide, freeVars);
  if (subst === undefined) return undefined;
  const replacement = ApplySubst(replSide, subst);
  const conditions = conditionsFreshened.map(c => applySubstProp(c, subst));
  return { replacement, conditions };
}

/**
 * Converts a Prop to a Formula for use in implication checking.
 * AtomProp: returns the formula directly.
 * NotProp: negates the inequality (not (a < b) → b <= a, not (a <= b) → b < a).
 * Returns undefined for Props that cannot be converted.
 */
function propToFormula(prop: Prop): Formula | undefined {
  if (prop.tag === 'atom')
    return prop.formula;
  if (prop.tag === 'not') {
    const f = prop.formula;
    if (f.op === OP_LESS_THAN)
      return new Formula(f.right, OP_LESS_EQUAL, f.left);
    if (f.op === OP_LESS_EQUAL)
      return new Formula(f.right, OP_LESS_THAN, f.left);
  }
  return undefined;
}

/** Checks whether a single formula is implied by the known formulas. */
function isFormulaImplied(knownFormulas: Formula[], formula: Formula): boolean {
  if (formula.op === OP_EQUAL)
    return IsEquationImplied(knownFormulas, formula);
  return IsInequalityImplied(knownFormulas, formula);
}

/** Checks whether a condition is implied by the known facts. */
function isConditionImplied(
  env: Environment, knownFacts: Prop[], knownFormulas: Formula[],
  condition: Prop,
): boolean {
  // Exact match: condition is directly among known facts.
  if (knownFacts.some(k => k.equivalent(condition)))
    return true;

  // ConstProp: true is trivially satisfied, false is never.
  if (condition.tag === 'const')
    return condition.value;

  // OrProp: satisfied if any disjunct is implied.
  if (condition.tag === 'or')
    return condition.disjuncts.some(d =>
        isConditionImplied(env, knownFacts, knownFormulas, d));

  // Try converting to a formula for implication checking.
  const formula = propToFormula(condition);
  if (formula !== undefined)
    return isFormulaImplied(knownFormulas, formula);

  // NotProp(a = b) for Int: check a < b or b < a.
  /* v8 ignore start */
  if (condition.tag !== 'not' || condition.formula.op !== OP_EQUAL)
    throw new Error('unreachable');
  /* v8 ignore stop */
  const { left, right } = condition.formula;
  if (checkExpr(env, left).name === 'Int' && checkExpr(env, right).name === 'Int') {
    return isFormulaImplied(knownFormulas, new Formula(left, OP_LESS_THAN, right)) ||
        isFormulaImplied(knownFormulas, new Formula(right, OP_LESS_THAN, left));
  }

  return false;
}

function validateConditionsImplied(
  env: Environment, label: string, ex: Expression, knownFacts: Prop[], conditions: Prop[],
): void {
  const knownFormulas: Formula[] = [];
  for (const fact of knownFacts) {
    const f = propToFormula(fact);
    if (f !== undefined) knownFormulas.push(f);
  }

  for (const condition of conditions) {
    if (!isConditionImplied(env, knownFacts, knownFormulas, condition)) {
      throw new UserError(
        `${label}: premise ${condition.to_string()} is not implied by the cited facts: ${knownFacts.map(f => f.to_string()).join(' | ')}`,
        ex.line, ex.col, ex.tokenLength);
    }
  }
}


/**
 * Rewrites by unification with a definition pattern. Uses the default
 * full tree walk. Conditions are checked with IsInequalityImplied.
 */
export class DefinitionRewriter extends Rewriter {
  private env: Environment;
  private matchSide: Expression;
  private replSide: Expression;
  private freeVars: Set<string>;
  private conditionsFreshened: Prop[];
  private knownFacts: Prop[];

  constructor(
    label: string,
    env: Environment,
    ex: Expression,
    defFormula: Formula,
    right: boolean,
    conditions: Prop[],
    knownFacts: Prop[],
  ) {
    super(label, ex);
    this.env = env;
    this.knownFacts = knownFacts;
    const u = setupUnification(env, defFormula, right, conditions);
    this.matchSide = u.matchSide;
    this.replSide = u.replSide;
    this.freeVars = u.freeVars;
    this.conditionsFreshened = u.conditionsFreshened;
  }

  tryMatch(node: Expression) {
    return unifyTryMatch(node, this.matchSide, this.replSide, this.freeVars,
        this.conditionsFreshened);
  }

  validateConditions(conditions: Prop[]): void {
    validateConditionsImplied(this.env, this.label, this.ex, this.knownFacts, conditions);
  }
}


/**
 * Rewrites by unification with a theorem equation. Uses the default
 * full tree walk. Premises are checked with IsEquationImplied or
 * IsInequalityImplied depending on the premise type.
 */
export class TheoremEquationRewriter extends Rewriter {
  private env: Environment;
  private matchSide: Expression;
  private replSide: Expression;
  private freeVars: Set<string>;
  private conditionsFreshened: Prop[];
  private knownFacts: Prop[];

  constructor(
    label: string,
    env: Environment,
    ex: Expression,
    conclusion: Formula,
    right: boolean,
    premises: Prop[],
    knownFacts: Prop[],
  ) {
    super(label, ex);
    this.env = env;
    this.knownFacts = knownFacts;
    const u = setupUnification(env, conclusion, right, premises);
    this.matchSide = u.matchSide;
    this.replSide = u.replSide;
    this.freeVars = u.freeVars;
    this.conditionsFreshened = u.conditionsFreshened;
  }

  tryMatch(node: Expression) {
    return unifyTryMatch(node, this.matchSide, this.replSide, this.freeVars,
        this.conditionsFreshened);
  }

  validateConditions(conditions: Prop[]): void {
    validateConditionsImplied(this.env, this.label, this.ex, this.knownFacts, conditions);
  }
}


/**
 * Rewrites by unification with a theorem inequality. Uses polarity-aware
 * tree walk. Premises are checked with IsEquationImplied or
 * IsInequalityImplied depending on the premise type.
 */
export class TheoremInequalityRewriter extends Rewriter {
  private env: Environment;
  private matchSide: Expression;
  private replSide: Expression;
  private freeVars: Set<string>;
  private conditionsFreshened: Prop[];
  private knownFacts: Prop[];

  constructor(
    label: string,
    env: Environment,
    ex: Expression,
    conclusion: Formula,
    right: boolean,
    premises: Prop[],
    knownFacts: Prop[],
  ) {
    super(label, ex);
    this.env = env;
    this.knownFacts = knownFacts;
    const u = setupUnification(env, conclusion, right, premises);
    this.matchSide = u.matchSide;
    this.replSide = u.replSide;
    this.freeVars = u.freeVars;
    this.conditionsFreshened = u.conditionsFreshened;
  }

  tryMatch(node: Expression) {
    return unifyTryMatch(node, this.matchSide, this.replSide, this.freeVars,
        this.conditionsFreshened);
  }

  /** Whether the chosen match was at a positive position. */
  get positive(): boolean {
    /* v8 ignore start */
    if (this._chosen === undefined || !isPolarized(this._chosen)) {
      throw new Error('unreachable');
    }
    /* v8 ignore stop */
    return this._chosen.positive;
  }

  enumerate(): PolarizedCandidate[] {
    return this.enumerateWithPolarity(this.ex, true);
  }

  validateConditions(conditions: Prop[]): void {
    validateConditionsImplied(this.env, this.label, this.ex, this.knownFacts, conditions);
  }
}
