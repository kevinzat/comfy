
import * as nearley from 'nearley';
import { FuncDef } from './code_ast';
import grammar from './code_grammar';


export interface CodeParseResult {
  ast?: FuncDef;
  error?: string;
  errorLine?: number;
  errorCol?: number;
}

/** Extracts line and col from an error message, if present. */
function extractLineCol(msg: string): { line?: number, col?: number } {
  const m = msg.match(/line (\d+) col (\d+)/i);
  if (m) return { line: parseInt(m[1]), col: parseInt(m[2]) };
  return {};
}

/** Parses a C-like function definition, returning the AST or an error message. */
export function ParseCode(text: string): CodeParseResult {
  try {
    const parser =
        new nearley.Parser(nearley.Grammar.fromCompiled(grammar as any));
    parser.feed(text);
    if (parser.results.length > 1) {
      return { error: `ambiguous grammar` };
    } else if (parser.results.length == 1) {
      return { ast: parser.results[0] as FuncDef };
    } else {
      return { error: `unexpected end of input` };
    }
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    const { line, col } = extractLineCol(msg);
    return { error: msg, errorLine: line, errorCol: col };
  }
}
