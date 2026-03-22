/** Forward rules (rules of inference) that transform expressions. */

import { Expression } from '../facts/exprs';
import { Formula, OP_EQUAL } from '../facts/formula';
import { funcToDefinitions } from '../lang/func_ast';
import { Environment } from '../types/env';
import { UnifyExprs, EnumerateReplacements, ApplySubst, SubstAll, FreshenVarsPair } from '../facts/unify';
import { IsEquationImplied } from '../decision/equation';
import { IsInequalityImplied } from '../decision/inequality';
import { UserError } from '../facts/user_error';

export const RULE_ALGEBRA = 2;
export const RULE_SUBSTITUTE = 3;
export const RULE_DEFINITION = 4;

/**
 * Parses a definition name like "len_2" into function name "len" and
 * 1-based case index 2. Returns the definition's formula.
 */
export function lookupDefinition(env: Environment, name: string): Formula {
  const match = name.match(/^(.+)_(\d+)$/);
  if (!match)
    throw new UserError(`defof/undef: invalid definition name "${name}"`);
  const funcName = match[1];
  const caseIndex = parseInt(match[2]);

  if (!env.hasFunction(funcName))
    throw new UserError(`defof/undef: unknown function "${funcName}"`);

  const funcAst = env.getFunctionDecl(funcName);
  const defs = funcToDefinitions(funcAst);

  if (caseIndex < 1 || caseIndex > defs.length)
    throw new UserError(
        `defof/undef: "${funcName}" has ${defs.length} cases, not ${caseIndex}`);

  return defs[caseIndex - 1].formula;
}


export abstract class Rule {
  variety: number;
  private result_?: Formula;

  constructor(variety: number) {
    this.variety = variety;
  }

  abstract doApply(): Formula;

  apply(): Formula {
    if (this.result_ === undefined) {
      this.result_ = this.doApply();
    }
    return this.result_;
  }
}

/**
 * Algebra rule: asserts that a formula follows from the cited known facts.
 * Uses IsEquationImplied for pure equations and IsInequalityImplied otherwise.
 */
export class AlgebraRule extends Rule {
  formula: Formula;
  known: Formula[];

  constructor(env: Environment, formula: Formula, ...knowns: number[]) {
    super(RULE_ALGEBRA);
    this.formula = formula;
    this.known = knowns.map(i => env.getFact(i));

    const useInequality = formula.op !== OP_EQUAL ||
        this.known.some(f => f.op !== OP_EQUAL);

    if (useInequality) {
      if (!IsInequalityImplied(this.known, formula)) {
        const facts = this.known.map(f => f.to_string());
        throw new UserError(
          `algebra: ${formula.to_string()} is not implied by the cited facts: ${facts.join(' | ')}`);
      }
    } else {
      if (!IsEquationImplied(this.known, formula)) {
        const facts = this.known.map(f => f.to_string());
        throw new UserError(
          `algebra: ${formula.to_string()} is not implied by the cited equations: ${facts.join(' | ')}`);
      }
    }
  }

  doApply(): Formula {
    return this.formula;
  }
}

/**
 * Substitution rule: replaces occurrences of one side of a given equation
 * with the other in the current expression, producing an equality.
 *
 * right = true (subst): replace left side with right side.
 * right = false (unsub): replace right side with left side.
 */
export class SubstituteRule extends Rule {
  ex: Expression;
  eq: Formula;
  right: boolean;
  _result?: Expression;

  constructor(env: Environment, ex: Expression, known: number, right: boolean, result?: Expression) {
    super(RULE_SUBSTITUTE);

    this.eq = env.getFact(known);
    this.ex = ex;
    this.right = right;

    if (this.eq.op !== OP_EQUAL) {
      throw new UserError(
        `subst: given ${known} must be an equation, not ${this.eq.to_string()}`);
    }

    const from = right ? this.eq.left : this.eq.right;
    const to = right ? this.eq.right : this.eq.left;

    if (result !== undefined) {
      // Validate the provided result: fully substituting in result should
      // give the same thing as fully substituting in ex.
      const fullEx = ex.subst(from, to);
      const fullResult = result.subst(from, to);
      if (!fullEx.equals(fullResult)) {
        throw new UserError(
          `subst: provided result ${result.to_string()} cannot be produced by substitution`);
      }
      this._result = result;
    } else {
      const substituted = ex.subst(from, to);
      if (substituted.equals(ex)) {
        throw new UserError(
          `subst: ${from.to_string()} not found in ${ex.to_string()}`);
      }
      this._result = substituted;
    }
  }

  doApply(): Formula {
    return new Formula(this.ex, OP_EQUAL, this._result!);
  }
}

/**
 * Definition rule: applies a function definition by unification.
 *
 * defof name (right = true): at each node, try to unify with the left side
 *   (the pattern) and replace with the right side (the body).
 * undef name (right = false): at each node, try to unify with the right side
 *   (the body) and replace with the left side (the pattern).
 */
export class DefinitionRule extends Rule {
  ex: Expression;
  defFormula: Formula;
  right: boolean;
  _result: Expression;

  constructor(env: Environment, ex: Expression, name: string, right: boolean, result?: Expression) {
    super(RULE_DEFINITION);
    this.ex = ex;
    this.right = right;
    this.defFormula = lookupDefinition(env, name);

    const origMatch = right ? this.defFormula.left : this.defFormula.right;
    const origRepl = right ? this.defFormula.right : this.defFormula.left;
    const origVars = new Set(origMatch.var_refs().filter(v => !env.hasConstructor(v)));
    const [matchSide, replSide, freeVars] =
        FreshenVarsPair(origMatch, origRepl, origVars);

    if (result !== undefined) {
      const possibilities = EnumerateReplacements(ex, (node) => {
        const subst = UnifyExprs(node, matchSide, freeVars);
        if (subst === undefined) return undefined;
        return ApplySubst(replSide, subst);
      });
      if (!possibilities.some(p => p.equals(result))) {
        throw new UserError(
            `defof/undef: provided result ${result.to_string()} cannot be produced`);
      }
      this._result = result;
    } else {
      this._result = SubstAll(ex, matchSide, replSide, freeVars);
      if (this._result.equals(ex)) {
        throw new UserError(
            `defof/undef: no matches found in ${ex.to_string()}`);
      }
    }
  }

  doApply(): Formula {
    return new Formula(this.ex, OP_EQUAL, this._result);
  }
}
