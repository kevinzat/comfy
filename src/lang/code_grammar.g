@{%
const exprs = require('../facts/exprs');
const codeAst = require('./code_ast');
const moo = require('moo');
const util = require('./grammar_util');
const clexer = util.makeCodeLexer(moo);
const list_to_array = util.list_to_array;
%}

@lexer clexer

Main -> FuncDef {% ([a]) => a %}

FuncDef -> %typeName %ident %lparen Params %rparen RequiresClause EnsuresClause %lbrace Stmts %rbrace
  {% ([ret, name, _lp, params, _rp, requires, ensures, _lb, stmts, _rb]) =>
      new codeAst.FuncDef(ret.text, name.text, params, stmts, requires, ensures, ret.line, ret.col) %}

RequiresClause -> null {% () => [] %}
               | %kw_requires PropList {% ([_kw, cs]) => cs %}

EnsuresClause -> null {% () => [] %}
              | %kw_ensures PropList {% ([_kw, cs]) => cs %}

PropList -> Prop {% ([c]) => [c] %}
          | PropList %comma Prop {% ([cs, _c, c]) => [...cs, c] %}

Params -> null {% () => [] %}
        | ParamList {% ([a]) => a %}

ParamList -> Param {% ([p]) => [p] %}
           | ParamList %comma Param {% ([ps, _c, p]) => [...ps, p] %}

Param -> %typeName %ident
  {% ([t, n]) => new codeAst.Param(t.text, n.text, t.line, t.col) %}

Stmts -> null {% () => [] %}
       | Stmts Stmt {% ([ss, s]) => [...ss, s] %}

Stmt -> %typeName %ident %equal Expr %semi
  {% ([t, n, _eq, e, _s]) => new codeAst.DeclStmt(t.text, n.text, e, t.line, t.col) %}
      | %ident %equal Expr %semi
  {% ([n, _eq, e, _s]) => new codeAst.AssignStmt(n.text, e, n.line, n.col) %}
      | %kw_while %lparen Prop %rparen %kw_invariant PropList %lbrace Stmts %rbrace
  {% ([kw, _lp, cond, _rp, _ki, inv, _lb, stmts, _rb]) => new codeAst.WhileStmt(cond, inv, stmts, kw.line, kw.col) %}
      | %kw_if %lparen Prop %rparen %lbrace Stmts %rbrace %kw_else %lbrace Stmts %rbrace
  {% ([kw, _lp, cond, _rp, _lb, then_, _rb, _e, _lb2, else_, _rb2]) =>
      new codeAst.IfStmt(cond, then_, else_, kw.line, kw.col) %}
      | %kw_pass %semi
  {% ([kw, _s]) => new codeAst.PassStmt(kw.line, kw.col) %}
      | %kw_return Expr %semi
  {% ([kw, e, _s]) => new codeAst.ReturnStmt(e, kw.line, kw.col) %}

Prop -> Prop %kw_or PropAnd
  {% ([l, op, r]) => new codeAst.OrPropAst(l, r, op.line, op.col) %}
      | PropAnd {% ([p]) => p %}

PropAnd -> PropAnd %kw_and PropNot
  {% ([l, op, r]) => new codeAst.AndPropAst(l, r, op.line, op.col) %}
         | PropNot {% ([p]) => p %}

PropNot -> %kw_not PropNot
  {% ([op, p]) => new codeAst.NotPropAst(p, op.line, op.col) %}
         | %lparen Prop %rparen {% ([_lp, p, _rp]) => p %}
         | AtomicProp {% ([p]) => p %}

AtomicProp -> Expr %equalequal Expr
  {% ([l, op, r]) => new codeAst.CondAst(l, '==', r, op.line, op.col) %}
            | Expr %notequal Expr
  {% ([l, op, r]) => new codeAst.CondAst(l, '!=', r, op.line, op.col) %}
            | Expr %lessequal Expr
  {% ([l, op, r]) => new codeAst.CondAst(l, '<=', r, op.line, op.col) %}
            | Expr %greaterequal Expr
  {% ([l, op, r]) => new codeAst.CondAst(l, '>=', r, op.line, op.col) %}
            | Expr %lessthan Expr
  {% ([l, op, r]) => new codeAst.CondAst(l, '<', r, op.line, op.col) %}
            | Expr %greaterthan Expr
  {% ([l, op, r]) => new codeAst.CondAst(l, '>', r, op.line, op.col) %}

Expr -> Expr %plus NegTerm
  {% ([a, op, c]) => new exprs.Call(exprs.FUNC_ADD, [a, c], op.line, op.col) %}
      | Expr %minus NegTerm
  {% ([a, op, c]) => new exprs.Call(exprs.FUNC_SUBTRACT, [a, c], op.line, op.col) %}
      | NegTerm {% ([a]) => a %}

NegTerm -> %minus NegTerm
  {% ([op, b]) => new exprs.Call(exprs.FUNC_NEGATE, [b], op.line, op.col) %}
         | Term {% ([a]) => a %}

Term -> Term %times Factor
  {% ([a, op, c]) => new exprs.Call(exprs.FUNC_MULTIPLY, [a, c], op.line, op.col) %}
      | Factor {% ([a]) => a %}

Factor -> Primary %exp %constant
  {% ([a, op, c]) => new exprs.Call(exprs.FUNC_EXPONENTIATE, [a, new exprs.Constant(BigInt(c.text), c.line, c.col)], op.line, op.col) %}
        | Primary {% ([a]) => a %}

Primary -> %constant
  {% ([a]) => new exprs.Constant(BigInt(a.text), a.line, a.col) %}
         | %ident %lparen Exprs %rparen
  {% ([a, _lp, c, _rp]) => new exprs.Call(a.text, list_to_array(c, true), a.line, a.col) %}
         | %ident
  {% ([a]) => new exprs.Variable(a.text, a.line, a.col) %}
         | %lparen Expr %rparen
  {% ([_lp, b, _rp]) => b %}

Exprs -> Expr {% ([a]) => a %}
       | Exprs %comma Expr {% ([a, _c, c]) => [c, a] %}
