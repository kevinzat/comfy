import React from 'react';
import Editor from 'react-simple-code-editor';
import { DeclsAst } from '../lang/decls_ast';
import { TheoremAst } from '../lang/theorem_ast';
import { ParseDecls, DeclsParseResult } from '../lang/decls_parser';
import { ParseCode, CodeParseResult } from '../lang/code_parser';
import { TopLevelEnv, NestedEnv } from '../types/env';
import { checkFuncDef } from '../types/code_checker';
import { UserError } from '../facts/user_error';
import { highlightDecls, highlightTheorem, highlightCode } from './highlight';
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
  codeText: string;
  codeResult: CodeParseResult;
  checked: boolean;
  checkError: string | undefined;
}


export default class ProofSetup
    extends React.Component<ProofSetupProps, ProofSetupState> {

  constructor(props: ProofSetupProps) {
    super(props);
    this.state = {
      declsText: '',
      declsResult: {},
      theoremText: '',
      theoremResult: {},
      codeText: '',
      codeResult: {},
      checked: false,
      checkError: undefined,
    };
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
    if (this.state.codeText.length > 0 && !this.state.codeResult.ast)
      return false;
    return this.getTheorem() !== undefined;
  }

  handleDeclsChange(text: string) {
    const result = text.length > 0 ? ParseDecls(text) : {};
    this.setState({ declsText: text, declsResult: result, checked: false, checkError: undefined });
  }

  handleTheoremChange(text: string) {
    const result = text.length > 0 ? ParseDecls(text) : {};
    this.setState({ theoremText: text, theoremResult: result, checked: false, checkError: undefined });
  }

  handleCodeChange(text: string) {
    const result = text.length > 0 ? ParseCode(text) : {};
    this.setState({ codeText: text, codeResult: result, checked: false, checkError: undefined });
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

      if (this.state.codeResult.ast) {
        checkFuncDef(env, this.state.codeResult.ast);
      }

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
          <div className={`setup-editor-wrap${declsHasError ? ' func-error' : ''}`}>
            <Editor
                value={this.state.declsText}
                onValueChange={this.handleDeclsChange.bind(this)}
                highlight={highlightDecls}
                padding={5}
                placeholder={"e.g., type List\n  | nil : List\n  | cons : (Int, List) -> List\ndef len : (List) -> Int\n  | len(nil) => 0\n  | len(cons(a, L)) => 1 + len(L)"}
                style={{ fontFamily: 'monospace', fontSize: 13, height: '100%' }} />
          </div>
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
          <div className={`setup-editor-wrap setup-theorem${theoremHasError ? ' func-error' : ''}`}>
            <Editor
                value={this.state.theoremText}
                onValueChange={this.handleTheoremChange.bind(this)}
                highlight={highlightTheorem}
                padding={5}
                autoFocus
                placeholder={"e.g., theorem comm (x, y : Int)\n  | x + y = y + x"}
                style={{ fontFamily: 'monospace', fontSize: 13, height: '100%' }} />
          </div>
          {theoremHasError && this.state.theoremResult.error &&
            formatParseError(this.state.theoremText, this.state.theoremResult.error)}
        </td>
      </tr>
    );

    const codeHasError = this.state.codeText.length > 0 && !this.state.codeResult.ast;
    rows.push(
      <tr key="code">
        <td className="setup-label">Code</td>
        <td>
          <div className={`setup-editor-wrap${codeHasError ? ' func-error' : ''}`}>
            <Editor
                value={this.state.codeText}
                onValueChange={this.handleCodeChange.bind(this)}
                highlight={highlightCode}
                padding={5}
                placeholder={"e.g., Int double(Int x) {\n  return 2 * x;\n}"}
                style={{ fontFamily: 'monospace', fontSize: 13, height: '100%' }} />
          </div>
          {codeHasError && this.state.codeResult.error &&
            formatParseError(this.state.codeText, this.state.codeResult.error)}
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
