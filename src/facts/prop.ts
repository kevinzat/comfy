import { Expression } from './exprs';
import { Formula, subst_formula } from './formula';

export class AtomProp {
  tag: 'atom' = 'atom';
  formula: Formula;

  constructor(formula: Formula) {
    this.formula = formula;
  }

  subst(expr: Expression, value: Expression): AtomProp {
    const newFormula = subst_formula(this.formula, expr, value);
    return newFormula === this.formula ? this : new AtomProp(newFormula);
  }
}

export class NotProp {
  tag: 'not' = 'not';
  formula: Formula;

  constructor(formula: Formula) {
    this.formula = formula;
  }

  subst(expr: Expression, value: Expression): NotProp {
    const newFormula = subst_formula(this.formula, expr, value);
    return newFormula === this.formula ? this : new NotProp(newFormula);
  }
}

export type Literal = AtomProp | NotProp;

export class OrProp {
  tag: 'or' = 'or';
  disjuncts: Literal[];

  constructor(disjuncts: Literal[]) {
    this.disjuncts = disjuncts;
  }

  subst(expr: Expression, value: Expression): OrProp {
    let changed = false;
    const newDisjuncts = this.disjuncts.map((d) => {
      const newD = d.subst(expr, value);
      if (newD !== d) changed = true;
      return newD;
    });
    return !changed ? this : new OrProp(newDisjuncts);
  }
}

export class ConstProp {
  tag: 'const' = 'const';
  value: boolean;

  constructor(value: boolean) {
    this.value = value;
  }

  subst(_expr: Expression, _value: Expression): ConstProp {
    return this;
  }
}

export type Prop = AtomProp | NotProp | OrProp | ConstProp;
