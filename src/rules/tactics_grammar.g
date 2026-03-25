@{%
const exprs = require('../facts/exprs');
const ast = require('./tactics_ast');
const moo = require('moo');
const util = require('./grammar_util');
const lexer2 = util.makeRuleLexer(moo);
const list_to_array = util.list_to_array;
%}

@lexer lexer2

Tactic -> Expr %equal
      {% ([e, op]) => new ast.AlgebraTacticAst('=', e, []) %}
    | Expr %equal %since Refs
      {% ([e, op, _s, refs]) => new ast.AlgebraTacticAst('=', e, refs) %}
    | Expr %lessthan
      {% ([e, op]) => new ast.AlgebraTacticAst('<', e, []) %}
    | Expr %lessthan %since Refs
      {% ([e, op, _s, refs]) => new ast.AlgebraTacticAst('<', e, refs) %}
    | Expr %lessequal
      {% ([e, op]) => new ast.AlgebraTacticAst('<=', e, []) %}
    | Expr %lessequal %since Refs
      {% ([e, op, _s, refs]) => new ast.AlgebraTacticAst('<=', e, refs) %}
    | %subst %constant
      {% ([a, b]) => new ast.SubstituteTacticAst(parseInt(b.text), true) %}
    | %subst %constant %arrow Expr
      {% ([a, b, _arr, e]) => new ast.SubstituteTacticAst(parseInt(b.text), true, e) %}
    | %unsub %constant
      {% ([a, b]) => new ast.SubstituteTacticAst(parseInt(b.text), false) %}
    | %unsub %constant %arrow Expr
      {% ([a, b, _arr, e]) => new ast.SubstituteTacticAst(parseInt(b.text), false, e) %}
    | %defof %variable
      {% ([a, name]) => new ast.DefinitionTacticAst(name.text, true) %}
    | %defof %variable %since Refs
      {% ([a, name, _s, refs]) => new ast.DefinitionTacticAst(name.text, true, refs) %}
    | %defof %variable %arrow Expr
      {% ([a, name, _arr, e]) => new ast.DefinitionTacticAst(name.text, true, [], e) %}
    | %defof %variable %since Refs %arrow Expr
      {% ([a, name, _s, refs, _arr, e]) => new ast.DefinitionTacticAst(name.text, true, refs, e) %}
    | %undef %variable
      {% ([a, name]) => new ast.DefinitionTacticAst(name.text, false) %}
    | %undef %variable %since Refs
      {% ([a, name, _s, refs]) => new ast.DefinitionTacticAst(name.text, false, refs) %}
    | %undef %variable %arrow Expr
      {% ([a, name, _arr, e]) => new ast.DefinitionTacticAst(name.text, false, [], e) %}
    | %undef %variable %since Refs %arrow Expr
      {% ([a, name, _s, refs, _arr, e]) => new ast.DefinitionTacticAst(name.text, false, refs, e) %}

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
