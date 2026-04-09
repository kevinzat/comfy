import { Expression, Variable, Call } from '../facts/exprs';
import { Formula } from '../facts/formula';
import { Prop, AtomProp } from '../facts/prop';
import { Environment, NestedEnv } from '../types/env';
import { ConstructorAst } from '../lang/type_ast';
import { TheoremAst } from '../lang/theorem_ast';
import { Match } from '../calc/calc_complete';
import { TacticProofNode } from './proof_file';
import { ProofTactic, ProofGoal, ProofMethodParser, ParsedMethod, TacticMethod, parseTacticMethod } from './proof_tactic';


export interface CaseInfo {
  ctor: ConstructorAst;
  argNames: string[];
  argTypes: string[];
  goal: Prop;
  ihTheorems: TheoremAst[];
  ihArgNames: string[];
  env: NestedEnv;
}


/**
 * Computes the default variable name for a constructor parameter based on its
 * type name. Int parameters get the first available lowercase letter starting
 * from 'a'. Other types get the first available uppercase letter starting from
 * the first letter of the type name (e.g. List -> L, Tree -> T).
 *
 * The `used` set tracks names already taken by earlier parameters of the same
 * constructor to avoid internal clashes (e.g. node(Tree, Int, Tree) -> T, a, U).
 */
function defaultVarName(typeName: string, used: Set<string>): string {
  if (typeName === 'Int') {
    const letters = 'abcdefghijklmnopqrstuvwxyz';
    for (const ch of letters) {
      if (!used.has(ch)) return ch;
    }
  } else {
    const start = typeName[0].toUpperCase();
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const startIdx = alphabet.indexOf(start);
    for (let i = 0; i < alphabet.length; i++) {
      const ch = alphabet[(startIdx + i) % alphabet.length];
      if (!used.has(ch)) return ch;
    }
  }
  /* v8 ignore start */
  throw new Error('could not find a default variable name');
  /* v8 ignore stop */
}

/**
 * Computes default argument names for all parameters across all constructors
 * of the given type. Returns a flat list in constructor order.
 */
export function defaultArgNames(
    env: Environment, typeName: string, varName: string): string[] {
  const typeDecl = env.getTypeDecl(typeName);
  /* v8 ignore start */
  if (typeDecl === null) {
    throw new Error(`cannot induct on built-in type "${typeName}"`);
  }
  /* v8 ignore stop */
  const used = new Set<string>();
  used.add(varName);
  const names: string[] = [];
  for (const ctor of typeDecl.constructors) {
    for (const paramType of ctor.paramTypes) {
      const name = defaultVarName(paramType, used);
      names.push(name);
      used.add(name);
    }
  }
  return names;
}

/**
 * Computes the IH params: all variables in the formula that exist in the
 * environment, minus the induction variable. These are the universally
 * quantified parameters of the IH theorems.
 */
function computeIHParams(
    goal: Prop, env: Environment, varName: string): [string, string][] {
  const fvars = goal.vars();
  const params: [string, string][] = [];
  for (const name of fvars) {
    if (name === varName) continue;
    if (env.hasVariable(name)) {
      params.push([name, env.getVariable(name).name]);
    }
  }
  return params;
}

/**
 * Returns a theorem name that doesn't conflict with existing theorems in the
 * environment. If `base` is available, returns it. Otherwise appends 2, 3, ...
 */
function uniqueTheoremName(base: string, env: Environment): string {
  if (!env.hasTheorem(base)) return base;
  for (let i = 2; ; i++) {
    const candidate = base + i;
    if (!env.hasTheorem(candidate)) return candidate;
  }
}

export function buildCases(
  goal: Prop,
  env: Environment,
  varName: string,
  argNames?: string[],
  premises: Prop[] = [],
): CaseInfo[] {
  const varType = env.getVariable(varName);
  const typeName = varType.name;
  const ihParams = computeIHParams(goal, env, varName);

  const typeDecl = env.getTypeDecl(typeName);
  if (typeDecl === null) {
    throw new Error(`cannot induct on built-in type "${typeName}"`);
  }

  // Compute total number of constructor parameters.
  const totalParams = typeDecl.constructors.reduce(
      (sum, ctor) => sum + ctor.paramTypes.length, 0);

  // Determine names to use.
  let allNames: string[];
  if (argNames !== undefined) {
    /* v8 ignore start */
    if (argNames.length !== totalParams) {
      throw new Error(
          `expected ${totalParams} argument names, got ${argNames.length}`);
    }
    /* v8 ignore stop */
    allNames = argNames;
  } else {
    allNames = defaultArgNames(env, typeName, varName);
  }

  // Check for clashes with goal variables.
  const fvars = goal.vars();
  fvars.add(varName);
  for (const name of allNames) {
    if (fvars.has(name)) {
      throw new Error(
          `default argument name "${name}" clashes with a variable in the ` +
          `formula; provide explicit names, e.g. "induction on ${varName} (...)"`)
    }
  }

  // Check for duplicates within the names themselves.
  const seen = new Set<string>();
  for (const name of allNames) {
    /* v8 ignore start */
    if (seen.has(name)) {
      throw new Error(`duplicate argument name "${name}"`);
    }
    /* v8 ignore stop */
    seen.add(name);
  }

  const varExpr = Variable.of(varName);
  const cases: CaseInfo[] = [];
  let nameIdx = 0;

  for (const ctor of typeDecl.constructors) {
    const ctorArgNames = allNames.slice(nameIdx, nameIdx + ctor.paramTypes.length);
    nameIdx += ctor.paramTypes.length;

    let ctorExpr: Expression;
    if (ctorArgNames.length === 0) {
      ctorExpr = Variable.of(ctor.name);
    } else {
      ctorExpr = Call.of(ctor.name, ...ctorArgNames.map(n => Variable.of(n)));
    }

    const caseGoal = goal.subst(varExpr, ctorExpr);

    // Count recursive args to decide naming: IH if one, IH_<name> if multiple.
    const recursiveCount = ctor.paramTypes.filter(t => t === typeName).length;

    const ihTheorems: TheoremAst[] = [];
    const ihArgNames: string[] = [];
    for (let i = 0; i < ctor.paramTypes.length; i++) {
      if (ctor.paramTypes[i] === typeName) {
        const argExpr = Variable.of(ctorArgNames[i]);
        const ihConclusion = goal.subst(varExpr, argExpr);
        const ihPremises = premises.map(p => p.subst(varExpr, argExpr));
        const baseName = recursiveCount === 1
            ? 'IH' : 'IH_' + ctorArgNames[i];
        const ihName = uniqueTheoremName(baseName, env);
        ihTheorems.push(new TheoremAst(ihName, ihParams, ihPremises, ihConclusion));
        ihArgNames.push(ctorArgNames[i]);
      }
    }

    const newVars: [string, string][] = ctorArgNames.map((name, i): [string, string] =>
      [name, ctor.paramTypes[i]]
    );
    const nestedEnv = new NestedEnv(env, newVars, [], ihTheorems);

    cases.push({
      ctor,
      argNames: ctorArgNames,
      argTypes: ctor.paramTypes,
      goal: caseGoal,
      ihTheorems,
      ihArgNames,
      env: nestedEnv,
    });
  }

  return cases;
}


// --- Checking ---

// --- Parsing & completion ---

interface InductVar {
  name: string;
  defaultArgs: string;
}

function inductiveVars(env: Environment, formula: Formula): InductVar[] {
  const result: InductVar[] = [];
  const allVars = new Set([...formula.left.vars(), ...formula.right.vars()]);
  for (const name of allVars) {
    if (!env.hasVariable(name)) continue;
    const varType = env.getVariable(name);
    const typeDecl = env.getTypeDecl(varType.name);
    if (typeDecl !== null) {
      const names = defaultArgNames(env, varType.name, name);
      const defaultArgs = names.length > 0
          ? ' (' + names.join(', ') + ')' : '';
      result.push({ name, defaultArgs });
    }
  }
  result.sort((a, b) => a.name.localeCompare(b.name));
  return result;
}

export const inductionParser: ProofMethodParser = {
  tryParse(text: string, formula: Formula, env: Environment,
      premises: Prop[]): ParsedMethod | string | null {
    const method = parseTacticMethod(text);
    if (method?.kind !== 'induction') return null;
    const { varName, argNames } = method;
    if (!env.hasVariable(varName)) {
      return `unknown variable "${varName}"`;
    }
    const varType = env.getVariable(varName);
    const typeDecl = env.getTypeDecl(varType.name);
    if (typeDecl === null) {
      return `cannot do induction on built-in type "${varType.name}"`;
    }
    const goal = new AtomProp(formula);
    const node: TacticProofNode = { kind: 'tactic', method: text, methodLine: 0, cases: [] };
    const tactic = new InductionTactic(goal, env, method, node, premises);
    return { kind: 'tactic', tactic };
  },

  getMatches(text: string, formula: Formula, env: Environment): Match[] {
    const trimmed = text.trim();
    const inductVars = inductiveVars(env, formula);
    const matches: Match[] = [];

    const parts = trimmed.split(/\s+/);
    // Stop suggesting once the user has started typing the optional (...)
    if (parts.length > 3) return matches;

    const p0 = parts[0] || '';
    if (!'induction'.startsWith(p0)) return matches;

    if (parts.length === 1) {
      for (const v of inductVars) {
        const base = 'induction on ' + v.name;
        const remaining = 'induction'.substring(p0.length) + ' on ' + v.name;
        matches.push({
          description: p0.length > 0
            ? [{ bold: true, text: p0 }, { bold: false, text: remaining }]
            : [{ bold: false, text: base }],
          completion: base,
        });
        if (v.defaultArgs) {
          matches.push({
            description: p0.length > 0
              ? [{ bold: true, text: p0 }, { bold: false, text: remaining + v.defaultArgs }]
              : [{ bold: false, text: base + v.defaultArgs }],
            completion: base + v.defaultArgs,
          });
        }
      }
    } else if (parts.length >= 2 && p0 === 'induction') {
      const p1 = parts[1];
      if ('on'.startsWith(p1) && parts.length === 2) {
        for (const v of inductVars) {
          const base = 'induction on ' + v.name;
          const descBase = [
            { bold: true, text: 'induction' },
            { bold: false, text: ' ' },
            { bold: true, text: p1 },
            { bold: false, text: 'on'.substring(p1.length) + ' ' + v.name },
          ];
          matches.push({ description: [...descBase], completion: base });
          if (v.defaultArgs) {
            matches.push({
              description: [...descBase, { bold: false, text: v.defaultArgs }],
              completion: base + v.defaultArgs,
            });
          }
        }
      } else if (p1 === 'on' && parts.length === 3) {
        const p2 = parts[2];
        const matching = inductVars.filter(v => v.name.startsWith(p2));
        for (const v of matching) {
          const base = 'induction on ' + v.name;
          const descBase = [
            { bold: true, text: 'induction' },
            { bold: false, text: ' ' },
            { bold: true, text: 'on' },
            { bold: false, text: ' ' },
            { bold: true, text: p2 },
            ...(v.name.length > p2.length
              ? [{ bold: false, text: v.name.substring(p2.length) }]
              : []),
          ];
          matches.push({ description: [...descBase], completion: base });
          if (v.defaultArgs) {
            matches.push({
              description: [...descBase, { bold: false, text: v.defaultArgs }],
              completion: base + v.defaultArgs,
            });
          }
        }
      }
    }

    return matches;
  },
};


// --- Checking ---

export class InductionTactic implements ProofTactic {
  constructor(
      private goal: Prop,
      private env: Environment,
      private method: Extract<TacticMethod, { kind: 'induction' }>,
      private node: TacticProofNode,
      private premises: Prop[]) {
  }

  decompose(): ProofGoal[] {
    const { goal, env, method, premises } = this;
    const cases = buildCases(goal, env, method.varName, method.argNames, premises);
    return cases.map((c) => {
      const argStr = c.argNames.length > 0
          ? `(${c.argNames.join(', ')})` : '';
      return {
        label: `${c.ctor.name}${argStr}`,
        goal: c.goal,
        env: c.env,
        newTheorems: c.ihTheorems,
        newFacts: [],
      };
    });
  }
}
