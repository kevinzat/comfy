@{%
const exprs = require('../facts/exprs');
const funcAst = require('./func_ast');
const moo = require('moo');
const util = require('./grammar_util');
const lexer2 = util.makeLexer(moo, {
  WS: /[ \t\r]+/,
  NL: { match: /\n/, lineBreaks: true },
  arrow: '->',
  fatArrow: '=>',
  constant: /[0-9]+/,
  typeName: /[A-Z][_a-zA-Z0-9]*/,
  variable: { match: /[a-z][_a-zA-Z0-9]*/, type: moo.keywords({ def: 'def' }) },
  pipe: '|',
  colon: ':',
  lparen: '(', rparen: ')', comma: ',',
  exp: '^', times: '*', plus: '+', minus: '-'
});
const list_to_array = util.list_to_array;
const checkCaseNames = util.checkCaseNames;
%}

@lexer lexer2

Main -> FuncDef {% ([a]) => a %}

Types -> %typeName
      {% ([a]) => a.text %}
    | Types %comma %typeName
      {% ([a, _comma, b]) => [b.text, a] %}

@include "func_def_rules.g"

@include "../facts/expr_rules.g"

Primary -> %typeName
      {% ([a]) => new exprs.Variable(a.text) %}
    | %typeName %lparen Exprs %rparen
      {% ([a, b, c, d]) => new exprs.Call(a.text, list_to_array(c, true)) %}
