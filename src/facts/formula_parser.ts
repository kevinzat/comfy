import { ParseExpr } from './exprs_parser';
import { Formula, FormulaOp, OP_EQUAL, OP_LESS_THAN, OP_LESS_EQUAL } from './formula';

/** Parses "Expr op Expr" where op is =, <, or <=. */
export function ParseFormula(text: string): Formula {
  // Try <= before < to avoid matching the < prefix of <=.
  const ops: [FormulaOp, string][] = [
    [OP_LESS_EQUAL, '<='],
    [OP_LESS_THAN, '<'],
    [OP_EQUAL, '='],
  ];

  for (const [op, opStr] of ops) {
    const idx = text.indexOf(opStr);
    if (idx >= 0) {
      const left = text.substring(0, idx).trim();
      const right = text.substring(idx + opStr.length).trim();
      if (left.length === 0 || right.length === 0)
        throw new Error(`missing expression in formula "${text}"`);
      return new Formula(ParseExpr(left), op, ParseExpr(right));
    }
  }

  throw new Error(`no operator found in "${text}"`);
}
