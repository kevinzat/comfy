import React, { useRef, useEffect } from 'react';
import { EditorState, Transaction } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, drawSelection, highlightActiveLine } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { proofPlugin } from './proofPlugin';
import { comfyHighlight } from './comfyHighlight';
import { comfyLinter } from './comfyLinter';


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

export default function UnifiedEditor() {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

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

  return (
    <div style={{ padding: '0 20px 20px' }}>
      <div ref={containerRef} />
    </div>
  );
}
