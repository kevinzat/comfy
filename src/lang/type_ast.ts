export class TypeDeclAst {
  name: string;
  constructors: ConstructorAst[];

  constructor(name: string, constructors: ConstructorAst[]) {
    this.name = name;
    this.constructors = constructors;
  }
}

export class ConstructorAst {
  name: string;
  paramTypes: string[];
  returnType: string;

  constructor(name: string, paramTypes: string[], returnType: string) {
    this.name = name;
    this.paramTypes = paramTypes;
    this.returnType = returnType;
  }
}
