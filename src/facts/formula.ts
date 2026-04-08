import { Expression } from './exprs';

/**
 * Returns the given formula with all instances of expr replaced by value in
 * both the left and right sides.
 */
export function subst_formula(formula: Formula, expr: Expression, value: Expression): Formula {
  const newLeft = formula.left.subst(expr, value);
  const newRight = formula.right.subst(expr, value);
  if (newLeft === formula.left && newRight === formula.right)
    return formula;
  return new Formula(newLeft, formula.op, newRight);
}

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

  equivalent(other: Formula): boolean {
    return this.op === other.op &&
        this.left.equals(other.left) && this.right.equals(other.right);
  }

  to_string(): string {
    return `${this.left.to_string()} ${this.op} ${this.right.to_string()}`;
  }
}
