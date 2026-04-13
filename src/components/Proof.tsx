import React from 'react';
import { Formula } from '../facts/formula';
import { AtomProp } from '../facts/prop';
import { DeclsAst } from '../lang/decls_ast';
import { TypeDeclAst } from '../lang/type_ast';
import { FuncAst, Param, ParamConstructor, funcToDefinitions } from '../lang/func_ast';
import { TopLevelEnv, NestedEnv } from '../types/env';
import { ProofObligation } from '../program/obligations';
import { ProofNode } from '../proof/proof_file';
import { oblToLean } from '../proof/lean';
import { ExprToHtml, OpToHtml, PropToHtml } from './ProofElements';
import ProofBlock from './ProofBlock';
import './Proof.css';


export interface ProofProps {
  decls: DeclsAst;
  obligation: ProofObligation;
  onBack: (proved: boolean) => void;
  /** When true, hides the Back button and declarations section (for inline embedding). */
  embedded?: boolean;
}

interface ProofState {
  showHtml: boolean;
  complete: boolean;
  showLean: boolean;
}

function paramToString(param: Param): string {
  if (param instanceof ParamConstructor) {
    if (param.args.length === 0) return param.name;
    return `${param.name}(${param.args.map(paramToString).join(', ')})`;
  }
  return param.name;
}

function renderTypeDecl(decl: TypeDeclAst, showHtml: boolean): JSX.Element {
  if (showHtml) {
    const ctors = decl.constructors.map((ctor, i) => {
      const args = ctor.paramTypes.length > 0
          ? `(${ctor.paramTypes.join(', ')})` : '';
      return <span key={i}>
        {i > 0 && <span className="decl-separator"> | </span>}
        <span className="decl-ctor-name">{ctor.name}{args}</span>
      </span>;
    });
    return <div className="decl-type" key={`type-${decl.name}`}>
      <span className="decl-keyword">type </span>
      <span className="decl-type-name">{decl.name}</span>
      <span className="decl-assign"> := </span>
      {ctors}
    </div>;
  } else {
    const lines = [`type ${decl.name}`];
    for (const ctor of decl.constructors) {
      const sig = ctor.paramTypes.length > 0
          ? `(${ctor.paramTypes.join(', ')}) -> ${ctor.returnType}` : ctor.returnType;
      lines.push(`| ${ctor.name} : ${sig}`);
    }
    return <div className="decl-type decl-text" key={`type-${decl.name}`}>
      {lines.map((l, i) => <div key={i}>{l}</div>)}
    </div>;
  }
}

function renderFuncDecl(func: FuncAst, showHtml: boolean): JSX.Element {
  if (showHtml) {
    const sigType = `(${func.type.paramTypes.join(', ')}) → ${func.type.returnType}`;
    const defs = funcToDefinitions(func);
    return <div className="decl-func" key={`func-${func.name}`}>
      <div className="decl-func-sig"><span className="decl-keyword">def </span><span className="decl-func-name">{func.name}</span> : {sigType}</div>
      {defs.map((def) => (
        <div className="decl-func-case" key={def.name}>
          <span className="decl-func-case-name">{def.name}: </span>
          <span>{ExprToHtml(def.formula.left)} = {ExprToHtml(def.formula.right)}
            {def.conditions.length > 0 && <>{' '}<span className="decl-func-condition">if {def.conditions.map((c, j) => <React.Fragment key={j}>{j > 0 && ', '}{PropToHtml(c)}</React.Fragment>)}</span></>}
          </span>
        </div>
      ))}
    </div>;
  } else {
    const sigType = `(${func.type.paramTypes.join(', ')}) -> ${func.type.returnType}`;
    const lines = [`def ${func.name} : ${sigType}`];
    for (const c of func.cases) {
      const params = c.params.map(paramToString).join(', ');
      const bodyStr = c.body.to_string();
      lines.push(`| ${func.name}(${params}) => ${bodyStr}`);
    }
    return <div className="decl-func decl-text" key={`func-${func.name}`}>
      {lines.map((l, i) => <div key={i}>{l}</div>)}
    </div>;
  }
}

export default class Proof extends React.Component<ProofProps, ProofState> {
  private proofBlockRef = React.createRef<ProofBlock>();

  constructor(props: ProofProps) {
    super(props);
    this.state = { showHtml: true, complete: false, showLean: false };
  }

  private getLeanText(): string {
    const proofNode = this.proofBlockRef.current?.getProofNode() ?? null;
    if (!proofNode) return '';
    return oblToLean(this.props.obligation, this.props.decls, proofNode);
  }

  private copyLean() {
    const text = this.getLeanText();
    if (text) navigator.clipboard.writeText(text).catch(() => {});
  }

  render() {
    const { decls, obligation, onBack, embedded } = this.props;

    const backBtn = !embedded ? (
      <span className="btn-edit-chain"
          onClick={() => onBack(this.state.complete)}>← Back</span>
    ) : null;

    if (!(obligation.goal instanceof AtomProp)) {
      const backBtnUnprovable = !embedded ? (
        <span className="btn-edit-chain"
            onClick={() => onBack(false)}>← Back</span>
      ) : null;
      return (
        <div className="proof">
          {backBtnUnprovable && <div className="proof-toggle">{backBtnUnprovable}</div>}
          <div className="check-error-msg">
            This obligation cannot be proven (goal involves ≠).
          </div>
        </div>
      );
    }

    const goal: Formula = obligation.goal.formula;
    const givens: AtomProp[] = obligation.premises
      .flatMap(p => p instanceof AtomProp ? [p] : []);

    const env = new TopLevelEnv(decls.types, decls.functions, [], decls.theorems);
    const proofEnv = new NestedEnv(env, obligation.params, givens);

    // Pass a single premise to ProofBlock for induction hypothesis support.
    const premise = givens.length === 1 ? givens[0].formula : undefined;

    const hasDecls = decls.types.length > 0 || decls.functions.length > 0;

    return (
      <div className="proof">
        {!embedded && hasDecls &&
          <div className="proof-decls">
            <div className="proof-decls-title">Declarations:</div>
            <div className="proof-decls-body">
              {decls.types.map(t => renderTypeDecl(t, this.state.showHtml))}
              {decls.functions.map(f => renderFuncDecl(f, this.state.showHtml))}
            </div>
          </div>
        }
        {givens.length > 0 &&
          <div className="proof-givens">
            <div className="proof-givens-title">Given:</div>
            <table className="proof-givens-table">
              <tbody>
                {givens.map((g, i) => (
                  <tr key={i}>
                    <td className="proof-given-index">{i + 1}.</td>
                    <td className="proof-given-formula">
                      {this.state.showHtml
                        ? <span>{ExprToHtml(g.formula.left)} {OpToHtml(g.formula.op)} {ExprToHtml(g.formula.right)}</span>
                        : g.to_string()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        }
        <ProofBlock ref={this.proofBlockRef} formula={goal} env={proofEnv} premise={premise}
            defNames={decls.functions.flatMap(f => funcToDefinitions(f).map(d => d.name))}
            showHtml={this.state.showHtml}
            onComplete={(c) => this.setState({ complete: c })} />
        <div className="proof-toggle">
          {backBtn}
          <span className="btn-edit-chain"
              onClick={() => this.setState({ showHtml: !this.state.showHtml })}>
            {this.state.showHtml ? 'Show Text' : 'Show HTML'}
          </span>
          {this.state.complete &&
            <span className="btn-edit-chain"
                onClick={() => this.setState(s => ({ showLean: !s.showLean }))}>
              {this.state.showLean ? 'Hide Lean' : 'Show Lean'}
            </span>
          }
          {this.state.complete ?
            <span className="complete-msg">Complete!</span> : ''}
        </div>
        {this.state.showLean && this.state.complete &&
          <div className="proof-lean">
            <div className="proof-lean-header">
              <span className="proof-lean-title">Lean 4</span>
              <button className="btn-start" onClick={() => this.copyLean()}>Copy</button>
            </div>
            <pre className="proof-lean-text">{this.getLeanText()}</pre>
          </div>
        }
      </div>
    );
  }
}
