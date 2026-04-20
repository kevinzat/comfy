import { Formula, OP_EQUAL, OP_LESS_THAN } from '../facts/formula';
import { ParseFormula } from '../facts/formula_parser';
import { Prop, OrProp, AtomProp, NotProp, Literal } from '../facts/prop';
import { Environment } from '../types/env';
import { TheoremAst } from '../lang/theorem_ast';
import { Match } from '../calc/calc_complete';
import { TacticProofNode } from './proof_file';
import { InductionTactic, inductionParser } from './induction';
import { CasesTactic, casesParser } from './cases';
import { calculationParser } from './calc_proof';
import { VerumTactic, verumParser, ExfalsoTactic, exfalsoParser, ContradictionTactic, contradictionParser, AbsurdumTactic, absurdumParser, LeftTactic, leftParser, RightTactic, rightParser, DisjCasesTactic, disjCasesParser, HaveTactic, haveParser } from './prop_tactics';
import { ParseProp } from '../facts/props_parser';
import { TypeCasesTactic, typeCasesParser } from './type_cases';
import { AutoTactic, autoParser } from './auto';


export interface ProofGoal {
  label: string;
  goal: Prop;
  env: Environment;
  newTheorems: TheoremAst[];
  newFacts: Prop[];
}

export interface ProofTactic {
  decompose(): ProofGoal[];
}

// --- Shared tactic method parsing ---

export type TacticMethod =
  | { kind: 'calculate' }
  | { kind: 'induction'; varName: string; argNames?: string[] }
  | { kind: 'simple_cases'; condition: string }
  | { kind: 'verum' }
  | { kind: 'exfalso' }
  | { kind: 'contradiction'; condition: string }
  | { kind: 'absurdum' }
  | { kind: 'left' }
  | { kind: 'right' }
  | { kind: 'disj_cases'; condition: string }
  | { kind: 'type_cases'; varName: string; argNames?: string[] }
  | { kind: 'have'; condition: string }
  | { kind: 'auto'; refs: Array<number | string> };

export function parseTacticMethod(text: string): TacticMethod | null {
  const trimmed = text.trim();
  if (trimmed === 'calculation') return { kind: 'calculate' };
  if (trimmed === 'verum') return { kind: 'verum' };
  if (trimmed === 'exfalso') return { kind: 'exfalso' };
  if (trimmed === 'absurdum') return { kind: 'absurdum' };
  if (trimmed === 'left') return { kind: 'left' };
  if (trimmed === 'right') return { kind: 'right' };

  const typeCasesMatch = trimmed.match(/^cases\s+on\s+(\S+)(?:\s+\(([^)]+)\))?$/);
  if (typeCasesMatch) {
    const argNames = typeCasesMatch[2]
        ? typeCasesMatch[2].split(',').map(s => s.trim())
        : undefined;
    return { kind: 'type_cases', varName: typeCasesMatch[1], argNames };
  }

  const disjMatch = trimmed.match(/^cases\s+(.+)$/);
  if (disjMatch) {
    return { kind: 'disj_cases', condition: disjMatch[1] };
  }

  const haveMatch = trimmed.match(/^have\s+(.+)$/);
  if (haveMatch) {
    return { kind: 'have', condition: haveMatch[1] };
  }

  const contrMatch = trimmed.match(/^contradiction\s+(.+)$/);
  if (contrMatch) {
    return { kind: 'contradiction', condition: contrMatch[1] };
  }

  const indMatch = trimmed.match(/^induction\s+on\s+(\S+)(?:\s+\(([^)]+)\))?$/);
  if (indMatch) {
    const argNames = indMatch[2]
        ? indMatch[2].split(',').map(s => s.trim())
        : undefined;
    return { kind: 'induction', varName: indMatch[1], argNames };
  }

  const casesMatch = trimmed.match(/^simple\s+cases\s+on\s+(.+)$/);
  if (casesMatch) {
    return { kind: 'simple_cases', condition: casesMatch[1] };
  }

  const autoMatch = trimmed.match(/^auto(?:\s+([A-Za-z_0-9][\w]*(?:\s+[A-Za-z_0-9][\w]*)*))?$/);
  if (autoMatch) {
    const refs: Array<number | string> = autoMatch[1]
        ? autoMatch[1].split(/\s+/).map(s => /^\d+$/.test(s) ? parseInt(s, 10) : s)
        : [];
    return { kind: 'auto', refs };
  }

  return null;
}

// --- UI parsing & completion ---

export type ParsedMethod =
  | { kind: 'calculate' }
  | { kind: 'tactic'; tactic: ProofTactic };

export interface ProofMethodParser {
  tryParse(text: string, goal: Prop, env: Environment,
      premises: Prop[]): ParsedMethod | string | null;
  getMatches(text: string, formula: Formula, env: Environment): Match[];
}

const parsers: ProofMethodParser[] = [
  calculationParser,
  inductionParser,
  casesParser,
  verumParser,
  exfalsoParser,
  contradictionParser,
  absurdumParser,
  leftParser,
  rightParser,
  disjCasesParser,
  typeCasesParser,
  haveParser,
  autoParser,
];

export function ParseProofMethod(
    text: string, goal: Prop, env: Environment,
    premises: Prop[]): ParsedMethod | string {
  const trimmed = text.trim();
  if (trimmed === '') return 'expected "calculation", "induction on <variable>", or "simple cases on <inequality>"';
  for (const parser of parsers) {
    const result = parser.tryParse(trimmed, goal, env, premises);
    if (result !== null) return result;
  }
  return 'expected "calculation", "induction on <variable>", or "simple cases on <inequality>"';
}

export function FindProofMethodMatches(
    text: string, formula: Formula, env: Environment): Match[] {
  const matches: Match[] = [];
  for (const parser of parsers) {
    matches.push(...parser.getMatches(text, formula, env));
  }
  return matches;
}

/**
 * Filters out goals that are already known facts in their environment.
 * Returns only the goals that still need to be proved.
 */
export function filterDischargedGoals(goals: ProofGoal[]): ProofGoal[] {
  return goals.filter(g => !g.env.isKnownFact(g.goal));
}

export function CreateProofTactic(
    node: TacticProofNode, goal: Prop, env: Environment,
    premises: Prop[]): ProofTactic {
  const method = parseTacticMethod(node.method);
  /* v8 ignore start */
  if (method === null || method.kind === 'calculate')
    throw new Error(`unexpected tactic method: ${node.method}`);
  /* v8 ignore stop */
  switch (method.kind) {
    case 'induction': return new InductionTactic(goal, env, method, node, premises);
    case 'simple_cases': return new CasesTactic(goal, env, method, node);
    case 'verum': return new VerumTactic();
    case 'exfalso': return new ExfalsoTactic(env);
    case 'contradiction':
      return new ContradictionTactic(env, ParseFormula(method.condition));
    case 'absurdum':
      /* v8 ignore start */
      if (goal.tag !== 'not') throw new Error('absurdum requires a negation goal');
      /* v8 ignore stop */
      return new AbsurdumTactic(env, goal.formula);
    case 'left':
    case 'right': {
      let orGoal: OrProp;
      if (goal.tag === 'or') {
        orGoal = goal;
      } else if (goal.tag === 'not' && goal.formula.op === OP_EQUAL) {
        // not(a = b) ≡ (a < b) or (b < a)
        const { left, right } = goal.formula;
        orGoal = new OrProp([
          new AtomProp(new Formula(left, OP_LESS_THAN, right)),
          new AtomProp(new Formula(right, OP_LESS_THAN, left)),
        ]);
      /* v8 ignore start */
      } else {
        throw new Error(`${method.kind} requires a disjunction goal`);
      }
      /* v8 ignore stop */
      return method.kind === 'left'
          ? new LeftTactic(env, orGoal)
          : new RightTactic(env, orGoal);
    }
    case 'disj_cases': {
      const parts = method.condition.split(' or ');
      const disjuncts: Literal[] = parts.map(part => {
        const trimmed = part.trim();
        const notMatch = trimmed.match(/^not\s+(.+)$/);
        if (notMatch) return new NotProp(ParseFormula(notMatch[1]));
        return new AtomProp(ParseFormula(trimmed));
      });
      return new DisjCasesTactic(env, goal, disjuncts);
    }
    case 'type_cases':
      return new TypeCasesTactic(goal, env, method);
    case 'have':
      return new HaveTactic(env, goal, ParseProp(method.condition));
    case 'auto':
      return new AutoTactic(env, goal, method.refs);
  }
}
