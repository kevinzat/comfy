@{%
const exprs = require('../facts/exprs');
const formula = require('../facts/formula');
const prop = require('../facts/prop');
const funcAst = require('./func_ast');
const moo = require('moo');
const util = require('./grammar_util');
const lexer2 = util.makeLangLexer(moo);
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

@include "../facts/prop_rules.g"

Primary -> %typeName
      {% ([a]) => new exprs.Variable(a.text, a.line, a.col) %}
    | %typeName %lparen Exprs %rparen
      {% ([a, b, c, d]) => new exprs.Call(a.text, list_to_array(c, true), a.line, a.col) %}
