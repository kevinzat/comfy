import { WidgetType, EditorView } from '@codemirror/view';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { DeclsAst } from '../lang/decls_ast';
import { TheoremAst } from '../lang/theorem_ast';
import { ProofNode } from '../proof/proof_file';
import { theoremToProofObligation } from '../program/obligations';
import InlineProof, { InlineProofProps } from './InlineProof';


export class ProofWidget extends WidgetType {
  private root: ReturnType<typeof createRoot> | null = null;
  /** Reference to the InlineProof component for extracting proof state. */
  inlineProof: InlineProof | null = null;

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

  toDOM(_view: EditorView): HTMLElement {
    const container = document.createElement('div');
    container.className = 'cm-proof-widget';
    this.root = createRoot(container);

    const obligation = theoremToProofObligation(this.theorem);
    const props: React.ClassAttributes<InlineProof> & InlineProofProps = {
      ref: (instance: InlineProof | null) => { this.inlineProof = instance; },
      decls: this.decls,
      obligation,
      initialProof: this.initialProof,
    };
    this.root.render(React.createElement(InlineProof, props));

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
