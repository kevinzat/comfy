import React from 'react';
import { Formula } from '../facts/formula';
import { Environment } from '../types/env';
import { NestedEnv } from '../types/env';
import { ExprToHtml, OpToHtml } from './ProofElements';
import { buildCasesOnCondition } from '../proof/cases';
import ProofBlock from './ProofBlock';
import './CasesBlock.css';


export interface CasesBlockProps {
  formula: Formula;
  condition: Formula;
  env: Environment;
  defNames: string[];
  showHtml: boolean;
  onComplete?: (complete: boolean) => void;
}

interface CasesBlockState {
  caseComplete: [boolean, boolean];
}

export default class CasesBlock
    extends React.Component<CasesBlockProps, CasesBlockState> {

  private negated: Formula;
  private thenEnv: NestedEnv;
  private elseEnv: NestedEnv;

  constructor(props: CasesBlockProps) {
    super(props);
    const info = buildCasesOnCondition(props.env, props.condition);
    this.negated = info.negated;
    this.thenEnv = info.thenEnv;
    this.elseEnv = info.elseEnv;
    this.state = { caseComplete: [false, false] };
  }

  private handleCaseComplete(index: 0 | 1, complete: boolean) {
    const caseComplete: [boolean, boolean] = [...this.state.caseComplete];
    caseComplete[index] = complete;
    this.setState({ caseComplete });
    if (this.props.onComplete) {
      this.props.onComplete(caseComplete[0] && caseComplete[1]);
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
    const { formula, condition, defNames, showHtml } = this.props;
    const parentNumFacts = this.props.env.numFacts();
    const factIndex = parentNumFacts + 1;

    return (
      <div className="cases-block">
        <div className="cases-title">Proof by cases:</div>

        <div className="cases-case">
          <div className="cases-case-header">
            <span className="cases-case-title">
              Case {this.formatFormula(condition)}:
            </span>
          </div>
          <div className="cases-known">
            <table className="cases-known-table">
              <tbody>
                <tr>
                  <td className="cases-known-index">{factIndex}.</td>
                  <td className="cases-known-formula">
                    {this.formatFormula(condition)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <ProofBlock formula={formula} env={this.thenEnv}
              defNames={defNames} showHtml={showHtml}
              onComplete={(c) => this.handleCaseComplete(0, c)} />
        </div>

        <div className="cases-case">
          <div className="cases-case-header">
            <span className="cases-case-title">
              Case {this.formatFormula(this.negated)}:
            </span>
          </div>
          <div className="cases-known">
            <table className="cases-known-table">
              <tbody>
                <tr>
                  <td className="cases-known-index">{factIndex}.</td>
                  <td className="cases-known-formula">
                    {this.formatFormula(this.negated)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <ProofBlock formula={formula} env={this.elseEnv}
              defNames={defNames} showHtml={showHtml}
              onComplete={(c) => this.handleCaseComplete(1, c)} />
        </div>
      </div>
    );
  }
}
