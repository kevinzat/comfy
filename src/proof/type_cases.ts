import { Expression, Variable, Call } from '../facts/exprs';
import { Formula } from '../facts/formula';
import { Prop, AtomProp } from '../facts/prop';
import { Environment, NestedEnv } from '../types/env';
import { Match } from '../calc/calc_complete';
import { TacticProofNode } from './proof_file';
import { ProofTactic, ProofGoal, ProofMethodParser, ParsedMethod, TacticMethod, parseTacticMethod } from './proof_tactic';
import { defaultArgNames } from './induction';


export class TypeCasesTactic implements ProofTactic {
  constructor(
      private goal: Prop,
      private env: Environment,
      private method: Extract<TacticMethod, { kind: 'type_cases' }>) {
  }

  decompose(): ProofGoal[] {
    const { goal, env, method } = this;
    const varName = method.varName;
    const varType = env.getVariable(varName);
    const typeName = varType.name;

    const typeDecl = env.getTypeDecl(typeName);
    /* v8 ignore start */
    if (typeDecl === null) {
      throw new Error(`cannot do cases on built-in type "${typeName}"`);
    }
    /* v8 ignore stop */

    const totalParams = typeDecl.constructors.reduce(
        (sum, ctor) => sum + ctor.paramTypes.length, 0);

    let allNames: string[];
    if (method.argNames !== undefined) {
      /* v8 ignore start */
      if (method.argNames.length !== totalParams) {
        throw new Error(
            `expected ${totalParams} argument names, got ${method.argNames.length}`);
      }
      /* v8 ignore stop */
      allNames = method.argNames;
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
            `formula; provide explicit names, e.g. "cases on ${varName} (...)"`)
      }
    }

    const varExpr = Variable.of(varName);
    const goals: ProofGoal[] = [];
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

      const newVars: [string, string][] = ctorArgNames.map((name, i): [string, string] =>
        [name, ctor.paramTypes[i]]
      );
      const nestedEnv = new NestedEnv(env, newVars, []);

      const argStr = ctorArgNames.length > 0
          ? `(${ctorArgNames.join(', ')})` : '';
      goals.push({
        label: `${ctor.name}${argStr}`,
        goal: caseGoal,
        env: nestedEnv,
        newTheorems: [],
        newFacts: [],
      });
    }

    return goals;
  }
}


// --- Parsing & completion ---

interface CasesVar {
  name: string;
  defaultArgs: string;
}

function casesVars(env: Environment, formula: Formula): CasesVar[] {
  const result: CasesVar[] = [];
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

export const typeCasesParser: ProofMethodParser = {
  tryParse(text: string, formula: Formula, env: Environment): ParsedMethod | string | null {
    const method = parseTacticMethod(text);
    if (method?.kind !== 'type_cases') return null;
    const { varName } = method;
    if (!env.hasVariable(varName)) {
      return `unknown variable "${varName}"`;
    }
    const varType = env.getVariable(varName);
    const typeDecl = env.getTypeDecl(varType.name);
    if (typeDecl === null) {
      return `cannot do cases on built-in type "${varType.name}"`;
    }
    const goal = new AtomProp(formula);
    const tactic = new TypeCasesTactic(goal, env, method);
    return { kind: 'tactic', tactic };
  },

  getMatches(text: string, formula: Formula, env: Environment): Match[] {
    const trimmed = text.trim();
    const vars = casesVars(env, formula);
    const matches: Match[] = [];

    const parts = trimmed.split(/\s+/);
    if (parts.length > 3) return matches;

    const p0 = parts[0] || '';
    if (!'cases'.startsWith(p0)) return matches;

    if (parts.length === 1 && p0 !== 'cases') {
      // Partial "cas" -> suggest "cases on <var>"
      for (const v of vars) {
        const base = 'cases on ' + v.name;
        const remaining = 'cases'.substring(p0.length) + ' on ' + v.name;
        matches.push({
          description: [
            { bold: true, text: p0 },
            { bold: false, text: remaining },
          ],
          completion: base,
        });
      }
    } else if (parts.length >= 2 && p0 === 'cases') {
      const p1 = parts[1];
      if ('on'.startsWith(p1) && parts.length === 2) {
        for (const v of vars) {
          const base = 'cases on ' + v.name;
          matches.push({
            description: [
              { bold: true, text: 'cases' },
              { bold: false, text: ' ' },
              { bold: true, text: p1 },
              { bold: false, text: 'on'.substring(p1.length) + ' ' + v.name },
            ],
            completion: base,
          });
          if (v.defaultArgs) {
            matches.push({
              description: [
                { bold: true, text: 'cases' },
                { bold: false, text: ' ' },
                { bold: true, text: p1 },
                { bold: false, text: 'on'.substring(p1.length) + ' ' + v.name + v.defaultArgs },
              ],
              completion: base + v.defaultArgs,
            });
          }
        }
      } else if (p1 === 'on' && parts.length === 3) {
        const p2 = parts[2];
        const matching = vars.filter(v => v.name.startsWith(p2));
        for (const v of matching) {
          const base = 'cases on ' + v.name;
          matches.push({
            description: [
              { bold: true, text: 'cases' },
              { bold: false, text: ' ' },
              { bold: true, text: 'on' },
              { bold: false, text: ' ' },
              { bold: true, text: p2 },
              ...(v.name.length > p2.length
                ? [{ bold: false, text: v.name.substring(p2.length) }]
                : []),
            ],
            completion: base,
          });
        }
      }
    }

    return matches;
  },
};
