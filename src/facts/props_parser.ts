
import * as nearley from 'nearley';
import { Prop } from './prop';
import { UserError } from './user_error';
import grammar from './props_grammar';


/** Parses a proposition, throwing UserError on syntax errors. */
export function ParseProp(text: string): Prop {
  const parser =
      new nearley.Parser(nearley.Grammar.fromCompiled(grammar));
  try {
    parser.feed(text);
  } catch (_e) {
    throw new UserError(`syntax error in proposition "${text}"`, 0, 0, 0);
  }
  /* v8 ignore start */
  if (parser.results.length > 1) {
    throw new Error(`ambiguous grammar for proposition "${text}"`);
  }
  /* v8 ignore stop */
  if (parser.results.length == 0) {
    throw new UserError(`syntax error in proposition "${text}"`, 0, 0, 0);
  }
  const result: Prop = parser.results[0];
  return result;
}
