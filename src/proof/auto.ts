/**
 * The "auto" proof tactic: tries to prove an equation goal using equality
 * saturation in an e-graph, plus algebra (IsEquationImplied) as the only
 * equivalence-discovery rule for this first version.
 *
 * The idea is to seed an e-graph with the goal's sides and the sides of each
 * cited known equation, union the knowns, and then extract one representative
 * per e-class and ask algebra whether each pair of classes is provably equal.
 * Successful algebra pairs are unioned into the graph, and a final rebuild
 * propagates congruence upward through any parent terms. The goal is proved
 * if its two sides end up in the same class.
 */

import { Formula, OP_EQUAL } from '../facts/formula';
import { Prop, AtomProp } from '../facts/prop';
import { Environment } from '../types/env';
import { Match } from '../calc/calc_complete';
import { UserError } from '../facts/user_error';
import { EGraph, EClassId } from '../egraph/egraph';
import { IsEquationImplied } from '../decision/equation';
import { ProofTactic, ProofGoal, ProofMethodParser, ParsedMethod, parseTacticMethod } from './proof_tactic';


export class AutoTactic implements ProofTactic {
  private goalFormula: Formula;
  private known: Formula[];

  constructor(env: Environment, goal: Prop, refs: number[]) {
    if (goal.tag !== 'atom' || goal.formula.op !== OP_EQUAL)
      throw new UserError('auto requires an equation goal', 0, 0, 0);
    this.goalFormula = goal.formula;

    this.known = refs.map(i => {
      const prop = env.getFact(i);
      if (!(prop instanceof AtomProp) || prop.formula.op !== OP_EQUAL)
        throw new UserError(
            `auto: fact ${i} is not an equation`, 0, 0, 0);
      return prop.formula;
    });
  }

  decompose(): ProofGoal[] {
    const egraph = new EGraph();

    // Seed: goal sides and each known's sides all go into the graph. Adding
    // returns a class id; duplicates (structurally-equal sub-expressions) are
    // deduplicated by the hashcons.
    const leftId = egraph.add(this.goalFormula.left);
    const rightId = egraph.add(this.goalFormula.right);
    const knownPairs: [EClassId, EClassId][] = this.known.map(
        eq => [egraph.add(eq.left), egraph.add(eq.right)]);

    // Union each known pair so the graph reflects the asserted equalities;
    // rebuild propagates congruence to any parent terms.
    for (const [a, b] of knownPairs) egraph.union(a, b);
    egraph.rebuild();

    if (!egraph.equiv(leftId, rightId)) {
      // Single algebra pass: extract one representative per class and ask
      // IsEquationImplied whether each pair of classes is equal under the
      // cited knowns. Successful pairs get unioned; a final rebuild then
      // propagates congruence upward through any parent terms.
      const ids = egraph.classIds();
      const reps = ids.map(id => egraph.extract(id));
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          const eq = new Formula(reps[i], OP_EQUAL, reps[j]);
          if (IsEquationImplied(this.known, eq)) egraph.union(ids[i], ids[j]);
        }
      }
      egraph.rebuild();
    }

    if (egraph.equiv(leftId, rightId)) return [];

    throw new UserError(
        `auto: could not prove ${this.goalFormula.to_string()}`, 0, 0, 0);
  }
}


export const autoParser: ProofMethodParser = {
  tryParse(text: string, goal: Prop, env: Environment): ParsedMethod | string | null {
    const method = parseTacticMethod(text);
    if (method?.kind !== 'auto') return null;
    if (goal.tag !== 'atom' || goal.formula.op !== OP_EQUAL)
      return 'auto requires an equation goal';
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
