import { Expression, Variable } from '../facts/exprs';
import { AstNode } from '../facts/ast';
import { Formula } from '../facts/formula';
import { AtomProp, NotProp, OrProp, Literal, Prop } from '../facts/prop';

export class FuncDef extends AstNode {
  returnType: string;
  name: string;
  params: Param[];
  body: Stmt[];
  requires: PropAst[];
  ensures: PropAst[];

  constructor(returnType: string, name: string, params: Param[], body: Stmt[],
      requires: PropAst[] = [], ensures: PropAst[] = [],
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
  cond: PropAst;
  invariant: PropAst[];
  body: Stmt[];

  constructor(cond: PropAst, invariant: PropAst[], body: Stmt[], line: number = 0, col: number = 0) {
    super(line, col);
    this.cond = cond;
    this.invariant = invariant;
    this.body = body;
  }
}

export class IfStmt extends AstNode {
  tag: 'if' = 'if';
  cond: PropAst;
  thenBody: Stmt[];
  elseBody: Stmt[];

  constructor(cond: PropAst, thenBody: Stmt[], elseBody: Stmt[],
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

export class CondAst extends AstNode {
  tag: 'cond' = 'cond';
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

export class AndPropAst extends AstNode {
  tag: 'and' = 'and';
  left: PropAst;
  right: PropAst;

  constructor(left: PropAst, right: PropAst, line: number = 0, col: number = 0) {
    super(line, col);
    this.left = left;
    this.right = right;
  }
}

export class OrPropAst extends AstNode {
  tag: 'or' = 'or';
  left: PropAst;
  right: PropAst;

  constructor(left: PropAst, right: PropAst, line: number = 0, col: number = 0) {
    super(line, col);
    this.left = left;
    this.right = right;
  }
}

export class NotPropAst extends AstNode {
  tag: 'not' = 'not';
  prop: PropAst;

  constructor(prop: PropAst, line: number = 0, col: number = 0) {
    super(line, col);
    this.prop = prop;
  }
}

export type PropAst = CondAst | AndPropAst | OrPropAst | NotPropAst;

export function negCond(cond: CondAst): CondAst {
  return new CondAst(cond.left, NEG_OP[cond.op], cond.right, cond.line, cond.col);
}

export function substCond(cond: CondAst, name: string, expr: Expression): CondAst {
  const v = Variable.of(name);
  return new CondAst(
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

export function formulaToCond(f: Formula): CondAst {
  return new CondAst(f.left, FORMULA_TO_COND_OP[f.op], f.right);
}

/**
 * Converts a CondAst to a Formula. Swaps sides for > and >= (to produce < and <=).
 * Throws for !=, which has no Formula equivalent.
 */
export function condToFormula(c: CondAst): Formula {
  switch (c.op) {
    case '==': return new Formula(c.left, '=', c.right);
    case '<':  return new Formula(c.left, '<', c.right);
    case '<=': return new Formula(c.left, '<=', c.right);
    case '>':  return new Formula(c.right, '<', c.left);
    case '>=': return new Formula(c.right, '<=', c.left);
    case '!=': throw new Error('Cannot convert != condition to a Formula');
  }
}

/** Converts a CondAst to a Literal, normalizing operators to =, <, <=. */
function condToLiteral(c: CondAst): Literal {
  switch (c.op) {
    case '==': return new AtomProp(new Formula(c.left, '=', c.right));
    case '<':  return new AtomProp(new Formula(c.left, '<', c.right));
    case '<=': return new AtomProp(new Formula(c.left, '<=', c.right));
    case '>':  return new AtomProp(new Formula(c.right, '<', c.left));
    case '>=': return new AtomProp(new Formula(c.right, '<=', c.left));
    case '!=': return new NotProp(new Formula(c.left, '=', c.right));
  }
}

function negateLiteral(lit: Literal): Literal {
  return lit.tag === 'atom' ? new NotProp(lit.formula) : new AtomProp(lit.formula);
}

/**
 * Distributes OR over AND: given two CNF forms (lists of clauses), produces
 * the CNF of their disjunction via the cross product of clauses.
 */
function distribute(left: Literal[][], right: Literal[][]): Literal[][] {
  const result: Literal[][] = [];
  for (const l of left) {
    for (const r of right) {
      result.push([...l, ...r]);
    }
  }
  return result;
}

/**
 * Converts a PropAst to CNF, represented as a list of clauses (each clause
 * is a list of literals to be OR'd). The `negated` flag tracks whether we
 * are currently under a negation, allowing de Morgan's laws to be applied
 * as negations are pushed inward.
 */
function toCNFClauses(p: PropAst, negated: boolean): Literal[][] {
  if (p instanceof CondAst) {
    const lit = condToLiteral(p);
    return [[negated ? negateLiteral(lit) : lit]];
  }
  if (p instanceof NotPropAst) {
    return toCNFClauses(p.prop, !negated);
  }
  if (p instanceof AndPropAst) {
    if (!negated) {
      // And(P, Q) -> clauses(P) ++ clauses(Q)
      return [...toCNFClauses(p.left, false), ...toCNFClauses(p.right, false)];
    } else {
      // Not(And(P, Q)) = Or(Not(P), Not(Q))  [de Morgan]
      return distribute(toCNFClauses(p.left, true), toCNFClauses(p.right, true));
    }
  }
  // OrPropAst
  if (!negated) {
    // Or(P, Q) -> distribute clauses(P) over clauses(Q)
    return distribute(toCNFClauses(p.left, false), toCNFClauses(p.right, false));
  } else {
    // Not(Or(P, Q)) = And(Not(P), Not(Q))  [de Morgan]
    return [...toCNFClauses(p.left, true), ...toCNFClauses(p.right, true)];
  }
}

/**
 * Converts a PropAst to a list of normalized Props in CNF.
 * Each returned Prop is either a single literal (AtomProp/NotProp) or a
 * clause (OrProp), and the list represents their conjunction.
 */
export function propAstToProps(p: PropAst): Prop[] {
  return toCNFClauses(p, false).map(clause =>
    clause.length === 1 ? clause[0] : new OrProp(clause)
  );
}
