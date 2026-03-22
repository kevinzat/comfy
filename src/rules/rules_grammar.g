@{%
const exprs = require('../facts/exprs');
const ast = require('./rules_ast');
const moo = require('moo');
const lexer = moo.compile({
  WS: /[ \t\r]+/,
  NL: { match: /\n/, lineBreaks: true },
  constant: /[0-9]+/,
  variable: { match: /[a-zA-Z][_a-zA-Z0-9]*/, type: moo.keywords({ subst: 'subst', unsub: 'unsub', defof: 'defof', undef: 'undef' }) },
  lessequal: '<=',
  lessthan: '<',
  equal: '=',
  lparen: '(', rparen: ')', comma: ',',
  exp: '^', times: '*', plus: '+', minus: '-'
});
const lexer2 = {
  save: () => lexer.save(),
  reset: (chunk, info) => lexer.reset(chunk, info),
  formatError: (tok) => lexer.formatError(tok),
  has: (name) => lexer.has(name),
  next: () => {
    let tok;
    do {
      tok = lexer.next();
    } while (tok !== undefined && (tok.type === 'WS' || tok.type === 'NL'));
    return tok;
  }
};
function list_to_array(a, rev) {
  const res = [];
  while (a instanceof Array && a.length == 2) {
    res.push(a[0]);
    a = a[1];
  }
  res.push(a);
  if (rev)
    res.reverse();
  return res;
}
%}

@lexer lexer2

Rule -> %equal Expr
      {% ([op, e]) => new ast.AlgebraAst('=', e, []) %}
    | %equal Expr Refs
      {% ([op, e, refs]) => new ast.AlgebraAst('=', e, refs) %}
    | %lessthan Expr
      {% ([op, e]) => new ast.AlgebraAst('<', e, []) %}
    | %lessthan Expr Refs
      {% ([op, e, refs]) => new ast.AlgebraAst('<', e, refs) %}
    | %lessequal Expr
      {% ([op, e]) => new ast.AlgebraAst('<=', e, []) %}
    | %lessequal Expr Refs
      {% ([op, e, refs]) => new ast.AlgebraAst('<=', e, refs) %}
    | %subst %constant
      {% ([a, b]) => new ast.SubstituteAst(parseInt(b.text), true) %}
    | %subst %constant Expr
      {% ([a, b, e]) => new ast.SubstituteAst(parseInt(b.text), true, e) %}
    | %unsub %constant
      {% ([a, b]) => new ast.SubstituteAst(parseInt(b.text), false) %}
    | %unsub %constant Expr
      {% ([a, b, e]) => new ast.SubstituteAst(parseInt(b.text), false, e) %}
    | %defof %variable
      {% ([a, name]) => new ast.DefinitionAst(name.text, true) %}
    | %defof %variable Expr
      {% ([a, name, e]) => new ast.DefinitionAst(name.text, true, e) %}
    | %undef %variable
      {% ([a, name]) => new ast.DefinitionAst(name.text, false) %}
    | %undef %variable Expr
      {% ([a, name, e]) => new ast.DefinitionAst(name.text, false, e) %}

Refs -> %constant
      {% ([c]) => [parseInt(c.text)] %}
    | Refs %constant
      {% ([refs, c]) => refs.concat([parseInt(c.text)]) %}

Expr -> Expr %plus NegTerm
      {% ([a, b, c]) => new exprs.Call(exprs.FUNC_ADD, [a, c]) %}
    | Expr %minus NegTerm
      {% ([a, b, c]) => new exprs.Call(exprs.FUNC_SUBTRACT, [a, c]) %}
    | NegTerm
      {% ([a]) => a %}

NegTerm -> %minus NegTerm
      {% ([a, b]) => new exprs.Call(exprs.FUNC_NEGATE, [b]) %}
    | Term
      {% ([a]) => a %}

Term -> Term %times Factor
      {% ([a, b, c]) => new exprs.Call(exprs.FUNC_MULTIPLY, [a, c]) %}
    | Factor
      {% ([a]) => a %}

Factor -> Primary %exp %constant
      {% ([a, b, c]) => new exprs.Call(exprs.FUNC_EXPONENTIATE, [a, new exprs.Constant(BigInt(c.text))]) %}
    | Primary
      {% ([a]) => a %}

Primary -> %constant
      {% ([a]) => new exprs.Constant(BigInt(a.text)) %}
    | %variable
      {% ([a]) => new exprs.Variable(a.text) %}
    | %variable %lparen Exprs %rparen
      {% ([a, b, c, d]) => new exprs.Call(a.text, list_to_array(c, true)) %}
    | %lparen Expr %rparen
      {% ([a, b, c]) => b %}

Exprs -> Expr
      {% ([a]) => a %}
    | Exprs %comma Expr
      {% ([a, b, c]) => [c, a] %}
