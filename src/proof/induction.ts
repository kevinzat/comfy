import { Expression, Variable, Call } from '../facts/exprs';
import { Formula } from '../facts/formula';
import { AtomProp } from '../facts/prop';
import { Environment, NestedEnv } from '../types/env';
import { ConstructorAst } from '../lang/type_ast';
import { TheoremAst } from '../lang/theorem_ast';


export interface CaseInfo {
  ctor: ConstructorAst;
  argNames: string[];
  argTypes: string[];
  goal: Formula;
  ihTheorems: TheoremAst[];
  ihArgNames: string[];
  env: NestedEnv;
}

function formulaVars(formula: Formula): Set<string> {
  const vars = formula.left.vars();
  for (const v of formula.right.vars()) {
    vars.add(v);
  }
  return vars;
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
  throw new Error('could not find a default variable name');
}

/**
 * Computes default argument names for all parameters across all constructors
 * of the given type. Returns a flat list in constructor order.
 */
export function defaultArgNames(
    env: Environment, typeName: string, varName: string): string[] {
  const typeDecl = env.getTypeDecl(typeName);
  if (typeDecl === null) {
    throw new Error(`cannot induct on built-in type "${typeName}"`);
  }
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
    formula: Formula, env: Environment, varName: string): [string, string][] {
  const fvars = formulaVars(formula);
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
  formula: Formula,
  env: Environment,
  varName: string,
  argNames?: string[],
  premises: Formula[] = [],
): CaseInfo[] {
  const varType = env.getVariable(varName);
  const typeName = varType.name;
  const ihParams = computeIHParams(formula, env, varName);

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
    if (argNames.length !== totalParams) {
      throw new Error(
          `expected ${totalParams} argument names, got ${argNames.length}`);
    }
    allNames = argNames;
  } else {
    allNames = defaultArgNames(env, typeName, varName);
  }

  // Check for clashes with formula variables.
  const fvars = formulaVars(formula);
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
    if (seen.has(name)) {
      throw new Error(`duplicate argument name "${name}"`);
    }
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

    const goalLeft = formula.left.subst(varExpr, ctorExpr);
    const goalRight = formula.right.subst(varExpr, ctorExpr);
    const goal = new Formula(goalLeft, formula.op, goalRight);

    // Count recursive args to decide naming: IH if one, IH_<name> if multiple.
    const recursiveCount = ctor.paramTypes.filter(t => t === typeName).length;

    const ihTheorems: TheoremAst[] = [];
    const ihArgNames: string[] = [];
    for (let i = 0; i < ctor.paramTypes.length; i++) {
      if (ctor.paramTypes[i] === typeName) {
        const argExpr = Variable.of(ctorArgNames[i]);
        const ihLeft = formula.left.subst(varExpr, argExpr);
        const ihRight = formula.right.subst(varExpr, argExpr);
        const ihConclusion = new AtomProp(new Formula(ihLeft, formula.op, ihRight));
        const ihPremises = premises.map(p => new AtomProp(new Formula(
            p.left.subst(varExpr, argExpr),
            p.op,
            p.right.subst(varExpr, argExpr))));
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
      goal,
      ihTheorems,
      ihArgNames,
      env: nestedEnv,
    });
  }

  return cases;
}
