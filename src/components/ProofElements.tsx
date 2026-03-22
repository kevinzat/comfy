import React from 'react';
import { Expression, Call, Constant, Variable,
         EXPR_CONSTANT, EXPR_VARIABLE, EXPR_FUNCTION,
         FUNC_ADD, FUNC_SUBTRACT, FUNC_MULTIPLY, FUNC_NEGATE,
         FUNC_EXPONENTIATE,
         FUNC_SET_UNION, FUNC_SET_INTERSECTION,
         FUNC_SET_COMPLEMENT, FUNC_SET_DIFFERENCE } from '../facts/exprs';
import { RuleAst, AlgebraAst, SubstituteAst, DefinitionAst, RULE_ALGEBRA, RULE_SUBSTITUTE, RULE_DEFINITION } from '../rules/rules_ast';
import { TacticAst, AlgebraTacticAst, SubstituteTacticAst, DefinitionTacticAst, TACTIC_ALGEBRA, TACTIC_SUBSTITUTE, TACTIC_DEFINITION } from '../rules/tactics_ast';


/** Returns HTML that displays the given expression. */
export function ExprToHtml(expr: Expression): JSX.Element {
  const parts: any[] = [];
  AddExprHtml(expr, parts);
  return <span className="expr">{parts}</span>;
}

function AddExprHtml(expr: Expression, parts: any[]): void {
  switch (expr.variety) {
    case EXPR_CONSTANT: {
      const c = expr as Constant;
      parts.push(<span className="expr-constant">{c.value.toString()}</span>);
      break;
    }

    case EXPR_VARIABLE: {
      const v = expr as Variable;
      parts.push(<i className="expr-variable">{v.name}</i>);
      break;
    }

    case EXPR_FUNCTION: {
      const call = expr as Call;
      const prec = call.precedence();

      if (Call.isNegation(expr)) {
        parts.push(<span className="expr-op">&minus;</span>);
        AddWrappedExprHtml(call.args[0], prec, false, parts);

      } else if (Call.isSetComplement(expr)) {
        AddWrappedExprHtml(call.args[0], prec, false, parts);
        parts.push(<sup>C</sup>);

      } else if (call.name === FUNC_EXPONENTIATE && call.args.length === 2) {
        AddWrappedExprHtml(call.args[0], prec, true, parts);
        parts.push(<sup>{ExprToHtml(call.args[1])}</sup>);

      } else if (call.name === FUNC_ADD) {
        AddWrappedExprHtml(call.args[0], prec, false, parts);
        for (let i = 1; i < call.args.length; i++) {
          parts.push(" + ");
          AddWrappedExprHtml(call.args[i], prec, true, parts);
        }

      } else if (call.name === FUNC_SUBTRACT) {
        AddWrappedExprHtml(call.args[0], prec, false, parts);
        for (let i = 1; i < call.args.length; i++) {
          parts.push(" \u2212 ");
          AddWrappedExprHtml(call.args[i], prec, true, parts);
        }

      } else if (call.name === FUNC_MULTIPLY) {
        AddWrappedExprHtml(call.args[0], prec, false, parts);
        for (let i = 1; i < call.args.length; i++) {
          parts.push(<span className="expr-op">&middot;</span>);
          AddWrappedExprHtml(call.args[i], prec, true, parts);
        }

      } else if (Call.isSetUnion(expr)) {
        AddWrappedExprHtml(call.args[0], prec, false, parts);
        parts.push(" \u222A ");
        AddWrappedExprHtml(call.args[1], prec, true, parts);

      } else if (Call.isSetIntersection(expr)) {
        AddWrappedExprHtml(call.args[0], prec, false, parts);
        parts.push(" \u2229 ");
        AddWrappedExprHtml(call.args[1], prec, true, parts);

      } else if (Call.isSetDifference(expr)) {
        AddWrappedExprHtml(call.args[0], prec, false, parts);
        parts.push(" \\ ");
        AddWrappedExprHtml(call.args[1], prec, true, parts);

      } else {
        // Generic function call: f(a, b, ...)
        parts.push(<span className="expr-function">{call.name}</span>);
        parts.push("(");
        for (let i = 0; i < call.args.length; i++) {
          if (i > 0) parts.push(", ");
          AddExprHtml(call.args[i], parts);
        }
        parts.push(")");
      }
      break;
    }

    default:
      throw new Error(`unknown expression variety: ${expr.variety}`);
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
    case RULE_SUBSTITUTE: {
      const s = parsed as SubstituteAst;
      return <span className="rule-display">by {s.index}</span>;
    }
    case RULE_DEFINITION: {
      const d = parsed as DefinitionAst;
      const funcName = d.name.replace(/_\d+$/, '');
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
    case TACTIC_SUBSTITUTE: {
      const s = parsed as SubstituteTacticAst;
      return <span className="rule-display">by {s.index}</span>;
    }
    case TACTIC_DEFINITION: {
      const d = parsed as DefinitionTacticAst;
      const funcName = d.name.replace(/_\d+$/, '');
      return <span className="rule-display">Def of {funcName}</span>;
    }
    default:
      return <span className="rule-display">{parsed.to_string()}</span>;
  }
}
