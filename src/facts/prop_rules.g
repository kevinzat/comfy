@lexer lexer2

Prop -> Literal {% ([l]) => l %}
      | Prop %kw_or Literal
  {% ([p, _op, l]) => {
      if (p.tag === 'or') return new prop.OrProp([...p.disjuncts, l]);
      return new prop.OrProp([p, l]);
  } %}

Literal -> Formula {% ([f]) => new prop.AtomProp(f) %}
         | %kw_not Formula {% ([_op, f]) => new prop.NotProp(f) %}

Formula -> Expr %equal Expr
  {% ([l, _op, r]) => new formula.Formula(l, '=', r) %}
         | Expr %lessthan Expr
  {% ([l, _op, r]) => new formula.Formula(l, '<', r) %}
         | Expr %lessequal Expr
  {% ([l, _op, r]) => new formula.Formula(l, '<=', r) %}
