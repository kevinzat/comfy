import { UserError } from '../facts/user_error';
import { Expression, EXPR_CONSTANT, EXPR_VARIABLE, EXPR_FUNCTION,
    Constant, Variable, Call } from '../facts/exprs';
import { Formula, OP_EQUAL } from '../facts/formula';
import { Prop } from '../facts/prop';
import { FuncAst, TypeAst, CaseBody, Param, ParamConstructor } from '../lang/func_ast';
import { Environment, NestedEnv } from './env';
import { Type, NamedType, FunctionType } from './type';

const INT_TYPE = new NamedType('Int');

function loc(line: number, col: number): string {
  return line > 0 ? ` at line ${line} col ${col}` : '';
}

export class UnknownTypeError extends UserError {
  constructor(name: string, line: number = 0, col: number = 0) {
    super(`unknown type "${name}"${loc(line, col)}`, line, col);
    Object.setPrototypeOf(this, UnknownTypeError.prototype);
  }
}

export class UnknownNameError extends UserError {
  constructor(name: string, line: number = 0, col: number = 0) {
    super(`unknown name "${name}"${loc(line, col)}`, line, col);
    Object.setPrototypeOf(this, UnknownNameError.prototype);
  }
}

export class ArityError extends UserError {
  constructor(name: string, expected: number, actual: number,
      line: number = 0, col: number = 0) {
    super(`"${name}" expects ${expected} arguments but got ${actual}${loc(line, col)}`, line, col);
    Object.setPrototypeOf(this, ArityError.prototype);
  }
}

export class TypeMismatchError extends UserError {
  constructor(expected: string, actual: string, context: string) {
    super(`expected type "${expected}" but got "${actual}" in ${context}`);
    Object.setPrototypeOf(this, TypeMismatchError.prototype);
  }
}

/**
 * Resolves a type reference to a Type. A string resolves to a NamedType,
 * and a TypeAst resolves to a FunctionType.
 * @throws UnknownTypeError if any referenced type name is not defined in the environment.
 */
export function getType(env: Environment, ref: string, line?: number, col?: number): NamedType;
export function getType(env: Environment, ref: TypeAst): FunctionType;
export function getType(env: Environment, ref: string | TypeAst, line?: number, col?: number): Type;
export function getType(env: Environment, ref: string | TypeAst, line: number = 0, col: number = 0): Type {
  if (typeof ref === 'string') {
    if (!env.hasType(ref))
      throw new UnknownTypeError(ref, line, col);
    return new NamedType(ref);
  } else {
    const paramTypes = ref.paramTypes.map(name => {
      if (!env.hasType(name))
        throw new UnknownTypeError(name);
      return new NamedType(name);
    });
    if (!env.hasType(ref.returnType))
      throw new UnknownTypeError(ref.returnType);
    const returnType = new NamedType(ref.returnType);
    return new FunctionType(paramTypes, returnType);
  }
}

/**
 * Type-checks an expression and returns its type.
 * @throws UnknownNameError if a variable or call references an unknown name.
 * @throws ArityError if a call has the wrong number of arguments.
 * @throws TypeMismatchError if an argument type doesn't match the expected type.
 */
export function checkExpr(env: Environment, expr: Expression): NamedType {
  if (expr.variety === EXPR_CONSTANT) {
    return INT_TYPE;
  } else if (expr.variety === EXPR_VARIABLE) {
    if (env.hasVariable(expr.name))
      return env.getVariable(expr.name);
    // Zero-arg constructors parse as variables.
    if (env.hasConstructor(expr.name)) {
      const ctorType = env.getConstructorType(expr.name);
      if (ctorType.kind === 'named')
        return ctorType;
      throw new ArityError(expr.name, ctorType.paramTypes.length, 0,
          expr.line, expr.col);
    }
    throw new UnknownNameError(expr.name, expr.line, expr.col);
  } else {
    // Built-in arithmetic operations require Int arguments and return Int.
    if (expr.name.startsWith('_')) {
      for (let i = 0; i < expr.args.length; i++) {
        const argType = checkExpr(env, expr.args[i]);
        if (argType.name !== 'Int')
          throw new TypeMismatchError('Int', argType.name,
              `argument ${i + 1} of built-in arithmetic at line ${expr.line} col ${expr.col}`);
      }
      return INT_TYPE;
    }

    // Look up function or constructor.
    let callType: Type;
    if (env.hasFunction(expr.name)) {
      callType = env.getFunctionType(expr.name);
    } else if (env.hasConstructor(expr.name)) {
      callType = env.getConstructorType(expr.name);
    } else {
      throw new UnknownNameError(expr.name, expr.line, expr.col);
    }

    if (callType.kind !== 'function')
      throw new ArityError(expr.name, 0, expr.args.length, expr.line, expr.col);

    if (callType.paramTypes.length !== expr.args.length)
      throw new ArityError(expr.name, callType.paramTypes.length, expr.args.length,
          expr.line, expr.col);

    for (let i = 0; i < expr.args.length; i++) {
      const argType = checkExpr(env, expr.args[i]);
      const expectedType = callType.paramTypes[i];
      if (argType.name !== expectedType.name)
        throw new TypeMismatchError(
            expectedType.name, argType.name,
            `argument ${i + 1} of "${expr.name}" at line ${expr.line} col ${expr.col}`);
    }

    return callType.returnType;
  }
}

/**
 * Collects variable bindings from a pattern, given the expected type.
 * For a ParamVar, adds [name, typeName]. For a ParamConstructor, looks up
 * the constructor's param types and recurses into its args.
 * @throws UnknownNameError if a constructor pattern references an unknown constructor.
 * @throws ArityError if a constructor pattern has the wrong number of args.
 */
function collectPatternVars(
    env: Environment, param: Param, typeName: string,
    vars: [string, string][]): void {
  if (param instanceof ParamConstructor) {
    if (!env.hasConstructor(param.name))
      throw new UnknownNameError(param.name);
    const ctorType = env.getConstructorType(param.name);
    if (ctorType.kind !== 'function') {
      if (param.args.length !== 0)
        throw new ArityError(param.name, 0, param.args.length);
    } else {
      if (ctorType.paramTypes.length !== param.args.length)
        throw new ArityError(param.name, ctorType.paramTypes.length, param.args.length);
      for (let i = 0; i < param.args.length; i++) {
        collectPatternVars(env, param.args[i], ctorType.paramTypes[i].name, vars);
      }
    }
  } else {
    // ParamVar — could be a zero-arg constructor or a variable binding.
    if (env.hasConstructor(param.name)) {
      const ctorType = env.getConstructorType(param.name);
      if (ctorType.kind === 'function')
        throw new ArityError(param.name, ctorType.paramTypes.length, 0);
      // Zero-arg constructor: not a variable, nothing to bind.
    } else {
      vars.push([param.name, typeName]);
    }
  }
}

function checkBody(env: Environment, body: CaseBody): NamedType {
  if (body.tag === 'expr') {
    return checkExpr(env, body.expr);
  }
  for (const branch of body.branches)
    for (const cond of branch.conditions) checkProp(env, cond);
  const resultType = checkExpr(env, body.branches[0].body);
  for (let i = 1; i < body.branches.length; i++) {
    const branchType = checkExpr(env, body.branches[i].body);
    if (branchType.name !== resultType.name)
      throw new TypeMismatchError(resultType.name, branchType.name,
          'branch of if/else');
  }
  const elseType = checkExpr(env, body.elseBody);
  if (elseType.name !== resultType.name)
    throw new TypeMismatchError(resultType.name, elseType.name,
        'else branch of if/else');
  return resultType;
}

/**
 * Type-checks a function definition: verifies each case has the correct
 * number of parameters and that each case body is well-typed.
 * @throws ArityError if a case has the wrong number of parameters.
 * @throws TypeMismatchError if the body type doesn't match the return type.
 */
export function checkFuncDecl(env: Environment, func: FuncAst): void {
  const expectedArity = func.type.paramTypes.length;

  for (let i = 0; i < func.cases.length; i++) {
    const c = func.cases[i];
    if (c.params.length !== expectedArity)
      throw new ArityError(func.name, expectedArity, c.params.length);

    const vars: [string, string][] = [];
    for (let j = 0; j < c.params.length; j++) {
      collectPatternVars(env, c.params[j], func.type.paramTypes[j], vars);
    }
    const caseEnv = new NestedEnv(env, vars);
    const bodyType = checkBody(caseEnv, c.body);

    if (bodyType.name !== func.type.returnType)
      throw new TypeMismatchError(func.type.returnType, bodyType.name,
          `body of case ${i + 1} of "${func.name}"`);
  }
}

/**
 * Type-checks a formula. For "=", both sides must have the same type.
 * For "<" and "<=", both sides must be Int.
 * @throws TypeMismatchError if the types don't match the operator's requirements.
 */
export function checkProp(env: Environment, p: Prop): void {
  if (p.tag === 'atom' || p.tag === 'not') {
    checkFormula(env, p.formula);
  } else if (p.tag === 'or') {
    for (const lit of p.disjuncts) checkFormula(env, lit.formula);
  }
  // 'const' needs no checking
}

export function checkFormula(env: Environment, formula: Formula): void {
  const leftType = checkExpr(env, formula.left);
  const rightType = checkExpr(env, formula.right);
  if (formula.op === OP_EQUAL) {
    if (leftType.name !== rightType.name)
      throw new TypeMismatchError(leftType.name, rightType.name,
          `sides of "${formula.op}"`);
  } else {
    if (leftType.name !== 'Int')
      throw new TypeMismatchError('Int', leftType.name,
          `left side of "${formula.op}"`);
    if (rightType.name !== 'Int')
      throw new TypeMismatchError('Int', rightType.name,
          `right side of "${formula.op}"`);
  }
}
