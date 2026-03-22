import { TypeDeclAst } from './type_ast';
import { FuncAst } from './func_ast';

export class DeclsAst {
  types: TypeDeclAst[];
  functions: FuncAst[];
  variables: [string, string][];

  constructor(types: TypeDeclAst[], functions: FuncAst[], variables: [string, string][]) {
    this.types = types;
    this.functions = functions;
    this.variables = variables;
  }
}
