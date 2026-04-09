import { Formula } from '../facts/formula';
import { Prop, AtomProp, NotProp, ConstProp, OrProp, Literal } from '../facts/prop';
import { NestedEnv } from '../types/env';
import { ParseFormula } from '../facts/formula_parser';
import { Environment } from '../types/env';
import { Match } from '../calc/calc_complete';
import { ProofTactic, ProofGoal, ProofMethodParser, ParsedMethod, TacticMethod, parseTacticMethod } from './proof_tactic';


// --- Verum: proves "true" with no subgoals ---

export class VerumTactic implements ProofTactic {
  decompose(): ProofGoal[] {
    return [];
  }
}

export const verumParser: ProofMethodParser = {
  tryParse(text: string, _formula: Formula, _env: Environment): ParsedMethod | string | null {
    const method = parseTacticMethod(text);
    if (method?.kind !== 'verum') return null;
    return { kind: 'tactic', tactic: new VerumTactic() };
  },

  getMatches(text: string): Match[] {
    const trimmed = text.trim();
    if ('verum'.startsWith(trimmed) && trimmed.length > 0) {
      return [{
        description: [
          { bold: true, text: trimmed },
          { bold: false, text: 'verum'.substring(trimmed.length) },
        ],
        completion: 'verum',
      }];
    }
    return [];
  },
};


// --- Exfalso: proves any goal by generating subgoal "false" ---

export class ExfalsoTactic implements ProofTactic {
  constructor(private env: Environment) {}

  decompose(): ProofGoal[] {
    return [{
      label: 'false',
      goal: new ConstProp(false),
      env: this.env,
      newTheorems: [],
      newFacts: [],
    }];
  }
}

export const exfalsoParser: ProofMethodParser = {
  tryParse(text: string, _formula: Formula, env: Environment): ParsedMethod | string | null {
    const method = parseTacticMethod(text);
    if (method?.kind !== 'exfalso') return null;
    return { kind: 'tactic', tactic: new ExfalsoTactic(env) };
  },

  getMatches(text: string): Match[] {
    const trimmed = text.trim();
    if ('exfalso'.startsWith(trimmed) && trimmed.length > 0) {
      return [{
        description: [
          { bold: true, text: trimmed },
          { bold: false, text: 'exfalso'.substring(trimmed.length) },
        ],
        completion: 'exfalso',
      }];
    }
    return [];
  },
};


// --- Contradiction: proves false from P and not P ---

export class ContradictionTactic implements ProofTactic {
  constructor(private env: Environment, private formula: Formula) {}

  decompose(): ProofGoal[] {
    return [
      {
        label: this.formula.to_string(),
        goal: new AtomProp(this.formula),
        env: this.env,
        newTheorems: [],
        newFacts: [],
      },
      {
        label: `not ${this.formula.to_string()}`,
        goal: new NotProp(this.formula),
        env: this.env,
        newTheorems: [],
        newFacts: [],
      },
    ];
  }
}

export const contradictionParser: ProofMethodParser = {
  tryParse(text: string, _formula: Formula, env: Environment): ParsedMethod | string | null {
    const method = parseTacticMethod(text);
    if (method?.kind !== 'contradiction') return null;
    let formula: Formula;
    try {
      formula = ParseFormula(method.condition);
    } catch (_e) {
      return 'syntax error in contradiction formula';
    }
    return { kind: 'tactic', tactic: new ContradictionTactic(env, formula) };
  },

  getMatches(text: string): Match[] {
    const trimmed = text.trim();
    if ('contradiction'.startsWith(trimmed) && trimmed.length > 0) {
      return [{
        description: [
          { bold: true, text: trimmed },
          { bold: false, text: 'contradiction'.substring(trimmed.length) + ' ...' },
        ],
        completion: 'contradiction ',
      }];
    } else if (trimmed.startsWith('contradiction ')) {
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


// --- Absurdum: proves "not P" by assuming P and proving false ---

export class AbsurdumTactic implements ProofTactic {
  constructor(private env: Environment, private formula: Formula) {}

  decompose(): ProofGoal[] {
    const p = new AtomProp(this.formula);
    const newEnv = new NestedEnv(this.env, [], [p]);
    return [{
      label: 'false',
      goal: new ConstProp(false),
      env: newEnv,
      newTheorems: [],
      newFacts: [p],
    }];
  }
}

export const absurdumParser: ProofMethodParser = {
  tryParse(text: string, formula: Formula, env: Environment): ParsedMethod | string | null {
    const method = parseTacticMethod(text);
    if (method?.kind !== 'absurdum') return null;
    return { kind: 'tactic', tactic: new AbsurdumTactic(env, formula) };
  },

  getMatches(text: string): Match[] {
    const trimmed = text.trim();
    if ('absurdum'.startsWith(trimmed) && trimmed.length > 0) {
      return [{
        description: [
          { bold: true, text: trimmed },
          { bold: false, text: 'absurdum'.substring(trimmed.length) },
        ],
        completion: 'absurdum',
      }];
    }
    return [];
  },
};


// --- Left: proves "P or Q" with subgoal P ---

export class LeftTactic implements ProofTactic {
  constructor(private env: Environment, private goal: OrProp) {}

  decompose(): ProofGoal[] {
    const p = this.goal.disjuncts[0];
    return [{
      label: p.to_string(),
      goal: p,
      env: this.env,
      newTheorems: [],
      newFacts: [],
    }];
  }
}

export const leftParser: ProofMethodParser = {
  tryParse(text: string, _formula: Formula, env: Environment): ParsedMethod | string | null {
    const method = parseTacticMethod(text);
    if (method?.kind !== 'left') return null;
    return { kind: 'tactic', tactic: new LeftTactic(env, new OrProp([])) };
  },

  getMatches(text: string): Match[] {
    const trimmed = text.trim();
    if ('left'.startsWith(trimmed) && trimmed.length > 0) {
      return [{
        description: [
          { bold: true, text: trimmed },
          { bold: false, text: 'left'.substring(trimmed.length) },
        ],
        completion: 'left',
      }];
    }
    return [];
  },
};


// --- Right: proves "P or Q" with subgoal Q ---

export class RightTactic implements ProofTactic {
  constructor(private env: Environment, private goal: OrProp) {}

  decompose(): ProofGoal[] {
    const q = this.goal.disjuncts[this.goal.disjuncts.length - 1];
    return [{
      label: q.to_string(),
      goal: q,
      env: this.env,
      newTheorems: [],
      newFacts: [],
    }];
  }
}

export const rightParser: ProofMethodParser = {
  tryParse(text: string, _formula: Formula, env: Environment): ParsedMethod | string | null {
    const method = parseTacticMethod(text);
    if (method?.kind !== 'right') return null;
    return { kind: 'tactic', tactic: new RightTactic(env, new OrProp([])) };
  },

  getMatches(text: string): Match[] {
    const trimmed = text.trim();
    if ('right'.startsWith(trimmed) && trimmed.length > 0) {
      return [{
        description: [
          { bold: true, text: trimmed },
          { bold: false, text: 'right'.substring(trimmed.length) },
        ],
        completion: 'right',
      }];
    }
    return [];
  },
};


// --- DisjCases: proves R from known P or Q, with subgoals [P or Q, R+P, R+Q] ---

export class DisjCasesTactic implements ProofTactic {
  constructor(
    private env: Environment,
    private goal: Prop,
    private disjuncts: Literal[],
  ) {}

  decompose(): ProofGoal[] {
    const orProp = new OrProp(this.disjuncts);
    const goals: ProofGoal[] = [{
      label: orProp.to_string(),
      goal: orProp,
      env: this.env,
      newTheorems: [],
      newFacts: [],
    }];
    for (const d of this.disjuncts) {
      const newEnv = new NestedEnv(this.env, [], [d]);
      goals.push({
        label: d.to_string(),
        goal: this.goal,
        env: newEnv,
        newTheorems: [],
        newFacts: [d],
      });
    }
    return goals;
  }
}

export const disjCasesParser: ProofMethodParser = {
  tryParse(text: string, _formula: Formula, env: Environment): ParsedMethod | string | null {
    const method = parseTacticMethod(text);
    if (method?.kind !== 'disj_cases') return null;
    const parts = method.condition.split(' or ');
    if (parts.length < 2) return 'expected "cases P or Q"';
    const disjuncts: Literal[] = [];
    for (const part of parts) {
      const trimmed = part.trim();
      let lit: Literal;
      const notMatch = trimmed.match(/^not\s+(.+)$/);
      if (notMatch) {
        try {
          lit = new NotProp(ParseFormula(notMatch[1]));
        } catch (_e) {
          return 'syntax error in cases formula';
        }
      } else {
        try {
          lit = new AtomProp(ParseFormula(trimmed));
        } catch (_e) {
          return 'syntax error in cases formula';
        }
      }
      disjuncts.push(lit);
    }
    return { kind: 'tactic', tactic: new DisjCasesTactic(env, new AtomProp(ParseFormula('0 = 0')), disjuncts) };
  },

  getMatches(text: string): Match[] {
    const trimmed = text.trim();
    if ('cases'.startsWith(trimmed) && trimmed.length > 0) {
      return [{
        description: [
          { bold: true, text: trimmed },
          { bold: false, text: 'cases'.substring(trimmed.length) + ' ...' },
        ],
        completion: 'cases ',
      }];
    } else if (trimmed.startsWith('cases ')) {
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
