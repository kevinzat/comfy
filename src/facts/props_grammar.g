@{%
const prop = require('./prop');
const formula = require('./formula');
const exprs = require('./exprs');
const moo = require('moo');
const util = require('../lang/grammar_util');
const lexer2 = util.makeLexer(moo, {
  WS: /[ \t\r]+/,
  NL: { match: /\n/, lineBreaks: true },
  lessequal: '<=',
  lessthan: '<',
  notequal: '/=',
  equal: '=',
  constant: /[0-9]+/,
  variable: { match: /[a-z][_a-zA-Z0-9]*/, type: moo.keywords({
    kw_or: 'or', kw_not: 'not', kw_true: 'true', kw_false: 'false'
  }) },
  lparen: '(', rparen: ')',
  comma: ',',
  exp: '^', times: '*', plus: '+', minus: '-'
});
const list_to_array = util.list_to_array;
%}

@lexer lexer2

Main -> Prop {% ([a]) => a %}

@include "./expr_rules.g"

@include "./prop_rules.g"
