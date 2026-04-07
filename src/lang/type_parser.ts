
import * as nearley from 'nearley';
import { TypeDeclAst } from './type_ast';
import grammar from './type_grammar';


export interface TypeParseResult {
  ast?: TypeDeclAst;
  error?: string;
}

/** Parses a type declaration, returning the AST or an error message. */
export function ParseTypeDecl(text: string): TypeParseResult {
  try {
    const parser =
        new nearley.Parser(nearley.Grammar.fromCompiled(grammar));
    parser.feed(text);
    /* v8 ignore start */
    if (parser.results.length > 1) {
      throw new Error('ambiguous grammar');
    }
    /* v8 ignore stop */
    if (parser.results.length == 1) {
      const ast: TypeDeclAst = parser.results[0];
      return { ast };
    } else {
      return { error: `unexpected end of input` };
    }
  } catch (e: any) {
    const msg: string = e.message;
    return { error: msg };
  }
}
