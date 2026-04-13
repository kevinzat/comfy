import { DeclsAst } from '../lang/decls_ast';
import { ParseDecls } from '../lang/decls_parser';
import { TheoremAst } from '../lang/theorem_ast';


export interface ProofRange {
  /** Character offset of the start of the `prove` line. */
  from: number;
  /** Character offset of the end of the prove block (after last indented line). */
  to: number;
  /** The theorem name referenced by this prove block. */
  theoremName: string;
}

export interface DocSection {
  /** Declarations parsed from all text before each prove block. */
  decls: DeclsAst;
  /** The theorem AST for the prove block's referenced theorem, if found. */
  theorem: TheoremAst | undefined;
  /** The prove block range. */
  range: ProofRange;
}

/** True if the line is indented (starts with whitespace). */
function isIndented(line: string): boolean {
  return line.length > 0 && (line[0] === ' ' || line[0] === '\t');
}

/**
 * Scans document text to find all `prove` block ranges.
 * A prove block starts at an unindented line matching `prove <name> [by <method>]`
 * and continues through subsequent blank or indented lines.
 */
export function findProofRanges(text: string): ProofRange[] {
  const lines = text.split('\n');
  const ranges: ProofRange[] = [];
  let charOffset = 0;

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!isIndented(line) && trimmed.startsWith('prove ')) {
      const from = charOffset;
      const nameMatch = trimmed.match(/^prove\s+(\S+)/);
      const theoremName = nameMatch ? nameMatch[1] : '';
      // Advance past the prove line.
      charOffset += line.length + 1; // +1 for newline
      i++;
      // Consume indented continuation lines. Blank lines are consumed only
      // if followed by another indented line (not trailing blanks).
      while (i < lines.length) {
        if (isIndented(lines[i])) {
          charOffset += lines[i].length + 1;
          i++;
        } else if (lines[i].trim() === '') {
          // Peek ahead: only consume blank lines if an indented line follows.
          let j = i;
          while (j < lines.length && lines[j].trim() === '') j++;
          if (j < lines.length && isIndented(lines[j])) {
            // Consume the blank lines — they're part of the body.
            while (i < j) {
              charOffset += lines[i].length + 1;
              i++;
            }
          } else {
            break; // Trailing blanks — leave them outside the range.
          }
        } else {
          break;
        }
      }
      // `to` is the end of the last consumed line (exclude the final newline).
      const to = charOffset - 1;
      ranges.push({ from, to: Math.max(from, to), theoremName });
    } else {
      charOffset += line.length + 1;
      i++;
    }
  }

  return ranges;
}

/**
 * For each prove block, parses declarations from all text before it and
 * looks up the referenced theorem.
 */
export function buildDocSections(text: string): DocSection[] {
  const ranges = findProofRanges(text);
  const sections: DocSection[] = [];

  for (const range of ranges) {
    // Gather all non-prove text before this prove block.
    const textBefore = text.substring(0, range.from);
    const result = ParseDecls(textBefore);
    const decls = result.ast;
    const theorem = decls.theorems.find(t => t.name === range.theoremName);
    sections.push({ decls, theorem, range });
  }

  return sections;
}
