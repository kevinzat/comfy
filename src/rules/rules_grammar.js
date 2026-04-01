// Generated automatically by nearley
// Converted to ESM


import * as exprs from '../facts/exprs.ts';
import * as ast from './rules_ast.ts';
import moo from 'moo';
import * as util from './grammar_util.js';
const lexer2 = util.makeRuleLexer(moo);
const list_to_array = util.list_to_array;
var grammar = {
    Lexer: lexer2,
    ParserRules: [
    {"name": "Rule", "symbols": [(lexer2.has("equal") ? {type: "equal"} : equal), "Expr"], "postprocess": ([op, e]) => new ast.AlgebraAst('=', e, [])},
    {"name": "Rule", "symbols": [(lexer2.has("equal") ? {type: "equal"} : equal), "Expr", (lexer2.has("since") ? {type: "since"} : since), "Refs"], "postprocess": ([op, e, _s, refs]) => new ast.AlgebraAst('=', e, refs)},
    {"name": "Rule", "symbols": [(lexer2.has("lessthan") ? {type: "lessthan"} : lessthan), "Expr"], "postprocess": ([op, e]) => new ast.AlgebraAst('<', e, [])},
    {"name": "Rule", "symbols": [(lexer2.has("lessthan") ? {type: "lessthan"} : lessthan), "Expr", (lexer2.has("since") ? {type: "since"} : since), "Refs"], "postprocess": ([op, e, _s, refs]) => new ast.AlgebraAst('<', e, refs)},
    {"name": "Rule", "symbols": [(lexer2.has("lessequal") ? {type: "lessequal"} : lessequal), "Expr"], "postprocess": ([op, e]) => new ast.AlgebraAst('<=', e, [])},
    {"name": "Rule", "symbols": [(lexer2.has("lessequal") ? {type: "lessequal"} : lessequal), "Expr", (lexer2.has("since") ? {type: "since"} : since), "Refs"], "postprocess": ([op, e, _s, refs]) => new ast.AlgebraAst('<=', e, refs)},
    {"name": "Rule", "symbols": [(lexer2.has("subst") ? {type: "subst"} : subst), (lexer2.has("constant") ? {type: "constant"} : constant)], "postprocess": ([a, b]) => new ast.SubstituteAst(parseInt(b.text), true)},
    {"name": "Rule", "symbols": [(lexer2.has("subst") ? {type: "subst"} : subst), (lexer2.has("constant") ? {type: "constant"} : constant), (lexer2.has("arrow") ? {type: "arrow"} : arrow), "Expr"], "postprocess": ([a, b, _arr, e]) => new ast.SubstituteAst(parseInt(b.text), true, e)},
    {"name": "Rule", "symbols": [(lexer2.has("unsub") ? {type: "unsub"} : unsub), (lexer2.has("constant") ? {type: "constant"} : constant)], "postprocess": ([a, b]) => new ast.SubstituteAst(parseInt(b.text), false)},
    {"name": "Rule", "symbols": [(lexer2.has("unsub") ? {type: "unsub"} : unsub), (lexer2.has("constant") ? {type: "constant"} : constant), (lexer2.has("arrow") ? {type: "arrow"} : arrow), "Expr"], "postprocess": ([a, b, _arr, e]) => new ast.SubstituteAst(parseInt(b.text), false, e)},
    {"name": "Rule", "symbols": [(lexer2.has("defof") ? {type: "defof"} : defof), (lexer2.has("variable") ? {type: "variable"} : variable)], "postprocess": ([a, name]) => new ast.DefinitionAst(name.text, true)},
    {"name": "Rule", "symbols": [(lexer2.has("defof") ? {type: "defof"} : defof), (lexer2.has("variable") ? {type: "variable"} : variable), (lexer2.has("since") ? {type: "since"} : since), "Refs"], "postprocess": ([a, name, _s, refs]) => new ast.DefinitionAst(name.text, true, refs)},
    {"name": "Rule", "symbols": [(lexer2.has("defof") ? {type: "defof"} : defof), (lexer2.has("variable") ? {type: "variable"} : variable), (lexer2.has("arrow") ? {type: "arrow"} : arrow), "Expr"], "postprocess": ([a, name, _arr, e]) => new ast.DefinitionAst(name.text, true, [], e)},
    {"name": "Rule", "symbols": [(lexer2.has("defof") ? {type: "defof"} : defof), (lexer2.has("variable") ? {type: "variable"} : variable), (lexer2.has("since") ? {type: "since"} : since), "Refs", (lexer2.has("arrow") ? {type: "arrow"} : arrow), "Expr"], "postprocess": ([a, name, _s, refs, _arr, e]) => new ast.DefinitionAst(name.text, true, refs, e)},
    {"name": "Rule", "symbols": [(lexer2.has("undef") ? {type: "undef"} : undef), (lexer2.has("variable") ? {type: "variable"} : variable)], "postprocess": ([a, name]) => new ast.DefinitionAst(name.text, false)},
    {"name": "Rule", "symbols": [(lexer2.has("undef") ? {type: "undef"} : undef), (lexer2.has("variable") ? {type: "variable"} : variable), (lexer2.has("since") ? {type: "since"} : since), "Refs"], "postprocess": ([a, name, _s, refs]) => new ast.DefinitionAst(name.text, false, refs)},
    {"name": "Rule", "symbols": [(lexer2.has("undef") ? {type: "undef"} : undef), (lexer2.has("variable") ? {type: "variable"} : variable), (lexer2.has("arrow") ? {type: "arrow"} : arrow), "Expr"], "postprocess": ([a, name, _arr, e]) => new ast.DefinitionAst(name.text, false, [], e)},
    {"name": "Rule", "symbols": [(lexer2.has("undef") ? {type: "undef"} : undef), (lexer2.has("variable") ? {type: "variable"} : variable), (lexer2.has("since") ? {type: "since"} : since), "Refs", (lexer2.has("arrow") ? {type: "arrow"} : arrow), "Expr"], "postprocess": ([a, name, _s, refs, _arr, e]) => new ast.DefinitionAst(name.text, false, refs, e)},
    {"name": "Rule", "symbols": [(lexer2.has("apply") ? {type: "apply"} : apply), (lexer2.has("variable") ? {type: "variable"} : variable)], "postprocess": ([a, name]) => new ast.ApplyAst(name.text, true)},
    {"name": "Rule", "symbols": [(lexer2.has("apply") ? {type: "apply"} : apply), (lexer2.has("variable") ? {type: "variable"} : variable), (lexer2.has("since") ? {type: "since"} : since), "Refs"], "postprocess": ([a, name, _s, refs]) => new ast.ApplyAst(name.text, true, refs)},
    {"name": "Rule", "symbols": [(lexer2.has("apply") ? {type: "apply"} : apply), (lexer2.has("variable") ? {type: "variable"} : variable), (lexer2.has("arrow") ? {type: "arrow"} : arrow), "Expr"], "postprocess": ([a, name, _arr, e]) => new ast.ApplyAst(name.text, true, [], e)},
    {"name": "Rule", "symbols": [(lexer2.has("apply") ? {type: "apply"} : apply), (lexer2.has("variable") ? {type: "variable"} : variable), (lexer2.has("since") ? {type: "since"} : since), "Refs", (lexer2.has("arrow") ? {type: "arrow"} : arrow), "Expr"], "postprocess": ([a, name, _s, refs, _arr, e]) => new ast.ApplyAst(name.text, true, refs, e)},
    {"name": "Rule", "symbols": [(lexer2.has("unapp") ? {type: "unapp"} : unapp), (lexer2.has("variable") ? {type: "variable"} : variable)], "postprocess": ([a, name]) => new ast.ApplyAst(name.text, false)},
    {"name": "Rule", "symbols": [(lexer2.has("unapp") ? {type: "unapp"} : unapp), (lexer2.has("variable") ? {type: "variable"} : variable), (lexer2.has("since") ? {type: "since"} : since), "Refs"], "postprocess": ([a, name, _s, refs]) => new ast.ApplyAst(name.text, false, refs)},
    {"name": "Rule", "symbols": [(lexer2.has("unapp") ? {type: "unapp"} : unapp), (lexer2.has("variable") ? {type: "variable"} : variable), (lexer2.has("arrow") ? {type: "arrow"} : arrow), "Expr"], "postprocess": ([a, name, _arr, e]) => new ast.ApplyAst(name.text, false, [], e)},
    {"name": "Rule", "symbols": [(lexer2.has("unapp") ? {type: "unapp"} : unapp), (lexer2.has("variable") ? {type: "variable"} : variable), (lexer2.has("since") ? {type: "since"} : since), "Refs", (lexer2.has("arrow") ? {type: "arrow"} : arrow), "Expr"], "postprocess": ([a, name, _s, refs, _arr, e]) => new ast.ApplyAst(name.text, false, refs, e)},
    {"name": "Refs", "symbols": [(lexer2.has("constant") ? {type: "constant"} : constant)], "postprocess": ([c]) => [parseInt(c.text)]},
    {"name": "Refs", "symbols": ["Refs", (lexer2.has("constant") ? {type: "constant"} : constant)], "postprocess": ([refs, c]) => refs.concat([parseInt(c.text)])},
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
    {"name": "Exprs", "symbols": ["Exprs", (lexer2.has("comma") ? {type: "comma"} : comma), "Expr"], "postprocess": ([a, b, c]) => [c, a]}
]
  , ParserStart: "Rule"
};

export default grammar;
