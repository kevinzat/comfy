@{%
const exprs = require('./exprs');
const moo = require('moo');
const lexer = moo.compile({
  WS: /[ \t\r]+/,
  NL: { match: /\n/, lineBreaks: true },
  constant: /[0-9]+/,
  typeName: /[A-Z][_a-zA-Z0-9]*/,
  variable: /[a-z][_a-zA-Z0-9]*/,
  lparen: /\(/, rparen: /\)/, comma: /,/,
  exp: /\^/, times: /\*/, plus: /\+/, minus: /\-/
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
/** Turns a linked list into an (optionally reversed) array. */
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

Main -> Expr {% ([a]) => a %}

@include "expr_rules.g"

Primary -> %typeName
      {% ([a]) => new exprs.Variable(a.text) %}
    | %typeName %lparen Exprs %rparen
      {% ([a, b, c, d]) => new exprs.Call(a.text, list_to_array(c, true)) %}
