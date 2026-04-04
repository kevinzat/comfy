import { Formula } from '../facts/formula';

export class TheoremAst {
  name: string;
  params: [string, string][];  // [name, typeName] pairs
  premises: Formula[];
  conclusion: Formula;
  line: number;

  constructor(
    name: string,
    params: [string, string][],
    premises: Formula[],
    conclusion: Formula,
    line: number = 0,
  ) {
    this.name = name;
    this.params = params;
    this.premises = premises;
    this.conclusion = conclusion;
    this.line = line;
  }
}
