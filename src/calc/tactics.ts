/** Backward calc tactics that work from the goal backward. */

import { Expression } from '../facts/exprs';
import { Formula, FormulaOp, OP_EQUAL, OP_LESS_THAN, OP_LESS_EQUAL } from '../facts/formula';
import { AtomProp } from '../facts/prop';
import { Environment } from '../types/env';
import { EquationRewriter, InequalityRewriter, DefinitionRewriter, TheoremEquationRewriter, TheoremInequalityRewriter } from './rewriter';
import { lookupDefinition } from './rules';
import { IsEquationImplied } from '../decision/equation';
import { IsInequalityImplied } from '../decision/inequality';
import { UserError } from '../facts/user_error';
import { RuleAst, AlgebraAst, SubstituteAst, DefinitionAst, ApplyAst } from './rules_ast';


export const TACTIC_ALGEBRA = 2;
export const TACTIC_SUBSTITUTE = 3;
export const TACTIC_DEFINITION = 4;
export const TACTIC_APPLY = 5;

export abstract class CalcTactic {
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
export class AlgebraCalcTactic extends CalcTactic {
  formula: Formula;
  known: Formula[];

  constructor(env: Environment, formula: Formula, ...knowns: number[]) {
    super(TACTIC_ALGEBRA, formula.right);
    this.formula = formula;
    this.known = knowns.map(i => {
      const prop = env.getFact(i);
      if (!(prop instanceof AtomProp))
        throw new UserError(`algebra: fact ${i} is not a formula`);
      return prop.formula;
    });

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
export class SubstituteCalcTactic extends CalcTactic {
  eq: Formula;
  right: boolean;
  known: number;
  _resultFormula: Formula;

  constructor(env: Environment, goal: Expression, known: number, right: boolean, premise?: Expression) {
    super(TACTIC_SUBSTITUTE, goal);

    const prop = env.getFact(known);
    if (!(prop instanceof AtomProp))
      throw new UserError(`subst: fact ${known} is not a formula`);
    this.eq = prop.formula;
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
      const rewriter = new EquationRewriter('subst', goal, eqFrom, eqTo);
      this._resultFormula = new Formula(rewriter.rewrite(premise), OP_EQUAL, goal);
    } else {
      const rewriter = new InequalityRewriter('subst', goal, ineqFrom, ineqTo);
      rewriter.rewrite(premise);
      if (rewriter.positive) {
        this._resultFormula = new Formula(rewriter.result, this.eq.op, goal);
      } else {
        const flippedOp: FormulaOp =
            this.eq.op === OP_LESS_THAN ? OP_LESS_EQUAL : OP_LESS_THAN;
        this._resultFormula = new Formula(goal, flippedOp, rewriter.result);
      }
    }
  }

  apply(): Formula {
    return this._resultFormula;
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
export class DefinitionCalcTactic extends CalcTactic {
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

    if (def.conditions.length > 0 && knowns.length === 0)
      throw new UserError(
          `defof/undef: "${name}" has a condition; known facts must be provided`);
    if (def.conditions.length === 0 && knowns.length > 0)
      throw new UserError(
          `defof/undef: "${name}" has no condition; known facts must not be provided`);

    // Backward is opposite direction from forward
    const rewriter = new DefinitionRewriter(
        'defof/undef', env, goal, def.formula, !right,
        def.conditions, knownFacts);
    this._premise = rewriter.rewrite(premise);
  }

  apply(): Formula {
    return new Formula(this._premise, OP_EQUAL, this.goal);
  }

  reverse(): RuleAst {
    return new DefinitionAst(this.name, this.right);
  }
}

/**
 * Backward apply rule.
 *
 * apply name (right = true): forward replaces left→right, so backward
 *   replaces right→left in the goal (undoing a forward apply).
 * unapp name (right = false): forward replaces right→left, so backward
 *   replaces left→right in the goal (undoing a forward unapp).
 */
export class ApplyCalcTactic extends CalcTactic {
  name: string;
  right: boolean;
  _resultFormula: Formula;

  constructor(env: Environment, goal: Expression, name: string, right: boolean,
      knowns: number[] = [], premise?: Expression) {
    super(TACTIC_APPLY, goal);
    this.name = name;
    this.right = right;

    if (!env.hasTheorem(name))
      throw new UserError(`apply/unapp: unknown theorem "${name}"`);
    const theorem = env.getTheorem(name);
    const knownFacts = knowns.map(i => env.getFact(i));

    if (theorem.premises.length > 0 && knowns.length === 0)
      throw new UserError(
          `apply/unapp: "${name}" has a premise; known facts must be provided`);
    if (theorem.premises.length === 0 && knowns.length > 0)
      throw new UserError(
          `apply/unapp: "${name}" has no premise; known facts must not be provided`);

    // Backward is opposite direction from forward
    if (theorem.conclusion.tag !== 'atom')
      throw new UserError(`apply/unapp: "${name}" has a non-atomic conclusion`);
    const concl = theorem.conclusion.formula;
    if (concl.op === OP_EQUAL) {
      const rewriter = new TheoremEquationRewriter(
          'apply/unapp', env, goal, concl, !right,
          theorem.premises, knownFacts);
      this._resultFormula = new Formula(rewriter.rewrite(premise), OP_EQUAL, goal);
    } else {
      const rewriter = new TheoremInequalityRewriter(
          'apply/unapp', env, goal, concl, !right,
          theorem.premises, knownFacts);
      rewriter.rewrite(premise);
      if (rewriter.positive) {
        this._resultFormula = new Formula(rewriter.result, concl.op, goal);
      } else {
        const flippedOp: FormulaOp =
            concl.op === OP_LESS_THAN ? OP_LESS_EQUAL : OP_LESS_THAN;
        this._resultFormula = new Formula(goal, flippedOp, rewriter.result);
      }
    }
  }

  apply(): Formula {
    return this._resultFormula;
  }

  reverse(): RuleAst {
    return new ApplyAst(this.name, this.right);
  }
}
