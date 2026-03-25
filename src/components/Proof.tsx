import React from 'react';
import { Formula } from '../facts/formula';
import { DeclsAst } from '../lang/decls_ast';
import { TheoremAst } from '../lang/theorem_ast';
import { TypeDeclAst } from '../lang/type_ast';
import { FuncAst, Param, ParamConstructor, funcToDefinitions } from '../lang/func_ast';
import { TopLevelEnv, NestedEnv } from '../types/env';
import { ExprToHtml, OpToHtml } from './ProofElements';
import ProofBlock from './ProofBlock';
import './Proof.css';


export interface ProofProps {
  decls: DeclsAst;
  theorem: TheoremAst;
}

interface ProofState {
  showHtml: boolean;
  complete: boolean;
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
            {def.condition && <>{' '}<span className="decl-func-condition">if {ExprToHtml(def.condition.left)} {OpToHtml(def.condition.op)} {ExprToHtml(def.condition.right)}</span></>}
          </span>
        </div>
      ))}
    </div>;
  } else {
    const sigType = `(${func.type.paramTypes.join(', ')}) -> ${func.type.returnType}`;
    const lines = [`def ${func.name} : ${sigType}`];
    for (const c of func.cases) {
      const params = c.params.map(paramToString).join(', ');
      const bodyStr = c.body.tag === 'expr'
          ? c.body.expr.to_string()
          : `if ${c.body.condition.to_string()} then ${c.body.thenBody.to_string()} else ${c.body.elseBody.to_string()}`;
      lines.push(`| ${func.name}(${params}) => ${bodyStr}`);
    }
    return <div className="decl-func decl-text" key={`func-${func.name}`}>
      {lines.map((l, i) => <div key={i}>{l}</div>)}
    </div>;
  }
}

export default class Proof extends React.Component<ProofProps, ProofState> {
  constructor(props: ProofProps) {
    super(props);
    this.state = { showHtml: true, complete: false };
  }

  render() {
    const decls = this.props.decls;
    const theorem = this.props.theorem;
    const givens: Formula[] = theorem.premise ? [theorem.premise] : [];
    const goal = theorem.conclusion;
    const env = new TopLevelEnv(decls.types, decls.functions,
        [], decls.theorems);
    const proofEnv = new NestedEnv(env, theorem.params, givens);

    const hasDecls = decls.types.length > 0 || decls.functions.length > 0;


    return (
      <div className="proof">
        {hasDecls &&
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
                {givens.map((f, i) => (
                  <tr key={i}>
                    <td className="proof-given-index">{i + 1}.</td>
                    <td className="proof-given-formula">
                      {this.state.showHtml
                        ? <span>{ExprToHtml(f.left)} {OpToHtml(f.op)} {ExprToHtml(f.right)}</span>
                        : f.to_string()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        }
        <ProofBlock formula={goal} env={proofEnv}
            defNames={decls.functions.flatMap(f => funcToDefinitions(f).map(d => d.name))}
            showHtml={this.state.showHtml}
            onComplete={(c) => this.setState({ complete: c })} />
        <div className="proof-toggle">
          <span className="btn-edit-chain"
              onClick={() => this.setState({ showHtml: !this.state.showHtml })}>
            {this.state.showHtml ? 'Show Text' : 'Show HTML'}
          </span>
          {this.state.complete ?
            <span className="complete-msg">Complete!</span> : ''}
        </div>
      </div>
    );
  }
}
