/** Parsing and creation of backward rules (tactics). */

import * as nearley from 'nearley';
import { Expression } from '../facts/exprs';
import { Formula } from '../facts/formula';
import { UserError } from '../facts/user_error';
import { TacticAst, AlgebraTacticAst, SubstituteTacticAst, DefinitionTacticAst, ApplyTacticAst, TACTIC_ALGEBRA, TACTIC_SUBSTITUTE, TACTIC_DEFINITION, TACTIC_APPLY } from './tactics_ast';
import { Tactic, AlgebraTactic, SubstituteTactic, DefinitionTactic, ApplyTactic } from './tactics';
import { Environment } from '../types/env';
import grammar from './tactics_grammar';

/** Parses a backward rule from user text. */
export function ParseBackwardRule(text: string): TacticAst {
  const parser =
      new nearley.Parser(nearley.Grammar.fromCompiled(grammar as any));
  try {
    parser.feed(text.trim());
  } catch (_e) {
    throw new UserError(`syntax error in tactic "${text}"`);
  }
  if (parser.results.length > 1) {
    throw new UserError(`ambiguous tactic "${text}"`);
  } else if (parser.results.length === 1) {
    return parser.results[0] as TacticAst;
  } else {
    throw new UserError(`syntax error in tactic "${text}"`);
  }
}

/** Creates a Tactic from the given AST, goal expression, and environment. */
export function CreateTactic(ast: TacticAst, goal: Expression, env: Environment): Tactic {
  switch (ast.variety) {
    case TACTIC_ALGEBRA: {
      const a = ast as AlgebraTacticAst;
      const formula = new Formula(a.expr, a.op, goal);
      return new AlgebraTactic(env, formula, ...a.refs);
    }
    case TACTIC_SUBSTITUTE: {
      const s = ast as SubstituteTacticAst;
      return new SubstituteTactic(env, goal, s.index, s.right, s.expr);
    }
    case TACTIC_DEFINITION: {
      const d = ast as DefinitionTacticAst;
      return new DefinitionTactic(env, goal, d.name, d.right, d.refs, d.expr);
    }
    case TACTIC_APPLY: {
      const a = ast as ApplyTacticAst;
      return new ApplyTactic(env, goal, a.name, a.right, a.refs, a.expr);
    }
    default:
      throw new UserError(`unknown tactic variety: ${ast.variety}`);
  }
}
