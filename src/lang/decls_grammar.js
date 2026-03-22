// Generated automatically by nearley
// Converted to ESM


import * as exprs from '../facts/exprs.ts';
import * as funcAst from './func_ast.ts';
import * as typeAst from './type_ast.ts';
import * as declsAst from './decls_ast.ts';
import moo from 'moo';
import * as util from './grammar_util.js';
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
var grammar = {
    Lexer: lexer2,
    ParserRules: [
    {"name": "Decls", "symbols": ["Decl"], "postprocess": ([d]) => d},
    {"name": "Decls", "symbols": ["Decls", "Decl"], "postprocess":  ([ds, d]) => new declsAst.DeclsAst(
        ds.types.concat(d.types), ds.functions.concat(d.functions),
        ds.variables.concat(d.variables)) },
    {"name": "Decl", "symbols": ["TypeDecl"], "postprocess": ([d]) => new declsAst.DeclsAst([d], [], [])},
    {"name": "Decl", "symbols": ["FuncDef"], "postprocess": ([d]) => new declsAst.DeclsAst([], [d], [])},
    {"name": "Decl", "symbols": ["VarDecl"], "postprocess": ([d]) => new declsAst.DeclsAst([], [], [d])},
    {"name": "VarDecl", "symbols": [(lexer2.has("kw_var") ? {type: "kw_var"} : kw_var), (lexer2.has("variable") ? {type: "variable"} : variable), (lexer2.has("colon") ? {type: "colon"} : colon), (lexer2.has("typeName") ? {type: "typeName"} : typeName)], "postprocess": ([_var, name, _colon, type]) => [name.text, type.text]},
    {"name": "VarDecl", "symbols": [(lexer2.has("kw_var") ? {type: "kw_var"} : kw_var), (lexer2.has("typeName") ? {type: "typeName"} : typeName), (lexer2.has("colon") ? {type: "colon"} : colon), (lexer2.has("typeName") ? {type: "typeName"} : typeName)], "postprocess": ([_var, name, _colon, type]) => [name.text, type.text]},
    {"name": "Types", "symbols": [(lexer2.has("typeName") ? {type: "typeName"} : typeName)], "postprocess": ([a]) => a.text},
    {"name": "Types", "symbols": ["Types", (lexer2.has("comma") ? {type: "comma"} : comma), (lexer2.has("typeName") ? {type: "typeName"} : typeName)], "postprocess": ([a, _comma, b]) => [b.text, a]},
    {"name": "TypeDecl", "symbols": [(lexer2.has("type") ? {type: "type"} : type), (lexer2.has("typeName") ? {type: "typeName"} : typeName), "Ctors"], "postprocess": ([_type, name, ctors]) => new typeAst.TypeDeclAst(name.text, checkCtorReturnTypes(name, ctors))},
    {"name": "Ctors", "symbols": ["Ctor"], "postprocess": ([c]) => [c]},
    {"name": "Ctors", "symbols": ["Ctors", "Ctor"], "postprocess": ([cs, c]) => cs.concat([c])},
    {"name": "Ctor", "symbols": [(lexer2.has("pipe") ? {type: "pipe"} : pipe), (lexer2.has("variable") ? {type: "variable"} : variable), (lexer2.has("colon") ? {type: "colon"} : colon), (lexer2.has("typeName") ? {type: "typeName"} : typeName)], "postprocess": ([_pipe, name, _colon, ret]) => ({retName: ret.text, retToken: ret, ast: new typeAst.ConstructorAst(name.text, [], ret.text)})},
    {"name": "Ctor", "symbols": [(lexer2.has("pipe") ? {type: "pipe"} : pipe), (lexer2.has("variable") ? {type: "variable"} : variable), (lexer2.has("colon") ? {type: "colon"} : colon), (lexer2.has("lparen") ? {type: "lparen"} : lparen), "Types", (lexer2.has("rparen") ? {type: "rparen"} : rparen), (lexer2.has("arrow") ? {type: "arrow"} : arrow), (lexer2.has("typeName") ? {type: "typeName"} : typeName)], "postprocess": ([_pipe, name, _colon, _lp, types, _rp, _arrow, ret]) => ({retName: ret.text, retToken: ret, ast: new typeAst.ConstructorAst(name.text, list_to_array(types, true), ret.text)})},
    {"name": "FuncDef", "symbols": [(lexer2.has("def") ? {type: "def"} : def), (lexer2.has("variable") ? {type: "variable"} : variable), (lexer2.has("colon") ? {type: "colon"} : colon), "TypeSig", "Cases"], "postprocess": ([_def, name, _colon, type, cases]) => new funcAst.FuncAst(name.text, type, checkCaseNames(name, cases))},
    {"name": "TypeSig", "symbols": [(lexer2.has("lparen") ? {type: "lparen"} : lparen), "Types", (lexer2.has("rparen") ? {type: "rparen"} : rparen), (lexer2.has("arrow") ? {type: "arrow"} : arrow), (lexer2.has("typeName") ? {type: "typeName"} : typeName)], "postprocess": ([_lp, types, _rp, _arrow, ret]) => new funcAst.TypeAst(list_to_array(types, true), ret.text)},
    {"name": "Cases", "symbols": ["Case"], "postprocess": ([c]) => [c]},
    {"name": "Cases", "symbols": ["Cases", "Case"], "postprocess": ([cs, c]) => cs.concat([c])},
    {"name": "Case", "symbols": [(lexer2.has("pipe") ? {type: "pipe"} : pipe), (lexer2.has("variable") ? {type: "variable"} : variable), (lexer2.has("lparen") ? {type: "lparen"} : lparen), "Params", (lexer2.has("rparen") ? {type: "rparen"} : rparen), (lexer2.has("fatArrow") ? {type: "fatArrow"} : fatArrow), "Expr"], "postprocess": ([_pipe, name, _lp, params, _rp, _arrow, body]) => ({name: name.text, token: name, ast: new funcAst.CaseAst(list_to_array(params, true), body)})},
    {"name": "Params", "symbols": ["Param"], "postprocess": ([a]) => a},
    {"name": "Params", "symbols": ["Params", (lexer2.has("comma") ? {type: "comma"} : comma), "Param"], "postprocess": ([a, _comma, b]) => [b, a]},
    {"name": "Param", "symbols": [(lexer2.has("variable") ? {type: "variable"} : variable)], "postprocess": ([a]) => new funcAst.ParamVar(a.text)},
    {"name": "Param", "symbols": [(lexer2.has("typeName") ? {type: "typeName"} : typeName)], "postprocess": ([a]) => new funcAst.ParamVar(a.text)},
    {"name": "Param", "symbols": [(lexer2.has("variable") ? {type: "variable"} : variable), (lexer2.has("lparen") ? {type: "lparen"} : lparen), "Params", (lexer2.has("rparen") ? {type: "rparen"} : rparen)], "postprocess": ([a, _lp, params, _rp]) => new funcAst.ParamConstructor(a.text, list_to_array(params, true))},
    {"name": "Expr", "symbols": ["Expr", (lexer2.has("plus") ? {type: "plus"} : plus), "NegTerm"], "postprocess": ([a, b, c]) => new exprs.Call(exprs.FUNC_ADD, [a, c])},
    {"name": "Expr", "symbols": ["Expr", (lexer2.has("minus") ? {type: "minus"} : minus), "NegTerm"], "postprocess": ([a, b, c]) => new exprs.Call(exprs.FUNC_SUBTRACT, [a, c])},
    {"name": "Expr", "symbols": ["NegTerm"], "postprocess": ([a]) => a},
    {"name": "NegTerm", "symbols": [(lexer2.has("minus") ? {type: "minus"} : minus), "NegTerm"], "postprocess": ([a, b]) => new exprs.Call(exprs.FUNC_NEGATE, [b])},
    {"name": "NegTerm", "symbols": ["Term"], "postprocess": ([a]) => a},
    {"name": "Term", "symbols": ["Term", (lexer2.has("times") ? {type: "times"} : times), "Factor"], "postprocess": ([a, b, c]) => new exprs.Call(exprs.FUNC_MULTIPLY, [a, c])},
    {"name": "Term", "symbols": ["Factor"], "postprocess": ([a]) => a},
    {"name": "Factor", "symbols": ["Primary", (lexer2.has("exp") ? {type: "exp"} : exp), (lexer2.has("constant") ? {type: "constant"} : constant)], "postprocess": ([a, b, c]) => new exprs.Call(exprs.FUNC_EXPONENTIATE, [a, new exprs.Constant(BigInt(c.text))])},
    {"name": "Factor", "symbols": ["Primary"], "postprocess": ([a]) => a},
    {"name": "Primary", "symbols": [(lexer2.has("constant") ? {type: "constant"} : constant)], "postprocess": ([a]) => new exprs.Constant(BigInt(a.text))},
    {"name": "Primary", "symbols": [(lexer2.has("variable") ? {type: "variable"} : variable)], "postprocess": ([a]) => new exprs.Variable(a.text)},
    {"name": "Primary", "symbols": [(lexer2.has("variable") ? {type: "variable"} : variable), (lexer2.has("lparen") ? {type: "lparen"} : lparen), "Exprs", (lexer2.has("rparen") ? {type: "rparen"} : rparen)], "postprocess": ([a, b, c, d]) => new exprs.Call(a.text, list_to_array(c, true))},
    {"name": "Primary", "symbols": [(lexer2.has("lparen") ? {type: "lparen"} : lparen), "Expr", (lexer2.has("rparen") ? {type: "rparen"} : rparen)], "postprocess": ([a, b, c]) => b},
    {"name": "Exprs", "symbols": ["Expr"], "postprocess": ([a]) => a},
    {"name": "Exprs", "symbols": ["Exprs", (lexer2.has("comma") ? {type: "comma"} : comma), "Expr"], "postprocess": ([a, b, c]) => [c, a]},
    {"name": "Primary", "symbols": [(lexer2.has("typeName") ? {type: "typeName"} : typeName)], "postprocess": ([a]) => new exprs.Variable(a.text)},
    {"name": "Primary", "symbols": [(lexer2.has("typeName") ? {type: "typeName"} : typeName), (lexer2.has("lparen") ? {type: "lparen"} : lparen), "Exprs", (lexer2.has("rparen") ? {type: "rparen"} : rparen)], "postprocess": ([a, b, c, d]) => new exprs.Call(a.text, list_to_array(c, true))}
]
  , ParserStart: "Decls"
};

export default grammar;
