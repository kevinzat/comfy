import React from 'react';
import { Formula } from '../facts/formula';
import { AtomProp } from '../facts/prop';
import { DeclsAst } from '../lang/decls_ast';
import { funcToDefinitions } from '../lang/func_ast';
import { TopLevelEnv, NestedEnv } from '../types/env';
import { ProofObligation } from '../program/obligations';
import { ProofEntry, ProofNode, GivenLine } from '../proof/proof_file';
import InlineProofBlock from './InlineProofBlock';
import './InlineProof.css';


export interface InlineProofProps {
  decls: DeclsAst;
  obligation: ProofObligation;
}

interface InlineProofState {
  collapsed: boolean;
  complete: boolean;
}

export default class InlineProof
    extends React.Component<InlineProofProps, InlineProofState> {

  private proofBlockRef = React.createRef<InlineProofBlock>();

  constructor(props: InlineProofProps) {
    super(props);
    this.state = { collapsed: false, complete: false };
  }

  /** Returns a ProofEntry for serialization (text/Lean export). */
  getProofEntry(theoremName: string): ProofEntry {
    const { obligation } = this.props;
    const givens: GivenLine[] = obligation.premises
      .flatMap((p, i) => p instanceof AtomProp
        ? [{ index: i + 1, text: p.formula.to_string(), line: 0 }]
        : []);
    const proof: ProofNode = this.proofBlockRef.current?.getProofNode()
        ?? { kind: 'none', methodLine: 0 };
    return { theoremName, theoremLine: 0, givens, proof };
  }

  render() {
    const { decls, obligation } = this.props;
    const { collapsed, complete } = this.state;
    const goalStr = obligation.goal.to_string();

    if (!(obligation.goal instanceof AtomProp)) {
      return (
        <div className="ip">
          <div className="ip-line">
            <span className="ip-error-msg">Cannot prove (goal involves ≠)</span>
          </div>
        </div>
      );
    }

    const bgClass = complete ? 'ip-bg-complete' : 'ip-bg-incomplete';

    const goal: Formula = obligation.goal.formula;
    const givens: AtomProp[] = obligation.premises
      .flatMap(p => p instanceof AtomProp ? [p] : []);

    const env = new TopLevelEnv(decls.types, decls.functions, [], decls.theorems);
    const proofEnv = new NestedEnv(env, obligation.params, givens);

    const premise = givens.length === 1 ? givens[0].formula : undefined;
    const defNames = decls.functions.flatMap(f => funcToDefinitions(f).map(d => d.name));

    return (
      <div className={`ip ${bgClass}`}>
        {/* Collapsed summary — shown when collapsed, click to expand. */}
        {collapsed && (
          <div className="ip-line ip-collapsed"
               onClick={() => this.setState({ collapsed: false })}>
            <span className="ip-keyword">prove</span>{' '}
            <span className="ip-formula">{goalStr}</span>{' '}
            <span className="ip-collapse-hint">...</span>
          </div>
        )}

        {/* Given lines — hidden when collapsed. */}
        {!collapsed && givens.map((g, i) => (
          <div key={`given-${i}`} className="ip-line ip-indent-1">
            <span className="ip-given-keyword">given</span>{' '}
            {i + 1}. {g.formula.to_string()}
          </div>
        ))}

        {/* Proof block — always mounted, hidden when collapsed. */}
        <div style={collapsed ? { display: 'none' } : undefined}>
          <InlineProofBlock
            ref={this.proofBlockRef}
            formula={goal}
            env={proofEnv}
            premise={premise}
            defNames={defNames}
            indent={0}
            onComplete={(c) => this.setState({ complete: c })}
            onCollapse={() => this.setState({ collapsed: true })}
          />
        </div>
      </div>
    );
  }
}
