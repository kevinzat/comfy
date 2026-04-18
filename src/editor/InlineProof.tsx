import React from 'react';
import { Formula, OP_EQUAL } from '../facts/formula';
import { AtomProp, NotProp } from '../facts/prop';
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
  initialProof?: ProofNode;
  onStateChange?: () => void;
}

interface InlineProofState {
  complete: boolean;
}

export default class InlineProof
    extends React.Component<InlineProofProps, InlineProofState> {

  private proofBlockRef = React.createRef<InlineProofBlock>();

  constructor(props: InlineProofProps) {
    super(props);
    this.state = { complete: false };
  }

  /** Returns a ProofEntry for serialization (text/Lean export). */
  getProofEntry(theoremName: string): ProofEntry {
    const { obligation } = this.props;
    const givens: GivenLine[] = obligation.premises.map((p, i) =>
        ({ index: i + 1, prop: p, line: 0 }));
    const proof: ProofNode = this.proofBlockRef.current?.getProofNode()
        ?? { kind: 'none', methodLine: 0 };
    return { theoremName, theoremLine: 0, givens, proof };
  }

  render() {
    const { decls, obligation } = this.props;
    const { complete } = this.state;

    let goal: Formula;
    let isNotGoal = false;
    if (obligation.goal instanceof AtomProp) {
      goal = obligation.goal.formula;
    } else if (obligation.goal instanceof NotProp
        && obligation.goal.formula.op === OP_EQUAL) {
      goal = obligation.goal.formula;
      isNotGoal = true;
    } else {
      return (
        <div className="ip">
          <div className="ip-line">
            <span className="ip-error-msg">Cannot prove this goal</span>
          </div>
        </div>
      );
    }

    const bgClass = complete ? 'ip-bg-complete' : 'ip-bg-incomplete';
    const givens: AtomProp[] = obligation.premises
      .flatMap(p => p instanceof AtomProp ? [p] : []);

    const env = new TopLevelEnv(decls.types, decls.functions, [], decls.theorems);
    const proofEnv = new NestedEnv(env, obligation.params, givens);

    const premise = givens.length === 1 ? givens[0].formula : undefined;
    const defNames = decls.functions.flatMap(f => funcToDefinitions(f).map(d => d.name));

    return (
      <div className={`ip ${bgClass}`}>
        {givens.map((g, i) => (
          <div key={`given-${i}`} className="ip-line ip-indent-1">
            <span className="ip-given-keyword">given</span>{' '}
            {i + 1}. {g.formula.to_string()}
          </div>
        ))}

        <InlineProofBlock
          ref={this.proofBlockRef}
          formula={goal}
          isNegated={isNotGoal}
          env={proofEnv}
          premise={premise}
          defNames={defNames}
          indent={0}
          initialProof={this.props.initialProof}
          onComplete={(c) => this.setState({ complete: c })}
          onStateChange={this.props.onStateChange}
        />
      </div>
    );
  }
}
