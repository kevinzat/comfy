import React from 'react';
import { Formula } from '../facts/formula';
import { TheoremAst } from '../lang/theorem_ast';
import { Environment } from '../types/env';
import { CaseInfo, buildCases } from '../proof/induction';
import { InductionProofNode, CaseBlock, IHLine } from '../proof/proof_file';
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
  premise?: Formula;
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
  private proofBlockRefs: React.RefObject<ProofBlock>[];

  constructor(props: InductionBlockProps) {
    super(props);
    this.cases = buildCases(props.formula, props.env, props.varName, props.argNames, props.premise);
    this.proofBlockRefs = this.cases.map(() => React.createRef<ProofBlock>());
    this.state = {
      caseComplete: this.cases.map(() => false),
    };
  }

  getProofNode(): InductionProofNode | null {
    const caseBlocks: CaseBlock[] = [];
    for (let i = 0; i < this.cases.length; i++) {
      const c = this.cases[i];
      const subProof = this.proofBlockRefs[i].current?.getProofNode() ?? null;
      if (!subProof) return null;
      const label = c.argNames.length === 0
        ? c.ctor.name
        : `${c.ctor.name}(${c.argNames.join(', ')})`;
      const ihTheorems: IHLine[] = c.ihTheorems.map((thm: TheoremAst) => ({
        name: thm.name,
        params: thm.params,
        premise: thm.premise ? thm.premise.to_string() : undefined,
        formula: thm.conclusion.to_string(),
        line: 0,
      }));
      caseBlocks.push({ label, ihTheorems, givens: [], goal: c.goal.to_string(), goalLine: 0, proof: subProof });
    }
    return { kind: 'induction', varName: this.props.varName, argNames: this.props.argNames, cases: caseBlocks };
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

  formatIHName(thm: TheoremAst): string {
    if (thm.params.length === 0) return thm.name;
    // Group consecutive params of the same type into Lean-style groups.
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

  render() {
    const { varName, showHtml } = this.props;

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
              {c.ihTheorems.length > 0 && (
                <div className="induction-ih">
                  <div className="induction-ih-title">Induction hypotheses:</div>
                  <table className="induction-ih-table">
                    <tbody>
                      {c.ihTheorems.map((thm, i) => (
                        <tr key={i}>
                          <td className="induction-ih-index">
                            {this.formatIHName(thm)}:
                          </td>
                          <td className="induction-ih-formula">
                            {this.formatFormula(thm.conclusion)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <ProofBlock
                ref={this.proofBlockRefs[idx]}
                formula={c.goal}
                env={c.env}
                defNames={this.props.defNames ?? []}
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
