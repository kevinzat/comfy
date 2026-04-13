import React, { useRef, useEffect, useState, useCallback } from 'react';
import { EditorState, Transaction } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, drawSelection, highlightActiveLine } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { proofPlugin, getProofEntries } from './proofPlugin';
import { comfyHighlight } from './comfyHighlight';
import { comfyLinter } from './comfyLinter';
import { findProofRanges } from './proofRanges';
import { buildProofFileText } from './exportText';
import { ParseDecls } from '../lang/decls_parser';
import { ProofFile, ProofFileItem } from '../proof/proof_file';
import { toLean } from '../proof/lean';


/**
 * Ensures the document always ends with a newline so the cursor can be
 * positioned after a prove-block widget at the end of the file.
 */
const ensureTrailingNewline = EditorState.transactionFilter.of((tr: Transaction) => {
  if (!tr.docChanged) return tr;
  const doc = tr.newDoc;
  const last = doc.line(doc.lines);
  if (last.length > 0) {
    return [tr, { changes: { from: doc.length, insert: '\n' }, sequential: true }];
  }
  return tr;
});

const editorTheme = EditorView.theme({
  '&': {
    fontSize: '13px',
    fontFamily: 'monospace',
  },
  '.cm-content': {
    fontFamily: 'monospace',
    minHeight: '300px',
  },
  '.cm-proof-widget': {
    borderLeft: '3px solid #b06000',
    marginLeft: '4px',
    paddingLeft: '8px',
    marginTop: '4px',
    marginBottom: '4px',
  },
});

type ViewMode = 'editor' | 'text' | 'lean';

/**
 * Build the full .prf text from the editor doc and proof widget state.
 */
function buildProofText(view: EditorView): string {
  const doc = view.state.doc.toString();
  const ranges = findProofRanges(doc);
  const entries = getProofEntries(view);
  return buildProofFileText(doc, ranges, entries);
}

/**
 * Build a ProofFile from the editor doc and proof widget state for Lean export.
 */
function buildProofFile(view: EditorView): ProofFile {
  const doc = view.state.doc.toString();
  const ranges = findProofRanges(doc);
  const entries = getProofEntries(view);
  const entryMap = new Map(entries.map(e => [e.theoremName, e]));

  const items: ProofFileItem[] = [];

  // All declarations come from text before proof blocks.
  // Parse all non-prove text as a single decls block.
  const declParts: string[] = [];
  let cursor = 0;
  for (const range of ranges) {
    if (range.from > cursor) {
      declParts.push(doc.substring(cursor, range.from));
    }
    cursor = range.to;
    if (cursor < doc.length && doc[cursor] === '\n') cursor++;
  }
  if (cursor < doc.length) {
    declParts.push(doc.substring(cursor));
  }

  const declText = declParts.join('').trim();
  if (declText.length > 0) {
    const result = ParseDecls(declText);
    items.push({ kind: 'decls', decls: result.ast, startLine: 1 });
  }

  // Add proof entries.
  for (const range of ranges) {
    const entry = entryMap.get(range.theoremName);
    if (entry) {
      items.push({ kind: 'proof', entry });
    }
  }

  return { items };
}

export default function UnifiedEditor() {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const [mode, setMode] = useState<ViewMode>('editor');
  const [outputText, setOutputText] = useState('');

  useEffect(() => {
    if (!containerRef.current) return;

    const state = EditorState.create({
      doc: '',
      extensions: [
        lineNumbers(),
        drawSelection(),
        highlightActiveLine(),
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        ensureTrailingNewline,
        editorTheme,
        comfyHighlight,
        comfyLinter,
        proofPlugin,
      ],
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });
    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  const handleShowText = useCallback(() => {
    if (mode === 'text') {
      setMode('editor');
      return;
    }
    const view = viewRef.current;
    if (!view) return;
    setOutputText(buildProofText(view));
    setMode('text');
  }, [mode]);

  const handleShowLean = useCallback(() => {
    if (mode === 'lean') {
      setMode('editor');
      return;
    }
    const view = viewRef.current;
    if (!view) return;
    try {
      const pf = buildProofFile(view);
      setOutputText(toLean(pf));
    } catch (e: any) {
      setOutputText(`Error generating Lean: ${e.message}`);
    }
    setMode('lean');
  }, [mode]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(outputText);
  }, [outputText]);

  return (
    <div style={{ padding: '0 20px 20px', maxWidth: '100ch' }}>
      <div ref={containerRef}
           style={{ display: mode === 'editor' ? undefined : 'none' }} />
      {mode !== 'editor' && (
        <div style={{
          fontFamily: 'monospace',
          fontSize: '13px',
          whiteSpace: 'pre-wrap',
          background: '#f8f8f8',
          border: '1px solid #ddd',
          borderRadius: '4px',
          padding: '12px',
          minHeight: '200px',
          lineHeight: 1.5,
        }}>
          {outputText}
        </div>
      )}
      <div style={{
        marginTop: '8px',
        display: 'flex',
        gap: '8px',
        alignItems: 'center',
      }}>
        <button onClick={handleShowText}
                style={buttonStyle(mode === 'text')}>
          {mode === 'text' ? 'Back to Editor' : 'Show Text'}
        </button>
        <button onClick={handleShowLean}
                style={buttonStyle(mode === 'lean')}>
          {mode === 'lean' ? 'Back to Editor' : 'Show Lean'}
        </button>
        {mode !== 'editor' && (
          <button onClick={handleCopy} style={buttonStyle(false)}>
            Copy
          </button>
        )}
      </div>
    </div>
  );
}

function buttonStyle(active: boolean): React.CSSProperties {
  return {
    fontFamily: 'monospace',
    fontSize: '13px',
    padding: '4px 12px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    background: active ? '#e8e0d0' : '#fff',
    cursor: 'pointer',
  };
}
