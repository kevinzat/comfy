import React from 'react';
import { AtomProp, NotProp } from '../facts/prop';
import { Formula, OP_EQUAL } from '../facts/formula';
import { TheoremAst } from '../lang/theorem_ast';
import { ProofGoal } from '../proof/proof_tactic';
import { ProofNode } from '../proof/proof_file';
import InlineProofBlock from './InlineProofBlock';


export interface InlineCaseBlockProps {
  goals: ProofGoal[];
  defNames: string[];
  indent?: number;
  initialProofs?: ProofNode[];
  onComplete?: (complete: boolean) => void;
  onStateChange?: () => void;
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

  proofBlockRefs: React.RefObject<InlineProofBlock>[];

  constructor(props: InlineCaseBlockProps) {
    super(props);
    this.state = { caseComplete: props.goals.map(() => false) };
    this.proofBlockRefs = props.goals.map(() => React.createRef<InlineProofBlock>());
  }

  componentDidMount() {
    // A tactic that decomposes to zero subgoals (e.g. `auto` discharging
    // an equation, `verum`) produces an empty goals array. With nothing
    // to render, no child ever fires onComplete, so the parent would
    // otherwise stay incomplete. Report vacuous completion explicitly.
    if (this.props.goals.length === 0) this.props.onComplete?.(true);
  }

  private handleCaseComplete(index: number, complete: boolean) {
    this.setState(prev => {
      const caseComplete = prev.caseComplete.slice();
      caseComplete[index] = complete;
      return { caseComplete };
    }, () => {
      if (this.props.onComplete) {
        this.props.onComplete(this.state.caseComplete.every(c => c));
      }
    });
  }

  render() {
    const { goals, defNames } = this.props;
    const indent = (this.props.indent ?? 0) + 1;
    const indentClass = `ip-indent-${Math.min(indent, 4)}`;
    const bodyIndentClass = `ip-indent-${Math.min(indent + 1, 4)}`;
    const lines: JSX.Element[] = [];

    for (let idx = 0; idx < goals.length; idx++) {
      const pg = goals[idx];

      // Case header.
      lines.push(
        <div key={`case-${idx}`} className={`ip-line ${indentClass}`}>
          <span className="ip-case-keyword">case</span> {pg.label}:
        </div>
      );

      // Induction hypotheses.
      for (let i = 0; i < pg.newTheorems.length; i++) {
        const thm = pg.newTheorems[i];
        lines.push(
          <div key={`ih-${idx}-${i}`} className={`ip-line ${bodyIndentClass}`}>
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
          <div key={`given-${idx}-${i}`} className={`ip-line ${bodyIndentClass}`}>
            <span className="ip-given-keyword">given</span>{' '}
            {parentNumFacts + i + 1}. {fact.formula.to_string()}
          </div>
        );
      }

      // Nested proof block for this case. Accept AtomProp goals and
      // NotProp(a = b) goals (the only NotProp shape the calc checker supports).
      let goalFormula: Formula;
      let isNotEq = false;
      if (pg.goal instanceof AtomProp) {
        goalFormula = pg.goal.formula;
      } else if (pg.goal instanceof NotProp && pg.goal.formula.op === OP_EQUAL) {
        goalFormula = pg.goal.formula;
        isNotEq = true;
      } else {
        continue;
      }
      lines.push(
        <div key={`proof-${idx}`}>
          <InlineProofBlock
            ref={this.proofBlockRefs[idx]}
            formula={goalFormula}
            isNegated={isNotEq}
            env={pg.env}
            defNames={defNames}
            indent={indent + 1}
            initialProof={this.props.initialProofs?.[idx]}
            onComplete={(c) => this.handleCaseComplete(idx, c)}
            onStateChange={this.props.onStateChange}
          />
        </div>
      );
    }

    return <>{lines}</>;
  }
}
