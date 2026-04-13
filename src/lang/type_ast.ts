export class TypeDeclAst {
  name: string;
  constructors: ConstructorAst[];
  line: number;
  col: number;
  length: number;

  constructor(name: string, constructors: ConstructorAst[],
      line: number = 0, col: number = 0, length: number = 0) {
    this.name = name;
    this.constructors = constructors;
    this.line = line;
    this.col = col;
    this.length = length;
  }
}

export class ConstructorAst {
  name: string;
  paramTypes: string[];
  returnType: string;
  line: number;
  col: number;
  length: number;

  constructor(name: string, paramTypes: string[], returnType: string,
      line: number = 0, col: number = 0, length: number = 0) {
    this.name = name;
    this.paramTypes = paramTypes;
    this.returnType = returnType;
    this.line = line;
    this.col = col;
    this.length = length;
  }
}
