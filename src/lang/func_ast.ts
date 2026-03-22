import { Expression, Variable, Call } from '../facts/exprs';
import { Formula, OP_EQUAL } from '../facts/formula';

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

export class CaseAst {
  params: Param[];
  body: Expression;

  constructor(params: Param[], body: Expression) {
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
  formula: Formula;
}

function paramToExpr(param: Param): Expression {
  if (param instanceof ParamVar) {
    return new Variable(param.name);
  } else {
    return new Call(param.name, param.args.map(paramToExpr));
  }
}

export function funcToDefinitions(func: FuncAst): Definition[] {
  return func.cases.map((c, i) => {
    const lhs = new Call(func.name, c.params.map(paramToExpr));
    return {
      name: `${func.name}_${i + 1}`,
      formula: new Formula(lhs, OP_EQUAL, c.body),
    };
  });
}
