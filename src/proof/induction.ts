import { Expression, Variable, Call } from '../facts/exprs';
import { Formula } from '../facts/formula';
import { Environment, NestedEnv } from '../types/env';
import { ConstructorAst } from '../lang/type_ast';


export interface CaseInfo {
  ctor: ConstructorAst;
  argNames: string[];
  argTypes: string[];
  goal: Formula;
  ihFacts: Formula[];
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

export function buildCases(
  formula: Formula,
  env: Environment,
  varName: string,
  argNames?: string[],
): CaseInfo[] {
  const varType = env.getVariable(varName);
  const typeName = varType.name;

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

    const ihFacts: Formula[] = [];
    const ihArgNames: string[] = [];
    for (let i = 0; i < ctor.paramTypes.length; i++) {
      if (ctor.paramTypes[i] === typeName) {
        const argExpr = Variable.of(ctorArgNames[i]);
        const ihLeft = formula.left.subst(varExpr, argExpr);
        const ihRight = formula.right.subst(varExpr, argExpr);
        ihFacts.push(new Formula(ihLeft, formula.op, ihRight));
        ihArgNames.push(ctorArgNames[i]);
      }
    }

    const newVars: [string, string][] = ctorArgNames.map((name, i): [string, string] =>
      [name, ctor.paramTypes[i]]
    );
    const nestedEnv = new NestedEnv(env, newVars, ihFacts);

    cases.push({
      ctor,
      argNames: ctorArgNames,
      argTypes: ctor.paramTypes,
      goal,
      ihFacts,
      ihArgNames,
      env: nestedEnv,
    });
  }

  return cases;
}
