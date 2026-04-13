import { Diagnostic, linter } from '@codemirror/lint';
import { EditorView } from '@codemirror/view';
import { parseProofFile } from '../proof/proof_file';
import { TopLevelEnv } from '../types/env';
import { UserError } from '../facts/user_error';
import { DeclsAst } from '../lang/decls_ast';


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
    return new UserError(msg, 0, 0, 0);
  }
}

/**
 * Converts a UserError (with line/col/length relative to a text block starting
 * at `startLine`) into a CodeMirror Diagnostic.
 */
function errorToDiagnostic(
    view: EditorView, err: UserError, startLine: number): Diagnostic | null {
  if (err.line <= 0) return null;

  const docLine = startLine + err.line - 1;
  const lineCount = view.state.doc.lines;
  if (docLine < 1 || docLine > lineCount) return null;

  const line = view.state.doc.line(docLine);
  const from = line.from + Math.max(0, err.col - 1);
  const to = err.length > 0
    ? Math.min(from + err.length, line.to)
    : line.to;

  const msg = err.message.replace(/ at line \d+ col \d+/, '');
  return { from, to, severity: 'error', message: msg };
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
      const lineCount = view.state.doc.lines;
      const clamped = Math.max(1, Math.min(err.line, lineCount));
      const line = view.state.doc.line(clamped);
      const msg = err.message.replace(/^line \d+:\s*/, '');
      diagnostics.push({ from: line.from, to: line.to, severity: 'error', message: msg });
    }

    // Type-check declarations from each decls item.
    for (const item of result.file.items) {
      if (item.kind !== 'decls') continue;
      const err = checkEnv(item.decls);
      if (err) {
        const diag = errorToDiagnostic(view, err, item.startLine);
        if (diag) diagnostics.push(diag);
      }
    }

    return diagnostics;
  },
  { delay: 500 },
);
