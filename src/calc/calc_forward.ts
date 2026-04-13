/** Parsing and creation of forward calc rules. */

import * as nearley from 'nearley';
import { Expression } from '../facts/exprs';
import { Formula } from '../facts/formula';
import { UserError } from '../facts/user_error';
import { RuleAst, AlgebraAst, SubstituteAst, DefinitionAst, ApplyAst, RULE_ALGEBRA, RULE_SUBSTITUTE, RULE_DEFINITION, RULE_APPLY } from './rules_ast';
import { CalcRule, AlgebraCalcRule, SubstituteCalcRule, DefinitionCalcRule, ApplyCalcRule } from './rules';
import { Environment } from '../types/env';
import grammar from './rules_grammar';

/** Parses a forward rule from user text. */
export function ParseForwardRule(text: string): RuleAst {
  const parser =
      new nearley.Parser(nearley.Grammar.fromCompiled(grammar));
  try {
    parser.feed(text.trim());
  } catch (_e) {
    throw new UserError(`syntax error in rule "${text}"`, 0, 0, text.length);
  }
  /* v8 ignore start */
  if (parser.results.length > 1) {
    throw new Error(`ambiguous rule "${text}"`);
  }
  /* v8 ignore stop */
  if (parser.results.length === 1) {
    const result: RuleAst = parser.results[0];
    return result;
  } else {
    throw new UserError(`syntax error in rule "${text}"`, 0, 0, text.length);
  }
}

/** Creates a CalcRule from the given AST, current expression, and environment. */
export function CreateCalcRule(ast: RuleAst, current: Expression, env: Environment): CalcRule {
  switch (ast.variety) {
    case RULE_ALGEBRA: {
      const formula = new Formula(current, ast.op, ast.expr);
      return new AlgebraCalcRule(env, formula, ...ast.refs);
    }
    case RULE_SUBSTITUTE: {
      return new SubstituteCalcRule(env, current, ast.index, ast.right, ast.expr);
    }
    case RULE_DEFINITION: {
      return new DefinitionCalcRule(env, current, ast.name, ast.right, ast.refs, ast.expr);
    }
    case RULE_APPLY: {
      return new ApplyCalcRule(env, current, ast.name, ast.right, ast.refs, ast.expr);
    }
  }
}
