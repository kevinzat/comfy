import { Formula, OP_LESS_THAN, OP_LESS_EQUAL } from '../facts/formula';
import { ParseFormula } from '../facts/formula_parser';
import { Prop, AtomProp } from '../facts/prop';
import { Environment, NestedEnv } from '../types/env';
import { Match } from '../calc/calc_complete';
import { TacticProofNode } from './proof_file';
import { CheckError } from './proof_file_checker';
import { ProofTactic, ProofGoal, ProofMethodParser, ParsedMethod, TacticMethod, parseTacticMethod } from './proof_tactic';

export function negateCondition(f: Formula): Formula {
  if (f.op === OP_LESS_THAN) {
    return new Formula(f.right, OP_LESS_EQUAL, f.left);
  } else {
    return new Formula(f.right, OP_LESS_THAN, f.left);
  }
}

export interface CasesInfo {
  condition: Formula;
  negated: Formula;
  thenEnv: NestedEnv;
  elseEnv: NestedEnv;
}

export function buildCasesOnCondition(
    env: Environment, condition: Formula): CasesInfo {
  if (condition.op !== OP_LESS_THAN && condition.op !== OP_LESS_EQUAL) {
    throw new Error('cases condition must use < or <=');
  }
  const negated = negateCondition(condition);
  const thenEnv = new NestedEnv(env, [], [new AtomProp(condition)]);
  const elseEnv = new NestedEnv(env, [], [new AtomProp(negated)]);
  return { condition, negated, thenEnv, elseEnv };
}


// --- Parsing & completion ---

export const casesParser: ProofMethodParser = {
  tryParse(text: string, goal: Prop, env: Environment): ParsedMethod | string | null {
    const method = parseTacticMethod(text);
    if (method?.kind !== 'simple_cases') return null;
    let condition: Formula;
    try {
      condition = ParseFormula(method.condition);
    } catch (_e) {
      return 'syntax error in cases condition';
    }
    if (condition.op !== OP_LESS_THAN && condition.op !== OP_LESS_EQUAL) {
      return 'cases condition must use < or <=';
    }
    const node: TacticProofNode = { kind: 'tactic', method: text, methodLine: 0, cases: [] };
    const tactic = new CasesTactic(goal, env, method, node);
    return { kind: 'tactic', tactic };
  },

  getMatches(text: string): Match[] {
    const trimmed = text.trim();
    if ('simple cases on'.startsWith(trimmed) && trimmed.length > 0) {
      const desc = [
        { bold: true, text: trimmed },
        { bold: false, text: 'simple cases on'.substring(trimmed.length) + ' ...' },
      ];
      return [{ description: desc, completion: 'simple cases on ' }];
    } else if (trimmed.startsWith('simple cases on ')) {
      const desc = [
        { bold: true, text: trimmed },
        { bold: false, text: '' },
      ];
      return [{ description: desc, completion: trimmed }];
    }
    return [];
  },
};


// --- Checking ---

export class CasesTactic implements ProofTactic {
  constructor(
      private goal: Prop,
      private env: Environment,
      private method: Extract<TacticMethod, { kind: 'simple_cases' }>,
      private node: TacticProofNode) {
  }

  decompose(): ProofGoal[] {
    const { goal, env, method, node } = this;
    let condition: Formula;
    try {
      condition = ParseFormula(method.condition);
    } catch (e: any) {
      throw new CheckError(node.methodLine, `bad condition: ${e.message}`);
    }
    let info;
    try {
      info = buildCasesOnCondition(env, condition);
    } catch (e: any) {
      throw new CheckError(node.methodLine, e.message);
    }
    return [
      {
        label: condition.to_string(),
        goal,
        env: info.thenEnv,
        newTheorems: [],
        newFacts: [new AtomProp(condition)],
      },
      {
        label: info.negated.to_string(),
        goal,
        env: info.elseEnv,
        newTheorems: [],
        newFacts: [new AtomProp(info.negated)],
      },
    ];
  }
}
