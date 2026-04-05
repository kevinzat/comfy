import { Expression, Variable } from '../facts/exprs';
import { AstNode } from '../facts/ast';
import { Formula } from '../facts/formula';
import { AtomProp, NotProp, OrProp, ConstProp, Literal, Prop } from '../facts/prop';

export class FuncDef extends AstNode {
  returnType: string;
  name: string;
  params: Param[];
  body: Stmt[];
  requires: CondAst[];
  ensures: CondAst[];

  constructor(returnType: string, name: string, params: Param[], body: Stmt[],
      requires: CondAst[] = [], ensures: CondAst[] = [],
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
  cond: CondAst;
  invariant: CondAst[];
  body: Stmt[];

  constructor(cond: CondAst, invariant: CondAst[], body: Stmt[], line: number = 0, col: number = 0) {
    super(line, col);
    this.cond = cond;
    this.invariant = invariant;
    this.body = body;
  }
}

export class IfStmt extends AstNode {
  tag: 'if' = 'if';
  cond: CondAst;
  thenBody: Stmt[];
  elseBody: Stmt[];

  constructor(cond: CondAst, thenBody: Stmt[], elseBody: Stmt[],
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

export class RelAst extends AstNode {
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

export class AndCondAst extends AstNode {
  tag: 'and' = 'and';
  left: CondAst;
  right: CondAst;

  constructor(left: CondAst, right: CondAst, line: number = 0, col: number = 0) {
    super(line, col);
    this.left = left;
    this.right = right;
  }
}

export class OrCondAst extends AstNode {
  tag: 'or' = 'or';
  left: CondAst;
  right: CondAst;

  constructor(left: CondAst, right: CondAst, line: number = 0, col: number = 0) {
    super(line, col);
    this.left = left;
    this.right = right;
  }
}

export class NotCondAst extends AstNode {
  tag: 'not' = 'not';
  prop: CondAst;

  constructor(prop: CondAst, line: number = 0, col: number = 0) {
    super(line, col);
    this.prop = prop;
  }
}

export class TrueCondAst extends AstNode {
  tag: 'true' = 'true';

  constructor(line: number = 0, col: number = 0) {
    super(line, col);
  }
}

export class FalseCondAst extends AstNode {
  tag: 'false' = 'false';

  constructor(line: number = 0, col: number = 0) {
    super(line, col);
  }
}

export type CondAst = RelAst | AndCondAst | OrCondAst | NotCondAst | TrueCondAst | FalseCondAst;

export function negRel(cond: RelAst): RelAst {
  return new RelAst(cond.left, NEG_OP[cond.op], cond.right, cond.line, cond.col);
}

export function substRel(cond: RelAst, name: string, expr: Expression): RelAst {
  const v = Variable.of(name);
  return new RelAst(
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

export function formulaToRel(f: Formula): RelAst {
  return new RelAst(f.left, FORMULA_TO_COND_OP[f.op], f.right);
}

/**
 * Converts a RelAst to a Formula. Swaps sides for > and >= (to produce < and <=).
 * Throws for !=, which has no Formula equivalent.
 */
export function relToFormula(c: RelAst): Formula {
  switch (c.op) {
    case '==': return new Formula(c.left, '=', c.right);
    case '<':  return new Formula(c.left, '<', c.right);
    case '<=': return new Formula(c.left, '<=', c.right);
    case '>':  return new Formula(c.right, '<', c.left);
    case '>=': return new Formula(c.right, '<=', c.left);
    case '!=': throw new Error('Cannot convert != condition to a Formula');
  }
}

// Internal type for CNF clauses before simplification — extends Literal with ConstProp.
export type ClauseLiteral = Literal | ConstProp;

/** Converts a RelAst to a Literal, normalizing operators to =, <, <=. */
function relToLiteral(c: RelAst): Literal {
  switch (c.op) {
    case '==': return new AtomProp(new Formula(c.left, '=', c.right));
    case '<':  return new AtomProp(new Formula(c.left, '<', c.right));
    case '<=': return new AtomProp(new Formula(c.left, '<=', c.right));
    case '>':  return new AtomProp(new Formula(c.right, '<', c.left));
    case '>=': return new AtomProp(new Formula(c.right, '<=', c.left));
    case '!=': return new NotProp(new Formula(c.left, '=', c.right));
  }
}

function negateLiteral(lit: ClauseLiteral): ClauseLiteral {
  if (lit.tag === 'const') return new ConstProp(!lit.value);
  return lit.tag === 'atom' ? new NotProp(lit.formula) : new AtomProp(lit.formula);
}

/**
 * Distributes OR over AND: given two CNF forms (lists of clauses), produces
 * the CNF of their disjunction via the cross product of clauses.
 */
function distribute(left: ClauseLiteral[][], right: ClauseLiteral[][]): ClauseLiteral[][] {
  const result: ClauseLiteral[][] = [];
  for (const l of left) {
    for (const r of right) {
      result.push([...l, ...r]);
    }
  }
  return result;
}

/**
 * Converts a CNF clause (list of ClauseLiterals) to a Prop, simplifying any
 * ConstProp values: ConstProp(true) absorbs the whole clause; ConstProp(false)
 * is dropped. The resulting OrProp only contains AtomProp/NotProp disjuncts.
 */
export function clauseToProp(clause: ClauseLiteral[]): Prop {
  const kept: Literal[] = [];
  for (const lit of clause) {
    if (lit.tag === 'const') {
      if (lit.value) return new ConstProp(true);
      continue;
    }
    kept.push(lit);
  }
  if (kept.length === 0) return new ConstProp(false);
  if (kept.length === 1) return kept[0];
  return new OrProp(kept);
}

/**
 * Converts a CondAst to CNF, represented as a list of clauses (each clause
 * is a list of literals to be OR'd). The `negated` flag tracks whether we
 * are currently under a negation, allowing de Morgan's laws to be applied
 * as negations are pushed inward.
 */
function toCNFClauses(p: CondAst, negated: boolean): ClauseLiteral[][] {
  if (p instanceof RelAst) {
    const lit = relToLiteral(p);
    return [[negated ? negateLiteral(lit) : lit]];
  }
  if (p instanceof TrueCondAst) {
    return [[new ConstProp(!negated)]];
  }
  if (p instanceof FalseCondAst) {
    return [[new ConstProp(negated)]];
  }
  if (p instanceof NotCondAst) {
    return toCNFClauses(p.prop, !negated);
  }
  if (p instanceof AndCondAst) {
    if (!negated) {
      // And(P, Q) -> clauses(P) ++ clauses(Q)
      return [...toCNFClauses(p.left, false), ...toCNFClauses(p.right, false)];
    } else {
      // Not(And(P, Q)) = Or(Not(P), Not(Q))  [de Morgan]
      return distribute(toCNFClauses(p.left, true), toCNFClauses(p.right, true));
    }
  }
  // OrCondAst
  if (!negated) {
    // Or(P, Q) -> distribute clauses(P) over clauses(Q)
    return distribute(toCNFClauses(p.left, false), toCNFClauses(p.right, false));
  } else {
    // Not(Or(P, Q)) = And(Not(P), Not(Q))  [de Morgan]
    return [...toCNFClauses(p.left, true), ...toCNFClauses(p.right, true)];
  }
}

/**
 * Converts a CondAst to a list of normalized Props in CNF.
 * Each returned Prop is either a literal (AtomProp/NotProp), a clause (OrProp
 * containing only AtomProp/NotProp), or a ConstProp. The list represents
 * their conjunction.
 */
export function condToProps(p: CondAst): Prop[] {
  return toCNFClauses(p, false).map(clauseToProp);
}
