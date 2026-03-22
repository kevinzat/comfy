@{%
const typeAst = require('./type_ast');
const moo = require('moo');
const util = require('./grammar_util');
const lexer2 = util.makeLexer(moo, {
  WS: /[ \t\r]+/,
  NL: { match: /\n/, lineBreaks: true },
  arrow: '->',
  typeName: /[A-Z][_a-zA-Z0-9]*/,
  variable: { match: /[a-z][_a-zA-Z0-9]*/, type: moo.keywords({ type: 'type' }) },
  pipe: '|',
  colon: ':',
  lparen: '(', rparen: ')', comma: ','
});
const list_to_array = util.list_to_array;
const checkCtorReturnTypes = util.checkCtorReturnTypes;
%}

@lexer lexer2

Main -> TypeDecl {% ([a]) => a %}

Types -> %typeName
      {% ([a]) => a.text %}
    | Types %comma %typeName
      {% ([a, _comma, b]) => [b.text, a] %}

@include "type_decl_rules.g"
