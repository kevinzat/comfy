
import * as nearley from 'nearley';
import { DeclsAst } from './decls_ast';
import grammar from './decls_grammar';


export interface DeclsParseResult {
  ast?: DeclsAst;
  error?: string;
}

/** Parses a list of declarations, returning the AST or an error message. */
export function ParseDecls(text: string): DeclsParseResult {
  try {
    const parser =
        new nearley.Parser(nearley.Grammar.fromCompiled(grammar as any));
    parser.feed(text);
    if (parser.results.length > 1) {
      return { error: `ambiguous grammar` };
    } else if (parser.results.length == 1) {
      return { ast: parser.results[0] as DeclsAst };
    } else {
      return { error: `unexpected end of input` };
    }
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    return { error: msg };
  }
}
