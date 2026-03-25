// Generated automatically by nearley
// Converted to ESM


import * as exprs from '../facts/exprs.ts';
import * as ast from './tactics_ast.ts';
import moo from 'moo';
import * as util from './grammar_util.js';
const lexer2 = util.makeRuleLexer(moo);
const list_to_array = util.list_to_array;
var grammar = {
    Lexer: lexer2,
    ParserRules: [
    {"name": "Tactic", "symbols": ["Expr", (lexer2.has("equal") ? {type: "equal"} : equal)], "postprocess": ([e, op]) => new ast.AlgebraTacticAst('=', e, [])},
    {"name": "Tactic", "symbols": ["Expr", (lexer2.has("equal") ? {type: "equal"} : equal), (lexer2.has("since") ? {type: "since"} : since), "Refs"], "postprocess": ([e, op, _s, refs]) => new ast.AlgebraTacticAst('=', e, refs)},
    {"name": "Tactic", "symbols": ["Expr", (lexer2.has("lessthan") ? {type: "lessthan"} : lessthan)], "postprocess": ([e, op]) => new ast.AlgebraTacticAst('<', e, [])},
    {"name": "Tactic", "symbols": ["Expr", (lexer2.has("lessthan") ? {type: "lessthan"} : lessthan), (lexer2.has("since") ? {type: "since"} : since), "Refs"], "postprocess": ([e, op, _s, refs]) => new ast.AlgebraTacticAst('<', e, refs)},
    {"name": "Tactic", "symbols": ["Expr", (lexer2.has("lessequal") ? {type: "lessequal"} : lessequal)], "postprocess": ([e, op]) => new ast.AlgebraTacticAst('<=', e, [])},
    {"name": "Tactic", "symbols": ["Expr", (lexer2.has("lessequal") ? {type: "lessequal"} : lessequal), (lexer2.has("since") ? {type: "since"} : since), "Refs"], "postprocess": ([e, op, _s, refs]) => new ast.AlgebraTacticAst('<=', e, refs)},
    {"name": "Tactic", "symbols": [(lexer2.has("subst") ? {type: "subst"} : subst), (lexer2.has("constant") ? {type: "constant"} : constant)], "postprocess": ([a, b]) => new ast.SubstituteTacticAst(parseInt(b.text), true)},
    {"name": "Tactic", "symbols": [(lexer2.has("subst") ? {type: "subst"} : subst), (lexer2.has("constant") ? {type: "constant"} : constant), (lexer2.has("arrow") ? {type: "arrow"} : arrow), "Expr"], "postprocess": ([a, b, _arr, e]) => new ast.SubstituteTacticAst(parseInt(b.text), true, e)},
    {"name": "Tactic", "symbols": [(lexer2.has("unsub") ? {type: "unsub"} : unsub), (lexer2.has("constant") ? {type: "constant"} : constant)], "postprocess": ([a, b]) => new ast.SubstituteTacticAst(parseInt(b.text), false)},
    {"name": "Tactic", "symbols": [(lexer2.has("unsub") ? {type: "unsub"} : unsub), (lexer2.has("constant") ? {type: "constant"} : constant), (lexer2.has("arrow") ? {type: "arrow"} : arrow), "Expr"], "postprocess": ([a, b, _arr, e]) => new ast.SubstituteTacticAst(parseInt(b.text), false, e)},
    {"name": "Tactic", "symbols": [(lexer2.has("defof") ? {type: "defof"} : defof), (lexer2.has("variable") ? {type: "variable"} : variable)], "postprocess": ([a, name]) => new ast.DefinitionTacticAst(name.text, true)},
    {"name": "Tactic", "symbols": [(lexer2.has("defof") ? {type: "defof"} : defof), (lexer2.has("variable") ? {type: "variable"} : variable), (lexer2.has("since") ? {type: "since"} : since), "Refs"], "postprocess": ([a, name, _s, refs]) => new ast.DefinitionTacticAst(name.text, true, refs)},
    {"name": "Tactic", "symbols": [(lexer2.has("defof") ? {type: "defof"} : defof), (lexer2.has("variable") ? {type: "variable"} : variable), (lexer2.has("arrow") ? {type: "arrow"} : arrow), "Expr"], "postprocess": ([a, name, _arr, e]) => new ast.DefinitionTacticAst(name.text, true, [], e)},
    {"name": "Tactic", "symbols": [(lexer2.has("defof") ? {type: "defof"} : defof), (lexer2.has("variable") ? {type: "variable"} : variable), (lexer2.has("since") ? {type: "since"} : since), "Refs", (lexer2.has("arrow") ? {type: "arrow"} : arrow), "Expr"], "postprocess": ([a, name, _s, refs, _arr, e]) => new ast.DefinitionTacticAst(name.text, true, refs, e)},
    {"name": "Tactic", "symbols": [(lexer2.has("undef") ? {type: "undef"} : undef), (lexer2.has("variable") ? {type: "variable"} : variable)], "postprocess": ([a, name]) => new ast.DefinitionTacticAst(name.text, false)},
    {"name": "Tactic", "symbols": [(lexer2.has("undef") ? {type: "undef"} : undef), (lexer2.has("variable") ? {type: "variable"} : variable), (lexer2.has("since") ? {type: "since"} : since), "Refs"], "postprocess": ([a, name, _s, refs]) => new ast.DefinitionTacticAst(name.text, false, refs)},
    {"name": "Tactic", "symbols": [(lexer2.has("undef") ? {type: "undef"} : undef), (lexer2.has("variable") ? {type: "variable"} : variable), (lexer2.has("arrow") ? {type: "arrow"} : arrow), "Expr"], "postprocess": ([a, name, _arr, e]) => new ast.DefinitionTacticAst(name.text, false, [], e)},
    {"name": "Tactic", "symbols": [(lexer2.has("undef") ? {type: "undef"} : undef), (lexer2.has("variable") ? {type: "variable"} : variable), (lexer2.has("since") ? {type: "since"} : since), "Refs", (lexer2.has("arrow") ? {type: "arrow"} : arrow), "Expr"], "postprocess": ([a, name, _s, refs, _arr, e]) => new ast.DefinitionTacticAst(name.text, false, refs, e)},
    {"name": "Tactic", "symbols": [(lexer2.has("apply") ? {type: "apply"} : apply), (lexer2.has("variable") ? {type: "variable"} : variable)], "postprocess": ([a, name]) => new ast.ApplyTacticAst(name.text, true)},
    {"name": "Tactic", "symbols": [(lexer2.has("apply") ? {type: "apply"} : apply), (lexer2.has("variable") ? {type: "variable"} : variable), (lexer2.has("since") ? {type: "since"} : since), "Refs"], "postprocess": ([a, name, _s, refs]) => new ast.ApplyTacticAst(name.text, true, refs)},
    {"name": "Tactic", "symbols": [(lexer2.has("apply") ? {type: "apply"} : apply), (lexer2.has("variable") ? {type: "variable"} : variable), (lexer2.has("arrow") ? {type: "arrow"} : arrow), "Expr"], "postprocess": ([a, name, _arr, e]) => new ast.ApplyTacticAst(name.text, true, [], e)},
    {"name": "Tactic", "symbols": [(lexer2.has("apply") ? {type: "apply"} : apply), (lexer2.has("variable") ? {type: "variable"} : variable), (lexer2.has("since") ? {type: "since"} : since), "Refs", (lexer2.has("arrow") ? {type: "arrow"} : arrow), "Expr"], "postprocess": ([a, name, _s, refs, _arr, e]) => new ast.ApplyTacticAst(name.text, true, refs, e)},
    {"name": "Tactic", "symbols": [(lexer2.has("unapp") ? {type: "unapp"} : unapp), (lexer2.has("variable") ? {type: "variable"} : variable)], "postprocess": ([a, name]) => new ast.ApplyTacticAst(name.text, false)},
    {"name": "Tactic", "symbols": [(lexer2.has("unapp") ? {type: "unapp"} : unapp), (lexer2.has("variable") ? {type: "variable"} : variable), (lexer2.has("since") ? {type: "since"} : since), "Refs"], "postprocess": ([a, name, _s, refs]) => new ast.ApplyTacticAst(name.text, false, refs)},
    {"name": "Tactic", "symbols": [(lexer2.has("unapp") ? {type: "unapp"} : unapp), (lexer2.has("variable") ? {type: "variable"} : variable), (lexer2.has("arrow") ? {type: "arrow"} : arrow), "Expr"], "postprocess": ([a, name, _arr, e]) => new ast.ApplyTacticAst(name.text, false, [], e)},
    {"name": "Tactic", "symbols": [(lexer2.has("unapp") ? {type: "unapp"} : unapp), (lexer2.has("variable") ? {type: "variable"} : variable), (lexer2.has("since") ? {type: "since"} : since), "Refs", (lexer2.has("arrow") ? {type: "arrow"} : arrow), "Expr"], "postprocess": ([a, name, _s, refs, _arr, e]) => new ast.ApplyTacticAst(name.text, false, refs, e)},
    {"name": "Refs", "symbols": [(lexer2.has("constant") ? {type: "constant"} : constant)], "postprocess": ([c]) => [parseInt(c.text)]},
    {"name": "Refs", "symbols": ["Refs", (lexer2.has("constant") ? {type: "constant"} : constant)], "postprocess": ([refs, c]) => refs.concat([parseInt(c.text)])},
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
    {"name": "Exprs", "symbols": ["Exprs", (lexer2.has("comma") ? {type: "comma"} : comma), "Expr"], "postprocess": ([a, b, c]) => [c, a]}
]
  , ParserStart: "Tactic"
};

export default grammar;
