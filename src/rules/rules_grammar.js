// Generated automatically by nearley
// Converted to ESM


import * as exprs from '../facts/exprs.ts';
import * as ast from './rules_ast.ts';
import moo from 'moo';
const lexer = moo.compile({
  WS: /[ \t\r]+/,
  NL: { match: /\n/, lineBreaks: true },
  constant: /[0-9]+/,
  variable: { match: /[a-zA-Z][_a-zA-Z0-9]*/, type: moo.keywords({ subst: 'subst', unsub: 'unsub', defof: 'defof', undef: 'undef' }) },
  lessequal: '<=',
  lessthan: '<',
  equal: '=',
  lparen: '(', rparen: ')', comma: ',',
  exp: '^', times: '*', plus: '+', minus: '-'
});
const lexer2 = {
  save: () => lexer.save(),
  reset: (chunk, info) => lexer.reset(chunk, info),
  formatError: (tok) => lexer.formatError(tok),
  has: (name) => lexer.has(name),
  next: () => {
    let tok;
    do {
      tok = lexer.next();
    } while (tok !== undefined && (tok.type === 'WS' || tok.type === 'NL'));
    return tok;
  }
};
function list_to_array(a, rev) {
  const res = [];
  while (a instanceof Array && a.length == 2) {
    res.push(a[0]);
    a = a[1];
  }
  res.push(a);
  if (rev)
    res.reverse();
  return res;
}
var grammar = {
    Lexer: lexer2,
    ParserRules: [
    {"name": "Rule", "symbols": [(lexer2.has("equal") ? {type: "equal"} : equal), "Expr"], "postprocess": ([op, e]) => new ast.AlgebraAst('=', e, [])},
    {"name": "Rule", "symbols": [(lexer2.has("equal") ? {type: "equal"} : equal), "Expr", "Refs"], "postprocess": ([op, e, refs]) => new ast.AlgebraAst('=', e, refs)},
    {"name": "Rule", "symbols": [(lexer2.has("lessthan") ? {type: "lessthan"} : lessthan), "Expr"], "postprocess": ([op, e]) => new ast.AlgebraAst('<', e, [])},
    {"name": "Rule", "symbols": [(lexer2.has("lessthan") ? {type: "lessthan"} : lessthan), "Expr", "Refs"], "postprocess": ([op, e, refs]) => new ast.AlgebraAst('<', e, refs)},
    {"name": "Rule", "symbols": [(lexer2.has("lessequal") ? {type: "lessequal"} : lessequal), "Expr"], "postprocess": ([op, e]) => new ast.AlgebraAst('<=', e, [])},
    {"name": "Rule", "symbols": [(lexer2.has("lessequal") ? {type: "lessequal"} : lessequal), "Expr", "Refs"], "postprocess": ([op, e, refs]) => new ast.AlgebraAst('<=', e, refs)},
    {"name": "Rule", "symbols": [(lexer2.has("subst") ? {type: "subst"} : subst), (lexer2.has("constant") ? {type: "constant"} : constant)], "postprocess": ([a, b]) => new ast.SubstituteAst(parseInt(b.text), true)},
    {"name": "Rule", "symbols": [(lexer2.has("subst") ? {type: "subst"} : subst), (lexer2.has("constant") ? {type: "constant"} : constant), "Expr"], "postprocess": ([a, b, e]) => new ast.SubstituteAst(parseInt(b.text), true, e)},
    {"name": "Rule", "symbols": [(lexer2.has("unsub") ? {type: "unsub"} : unsub), (lexer2.has("constant") ? {type: "constant"} : constant)], "postprocess": ([a, b]) => new ast.SubstituteAst(parseInt(b.text), false)},
    {"name": "Rule", "symbols": [(lexer2.has("unsub") ? {type: "unsub"} : unsub), (lexer2.has("constant") ? {type: "constant"} : constant), "Expr"], "postprocess": ([a, b, e]) => new ast.SubstituteAst(parseInt(b.text), false, e)},
    {"name": "Rule", "symbols": [(lexer2.has("defof") ? {type: "defof"} : defof), (lexer2.has("variable") ? {type: "variable"} : variable)], "postprocess": ([a, name]) => new ast.DefinitionAst(name.text, true)},
    {"name": "Rule", "symbols": [(lexer2.has("defof") ? {type: "defof"} : defof), (lexer2.has("variable") ? {type: "variable"} : variable), "Expr"], "postprocess": ([a, name, e]) => new ast.DefinitionAst(name.text, true, e)},
    {"name": "Rule", "symbols": [(lexer2.has("undef") ? {type: "undef"} : undef), (lexer2.has("variable") ? {type: "variable"} : variable)], "postprocess": ([a, name]) => new ast.DefinitionAst(name.text, false)},
    {"name": "Rule", "symbols": [(lexer2.has("undef") ? {type: "undef"} : undef), (lexer2.has("variable") ? {type: "variable"} : variable), "Expr"], "postprocess": ([a, name, e]) => new ast.DefinitionAst(name.text, false, e)},
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
  , ParserStart: "Rule"
};

export default grammar;
