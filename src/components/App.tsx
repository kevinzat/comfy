import React from 'react';
import { DeclsAst } from '../lang/decls_ast';
import { ProofObligation, oblKey } from '../program/obligations';
import ProofSetup from './ProofSetup';
import Proof from './Proof';
import UnifiedEditor from '../editor/UnifiedEditor';


interface OpenProof {
  decls: DeclsAst;
  obligation: ProofObligation;
}

interface AppState {
  mode: 'basic' | 'advanced';
  view: 'setup' | 'proof';
  activeKey: string | null;
  openProofs: Map<string, OpenProof>;
  provedObls: Set<string>;
}

const linkStyle: React.CSSProperties = {
  cursor: 'pointer',
  color: '#666',
  fontSize: 13,
  fontFamily: 'monospace',
};

export default class App extends React.Component<{}, AppState> {
  constructor(props: {}) {
    super(props);
    this.state = {
      mode: 'basic',
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

  private renderModeLink() {
    const { mode } = this.state;
    const label = mode === 'basic' ? 'Advanced' : 'Basic';
    return (
      <span style={linkStyle} onClick={() => this.setState({ mode: mode === 'basic' ? 'advanced' : 'basic' })}>
        {label}
      </span>
    );
  }

  render() {
    const { mode } = this.state;

    if (mode === 'advanced') {
      return (
        <div>
          <div style={{ textAlign: 'right', padding: '6px 20px 0' }}>
            {this.renderModeLink()}
          </div>
          <UnifiedEditor />
        </div>
      );
    }

    const inProof = this.state.view === 'proof';
    return (
      <>
        <div style={{ textAlign: 'right', padding: '10px 20px 0' }}>
          {this.renderModeLink()}
        </div>
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
