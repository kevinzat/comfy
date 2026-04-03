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

/** Returns the Unicode circled digit for n (1–20), or "(n)" for larger values. */
function circledNum(n: number): string {
  if (n >= 1 && n <= 20) return String.fromCodePoint(0x245F + n);
  return `(${n})`;
}

const BADGE_STYLE =
  'background:#b06000;color:white;font-weight:bold;font-size:0.75em;' +
  'border-radius:3px;padding:1px 3px;vertical-align:super;margin-left:4px';

/**
 * Highlights code with small superscript obligation-number badges injected at
 * the end of specific lines. lineBadges maps 1-indexed line numbers to a list
 * of obligation numbers (multiple obligations may share a line).
 */
export function highlightCodeWithBadges(
  code: string,
  lineBadges: Map<number, number[]>,
): string {
  return code.split('\n').map((line, i) => {
    const highlighted = scan(line, CODE_PATTERNS);
    const nums = lineBadges.get(i + 1);
    if (nums && nums.length > 0) {
      return highlighted +
        `<span style="${BADGE_STYLE}">${nums.map(circledNum).join('')}</span>`;
    }
    return highlighted;
  }).join('\n');
}

/**
 * Like highlightCodeWithBadges but uses the theorem/decls patterns.
 */
export function highlightTheoremWithBadges(
  code: string,
  lineBadges: Map<number, number[]>,
): string {
  return code.split('\n').map((line, i) => {
    const highlighted = scan(line, THEOREM_PATTERNS);
    const nums = lineBadges.get(i + 1);
    if (nums && nums.length > 0) {
      return highlighted +
        `<span style="${BADGE_STYLE}">${nums.map(circledNum).join('')}</span>`;
    }
    return highlighted;
  }).join('\n');
}
