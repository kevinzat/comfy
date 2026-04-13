import { WidgetType, EditorView } from '@codemirror/view';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { DeclsAst } from '../lang/decls_ast';
import { TheoremAst } from '../lang/theorem_ast';
import { theoremToProofObligation } from '../program/obligations';
import InlineProof from './InlineProof';


export class ProofWidget extends WidgetType {
  private root: ReturnType<typeof createRoot> | null = null;

  constructor(
    readonly theorem: TheoremAst,
    readonly decls: DeclsAst,
    /** Hash of the declarations text, used for eq() comparison. */
    readonly declsHash: string,
  ) {
    super();
  }

  eq(other: ProofWidget): boolean {
    return this.theorem.name === other.theorem.name
        && this.declsHash === other.declsHash;
  }

  toDOM(_view: EditorView): HTMLElement {
    const container = document.createElement('div');
    container.className = 'cm-proof-widget';
    this.root = createRoot(container);

    const obligation = theoremToProofObligation(this.theorem);
    this.root.render(
      React.createElement(InlineProof, {
        decls: this.decls,
        obligation,
      })
    );

    return container;
  }

  destroy(_dom: HTMLElement): void {
    if (this.root) {
      const root = this.root;
      this.root = null;
      // Defer unmount to avoid React warnings about synchronous unmount.
      setTimeout(() => root.unmount(), 0);
    }
  }

  get estimatedHeight(): number {
    return 200;
  }

  ignoreEvent(): boolean {
    // Let all events through to the React component inside the widget.
    return true;
  }
}
