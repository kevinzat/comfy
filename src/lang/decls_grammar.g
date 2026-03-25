@{%
const exprs = require('../facts/exprs');
const formula = require('../facts/formula');
const funcAst = require('./func_ast');
const typeAst = require('./type_ast');
const declsAst = require('./decls_ast');
const theoremAst = require('./theorem_ast');
const moo = require('moo');
const util = require('./grammar_util');
const lexer2 = util.makeLangLexer(moo);
const list_to_array = util.list_to_array;
const checkCaseNames = util.checkCaseNames;
const checkCtorReturnTypes = util.checkCtorReturnTypes;

function expandParams(groups) {
  const result = [];
  for (const group of groups) {
    for (const name of group.names) {
      result.push([name, group.type]);
    }
  }
  return result;
}
%}

@lexer lexer2

Decls -> Decl
      {% ([d]) => d %}
    | Decls Decl
      {% ([ds, d]) => new declsAst.DeclsAst(
          ds.types.concat(d.types), ds.functions.concat(d.functions),
          ds.theorems.concat(d.theorems)) %}

Decl -> TypeDecl
      {% ([d]) => new declsAst.DeclsAst([d], [], []) %}
    | FuncDef
      {% ([d]) => new declsAst.DeclsAst([], [d], []) %}
    | TheoremDecl
      {% ([d]) => new declsAst.DeclsAst([], [], [d]) %}

Types -> %typeName
      {% ([a]) => a.text %}
    | Types %comma %typeName
      {% ([a, _comma, b]) => [b.text, a] %}

TheoremDecl -> %kw_theorem %variable %lparen TheoremParams %rparen %pipe Formula
      {% ([_thm, name, _lp, params, _rp, _pipe, concl]) =>
          new theoremAst.TheoremAst(name.text, expandParams(params), undefined, concl) %}
    | %kw_theorem %variable %lparen TheoremParams %rparen %pipe Formula %fatArrow Formula
      {% ([_thm, name, _lp, params, _rp, _pipe, premise, _arrow, concl]) =>
          new theoremAst.TheoremAst(name.text, expandParams(params), premise, concl) %}

TheoremParams -> TheoremParamGroup
      {% ([g]) => [g] %}
    | TheoremParams %comma TheoremParamGroup
      {% ([gs, _comma, g]) => gs.concat([g]) %}

TheoremParamGroup -> TheoremNames %colon %typeName
      {% ([names, _colon, type]) => ({ names, type: type.text }) %}

TheoremNames -> %variable
      {% ([v]) => [v.text] %}
    | %typeName
      {% ([v]) => [v.text] %}
    | TheoremNames %comma %variable
      {% ([ns, _comma, v]) => ns.concat([v.text]) %}
    | TheoremNames %comma %typeName
      {% ([ns, _comma, v]) => ns.concat([v.text]) %}

Formula -> Expr %equal Expr
      {% ([left, _op, right]) => new formula.Formula(left, '=', right) %}
    | Expr %lessthan Expr
      {% ([left, _op, right]) => new formula.Formula(left, '<', right) %}
    | Expr %lessequal Expr
      {% ([left, _op, right]) => new formula.Formula(left, '<=', right) %}

@include "type_decl_rules.g"

@include "func_def_rules.g"

@include "../facts/expr_rules.g"

Primary -> %typeName
      {% ([a]) => new exprs.Variable(a.text) %}
    | %typeName %lparen Exprs %rparen
      {% ([a, b, c, d]) => new exprs.Call(a.text, list_to_array(c, true)) %}
