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
      new nearley.Parser(nearley.Grammar.fromCompiled(grammar));
  try {
    parser.feed(text.trim());
  } catch (_e) {
    throw new UserError(`syntax error in tactic "${text}"`);
  }
  /* v8 ignore start */
  if (parser.results.length > 1) {
    throw new Error(`ambiguous tactic "${text}"`);
  }
  /* v8 ignore stop */
  if (parser.results.length === 1) {
    const result: TacticAst = parser.results[0];
    return result;
  } else {
    throw new UserError(`syntax error in tactic "${text}"`);
  }
}

/** Creates a Tactic from the given AST, goal expression, and environment. */
export function CreateTactic(ast: TacticAst, goal: Expression, env: Environment): Tactic {
  switch (ast.variety) {
    case TACTIC_ALGEBRA: {
      const formula = new Formula(ast.expr, ast.op, goal);
      return new AlgebraTactic(env, formula, ...ast.refs);
    }
    case TACTIC_SUBSTITUTE: {
      return new SubstituteTactic(env, goal, ast.index, ast.right, ast.expr);
    }
    case TACTIC_DEFINITION: {
      return new DefinitionTactic(env, goal, ast.name, ast.right, ast.refs, ast.expr);
    }
    case TACTIC_APPLY: {
      return new ApplyTactic(env, goal, ast.name, ast.right, ast.refs, ast.expr);
    }
  }
}
