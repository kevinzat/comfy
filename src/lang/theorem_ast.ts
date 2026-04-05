import { Prop } from '../facts/prop';

export class TheoremAst {
  name: string;
  params: [string, string][];  // [name, typeName] pairs
  premises: Prop[];
  conclusion: Prop;
  line: number;

  constructor(
    name: string,
    params: [string, string][],
    premises: Prop[],
    conclusion: Prop,
    line: number = 0,
  ) {
    this.name = name;
    this.params = params;
    this.premises = premises;
    this.conclusion = conclusion;
    this.line = line;
  }
}
