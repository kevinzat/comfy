import React from 'react';
import { Formula } from '../facts/formula';
import { AtomProp } from '../facts/prop';
import { Environment } from '../types/env';
import { ProofNode, CaseBlock, IHLine } from '../proof/proof_file';
import { ProofTactic, ProofGoal, ParsedMethod,
         ParseProofMethod, FindProofMethodMatches } from '../proof/proof_tactic';
import { Match, LongestCommonPrefix } from '../calc/calc_complete';
import { ExprToHtml, OpToHtml } from './ProofElements';
import { RuleSuggest } from './RuleSuggest';
import CalcBlock from './CalcBlock';
import ProofGoalBlock from './ProofGoalBlock';
import './ProofBlock.css';


export interface ProofBlockProps {
  formula: Formula;
  env: Environment;
  premise?: Formula;
  defNames: string[];
  showHtml: boolean;
  onComplete?: (complete: boolean) => void;
}

type ProofMethod =
  | { kind: 'none' }
  | { kind: 'calculate' }
  | { kind: 'tactic'; tactic: ProofTactic; goals: ProofGoal[]; methodText: string };

interface ProofBlockState {
  methodText: string;
  matches: Match[];
  method: ProofMethod;
  error: string | undefined;
  focus: boolean;
}

export default class ProofBlock
    extends React.Component<ProofBlockProps, ProofBlockState> {

  private calcRef = React.createRef<CalcBlock>();
  private goalBlockRef = React.createRef<ProofGoalBlock>();

  getProofNode(): ProofNode | null {
    const { method } = this.state;
    if (method.kind === 'calculate') {
      return this.calcRef.current?.getCalcProofNode() ?? null;
    }
    if (method.kind === 'tactic') {
      const goalBlock = this.goalBlockRef.current;
      if (!goalBlock) return null;
      const subProofs: ProofNode[] = [];
      for (const ref of goalBlock.proofBlockRefs) {
        const node = ref.current?.getProofNode() ?? null;
        if (!node) return null;
        subProofs.push(node);
      }
      return this.buildProofNode(method, subProofs);
    }
    return null;
  }

  private buildProofNode(method: Extract<ProofMethod, { kind: 'tactic' }>,
      subProofs: ProofNode[]): ProofNode {
    const cases: CaseBlock[] = method.goals.map((pg, i) => {
      const ihTheorems: IHLine[] = pg.newTheorems.map(thm => ({
        name: thm.name,
        params: thm.params,
        premises: thm.premises,
        formula: thm.conclusion.to_string(),
        line: 0,
      }));
      return {
        label: pg.label,
        ihTheorems,
        givens: [],
        goal: pg.goal.to_string(),
        goalLine: 0,
        proof: subProofs[i],
      };
    });
    return {
      kind: 'tactic',
      method: method.methodText.trim(),
      methodLine: 0,
      cases,
    };
  }

  constructor(props: ProofBlockProps) {
    super(props);
    this.state = {
      methodText: '',
      matches: FindProofMethodMatches('', props.formula, props.env),
      method: { kind: 'none' },
      error: undefined,
      focus: false,
    };
  }

  private setText(text: string) {
    this.setState({
      methodText: text,
      matches: FindProofMethodMatches(text, this.props.formula, this.props.env),
      error: undefined,
    });
  }

  private getCompletion(): string | undefined {
    const { matches } = this.state;
    if (matches.length === 0) return undefined;
    const completions = matches.map(m => m.completion);
    const prefix = LongestCommonPrefix(completions);
    return prefix.length > 0 ? prefix : undefined;
  }

  private handleKeyDown(evt: React.KeyboardEvent<HTMLInputElement>) {
    if (evt.key === 'Enter') {
      const { formula, env, premise } = this.props;
      const premises = premise ? [new AtomProp(premise)] : [];
      const result = ParseProofMethod(this.state.methodText, formula, env, premises);
      if (typeof result === 'string') {
        this.setState({ error: result });
      } else if (result.kind === 'calculate') {
        this.setState({ method: { kind: 'calculate' }, error: undefined });
      } else {
        try {
          const goals = result.tactic.decompose();
          this.setState({
            method: { kind: 'tactic', tactic: result.tactic, goals,
                      methodText: this.state.methodText },
            error: undefined,
          });
        } catch (e: any) {
          this.setState({ error: e.message });
        }
      }
    } else if (evt.key === 'Tab' && !evt.getModifierState('Shift')) {
      const comp = this.getCompletion();
      if (comp !== undefined) {
        this.setText(comp);
      }
      if (this.state.focus && this.state.methodText.length > 0) {
        evt.stopPropagation();
        evt.preventDefault();
      }
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
    const { formula, env, defNames, showHtml, onComplete } = this.props;
    const { method, matches, methodText, focus } = this.state;

    if (method.kind === 'none') {
      const hasError = this.state.error !== undefined;
      let suggest: JSX.Element | undefined = undefined;
      if (focus && matches.length > 0 && methodText.trim().length > 0) {
        suggest = <RuleSuggest suggestions={matches} />;
      }

      return (
        <div className="proof-block">
          <div className="proof-block-goal">
            <span className="proof-block-goal-title">Prove: </span>
            {this.formatFormula(formula)}
            <div className="rule-input proof-block-method">
              <div style={{ backgroundColor: hasError ? '#FF7373' : 'white', display: 'inline-block' }}>
                <input
                  type="text"
                  value={methodText}
                  placeholder="calculation / induction on ... / simple cases on ..."
                  onChange={(evt) => this.setText(evt.target.value)}
                  onKeyDown={(evt) => this.handleKeyDown(evt)}
                  onFocus={() => this.setState({ focus: true })}
                  onBlur={() => {
                    setTimeout(() => this.setState({ focus: false }), 200);
                  }}
                />
                {this.state.error &&
                  <span className="line-error">{this.state.error}</span>}
              </div>
              {suggest}
            </div>
          </div>
        </div>
      );
    }

    const goalStr = formula.to_string();

    return (
      <div className="proof-block">
        <div className="proof-block-goal">
          <span className="proof-block-goal-title">Prove: </span>
          {this.formatFormula(formula)}
          <span className="proof-block-method-label">
            ({method.kind === 'calculate' ? 'by calculation' : methodText})
          </span>
        </div>
        {method.kind === 'calculate' &&
          <CalcBlock ref={this.calcRef} env={env} givens={[]} goal={goalStr}
              defNames={defNames} showHtml={showHtml} onComplete={onComplete} />
        }
        {method.kind === 'tactic' &&
          <ProofGoalBlock ref={this.goalBlockRef}
              methodLabel={methodText}
              goals={method.goals}
              defNames={defNames} showHtml={showHtml} onComplete={onComplete} />
        }
      </div>
    );
  }
}
