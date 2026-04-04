/** AST nodes for backward rules (tactics). */

import { Expression } from '../facts/exprs';
import { FormulaOp } from '../facts/formula';

export const TACTIC_ALGEBRA = 2;
export const TACTIC_SUBSTITUTE = 3;
export const TACTIC_DEFINITION = 4;
export const TACTIC_APPLY = 5;

export abstract class TacticAstBase {
  abstract readonly variety: number;
  abstract to_string(): string;
}

export type TacticAst = AlgebraTacticAst | SubstituteTacticAst | DefinitionTacticAst | ApplyTacticAst;

/** Backward algebra: asserts Expr op Goal from cited facts; premise is Expr. */
export class AlgebraTacticAst extends TacticAstBase {
  readonly variety = TACTIC_ALGEBRA;
  readonly op: FormulaOp;
  readonly expr: Expression;
  readonly refs: number[];

  constructor(op: FormulaOp, expr: Expression, refs: number[]) {
    super();
    this.op = op;
    this.expr = expr;
    this.refs = refs;
  }

  to_string(): string {
    if (this.refs.length === 0) {
      return `${this.op} ${this.expr.to_string()}`;
    } else {
      return `${this.op} ${this.expr.to_string()} since ${this.refs.join(' ')}`;
    }
  }
}

/**
 * Backward substitution: the opposite of forward substitution.
 * subst N: undoes a forward subst (replaces right with left in goal).
 * unsub N: undoes a forward unsub (replaces left with right in goal).
 */
export class SubstituteTacticAst extends TacticAstBase {
  readonly variety = TACTIC_SUBSTITUTE;
  readonly index: number;
  readonly right: boolean;
  readonly expr: Expression | undefined;

  constructor(index: number, right: boolean, expr?: Expression) {
    super();
    this.index = index;
    this.right = right;
    this.expr = expr;
  }

  to_string(): string {
    const base = `${this.right ? 'subst' : 'unsub'} ${this.index}`;
    return this.expr !== undefined ? `${base} => ${this.expr.to_string()}` : base;
  }
}

/**
 * Backward definition: the opposite of forward defof/undef.
 * defof name: undoes a forward defof (replaces body with pattern in goal).
 * undef name: undoes a forward undef (replaces pattern with body in goal).
 */
export class DefinitionTacticAst extends TacticAstBase {
  readonly variety = TACTIC_DEFINITION;
  readonly name: string;
  readonly right: boolean;
  readonly refs: number[];
  readonly expr: Expression | undefined;

  constructor(name: string, right: boolean, refs: number[] = [], expr?: Expression) {
    super();
    this.name = name;
    this.right = right;
    this.refs = refs;
    this.expr = expr;
  }

  to_string(): string {
    const base = `${this.right ? 'defof' : 'undef'} ${this.name}`;
    const refsStr = this.refs.length > 0 ? ` since ${this.refs.join(' ')}` : '';
    const exprStr = this.expr !== undefined ? ` => ${this.expr.to_string()}` : '';
    return `${base}${refsStr}${exprStr}`;
  }
}

/**
 * Backward apply: the opposite of forward apply/unapp.
 * apply name: undoes a forward apply (replaces right with left in goal).
 * unapp name: undoes a forward unapp (replaces left with right in goal).
 */
export class ApplyTacticAst extends TacticAstBase {
  readonly variety = TACTIC_APPLY;
  readonly name: string;
  readonly right: boolean;
  readonly refs: number[];
  readonly expr: Expression | undefined;

  constructor(name: string, right: boolean, refs: number[] = [], expr?: Expression) {
    super();
    this.name = name;
    this.right = right;
    this.refs = refs;
    this.expr = expr;
  }

  to_string(): string {
    const base = `${this.right ? 'apply' : 'unapp'} ${this.name}`;
    const refsStr = this.refs.length > 0 ? ` since ${this.refs.join(' ')}` : '';
    const exprStr = this.expr !== undefined ? ` => ${this.expr.to_string()}` : '';
    return `${base}${refsStr}${exprStr}`;
  }
}
