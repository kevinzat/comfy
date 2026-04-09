import React from 'react';
import { Formula } from '../facts/formula';
import { AtomProp } from '../facts/prop';
import { TheoremAst } from '../lang/theorem_ast';
import { ProofGoal } from '../proof/proof_tactic';
import { ExprToHtml, OpToHtml } from './ProofElements';
import ProofBlock from './ProofBlock';
import './ProofGoalBlock.css';


export interface ProofGoalBlockProps {
  methodLabel: string;
  goals: ProofGoal[];
  defNames: string[];
  showHtml: boolean;
  onComplete?: (complete: boolean) => void;
}

interface ProofGoalBlockState {
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

export default class ProofGoalBlock
    extends React.Component<ProofGoalBlockProps, ProofGoalBlockState> {

  proofBlockRefs: React.RefObject<ProofBlock>[];

  constructor(props: ProofGoalBlockProps) {
    super(props);
    this.proofBlockRefs = props.goals.map(() => React.createRef<ProofBlock>());
    this.state = {
      caseComplete: props.goals.map(() => false),
    };
  }

  private handleCaseComplete(index: number, complete: boolean) {
    const caseComplete = this.state.caseComplete.slice();
    caseComplete[index] = complete;
    this.setState({ caseComplete });
    if (this.props.onComplete) {
      this.props.onComplete(caseComplete.every(c => c));
    }
  }

  private formatFormula(f: Formula): JSX.Element | string {
    if (this.props.showHtml) {
      return <span>{ExprToHtml(f.left)} {OpToHtml(f.op)} {ExprToHtml(f.right)}</span>;
    } else {
      return f.to_string();
    }
  }

  render() {
    const { methodLabel, goals, defNames, showHtml } = this.props;
    return (
      <div className="proof-goal-block">
        <div className="proof-goal-title">{methodLabel}</div>
        {goals.map((pg, idx) => {
          /* v8 ignore start */
          if (!(pg.goal instanceof AtomProp))
            throw new Error('proof goal is not a formula');
          /* v8 ignore stop */
          const formula = pg.goal.formula;
          const parentNumFacts = pg.env.numFacts() - pg.newFacts.length;
          const factStartIndex = parentNumFacts + 1;
          return (
            <div className="proof-goal-case" key={idx}>
              <div className="proof-goal-case-header">
                <span className="proof-goal-case-title">
                  Case {pg.label}:
                </span>
              </div>
              {pg.newTheorems.length > 0 && (
                <div className="proof-goal-theorems">
                  <div className="proof-goal-theorems-title">Induction hypotheses:</div>
                  <table className="proof-goal-theorems-table">
                    <tbody>
                      {pg.newTheorems.map((thm, i) => (
                        <tr key={i}>
                          <td className="proof-goal-theorems-index">
                            {formatTheoremName(thm)}:
                          </td>
                          <td className="proof-goal-theorems-formula">
                            {thm.conclusion.to_string()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {pg.newFacts.length > 0 && (
                <div className="proof-goal-known">
                  <table className="proof-goal-known-table">
                    <tbody>
                      {pg.newFacts.map((fact, i) => {
                        /* v8 ignore start */
                        if (!(fact instanceof AtomProp))
                          throw new Error('proof goal fact is not a formula');
                        /* v8 ignore stop */
                        return (
                          <tr key={i}>
                            <td className="proof-goal-known-index">{factStartIndex + i}.</td>
                            <td className="proof-goal-known-formula">
                              {this.formatFormula(fact.formula)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              <ProofBlock
                ref={this.proofBlockRefs[idx]}
                formula={formula}
                env={pg.env}
                defNames={defNames}
                showHtml={showHtml}
                onComplete={(complete) => this.handleCaseComplete(idx, complete)}
              />
            </div>
          );
        })}
      </div>
    );
  }
}
