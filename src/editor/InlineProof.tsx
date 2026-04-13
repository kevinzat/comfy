import React from 'react';
import { Formula } from '../facts/formula';
import { AtomProp } from '../facts/prop';
import { DeclsAst } from '../lang/decls_ast';
import { funcToDefinitions } from '../lang/func_ast';
import { TopLevelEnv, NestedEnv } from '../types/env';
import { ProofObligation } from '../program/obligations';
import InlineProofBlock from './InlineProofBlock';
import './InlineProof.css';


export interface InlineProofProps {
  decls: DeclsAst;
  obligation: ProofObligation;
}

export default class InlineProof
    extends React.Component<InlineProofProps, {}> {

  render() {
    const { decls, obligation } = this.props;

    if (!(obligation.goal instanceof AtomProp)) {
      return (
        <div className="ip">
          <div className="ip-line">
            <span className="ip-error-msg">Cannot prove (goal involves ≠)</span>
          </div>
        </div>
      );
    }

    const goal: Formula = obligation.goal.formula;
    const givens: AtomProp[] = obligation.premises
      .flatMap(p => p instanceof AtomProp ? [p] : []);

    const env = new TopLevelEnv(decls.types, decls.functions, [], decls.theorems);
    const proofEnv = new NestedEnv(env, obligation.params, givens);

    const premise = givens.length === 1 ? givens[0].formula : undefined;
    const defNames = decls.functions.flatMap(f => funcToDefinitions(f).map(d => d.name));

    const lines: JSX.Element[] = [];

    // Given lines.
    for (let i = 0; i < givens.length; i++) {
      lines.push(
        <div key={`given-${i}`} className="ip-line ip-indent-1">
          <span className="ip-given-keyword">given</span>{' '}
          {i + 1}. {givens[i].formula.to_string()}
        </div>
      );
    }

    // Proof block.
    lines.push(
      <div key="proof">
        <InlineProofBlock
          formula={goal}
          env={proofEnv}
          premise={premise}
          defNames={defNames}
          indent={0}
        />
      </div>
    );

    return <div className="ip">{lines}</div>;
  }
}
