/** Forward rules (rules of inference) that transform expressions. */

import { Expression } from '../facts/exprs';
import { Formula, FormulaOp, OP_EQUAL, OP_LESS_THAN, OP_LESS_EQUAL } from '../facts/formula';
import { Definition, funcToDefinitions } from '../lang/func_ast';
import { Environment } from '../types/env';
import { UnifyExprs, EnumerateReplacements, ApplySubst, SubstAll, SubstAllWithCheck, FreshenVarsMany, SubstPositive, SubstNegative } from '../facts/unify';
import { IsEquationImplied } from '../decision/equation';
import { IsInequalityImplied } from '../decision/inequality';
import { UserError } from '../facts/user_error';

export const RULE_ALGEBRA = 2;
export const RULE_SUBSTITUTE = 3;
export const RULE_DEFINITION = 4;

/**
 * Looks up a definition by name (e.g. "len_2" or "abs_1a").
 */
export function lookupDefinition(env: Environment, name: string): Definition {
  const match = name.match(/^(.+)_(\d+[a-z]?)$/);
  if (!match)
    throw new UserError(`defof/undef: invalid definition name "${name}"`);
  const funcName = match[1];

  if (!env.hasFunction(funcName))
    throw new UserError(`defof/undef: unknown function "${funcName}"`);

  const funcAst = env.getFunctionDecl(funcName);
  const defs = funcToDefinitions(funcAst);
  const def = defs.find(d => d.name === name);
  if (!def)
    throw new UserError(
        `defof/undef: unknown definition "${name}" (available: ${defs.map(d => d.name).join(', ')})`);

  return def;
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
 * Substitution rule: replaces occurrences of one side of a given fact
 * with the other in the current expression.
 *
 * For equations (=): replaces anywhere, producing an equality.
 * For inequalities (< or <=): replaces only at positive or negative positions.
 *   Positive: ex op result (same direction as the fact).
 *   Negative: result flippedOp ex (sides and op both flip).
 *   Mixed: user must provide an explicit result.
 *
 * right = true (subst): replace left side with right side.
 * right = false (unsub): replace right side with left side.
 */
export class SubstituteRule extends Rule {
  ex: Expression;
  eq: Formula;
  right: boolean;
  _result?: Expression;
  _resultFormula?: Formula;

  constructor(env: Environment, ex: Expression, known: number, right: boolean, result?: Expression) {
    super(RULE_SUBSTITUTE);

    this.eq = env.getFact(known);
    this.ex = ex;
    this.right = right;

    const from = right ? this.eq.left : this.eq.right;
    const to = right ? this.eq.right : this.eq.left;

    if (this.eq.op === OP_EQUAL) {
      if (result !== undefined) {
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
      this._resultFormula = new Formula(this.ex, OP_EQUAL, this._result!);
    } else {
      const posResult = SubstPositive(ex, from, to);
      const negResult = SubstNegative(ex, from, to);
      const posChanged = !posResult.equals(ex);
      const negChanged = !negResult.equals(ex);
      const flippedOp: FormulaOp = this.eq.op === OP_LESS_THAN ? OP_LESS_EQUAL : OP_LESS_THAN;

      if (result !== undefined) {
        const fullEx = ex.subst(from, to);
        const fullResult = result.subst(from, to);
        if (!fullEx.equals(fullResult)) {
          throw new UserError(
            `subst: provided result ${result.to_string()} cannot be produced by substitution`);
        }
        this._result = result;
        if (posChanged && result.equals(posResult)) {
          this._resultFormula = new Formula(ex, this.eq.op, result);
        } else if (negChanged && result.equals(negResult)) {
          this._resultFormula = new Formula(result, flippedOp, ex);
        } else {
          throw new UserError(
            `subst: cannot determine polarity for inequality substitution`);
        }
      } else {
        if (posChanged && negChanged) {
          throw new UserError(
            `subst: ${from.to_string()} appears in both positive and negative positions; provide an explicit result`);
        } else if (posChanged) {
          this._result = posResult;
          this._resultFormula = new Formula(ex, this.eq.op, posResult);
        } else if (negChanged) {
          this._result = negResult;
          this._resultFormula = new Formula(negResult, flippedOp, ex);
        } else {
          throw new UserError(
            `subst: ${from.to_string()} not found in ${ex.to_string()}`);
        }
      }
    }
  }

  doApply(): Formula {
    return this._resultFormula!;
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

  constructor(env: Environment, ex: Expression, name: string, right: boolean,
      knowns: number[] = [], result?: Expression) {
    super(RULE_DEFINITION);
    this.ex = ex;
    this.right = right;
    const def = lookupDefinition(env, name);
    this.defFormula = def.formula;
    const knownFacts = knowns.map(i => env.getFact(i));

    if (def.condition && knowns.length === 0)
      throw new UserError(
          `defof/undef: "${name}" has a condition; known facts must be provided`);
    if (!def.condition && knowns.length > 0)
      throw new UserError(
          `defof/undef: "${name}" has no condition; known facts must not be provided`);

    const origMatch = right ? this.defFormula.left : this.defFormula.right;
    const origRepl = right ? this.defFormula.right : this.defFormula.left;
    const origVars = new Set(origMatch.var_refs().filter(v => !env.hasConstructor(v)));

    const toFreshen = [origMatch, origRepl];
    if (def.condition) {
      toFreshen.push(def.condition.left, def.condition.right);
    }
    const [freshened, freeVars] = FreshenVarsMany(toFreshen, origVars);
    const matchSide = freshened[0];
    const replSide = freshened[1];

    if (result !== undefined) {
      const possibilities = EnumerateReplacements(ex, (node) => {
        const subst = UnifyExprs(node, matchSide, freeVars);
        if (subst === undefined) return undefined;
        if (def.condition) {
          const condLeft = ApplySubst(freshened[2], subst);
          const condRight = ApplySubst(freshened[3], subst);
          const concrete = new Formula(condLeft, def.condition.op, condRight);
          if (!IsInequalityImplied(knownFacts, concrete))
            return undefined;
        }
        return ApplySubst(replSide, subst);
      });
      if (!possibilities.some(p => p.equals(result))) {
        throw new UserError(
            `defof/undef: provided result ${result.to_string()} cannot be produced`);
      }
      this._result = result;
    } else {
      if (def.condition) {
        this._result = SubstAllWithCheck(ex, matchSide, replSide, freeVars, (subst) => {
          const condLeft = ApplySubst(freshened[2], subst);
          const condRight = ApplySubst(freshened[3], subst);
          const concrete = new Formula(condLeft, def.condition!.op, condRight);
          if (!IsInequalityImplied(knownFacts, concrete)) {
            throw new UserError(
                `defof/undef: condition ${concrete.to_string()} is not implied by the cited facts: ${knownFacts.map(f => f.to_string()).join(' | ')}`);
          }
        });
      } else {
        this._result = SubstAll(ex, matchSide, replSide, freeVars);
      }
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
