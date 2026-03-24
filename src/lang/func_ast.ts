import { Expression, Variable, Call } from '../facts/exprs';
import { Formula, FormulaOp, OP_EQUAL, OP_LESS_THAN, OP_LESS_EQUAL } from '../facts/formula';

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
}

export class IfElseBody {
  tag: 'if' = 'if';
  condition: Formula;
  thenBody: Expression;
  elseBody: Expression;

  constructor(condition: Formula, thenBody: Expression, elseBody: Expression) {
    this.condition = condition;
    this.thenBody = thenBody;
    this.elseBody = elseBody;
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
  condition?: Formula;
  formula: Formula;
}

function paramToExpr(param: Param): Expression {
  if (param instanceof ParamVar) {
    return new Variable(param.name);
  } else {
    return new Call(param.name, param.args.map(paramToExpr));
  }
}

function negateCondition(f: Formula): Formula {
  if (f.op === OP_LESS_THAN) {
    return new Formula(f.right, OP_LESS_EQUAL, f.left);
  } else {
    return new Formula(f.right, OP_LESS_THAN, f.left);
  }
}

export function funcToDefinitions(func: FuncAst): Definition[] {
  const defs: Definition[] = [];
  for (let i = 0; i < func.cases.length; i++) {
    const c = func.cases[i];
    const lhs = new Call(func.name, c.params.map(paramToExpr));
    const body = c.body;
    if (body.tag === 'expr') {
      defs.push({
        name: `${func.name}_${i + 1}`,
        formula: new Formula(lhs, OP_EQUAL, body.expr),
      });
    } else {
      defs.push({
        name: `${func.name}_${i + 1}a`,
        condition: body.condition,
        formula: new Formula(lhs, OP_EQUAL, body.thenBody),
      });
      defs.push({
        name: `${func.name}_${i + 1}b`,
        condition: negateCondition(body.condition),
        formula: new Formula(lhs, OP_EQUAL, body.elseBody),
      });
    }
  }
  return defs;
}
