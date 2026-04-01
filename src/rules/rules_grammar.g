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
    | %equal Expr %since Refs
      {% ([op, e, _s, refs]) => new ast.AlgebraAst('=', e, refs) %}
    | %lessthan Expr
      {% ([op, e]) => new ast.AlgebraAst('<', e, []) %}
    | %lessthan Expr %since Refs
      {% ([op, e, _s, refs]) => new ast.AlgebraAst('<', e, refs) %}
    | %lessequal Expr
      {% ([op, e]) => new ast.AlgebraAst('<=', e, []) %}
    | %lessequal Expr %since Refs
      {% ([op, e, _s, refs]) => new ast.AlgebraAst('<=', e, refs) %}
    | %subst %constant
      {% ([a, b]) => new ast.SubstituteAst(parseInt(b.text), true) %}
    | %subst %constant %arrow Expr
      {% ([a, b, _arr, e]) => new ast.SubstituteAst(parseInt(b.text), true, e) %}
    | %unsub %constant
      {% ([a, b]) => new ast.SubstituteAst(parseInt(b.text), false) %}
    | %unsub %constant %arrow Expr
      {% ([a, b, _arr, e]) => new ast.SubstituteAst(parseInt(b.text), false, e) %}
    | %defof %variable
      {% ([a, name]) => new ast.DefinitionAst(name.text, true) %}
    | %defof %variable %since Refs
      {% ([a, name, _s, refs]) => new ast.DefinitionAst(name.text, true, refs) %}
    | %defof %variable %arrow Expr
      {% ([a, name, _arr, e]) => new ast.DefinitionAst(name.text, true, [], e) %}
    | %defof %variable %since Refs %arrow Expr
      {% ([a, name, _s, refs, _arr, e]) => new ast.DefinitionAst(name.text, true, refs, e) %}
    | %undef %variable
      {% ([a, name]) => new ast.DefinitionAst(name.text, false) %}
    | %undef %variable %since Refs
      {% ([a, name, _s, refs]) => new ast.DefinitionAst(name.text, false, refs) %}
    | %undef %variable %arrow Expr
      {% ([a, name, _arr, e]) => new ast.DefinitionAst(name.text, false, [], e) %}
    | %undef %variable %since Refs %arrow Expr
      {% ([a, name, _s, refs, _arr, e]) => new ast.DefinitionAst(name.text, false, refs, e) %}
    | %apply %variable
      {% ([a, name]) => new ast.ApplyAst(name.text, true) %}
    | %apply %variable %since Refs
      {% ([a, name, _s, refs]) => new ast.ApplyAst(name.text, true, refs) %}
    | %apply %variable %arrow Expr
      {% ([a, name, _arr, e]) => new ast.ApplyAst(name.text, true, [], e) %}
    | %apply %variable %since Refs %arrow Expr
      {% ([a, name, _s, refs, _arr, e]) => new ast.ApplyAst(name.text, true, refs, e) %}
    | %unapp %variable
      {% ([a, name]) => new ast.ApplyAst(name.text, false) %}
    | %unapp %variable %since Refs
      {% ([a, name, _s, refs]) => new ast.ApplyAst(name.text, false, refs) %}
    | %unapp %variable %arrow Expr
      {% ([a, name, _arr, e]) => new ast.ApplyAst(name.text, false, [], e) %}
    | %unapp %variable %since Refs %arrow Expr
      {% ([a, name, _s, refs, _arr, e]) => new ast.ApplyAst(name.text, false, refs, e) %}

Refs -> %constant
      {% ([c]) => [parseInt(c.text)] %}
    | Refs %constant
      {% ([refs, c]) => refs.concat([parseInt(c.text)]) %}

Expr -> Expr %plus NegTerm
      {% ([a, op, c]) => new exprs.Call(exprs.FUNC_ADD, [a, c], op.line, op.col) %}
    | Expr %minus NegTerm
      {% ([a, op, c]) => new exprs.Call(exprs.FUNC_SUBTRACT, [a, c], op.line, op.col) %}
    | NegTerm
      {% ([a]) => a %}

NegTerm -> %minus NegTerm
      {% ([op, b]) => new exprs.Call(exprs.FUNC_NEGATE, [b], op.line, op.col) %}
    | Term
      {% ([a]) => a %}

Term -> Term %times Factor
      {% ([a, op, c]) => new exprs.Call(exprs.FUNC_MULTIPLY, [a, c], op.line, op.col) %}
    | Factor
      {% ([a]) => a %}

Factor -> Primary %exp %constant
      {% ([a, op, c]) => new exprs.Call(exprs.FUNC_EXPONENTIATE, [a, new exprs.Constant(BigInt(c.text), c.line, c.col)], op.line, op.col) %}
    | Primary
      {% ([a]) => a %}

Primary -> %constant
      {% ([a]) => new exprs.Constant(BigInt(a.text), a.line, a.col) %}
    | %variable
      {% ([a]) => new exprs.Variable(a.text, a.line, a.col) %}
    | %variable %lparen Exprs %rparen
      {% ([a, b, c, d]) => new exprs.Call(a.text, list_to_array(c, true), a.line, a.col) %}
    | %lparen Expr %rparen
      {% ([a, b, c]) => b %}

Exprs -> Expr
      {% ([a]) => a %}
    | Exprs %comma Expr
      {% ([a, b, c]) => [c, a] %}
