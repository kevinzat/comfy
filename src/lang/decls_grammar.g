@{%
const exprs = require('../facts/exprs');
const formula = require('../facts/formula');
const prop = require('../facts/prop');
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

TheoremDecl -> %kw_theorem %variable TheoremParamGroups %pipe Prop
      {% ([thm, name, params, _pipe, concl]) =>
          new theoremAst.TheoremAst(name.text, expandParams(params), [], concl, thm.line) %}
    | %kw_theorem %variable TheoremParamGroups %pipe Premises %fatArrow Prop
      {% ([thm, name, params, _pipe, premises, _arrow, concl]) =>
          new theoremAst.TheoremAst(name.text, expandParams(params), premises, concl, thm.line) %}

Premises -> Prop
      {% ([p]) => [p] %}
    | Premises %comma Prop
      {% ([ps, _comma, p]) => ps.concat([p]) %}

TheoremParamGroups -> TheoremParamGroup
      {% ([g]) => [g] %}
    | TheoremParamGroups TheoremParamGroup
      {% ([gs, g]) => gs.concat([g]) %}

TheoremParamGroup -> %lparen TheoremNames %colon %typeName %rparen
      {% ([_lp, names, _colon, type, _rp]) => ({ names, type: type.text }) %}

TheoremNames -> %variable
      {% ([v]) => [v.text] %}
    | %typeName
      {% ([v]) => [v.text] %}
    | TheoremNames %comma %variable
      {% ([ns, _comma, v]) => ns.concat([v.text]) %}
    | TheoremNames %comma %typeName
      {% ([ns, _comma, v]) => ns.concat([v.text]) %}

@include "type_decl_rules.g"

@include "func_def_rules.g"

@include "../facts/expr_rules.g"

@include "../facts/prop_rules.g"

Primary -> %typeName
      {% ([a]) => new exprs.Variable(a.text, a.line, a.col) %}
    | %typeName %lparen Exprs %rparen
      {% ([a, b, c, d]) => new exprs.Call(a.text, list_to_array(c, true), a.line, a.col) %}
