import { RangeSetBuilder, StateField, StateEffect, Transaction } from '@codemirror/state';
import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate } from '@codemirror/view';
import { buildDocSections } from './proofRanges';
import { ProofWidget } from './ProofWidget';
import { ProofEntry } from '../proof/proof_file';


/** Simple string hash for comparing declarations text. */
function hashStr(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return String(h);
}

function buildDecorations(doc: string, docLength: number): DecorationSet {
  const sections = buildDocSections(doc);
  const builder = new RangeSetBuilder<Decoration>();

  for (const section of sections) {
    if (!section.theorem) continue;

    const declsText = doc.substring(0, section.range.from);
    const widget = new ProofWidget(
      section.theorem,
      section.decls,
      hashStr(declsText),
    );

    const to = Math.min(section.range.to, docLength);
    builder.add(
      section.range.from,
      to,
      Decoration.replace({ widget, block: true }),
    );
  }

  return builder.finish();
}

const setDecorations = StateEffect.define<DecorationSet>();

/** StateField that holds the proof widget decorations. */
const proofDecoField = StateField.define<DecorationSet>({
  create(state) {
    return buildDecorations(state.doc.toString(), state.doc.length);
  },
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setDecorations)) return effect.value;
    }
    return value;
  },
  provide: (f) => EditorView.decorations.from(f),
});

/**
 * ViewPlugin that watches for document changes and dispatches updated
 * decorations after a debounce.
 */
const proofUpdater = ViewPlugin.fromClass(
  class {
    private debounceTimer: ReturnType<typeof setTimeout> | null = null;

    update(update: ViewUpdate) {
      if (update.docChanged) {
        if (this.debounceTimer) clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => {
          const doc = update.view.state.doc.toString();
          const decos = buildDecorations(doc, update.view.state.doc.length);
          update.view.dispatch({ effects: setDecorations.of(decos) });
        }, 300);
      }
    }

    destroy() {
      if (this.debounceTimer) clearTimeout(this.debounceTimer);
    }
  },
);

/** Extract ProofEntry objects from all proof widgets in the editor. */
export function getProofEntries(view: EditorView): ProofEntry[] {
  const decoSet = view.state.field(proofDecoField);
  const entries: ProofEntry[] = [];
  const iter = decoSet.iter();
  while (iter.value) {
    const spec = iter.value.spec;
    if (spec.widget instanceof ProofWidget) {
      const widget = spec.widget;
      const entry = widget.inlineProof?.getProofEntry(widget.theorem.name);
      if (entry) entries.push(entry);
    }
    iter.next();
  }
  return entries;
}

/** Combined extension: StateField for decorations + ViewPlugin for debounced updates. */
export const proofPlugin = [proofDecoField, proofUpdater];
