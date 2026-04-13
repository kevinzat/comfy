import React from 'react';
import { AtomProp } from '../facts/prop';
import { TheoremAst } from '../lang/theorem_ast';
import { ProofGoal } from '../proof/proof_tactic';
import InlineProofBlock from './InlineProofBlock';


export interface InlineCaseBlockProps {
  goals: ProofGoal[];
  defNames: string[];
  onComplete?: (complete: boolean) => void;
}

interface InlineCaseBlockState {
  caseComplete: boolean[];
}

function formatTheoremName(thm: TheoremAst): string {
  if (thm.params.length === 0) return thm.name;
  const groups: { names: string[]; type: string }[] = [];
  for (const [name, type] of thm.params) {
    const last = groups[groups.length - 1];
    if (last && last.type === type) {
      last.names.push(name);
    } else {
      groups.push({ names: [name], type });
    }
  }
  const paramStr = groups.map(g =>
    `(${g.names.join(', ')} : ${g.type})`).join(' ');
  return `${thm.name} ${paramStr}`;
}

export default class InlineCaseBlock
    extends React.Component<InlineCaseBlockProps, InlineCaseBlockState> {

  constructor(props: InlineCaseBlockProps) {
    super(props);
    this.state = { caseComplete: props.goals.map(() => false) };
  }

  private handleCaseComplete(index: number, complete: boolean) {
    const caseComplete = this.state.caseComplete.slice();
    caseComplete[index] = complete;
    this.setState({ caseComplete });
    if (this.props.onComplete) {
      this.props.onComplete(caseComplete.every(c => c));
    }
  }

  render() {
    const { goals, defNames } = this.props;
    const lines: JSX.Element[] = [];

    for (let idx = 0; idx < goals.length; idx++) {
      const pg = goals[idx];

      // Case header.
      lines.push(
        <div key={`case-${idx}`} className="ip-line ip-indent-1">
          <span className="ip-case-keyword">case</span> {pg.label}:
        </div>
      );

      // Induction hypotheses.
      for (let i = 0; i < pg.newTheorems.length; i++) {
        const thm = pg.newTheorems[i];
        lines.push(
          <div key={`ih-${idx}-${i}`} className="ip-line ip-indent-2">
            <span className="ip-given-keyword">given</span>{' '}
            {formatTheoremName(thm)}: {thm.conclusion.to_string()}
          </div>
        );
      }

      // Given facts.
      const parentNumFacts = pg.env.numFacts() - pg.newFacts.length;
      for (let i = 0; i < pg.newFacts.length; i++) {
        const fact = pg.newFacts[i];
        if (!(fact instanceof AtomProp)) continue;
        lines.push(
          <div key={`given-${idx}-${i}`} className="ip-line ip-indent-2">
            <span className="ip-given-keyword">given</span>{' '}
            {parentNumFacts + i + 1}. {fact.formula.to_string()}
          </div>
        );
      }

      // Nested proof block for this case.
      if (!(pg.goal instanceof AtomProp)) continue;
      lines.push(
        <div key={`proof-${idx}`}>
          <InlineProofBlock
            formula={pg.goal.formula}
            env={pg.env}
            defNames={defNames}
            indent={2}
            onComplete={(c) => this.handleCaseComplete(idx, c)}
          />
        </div>
      );
    }

    return <>{lines}</>;
  }
}
