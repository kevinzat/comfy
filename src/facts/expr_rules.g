@lexer lexer2

Expr -> Expr %plus NegTerm
      {% ([a, op, c]) => new exprs.Call(exprs.FUNC_ADD, [a, c], op.line, op.col) %}
    | Expr %minus NegTerm
      {% ([a, op, c]) => new exprs.Call(exprs.FUNC_SUBTRACT, [a, c], op.line, op.col) %}
    | NegTerm
      {% ([a]) => a %}

NegTerm -> %minus NegTerm
      {% ([op, b]) => new exprs.Call(exprs.FUNC_NEGATE, [b], op.line, op.col) %}
    | Term
      {% ([a]) => a %}

Term -> Term %times Factor
      {% ([a, op, c]) => new exprs.Call(exprs.FUNC_MULTIPLY, [a, c], op.line, op.col) %}
    | Factor
      {% ([a]) => a %}

Factor -> Primary %exp %constant
      {% ([a, op, c]) => new exprs.Call(exprs.FUNC_EXPONENTIATE, [a, new exprs.Constant(BigInt(c.text), c.line, c.col)], op.line, op.col) %}
    | Primary
      {% ([a]) => a %}

Primary -> %constant
      {% ([a]) => new exprs.Constant(BigInt(a.text), a.line, a.col) %}
    | %variable
      {% ([a]) => new exprs.Variable(a.text, a.line, a.col) %}
    | %variable %lparen Exprs %rparen
      {% ([a, b, c, d]) => new exprs.Call(a.text, list_to_array(c, true), a.line, a.col) %}
    | %lparen Expr %rparen
      {% ([a, b, c]) => b %}

Exprs -> Expr
      {% ([a]) => a %}
    | Exprs %comma Expr
      {% ([a, b, c]) => [c, a] %}
