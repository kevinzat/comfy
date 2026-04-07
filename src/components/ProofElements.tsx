import React from 'react';
import { Expression, Call, Constant, Variable,
         EXPR_CONSTANT, EXPR_VARIABLE, EXPR_FUNCTION,
         FUNC_ADD, FUNC_SUBTRACT, FUNC_MULTIPLY, FUNC_NEGATE,
         FUNC_EXPONENTIATE } from '../facts/exprs';
import { OP_LESS_EQUAL } from '../facts/formula';
import { RuleAst, AlgebraAst, SubstituteAst, DefinitionAst, RULE_ALGEBRA, RULE_SUBSTITUTE, RULE_DEFINITION } from '../calc/rules_ast';
import { TacticAst, AlgebraTacticAst, SubstituteTacticAst, DefinitionTacticAst, TACTIC_ALGEBRA, TACTIC_SUBSTITUTE, TACTIC_DEFINITION } from '../calc/tactics_ast';


/** Returns the display string for a formula operator, using ≤ for <=. */
export function OpToHtml(op: string): string {
  return op === OP_LESS_EQUAL ? '\u2264' : op;
}

/** Returns HTML that displays the given expression. */
export function ExprToHtml(expr: Expression): JSX.Element {
  const parts: any[] = [];
  AddExprHtml(expr, parts);
  return <span className="expr">{parts}</span>;
}

function AddExprHtml(expr: Expression, parts: any[]): void {
  switch (expr.variety) {
    case EXPR_CONSTANT: {
      parts.push(<span className="expr-constant">{expr.value.toString()}</span>);
      break;
    }

    case EXPR_VARIABLE: {
      parts.push(<i className="expr-variable">{expr.name}</i>);
      break;
    }

    case EXPR_FUNCTION: {
      const prec = expr.precedence();

      if (Call.isNegation(expr)) {
        parts.push(<span className="expr-op">&minus;</span>);
        AddWrappedExprHtml(expr.args[0], prec, false, parts);

      } else if (expr.name === FUNC_EXPONENTIATE && expr.args.length === 2) {
        AddWrappedExprHtml(expr.args[0], prec, true, parts);
        parts.push(<sup>{ExprToHtml(expr.args[1])}</sup>);

      } else if (expr.name === FUNC_ADD) {
        AddWrappedExprHtml(expr.args[0], prec, false, parts);
        for (let i = 1; i < expr.args.length; i++) {
          parts.push(" + ");
          AddWrappedExprHtml(expr.args[i], prec, true, parts);
        }

      } else if (expr.name === FUNC_SUBTRACT) {
        AddWrappedExprHtml(expr.args[0], prec, false, parts);
        for (let i = 1; i < expr.args.length; i++) {
          parts.push(" \u2212 ");
          AddWrappedExprHtml(expr.args[i], prec, true, parts);
        }

      } else if (expr.name === FUNC_MULTIPLY) {
        AddWrappedExprHtml(expr.args[0], prec, false, parts);
        for (let i = 1; i < expr.args.length; i++) {
          parts.push(<span className="expr-op">&middot;</span>);
          AddWrappedExprHtml(expr.args[i], prec, true, parts);
        }

      } else {
        // Generic function call: f(a, b, ...)
        parts.push(<span className="expr-function">{expr.name}</span>);
        parts.push("(");
        for (let i = 0; i < expr.args.length; i++) {
          if (i > 0) parts.push(", ");
          AddExprHtml(expr.args[i], parts);
        }
        parts.push(")");
      }
      break;
    }
  }
}

function AddWrappedExprHtml(
    expr: Expression, outer_prec: number, wrap_eq: boolean, parts: any[]): void {
  if (outer_prec > expr.precedence() ||
      (wrap_eq && outer_prec === expr.precedence())) {
    parts.push("(");
    AddExprHtml(expr, parts);
    parts.push(")");
  } else {
    AddExprHtml(expr, parts);
  }
}


/** Returns HTML that displays a forward rule. */
export function RuleToHtml(parsed: RuleAst): JSX.Element {
  switch (parsed.variety) {
    case RULE_ALGEBRA:
      return <span className="rule-display"></span>;
    case RULE_SUBSTITUTE:
      return <span className="rule-display">by {parsed.index}</span>;
    case RULE_DEFINITION: {
      const funcName = parsed.name.replace(/_\d+$/, '');
      return <span className="rule-display">Def of {funcName}</span>;
    }
    default:
      return <span className="rule-display">{parsed.to_string()}</span>;
  }
}

/** Returns HTML that displays a backward tactic. */
export function TacticToHtml(parsed: TacticAst): JSX.Element {
  switch (parsed.variety) {
    case TACTIC_ALGEBRA:
      return <span className="rule-display"></span>;
    case TACTIC_SUBSTITUTE:
      return <span className="rule-display">by {parsed.index}</span>;
    case TACTIC_DEFINITION: {
      const funcName = parsed.name.replace(/_\d+$/, '');
      return <span className="rule-display">Def of {funcName}</span>;
    }
    default:
      return <span className="rule-display">{parsed.to_string()}</span>;
  }
}
