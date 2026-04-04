import { Formula } from './formula';

export class AtomProp {
  tag: 'atom' = 'atom';
  formula: Formula;

  constructor(formula: Formula) {
    this.formula = formula;
  }
}

export class NotProp {
  tag: 'not' = 'not';
  formula: Formula;

  constructor(formula: Formula) {
    this.formula = formula;
  }
}

export type Literal = AtomProp | NotProp;

export class OrProp {
  tag: 'or' = 'or';
  disjuncts: Literal[];

  constructor(disjuncts: Literal[]) {
    this.disjuncts = disjuncts;
  }
}

export type Prop = AtomProp | NotProp | OrProp;
