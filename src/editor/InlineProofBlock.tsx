import React from 'react';
import { Formula } from '../facts/formula';
import { AtomProp, NotProp, Prop } from '../facts/prop';
import { Environment } from '../types/env';
import { ProofNode, CalcProofNode, CaseBlock, IHLine } from '../proof/proof_file';
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
  /** True when the goal is `not formula` (only supported with op '='). */
  isNegated?: boolean;
  env: Environment;
  premise?: Formula;
  defNames: string[];
  indent?: number;
  initialProof?: ProofNode;
  onComplete?: (complete: boolean) => void;
  onStateChange?: () => void;
}

interface InlineProofBlockState {
  methodText: string;
  matches: Match[];
  method: ProofMethod;
  error: string | undefined;
  focus: boolean;
  collapsed: boolean;
}

export default class InlineProofBlock
    extends React.Component<InlineProofBlockProps, InlineProofBlockState> {

  private calcRef = React.createRef<InlineCalcBlock>();
  private caseRef = React.createRef<InlineCaseBlock>();
  private initialCalc: CalcProofNode | undefined;
  private initialCaseProofs: ProofNode[] | undefined;

  constructor(props: InlineProofBlockProps) {
    super(props);

    const init = props.initialProof;
    if (init?.kind === 'calculate') {
      this.initialCalc = init;
      this.state = {
        methodText: 'calculation',
        matches: [],
        method: { kind: 'calculate' },
        error: undefined,
        focus: false,
        collapsed: false,
      };
    } else if (init?.kind === 'tactic') {
      const state = this.tryInitTactic(init.method, props);
      if (state) {
        this.initialCaseProofs = init.cases.map(c => c.proof);
        this.state = state;
      } else {
        this.state = this.defaultState(props);
      }
    } else {
      this.state = this.defaultState(props);
    }
  }

  private defaultState(props: InlineProofBlockProps): InlineProofBlockState {
    return {
      methodText: '',
      matches: FindProofMethodMatches('', props.formula, props.env),
      method: { kind: 'none' },
      error: undefined,
      focus: false,
      collapsed: false,
    };
  }

  private tryInitTactic(
      methodText: string, props: InlineProofBlockProps,
  ): InlineProofBlockState | null {
    const premises = props.premise ? [new AtomProp(props.premise)] : [];
    const goal: Prop = props.isNegated
        ? new NotProp(props.formula)
        : new AtomProp(props.formula);
    const result = ParseProofMethod(methodText, goal, props.env, premises);
    if (typeof result === 'string' || result.kind === 'calculate') return null;
    try {
      const goals = result.tactic.decompose();
      return {
        methodText,
        matches: [],
        method: { kind: 'tactic', tactic: result.tactic, goals, methodText },
        error: undefined,
        focus: false,
        collapsed: false,
      };
    } catch (_e) {
      return null;
    }
  }

  getProofNode(): ProofNode | null {
    const { method } = this.state;
    if (method.kind === 'calculate') {
      return this.calcRef.current?.getCalcProofNode() ?? null;
    }
    if (method.kind === 'tactic') {
      const caseBlock = this.caseRef.current;
      if (!caseBlock) return null;
      const subProofs: ProofNode[] = [];
      for (const ref of caseBlock.proofBlockRefs) {
        const node = ref.current?.getProofNode() ?? null;
        if (!node) return null;
        subProofs.push(node);
      }
      const cases: CaseBlock[] = method.goals.map((pg, i) => {
        const ihTheorems: IHLine[] = pg.newTheorems.map(thm => ({
          name: thm.name,
          params: thm.params,
          premises: thm.premises,
          conclusion: thm.conclusion,
          line: 0,
        }));
        return {
          label: pg.label,
          ihTheorems,
          givens: [],
          goal: pg.goal,
          goalLine: 0,
          proof: subProofs[i],
        };
      });
      return { kind: 'tactic', method: method.methodText.trim(), methodLine: 0, cases };
    }
    return { kind: 'none', methodLine: 0 };
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
    }, () => this.props.onStateChange?.());
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
      const goal: Prop = this.props.isNegated
          ? new NotProp(formula)
          : new AtomProp(formula);
      const result = ParseProofMethod(this.state.methodText, goal, env, premises);
      if (typeof result === 'string') {
        this.setState({ error: result });
      } else if (result.kind === 'calculate') {
        this.setState({ method: { kind: 'calculate' }, error: undefined },
            () => this.props.onStateChange?.());
      } else {
        try {
          const goals = result.tactic.decompose();
          this.setState({
            method: { kind: 'tactic', tactic: result.tactic, goals, methodText: this.state.methodText },
            error: undefined,
          }, () => this.props.onStateChange?.());
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
    const { formula, env, defNames, onComplete, onStateChange } = this.props;
    const isNegated = this.props.isNegated ?? false;
    const indent = this.props.indent ?? 0;
    const { method, matches, methodText, focus, error, collapsed } = this.state;
    const formulaStr = formula.to_string();
    const goalStr = (isNegated ? 'not ' : '') + formulaStr;

    const indentClass = indent > 0 ? ` ip-indent-${Math.min(indent, 4)}` : '';
    const bodyIndentClass = ` ip-indent-${Math.min(indent + 1, 4)}`;

    const lines: JSX.Element[] = [];

    // "prove <goal>" header, with "by <method>" on the same line when chosen.
    const methodSuffix = method.kind === 'calculate'
      ? <>{' '}<span className="ip-keyword">by</span> calculation</>
      : method.kind === 'tactic'
        ? <>{' '}<span className="ip-keyword">by</span> {method.methodText}</>
        : null;
    const hasMethod = method.kind !== 'none';
    const canCollapse = hasMethod;

    if (collapsed) {
      lines.push(
        <div key="goal" className={`ip-line${indentClass} ip-collapsed`}
             onClick={() => this.setState({ collapsed: false })}>
          <span className="ip-keyword">prove</span> <span className="ip-formula">{goalStr}</span>
          {methodSuffix}{' '}
          <span className="ip-collapse-hint">...</span>
        </div>
      );
    } else {
      lines.push(
        <div key="goal" className={`ip-line${indentClass}${canCollapse ? ' ip-collapsible' : ''}${hasMethod ? ' ip-step' : ''}`}
             onClick={canCollapse ? () => this.setState({ collapsed: true }) : undefined}>
          <span className="ip-keyword">prove</span> <span className="ip-formula">{goalStr}</span>
          {methodSuffix}
          {hasMethod && <span className="ip-delete" onClick={(e) => { e.stopPropagation(); this.resetMethod(); }}>&times;</span>}
        </div>
      );
    }

    if (method.kind === 'calculate') {
      // Calculation body — hidden when collapsed to preserve state.
      lines.push(
        <div key="calc" style={collapsed ? { display: 'none' } : undefined}>
          <InlineCalcBlock
            ref={this.calcRef}
            env={env}
            goal={formulaStr}
            isNegated={isNegated}
            defNames={defNames}
            indent={indent}
            initialCalc={this.initialCalc}
            onComplete={onComplete}
            onStateChange={onStateChange}
          />
        </div>
      );
    } else if (method.kind === 'tactic') {
      // Case blocks — hidden when collapsed to preserve state.
      lines.push(
        <div key="cases" style={collapsed ? { display: 'none' } : undefined}>
          <InlineCaseBlock
            ref={this.caseRef}
            goals={method.goals}
            defNames={defNames}
            indent={indent}
            initialProofs={this.initialCaseProofs}
            onComplete={onComplete}
            onStateChange={onStateChange}
          />
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
