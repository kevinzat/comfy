import React from 'react';
import Editor from 'react-simple-code-editor';
import { DeclsAst } from '../lang/decls_ast';
import { ParseDecls, DeclsParseResult } from '../lang/decls_parser';
import { ParseCode, CodeParseResult } from '../lang/code_parser';
import { TopLevelEnv, NestedEnv } from '../types/env';
import { checkFuncDef } from '../types/code_checker';
import { UserError } from '../facts/user_error';
import {
  ProofObligation,
  getProofObligations, theoremToProofObligation, oblKey,
} from '../program/obligations';
import {
  highlightDecls, highlightTheorem, highlightCode,
  highlightTheoremWithBadges, highlightCodeWithBadges,
} from './highlight';
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

function circledNum(n: number): string {
  if (n >= 1 && n <= 20) return String.fromCodePoint(0x245F + n);
  return `(${n})`;
}

function condToStr(obl: ProofObligation): { premises: string; goal: string } {
  const provable = obl.premises.filter(c => c.op !== '!=');
  const premStr = provable.length === 0
    ? 'none'
    : provable.map(c => `${c.left.to_string()} ${c.op} ${c.right.to_string()}`).join(', ');
  const goalStr = `${obl.goal.left.to_string()} ${obl.goal.op} ${obl.goal.right.to_string()}`;
  return { premises: premStr, goal: goalStr };
}


interface ProofSetupProps {
  onStart: (decls: DeclsAst, obligation: ProofObligation) => void;
  provedObls: Set<string>;
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
  // Theorem obligations come first (from Prove), then code obligations (from Code).
  thmObligations: ProofObligation[];
  codeObligations: ProofObligation[];
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
      thmObligations: [],
      codeObligations: [],
    };
  }

  getTheorem() {
    const ast = this.state.theoremResult.ast;
    if (!ast) return undefined;
    if (ast.theorems.length !== 1) return undefined;
    return ast.theorems[0];
  }

  isValid(): boolean {
    if (this.state.declsText.length > 0 && !this.state.declsResult.ast) return false;
    if (this.state.theoremText.length > 0 && this.state.theoremResult.error) return false;
    if (this.state.codeText.length > 0 && !this.state.codeResult.ast) return false;
    return (
      this.state.declsText.length > 0 ||
      this.state.theoremText.length > 0 ||
      this.state.codeText.length > 0
    );
  }

  handleDeclsChange(text: string) {
    const result = text.length > 0 ? ParseDecls(text) : {};
    this.setState({ declsText: text, declsResult: result, checked: false, checkError: undefined, thmObligations: [], codeObligations: [] });
  }

  handleTheoremChange(text: string) {
    const result = text.length > 0 ? ParseDecls(text) : {};
    this.setState({ theoremText: text, theoremResult: result, checked: false, checkError: undefined, thmObligations: [], codeObligations: [] });
  }

  handleCodeChange(text: string) {
    const result = text.length > 0 ? ParseCode(text) : {};
    this.setState({ codeText: text, codeResult: result, checked: false, checkError: undefined, thmObligations: [], codeObligations: [] });
  }

  handleCheck() {
    try {
      const decls = this.state.declsResult.ast ?? new DeclsAst([], [], []);
      const env = new TopLevelEnv(decls.types, decls.functions, [], decls.theorems);

      const thmObligations: ProofObligation[] = [];
      const theorem = this.getTheorem();
      if (theorem) {
        const facts = theorem.premise ? [theorem.premise, theorem.conclusion]
            : [theorem.conclusion];
        const thmEnv = new NestedEnv(env, theorem.params, facts);
        thmEnv.check();
        thmObligations.push(theoremToProofObligation(theorem));
      }

      const codeObligations: ProofObligation[] = [];
      if (this.state.codeResult.ast) {
        checkFuncDef(env, this.state.codeResult.ast);
        codeObligations.push(...getProofObligations(this.state.codeResult.ast));
      }

      this.setState({ checked: true, checkError: undefined, thmObligations, codeObligations });
    } catch (e: any) {
      const msg = (e instanceof UserError) ? e.message : String(e);
      this.setState({ checked: false, checkError: msg, thmObligations: [], codeObligations: [] });
    }
  }

  render() {
    const { provedObls } = this.props;
    const { thmObligations, codeObligations, checked } = this.state;

    // Build line-badge maps for the editors (multiple obligations may share a line).
    const theoremBadges = new Map<number, number[]>();
    const codeBadges = new Map<number, number[]>();
    if (checked) {
      thmObligations.forEach((obl, i) => {
        const prev = theoremBadges.get(obl.line) ?? [];
        theoremBadges.set(obl.line, [...prev, i + 1]);
      });
      codeObligations.forEach((obl, i) => {
        const num = thmObligations.length + i + 1;
        const prev = codeBadges.get(obl.line) ?? [];
        codeBadges.set(obl.line, [...prev, num]);
      });
    }

    const thmHighlight = theoremBadges.size > 0
      ? (code: string) => highlightTheoremWithBadges(code, theoremBadges)
      : highlightTheorem;
    const codeHighlight = codeBadges.size > 0
      ? (code: string) => highlightCodeWithBadges(code, codeBadges)
      : highlightCode;

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
                highlight={thmHighlight}
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
                highlight={codeHighlight}
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
          <button className="btn-start" disabled={!this.isValid()}
              onClick={this.handleCheck.bind(this)}>
            Check
          </button>
          {this.state.checkError &&
            <div className="check-error-msg">{this.state.checkError}</div>}
        </div>
        {checked && (thmObligations.length > 0 || codeObligations.length > 0) &&
          this.renderObligations()}
      </div>
    );
  }

  renderObligations() {
    const { provedObls } = this.props;
    const { thmObligations, codeObligations } = this.state;
    const obligations = [...thmObligations, ...codeObligations];
    const decls = this.state.declsResult.ast ?? new DeclsAst([], [], []);

    return (
      <div style={{ marginTop: 20 }}>
        <div style={{ fontWeight: 'bold', fontFamily: 'Helvetica, sans-serif', marginBottom: 8 }}>
          Proof Obligations
        </div>
        <table cellPadding={5}>
          <tbody>
            {obligations.map((obl, i) => {
              const num = circledNum(i + 1);
              const key = oblKey(obl);
              const proved = provedObls.has(key);
              const provable = obl.goal.op !== '!=';
              const { premises, goal } = condToStr(obl);

              return (
                <tr key={i} style={{ borderTop: '1px solid #e0e0e0' }}>
                  <td style={{ fontFamily: 'monospace', fontSize: 13, verticalAlign: 'top' }}>
                    <div>
                      <span style={{ background: '#b06000', color: 'white', fontWeight: 'bold', borderRadius: 3, padding: '1px 5px' }}>{num}</span>
                      {' '}assuming: {premises}
                    </div>
                    <div style={{ marginLeft: '1.5em' }}>prove: {goal}</div>
                  </td>
                  <td style={{ fontFamily: 'Helvetica, sans-serif', fontSize: 13, verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                    {!provable
                      ? <span style={{ color: '#a34040' }}>Cannot prove (≠)</span>
                      : proved
                        ? <span style={{ color: '#3a7a3a' }}>Proved ✓</span>
                        : <span style={{ color: '#888' }}>Not started</span>
                    }
                    {' '}
                    {provable &&
                      <button className="btn-start"
                          onClick={() => this.props.onStart(decls, obl)}>
                        {proved ? 'View' : 'Prove'}
                      </button>
                    }
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }
}
