import { Expression } from './exprs';
import { Formula, subst_formula, OP_EQUAL, OP_LESS_THAN, OP_LESS_EQUAL } from './formula';

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

  vars(): Set<string> {
    const vars = this.formula.left.vars();
    for (const v of this.formula.right.vars()) vars.add(v);
    return vars;
  }

  equivalent(other: Prop): boolean {
    if (other.tag === 'atom')
      return this.formula.equivalent(other.formula);
    // AtomProp(a <= b) ≡ NotProp(b < a), AtomProp(a < b) ≡ NotProp(b <= a)
    if (other.tag === 'not') {
      const f = this.formula, g = other.formula;
      if (f.op === OP_LESS_EQUAL && g.op === OP_LESS_THAN)
        return f.left.equals(g.right) && f.right.equals(g.left);
      if (f.op === OP_LESS_THAN && g.op === OP_LESS_EQUAL)
        return f.left.equals(g.right) && f.right.equals(g.left);
    }
    return false;
  }

  to_string(): string { return this.formula.to_string(); }
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

  vars(): Set<string> {
    const vars = this.formula.left.vars();
    for (const v of this.formula.right.vars()) vars.add(v);
    return vars;
  }

  equivalent(other: Prop): boolean {
    if (other.tag === 'not')
      return this.formula.equivalent(other.formula);
    // NotProp(a < b) ≡ AtomProp(b <= a), NotProp(a <= b) ≡ AtomProp(b < a)
    if (other.tag === 'atom') {
      const f = this.formula, g = other.formula;
      if (f.op === OP_LESS_THAN && g.op === OP_LESS_EQUAL)
        return f.left.equals(g.right) && f.right.equals(g.left);
      if (f.op === OP_LESS_EQUAL && g.op === OP_LESS_THAN)
        return f.left.equals(g.right) && f.right.equals(g.left);
    }
    // not(a = b) ≡ (a < b or b < a)
    if (other.tag === 'or' && this.formula.op === OP_EQUAL &&
        other.disjuncts.length === 2) {
      const { left, right } = this.formula;
      return other.disjuncts.every(d =>
          d.tag === 'atom' && d.formula.op === OP_LESS_THAN) &&
        ((other.disjuncts[0].formula.left.equals(left) &&
          other.disjuncts[0].formula.right.equals(right) &&
          other.disjuncts[1].formula.left.equals(right) &&
          other.disjuncts[1].formula.right.equals(left)) ||
         (other.disjuncts[0].formula.left.equals(right) &&
          other.disjuncts[0].formula.right.equals(left) &&
          other.disjuncts[1].formula.left.equals(left) &&
          other.disjuncts[1].formula.right.equals(right)));
    }
    return false;
  }

  to_string(): string { return `not ${this.formula.to_string()}`; }
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

  vars(): Set<string> {
    const vars = new Set<string>();
    for (const d of this.disjuncts) {
      for (const v of d.vars()) vars.add(v);
    }
    return vars;
  }

  equivalent(other: Prop): boolean {
    if (other.tag === 'or') {
      if (this.disjuncts.length !== other.disjuncts.length) return false;
      const matched = new Array(other.disjuncts.length).fill(false);
      for (const d of this.disjuncts) {
        const idx = other.disjuncts.findIndex((o, i) => !matched[i] && d.equivalent(o));
        if (idx === -1) return false;
        matched[idx] = true;
      }
      return true;
    }
    // (a < b or b < a) ≡ not(a = b) — delegate to NotProp.equivalent
    if (other.tag === 'not')
      return other.equivalent(this);
    return false;
  }

  to_string(): string { return this.disjuncts.map(d => d.to_string()).join(' or '); }
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

  vars(): Set<string> { return new Set(); }

  equivalent(other: Prop): boolean {
    return other.tag === 'const' && this.value === other.value;
  }

  to_string(): string { return this.value ? 'true' : 'false'; }
}

export type Prop = AtomProp | NotProp | OrProp | ConstProp;
