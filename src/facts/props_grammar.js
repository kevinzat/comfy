// Generated automatically by nearley
// Converted to ESM


import * as prop from './prop.ts';
import * as formula from './formula.ts';
import * as exprs from './exprs.ts';
import moo from 'moo';
import * as util from '../lang/grammar_util.js';
const lexer2 = util.makeLexer(moo, {
  WS: /[ \t\r]+/,
  NL: { match: /\n/, lineBreaks: true },
  lessequal: '<=',
  lessthan: '<',
  notequal: '/=',
  equal: '=',
  constant: /[0-9]+/,
  typeName: /[A-Z][_a-zA-Z0-9]*/,
  variable: { match: /[a-z][_a-zA-Z0-9]*/, type: moo.keywords({
    kw_or: 'or', kw_not: 'not', kw_true: 'true', kw_false: 'false'
  }) },
  lparen: '(', rparen: ')',
  comma: ',',
  exp: '^', times: '*', plus: '+', minus: '-'
});
const list_to_array = util.list_to_array;
var grammar = {
    Lexer: lexer2,
    ParserRules: [
    {"name": "Main", "symbols": ["Prop"], "postprocess": ([a]) => a},
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
  , ParserStart: "Main"
};

export default grammar;
