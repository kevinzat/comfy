
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

/** Parses a list of declarations with error recovery per-declaration. */
export function ParseDecls(text: string): DeclsParseResult {
  const innerLexer = grammar.Lexer;
  // Gated lexer: wraps the grammar's lexer so that nearley stops at the next
  // declaration keyword (type/def/theorem) after parsing one Decl.
  let first = true;
  let peeked: any = undefined;
  let hasPeeked = false;

  const gatedLexer = {
    // Outer loop controls
    resetFull(input: string) {
      innerLexer.reset(input);
      first = true;
      peeked = undefined;
      hasPeeked = false;
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
      return tok;
    },
    startDecl() { first = true; },

    // Nearley lexer interface
    reset(_chunk: string, _state: any) {},  // no-op: outer loop controls position
    next(): any {
      const tok = gatedLexer.peek();
      if (!tok) return undefined;
      if (!first && DECL_KEYWORDS.has(tok.type)) return undefined;
      first = false;
      hasPeeked = false;
      peeked = undefined;
      return tok;
    },
    save() { return {}; },
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
        errors.push(`line ${tok.line} col ${tok.col}: incomplete ${tok.value} declaration`);
      }
    } catch (e: any) {
      errors.push(`line ${tok.line} col ${tok.col}: ${e.message}`);
      // Skip remaining tokens until the next declaration keyword.
      while (gatedLexer.peek() && !DECL_KEYWORDS.has(gatedLexer.peek().type)) {
        gatedLexer.advance();
      }
    }
  }

  return { ast, errors };
}
