import { TypeDeclAst } from './type_ast';
import { FuncAst } from './func_ast';
import { TheoremAst } from './theorem_ast';

export class DeclsAst {
  types: TypeDeclAst[];
  functions: FuncAst[];
  theorems: TheoremAst[];

  constructor(
    types: TypeDeclAst[],
    functions: FuncAst[],
    theorems: TheoremAst[] = [],
  ) {
    this.types = types;
    this.functions = functions;
    this.theorems = theorems;
  }
}
