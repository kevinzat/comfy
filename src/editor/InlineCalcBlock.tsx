import React from 'react';
import { Expression } from '../facts/exprs';
import { UserError } from '../facts/user_error';
import { Formula, FormulaOp } from '../facts/formula';
import { ParseFormula } from '../facts/formula_parser';
import { Environment } from '../types/env';
import { Match, FindForwardMatches, FindBackwardMatches, LongestCommonPrefix } from '../calc/calc_complete';
import { CalcProofNode, CalcStep } from '../proof/proof_file';
import { Step, applyForwardRule, applyBackwardRule, topFrontier, botFrontier, isComplete, checkValidity } from '../proof/calc_proof';
import { ParseForwardRule } from '../calc/calc_forward';
import { ParseBackwardRule } from '../calc/calc_backward';
import { RuleToHtml, TacticToHtml } from '../components/ProofElements';
import { RuleSuggest } from '../components/RuleSuggest';


interface Line {
  op: FormulaOp;
  expr: Expression;
  ruleText: string;
  forward: boolean;
}

export interface InlineCalcBlockProps {
  env: Environment;
  goal: string;
  defNames?: string[];
  initialCalc?: CalcProofNode;
  onComplete?: (complete: boolean) => void;
}

interface InlineCalcBlockState {
  goal: Formula;
  topLines: Line[];
  topText: string;
  topMatches: Match[];
  topError: string | undefined;
  topFocus: boolean;
  topDelayTimer: any;
  bottomLines: Line[];
  botText: string;
  botMatches: Match[];
  botError: string | undefined;
  botFocus: boolean;
  botDelayTimer: any;
}

export default class InlineCalcBlock
    extends React.Component<InlineCalcBlockProps, InlineCalcBlockState> {

  private topInputRef = React.createRef<HTMLInputElement>();
  private botInputRef = React.createRef<HTMLInputElement>();

  getCalcProofNode(): CalcProofNode {
    const { goal, topLines, bottomLines } = this.state;
    return {
      kind: 'calculate',
      forwardStart: { text: goal.left.to_string(), line: 0 },
      forwardSteps: topLines.map(l => ({ ruleText: l.ruleText, line: 0 })),
      backwardStart: bottomLines.length > 0
          ? { text: goal.right.to_string(), line: 0 }
          : null,
      backwardSteps: bottomLines.map(l => ({ ruleText: l.ruleText, line: 0 })),
    };
  }

  constructor(props: InlineCalcBlockProps) {
    super(props);
    const goal = ParseFormula(props.goal);
    const defNames = props.defNames ?? [];

    let topLines: Line[] = [];
    let bottomLines: Line[] = [];

    if (props.initialCalc) {
      topLines = this.replayForwardSteps(
          props.initialCalc.forwardSteps, goal.left, props.env);
      bottomLines = this.replayBackwardSteps(
          props.initialCalc.backwardSteps, goal.right, props.env);
    }

    this.state = {
      goal,
      topLines,
      topText: '',
      topMatches: FindForwardMatches('', defNames),
      topError: undefined,
      topFocus: false,
      topDelayTimer: undefined,
      bottomLines,
      botText: '',
      botMatches: FindBackwardMatches('', defNames),
      botError: undefined,
      botFocus: false,
      botDelayTimer: undefined,
    };
  }

  /** Replay parsed forward steps to rebuild Line objects. Stops on first error. */
  private replayForwardSteps(
      steps: CalcStep[], start: Expression, env: Environment): Line[] {
    const lines: Line[] = [];
    let frontier = start;
    for (const step of steps) {
      try {
        const result = applyForwardRule(step.ruleText, frontier, env);
        lines.push({ op: result.op, expr: result.expr, ruleText: step.ruleText, forward: true });
        frontier = result.expr;
      } catch (e: any) {
        console.warn(`[InlineCalcBlock] forward replay failed on "${step.ruleText}":`, e.message);
        break;
      }
    }
    return lines;
  }

  /** Replay parsed backward steps to rebuild Line objects. Stops on first error. */
  private replayBackwardSteps(
      steps: CalcStep[], start: Expression, env: Environment): Line[] {
    const lines: Line[] = [];
    let frontier = start;
    for (const step of steps) {
      try {
        const result = applyBackwardRule(step.ruleText, frontier, env);
        lines.push({ op: result.op, expr: result.expr, ruleText: step.ruleText, forward: false });
        frontier = result.expr;
      } catch (e: any) {
        console.warn(`[InlineCalcBlock] backward replay failed on "${step.ruleText}":`, e.message);
        break;
      }
    }
    return lines;
  }

  private lastReportedComplete: boolean | undefined = undefined;
  private lastReportedValidity: string | undefined | null = null;

  componentDidMount() { this.reportComplete(); }
  componentDidUpdate() { this.reportComplete(); }

  private reportComplete() {
    const complete = this.isComplete();
    const validityError = complete ? checkValidity(this.state.goal, this.state.topLines, this.state.bottomLines) : undefined;
    const valid = complete && validityError === undefined;
    if (complete !== this.lastReportedComplete || validityError !== this.lastReportedValidity) {
      this.lastReportedComplete = complete;
      this.lastReportedValidity = validityError;
      if (this.props.onComplete) this.props.onComplete(valid);
    }
  }

  private topFrontier(): Expression {
    return topFrontier(this.state.goal, this.state.topLines);
  }

  private botFrontier(): Expression {
    return botFrontier(this.state.goal, this.state.bottomLines);
  }

  private isComplete(): boolean {
    return isComplete(this.state.goal, this.state.topLines, this.state.bottomLines);
  }

  private setText(which: 'top' | 'bottom', text: string) {
    const defNames = this.props.defNames ?? [];
    if (which === 'top') {
      if (this.state.topDelayTimer !== undefined) clearTimeout(this.state.topDelayTimer);
      const matches = FindForwardMatches(text, defNames);
      const timer = setTimeout(() => this.handleParse('top'), 300);
      this.setState({ topText: text, topMatches: matches, topDelayTimer: timer });
    } else {
      if (this.state.botDelayTimer !== undefined) clearTimeout(this.state.botDelayTimer);
      const matches = FindBackwardMatches(text, defNames);
      const timer = setTimeout(() => this.handleParse('bottom'), 300);
      this.setState({ botText: text, botMatches: matches, botDelayTimer: timer });
    }
  }

  private handleParse(which: 'top' | 'bottom') {
    const text = which === 'top' ? this.state.topText : this.state.botText;
    if (text.trim().length === 0) {
      if (which === 'top') this.setState({ topError: undefined, topDelayTimer: undefined });
      else this.setState({ botError: undefined, botDelayTimer: undefined });
      return;
    }
    // Just clear the timer — actual parsing happens on Enter.
    if (which === 'top') this.setState({ topDelayTimer: undefined });
    else this.setState({ botDelayTimer: undefined });
  }

  private handleApplyRule(which: 'top' | 'bottom') {
    if (which === 'top' && this.state.topDelayTimer !== undefined) clearTimeout(this.state.topDelayTimer);
    if (which === 'bottom' && this.state.botDelayTimer !== undefined) clearTimeout(this.state.botDelayTimer);

    const text = which === 'top' ? this.state.topText : this.state.botText;
    if (text.trim().length === 0) return;

    try {
      if (which === 'top') {
        const step = applyForwardRule(text, this.topFrontier(), this.props.env);
        const topLines = [...this.state.topLines, { op: step.op, expr: step.expr, ruleText: text, forward: true }];
        this.setState({
          topLines, topText: '', topError: undefined, topDelayTimer: undefined,
          topMatches: FindForwardMatches('', this.props.defNames ?? []),
        });
      } else {
        const step = applyBackwardRule(text, this.botFrontier(), this.props.env);
        const bottomLines = [...this.state.bottomLines, { op: step.op, expr: step.expr, ruleText: text, forward: false }];
        this.setState({
          bottomLines, botText: '', botError: undefined, botDelayTimer: undefined,
          botMatches: FindBackwardMatches('', this.props.defNames ?? []),
        }, () => {
          if (!this.isComplete() && this.botInputRef.current) {
            this.botInputRef.current.focus();
          }
        });
      }
    } catch (e: any) {
      const msg = (e instanceof UserError) ? e.message : (e instanceof Error) ? e.message : 'unknown error';
      if (which === 'top') this.setState({ topError: msg, topDelayTimer: undefined });
      else this.setState({ botError: msg, botDelayTimer: undefined });
    }
  }

  private handleKeyDown(which: 'top' | 'bottom', evt: React.KeyboardEvent<HTMLInputElement>) {
    if (evt.key === 'Enter') {
      this.handleApplyRule(which);
    } else if (evt.key === 'Tab' && !evt.getModifierState('Shift')) {
      const matches = which === 'top' ? this.state.topMatches : this.state.botMatches;
      if (matches.length > 0) {
        const prefix = LongestCommonPrefix(matches.map(m => m.completion));
        if (prefix.length > 0) this.setText(which, prefix);
      }
      const text = which === 'top' ? this.state.topText : this.state.botText;
      const focus = which === 'top' ? this.state.topFocus : this.state.botFocus;
      if (focus && text.length > 0) {
        evt.stopPropagation();
        evt.preventDefault();
      }
    } else if (evt.key === 'Backspace') {
      const text = which === 'top' ? this.state.topText : this.state.botText;
      if (text.length === 0) {
        // Delete last step on backspace in empty input.
        this.handleDelete(which);
        evt.preventDefault();
      }
    }
  }

  private handleDelete(which: 'top' | 'bottom') {
    const defNames = this.props.defNames ?? [];
    if (which === 'top') {
      const topLines = this.state.topLines.slice();
      if (topLines.length === 0) return;
      const removed = topLines.pop()!;
      this.setState({
        topLines, topText: removed.ruleText,
        topMatches: FindForwardMatches(removed.ruleText, defNames), topError: undefined,
      });
    } else {
      const bottomLines = this.state.bottomLines.slice();
      if (bottomLines.length === 0) return;
      const removed = bottomLines.pop()!;
      this.setState({
        bottomLines, botText: removed.ruleText,
        botMatches: FindBackwardMatches(removed.ruleText, defNames), botError: undefined,
      });
    }
  }

  private renderInput(which: 'top' | 'bottom'): JSX.Element {
    const text = which === 'top' ? this.state.topText : this.state.botText;
    const error = which === 'top' ? this.state.topError : this.state.botError;
    const matches = which === 'top' ? this.state.topMatches : this.state.botMatches;
    const focus = which === 'top' ? this.state.topFocus : this.state.botFocus;

    const inputClass = `ip-input${error ? ' ip-input-error' : ''}`;
    const suggest = (focus && matches.length > 0 && text.trim().length > 0)
      ? <RuleSuggest suggestions={matches} />
      : null;

    return (
      <span className="ip-suggest-wrap">
        <input
          autoFocus={which === 'top'}
          ref={which === 'top' ? this.topInputRef : this.botInputRef}
          className={inputClass}
          type="text"
          value={text}
          placeholder="..."
          onChange={(evt) => this.setText(which, evt.target.value)}
          onKeyDown={(evt) => this.handleKeyDown(which, evt)}
          onFocus={() => {
            if (which === 'top') this.setState({ topFocus: true });
            else this.setState({ botFocus: true });
          }}
          onBlur={() => {
            setTimeout(() => {
              if (which === 'top') this.setState({ topFocus: false });
              else this.setState({ botFocus: false });
            }, 200);
          }}
        />
        {error && <span className="ip-error-msg">{error}</span>}
        {suggest}
      </span>
    );
  }

  private formatRule(line: Line): JSX.Element | null {
    try {
      const html = line.forward
        ? RuleToHtml(ParseForwardRule(line.ruleText))
        : TacticToHtml(ParseBackwardRule(line.ruleText));
      // RuleToHtml/TacticToHtml return empty spans for algebra — skip those.
      if (!html.props.children) return null;
      return html;
    } catch (_e) {
      return <span>{line.ruleText}</span>;
    }
  }

  private renderStep(key: string, line: Line, onDelete?: () => void): JSX.Element {
    const rule = this.formatRule(line);
    return (
      <div key={key} className="ip-line ip-indent-2 ip-step">
        <span className="ip-formula">{line.op} {line.expr.to_string()}</span>
        {rule && <span className="ip-rule">... {rule}</span>}
        {onDelete && <span className="ip-delete" onClick={onDelete}>&times;</span>}
      </div>
    );
  }

  render() {
    const { goal, topLines, bottomLines } = this.state;
    const complete = this.isComplete();
    const validityError = complete ? checkValidity(goal, topLines, bottomLines) : undefined;
    const lines: JSX.Element[] = [];

    // Start expression.
    lines.push(
      <div key="start" className="ip-line ip-indent-2">
        <span className="ip-formula">{goal.left.to_string()}</span>
      </div>
    );

    // Forward steps.
    // When complete with no backward steps, skip the last forward step
    // (its expression equals goal.right, which we show as the end line).
    const skipLastTop = complete && bottomLines.length === 0 && topLines.length > 0;
    const topCount = skipLastTop ? topLines.length - 1 : topLines.length;
    for (let i = 0; i < topCount; i++) {
      const isLast = i === topLines.length - 1;
      lines.push(this.renderStep(`top-${i}`, topLines[i],
        isLast ? () => this.handleDelete('top') : undefined));
    }

    if (!complete) {
      // Forward input.
      lines.push(
        <div key="top-input" className="ip-line ip-indent-2">
          <span className="ip-formula">= </span>
          {this.renderInput('top')}
        </div>
      );

      // Separator.
      lines.push(
        <div key="sep" className="ip-line ip-indent-2">
          <span className="ip-separator">---</span>
        </div>
      );

      // Backward input.
      lines.push(
        <div key="bot-input" className="ip-line ip-indent-2">
          <span className="ip-formula">= </span>
          {this.renderInput('bottom')}
        </div>
      );
    }

    // Backward steps (reversed).
    // When complete, skip the outermost backward step (its expression
    // equals the top frontier, which is already shown above).
    const skipLastBot = complete && bottomLines.length > 0;
    for (let i = bottomLines.length - 1; i >= 0; i--) {
      if (skipLastBot && i === bottomLines.length - 1) continue;
      const isLast = i === bottomLines.length - 1;
      lines.push(this.renderStep(`bot-${i}`, bottomLines[i],
        isLast ? () => this.handleDelete('bottom') : undefined));
    }

    // End expression line with the rule from the last step.
    const lastRule = skipLastTop && topLines.length > 0
      ? this.formatRule(topLines[topLines.length - 1])
      : skipLastBot && bottomLines.length > 0
        ? this.formatRule(bottomLines[0])
        : null;
    // When complete, allow deleting the step that was absorbed into this line.
    const endDelete = skipLastTop
      ? () => this.handleDelete('top')
      : skipLastBot
        ? () => this.handleDelete('bottom')
        : undefined;
    lines.push(
      <div key="end" className={`ip-line ip-indent-2${endDelete ? ' ip-step' : ''}`}>
        <span className="ip-formula">{goal.op} {goal.right.to_string()}</span>
        {lastRule && <span className="ip-rule">... {lastRule}</span>}
        {endDelete && <span className="ip-delete" onClick={endDelete}>&times;</span>}
      </div>
    );

    if (validityError) {
      lines.push(
        <div key="validity" className="ip-line ip-indent-2">
          <span className="ip-validity-error">{validityError}</span>
        </div>
      );
    }

    return <>{lines}</>;
  }
}
