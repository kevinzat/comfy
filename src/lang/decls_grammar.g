@{%
const exprs = require('../facts/exprs');
const funcAst = require('./func_ast');
const typeAst = require('./type_ast');
const declsAst = require('./decls_ast');
const moo = require('moo');
const util = require('./grammar_util');
const lexer2 = util.makeLexer(moo, {
  WS: /[ \t\r]+/,
  NL: { match: /\n/, lineBreaks: true },
  arrow: '->',
  fatArrow: '=>',
  constant: /[0-9]+/,
  typeName: /[A-Z][_a-zA-Z0-9]*/,
  variable: { match: /[a-z][_a-zA-Z0-9]*/, type: moo.keywords({
    def: 'def', type: 'type', kw_var: 'var'
  }) },
  pipe: '|',
  colon: ':',
  lparen: '(', rparen: ')', comma: ',',
  exp: '^', times: '*', plus: '+', minus: '-'
});
const list_to_array = util.list_to_array;
const checkCaseNames = util.checkCaseNames;
const checkCtorReturnTypes = util.checkCtorReturnTypes;
%}

@lexer lexer2

Decls -> Decl
      {% ([d]) => d %}
    | Decls Decl
      {% ([ds, d]) => new declsAst.DeclsAst(
          ds.types.concat(d.types), ds.functions.concat(d.functions),
          ds.variables.concat(d.variables)) %}

Decl -> TypeDecl
      {% ([d]) => new declsAst.DeclsAst([d], [], []) %}
    | FuncDef
      {% ([d]) => new declsAst.DeclsAst([], [d], []) %}
    | VarDecl
      {% ([d]) => new declsAst.DeclsAst([], [], [d]) %}

VarDecl -> %kw_var %variable %colon %typeName
      {% ([_var, name, _colon, type]) => [name.text, type.text] %}
    | %kw_var %typeName %colon %typeName
      {% ([_var, name, _colon, type]) => [name.text, type.text] %}

Types -> %typeName
      {% ([a]) => a.text %}
    | Types %comma %typeName
      {% ([a, _comma, b]) => [b.text, a] %}

@include "type_decl_rules.g"

@include "func_def_rules.g"

@include "../facts/expr_rules.g"

Primary -> %typeName
      {% ([a]) => new exprs.Variable(a.text) %}
    | %typeName %lparen Exprs %rparen
      {% ([a, b, c, d]) => new exprs.Call(a.text, list_to_array(c, true)) %}
