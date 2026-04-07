/** AST nodes for forward rules (rules of inference). */

import { Expression } from '../facts/exprs';
import { FormulaOp } from '../facts/formula';

export const RULE_ALGEBRA = 2;
export const RULE_SUBSTITUTE = 3;
export const RULE_DEFINITION = 4;
export const RULE_APPLY = 5;

export abstract class RuleAstBase {
  abstract readonly variety: number;
  abstract to_string(): string;
}

export type RuleAst = AlgebraAst | SubstituteAst | DefinitionAst | ApplyAst;

/** op Expr [N ...]: asserts a relationship, optionally citing known facts by index. */
export class AlgebraAst extends RuleAstBase {
  readonly variety = RULE_ALGEBRA;
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
 * subst N / unsub N: substitute using the Nth given.
 * right = true for subst (replace left with right), false for unsub (replace right with left).
 */
export class SubstituteAst extends RuleAstBase {
  readonly variety = RULE_SUBSTITUTE;
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
 * defof name / undef name: apply a function definition by unification.
 * right = true for defof (replace pattern with body), false for undef (replace body with pattern).
 */
export class DefinitionAst extends RuleAstBase {
  readonly variety = RULE_DEFINITION;
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
 * apply name / unapp name: apply a theorem by unification.
 * right = true for apply (replace left with right), false for unapp (replace right with left).
 */
export class ApplyAst extends RuleAstBase {
  readonly variety = RULE_APPLY;
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
