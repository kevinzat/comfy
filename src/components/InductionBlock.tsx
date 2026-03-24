import React from 'react';
import { Formula } from '../facts/formula';
import { Environment } from '../types/env';
import { CaseInfo, buildCases } from '../proof/induction';
import { ExprToHtml, OpToHtml } from './ProofElements';
import ProofBlock from './ProofBlock';
import './InductionBlock.css';


export { buildCases } from '../proof/induction';
export type { CaseInfo } from '../proof/induction';

export interface InductionBlockProps {
  formula: Formula;
  env: Environment;
  varName: string;
  argNames?: string[];
  defNames?: string[];
  showHtml: boolean;
  onComplete?: (complete: boolean) => void;
}


interface InductionBlockState {
  caseComplete: boolean[];
}

export default class InductionBlock
    extends React.Component<InductionBlockProps, InductionBlockState> {

  private cases: CaseInfo[];

  constructor(props: InductionBlockProps) {
    super(props);
    this.cases = buildCases(props.formula, props.env, props.varName, props.argNames);
    this.state = {
      caseComplete: this.cases.map(() => false),
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

  formatFormula(f: Formula): JSX.Element | string {
    if (this.props.showHtml) {
      return <span>{ExprToHtml(f.left)} {OpToHtml(f.op)} {ExprToHtml(f.right)}</span>;
    } else {
      return f.to_string();
    }
  }

  render() {
    const { varName, showHtml } = this.props;
    const parentNumFacts = this.props.env.numFacts();

    return (
      <div className="induction-block">
        <div className="induction-title">
          Proof by induction on <i>{varName}</i>:
        </div>
        {this.cases.map((c, idx) => {
          const ctorLabel = c.argNames.length === 0
            ? c.ctor.name
            : `${c.ctor.name}(${c.argNames.map((n, i) =>
                `${n}: ${c.argTypes[i]}`).join(', ')})`;

          return (
            <div className="induction-case" key={idx}>
              <div className="induction-case-header">
                <span className="induction-case-title">
                  Case <i>{varName}</i> = {ctorLabel}:
                </span>
              </div>
              {c.ihFacts.length > 0 && (
                <div className="induction-ih">
                  <div className="induction-ih-title">Induction hypotheses:</div>
                  <table className="induction-ih-table">
                    <tbody>
                      {c.ihFacts.map((f, i) => (
                        <tr key={i}>
                          <td className="induction-ih-index">
                            {parentNumFacts + i + 1}.
                          </td>
                          <td className="induction-ih-formula">
                            {this.formatFormula(f)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <ProofBlock
                formula={c.goal}
                env={c.env}
                defNames={this.props.defNames}
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
