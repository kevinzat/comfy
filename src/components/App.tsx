import React from 'react';
import { DeclsAst } from '../lang/decls_ast';
import { ProofObligation, oblKey } from '../program/obligations';
import ProofSetup from './ProofSetup';
import Proof from './Proof';


interface OpenProof {
  decls: DeclsAst;
  obligation: ProofObligation;
}

interface AppState {
  view: 'setup' | 'proof';
  activeKey: string | null;
  // All obligations that have been opened, keyed by oblKey. Kept mounted so
  // proof state is preserved when navigating away and back.
  openProofs: Map<string, OpenProof>;
  provedObls: Set<string>;
}

export default class App extends React.Component<{}, AppState> {
  constructor(props: {}) {
    super(props);
    this.state = {
      view: 'setup',
      activeKey: null,
      openProofs: new Map(),
      provedObls: new Set(),
    };
  }

  private handleStart(decls: DeclsAst, obligation: ProofObligation) {
    const key = oblKey(obligation);
    const openProofs = new Map(this.state.openProofs);
    if (!openProofs.has(key)) {
      openProofs.set(key, { decls, obligation });
    }
    this.setState({ view: 'proof', activeKey: key, openProofs });
  }

  private handleBack(proved: boolean) {
    const { activeKey, provedObls } = this.state;
    if (proved && activeKey) {
      const next = new Set(provedObls);
      next.add(activeKey);
      this.setState({ view: 'setup', provedObls: next });
    } else {
      this.setState({ view: 'setup' });
    }
  }

  render() {
    const inProof = this.state.view === 'proof';
    return (
      <>
        <div style={{ display: inProof ? 'none' : 'block' }}>
          <ProofSetup
              onStart={(decls, obl) => this.handleStart(decls, obl)}
              provedObls={this.state.provedObls} />
        </div>
        {[...this.state.openProofs.entries()].map(([key, { decls, obligation }]) => (
          <div key={key} style={{ display: (inProof && key === this.state.activeKey) ? 'block' : 'none' }}>
            <Proof
                decls={decls}
                obligation={obligation}
                onBack={(proved) => this.handleBack(proved)} />
          </div>
        ))}
      </>
    );
  }
}
