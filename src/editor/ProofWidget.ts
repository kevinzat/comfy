import { WidgetType, EditorView } from '@codemirror/view';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { DeclsAst } from '../lang/decls_ast';
import { TheoremAst } from '../lang/theorem_ast';
import { ProofNode } from '../proof/proof_file';
import { serializeProofEntry } from '../proof/proof_serialize';
import { theoremToProofObligation } from '../program/obligations';
import { findProofRanges } from './proofRanges';
import InlineProof, { InlineProofProps } from './InlineProof';


export class ProofWidget extends WidgetType {
  private root: ReturnType<typeof createRoot> | null = null;
  /** Reference to the InlineProof component for extracting proof state. */
  inlineProof: InlineProof | null = null;
  private view: EditorView | null = null;
  private syncTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    readonly theorem: TheoremAst,
    readonly decls: DeclsAst,
    /** Hash of the declarations text, used for eq() comparison. */
    readonly declsHash: string,
    readonly initialProof?: ProofNode,
  ) {
    super();
  }

  eq(other: ProofWidget): boolean {
    return this.theorem.name === other.theorem.name
        && this.declsHash === other.declsHash;
  }

  private renderInto(container: HTMLElement): void {
    if (!this.root) return;
    const obligation = theoremToProofObligation(this.theorem);
    const props: React.ClassAttributes<InlineProof> & InlineProofProps = {
      ref: (instance: InlineProof | null) => { this.inlineProof = instance; },
      decls: this.decls,
      obligation,
      initialProof: this.initialProof,
      onStateChange: () => this.scheduleSync(),
    };
    this.root.render(React.createElement(InlineProof, props));
    (container as any).__proofWidget = this;
  }

  toDOM(view: EditorView): HTMLElement {
    this.view = view;
    const container = document.createElement('div');
    container.className = 'cm-proof-widget';
    this.root = createRoot(container);

    this.renderInto(container);

    // After React renders, tell CodeMirror to remeasure widget heights
    // so click-to-position mapping stays accurate.
    requestAnimationFrame(() => view.requestMeasure());

    return container;
  }

  /**
   * Called by CodeMirror when a new widget instance replaces an old one at
   * the same position. Transfers the React root from the old widget and
   * re-renders into it, so internal React state (expanded/collapsed, focus,
   * in-progress input) survives decls edits that change `declsHash`.
   */
  updateDOM(dom: HTMLElement, view: EditorView): boolean {
    const oldWidget = (dom as any).__proofWidget as ProofWidget | undefined;
    if (!oldWidget || !oldWidget.root) return false;

    this.view = view;
    this.root = oldWidget.root;
    this.inlineProof = oldWidget.inlineProof;

    // Prevent the old widget's destroy() from unmounting the root we just took.
    oldWidget.root = null;
    oldWidget.inlineProof = null;
    if (oldWidget.syncTimer) {
      clearTimeout(oldWidget.syncTimer);
      oldWidget.syncTimer = null;
    }

    this.renderInto(dom);
    return true;
  }

  /**
   * Coalesces rapid state changes then writes the serialized proof back to
   * the underlying doc, so the doc is always the source of truth and widget
   * state survives decls edits that trigger a widget rebuild.
   */
  private scheduleSync(): void {
    if (this.syncTimer) clearTimeout(this.syncTimer);
    this.syncTimer = setTimeout(() => {
      this.syncTimer = null;
      this.syncToDoc();
    }, 100);
  }

  private syncToDoc(): void {
    const view = this.view;
    if (!view || !this.inlineProof) return;
    const entry = this.inlineProof.getProofEntry(this.theorem.name);
    const serialized = serializeProofEntry(entry);
    const doc = view.state.doc.toString();
    const ranges = findProofRanges(doc);
    const range = ranges.find(r => r.theoremName === this.theorem.name);
    if (!range) return;
    const currentText = doc.substring(range.from, range.to);
    if (currentText === serialized) return;
    view.dispatch({
      changes: { from: range.from, to: range.to, insert: serialized },
    });
  }

  destroy(_dom: HTMLElement): void {
    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
      this.syncTimer = null;
    }
    if (this.root) {
      const root = this.root;
      this.root = null;
      // Defer unmount to avoid React warnings about synchronous unmount.
      setTimeout(() => root.unmount(), 0);
    }
    this.view = null;
  }

  get estimatedHeight(): number {
    return 200;
  }

  ignoreEvent(): boolean {
    // Let all events through to the React component inside the widget.
    return true;
  }
}
