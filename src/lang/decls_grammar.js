// Generated automatically by nearley
// Converted to ESM


import * as exprs from '../facts/exprs.ts';
import * as formula from '../facts/formula.ts';
import * as funcAst from './func_ast.ts';
import * as typeAst from './type_ast.ts';
import * as declsAst from './decls_ast.ts';
import * as theoremAst from './theorem_ast.ts';
import moo from 'moo';
import * as util from './grammar_util.js';
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
var grammar = {
    Lexer: lexer2,
    ParserRules: [
    {"name": "Decls", "symbols": ["Decl"], "postprocess": ([d]) => d},
    {"name": "Decls", "symbols": ["Decls", "Decl"], "postprocess":  ([ds, d]) => new declsAst.DeclsAst(
        ds.types.concat(d.types), ds.functions.concat(d.functions),
        ds.theorems.concat(d.theorems)) },
    {"name": "Decl", "symbols": ["TypeDecl"], "postprocess": ([d]) => new declsAst.DeclsAst([d], [], [])},
    {"name": "Decl", "symbols": ["FuncDef"], "postprocess": ([d]) => new declsAst.DeclsAst([], [d], [])},
    {"name": "Decl", "symbols": ["TheoremDecl"], "postprocess": ([d]) => new declsAst.DeclsAst([], [], [d])},
    {"name": "Types", "symbols": [(lexer2.has("typeName") ? {type: "typeName"} : typeName)], "postprocess": ([a]) => a.text},
    {"name": "Types", "symbols": ["Types", (lexer2.has("comma") ? {type: "comma"} : comma), (lexer2.has("typeName") ? {type: "typeName"} : typeName)], "postprocess": ([a, _comma, b]) => [b.text, a]},
    {"name": "TheoremDecl", "symbols": [(lexer2.has("kw_theorem") ? {type: "kw_theorem"} : kw_theorem), (lexer2.has("variable") ? {type: "variable"} : variable), (lexer2.has("lparen") ? {type: "lparen"} : lparen), "TheoremParams", (lexer2.has("rparen") ? {type: "rparen"} : rparen), (lexer2.has("pipe") ? {type: "pipe"} : pipe), "Formula"], "postprocess":  ([_thm, name, _lp, params, _rp, _pipe, concl]) =>
        new theoremAst.TheoremAst(name.text, expandParams(params), undefined, concl) },
    {"name": "TheoremDecl", "symbols": [(lexer2.has("kw_theorem") ? {type: "kw_theorem"} : kw_theorem), (lexer2.has("variable") ? {type: "variable"} : variable), (lexer2.has("lparen") ? {type: "lparen"} : lparen), "TheoremParams", (lexer2.has("rparen") ? {type: "rparen"} : rparen), (lexer2.has("pipe") ? {type: "pipe"} : pipe), "Formula", (lexer2.has("fatArrow") ? {type: "fatArrow"} : fatArrow), "Formula"], "postprocess":  ([_thm, name, _lp, params, _rp, _pipe, premise, _arrow, concl]) =>
        new theoremAst.TheoremAst(name.text, expandParams(params), premise, concl) },
    {"name": "TheoremParams", "symbols": ["TheoremParamGroup"], "postprocess": ([g]) => [g]},
    {"name": "TheoremParams", "symbols": ["TheoremParams", (lexer2.has("comma") ? {type: "comma"} : comma), "TheoremParamGroup"], "postprocess": ([gs, _comma, g]) => gs.concat([g])},
    {"name": "TheoremParamGroup", "symbols": ["TheoremNames", (lexer2.has("colon") ? {type: "colon"} : colon), (lexer2.has("typeName") ? {type: "typeName"} : typeName)], "postprocess": ([names, _colon, type]) => ({ names, type: type.text })},
    {"name": "TheoremNames", "symbols": [(lexer2.has("variable") ? {type: "variable"} : variable)], "postprocess": ([v]) => [v.text]},
    {"name": "TheoremNames", "symbols": [(lexer2.has("typeName") ? {type: "typeName"} : typeName)], "postprocess": ([v]) => [v.text]},
    {"name": "TheoremNames", "symbols": ["TheoremNames", (lexer2.has("comma") ? {type: "comma"} : comma), (lexer2.has("variable") ? {type: "variable"} : variable)], "postprocess": ([ns, _comma, v]) => ns.concat([v.text])},
    {"name": "TheoremNames", "symbols": ["TheoremNames", (lexer2.has("comma") ? {type: "comma"} : comma), (lexer2.has("typeName") ? {type: "typeName"} : typeName)], "postprocess": ([ns, _comma, v]) => ns.concat([v.text])},
    {"name": "Formula", "symbols": ["Expr", (lexer2.has("equal") ? {type: "equal"} : equal), "Expr"], "postprocess": ([left, _op, right]) => new formula.Formula(left, '=', right)},
    {"name": "Formula", "symbols": ["Expr", (lexer2.has("lessthan") ? {type: "lessthan"} : lessthan), "Expr"], "postprocess": ([left, _op, right]) => new formula.Formula(left, '<', right)},
    {"name": "Formula", "symbols": ["Expr", (lexer2.has("lessequal") ? {type: "lessequal"} : lessequal), "Expr"], "postprocess": ([left, _op, right]) => new formula.Formula(left, '<=', right)},
    {"name": "TypeDecl", "symbols": [(lexer2.has("type") ? {type: "type"} : type), (lexer2.has("typeName") ? {type: "typeName"} : typeName), "Ctors"], "postprocess": ([_type, name, ctors]) => new typeAst.TypeDeclAst(name.text, checkCtorReturnTypes(name, ctors))},
    {"name": "Ctors", "symbols": ["Ctor"], "postprocess": ([c]) => [c]},
    {"name": "Ctors", "symbols": ["Ctors", "Ctor"], "postprocess": ([cs, c]) => cs.concat([c])},
    {"name": "Ctor", "symbols": [(lexer2.has("pipe") ? {type: "pipe"} : pipe), (lexer2.has("variable") ? {type: "variable"} : variable), (lexer2.has("colon") ? {type: "colon"} : colon), (lexer2.has("typeName") ? {type: "typeName"} : typeName)], "postprocess": ([_pipe, name, _colon, ret]) => ({retName: ret.text, retToken: ret, ast: new typeAst.ConstructorAst(name.text, [], ret.text)})},
    {"name": "Ctor", "symbols": [(lexer2.has("pipe") ? {type: "pipe"} : pipe), (lexer2.has("variable") ? {type: "variable"} : variable), (lexer2.has("colon") ? {type: "colon"} : colon), (lexer2.has("lparen") ? {type: "lparen"} : lparen), "Types", (lexer2.has("rparen") ? {type: "rparen"} : rparen), (lexer2.has("arrow") ? {type: "arrow"} : arrow), (lexer2.has("typeName") ? {type: "typeName"} : typeName)], "postprocess": ([_pipe, name, _colon, _lp, types, _rp, _arrow, ret]) => ({retName: ret.text, retToken: ret, ast: new typeAst.ConstructorAst(name.text, list_to_array(types, true), ret.text)})},
    {"name": "FuncDef", "symbols": [(lexer2.has("def") ? {type: "def"} : def), (lexer2.has("variable") ? {type: "variable"} : variable), (lexer2.has("colon") ? {type: "colon"} : colon), "TypeSig", "Cases"], "postprocess": ([_def, name, _colon, type, cases]) => new funcAst.FuncAst(name.text, type, checkCaseNames(name, cases))},
    {"name": "TypeSig", "symbols": [(lexer2.has("lparen") ? {type: "lparen"} : lparen), "Types", (lexer2.has("rparen") ? {type: "rparen"} : rparen), (lexer2.has("arrow") ? {type: "arrow"} : arrow), (lexer2.has("typeName") ? {type: "typeName"} : typeName)], "postprocess": ([_lp, types, _rp, _arrow, ret]) => new funcAst.TypeAst(list_to_array(types, true), ret.text)},
    {"name": "Cases", "symbols": ["Case"], "postprocess": ([c]) => [c]},
    {"name": "Cases", "symbols": ["Cases", "Case"], "postprocess": ([cs, c]) => cs.concat([c])},
    {"name": "Case", "symbols": [(lexer2.has("pipe") ? {type: "pipe"} : pipe), (lexer2.has("variable") ? {type: "variable"} : variable), (lexer2.has("lparen") ? {type: "lparen"} : lparen), "Params", (lexer2.has("rparen") ? {type: "rparen"} : rparen), (lexer2.has("fatArrow") ? {type: "fatArrow"} : fatArrow), "Body"], "postprocess": ([_pipe, name, _lp, params, _rp, _arrow, body]) => ({name: name.text, token: name, ast: new funcAst.CaseAst(list_to_array(params, true), body)})},
    {"name": "Body", "symbols": ["Expr"], "postprocess": ([e]) => new funcAst.ExprBody(e)},
    {"name": "Body", "symbols": [(lexer2.has("kw_if") ? {type: "kw_if"} : kw_if), "Condition", (lexer2.has("kw_then") ? {type: "kw_then"} : kw_then), "Expr", (lexer2.has("kw_else") ? {type: "kw_else"} : kw_else), "Expr"], "postprocess": ([_if, cond, _then, thenBody, _else, elseBody]) => new funcAst.IfElseBody(cond, thenBody, elseBody)},
    {"name": "Condition", "symbols": ["Expr", (lexer2.has("lessthan") ? {type: "lessthan"} : lessthan), "Expr"], "postprocess": ([left, _op, right]) => new formula.Formula(left, '<', right)},
    {"name": "Condition", "symbols": ["Expr", (lexer2.has("lessequal") ? {type: "lessequal"} : lessequal), "Expr"], "postprocess": ([left, _op, right]) => new formula.Formula(left, '<=', right)},
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
