import { Expression } from './exprs';

export const OP_EQUAL = '=';
export const OP_LESS_THAN = '<';
export const OP_LESS_EQUAL = '<=';

export type FormulaOp = typeof OP_EQUAL | typeof OP_LESS_THAN | typeof OP_LESS_EQUAL;

/** A formula relating two expressions: left op right. */
export class Formula {
  left: Expression;
  op: FormulaOp;
  right: Expression;

  constructor(left: Expression, op: FormulaOp, right: Expression) {
    this.left = left;
    this.op = op;
    this.right = right;
  }

  to_string(): string {
    return `${this.left.to_string()} ${this.op} ${this.right.to_string()}`;
  }
}
