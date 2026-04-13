import React from 'react';
import { Formula } from '../facts/formula';
import { AtomProp } from '../facts/prop';
import { Environment } from '../types/env';
import { ProofTactic, ProofGoal, ParseProofMethod, FindProofMethodMatches } from '../proof/proof_tactic';
import { Match, LongestCommonPrefix } from '../calc/calc_complete';
import { RuleSuggest } from '../components/RuleSuggest';
import InlineCalcBlock from './InlineCalcBlock';
import InlineCaseBlock from './InlineCaseBlock';


type ProofMethod =
  | { kind: 'none' }
  | { kind: 'calculate' }
  | { kind: 'tactic'; tactic: ProofTactic; goals: ProofGoal[]; methodText: string };

export interface InlineProofBlockProps {
  formula: Formula;
  env: Environment;
  premise?: Formula;
  defNames: string[];
  indent?: number;
  onComplete?: (complete: boolean) => void;
}

interface InlineProofBlockState {
  methodText: string;
  matches: Match[];
  method: ProofMethod;
  error: string | undefined;
  focus: boolean;
}

export default class InlineProofBlock
    extends React.Component<InlineProofBlockProps, InlineProofBlockState> {

  constructor(props: InlineProofBlockProps) {
    super(props);
    this.state = {
      methodText: '',
      matches: FindProofMethodMatches('', props.formula, props.env),
      method: { kind: 'none' },
      error: undefined,
      focus: false,
    };
  }

  private resetMethod() {
    const { method } = this.state;
    const text = method.kind === 'tactic'
      ? method.methodText
      : method.kind === 'calculate'
        ? 'calculation'
        : '';
    this.setState({
      methodText: text,
      matches: FindProofMethodMatches(text, this.props.formula, this.props.env),
      method: { kind: 'none' },
      error: undefined,
    });
  }

  private setText(text: string) {
    this.setState({
      methodText: text,
      matches: FindProofMethodMatches(text, this.props.formula, this.props.env),
      error: undefined,
    });
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
            method: { kind: 'tactic', tactic: result.tactic, goals, methodText: this.state.methodText },
            error: undefined,
          });
        } catch (e: any) {
          this.setState({ error: e.message });
        }
      }
    } else if (evt.key === 'Tab' && !evt.getModifierState('Shift')) {
      const { matches } = this.state;
      if (matches.length > 0) {
        const prefix = LongestCommonPrefix(matches.map(m => m.completion));
        if (prefix.length > 0) this.setText(prefix);
      }
      if (this.state.focus && this.state.methodText.length > 0) {
        evt.stopPropagation();
        evt.preventDefault();
      }
    }
  }

  render() {
    const { formula, env, defNames, onComplete } = this.props;
    const indent = this.props.indent ?? 0;
    const { method, matches, methodText, focus, error } = this.state;
    const goalStr = formula.to_string();

    const indentClass = indent > 0 ? ` ip-indent-${Math.min(indent, 4)}` : '';
    const bodyIndentClass = ` ip-indent-${Math.min(indent + 1, 4)}`;

    const lines: JSX.Element[] = [];

    // "prove <goal>" header.
    lines.push(
      <div key="goal" className={`ip-line${indentClass}`}>
        <span className="ip-keyword">prove</span> <span className="ip-formula">{goalStr}</span>
      </div>
    );

    if (method.kind === 'calculate') {
      // Calculation body.
      lines.push(
        <div key="calc">
          <InlineCalcBlock
            env={env}
            goal={goalStr}
            defNames={defNames}
            onComplete={onComplete}
          />
        </div>
      );

      // "by calculation" at the bottom.
      lines.push(
        <div key="method" className={`ip-line${bodyIndentClass} ip-step`}>
          <span className="ip-keyword">by</span> calculation
          <span className="ip-delete" onClick={() => this.resetMethod()}>&times;</span>
        </div>
      );
    } else if (method.kind === 'tactic') {
      // Case blocks.
      lines.push(
        <div key="cases">
          <InlineCaseBlock
            goals={method.goals}
            defNames={defNames}
            onComplete={onComplete}
          />
        </div>
      );

      // "by <method>" at the bottom.
      lines.push(
        <div key="method" className={`ip-line${bodyIndentClass} ip-step`}>
          <span className="ip-keyword">by</span> {method.methodText}
          <span className="ip-delete" onClick={() => this.resetMethod()}>&times;</span>
        </div>
      );
    } else {
      // Method not yet chosen — show input at the bottom.
      const inputClass = `ip-input${error ? ' ip-input-error' : ''}`;
      const suggest = (focus && matches.length > 0 && methodText.trim().length > 0)
        ? <RuleSuggest suggestions={matches} />
        : null;

      lines.push(
        <div key="method-input" className={`ip-line${bodyIndentClass}`}>
          <span className="ip-keyword">by</span>{' '}
          <span className="ip-suggest-wrap">
            <input
              autoFocus
              className={inputClass}
              type="text"
              value={methodText}
              placeholder="calculation / induction on ... / simple cases on ..."
              onChange={(evt) => this.setText(evt.target.value)}
              onKeyDown={(evt) => this.handleKeyDown(evt)}
              onFocus={() => this.setState({ focus: true })}
              onBlur={() => setTimeout(() => this.setState({ focus: false }), 200)}
            />
            {error && <span className="ip-error-msg">{error}</span>}
            {suggest}
          </span>
        </div>
      );
    }

    return <>{lines}</>;
  }
}
