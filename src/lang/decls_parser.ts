
import * as nearley from 'nearley';
import { DeclsAst } from './decls_ast';
import grammar from './decls_grammar';


export interface DeclsParseResult {
  ast: DeclsAst;
  errors: string[];
}

/** Parses a comma-separated list of props (as used in theorem premises). */
export function ParsePremises(text: string): import('../facts/prop').Prop[] {
  const result = ParseDecls(`theorem dummy (dummy : Int) | ${text} => 0 = 0`);
  if (result.errors.length > 0) throw new Error(result.errors[0]);
  return result.ast.theorems[0].premises;
}

const DECL_KEYWORDS = new Set(['type', 'def', 'kw_theorem']);

/** Strips nearley's verbose "Instead, I was expecting..." production list. */
function shortenNearleyError(msg: string): string {
  return msg
      .replace(/[\s\S]*?(?=Unexpected )/, '')
      .replace(/\. Instead, I was expecting[\s\S]*$/, '.')
      .split('\n')[0];
}

export interface ParseDeclsOptions {
  /** 1-indexed source-file line of the first line of `text`; controls
   *  the line numbers produced on AST nodes and in errors. Defaults to 1. */
  startLine?: number;
}

/** Parses a list of declarations with error recovery per-declaration. */
export function ParseDecls(text: string, options: ParseDeclsOptions = {}): DeclsParseResult {
  const startLine = options.startLine ?? 1;
  const innerLexer = grammar.Lexer;
  // Gated lexer: wraps the grammar's lexer so that nearley stops at the next
  // declaration keyword (type/def/theorem) after parsing one Decl. Tracks the
  // last-consumed token so error reporting can cite a position even when the
  // grammar reaches EOF without a complete parse (no thrown error).
  let first = true;
  let peeked: any = undefined;
  let hasPeeked = false;
  let lastTok: any = undefined;

  const gatedLexer = {
    // Outer loop controls
    resetFull(input: string) {
      innerLexer.reset(input, { line: startLine, col: 1 });
      first = true;
      peeked = undefined;
      hasPeeked = false;
      lastTok = undefined;
    },
    peek(): any {
      if (!hasPeeked) {
        peeked = innerLexer.next();
        hasPeeked = true;
      }
      return peeked;
    },
    advance(): any {
      const tok = gatedLexer.peek();
      hasPeeked = false;
      peeked = undefined;
      if (tok) lastTok = tok;
      return tok;
    },
    startDecl() { first = true; },
    getLastTok(): any { return lastTok; },

    // Nearley lexer interface
    reset(_chunk: string, _state: any) {},  // no-op: outer loop controls position
    next(): any {
      const tok = gatedLexer.peek();
      if (!tok) return undefined;
      if (!first && DECL_KEYWORDS.has(tok.type)) return undefined;
      first = false;
      hasPeeked = false;
      peeked = undefined;
      lastTok = tok;
      return tok;
    },
    save() { return {}; },
    formatError(tok: any) { return innerLexer.formatError(tok); },
  };

  const declGrammar = { ...grammar, Lexer: gatedLexer, ParserStart: 'Decl' };
  gatedLexer.resetFull(text);

  const ast = new DeclsAst([], [], []);
  const errors: string[] = [];

  while (gatedLexer.peek()) {
    const tok = gatedLexer.peek();

    // Expect a declaration keyword.
    if (!DECL_KEYWORDS.has(tok.type)) {
      errors.push(
          `line ${tok.line} col ${tok.col}: expected type, def, or theorem, got "${tok.value}"`);
      gatedLexer.advance();
      continue;
    }

    // Parse one Decl.
    gatedLexer.startDecl();
    const parser = new nearley.Parser(nearley.Grammar.fromCompiled(declGrammar));
    try {
      parser.feed('');
      if (parser.results.length > 0) {
        const d = parser.results[0];
        ast.types.push(...d.types);
        ast.functions.push(...d.functions);
        ast.theorems.push(...d.theorems);
      } else {
        // Incomplete declaration (gate closed or EOF before a full Decl).
        // Cite the last token consumed, since that's the farthest the parser
        // reached — more helpful than pointing at the decl keyword.
        const pos = gatedLexer.getLastTok() ?? tok;
        errors.push(`line ${pos.line} col ${pos.col}: incomplete ${tok.value} declaration`);
      }
    } catch (e: any) {
      // Nearley attaches the rejected token as e.token; prefer its position.
      const pos = e.token ?? gatedLexer.getLastTok() ?? tok;
      errors.push(`line ${pos.line} col ${pos.col}: ${shortenNearleyError(e.message)}`);
      // Skip remaining tokens until the next declaration keyword.
      while (gatedLexer.peek() && !DECL_KEYWORDS.has(gatedLexer.peek().type)) {
        gatedLexer.advance();
      }
    }
  }

  return { ast, errors };
}
