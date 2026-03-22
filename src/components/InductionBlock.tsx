import React from 'react';
import { Expression, Variable, Call } from '../facts/exprs';
import { Formula } from '../facts/formula';
import { Environment, NestedEnv } from '../types/env';
import { ConstructorAst } from '../lang/type_ast';
import { ExprToHtml } from './ProofElements';
import CalcBlock from './CalcBlock';
import './InductionBlock.css';


export interface InductionBlockProps {
  formula: Formula;
  env: Environment;
  varName: string;
  defNames?: string[];
  showHtml: boolean;
  onComplete?: (complete: boolean) => void;
}

interface CaseInfo {
  ctor: ConstructorAst;
  argNames: string[];
  argTypes: string[];
  /** The formula with the induction variable replaced by the constructor call. */
  goal: Formula;
  /** Induction hypotheses: the formula with the variable replaced by each recursive arg. */
  ihFacts: Formula[];
  /** Names of the recursive arguments (those whose type matches the induction type). */
  ihArgNames: string[];
  /** The nested environment for this case. */
  env: NestedEnv;
}

/**
 * Collects all variable names used in a formula (both sides).
 */
function formulaVars(formula: Formula): Set<string> {
  const vars = formula.left.vars();
  for (const v of formula.right.vars()) {
    vars.add(v);
  }
  return vars;
}

/**
 * Picks a fresh variable name that doesn't conflict with the given set of used names.
 * Tries single letters first (matching case of the replaced variable),
 * then double letters, etc.
 */
function freshVarName(used: Set<string>, lowercase: boolean): string {
  const letters = lowercase
    ? 'abcdefghijklmnopqrstuvwxyz'
    : 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  // Try single letters first.
  for (const ch of letters) {
    if (!used.has(ch)) return ch;
  }
  // Try double letters.
  for (const ch of letters) {
    const name = ch + ch;
    if (!used.has(name)) return name;
  }
  // Fallback: letter + digit.
  for (const ch of letters) {
    for (let i = 0; i < 10; i++) {
      const name = ch + String(i);
      if (!used.has(name)) return name;
    }
  }
  throw new Error('could not find a fresh variable name');
}

/**
 * Builds the case information for each constructor of the induction type.
 */
export function buildCases(
  formula: Formula,
  env: Environment,
  varName: string,
): CaseInfo[] {
  // Look up the variable's type.
  const varType = env.getVariable(varName);
  const typeName = varType.name;

  // Get the type declaration to find constructors.
  const typeDecl = env.getTypeDecl(typeName);
  if (typeDecl === null) {
    throw new Error(`cannot induct on built-in type "${typeName}"`);
  }

  const varExpr = Variable.of(varName);

  const cases: CaseInfo[] = [];
  for (const ctor of typeDecl.constructors) {
    // Collect all names already in use (from the formula + environment variable names).
    const used = formulaVars(formula);
    // Also mark the original variable name and any env-level names as used.
    used.add(varName);

    // Pick fresh names for each constructor parameter.
    // Lowercase for Int, uppercase for everything else.
    const argNames: string[] = [];
    for (let i = 0; i < ctor.paramTypes.length; i++) {
      const lowercase = ctor.paramTypes[i] === 'Int';
      const name = freshVarName(used, lowercase);
      argNames.push(name);
      used.add(name);
    }

    // Build the constructor call expression to substitute for the variable.
    let ctorExpr: Expression;
    if (argNames.length === 0) {
      ctorExpr = Variable.of(ctor.name);
    } else {
      ctorExpr = Call.of(ctor.name, ...argNames.map(n => Variable.of(n)));
    }

    // Substitute the constructor call for the induction variable in the formula.
    const goalLeft = formula.left.subst(varExpr, ctorExpr);
    const goalRight = formula.right.subst(varExpr, ctorExpr);
    const goal = new Formula(goalLeft, formula.op, goalRight);

    // Identify recursive arguments (same type as induction type) for IH.
    const ihFacts: Formula[] = [];
    const ihArgNames: string[] = [];
    for (let i = 0; i < ctor.paramTypes.length; i++) {
      if (ctor.paramTypes[i] === typeName) {
        const argExpr = Variable.of(argNames[i]);
        const ihLeft = formula.left.subst(varExpr, argExpr);
        const ihRight = formula.right.subst(varExpr, argExpr);
        ihFacts.push(new Formula(ihLeft, formula.op, ihRight));
        ihArgNames.push(argNames[i]);
      }
    }

    // Build nested environment with new variables and IH facts.
    const newVars: [string, string][] = argNames.map((name, i): [string, string] =>
      [name, ctor.paramTypes[i]]
    );
    const nestedEnv = new NestedEnv(env, newVars, ihFacts);

    cases.push({
      ctor,
      argNames,
      argTypes: ctor.paramTypes,
      goal,
      ihFacts,
      ihArgNames,
      env: nestedEnv,
    });
  }

  return cases;
}


interface InductionBlockState {
  caseComplete: boolean[];
}

export default class InductionBlock
    extends React.Component<InductionBlockProps, InductionBlockState> {

  private cases: CaseInfo[];

  constructor(props: InductionBlockProps) {
    super(props);
    this.cases = buildCases(props.formula, props.env, props.varName);
    this.state = {
      caseComplete: this.cases.map(() => false),
    };
  }

  private handleCaseComplete(index: number, complete: boolean) {
    const caseComplete = this.state.caseComplete.slice();
    caseComplete[index] = complete;
    this.setState({ caseComplete });
    if (this.props.onComplete) {
      this.props.onComplete(caseComplete.every(c => c));
    }
  }

  formatFormula(f: Formula): JSX.Element | string {
    if (this.props.showHtml) {
      return <span>{ExprToHtml(f.left)} {f.op} {ExprToHtml(f.right)}</span>;
    } else {
      return f.to_string();
    }
  }

  render() {
    const { varName, showHtml } = this.props;
    const parentNumFacts = this.props.env.numFacts();

    return (
      <div className="induction-block">
        <div className="induction-title">
          Proof by induction on <i>{varName}</i>:
        </div>
        {this.cases.map((c, idx) => {
          const ctorLabel = c.argNames.length === 0
            ? c.ctor.name
            : `${c.ctor.name}(${c.argNames.map((n, i) =>
                `${n}: ${c.argTypes[i]}`).join(', ')})`;

          return (
            <div className="induction-case" key={idx}>
              <div className="induction-case-header">
                <span className="induction-case-title">
                  Case <i>{varName}</i> = {ctorLabel}:
                </span>
              </div>
              {c.ihFacts.length > 0 && (
                <div className="induction-ih">
                  <div className="induction-ih-title">Induction hypotheses:</div>
                  <table className="induction-ih-table">
                    <tbody>
                      {c.ihFacts.map((f, i) => (
                        <tr key={i}>
                          <td className="induction-ih-index">
                            {parentNumFacts + i + 1}.
                          </td>
                          <td className="induction-ih-formula">
                            {this.formatFormula(f)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="induction-case-goal">
                <span className="induction-case-goal-title">Prove: </span>
                {this.formatFormula(c.goal)}
              </div>
              <CalcBlock
                env={c.env}
                givens={[]}
                goal={c.goal.to_string()}
                defNames={this.props.defNames}
                showHtml={showHtml}
                onComplete={(complete) => this.handleCaseComplete(idx, complete)}
              />
            </div>
          );
        })}
      </div>
    );
  }
}
