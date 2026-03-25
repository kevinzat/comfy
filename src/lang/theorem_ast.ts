import { Formula } from '../facts/formula';

export class TheoremAst {
  name: string;
  params: [string, string][];  // [name, typeName] pairs
  premise: Formula | undefined;
  conclusion: Formula;

  constructor(
    name: string,
    params: [string, string][],
    premise: Formula | undefined,
    conclusion: Formula,
  ) {
    this.name = name;
    this.params = params;
    this.premise = premise;
    this.conclusion = conclusion;
  }
}
