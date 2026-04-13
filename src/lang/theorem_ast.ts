import { Prop } from '../facts/prop';

export interface ParamTypePos {
  line: number;
  col: number;
  length: number;
}

export class TheoremAst {
  name: string;
  params: [string, string][];  // [name, typeName] pairs
  paramTypePositions: ParamTypePos[];  // position of each param's type token
  premises: Prop[];
  conclusion: Prop;
  line: number;
  col: number;
  length: number;

  constructor(
    name: string,
    params: [string, string][],
    premises: Prop[],
    conclusion: Prop,
    line: number = 0,
    col: number = 0,
    length: number = 0,
    paramTypePositions: ParamTypePos[] = [],
  ) {
    this.name = name;
    this.params = params;
    this.paramTypePositions = paramTypePositions;
    this.premises = premises;
    this.conclusion = conclusion;
    this.line = line;
    this.col = col;
    this.length = length;
  }
}
