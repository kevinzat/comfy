
import * as nearley from 'nearley';
import { DeclsAst } from './decls_ast';
import grammar from './decls_grammar';


export interface DeclsParseResult {
  ast?: DeclsAst;
  error?: string;
}

/** Parses a comma-separated list of formulas (as used in theorem premises). */
export function ParsePremises(text: string): import('../facts/formula').Formula[] {
  const result = ParseDecls(`theorem dummy (dummy : Int) | ${text} => 0 = 0`);
  if (result.error) throw new Error(result.error);
  return result.ast!.theorems[0].premises;
}

/** Parses a list of declarations, returning the AST or an error message. */
export function ParseDecls(text: string): DeclsParseResult {
  try {
    const parser =
        new nearley.Parser(nearley.Grammar.fromCompiled(grammar));
    parser.feed(text);
    if (parser.results.length > 1) {
      return { error: `ambiguous grammar` };
    } else if (parser.results.length == 1) {
      const ast: DeclsAst = parser.results[0];
      return { ast };
    } else {
      return { error: `unexpected end of input` };
    }
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    return { error: msg };
  }
}
