// Generated automatically by nearley
// Converted to ESM


import * as exprs from '../facts/exprs.ts';
import * as codeAst from './code_ast.ts';
import moo from 'moo';
import * as util from './grammar_util.js';
const clexer = util.makeCodeLexer(moo);
const list_to_array = util.list_to_array;
var grammar = {
    Lexer: clexer,
    ParserRules: [
    {"name": "Main", "symbols": ["FuncDef"], "postprocess": ([a]) => a},
    {"name": "FuncDef", "symbols": [(clexer.has("typeName") ? {type: "typeName"} : typeName), (clexer.has("ident") ? {type: "ident"} : ident), (clexer.has("lparen") ? {type: "lparen"} : lparen), "Params", (clexer.has("rparen") ? {type: "rparen"} : rparen), "RequiresClause", "EnsuresClause", (clexer.has("lbrace") ? {type: "lbrace"} : lbrace), "Stmts", (clexer.has("rbrace") ? {type: "rbrace"} : rbrace)], "postprocess":  ([ret, name, _lp, params, _rp, requires, ensures, _lb, stmts, _rb]) =>
        new codeAst.FuncDef(ret.text, name.text, params, stmts, requires, ensures, ret.line, ret.col) },
    {"name": "RequiresClause", "symbols": [], "postprocess": () => []},
    {"name": "RequiresClause", "symbols": [(clexer.has("kw_requires") ? {type: "kw_requires"} : kw_requires), "CondList"], "postprocess": ([_kw, cs]) => cs},
    {"name": "EnsuresClause", "symbols": [], "postprocess": () => []},
    {"name": "EnsuresClause", "symbols": [(clexer.has("kw_ensures") ? {type: "kw_ensures"} : kw_ensures), "CondList"], "postprocess": ([_kw, cs]) => cs},
    {"name": "CondList", "symbols": ["Cond"], "postprocess": ([c]) => [c]},
    {"name": "CondList", "symbols": ["CondList", (clexer.has("comma") ? {type: "comma"} : comma), "Cond"], "postprocess": ([cs, _c, c]) => [...cs, c]},
    {"name": "Params", "symbols": [], "postprocess": () => []},
    {"name": "Params", "symbols": ["ParamList"], "postprocess": ([a]) => a},
    {"name": "ParamList", "symbols": ["Param"], "postprocess": ([p]) => [p]},
    {"name": "ParamList", "symbols": ["ParamList", (clexer.has("comma") ? {type: "comma"} : comma), "Param"], "postprocess": ([ps, _c, p]) => [...ps, p]},
    {"name": "Param", "symbols": [(clexer.has("typeName") ? {type: "typeName"} : typeName), (clexer.has("ident") ? {type: "ident"} : ident)], "postprocess": ([t, n]) => new codeAst.Param(t.text, n.text, t.line, t.col)},
    {"name": "Stmts", "symbols": [], "postprocess": () => []},
    {"name": "Stmts", "symbols": ["Stmts", "Stmt"], "postprocess": ([ss, s]) => [...ss, s]},
    {"name": "Stmt", "symbols": [(clexer.has("typeName") ? {type: "typeName"} : typeName), (clexer.has("ident") ? {type: "ident"} : ident), (clexer.has("equal") ? {type: "equal"} : equal), "Expr", (clexer.has("semi") ? {type: "semi"} : semi)], "postprocess": ([t, n, _eq, e, _s]) => new codeAst.DeclStmt(t.text, n.text, e, t.line, t.col)},
    {"name": "Stmt", "symbols": [(clexer.has("ident") ? {type: "ident"} : ident), (clexer.has("equal") ? {type: "equal"} : equal), "Expr", (clexer.has("semi") ? {type: "semi"} : semi)], "postprocess": ([n, _eq, e, _s]) => new codeAst.AssignStmt(n.text, e, n.line, n.col)},
    {"name": "Stmt", "symbols": [(clexer.has("kw_while") ? {type: "kw_while"} : kw_while), (clexer.has("lparen") ? {type: "lparen"} : lparen), "Cond", (clexer.has("rparen") ? {type: "rparen"} : rparen), (clexer.has("lbrace") ? {type: "lbrace"} : lbrace), "Stmts", (clexer.has("rbrace") ? {type: "rbrace"} : rbrace)], "postprocess": ([kw, _lp, cond, _rp, _lb, stmts, _rb]) => new codeAst.WhileStmt(cond, stmts, kw.line, kw.col)},
    {"name": "Stmt", "symbols": [(clexer.has("kw_if") ? {type: "kw_if"} : kw_if), (clexer.has("lparen") ? {type: "lparen"} : lparen), "Cond", (clexer.has("rparen") ? {type: "rparen"} : rparen), (clexer.has("lbrace") ? {type: "lbrace"} : lbrace), "Stmts", (clexer.has("rbrace") ? {type: "rbrace"} : rbrace), (clexer.has("kw_else") ? {type: "kw_else"} : kw_else), (clexer.has("lbrace") ? {type: "lbrace"} : lbrace), "Stmts", (clexer.has("rbrace") ? {type: "rbrace"} : rbrace)], "postprocess":  ([kw, _lp, cond, _rp, _lb, then_, _rb, _e, _lb2, else_, _rb2]) =>
        new codeAst.IfStmt(cond, then_, else_, kw.line, kw.col) },
    {"name": "Stmt", "symbols": [(clexer.has("kw_pass") ? {type: "kw_pass"} : kw_pass), (clexer.has("semi") ? {type: "semi"} : semi)], "postprocess": ([kw, _s]) => new codeAst.PassStmt(kw.line, kw.col)},
    {"name": "Stmt", "symbols": [(clexer.has("kw_return") ? {type: "kw_return"} : kw_return), "Expr", (clexer.has("semi") ? {type: "semi"} : semi)], "postprocess": ([kw, e, _s]) => new codeAst.ReturnStmt(e, kw.line, kw.col)},
    {"name": "Cond", "symbols": ["Expr", (clexer.has("equalequal") ? {type: "equalequal"} : equalequal), "Expr"], "postprocess": ([l, op, r]) => new codeAst.Cond(l, '==', r, op.line, op.col)},
    {"name": "Cond", "symbols": ["Expr", (clexer.has("notequal") ? {type: "notequal"} : notequal), "Expr"], "postprocess": ([l, op, r]) => new codeAst.Cond(l, '!=', r, op.line, op.col)},
    {"name": "Cond", "symbols": ["Expr", (clexer.has("lessequal") ? {type: "lessequal"} : lessequal), "Expr"], "postprocess": ([l, op, r]) => new codeAst.Cond(l, '<=', r, op.line, op.col)},
    {"name": "Cond", "symbols": ["Expr", (clexer.has("greaterequal") ? {type: "greaterequal"} : greaterequal), "Expr"], "postprocess": ([l, op, r]) => new codeAst.Cond(l, '>=', r, op.line, op.col)},
    {"name": "Cond", "symbols": ["Expr", (clexer.has("lessthan") ? {type: "lessthan"} : lessthan), "Expr"], "postprocess": ([l, op, r]) => new codeAst.Cond(l, '<', r, op.line, op.col)},
    {"name": "Cond", "symbols": ["Expr", (clexer.has("greaterthan") ? {type: "greaterthan"} : greaterthan), "Expr"], "postprocess": ([l, op, r]) => new codeAst.Cond(l, '>', r, op.line, op.col)},
    {"name": "Expr", "symbols": ["Expr", (clexer.has("plus") ? {type: "plus"} : plus), "NegTerm"], "postprocess": ([a, op, c]) => new exprs.Call(exprs.FUNC_ADD, [a, c], op.line, op.col)},
    {"name": "Expr", "symbols": ["Expr", (clexer.has("minus") ? {type: "minus"} : minus), "NegTerm"], "postprocess": ([a, op, c]) => new exprs.Call(exprs.FUNC_SUBTRACT, [a, c], op.line, op.col)},
    {"name": "Expr", "symbols": ["NegTerm"], "postprocess": ([a]) => a},
    {"name": "NegTerm", "symbols": [(clexer.has("minus") ? {type: "minus"} : minus), "NegTerm"], "postprocess": ([op, b]) => new exprs.Call(exprs.FUNC_NEGATE, [b], op.line, op.col)},
    {"name": "NegTerm", "symbols": ["Term"], "postprocess": ([a]) => a},
    {"name": "Term", "symbols": ["Term", (clexer.has("times") ? {type: "times"} : times), "Factor"], "postprocess": ([a, op, c]) => new exprs.Call(exprs.FUNC_MULTIPLY, [a, c], op.line, op.col)},
    {"name": "Term", "symbols": ["Factor"], "postprocess": ([a]) => a},
    {"name": "Factor", "symbols": ["Primary", (clexer.has("exp") ? {type: "exp"} : exp), (clexer.has("constant") ? {type: "constant"} : constant)], "postprocess": ([a, op, c]) => new exprs.Call(exprs.FUNC_EXPONENTIATE, [a, new exprs.Constant(BigInt(c.text), c.line, c.col)], op.line, op.col)},
    {"name": "Factor", "symbols": ["Primary"], "postprocess": ([a]) => a},
    {"name": "Primary", "symbols": [(clexer.has("constant") ? {type: "constant"} : constant)], "postprocess": ([a]) => new exprs.Constant(BigInt(a.text), a.line, a.col)},
    {"name": "Primary", "symbols": [(clexer.has("ident") ? {type: "ident"} : ident), (clexer.has("lparen") ? {type: "lparen"} : lparen), "Exprs", (clexer.has("rparen") ? {type: "rparen"} : rparen)], "postprocess": ([a, _lp, c, _rp]) => new exprs.Call(a.text, list_to_array(c, true), a.line, a.col)},
    {"name": "Primary", "symbols": [(clexer.has("ident") ? {type: "ident"} : ident)], "postprocess": ([a]) => new exprs.Variable(a.text, a.line, a.col)},
    {"name": "Primary", "symbols": [(clexer.has("lparen") ? {type: "lparen"} : lparen), "Expr", (clexer.has("rparen") ? {type: "rparen"} : rparen)], "postprocess": ([_lp, b, _rp]) => b},
    {"name": "Exprs", "symbols": ["Expr"], "postprocess": ([a]) => a},
    {"name": "Exprs", "symbols": ["Exprs", (clexer.has("comma") ? {type: "comma"} : comma), "Expr"], "postprocess": ([a, _c, c]) => [c, a]}
]
  , ParserStart: "Main"
};

export default grammar;
