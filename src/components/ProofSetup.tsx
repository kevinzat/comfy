import React, { ChangeEvent } from 'react';
import { Formula } from '../facts/formula';
import { ParseFormula } from '../facts/formula_parser';
import { DeclsAst } from '../lang/decls_ast';
import { ParseDecls, DeclsParseResult } from '../lang/decls_parser';
import { TopLevelEnv } from '../types/env';
import { UserError } from '../facts/user_error';
import './ProofSetup.css';

function formatParseError(text: string, error: string): JSX.Element {
  const m = error.match(/line (\d+) col (\d+)/i);
  if (m) {
    const line = parseInt(m[1]);
    const col = parseInt(m[2]);
    const lines = text.split('\n');
    const srcLine = lines[line - 1] ?? '';
    const before = srcLine.slice(0, col - 1);
    const after = srcLine.slice(col - 1);
    const display = after.length > 12 ? after.slice(0, 12) + '...' : after;
    return <div className="func-error-msg">
      Syntax error: {before}<u>{display}</u>
    </div>;
  }
  return <div className="func-error-msg">Syntax error</div>;
}


interface ProofSetupProps {
  onStart: (decls: DeclsAst, givens: string[], goal: string) => void;
}

interface ProofSetupState {
  declsText: string;
  declsResult: DeclsParseResult;
  givenTexts: string[];
  givenFormulas: Array<Formula | undefined>;
  goalText: string;
  goalFormula: Formula | undefined;
  checked: boolean;
  checkError: string | undefined;
}


export default class ProofSetup
    extends React.Component<ProofSetupProps, ProofSetupState> {

  goalRef = React.createRef<HTMLInputElement>();
  newGivenRef = React.createRef<HTMLInputElement>();

  constructor(props: ProofSetupProps) {
    super(props);
    this.state = {
      declsText: '',
      declsResult: {},
      givenTexts: [],
      givenFormulas: [],
      goalText: '',
      goalFormula: undefined,
      checked: false,
      checkError: undefined,
    };
  }

  componentDidMount() {
    this.goalRef.current?.focus();
  }

  componentDidUpdate(_prevProps: ProofSetupProps, prevState: ProofSetupState) {
    if (this.state.givenTexts.length > prevState.givenTexts.length) {
      this.newGivenRef.current?.focus();
    }
  }

  isValid(): boolean {
    if (this.state.declsText.length > 0 && !this.state.declsResult.ast)
      return false;
    for (const f of this.state.givenFormulas) {
      if (f === undefined) return false;
    }
    return this.state.goalFormula !== undefined;
  }

  handleDeclsChange(evt: ChangeEvent<HTMLTextAreaElement>) {
    const text = evt.target.value;
    const result = text.length > 0 ? ParseDecls(text) : {};
    this.setState({ declsText: text, declsResult: result, checked: false, checkError: undefined });
  }

  handleGivenAdd() {
    this.setState({
      givenTexts: [...this.state.givenTexts, ''],
      givenFormulas: [...this.state.givenFormulas, undefined],
      checked: false, checkError: undefined,
    });
  }

  handleGivenChange(index: number, evt: ChangeEvent<HTMLInputElement>) {
    const texts = this.state.givenTexts.slice();
    const formulas = this.state.givenFormulas.slice();
    texts[index] = evt.target.value;
    let formula: Formula | undefined = undefined;
    try { formula = ParseFormula(evt.target.value); } catch (_e) { /* error */ }
    formulas[index] = formula;
    this.setState({ givenTexts: texts, givenFormulas: formulas, checked: false, checkError: undefined });
  }

  handleGivenRemove(index: number) {
    const texts = this.state.givenTexts.slice();
    const formulas = this.state.givenFormulas.slice();
    texts.splice(index, 1);
    formulas.splice(index, 1);
    this.setState({ givenTexts: texts, givenFormulas: formulas, checked: false, checkError: undefined });
  }

  handleGoalChange(evt: ChangeEvent<HTMLInputElement>) {
    let formula: Formula | undefined = undefined;
    try { formula = ParseFormula(evt.target.value); } catch (_e) { /* error */ }
    this.setState({ goalText: evt.target.value, goalFormula: formula, checked: false, checkError: undefined });
  }

  handleCheck() {
    try {
      const decls = this.state.declsResult.ast ?? new DeclsAst([], [], []);
      const givens = this.state.givenFormulas
          .filter((f): f is Formula => f !== undefined);
      givens.push(this.state.goalFormula!);

      const env = new TopLevelEnv(decls.types, decls.functions, decls.variables, givens);
      env.check();

      this.setState({ checked: true, checkError: undefined });
    } catch (e: any) {
      const msg = (e instanceof UserError) ? e.message : String(e);
      this.setState({ checked: false, checkError: msg });
    }
  }

  render() {
    const rows: JSX.Element[] = [];

    const declsHasError = this.state.declsText.length > 0 && !this.state.declsResult.ast;
    rows.push(
      <tr key="decls">
        <td className="setup-label">Declarations</td>
        <td>
            <textarea className={`setup-decls-input${declsHasError ? ' func-error' : ''}`}
                value={this.state.declsText}
                placeholder={"e.g., type List\n  | nil : List\n  | cons : (Int, List) -> List\ndef len : (List) -> Int\n  | len(nil) => 0\n  | len(cons(a, L)) => 1 + len(L)\nvar x : Int"}
                onChange={this.handleDeclsChange.bind(this)} />
          {declsHasError && this.state.declsResult.error &&
            formatParseError(this.state.declsText, this.state.declsResult.error)}
        </td>
      </tr>
    );

    for (let i = 0; i < this.state.givenTexts.length; i++) {
      const hasError = this.state.givenTexts[i].length > 0 &&
          this.state.givenFormulas[i] === undefined;
      rows.push(
        <tr key={`given-${i}`}>
          <td className="setup-label">{i === 0 ? 'Givens' : ''}</td>
          <td>
            <span className={hasError ? 'FormulaError' : 'FormulaValid'}>
              <input type="text" className="setup-input"
                  ref={i === this.state.givenTexts.length - 1 ? this.newGivenRef : undefined}
                  value={this.state.givenTexts[i]}
                  placeholder="e.g., x + y = 5"
                  onChange={this.handleGivenChange.bind(this, i)} />
            </span>
            <button type="button" className="btn-remove"
                onClick={this.handleGivenRemove.bind(this, i)}>
              &times;
            </button>
          </td>
        </tr>
      );
    }

    rows.push(
      <tr key="given-add">
        <td className="setup-label">
          {this.state.givenTexts.length === 0 ? 'Givens' : ''}
        </td>
        <td>
          <button type="button" className="btn-add"
              onClick={this.handleGivenAdd.bind(this)}>
            +
          </button>
        </td>
      </tr>
    );

    const goalError = this.state.goalText.length > 0 &&
        this.state.goalFormula === undefined;
    rows.push(
      <tr key="goal">
        <td className="setup-label">Prove</td>
        <td>
          <span className={goalError ? 'FormulaError' : 'FormulaValid'}>
            <input type="text" className="setup-input"
                ref={this.goalRef}
                value={this.state.goalText}
                placeholder="e.g., x^2 + 2*x*y + y^2 = (x + y)^2"
                onChange={this.handleGoalChange.bind(this)} />
          </span>
        </td>
      </tr>
    );

    return (
      <div style={{ padding: 20 }}>
        <table cellPadding={5}>
          <tbody>{rows}</tbody>
        </table>
        <div style={{ marginTop: 10 }}>
          {!this.state.checked ? (
            <>
              <button className="btn-start" disabled={!this.isValid()}
                  onClick={this.handleCheck.bind(this)}>
                Check
              </button>
              {this.state.checkError &&
                <div className="check-error-msg">{this.state.checkError}</div>}
            </>
          ) : (
            <button className="btn-start"
                onClick={() => this.props.onStart(
                  this.state.declsResult.ast ?? new DeclsAst([], [], []),
                  this.state.givenTexts, this.state.goalText)}>
              Start
            </button>
          )}
        </div>
      </div>
    );
  }
}
