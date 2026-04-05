@{%
const prop = require('./prop');
const formula = require('./formula');
const exprs = require('./exprs');
const moo = require('moo');
const util = require('../lang/grammar_util');
const clexer = util.makeLexer(moo, {
  WS: /[ \t\r]+/,
  NL: { match: /\n/, lineBreaks: true },
  lessequal: '<=',
  lessthan: '<',
  equal: '=',
  constant: /[0-9]+/,
  ident: { match: /[a-z][_a-zA-Z0-9]*/, type: moo.keywords({
    kw_or: 'or', kw_not: 'not'
  }) },
  lparen: '(', rparen: ')',
  comma: ',',
  exp: '^', times: '*', plus: '+', minus: '-'
});
const list_to_array = util.list_to_array;
%}

@lexer clexer

Main -> Prop {% ([a]) => a %}

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

Expr -> Expr %plus NegTerm
  {% ([a, op, c]) => new exprs.Call(exprs.FUNC_ADD, [a, c], op.line, op.col) %}
      | Expr %minus NegTerm
  {% ([a, op, c]) => new exprs.Call(exprs.FUNC_SUBTRACT, [a, c], op.line, op.col) %}
      | NegTerm {% ([a]) => a %}

NegTerm -> %minus NegTerm
  {% ([op, b]) => new exprs.Call(exprs.FUNC_NEGATE, [b], op.line, op.col) %}
         | Term {% ([a]) => a %}

Term -> Term %times Factor
  {% ([a, op, c]) => new exprs.Call(exprs.FUNC_MULTIPLY, [a, c], op.line, op.col) %}
      | Factor {% ([a]) => a %}

Factor -> Primary %exp %constant
  {% ([a, op, c]) => new exprs.Call(exprs.FUNC_EXPONENTIATE, [a, new exprs.Constant(BigInt(c.text), c.line, c.col)], op.line, op.col) %}
        | Primary {% ([a]) => a %}

Primary -> %constant
  {% ([a]) => new exprs.Constant(BigInt(a.text), a.line, a.col) %}
         | %ident %lparen Exprs %rparen
  {% ([a, _lp, c, _rp]) => new exprs.Call(a.text, list_to_array(c, true), a.line, a.col) %}
         | %ident
  {% ([a]) => new exprs.Variable(a.text, a.line, a.col) %}
         | %lparen Expr %rparen
  {% ([_lp, b, _rp]) => b %}

Exprs -> Expr {% ([a]) => a %}
       | Exprs %comma Expr {% ([a, _c, c]) => [c, a] %}
