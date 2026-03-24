import React from 'react';
import { Formula, OP_LESS_THAN, OP_LESS_EQUAL } from '../facts/formula';
import { ParseFormula } from '../facts/formula_parser';
import { Environment } from '../types/env';
import { Match, LongestCommonPrefix } from '../rules/infer_complete';
import { ExprToHtml, OpToHtml } from './ProofElements';
import { RuleSuggest } from './RuleSuggest';
import CalcBlock from './CalcBlock';
import InductionBlock from './InductionBlock';
import CasesBlock from './CasesBlock';
import './ProofBlock.css';


export interface ProofBlockProps {
  formula: Formula;
  env: Environment;
  defNames: string[];
  showHtml: boolean;
  onComplete?: (complete: boolean) => void;
}

type ProofMethod =
  | { kind: 'none' }
  | { kind: 'calculate' }
  | { kind: 'induction'; varName: string }
  | { kind: 'cases'; condition: Formula };

interface ProofBlockState {
  methodText: string;
  matches: Match[];
  method: ProofMethod;
  error: string | undefined;
  focus: boolean;
}

/**
 * Returns the names of variables in the environment that have an inductive
 * (non-built-in) type.
 */
function inductiveVarNames(env: Environment, formula: Formula): string[] {
  const names: string[] = [];
  const allVars = new Set([...formula.left.vars(), ...formula.right.vars()]);
  for (const name of allVars) {
    if (!env.hasVariable(name)) continue;
    const varType = env.getVariable(name);
    const typeDecl = env.getTypeDecl(varType.name);
    if (typeDecl !== null) {
      names.push(name);
    }
  }
  names.sort();
  return names;
}

/** Returns autocomplete matches for proof method input. */
function findMethodMatches(text: string, inductVars: string[]): Match[] {
  const trimmed = text.trim();
  const matches: Match[] = [];

  // Match "calculate"
  if ('calculate'.startsWith(trimmed)) {
    const desc = trimmed.length > 0
      ? [{ bold: true, text: trimmed },
         { bold: false, text: 'calculate'.substring(trimmed.length) }]
      : [{ bold: false, text: 'calculate' }];
    matches.push({ description: desc, completion: 'calculate' });
  }

  // Match "cases on ..."
  if ('cases on'.startsWith(trimmed) && trimmed.length > 0) {
    const desc = [
      { bold: true, text: trimmed },
      { bold: false, text: 'cases on'.substring(trimmed.length) + ' ...' },
    ];
    matches.push({ description: desc, completion: 'cases on ' });
  } else if (trimmed.startsWith('cases on ')) {
    const desc = [
      { bold: true, text: trimmed },
      { bold: false, text: '' },
    ];
    matches.push({ description: desc, completion: trimmed });
  }

  // Match "induction on <var>"
  const parts = trimmed.split(/\s+/);
  if (parts.length <= 3) {
    const p0 = parts[0] || '';
    if ('induction'.startsWith(p0)) {
      if (parts.length === 1) {
        // User typed a prefix of "induction" — show one entry per var
        for (const v of inductVars) {
          const desc = p0.length > 0
            ? [{ bold: true, text: p0 },
               { bold: false, text: 'induction'.substring(p0.length) + ' on ' + v }]
            : [{ bold: false, text: 'induction on ' + v }];
          matches.push({
            description: desc,
            completion: 'induction on ' + v,
          });
        }
      } else if (parts.length >= 2 && p0 === 'induction') {
        const p1 = parts[1];
        if ('on'.startsWith(p1) && parts.length === 2) {
          // User typed "induction o" or "induction on"
          for (const v of inductVars) {
            const desc = [
              { bold: true, text: 'induction' },
              { bold: false, text: ' ' },
              { bold: true, text: p1 },
              { bold: false, text: 'on'.substring(p1.length) + ' ' + v },
            ];
            matches.push({
              description: desc,
              completion: 'induction on ' + v,
            });
          }
        } else if (p1 === 'on' && parts.length === 3) {
          // User typed "induction on <partial>"
          const p2 = parts[2];
          const matching = inductVars.filter(v => v.startsWith(p2));
          for (const v of matching) {
            const desc = [
              { bold: true, text: 'induction' },
              { bold: false, text: ' ' },
              { bold: true, text: 'on' },
              { bold: false, text: ' ' },
              { bold: true, text: p2 },
            ];
            if (v.length > p2.length) {
              desc.push({ bold: false, text: v.substring(p2.length) });
            }
            matches.push({
              description: desc,
              completion: 'induction on ' + v,
            });
          }
        }
      }
    }
  }

  return matches;
}

function parseMethod(text: string, env: Environment): ProofMethod | string {
  const trimmed = text.trim();
  if (trimmed === '') return { kind: 'none' };
  if (trimmed === 'calculate') return { kind: 'calculate' };

  const m = trimmed.match(/^induction\s+on\s+(\S+)$/);
  if (m) {
    const varName = m[1];
    if (!env.hasVariable(varName)) {
      return `unknown variable "${varName}"`;
    }
    const varType = env.getVariable(varName);
    const typeDecl = env.getTypeDecl(varType.name);
    if (typeDecl === null) {
      return `cannot do induction on built-in type "${varType.name}"`;
    }
    return { kind: 'induction', varName };
  }

  const cm = trimmed.match(/^cases\s+on\s+(.+)$/);
  if (cm) {
    try {
      const condition = ParseFormula(cm[1]);
      if (condition.op !== OP_LESS_THAN && condition.op !== OP_LESS_EQUAL) {
        return 'cases condition must use < or <=';
      }
      return { kind: 'cases', condition };
    } catch (_e) {
      return 'syntax error in cases condition';
    }
  }

  return 'expected "calculate", "induction on <variable>", or "cases on <inequality>"';
}

export default class ProofBlock
    extends React.Component<ProofBlockProps, ProofBlockState> {

  private inductVars: string[];

  constructor(props: ProofBlockProps) {
    super(props);
    this.inductVars = inductiveVarNames(props.env, props.formula);
    this.state = {
      methodText: '',
      matches: findMethodMatches('', this.inductVars),
      method: { kind: 'none' },
      error: undefined,
      focus: false,
    };
  }

  private setText(text: string) {
    this.setState({
      methodText: text,
      matches: findMethodMatches(text, this.inductVars),
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
      const result = parseMethod(this.state.methodText, this.props.env);
      if (typeof result === 'string') {
        this.setState({ error: result });
      } else if (result.kind === 'none') {
        this.setState({ error: undefined });
      } else {
        this.setState({ method: result, error: undefined });
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
                  placeholder="calculate / induction on ... / cases on ..."
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
            {method.kind === 'calculate' ? '(by calculation)' :
             method.kind === 'induction' ?
              <>({'induction on '}<i>{method.varName}</i>{')'}</> :
             method.kind === 'cases' ?
              <>({'cases on '}{method.condition.to_string()}{')'}</> : null}
          </span>
        </div>
        {method.kind === 'calculate' &&
          <CalcBlock env={env} givens={[]} goal={goalStr}
              defNames={defNames} showHtml={showHtml} onComplete={onComplete} />
        }
        {method.kind === 'induction' &&
          <InductionBlock formula={formula} env={env} varName={method.varName}
              defNames={defNames} showHtml={showHtml} onComplete={onComplete} />
        }
        {method.kind === 'cases' &&
          <CasesBlock formula={formula} condition={method.condition} env={env}
              defNames={defNames} showHtml={showHtml} onComplete={onComplete} />
        }
      </div>
    );
  }
}
