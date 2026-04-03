import { Expression, Variable } from '../facts/exprs';
import { AstNode } from '../facts/ast';
import { Formula } from '../facts/formula';

export class FuncDef extends AstNode {
  returnType: string;
  name: string;
  params: Param[];
  body: Stmt[];
  requires: Cond[];
  ensures: Cond[];

  constructor(returnType: string, name: string, params: Param[], body: Stmt[],
      requires: Cond[] = [], ensures: Cond[] = [],
      line: number = 0, col: number = 0) {
    super(line, col);
    this.returnType = returnType;
    this.name = name;
    this.params = params;
    this.body = body;
    this.requires = requires;
    this.ensures = ensures;
  }
}

export class Param extends AstNode {
  type: string;
  name: string;

  constructor(type: string, name: string, line: number = 0, col: number = 0) {
    super(line, col);
    this.type = type;
    this.name = name;
  }
}

export type Stmt = DeclStmt | AssignStmt | WhileStmt | IfStmt | PassStmt | ReturnStmt;

export class DeclStmt extends AstNode {
  tag: 'decl' = 'decl';
  type: string;
  name: string;
  expr: Expression;

  constructor(type: string, name: string, expr: Expression,
      line: number = 0, col: number = 0) {
    super(line, col);
    this.type = type;
    this.name = name;
    this.expr = expr;
  }
}

export class AssignStmt extends AstNode {
  tag: 'assign' = 'assign';
  name: string;
  expr: Expression;

  constructor(name: string, expr: Expression, line: number = 0, col: number = 0) {
    super(line, col);
    this.name = name;
    this.expr = expr;
  }
}

export class WhileStmt extends AstNode {
  tag: 'while' = 'while';
  cond: Cond;
  invariant: Cond[];
  body: Stmt[];

  constructor(cond: Cond, invariant: Cond[], body: Stmt[], line: number = 0, col: number = 0) {
    super(line, col);
    this.cond = cond;
    this.invariant = invariant;
    this.body = body;
  }
}

export class IfStmt extends AstNode {
  tag: 'if' = 'if';
  cond: Cond;
  thenBody: Stmt[];
  elseBody: Stmt[];

  constructor(cond: Cond, thenBody: Stmt[], elseBody: Stmt[],
      line: number = 0, col: number = 0) {
    super(line, col);
    this.cond = cond;
    this.thenBody = thenBody;
    this.elseBody = elseBody;
  }
}

export class PassStmt extends AstNode {
  tag: 'pass' = 'pass';

  constructor(line: number = 0, col: number = 0) {
    super(line, col);
  }
}

export class ReturnStmt extends AstNode {
  tag: 'return' = 'return';
  expr: Expression;

  constructor(expr: Expression, line: number = 0, col: number = 0) {
    super(line, col);
    this.expr = expr;
  }
}

export type CondOp = '==' | '!=' | '<' | '<=' | '>' | '>=';

const NEG_OP: Record<CondOp, CondOp> = {
  '==': '!=', '!=': '==',
  '<': '>=', '<=': '>',
  '>': '<=', '>=': '<',
};

export class Cond extends AstNode {
  left: Expression;
  op: CondOp;
  right: Expression;

  constructor(left: Expression, op: CondOp, right: Expression,
      line: number = 0, col: number = 0) {
    super(line, col);
    this.left = left;
    this.op = op;
    this.right = right;
  }
}

export function negCond(cond: Cond): Cond {
  return new Cond(cond.left, NEG_OP[cond.op], cond.right, cond.line, cond.col);
}

export function substCond(cond: Cond, name: string, expr: Expression): Cond {
  const v = Variable.of(name);
  return new Cond(
    cond.left.subst(v, expr),
    cond.op,
    cond.right.subst(v, expr),
    cond.line,
    cond.col,
  );
}

const FORMULA_TO_COND_OP: Record<'=' | '<' | '<=', CondOp> = {
  '=': '==', '<': '<', '<=': '<=',
};

export function formulaToCond(f: Formula): Cond {
  return new Cond(f.left, FORMULA_TO_COND_OP[f.op], f.right);
}

/**
 * Converts a Cond to a Formula. Swaps sides for > and >= (to produce < and <=).
 * Throws for !=, which has no Formula equivalent.
 */
export function condToFormula(c: Cond): Formula {
  switch (c.op) {
    case '==': return new Formula(c.left, '=', c.right);
    case '<':  return new Formula(c.left, '<', c.right);
    case '<=': return new Formula(c.left, '<=', c.right);
    case '>':  return new Formula(c.right, '<', c.left);
    case '>=': return new Formula(c.right, '<=', c.left);
    case '!=': throw new Error('Cannot convert != condition to a Formula');
  }
}
