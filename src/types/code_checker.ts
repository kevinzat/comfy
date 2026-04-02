import { UserError } from '../facts/user_error';
import { FuncDef, Stmt, Cond } from '../lang/code_ast';
import { Environment, NestedEnv } from './env';
import { getType, checkExpr, TypeMismatchError } from './checker';

export class UnknownVariableError extends UserError {
  constructor(name: string, line: number = 0, col: number = 0) {
    const loc = line > 0 ? ` at line ${line} col ${col}` : '';
    super(`unknown variable "${name}"${loc}`);
    Object.setPrototypeOf(this, UnknownVariableError.prototype);
  }
}

export class MissingReturnError extends UserError {
  constructor() {
    super('function body must end with a return statement or an if statement with returns in both branches');
    Object.setPrototypeOf(this, MissingReturnError.prototype);
  }
}

function checkCond(env: Environment, cond: Cond): void {
  const leftType = checkExpr(env, cond.left);
  const rightType = checkExpr(env, cond.right);
  const loc = `line ${cond.line} col ${cond.col}`;
  if (cond.op === '<' || cond.op === '<=' || cond.op === '>' || cond.op === '>=') {
    if (leftType.name !== 'Int')
      throw new TypeMismatchError('Int', leftType.name,
          `left side of "${cond.op}" at ${loc}`);
    if (rightType.name !== 'Int')
      throw new TypeMismatchError('Int', rightType.name,
          `right side of "${cond.op}" at ${loc}`);
  } else {
    if (leftType.name !== rightType.name)
      throw new TypeMismatchError(leftType.name, rightType.name,
          `sides of "${cond.op}" at ${loc}`);
  }
}

function checkStmts(env: Environment, stmts: Stmt[], returnType: string): void {
  for (const stmt of stmts) {
    if (stmt.tag === 'decl') {
      getType(env, stmt.type, stmt.line, stmt.col);
      const exprType = checkExpr(env, stmt.expr);
      if (exprType.name !== stmt.type)
        throw new TypeMismatchError(stmt.type, exprType.name,
            `initialization of "${stmt.name}" at line ${stmt.line} col ${stmt.col}`);
      env = new NestedEnv(env, [[stmt.name, stmt.type]]);
    } else if (stmt.tag === 'assign') {
      if (!env.hasVariable(stmt.name))
        throw new UnknownVariableError(stmt.name, stmt.line, stmt.col);
      const varType = env.getVariable(stmt.name);
      const exprType = checkExpr(env, stmt.expr);
      if (exprType.name !== varType.name)
        throw new TypeMismatchError(varType.name, exprType.name,
            `assignment to "${stmt.name}" at line ${stmt.line} col ${stmt.col}`);
    } else if (stmt.tag === 'while') {
      checkCond(env, stmt.cond);
      checkStmts(env, stmt.body, returnType);
    } else if (stmt.tag === 'if') {
      checkCond(env, stmt.cond);
      checkStmts(env, stmt.thenBody, returnType);
      checkStmts(env, stmt.elseBody, returnType);
    } else if (stmt.tag === 'return') {
      const exprType = checkExpr(env, stmt.expr);
      if (exprType.name !== returnType)
        throw new TypeMismatchError(returnType, exprType.name,
            `return statement at line ${stmt.line} col ${stmt.col}`);
    }
    // pass: no checks needed
  }
}

function endsWithReturn(stmts: Stmt[]): boolean {
  if (stmts.length === 0) return false;
  const last = stmts[stmts.length - 1];
  if (last.tag === 'return') return true;
  if (last.tag === 'if') return endsWithReturn(last.thenBody) && endsWithReturn(last.elseBody);
  return false;
}

/**
 * Type-checks a function definition: verifies param and return types exist,
 * then checks each statement in the body with the params in scope.
 * @throws UnknownTypeError if any param or return type is not defined.
 * @throws UnknownVariableError if an assignment targets an undeclared variable.
 * @throws TypeMismatchError if an expression type doesn't match the expected type.
 * @throws MissingReturnError if the body does not end with a return or if-with-returns.
 */
export function checkFuncDef(env: Environment, func: FuncDef): void {
  getType(env, func.returnType, func.line, func.col);
  for (const param of func.params) {
    getType(env, param.type, param.line, param.col);
  }
  const vars: [string, string][] = func.params.map(p => [p.name, p.type]);
  const bodyEnv = new NestedEnv(env, vars);
  for (const cond of func.requires) {
    checkCond(bodyEnv, cond);
  }
  const ensuresEnv = new NestedEnv(bodyEnv, [['rv', func.returnType]]);
  for (const cond of func.ensures) {
    checkCond(ensuresEnv, cond);
  }
  checkStmts(bodyEnv, func.body, func.returnType);
  if (!endsWithReturn(func.body)) throw new MissingReturnError();
}
