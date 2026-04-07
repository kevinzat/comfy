import {
  Call,
  Constant,
  Expression,
  Variable,
  EXPR_CONSTANT,
  EXPR_FUNCTION,
  EXPR_VARIABLE,
  FUNC_ADD,
  FUNC_SUBTRACT,
  FUNC_MULTIPLY,
  FUNC_NEGATE,
} from './exprs';


let _freshCounter = 0;

/** Returns a fresh variable name that won't collide with user names. */
export function FreshVarName(): string {
  return `_v${++_freshCounter}`;
}

/**
 * Renames all free variables in expr to fresh names. Returns the renamed
 * expression and the set of fresh variable names (the allowed vars for unification).
 */
export function FreshenVars(expr: Expression): [Expression, Set<string>] {
  const freshNames = new Set<string>();
  let result = expr;
  for (const v of expr.var_refs()) {
    if (freshNames.has(v)) continue;  // already renamed via a previous var_refs entry
    const fresh = FreshVarName();
    freshNames.add(fresh);
    result = result.subst(Variable.of(v), Variable.of(fresh));
  }
  return [result, freshNames];
}

/**
 * Freshens variables in all given expressions simultaneously (same variable gets
 * the same fresh name in each). Returns the renamed expressions and
 * the set of fresh variable names.
 */
export function FreshenVarsMany(
    exprs: Expression[], vars: Set<string>,
): [Expression[], Set<string>] {
  const freshNames = new Set<string>();
  let results = exprs.slice();
  for (const v of vars) {
    const fresh = FreshVarName();
    freshNames.add(fresh);
    const vExpr = Variable.of(v);
    const freshExpr = Variable.of(fresh);
    results = results.map(r => r.subst(vExpr, freshExpr));
  }
  return [results, freshNames];
}

/**
 * Returns substitutions that would make the two expressions identical by
 * performing substitutions for any of the allowed variables.
 */
export function UnifyExprs(
    expr1: Expression,
    expr2: Expression,
    allowed_vars: Set<string>): Map<string, Expression> | undefined {
  const subst = new Map<string, Expression>();
  return UnifyExprsHelper(expr1, expr2, allowed_vars, subst)
      ? subst : undefined;
}

function UnifyExprsHelper(
    expr1: Expression,
    expr2: Expression,
    allowed_vars: Set<string>,
    subst: Map<string, Expression>): boolean {
  if (expr1.variety === EXPR_VARIABLE &&
      allowed_vars.has(expr1.name)) {
    return UnifyVar(expr1.name, expr2, allowed_vars, subst);
  } else if (expr2.variety === EXPR_VARIABLE &&
      allowed_vars.has(expr2.name)) {
    return UnifyVar(expr2.name, expr1, allowed_vars, subst);
  } else if (expr1.variety === EXPR_VARIABLE &&
      expr2.variety === EXPR_VARIABLE) {
    return expr1.name === expr2.name;
  } else if (expr1.variety === EXPR_CONSTANT &&
      expr2.variety === EXPR_CONSTANT) {
    return expr1.equals(expr2);
  } else if (expr1.variety === EXPR_FUNCTION &&
      expr2.variety === EXPR_FUNCTION) {
    if (expr1.name !== expr2.name) return false;
    if (expr1.args.length !== expr2.args.length) return false;
    for (let i = 0; i < expr1.args.length; i++) {
      if (!UnifyExprsHelper(expr1.args[i], expr2.args[i], allowed_vars, subst))
        return false;
    }
    return true;
  } else {
    return false;
  }
}

function UnifyVar(
    name: string,
    expr: Expression,
    allowed_vars: Set<string>,
    subst: Map<string, Expression>): boolean {
  if (subst.has(name)) {
    return UnifyExprsHelper(subst.get(name)!, expr, allowed_vars, subst);
  } else if (expr.variety === EXPR_VARIABLE && subst.has(expr.name)) {
    return UnifyVar(name, subst.get(expr.name)!, allowed_vars, subst);
  } else if (OccursCheck(name, expr, subst)) {
    return false;
  } else {
    subst.set(name, expr);
    return true;
  }
}

function OccursCheck(
    name: string,
    expr: Expression,
    subst: Map<string, Expression>): boolean {
  if (expr.variety === EXPR_VARIABLE) {
    if (subst.has(expr.name)) return OccursCheck(name, subst.get(expr.name)!, subst);
    return name === expr.name;
  } else if (expr.variety === EXPR_FUNCTION) {
    for (let i = 0; i < expr.args.length; i++) {
      if (OccursCheck(name, expr.args[i], subst)) return true;
    }
    return false;
  } else {
    return false;
  }
}


/**
 * Enumerates all non-overlapping ways to apply a replacement within an
 * expression. At each node where tryReplace returns a result, the enumeration
 * branches: one branch takes the replacement (and does NOT recurse into it),
 * while the other skips it and recurses into the original children. The
 * returned array contains every possible resulting expression, including the
 * original (no replacements at all).
 */
export function EnumerateReplacements(
    expr: Expression,
    tryReplace: (expr: Expression) => Expression | undefined): Expression[] {
  const results: Expression[] = [];

  // Option A: replace at this node (don't recurse into the replacement).
  const replaced = tryReplace(expr);
  if (replaced !== undefined) {
    results.push(replaced);
  }

  // Option B: keep this node and recurse into children.
  if (expr.variety === EXPR_CONSTANT || expr.variety === EXPR_VARIABLE) {
    results.push(expr);
  } else {
    // Build arrays of possibilities for each child.
    const childPossibilities: Expression[][] = [];
    for (let i = 0; i < expr.args.length; i++) {
      childPossibilities.push(EnumerateReplacements(expr.args[i], tryReplace));
    }
    // Take the cartesian product of all child possibilities.
    const combos: Expression[][] = [[]];
    for (const choices of childPossibilities) {
      const newCombos: Expression[][] = [];
      for (const combo of combos) {
        for (const choice of choices) {
          newCombos.push(combo.concat([choice]));
        }
      }
      combos.length = 0;
      combos.push(...newCombos);
    }
    for (const combo of combos) {
      let same = true;
      for (let i = 0; i < combo.length; i++) {
        if (combo[i] !== expr.args[i]) { same = false; break; }
      }
      results.push(same ? expr : new Call(expr.name, combo));
    }
  }

  return results;
}

/** Applies substitutions from a unification result to an expression. */
export function ApplySubst(expr: Expression, subst: Map<string, Expression>): Expression {
  let r = expr;
  for (const [v, val] of subst) {
    r = r.subst(Variable.of(v), val);
  }
  return r;
}

/**
 * Substitutes all matches of matchSide (greedy, outermost first) with
 * replSide, using unification with the given free variables.
 */
export function SubstAll(
    expr: Expression, matchSide: Expression, replSide: Expression,
    freeVars: Set<string>): Expression {
  const subst = UnifyExprs(expr, matchSide, freeVars);
  if (subst !== undefined) {
    return ApplySubst(replSide, subst);
  }
  if (expr.variety === EXPR_FUNCTION) {
    let changed = false;
    const newArgs: Expression[] = [];
    for (const arg of expr.args) {
      const newArg = SubstAll(arg, matchSide, replSide, freeVars);
      if (newArg !== arg) changed = true;
      newArgs.push(newArg);
    }
    if (changed) return new Call(expr.name, newArgs);
  }
  return expr;
}

/**
 * Like SubstAll, but calls onMatch at each match site with the unification.
 * If onMatch throws, the substitution is aborted.
 */
export function SubstAllWithCheck(
    expr: Expression, matchSide: Expression, replSide: Expression,
    freeVars: Set<string>,
    onMatch: (subst: Map<string, Expression>) => void): Expression {
  const subst = UnifyExprs(expr, matchSide, freeVars);
  if (subst !== undefined) {
    onMatch(subst);
    return ApplySubst(replSide, subst);
  }
  if (expr.variety === EXPR_FUNCTION) {
    let changed = false;
    const newArgs: Expression[] = [];
    for (const arg of expr.args) {
      const newArg = SubstAllWithCheck(arg, matchSide, replSide, freeVars, onMatch);
      if (newArg !== arg) changed = true;
      newArgs.push(newArg);
    }
    if (changed) return new Call(expr.name, newArgs);
  }
  return expr;
}

/**
 * Polarity-aware substitution. Replaces `from` with `to` only at positions
 * with the given polarity (true = positive, false = negative).
 *
 * Polarity rules:
 * - +: both args positive
 * - -: first arg keeps polarity, second arg flips
 * - negate: flips polarity
 * - * with one constant arg: keeps polarity if constant >= 0, flips if < 0
 * - exponentiation, user-defined functions: don't recurse
 */
function substWithPolarity(
    expr: Expression, from: Expression, to: Expression,
    positive: boolean): Expression {
  if (expr.equals(from)) {
    return positive ? to : expr;
  }
  if (expr.variety !== EXPR_FUNCTION) return expr;

  if (expr.name === FUNC_ADD) {
    let changed = false;
    const newArgs: Expression[] = [];
    for (const arg of expr.args) {
      const newArg = substWithPolarity(arg, from, to, positive);
      if (newArg !== arg) changed = true;
      newArgs.push(newArg);
    }
    return changed ? new Call(expr.name, newArgs) : expr;
  }

  if (expr.name === FUNC_SUBTRACT && expr.args.length === 2) {
    const newLeft = substWithPolarity(expr.args[0], from, to, positive);
    const newRight = substWithPolarity(expr.args[1], from, to, !positive);
    if (newLeft !== expr.args[0] || newRight !== expr.args[1])
      return new Call(expr.name, [newLeft, newRight]);
    return expr;
  }

  if (expr.name === FUNC_NEGATE && expr.args.length === 1) {
    const newArg = substWithPolarity(expr.args[0], from, to, !positive);
    return newArg !== expr.args[0] ? new Call(expr.name, [newArg]) : expr;
  }

  if (expr.name === FUNC_MULTIPLY && expr.args.length === 2) {
    const [a, b] = expr.args;
    if (a.variety === EXPR_CONSTANT) {
      const childPositive = a.value >= 0n ? positive : !positive;
      const newB = substWithPolarity(b, from, to, childPositive);
      return newB !== b ? new Call(expr.name, [a, newB]) : expr;
    }
    if (b.variety === EXPR_CONSTANT) {
      const childPositive = b.value >= 0n ? positive : !positive;
      const newA = substWithPolarity(a, from, to, childPositive);
      return newA !== a ? new Call(expr.name, [newA, b]) : expr;
    }
  }

  return expr;
}

/** Substitutes `from` with `to` only at positive positions. */
export function SubstPositive(
    expr: Expression, from: Expression, to: Expression): Expression {
  return substWithPolarity(expr, from, to, true);
}

/** Substitutes `from` with `to` only at negative positions. */
export function SubstNegative(
    expr: Expression, from: Expression, to: Expression): Expression {
  return substWithPolarity(expr, from, to, false);
}
