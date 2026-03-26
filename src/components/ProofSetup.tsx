import React, { ChangeEvent } from 'react';
import { DeclsAst } from '../lang/decls_ast';
import { TheoremAst } from '../lang/theorem_ast';
import { ParseDecls, DeclsParseResult } from '../lang/decls_parser';
import { TopLevelEnv, NestedEnv } from '../types/env';
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
  onStart: (decls: DeclsAst, theorem: TheoremAst) => void;
}

interface ProofSetupState {
  declsText: string;
  declsResult: DeclsParseResult;
  theoremText: string;
  theoremResult: DeclsParseResult;
  checked: boolean;
  checkError: string | undefined;
}


export default class ProofSetup
    extends React.Component<ProofSetupProps, ProofSetupState> {

  theoremRef = React.createRef<HTMLTextAreaElement>();

  constructor(props: ProofSetupProps) {
    super(props);
    this.state = {
      declsText: '',
      declsResult: {},
      theoremText: '',
      theoremResult: {},
      checked: false,
      checkError: undefined,
    };
  }

  componentDidMount() {
    this.theoremRef.current?.focus();
  }

  getTheorem(): TheoremAst | undefined {
    const ast = this.state.theoremResult.ast;
    if (!ast) return undefined;
    if (ast.theorems.length !== 1) return undefined;
    return ast.theorems[0];
  }

  isValid(): boolean {
    if (this.state.declsText.length > 0 && !this.state.declsResult.ast)
      return false;
    return this.getTheorem() !== undefined;
  }

  handleDeclsChange(evt: ChangeEvent<HTMLTextAreaElement>) {
    const text = evt.target.value;
    const result = text.length > 0 ? ParseDecls(text) : {};
    this.setState({ declsText: text, declsResult: result, checked: false, checkError: undefined });
  }

  handleTheoremChange(evt: ChangeEvent<HTMLTextAreaElement>) {
    const text = evt.target.value;
    const result = text.length > 0 ? ParseDecls(text) : {};
    this.setState({ theoremText: text, theoremResult: result, checked: false, checkError: undefined });
  }

  handleCheck() {
    try {
      const decls = this.state.declsResult.ast ?? new DeclsAst([], [], []);
      const theorem = this.getTheorem()!;

      const env = new TopLevelEnv(decls.types, decls.functions,
          [], decls.theorems);
      const facts = theorem.premise ? [theorem.premise, theorem.conclusion]
          : [theorem.conclusion];
      const thmEnv = new NestedEnv(env, theorem.params, facts);
      thmEnv.check();

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
                placeholder={"e.g., type List\n  | nil : List\n  | cons : (Int, List) -> List\ndef len : (List) -> Int\n  | len(nil) => 0\n  | len(cons(a, L)) => 1 + len(L)"}
                onChange={this.handleDeclsChange.bind(this)} />
          {declsHasError && this.state.declsResult.error &&
            formatParseError(this.state.declsText, this.state.declsResult.error)}
        </td>
      </tr>
    );

    const theoremHasError = this.state.theoremText.length > 0 &&
        this.getTheorem() === undefined;
    rows.push(
      <tr key="theorem">
        <td className="setup-label">Prove</td>
        <td>
            <textarea className={`setup-decls-input setup-theorem${theoremHasError ? ' func-error' : ''}`}
                ref={this.theoremRef}
                value={this.state.theoremText}
                placeholder={"e.g., theorem comm (x, y : Int)\n  | x + y = y + x"}
                onChange={this.handleTheoremChange.bind(this)} />
          {theoremHasError && this.state.theoremResult.error &&
            formatParseError(this.state.theoremText, this.state.theoremResult.error)}
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
                  this.getTheorem()!)}>
              Start
            </button>
          )}
        </div>
      </div>
    );
  }
}
