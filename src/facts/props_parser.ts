
import * as nearley from 'nearley';
import { Prop } from './prop';
import grammar from './props_grammar';


/** Parses a proposition, throwing 'syntax error' if not possible. */
export function ParseProp(text: string): Prop {
  const parser =
      new nearley.Parser(nearley.Grammar.fromCompiled(grammar));
  parser.feed(text);
  /* v8 ignore start */
  if (parser.results.length > 1) {
    throw new Error(`ambiguous grammar for proposition "${text}"`);
  }
  /* v8 ignore stop */
  if (parser.results.length == 1) {
    const result: Prop = parser.results[0];
    return result;
  } else {
    throw `syntax error in proposition "${text}"`;
  }
}
