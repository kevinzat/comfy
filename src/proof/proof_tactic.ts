import { Formula } from '../facts/formula';
import { Prop } from '../facts/prop';
import { Environment } from '../types/env';
import { TheoremAst } from '../lang/theorem_ast';
import { Match } from '../calc/calc_complete';
import { TacticProofNode } from './proof_file';
import { InductionTactic, inductionParser } from './induction';
import { CasesTactic, casesParser } from './cases';
import { calculationParser } from './calc_proof';


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
  | { kind: 'cases'; condition: string };

export function parseTacticMethod(text: string): TacticMethod | null {
  const trimmed = text.trim();
  if (trimmed === 'calculation') return { kind: 'calculate' };

  const indMatch = trimmed.match(/^induction\s+on\s+(\S+)(?:\s+\(([^)]+)\))?$/);
  if (indMatch) {
    const argNames = indMatch[2]
        ? indMatch[2].split(',').map(s => s.trim())
        : undefined;
    return { kind: 'induction', varName: indMatch[1], argNames };
  }

  const casesMatch = trimmed.match(/^cases\s+on\s+(.+)$/);
  if (casesMatch) {
    return { kind: 'cases', condition: casesMatch[1] };
  }

  return null;
}

// --- UI parsing & completion ---

export type ParsedMethod =
  | { kind: 'calculate' }
  | { kind: 'tactic'; tactic: ProofTactic };

export interface ProofMethodParser {
  tryParse(text: string, formula: Formula, env: Environment,
      premises: Prop[]): ParsedMethod | string | null;
  getMatches(text: string, formula: Formula, env: Environment): Match[];
}

const parsers: ProofMethodParser[] = [
  calculationParser,
  inductionParser,
  casesParser,
];

export function ParseProofMethod(
    text: string, formula: Formula, env: Environment,
    premises: Prop[]): ParsedMethod | string {
  const trimmed = text.trim();
  if (trimmed === '') return 'expected "calculation", "induction on <variable>", or "cases on <inequality>"';
  for (const parser of parsers) {
    const result = parser.tryParse(trimmed, formula, env, premises);
    if (result !== null) return result;
  }
  return 'expected "calculation", "induction on <variable>", or "cases on <inequality>"';
}

export function FindProofMethodMatches(
    text: string, formula: Formula, env: Environment): Match[] {
  const matches: Match[] = [];
  for (const parser of parsers) {
    matches.push(...parser.getMatches(text, formula, env));
  }
  return matches;
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
    case 'cases':     return new CasesTactic(goal, env, method, node);
  }
}
