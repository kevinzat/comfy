/** Parsing and creation of forward rules. */

import * as nearley from 'nearley';
import { Expression } from '../facts/exprs';
import { Formula } from '../facts/formula';
import { UserError } from '../facts/user_error';
import { RuleAst, AlgebraAst, SubstituteAst, DefinitionAst, RULE_ALGEBRA, RULE_SUBSTITUTE, RULE_DEFINITION } from './rules_ast';
import { Rule, AlgebraRule, SubstituteRule, DefinitionRule } from './rules';
import { Environment } from '../types/env';
import grammar from './rules_grammar';

/** Parses a forward rule from user text. */
export function ParseForwardRule(text: string): RuleAst {
  const parser =
      new nearley.Parser(nearley.Grammar.fromCompiled(grammar as any));
  try {
    parser.feed(text.trim());
  } catch (_e) {
    throw new UserError(`syntax error in rule "${text}"`);
  }
  if (parser.results.length > 1) {
    throw new UserError(`ambiguous rule "${text}"`);
  } else if (parser.results.length === 1) {
    return parser.results[0] as RuleAst;
  } else {
    throw new UserError(`syntax error in rule "${text}"`);
  }
}

/** Creates a Rule from the given AST, current expression, and environment. */
export function CreateRule(ast: RuleAst, current: Expression, env: Environment): Rule {
  switch (ast.variety) {
    case RULE_ALGEBRA: {
      const a = ast as AlgebraAst;
      const formula = new Formula(current, a.op, a.expr);
      return new AlgebraRule(env, formula, ...a.refs);
    }
    case RULE_SUBSTITUTE: {
      const s = ast as SubstituteAst;
      return new SubstituteRule(env, current, s.index, s.right, s.expr);
    }
    case RULE_DEFINITION: {
      const d = ast as DefinitionAst;
      return new DefinitionRule(env, current, d.name, d.right, d.refs, d.expr);
    }
    default:
      throw new UserError(`unknown rule variety: ${ast.variety}`);
  }
}
