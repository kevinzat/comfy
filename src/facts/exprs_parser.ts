
import * as nearley from 'nearley';
import { Expression } from './exprs';
import grammar from './exprs_grammar';


/** Parses an expression, throwing 'syntax error' if not possible. */
export function ParseExpr(text: string): Expression {
  const parser =
      new nearley.Parser(nearley.Grammar.fromCompiled(grammar));
  parser.feed(text);
  /* v8 ignore start */
  if (parser.results.length > 1) {
    throw new Error(`ambiguous grammar for expression "${text}"`);
  }
  /* v8 ignore stop */
  if (parser.results.length == 1) {
    const result: Expression = parser.results[0];
    return result;
  } else {
    throw `syntax error in expression "${text}"`;
  }
}
