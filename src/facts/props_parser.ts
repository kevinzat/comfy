
import * as nearley from 'nearley';
import { Prop } from './prop';
import grammar from './props_grammar';


/** Parses a proposition, throwing 'syntax error' if not possible. */
export function ParseProp(text: string): Prop {
  const parser =
      new nearley.Parser(nearley.Grammar.fromCompiled(grammar));
  parser.feed(text);
  if (parser.results.length > 1) {
    throw `ambiguous grammar for proposition "${text}"`;
  } else if (parser.results.length == 1) {
    const result: Prop = parser.results[0];
    return result;
  } else {
    throw `syntax error in proposition "${text}"`;
  }
}
