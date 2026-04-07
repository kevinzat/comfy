
import * as nearley from 'nearley';
import { FuncAst } from './func_ast';
import grammar from './func_grammar';


export interface FuncParseResult {
  ast?: FuncAst;
  error?: string;
  errorLine?: number;
  errorCol?: number;
}

/** Extracts line and col from an error message, if present. */
function extractLineCol(msg: string): { line?: number, col?: number } {
  const m = msg.match(/line (\d+) col (\d+)/i);
  /* v8 ignore start */
  if (!m) {
    throw new Error(`no line/col in message: ${msg}`);
  }
  /* v8 ignore stop */
  return { line: parseInt(m[1]), col: parseInt(m[2]) };
}

/** Parses a function definition, returning the AST or an error message. */
export function ParseFunc(text: string): FuncParseResult {
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
      const ast: FuncAst = parser.results[0];
      return { ast };
    } else {
      return { error: `unexpected end of input` };
    }
  } catch (e: any) {
    const msg: string = e.message;
    const { line, col } = extractLineCol(msg);
    return { error: msg, errorLine: line, errorCol: col };
  }
}
