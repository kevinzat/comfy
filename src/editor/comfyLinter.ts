import { Diagnostic, linter } from '@codemirror/lint';
import { EditorView } from '@codemirror/view';
import { parseProofFile } from '../proof/proof_file';
import { TopLevelEnv } from '../types/env';
import { UserError } from '../facts/user_error';
import { DeclsAst } from '../lang/decls_ast';


/** Convert a 1-indexed line number to a character offset in the document. */
function lineToOffset(view: EditorView, line: number): number {
  const lineCount = view.state.doc.lines;
  const clamped = Math.max(1, Math.min(line, lineCount));
  return view.state.doc.line(clamped).from;
}

/**
 * Try to build a TopLevelEnv from declarations and run full type checking
 * (function bodies, facts, theorems). Returns the error if it fails.
 */
function checkEnv(decls: DeclsAst): UserError | null {
  try {
    const env = new TopLevelEnv(decls.types, decls.functions, [], decls.theorems);
    env.check();
    return null;
  } catch (e: unknown) {
    if (e instanceof UserError) return e;
    const msg = e instanceof Error ? e.message : String(e);
    return new UserError(msg);
  }
}

export const comfyLinter = linter(
  (view: EditorView): Diagnostic[] => {
    const text = view.state.doc.toString();
    if (text.trim() === '') return [];

    const diagnostics: Diagnostic[] = [];
    const result = parseProofFile(text);

    // Parse errors from the proof file parser.
    // Filter out "missing prove" — not useful while actively editing.
    for (const err of result.errors.filter(e => !e.message.includes('missing "prove"'))) {
      const from = lineToOffset(view, err.line);
      const line = view.state.doc.line(
        Math.max(1, Math.min(err.line, view.state.doc.lines)),
      );
      // Strip the "line N: " prefix from the message if present.
      const msg = err.message.replace(/^line \d+:\s*/, '');
      diagnostics.push({
        from,
        to: line.to,
        severity: 'error',
        message: msg,
      });
    }

    // Type-check declarations from each decls item.
    for (const item of result.file.items) {
      if (item.kind !== 'decls') continue;
      const err = checkEnv(item.decls);
      if (err) {
        let from: number;
        let to: number;
        if (err.line > 0) {
          // err.line is relative to the decl block; offset to document line.
          const docLine = item.startLine + err.line - 1;
          const lineCount = view.state.doc.lines;
          const clamped = Math.max(1, Math.min(docLine, lineCount));
          const line = view.state.doc.line(clamped);
          from = line.from + Math.max(0, err.col - 1);
          to = line.to;
        } else {
          // No line info — try to find the quoted name in the document.
          const nameMatch = err.message.match(/"([^"]+)"/);
          const idx = nameMatch ? text.indexOf(nameMatch[1]) : -1;
          if (idx >= 0) {
            from = idx;
            to = idx + nameMatch![1].length;
          } else {
            from = 0;
            to = 0;
          }
        }
        const msg = err.message.replace(/ at line \d+ col \d+/, '');
        diagnostics.push({ from, to, severity: 'error', message: msg });
      }
    }

    return diagnostics;
  },
  { delay: 500 },
);
