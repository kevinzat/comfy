// Generated automatically by nearley
// Converted to ESM


import * as prop from './prop.ts';
import * as formula from './formula.ts';
import * as exprs from './exprs.ts';
import moo from 'moo';
import * as util from '../lang/grammar_util.js';
const clexer = util.makeLexer(moo, {
  WS: /[ \t\r]+/,
  NL: { match: /\n/, lineBreaks: true },
  lessequal: '<=',
  lessthan: '<',
  equal: '=',
  constant: /[0-9]+/,
  ident: { match: /[a-z][_a-zA-Z0-9]*/, type: moo.keywords({
    kw_or: 'or', kw_not: 'not'
  }) },
  lparen: '(', rparen: ')',
  comma: ',',
  exp: '^', times: '*', plus: '+', minus: '-'
});
const list_to_array = util.list_to_array;
var grammar = {
    Lexer: clexer,
    ParserRules: [
    {"name": "Main", "symbols": ["Prop"], "postprocess": ([a]) => a},
    {"name": "Prop", "symbols": ["Literal"], "postprocess": ([l]) => l},
    {"name": "Prop", "symbols": ["Prop", (clexer.has("kw_or") ? {type: "kw_or"} : kw_or), "Literal"], "postprocess":  ([p, _op, l]) => {
            if (p.tag === 'or') return new prop.OrProp([...p.disjuncts, l]);
            return new prop.OrProp([p, l]);
        } },
    {"name": "Literal", "symbols": ["Formula"], "postprocess": ([f]) => new prop.AtomProp(f)},
    {"name": "Literal", "symbols": [(clexer.has("kw_not") ? {type: "kw_not"} : kw_not), "Formula"], "postprocess": ([_op, f]) => new prop.NotProp(f)},
    {"name": "Formula", "symbols": ["Expr", (clexer.has("equal") ? {type: "equal"} : equal), "Expr"], "postprocess": ([l, _op, r]) => new formula.Formula(l, '=', r)},
    {"name": "Formula", "symbols": ["Expr", (clexer.has("lessthan") ? {type: "lessthan"} : lessthan), "Expr"], "postprocess": ([l, _op, r]) => new formula.Formula(l, '<', r)},
    {"name": "Formula", "symbols": ["Expr", (clexer.has("lessequal") ? {type: "lessequal"} : lessequal), "Expr"], "postprocess": ([l, _op, r]) => new formula.Formula(l, '<=', r)},
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
