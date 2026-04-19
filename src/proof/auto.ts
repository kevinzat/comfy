/**
 * The "auto" proof tactic: tries to prove an equation or inequality goal using
 * an e-graph for call-congruence plus IsEquationImplied / IsInequalityImplied
 * for the underlying arithmetic.
 *
 * The pipeline, per iteration of the outer loop, is:
 *
 *   1. Canonicalize the goal and each known by replacing every non-arithmetic
 *      function call with the canonical form of its e-class. Arithmetic
 *      operations (+, *, etc.), constants, and variables are preserved. This
 *      lets the decision procedure see matching string forms for subterms the
 *      e-graph has already proved equal.
 *   2. Ask IsEquationImplied / IsInequalityImplied whether the canonicalized
 *      knowns prove the canonicalized goal. If yes, we're done.
 *   3. Otherwise run an algebra pass: for each pair of non-equivalent classes,
 *      extract a representative and ask IsEquationImplied whether they're
 *      equal under the knowns. Successful pairs are unioned, and a rebuild
 *      propagates any resulting congruences.
 *   4. If the algebra pass made no merges, the goal is unprovable by auto.
 *
 * The outer loop matters because a union made during the algebra pass can
 * change the canonical rep of a class, which may in turn unblock a pair that
 * was not provable in a previous iteration.
 */

import {
  Expression, Call,
  EXPR_CONSTANT, EXPR_VARIABLE, EXPR_FUNCTION,
  FUNC_ADD, FUNC_MULTIPLY, FUNC_SUBTRACT, FUNC_NEGATE, FUNC_EXPONENTIATE,
} from '../facts/exprs';
import { Formula, FormulaOp, OP_EQUAL, OP_LESS_THAN, OP_LESS_EQUAL } from '../facts/formula';
import { Prop, AtomProp } from '../facts/prop';
import { Environment } from '../types/env';
import { Match } from '../calc/calc_complete';
import { UserError } from '../facts/user_error';
import { EGraph, EClassId } from '../egraph/egraph';
import { IsEquationImplied } from '../decision/equation';
import { IsInequalityImplied } from '../decision/inequality';
import { ProofTactic, ProofGoal, ProofMethodParser, ParsedMethod, parseTacticMethod } from './proof_tactic';


const ARITHMETIC_OPS = new Set<string>([
  FUNC_ADD, FUNC_MULTIPLY, FUNC_SUBTRACT, FUNC_NEGATE, FUNC_EXPONENTIATE,
]);


function isSupportedOp(op: FormulaOp): boolean {
  return op === OP_EQUAL || op === OP_LESS_THAN || op === OP_LESS_EQUAL;
}


/**
 * Returns a copy of expr with every non-arithmetic call subterm replaced by
 * the canonical form of its e-class (via egraph.extract). Preserves the
 * structure of constants, variables, and arithmetic operations so the
 * decision procedure can reason about them linearly.
 */
function canonicalize(expr: Expression, egraph: EGraph): Expression {
  if (expr.variety === EXPR_CONSTANT) return expr;
  if (expr.variety === EXPR_VARIABLE) return expr;
  // EXPR_FUNCTION
  if (ARITHMETIC_OPS.has(expr.name)) {
    return new Call(expr.name, expr.args.map(a => canonicalize(a, egraph)));
  }
  // Non-arithmetic call: every subterm that's already in the graph canonicalizes
  // via extract, so opaque calls equivalent in the graph produce the same form.
  return egraph.extract(egraph.add(expr));
}


function canonicalizeFormula(f: Formula, egraph: EGraph): Formula {
  return new Formula(canonicalize(f.left, egraph), f.op, canonicalize(f.right, egraph));
}


export class AutoTactic implements ProofTactic {
  private goalFormula: Formula;
  private known: Formula[];

  constructor(env: Environment, goal: Prop, refs: number[]) {
    if (goal.tag !== 'atom' || !isSupportedOp(goal.formula.op))
      throw new UserError('auto requires an equation or inequality goal', 0, 0, 0);
    this.goalFormula = goal.formula;

    this.known = refs.map(i => {
      const prop = env.getFact(i);
      if (!(prop instanceof AtomProp) || !isSupportedOp(prop.formula.op))
        throw new UserError(
            `auto: fact ${i} is not an equation or inequality`, 0, 0, 0);
      return prop.formula;
    });
  }

  decompose(): ProofGoal[] {
    const egraph = new EGraph();

    // Seed: goal sides and each known's sides enter the graph.
    egraph.add(this.goalFormula.left);
    egraph.add(this.goalFormula.right);
    const knownIds: [EClassId, EClassId][] = this.known.map(
        k => [egraph.add(k.left), egraph.add(k.right)]);

    // Union each equation known; inequality knowns are reasoned about only
    // through the outermost IsInequalityImplied call.
    for (let i = 0; i < this.known.length; i++) {
      if (this.known[i].op === OP_EQUAL) egraph.union(knownIds[i][0], knownIds[i][1]);
    }
    egraph.rebuild();

    while (true) {
      const canonKnowns = this.known.map(k => canonicalizeFormula(k, egraph));
      const canonGoal = canonicalizeFormula(this.goalFormula, egraph);

      // Outermost check: does the decision procedure prove the canonical goal?
      // IsInequalityImplied handles all three ops as both premises and goal,
      // including deriving an equation from a pair of inequalities.
      if (IsInequalityImplied(canonKnowns, canonGoal)) return [];

      // Algebra pass: for each non-equivalent pair of classes, ask the decision
      // procedure whether their reps are equal. Successful pairs are unioned,
      // and a rebuild propagates new congruences. Only equation-typed canonical
      // knowns contribute here, since we're discovering equalities.
      const eqKnowns = canonKnowns.filter(k => k.op === OP_EQUAL);
      const ids = egraph.classIds();
      const reps = ids.map(id => egraph.extract(id));
      let merged = false;
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          if (egraph.equiv(ids[i], ids[j])) continue;
          const eq = new Formula(reps[i], OP_EQUAL, reps[j]);
          if (IsEquationImplied(eqKnowns, eq)) {
            egraph.union(ids[i], ids[j]);
            merged = true;
          }
        }
      }
      if (!merged) break;
      egraph.rebuild();
    }

    throw new UserError(
        `auto: could not prove ${this.goalFormula.to_string()}`, 0, 0, 0);
  }
}


export const autoParser: ProofMethodParser = {
  tryParse(text: string, goal: Prop, env: Environment): ParsedMethod | string | null {
    const method = parseTacticMethod(text);
    if (method?.kind !== 'auto') return null;
    if (goal.tag !== 'atom' || !isSupportedOp(goal.formula.op))
      return 'auto requires an equation or inequality goal';
    try {
      return { kind: 'tactic', tactic: new AutoTactic(env, goal, method.refs) };
    } catch (e) {
      /* v8 ignore start */
      if (!(e instanceof UserError)) throw new Error(`unexpected: ${e}`);
      /* v8 ignore stop */
      return e.message;
    }
  },

  getMatches(text: string): Match[] {
    const trimmed = text.trim();
    if ('auto'.startsWith(trimmed) && trimmed.length > 0) {
      return [{
        description: [
          { bold: true, text: trimmed },
          { bold: false, text: 'auto'.substring(trimmed.length) },
        ],
        completion: 'auto',
      }];
    } else if (trimmed.startsWith('auto ')) {
      return [{
        description: [
          { bold: true, text: trimmed },
          { bold: false, text: '' },
        ],
        completion: trimmed,
      }];
    }
    return [];
  },
};
