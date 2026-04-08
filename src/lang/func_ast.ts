import { Expression, Variable, Call } from '../facts/exprs';
import { Formula, FormulaOp, OP_EQUAL, OP_LESS_THAN, OP_LESS_EQUAL } from '../facts/formula';
import { Prop, Literal, AtomProp, NotProp, OrProp, ConstProp } from '../facts/prop';
import { ClauseLiteral, distribute, clauseToProp } from './code_ast';

export class FuncAst {
  name: string;
  type: TypeAst;
  cases: CaseAst[];

  constructor(name: string, type: TypeAst, cases: CaseAst[]) {
    this.name = name;
    this.type = type;
    this.cases = cases;
  }
}

export class TypeAst {
  paramTypes: string[];
  returnType: string;

  constructor(paramTypes: string[], returnType: string) {
    this.paramTypes = paramTypes;
    this.returnType = returnType;
  }
}

export class ExprBody {
  tag: 'expr' = 'expr';
  expr: Expression;

  constructor(expr: Expression) {
    this.expr = expr;
  }

  to_string(): string {
    return this.expr.to_string();
  }
}

export class IfBranch {
  conditions: Prop[];
  body: Expression;

  constructor(conditions: Prop[], body: Expression) {
    this.conditions = conditions;
    this.body = body;
  }
}

export class IfElseBody {
  tag: 'if' = 'if';
  branches: IfBranch[];
  elseBody: Expression;

  constructor(branches: IfBranch[], elseBody: Expression) {
    this.branches = branches;
    this.elseBody = elseBody;
  }

  to_string(): string {
    const parts: string[] = [];
    for (let i = 0; i < this.branches.length; i++) {
      const branch = this.branches[i];
      const keyword = i === 0 ? 'if' : 'else if';
      const conds = branch.conditions.map(c => c.to_string()).join(', ');
      parts.push(`${keyword} ${conds} then ${branch.body.to_string()}`);
    }
    parts.push(`else ${this.elseBody.to_string()}`);
    return parts.join(' ');
  }
}

export type CaseBody = ExprBody | IfElseBody;

export class CaseAst {
  params: Param[];
  body: CaseBody;

  constructor(params: Param[], body: CaseBody) {
    this.params = params;
    this.body = body;
  }
}

export type Param = ParamVar | ParamConstructor;

export class ParamVar {
  name: string;

  constructor(name: string) {
    this.name = name;
  }
}

export class ParamConstructor {
  name: string;
  args: Param[];

  constructor(name: string, args: Param[]) {
    this.name = name;
    this.args = args;
  }
}

export interface Definition {
  name: string;
  conditions: Prop[];
  formula: Formula;
}

function paramToExpr(param: Param): Expression {
  if (param instanceof ParamVar) {
    return new Variable(param.name);
  } else {
    return new Call(param.name, param.args.map(paramToExpr));
  }
}

function negateLiteral(lit: Literal): Literal {
  if (lit.tag === 'atom') {
    const f = lit.formula;
    if (f.op === OP_LESS_THAN)
      return new AtomProp(new Formula(f.right, OP_LESS_EQUAL, f.left));
    if (f.op === OP_LESS_EQUAL)
      return new AtomProp(new Formula(f.right, OP_LESS_THAN, f.left));
    // OP_EQUAL
    return new NotProp(f);
  } else {
    // NotProp: double negation
    return new AtomProp(lit.formula);
  }
}

/** Negate a Prop, returning a conjunction of ClauseLiterals equivalent to NOT(p). */
function negateProp(p: Prop): ClauseLiteral[] {
  if (p.tag === 'atom' || p.tag === 'not')
    return [negateLiteral(p)];
  if (p.tag === 'or')
    return p.disjuncts.map(d => negateLiteral(d));
  // ConstProp
  return [new ConstProp(!p.value)];
}

/**
 * Negate a conjunction of Props, returning a conjunction (Prop[]) equivalent to
 * NOT(P1 AND P2 AND ...) = NOT(P1) OR NOT(P2) OR ...
 *
 * Each NOT(Pi) is a conjunction of ClauseLiterals. The disjunction of these
 * conjunctions is converted to CNF using distribute/clauseToProp from code_ast.
 */
function negateConjunction(conditions: Prop[]): Prop[] {
  if (conditions.length === 1) {
    return negateProp(conditions[0]).map(c => clauseToProp([c]));
  }
  // Each NOT(Pi) is a CNF with singleton clauses.
  const cnfs: ClauseLiteral[][][] = conditions.map(
      cond => negateProp(cond).map(lit => [lit]));
  // Fold with distribute to get CNF of the disjunction.
  let result = cnfs[0];
  for (let i = 1; i < cnfs.length; i++) {
    result = distribute(result, cnfs[i]);
  }
  return result.map(clauseToProp);
}

const LETTERS = 'abcdefghijklmnopqrstuvwxyz';

export function funcToDefinitions(func: FuncAst): Definition[] {
  const defs: Definition[] = [];
  for (let i = 0; i < func.cases.length; i++) {
    const c = func.cases[i];
    const lhs = new Call(func.name, c.params.map(paramToExpr));
    const body = c.body;
    if (body.tag === 'expr') {
      defs.push({
        name: `${func.name}_${i + 1}`,
        conditions: [],
        formula: new Formula(lhs, OP_EQUAL, body.expr),
      });
    } else {
      const { branches, elseBody } = body;
      // Accumulated negations of prior branches' conditions.
      const priorNegated: Prop[] = [];
      for (let j = 0; j < branches.length; j++) {
        const branch = branches[j];
        defs.push({
          name: `${func.name}_${i + 1}${LETTERS[j]}`,
          conditions: [...priorNegated, ...branch.conditions],
          formula: new Formula(lhs, OP_EQUAL, branch.body),
        });
        priorNegated.push(...negateConjunction(branch.conditions));
      }
      // Final else branch: all prior conditions negated.
      defs.push({
        name: `${func.name}_${i + 1}${LETTERS[branches.length]}`,
        conditions: priorNegated,
        formula: new Formula(lhs, OP_EQUAL, elseBody),
      });
    }
  }
  return defs;
}
