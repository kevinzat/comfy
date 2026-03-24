@{%
const exprs = require('../facts/exprs');
const ast = require('./rules_ast');
const moo = require('moo');
const util = require('./grammar_util');
const lexer2 = util.makeRuleLexer(moo);
const list_to_array = util.list_to_array;
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
    | %defof %variable Refs
      {% ([a, name, refs]) => new ast.DefinitionAst(name.text, true, refs) %}
    | %defof %variable %lparen Expr %rparen
      {% ([a, name, _lp, e, _rp]) => new ast.DefinitionAst(name.text, true, [], e) %}
    | %defof %variable Refs %lparen Expr %rparen
      {% ([a, name, refs, _lp, e, _rp]) => new ast.DefinitionAst(name.text, true, refs, e) %}
    | %undef %variable
      {% ([a, name]) => new ast.DefinitionAst(name.text, false) %}
    | %undef %variable Refs
      {% ([a, name, refs]) => new ast.DefinitionAst(name.text, false, refs) %}
    | %undef %variable %lparen Expr %rparen
      {% ([a, name, _lp, e, _rp]) => new ast.DefinitionAst(name.text, false, [], e) %}
    | %undef %variable Refs %lparen Expr %rparen
      {% ([a, name, refs, _lp, e, _rp]) => new ast.DefinitionAst(name.text, false, refs, e) %}

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
