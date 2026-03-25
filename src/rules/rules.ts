/** Forward rules (rules of inference) that transform expressions. */

import { Expression } from '../facts/exprs';
import { Formula, FormulaOp, OP_EQUAL, OP_LESS_THAN, OP_LESS_EQUAL } from '../facts/formula';
import { Definition, funcToDefinitions } from '../lang/func_ast';
import { Environment } from '../types/env';
import { EquationRewriter, InequalityRewriter, DefinitionRewriter, TheoremEquationRewriter, TheoremInequalityRewriter } from './rewriter';
import { IsEquationImplied } from '../decision/equation';
import { IsInequalityImplied } from '../decision/inequality';
import { UserError } from '../facts/user_error';
import { TacticAst, AlgebraTacticAst, SubstituteTacticAst, DefinitionTacticAst, ApplyTacticAst } from './tactics_ast';

export const RULE_ALGEBRA = 2;
export const RULE_SUBSTITUTE = 3;
export const RULE_DEFINITION = 4;
export const RULE_APPLY = 5;

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

  /** Returns the corresponding backward tactic AST. */
  abstract reverse(): TacticAst;

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
  knownIndices: number[];

  constructor(env: Environment, formula: Formula, ...knowns: number[]) {
    super(RULE_ALGEBRA);
    this.formula = formula;
    this.knownIndices = knowns;
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

  reverse(): TacticAst {
    return new AlgebraTacticAst(this.formula.op, this.formula.left,
        this.knownIndices);
  }
}

/**
 * Substitution rule: replaces one occurrence of one side of a given fact
 * with the other in the current expression.
 *
 * For equations (=): replaces anywhere, producing an equality.
 * For inequalities (< or <=): replaces only at positive or negative positions.
 *   Positive: ex op result (same direction as the fact).
 *   Negative: result flippedOp ex (sides and op both flip).
 *
 * right = true (subst): replace left side with right side.
 * right = false (unsub): replace right side with left side.
 */
export class SubstituteRule extends Rule {
  ex: Expression;
  eq: Formula;
  right: boolean;
  knownIndex: number;
  _resultFormula: Formula;

  constructor(env: Environment, ex: Expression, known: number, right: boolean, result?: Expression) {
    super(RULE_SUBSTITUTE);

    this.eq = env.getFact(known);
    this.ex = ex;
    this.right = right;
    this.knownIndex = known;

    const from = right ? this.eq.left : this.eq.right;
    const to = right ? this.eq.right : this.eq.left;

    if (this.eq.op === OP_EQUAL) {
      const rewriter = new EquationRewriter('subst', ex, from, to);
      this._resultFormula = new Formula(ex, OP_EQUAL, rewriter.rewrite(result));
    } else {
      const rewriter = new InequalityRewriter('subst', ex, from, to);
      rewriter.rewrite(result);
      if (rewriter.positive) {
        this._resultFormula = new Formula(ex, this.eq.op, rewriter.result);
      } else {
        const flippedOp: FormulaOp =
            this.eq.op === OP_LESS_THAN ? OP_LESS_EQUAL : OP_LESS_THAN;
        this._resultFormula = new Formula(rewriter.result, flippedOp, ex);
      }
    }
  }

  doApply(): Formula {
    return this._resultFormula;
  }

  reverse(): TacticAst {
    return new SubstituteTacticAst(this.knownIndex, this.right);
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
  name: string;
  right: boolean;
  knownIndices: number[];
  _result: Expression;

  constructor(env: Environment, ex: Expression, name: string, right: boolean,
      knowns: number[] = [], result?: Expression) {
    super(RULE_DEFINITION);
    this.ex = ex;
    this.name = name;
    this.right = right;
    this.knownIndices = knowns;
    const def = lookupDefinition(env, name);
    this.defFormula = def.formula;
    const knownFacts = knowns.map(i => env.getFact(i));

    if (def.condition && knowns.length === 0)
      throw new UserError(
          `defof/undef: "${name}" has a condition; known facts must be provided`);
    if (!def.condition && knowns.length > 0)
      throw new UserError(
          `defof/undef: "${name}" has no condition; known facts must not be provided`);

    const rewriter = new DefinitionRewriter(
        'defof/undef', env, ex, def.formula, right,
        def.condition, knownFacts);
    this._result = rewriter.rewrite(result);
  }

  doApply(): Formula {
    return new Formula(this.ex, OP_EQUAL, this._result);
  }

  reverse(): TacticAst {
    return new DefinitionTacticAst(this.name, this.right, this.knownIndices);
  }
}

/**
 * Apply rule: applies a theorem by unification.
 *
 * apply name (right = true): match left side of conclusion, replace with right.
 * unapp name (right = false): match right side of conclusion, replace with left.
 *
 * For equation conclusions: produces an equality, uses full tree walk.
 * For inequality conclusions: produces an inequality, uses polarity-aware walk.
 * If the theorem has a premise, the user must cite facts that imply it.
 */
export class ApplyRule extends Rule {
  ex: Expression;
  name: string;
  right: boolean;
  knownIndices: number[];
  _resultFormula: Formula;

  constructor(env: Environment, ex: Expression, name: string, right: boolean,
      knowns: number[] = [], result?: Expression) {
    super(RULE_APPLY);
    this.ex = ex;
    this.name = name;
    this.right = right;
    this.knownIndices = knowns;

    if (!env.hasTheorem(name))
      throw new UserError(`apply/unapp: unknown theorem "${name}"`);
    const theorem = env.getTheorem(name);
    const knownFacts = knowns.map(i => env.getFact(i));

    if (theorem.premise && knowns.length === 0)
      throw new UserError(
          `apply/unapp: "${name}" has a premise; known facts must be provided`);
    if (!theorem.premise && knowns.length > 0)
      throw new UserError(
          `apply/unapp: "${name}" has no premise; known facts must not be provided`);

    if (theorem.conclusion.op === OP_EQUAL) {
      const rewriter = new TheoremEquationRewriter(
          'apply/unapp', env, ex, theorem.conclusion, right,
          theorem.premise, knownFacts);
      this._resultFormula = new Formula(ex, OP_EQUAL, rewriter.rewrite(result));
    } else {
      const rewriter = new TheoremInequalityRewriter(
          'apply/unapp', env, ex, theorem.conclusion, right,
          theorem.premise, knownFacts);
      rewriter.rewrite(result);
      if (rewriter.positive) {
        this._resultFormula = new Formula(ex, theorem.conclusion.op, rewriter.result);
      } else {
        const flippedOp: FormulaOp =
            theorem.conclusion.op === OP_LESS_THAN ? OP_LESS_EQUAL : OP_LESS_THAN;
        this._resultFormula = new Formula(rewriter.result, flippedOp, ex);
      }
    }
  }

  doApply(): Formula {
    return this._resultFormula;
  }

  reverse(): TacticAst {
    return new ApplyTacticAst(this.name, this.right, this.knownIndices);
  }
}
