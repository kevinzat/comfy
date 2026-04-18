// Generated automatically by nearley
// Converted to ESM


import * as exprs from '../facts/exprs.ts';
import * as formula from '../facts/formula.ts';
import * as prop from '../facts/prop.ts';
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
  const params = [];
  const positions = [];
  for (const group of groups) {
    for (const name of group.names) {
      params.push([name, group.type]);
      positions.push(group.typePos);
    }
  }
  return { params, positions };
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
    {"name": "TheoremDecl", "symbols": [(lexer2.has("kw_theorem") ? {type: "kw_theorem"} : kw_theorem), (lexer2.has("variable") ? {type: "variable"} : variable), "TheoremParamGroups", (lexer2.has("pipe") ? {type: "pipe"} : pipe), "Prop"], "postprocess":  ([thm, name, groups, _pipe, concl]) => {
            const ep = expandParams(groups);
            return new theoremAst.TheoremAst(name.text, ep.params, [], concl, thm.line, thm.col, thm.text.length, ep.positions);
        } },
    {"name": "TheoremDecl", "symbols": [(lexer2.has("kw_theorem") ? {type: "kw_theorem"} : kw_theorem), (lexer2.has("variable") ? {type: "variable"} : variable), "TheoremParamGroups", (lexer2.has("pipe") ? {type: "pipe"} : pipe), "Premises", (lexer2.has("fatArrow") ? {type: "fatArrow"} : fatArrow), "Prop"], "postprocess":  ([thm, name, groups, _pipe, premises, _arrow, concl]) => {
            const ep = expandParams(groups);
            return new theoremAst.TheoremAst(name.text, ep.params, premises, concl, thm.line, thm.col, thm.text.length, ep.positions);
        } },
    {"name": "Premises", "symbols": ["Prop"], "postprocess": ([p]) => [p]},
    {"name": "Premises", "symbols": ["Premises", (lexer2.has("comma") ? {type: "comma"} : comma), "Prop"], "postprocess": ([ps, _comma, p]) => ps.concat([p])},
    {"name": "TheoremParamGroups", "symbols": ["TheoremParamGroup"], "postprocess": ([g]) => [g]},
    {"name": "TheoremParamGroups", "symbols": ["TheoremParamGroups", "TheoremParamGroup"], "postprocess": ([gs, g]) => gs.concat([g])},
    {"name": "TheoremParamGroup", "symbols": [(lexer2.has("lparen") ? {type: "lparen"} : lparen), "TheoremNames", (lexer2.has("colon") ? {type: "colon"} : colon), (lexer2.has("typeName") ? {type: "typeName"} : typeName), (lexer2.has("rparen") ? {type: "rparen"} : rparen)], "postprocess": ([_lp, names, _colon, type, _rp]) => ({ names, type: type.text, typePos: { line: type.line, col: type.col, length: type.text.length } })},
    {"name": "TheoremNames", "symbols": [(lexer2.has("variable") ? {type: "variable"} : variable)], "postprocess": ([v]) => [v.text]},
    {"name": "TheoremNames", "symbols": [(lexer2.has("typeName") ? {type: "typeName"} : typeName)], "postprocess": ([v]) => [v.text]},
    {"name": "TheoremNames", "symbols": ["TheoremNames", (lexer2.has("comma") ? {type: "comma"} : comma), (lexer2.has("variable") ? {type: "variable"} : variable)], "postprocess": ([ns, _comma, v]) => ns.concat([v.text])},
    {"name": "TheoremNames", "symbols": ["TheoremNames", (lexer2.has("comma") ? {type: "comma"} : comma), (lexer2.has("typeName") ? {type: "typeName"} : typeName)], "postprocess": ([ns, _comma, v]) => ns.concat([v.text])},
    {"name": "TypeDecl", "symbols": [(lexer2.has("type") ? {type: "type"} : type), (lexer2.has("typeName") ? {type: "typeName"} : typeName), "Ctors"], "postprocess": ([_type, name, ctors]) => new typeAst.TypeDeclAst(name.text, checkCtorReturnTypes(name, ctors), name.line, name.col, name.text.length)},
    {"name": "Ctors", "symbols": ["Ctor"], "postprocess": ([c]) => [c]},
    {"name": "Ctors", "symbols": ["Ctors", "Ctor"], "postprocess": ([cs, c]) => cs.concat([c])},
    {"name": "Ctor", "symbols": [(lexer2.has("pipe") ? {type: "pipe"} : pipe), (lexer2.has("variable") ? {type: "variable"} : variable), (lexer2.has("colon") ? {type: "colon"} : colon), (lexer2.has("typeName") ? {type: "typeName"} : typeName)], "postprocess": ([_pipe, name, _colon, ret]) => ({retName: ret.text, retToken: ret, ast: new typeAst.ConstructorAst(name.text, [], ret.text, name.line, name.col, name.text.length)})},
    {"name": "Ctor", "symbols": [(lexer2.has("pipe") ? {type: "pipe"} : pipe), (lexer2.has("variable") ? {type: "variable"} : variable), (lexer2.has("colon") ? {type: "colon"} : colon), (lexer2.has("lparen") ? {type: "lparen"} : lparen), "Types", (lexer2.has("rparen") ? {type: "rparen"} : rparen), (lexer2.has("arrow") ? {type: "arrow"} : arrow), (lexer2.has("typeName") ? {type: "typeName"} : typeName)], "postprocess": ([_pipe, name, _colon, _lp, types, _rp, _arrow, ret]) => ({retName: ret.text, retToken: ret, ast: new typeAst.ConstructorAst(name.text, list_to_array(types, true), ret.text, name.line, name.col, name.text.length)})},
    {"name": "FuncDef", "symbols": [(lexer2.has("def") ? {type: "def"} : def), (lexer2.has("variable") ? {type: "variable"} : variable), (lexer2.has("colon") ? {type: "colon"} : colon), "TypeSig", "Cases"], "postprocess": ([_def, name, _colon, type, cases]) => new funcAst.FuncAst(name.text, type, checkCaseNames(name, cases), name.line, name.col, name.text.length)},
    {"name": "TypeSig", "symbols": [(lexer2.has("lparen") ? {type: "lparen"} : lparen), "Types", (lexer2.has("rparen") ? {type: "rparen"} : rparen), (lexer2.has("arrow") ? {type: "arrow"} : arrow), (lexer2.has("typeName") ? {type: "typeName"} : typeName)], "postprocess": ([_lp, types, _rp, _arrow, ret]) => new funcAst.TypeAst(list_to_array(types, true), ret.text, _lp.line, _lp.col, 0)},
    {"name": "Cases", "symbols": ["Case"], "postprocess": ([c]) => [c]},
    {"name": "Cases", "symbols": ["Cases", "Case"], "postprocess": ([cs, c]) => cs.concat([c])},
    {"name": "Case", "symbols": [(lexer2.has("pipe") ? {type: "pipe"} : pipe), (lexer2.has("variable") ? {type: "variable"} : variable), (lexer2.has("lparen") ? {type: "lparen"} : lparen), "Params", (lexer2.has("rparen") ? {type: "rparen"} : rparen), (lexer2.has("fatArrow") ? {type: "fatArrow"} : fatArrow), "Body"], "postprocess": ([_pipe, name, _lp, params, _rp, _arrow, body]) => ({name: name.text, token: name, ast: new funcAst.CaseAst(list_to_array(params, true), body)})},
    {"name": "Body", "symbols": ["Expr"], "postprocess": ([e]) => new funcAst.ExprBody(e)},
    {"name": "Body", "symbols": ["IfChain"], "postprocess": ([chain]) => chain},
    {"name": "IfChain", "symbols": [(lexer2.has("kw_if") ? {type: "kw_if"} : kw_if), "CondList", (lexer2.has("kw_then") ? {type: "kw_then"} : kw_then), "Expr", (lexer2.has("kw_else") ? {type: "kw_else"} : kw_else), "ElseBody"], "postprocess":  ([_if, conds, _then, body, _else, elseBody]) => {
            if (elseBody instanceof funcAst.IfElseBody) {
              return new funcAst.IfElseBody(
                [new funcAst.IfBranch(conds, body), ...elseBody.branches],
                elseBody.elseBody);
            } else {
              return new funcAst.IfElseBody(
                [new funcAst.IfBranch(conds, body)],
                elseBody);
            }
        } },
    {"name": "ElseBody", "symbols": ["Expr"], "postprocess": ([e]) => e},
    {"name": "ElseBody", "symbols": ["IfChain"], "postprocess": ([chain]) => chain},
    {"name": "CondList", "symbols": ["Prop"], "postprocess": ([p]) => [p]},
    {"name": "CondList", "symbols": ["CondList", (lexer2.has("comma") ? {type: "comma"} : comma), "Prop"], "postprocess": ([list, _comma, p]) => list.concat([p])},
    {"name": "Params", "symbols": ["Param"], "postprocess": ([a]) => a},
    {"name": "Params", "symbols": ["Params", (lexer2.has("comma") ? {type: "comma"} : comma), "Param"], "postprocess": ([a, _comma, b]) => [b, a]},
    {"name": "Param", "symbols": [(lexer2.has("variable") ? {type: "variable"} : variable)], "postprocess": ([a]) => new funcAst.ParamVar(a.text)},
    {"name": "Param", "symbols": [(lexer2.has("typeName") ? {type: "typeName"} : typeName)], "postprocess": ([a]) => new funcAst.ParamVar(a.text)},
    {"name": "Param", "symbols": [(lexer2.has("variable") ? {type: "variable"} : variable), (lexer2.has("lparen") ? {type: "lparen"} : lparen), "Params", (lexer2.has("rparen") ? {type: "rparen"} : rparen)], "postprocess": ([a, _lp, params, _rp]) => new funcAst.ParamConstructor(a.text, list_to_array(params, true))},
    {"name": "Expr", "symbols": ["Expr", (lexer2.has("plus") ? {type: "plus"} : plus), "NegTerm"], "postprocess": ([a, op, c]) => new exprs.Call(exprs.FUNC_ADD, [a, c], op.line, op.col)},
    {"name": "Expr", "symbols": ["Expr", (lexer2.has("minus") ? {type: "minus"} : minus), "NegTerm"], "postprocess": ([a, op, c]) => new exprs.Call(exprs.FUNC_SUBTRACT, [a, c], op.line, op.col)},
    {"name": "Expr", "symbols": ["NegTerm"], "postprocess": ([a]) => a},
    {"name": "NegTerm", "symbols": [(lexer2.has("minus") ? {type: "minus"} : minus), "NegTerm"], "postprocess": ([op, b]) => new exprs.Call(exprs.FUNC_NEGATE, [b], op.line, op.col)},
    {"name": "NegTerm", "symbols": ["Term"], "postprocess": ([a]) => a},
    {"name": "Term", "symbols": ["Term", (lexer2.has("times") ? {type: "times"} : times), "Factor"], "postprocess": ([a, op, c]) => new exprs.Call(exprs.FUNC_MULTIPLY, [a, c], op.line, op.col)},
    {"name": "Term", "symbols": ["Factor"], "postprocess": ([a]) => a},
    {"name": "Factor", "symbols": ["Primary", (lexer2.has("exp") ? {type: "exp"} : exp), (lexer2.has("constant") ? {type: "constant"} : constant)], "postprocess": ([a, op, c]) => new exprs.Call(exprs.FUNC_EXPONENTIATE, [a, new exprs.Constant(BigInt(c.text), c.line, c.col)], op.line, op.col)},
    {"name": "Factor", "symbols": ["Primary"], "postprocess": ([a]) => a},
    {"name": "Primary", "symbols": [(lexer2.has("constant") ? {type: "constant"} : constant)], "postprocess": ([a]) => new exprs.Constant(BigInt(a.text), a.line, a.col)},
    {"name": "Primary", "symbols": [(lexer2.has("variable") ? {type: "variable"} : variable)], "postprocess": ([a]) => new exprs.Variable(a.text, a.line, a.col)},
    {"name": "Primary", "symbols": [(lexer2.has("variable") ? {type: "variable"} : variable), (lexer2.has("lparen") ? {type: "lparen"} : lparen), "Exprs", (lexer2.has("rparen") ? {type: "rparen"} : rparen)], "postprocess": ([a, b, c, d]) => new exprs.Call(a.text, list_to_array(c, true), a.line, a.col)},
    {"name": "Primary", "symbols": [(lexer2.has("lparen") ? {type: "lparen"} : lparen), "Expr", (lexer2.has("rparen") ? {type: "rparen"} : rparen)], "postprocess": ([a, b, c]) => b},
    {"name": "Exprs", "symbols": ["Expr"], "postprocess": ([a]) => a},
    {"name": "Exprs", "symbols": ["Exprs", (lexer2.has("comma") ? {type: "comma"} : comma), "Expr"], "postprocess": ([a, b, c]) => [c, a]},
    {"name": "Prop", "symbols": ["Literal"], "postprocess": ([l]) => l},
    {"name": "Prop", "symbols": ["Prop", (lexer2.has("kw_or") ? {type: "kw_or"} : kw_or), "Literal"], "postprocess":  ([p, _op, l]) => {
            if (p.tag === 'or') return new prop.OrProp([...p.disjuncts, l]);
            return new prop.OrProp([p, l]);
        } },
    {"name": "Literal", "symbols": ["Formula"], "postprocess": ([f]) => new prop.AtomProp(f)},
    {"name": "Literal", "symbols": [(lexer2.has("kw_not") ? {type: "kw_not"} : kw_not), "Formula"], "postprocess": ([_op, f]) => new prop.NotProp(f)},
    {"name": "Literal", "symbols": [(lexer2.has("kw_not") ? {type: "kw_not"} : kw_not), (lexer2.has("lparen") ? {type: "lparen"} : lparen), "Formula", (lexer2.has("rparen") ? {type: "rparen"} : rparen)], "postprocess": ([_op, _lp, f, _rp]) => new prop.NotProp(f)},
    {"name": "Literal", "symbols": ["Expr", (lexer2.has("notequal") ? {type: "notequal"} : notequal), "Expr"], "postprocess": ([l, _op, r]) => new prop.NotProp(new formula.Formula(l, '=', r))},
    {"name": "Literal", "symbols": [(lexer2.has("kw_true") ? {type: "kw_true"} : kw_true)], "postprocess": () => new prop.ConstProp(true)},
    {"name": "Literal", "symbols": [(lexer2.has("kw_false") ? {type: "kw_false"} : kw_false)], "postprocess": () => new prop.ConstProp(false)},
    {"name": "Formula", "symbols": ["Expr", (lexer2.has("equal") ? {type: "equal"} : equal), "Expr"], "postprocess": ([l, _op, r]) => new formula.Formula(l, '=', r)},
    {"name": "Formula", "symbols": ["Expr", (lexer2.has("lessthan") ? {type: "lessthan"} : lessthan), "Expr"], "postprocess": ([l, _op, r]) => new formula.Formula(l, '<', r)},
    {"name": "Formula", "symbols": ["Expr", (lexer2.has("lessequal") ? {type: "lessequal"} : lessequal), "Expr"], "postprocess": ([l, _op, r]) => new formula.Formula(l, '<=', r)},
    {"name": "Primary", "symbols": [(lexer2.has("typeName") ? {type: "typeName"} : typeName)], "postprocess": ([a]) => new exprs.Variable(a.text, a.line, a.col)},
    {"name": "Primary", "symbols": [(lexer2.has("typeName") ? {type: "typeName"} : typeName), (lexer2.has("lparen") ? {type: "lparen"} : lparen), "Exprs", (lexer2.has("rparen") ? {type: "rparen"} : rparen)], "postprocess": ([a, b, c, d]) => new exprs.Call(a.text, list_to_array(c, true), a.line, a.col)}
]
  , ParserStart: "Decls"
};

export default grammar;
