import React from 'react';
import { Expression } from '../facts/exprs';
import { UserError } from '../facts/user_error';
import { Formula, FormulaOp } from '../facts/formula';
import { ParseFormula } from '../facts/formula_parser';
import { RuleSuggest } from './RuleSuggest';
import { Match, FindForwardMatches, FindBackwardMatches, LongestCommonPrefix } from '../rules/infer_complete';
import { ParseForwardRule } from '../rules/infer_forward';
import { ParseBackwardRule } from '../rules/infer_backward';
import { RuleAst } from '../rules/rules_ast';
import { TacticAst } from '../rules/tactics_ast';
import { Environment } from '../types/env';
import { Step, applyForwardRule, applyBackwardRule, topFrontier, botFrontier, isComplete, checkValidity } from '../proof/calc_proof';
import { CalcProofNode } from '../proof/proof_file';
import { ExprToHtml, OpToHtml, RuleToHtml, TacticToHtml } from './ProofElements';
import './CalcBlock.css';


// A completed line: an operator and expression produced by some step.
class Line {
  op: FormulaOp;
  expr: Expression;
  ruleText: string;
  forward: boolean;
  utcts: number;

  constructor(op: FormulaOp, expr: Expression, ruleText: string, forward: boolean, utcts?: number) {
    this.op = op;
    this.expr = expr;
    this.ruleText = ruleText;
    this.forward = forward;
    this.utcts = utcts !== undefined ? utcts : Math.floor(Date.now() / 1000);
  }
}


export interface CalcBlockProps {
  env: Environment;
  givens: string[];
  goal: string;
  defNames?: string[];
  showHtml: boolean;
  onComplete?: (complete: boolean) => void;
}

interface CalcBlockState {
  givens: Formula[];
  goal: Formula;
  startExpr: Expression;
  endExpr: Expression;
  topLines: Array<Line>;
  topText: string;
  topMatches: Array<Match>;
  topError: string | undefined;
  topFocus: boolean;
  topDelayTimer: any;
  bottomLines: Array<Line>;
  botText: string;
  botMatches: Array<Match>;
  botError: string | undefined;
  botFocus: boolean;
  botDelayTimer: any;
  collapsed: boolean;
}

export default class CalcBlock
    extends React.Component<CalcBlockProps, CalcBlockState> {

  botInputRef = React.createRef<HTMLInputElement>();

  getCalcProofNode(): CalcProofNode {
    return {
      kind: 'calculate',
      forwardStart: null,
      forwardSteps: this.state.topLines.map(l => ({ ruleText: l.ruleText, line: 0 })),
      backwardStart: null,
      backwardSteps: this.state.bottomLines.map(l => ({ ruleText: l.ruleText, line: 0 })),
    };
  }

  constructor(props: CalcBlockProps) {
    super(props);

    const givens = props.givens.map(ParseFormula);
    const goal = ParseFormula(props.goal);

    const defNames = props.defNames ?? [];
    this.state = {
      givens,
      goal,
      startExpr: goal.left,
      endExpr: goal.right,
      topLines: [],
      topText: '',
      topMatches: FindForwardMatches('', defNames),
      topError: undefined,
      topFocus: false,
      topDelayTimer: undefined,
      bottomLines: [],
      botText: '',
      botMatches: FindBackwardMatches('', defNames),
      botError: undefined,
      botFocus: false,
      botDelayTimer: undefined,
      collapsed: false,
    };
  }

  private lastReportedComplete: boolean | undefined = undefined;
  private lastReportedValidity: string | undefined | null = null;

  componentDidMount() {
    this.reportComplete();
  }

  componentDidUpdate() {
    this.reportComplete();
  }

  private reportComplete() {
    const complete = this.isComplete();
    const validityError = complete ? this.checkValidity() : undefined;
    const valid = complete && validityError === undefined;
    if (complete !== this.lastReportedComplete || validityError !== this.lastReportedValidity) {
      this.lastReportedComplete = complete;
      this.lastReportedValidity = validityError;
      if (this.props.onComplete) this.props.onComplete(valid);
      if (valid && !this.state.collapsed) {
        this.setState({ collapsed: true });
      }
    }
  }

  private checkValidity(): string | undefined {
    const { goal, topLines, bottomLines } = this.state;
    return checkValidity(goal, topLines, bottomLines);
  }

  formatExpr(expr: Expression): JSX.Element | string {
    return this.props.showHtml ? ExprToHtml(expr) : expr.to_string();
  }

  formatRule(line: Line): JSX.Element | string {
    if (!this.props.showHtml) return line.ruleText;
    try {
      if (line.forward) {
        return RuleToHtml(ParseForwardRule(line.ruleText));
      } else {
        return TacticToHtml(ParseBackwardRule(line.ruleText));
      }
    } catch (_e) {
      return line.ruleText;
    }
  }

  topFrontier(): Expression {
    return topFrontier(this.state.goal, this.state.topLines);
  }

  botFrontier(): Expression {
    return botFrontier(this.state.goal, this.state.bottomLines);
  }

  isComplete(): boolean {
    return isComplete(this.state.goal, this.state.topLines, this.state.bottomLines);
  }

  // --- Text input handling ---

  setText(which: 'top' | 'bottom', text: string) {
    const defNames = this.props.defNames ?? [];
    if (which === 'top') {
      if (this.state.topDelayTimer !== undefined) {
        clearTimeout(this.state.topDelayTimer);
      }
      const matches = FindForwardMatches(text, defNames);
      const timer = setTimeout(() => this.handleParse('top'), 300);
      this.setState({ topText: text, topMatches: matches, topDelayTimer: timer });
    } else {
      if (this.state.botDelayTimer !== undefined) {
        clearTimeout(this.state.botDelayTimer);
      }
      const matches = FindBackwardMatches(text, defNames);
      const timer = setTimeout(() => this.handleParse('bottom'), 300);
      this.setState({ botText: text, botMatches: matches, botDelayTimer: timer });
    }
  }

  handleParse(which: 'top' | 'bottom'): RuleAst | TacticAst | undefined {
    const text = which === 'top' ? this.state.topText : this.state.botText;

    if (text.trim().length === 0) {
      if (which === 'top') {
        this.setState({ topError: undefined, topDelayTimer: undefined });
      } else {
        this.setState({ botError: undefined, botDelayTimer: undefined });
      }
      return undefined;
    }

    try {
      let parsed;
      if (which === 'top') {
        parsed = ParseForwardRule(text);
        this.setState({ topError: undefined, topDelayTimer: undefined });
      } else {
        parsed = ParseBackwardRule(text);
        this.setState({ botError: undefined, botDelayTimer: undefined });
      }
      return parsed;
    } catch (e) {
      const msg = (e instanceof UserError) ? e.message : 'syntax error';
      if (which === 'top') {
        this.setState({ topError: msg, topDelayTimer: undefined });
      } else {
        this.setState({ botError: msg, botDelayTimer: undefined });
      }
      return undefined;
    }
  }

  getCompletion(which: 'top' | 'bottom'): string | undefined {
    const matches = which === 'top' ? this.state.topMatches : this.state.botMatches;
    if (matches.length === 0) return undefined;

    const completions = matches.map(x => x.completion);
    const prefix = LongestCommonPrefix(completions);
    return prefix.length > 0 ? prefix : undefined;
  }

  handleApplyRule(which: 'top' | 'bottom') {
    if (which === 'top' && this.state.topDelayTimer !== undefined) {
      clearTimeout(this.state.topDelayTimer);
    }
    if (which === 'bottom' && this.state.botDelayTimer !== undefined) {
      clearTimeout(this.state.botDelayTimer);
    }

    const text = which === 'top' ? this.state.topText : this.state.botText;
    if (text.trim().length === 0) return;

    try {
      if (which === 'top') {
        const step = applyForwardRule(text, this.topFrontier(), this.props.env);
        const topLines = this.state.topLines.slice(0);
        topLines.push(new Line(step.op, step.expr, text, true));

        this.setState({
          topLines,
          topText: '',
          topMatches: FindForwardMatches('', this.props.defNames ?? []),
          topError: undefined,
          topDelayTimer: undefined,
        });
      } else {
        const step = applyBackwardRule(text, this.botFrontier(), this.props.env);
        const bottomLines = this.state.bottomLines.slice(0);
        bottomLines.push(new Line(step.op, step.expr, text, false));

        const complete = this.topFrontier().equals(step.expr);
        this.setState({
          bottomLines,
          botText: '',
          botMatches: FindBackwardMatches('', this.props.defNames ?? []),
          botError: undefined,
          botDelayTimer: undefined,
        }, () => {
          if (!complete && this.botInputRef.current) {
            this.botInputRef.current.focus();
          }
        });
      }
    } catch (e) {
      const msg = (e instanceof UserError) ? e.message :
                  (e instanceof Error) ? e.message : 'unknown error';
      if (which === 'top') {
        this.setState({ topError: msg, topDelayTimer: undefined });
      } else {
        this.setState({ botError: msg, botDelayTimer: undefined });
      }
    }
  }

  handleKeyDown(which: 'top' | 'bottom', evt: React.KeyboardEvent<HTMLInputElement>) {
    if (evt.key === 'Enter') {
      this.handleApplyRule(which);
    } else if (evt.key === 'Tab' && !evt.getModifierState('Shift')) {
      const comp = this.getCompletion(which);
      if (comp !== undefined) {
        this.setText(which, comp);
      }
      const text = which === 'top' ? this.state.topText : this.state.botText;
      const focus = which === 'top' ? this.state.topFocus : this.state.botFocus;
      if (focus && text.length > 0) {
        evt.stopPropagation();
        evt.preventDefault();
      }
    }
  }

  handleDelete(which: 'top' | 'bottom') {
    const defNames = this.props.defNames ?? [];
    if (which === 'top') {
      const topLines = this.state.topLines.slice(0);
      if (topLines.length === 0) return;
      const removed = topLines.pop()!;
      this.setState({
        topLines,
        topText: removed.ruleText,
        topMatches: FindForwardMatches(removed.ruleText, defNames),
        topError: undefined,
        collapsed: false,
      });
    } else {
      const bottomLines = this.state.bottomLines.slice(0);
      if (bottomLines.length === 0) return;
      const removed = bottomLines.pop()!;
      this.setState({
        bottomLines,
        botText: removed.ruleText,
        botMatches: FindBackwardMatches(removed.ruleText, defNames),
        botError: undefined,
        collapsed: false,
      });
    }
  }

  formatTextInput(which: 'top' | 'bottom'): JSX.Element {
    const text = which === 'top' ? this.state.topText : this.state.botText;
    const error = which === 'top' ? this.state.topError : this.state.botError;
    const matches = which === 'top' ? this.state.topMatches : this.state.botMatches;
    const focus = which === 'top' ? this.state.topFocus : this.state.botFocus;
    const canDelete =
      which === 'top'
        ? this.state.topLines.length > 0
        : this.state.bottomLines.length > 0;

    let deleteBtn: JSX.Element | string = '';
    if (canDelete) {
      deleteBtn = (
        <button
          className="btn-close"
          onClick={this.handleDelete.bind(this, which)}
        >
          &times;
        </button>
      );
    }

    const hasError = error !== undefined;
    let errMsg: JSX.Element | string = '';
    if (hasError) {
      errMsg = <span className="line-error">{error}</span>;
    }

    let suggest: JSX.Element | undefined = undefined;
    if (focus && matches.length > 0 && text.trim().length > 0) {
      suggest = <RuleSuggest suggestions={matches} />;
    }

    return (
      <div className="rule-input">
        <div style={{ backgroundColor: hasError ? '#FF7373' : 'white', display: 'inline-block' }}>
          <input
            type="text"
            ref={which === 'bottom' ? this.botInputRef : undefined}
            value={text}
            placeholder=""
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
          {errMsg}
        </div>
        <span className="options">{deleteBtn}</span>
        {suggest}
      </div>
    );
  }

  renderChain(): Array<JSX.Element> {
    const { topLines, bottomLines, endExpr } = this.state;
    const rows: Array<JSX.Element> = [];

    const complete = this.isComplete();
    const { collapsed } = this.state;

    const skipLastTop = collapsed && bottomLines.length === 0 && topLines.length > 0;

    // --- Top completed lines ---
    const topCount = skipLastTop ? topLines.length - 1 : topLines.length;
    for (let i = 0; i < topCount; i++) {
      rows.push(
        <tr key={'top-' + i}>
          <td className="expr-elem">
            <span>{OpToHtml(topLines[i].op)}</span>{' '}{this.formatExpr(topLines[i].expr)}
          </td>
          <td className="rule">{this.formatRule(topLines[i])}</td>
        </tr>,
      );
    }

    if (!collapsed) {
      // --- top frontier: text input ---
      rows.push(
        <tr key="topFrontier">
          <td className="expr-elem chain-gap">
            <span>=</span> ...
          </td>
          <td className="rule">
            {this.formatTextInput('top')}
          </td>
        </tr>,
      );

      // --- bottom frontier ---
      rows.push(
        <tr key="botFrontier">
          <td className="expr-elem chain-gap">
            <span>=</span> ...
          </td>
          <td className="rule"></td>
        </tr>,
      );
    }

    // --- Bottom completed lines (displayed in reverse) ---
    // Each row's op describes the relationship between the row above and this row.
    // A tactic proving "premise op goal" means op belongs on the goal's row (below),
    // not the premise's row. So row i shows bottomLines[i+1].op, and the outermost
    // row (which connects to the frontier above) shows '='.
    const skipLastBot = collapsed && bottomLines.length > 0;
    for (let i = bottomLines.length - 1; i >= 0; i--) {
      const isOutermost = (i === bottomLines.length - 1);
      if (skipLastBot && isOutermost) continue;

      const ruleCell = isOutermost
        ? this.formatTextInput('bottom')
        : this.formatRule(bottomLines[i + 1]);

      const op = isOutermost ? '=' : bottomLines[i + 1].op;

      rows.push(
        <tr key={'bot-' + i}>
          <td className="expr-elem">
            <span>{OpToHtml(op)}</span>{' '}{this.formatExpr(bottomLines[i].expr)}
          </td>
          <td className="rule">{ruleCell}</td>
        </tr>,
      );
    }

    // --- endExpr row ---
    let endRuleCell: JSX.Element | string;
    // Determine the operator for the last line
    let endOp: string;
    if (skipLastTop) {
      endOp = topLines[topLines.length - 1].op;
      endRuleCell = this.formatRule(topLines[topLines.length - 1]);
    } else if (bottomLines.length > 0) {
      endOp = bottomLines[0].op;
      endRuleCell = this.formatRule(bottomLines[0]);
    } else if (collapsed) {
      endOp = '=';
      endRuleCell = '';
    } else if (!collapsed) {
      endOp = '=';
      endRuleCell = this.formatTextInput('bottom');
    } else {
      endOp = '=';
      endRuleCell = '';
    }
    rows.push(
      <tr key="end">
        <td className="expr-elem">
          <span>{OpToHtml(endOp)}</span>{' '}{this.formatExpr(endExpr)}
        </td>
        <td className="rule">{endRuleCell}</td>
      </tr>,
    );

    return rows;
  }

  render() {
    const { startExpr } = this.state;
    const complete = this.isComplete();
    const validityError = complete ? this.checkValidity() : undefined;
    const valid = complete && !validityError;
    const { collapsed } = this.state;

    return (
      <div>
        <div className="proof-chain">
          <table>
            <tbody>
              <tr key="start">
                <td className="expr-elem">
                  {this.formatExpr(startExpr)}
                </td>
                <td></td>
              </tr>
              {this.renderChain()}
            </tbody>
          </table>
        </div>
        <div className="proof-buttons">
          {collapsed ?
            <span className="btn-edit-chain"
                onClick={() => this.setState({ collapsed: false })}>
              Edit
            </span> : ''}
          {!collapsed && valid ?
            <span className="btn-edit-chain"
                onClick={() => this.setState({ collapsed: true })}>
              Done
            </span> : ''}
          {complete && validityError ?
            <span className="validity-error">{validityError}</span> : ''}
        </div>
      </div>
    );
  }
}
