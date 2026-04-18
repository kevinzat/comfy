import { Diagnostic, linter } from '@codemirror/lint';
import { EditorView } from '@codemirror/view';
import { parseProofFile } from '../proof/proof_file';
import { checkProofFile, CheckError } from '../proof/proof_file_checker';


/**
 * Converts a CheckError (with source-absolute line, and optionally col/length)
 * into a CodeMirror Diagnostic. If col/length are 0 (unknown), highlights
 * the whole line.
 */
function checkErrorToDiagnostic(view: EditorView, err: CheckError): Diagnostic | null {
  if (err.line <= 0) return null;
  const lineCount = view.state.doc.lines;
  if (err.line > lineCount) return null;

  const line = view.state.doc.line(err.line);
  const from = err.col > 0
      ? line.from + Math.min(err.col - 1, line.length)
      : line.from;
  const to = err.length > 0
      ? Math.min(from + err.length, line.to)
      : line.to;

  const msg = err.message.replace(/^line \d+:\s*/, '');
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

    // Type-check and proof-check the whole file as one unit, so that decls
    // accumulate across blocks (a theorem in block 2 can reference a function
    // from block 1) and every decls block is validated even without a proof.
    const { errors: checkErrors } = checkProofFile(result.file);
    for (const err of checkErrors) {
      const diag = checkErrorToDiagnostic(view, err);
      if (diag) diagnostics.push(diag);
    }

    return diagnostics;
  },
  { delay: 500 },
);
