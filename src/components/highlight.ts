// Syntax highlight functions for ProofSetup editors (Option B color scheme).
// Token patterns mirror src/lang/grammar_util.js (makeLangLexer / makeCodeLexer).
// If keywords change in that file, update the patterns here.

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

type Pattern = [RegExp, string | null];

function scan(text: string, patterns: Pattern[]): string {
  let result = '';
  let pos = 0;
  outer: while (pos < text.length) {
    const rest = text.slice(pos);
    for (const [re, color] of patterns) {
      const m = re.exec(rest);
      if (m) {
        const tok = m[0];
        result += color
          ? `<span style="color:${color}">${esc(tok)}</span>`
          : esc(tok);
        pos += tok.length;
        continue outer;
      }
    }
    result += esc(text[pos]);
    pos++;
  }
  return result;
}

// Declarations: rust keywords, amber types/numbers, warm-brown operators
// Keywords from makeLangLexer: type, def, theorem, if, then, else
const DECLS_PATTERNS: Pattern[] = [
  [/^(?:type|def|theorem|if|then|else)\b/, '#ce9178'],
  [/^[A-Z][_a-zA-Z0-9]*/,                 '#d4a96a'],
  [/^[0-9]+/,                              '#d4a96a'],
  [/^(?:->|=>|<=)/,                        '#a07850'],
  [/^[|:=<(),^*+\-]/,                      '#a07850'],
  [/^[a-z][_a-zA-Z0-9]*/,                 null],
];

// Theorem: deep terracotta for 'theorem', rust for other keywords, amber types/numbers, warm-brown operators
// Same grammar as Declarations (uses makeLangLexer)
const THEOREM_PATTERNS: Pattern[] = [
  [/^theorem\b/,                           '#b06040'],
  [/^(?:type|def|if|then|else)\b/,         '#ce9178'],
  [/^[A-Z][_a-zA-Z0-9]*/,                 '#d4a96a'],
  [/^[0-9]+/,                              '#d4a96a'],
  [/^(?:->|=>|<=)/,                        '#a07850'],
  [/^[|:=<(),^*+\-]/,                      '#a07850'],
  [/^[a-z][_a-zA-Z0-9]*/,                 null],
];

// Code: dark-blue keywords, amber types/numbers, warm-brown operators, dark-grey braces
// Keywords from makeCodeLexer: while, if, else, pass, return
const CODE_PATTERNS: Pattern[] = [
  [/^(?:while|if|else|pass|return)\b/, '#4a6fa5'],
  [/^[A-Z][_a-zA-Z0-9]*/,             '#d4a96a'],
  [/^[0-9]+/,                          '#d4a96a'],
  [/^(?:==|!=|<=|>=)/,                 '#a07850'],
  [/^[=<>(),;^*+\-]/,                  '#a07850'],
  [/^[{}]/,                            '#707070'],
  [/^[a-z][_a-zA-Z0-9]*/,             null],
];

export function highlightDecls(code: string): string {
  return scan(code, DECLS_PATTERNS);
}

export function highlightTheorem(code: string): string {
  return scan(code, THEOREM_PATTERNS);
}

export function highlightCode(code: string): string {
  return scan(code, CODE_PATTERNS);
}
