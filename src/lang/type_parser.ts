
import * as nearley from 'nearley';
import { TypeDeclAst } from './type_ast';
import grammar from './type_grammar';


export interface TypeParseResult {
  ast?: TypeDeclAst;
  error?: string;
}

function extractLineCol(msg: string): { line?: number, col?: number } {
  const m = msg.match(/line (\d+) col (\d+)/i);
  if (m) return { line: parseInt(m[1]), col: parseInt(m[2]) };
  return {};
}

/** Parses a type declaration, returning the AST or an error message. */
export function ParseTypeDecl(text: string): TypeParseResult {
  try {
    const parser =
        new nearley.Parser(nearley.Grammar.fromCompiled(grammar as any));
    parser.feed(text);
    if (parser.results.length > 1) {
      return { error: `ambiguous grammar` };
    } else if (parser.results.length == 1) {
      return { ast: parser.results[0] as TypeDeclAst };
    } else {
      return { error: `unexpected end of input` };
    }
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    return { error: msg };
  }
}
