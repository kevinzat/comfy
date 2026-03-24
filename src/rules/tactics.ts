/** Backward rules (tactics) that work from the goal backward. */

import { Expression } from '../facts/exprs';
import { Formula, FormulaOp, OP_EQUAL, OP_LESS_THAN, OP_LESS_EQUAL } from '../facts/formula';
import { Environment } from '../types/env';
import { UnifyExprs, EnumerateReplacements, ApplySubst, SubstAll, SubstAllWithCheck, FreshenVarsMany, SubstPositive, SubstNegative } from '../facts/unify';
import { lookupDefinition } from './rules';
import { IsEquationImplied } from '../decision/equation';
import { IsInequalityImplied } from '../decision/inequality';
import { UserError } from '../facts/user_error';
import { RuleAst, AlgebraAst, SubstituteAst, DefinitionAst } from './rules_ast';

export const TACTIC_ALGEBRA = 2;
export const TACTIC_SUBSTITUTE = 3;
export const TACTIC_DEFINITION = 4;

export abstract class Tactic {
  variety: number;
  goal: Expression;

  constructor(variety: number, goal: Expression) {
    this.variety = variety;
    this.goal = goal;
  }

  /** Returns the formula that this tactic proves (premise op goal). */
  abstract apply(): Formula;

  /** Returns the corresponding forward rule AST. */
  abstract reverse(): RuleAst;
}

/**
 * Backward algebra: asserts that a formula follows from the cited known facts.
 * Opposite of forward: forward builds Formula(current, op, expr),
 * backward builds Formula(expr, op, goal). Premise is expr.
 */
export class AlgebraTactic extends Tactic {
  formula: Formula;
  known: Formula[];

  constructor(env: Environment, formula: Formula, ...knowns: number[]) {
    super(TACTIC_ALGEBRA, formula.right);
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

  apply(): Formula {
    return this.formula;
  }

  reverse(): RuleAst {
    return new AlgebraAst(this.formula.op, this.goal, this.known.map((_, i) => i + 1));
  }
}

/**
 * Backward substitution: the opposite of forward substitution.
 *
 * Forward subst N (L=R): replaces L with R in current.
 * Backward subst N (L=R): replaces R with L in goal (undoing a forward subst).
 *
 * Forward unsub N (L=R): replaces R with L in current.
 * Backward unsub N (L=R): replaces L with R in goal (undoing a forward unsub).
 */
export class SubstituteTactic extends Tactic {
  eq: Formula;
  right: boolean;
  known: number;
  _premise: Expression;
  _resultFormula?: Formula;

  constructor(env: Environment, goal: Expression, known: number, right: boolean, premise?: Expression) {
    super(TACTIC_SUBSTITUTE, goal);

    this.eq = env.getFact(known);
    this.right = right;
    this.known = known;

    // For equations, backward reverses the substitution direction.
    // For inequalities, the substitution direction is the same as forward
    // (only the formula orientation changes).
    const eqFrom = right ? this.eq.right : this.eq.left;
    const eqTo = right ? this.eq.left : this.eq.right;
    const ineqFrom = right ? this.eq.left : this.eq.right;
    const ineqTo = right ? this.eq.right : this.eq.left;

    if (this.eq.op === OP_EQUAL) {
      const from = eqFrom;
      const to = eqTo;
      if (premise !== undefined) {
        const fullGoal = goal.subst(from, to);
        const fullPremise = premise.subst(from, to);
        if (!fullGoal.equals(fullPremise)) {
          throw new UserError(
            `subst: provided premise ${premise.to_string()} cannot be produced by substitution`);
        }
        this._premise = premise;
      } else {
        const substituted = goal.subst(from, to);
        if (substituted.equals(goal)) {
          throw new UserError(
            `subst: ${from.to_string()} not found in ${goal.to_string()}`);
        }
        this._premise = substituted;
      }
      this._resultFormula = new Formula(this._premise, OP_EQUAL, this.goal);
    } else {
      const from = ineqFrom;
      const to = ineqTo;
      const posResult = SubstPositive(goal, from, to);
      const negResult = SubstNegative(goal, from, to);
      const posChanged = !posResult.equals(goal);
      const negChanged = !negResult.equals(goal);
      const flippedOp: FormulaOp = this.eq.op === OP_LESS_THAN ? OP_LESS_EQUAL : OP_LESS_THAN;

      if (premise !== undefined) {
        const fullGoal = goal.subst(from, to);
        const fullPremise = premise.subst(from, to);
        if (!fullGoal.equals(fullPremise)) {
          throw new UserError(
            `subst: provided premise ${premise.to_string()} cannot be produced by substitution`);
        }
        this._premise = premise;
        if (posChanged && premise.equals(posResult)) {
          this._resultFormula = new Formula(premise, this.eq.op, goal);
        } else if (negChanged && premise.equals(negResult)) {
          this._resultFormula = new Formula(goal, flippedOp, premise);
        } else {
          throw new UserError(
            `subst: cannot determine polarity for inequality substitution`);
        }
      } else {
        if (posChanged && negChanged) {
          throw new UserError(
            `subst: ${from.to_string()} appears in both positive and negative positions; provide an explicit result`);
        } else if (posChanged) {
          this._premise = posResult;
          this._resultFormula = new Formula(posResult, this.eq.op, goal);
        } else if (negChanged) {
          this._premise = negResult;
          this._resultFormula = new Formula(goal, flippedOp, negResult);
        } else {
          throw new UserError(
            `subst: ${from.to_string()} not found in ${goal.to_string()}`);
        }
      }
    }
  }

  apply(): Formula {
    return this._resultFormula!;
  }

  reverse(): RuleAst {
    return new SubstituteAst(this.known, this.right);
  }
}

/**
 * Backward definition rule.
 *
 * defof name (right = true): forward replaces pattern→body, so backward
 *   replaces body→pattern in the goal (undoing a forward defof).
 * undef name (right = false): forward replaces body→pattern, so backward
 *   replaces pattern→body in the goal (undoing a forward undef).
 */
export class DefinitionTactic extends Tactic {
  defFormula: Formula;
  right: boolean;
  name: string;
  _premise: Expression;

  constructor(env: Environment, goal: Expression, name: string, right: boolean,
      knowns: number[] = [], premise?: Expression) {
    super(TACTIC_DEFINITION, goal);
    this.name = name;
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

    // Backward is opposite direction from forward
    const origMatch = right ? this.defFormula.right : this.defFormula.left;
    const origRepl = right ? this.defFormula.left : this.defFormula.right;
    const origVars = new Set(origMatch.var_refs().filter(v => !env.hasConstructor(v)));

    const toFreshen = [origMatch, origRepl];
    if (def.condition) {
      toFreshen.push(def.condition.left, def.condition.right);
    }
    const [freshened, freeVars] = FreshenVarsMany(toFreshen, origVars);
    const matchSide = freshened[0];
    const replSide = freshened[1];

    if (premise !== undefined) {
      const possibilities = EnumerateReplacements(goal, (node) => {
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
      if (!possibilities.some(p => p.equals(premise))) {
        throw new UserError(
            `defof/undef: provided premise ${premise.to_string()} cannot be produced`);
      }
      this._premise = premise;
    } else {
      if (def.condition) {
        this._premise = SubstAllWithCheck(goal, matchSide, replSide, freeVars, (subst) => {
          const condLeft = ApplySubst(freshened[2], subst);
          const condRight = ApplySubst(freshened[3], subst);
          const concrete = new Formula(condLeft, def.condition!.op, condRight);
          if (!IsInequalityImplied(knownFacts, concrete)) {
            throw new UserError(
                `defof/undef: condition ${concrete.to_string()} is not implied by the cited facts: ${knownFacts.map(f => f.to_string()).join(' | ')}`);
          }
        });
      } else {
        this._premise = SubstAll(goal, matchSide, replSide, freeVars);
      }
      if (this._premise.equals(goal)) {
        throw new UserError(
            `defof/undef: no matches found in ${goal.to_string()}`);
      }
    }
  }

  apply(): Formula {
    return new Formula(this._premise, OP_EQUAL, this.goal);
  }

  reverse(): RuleAst {
    return new DefinitionAst(this.name, this.right);
  }
}
