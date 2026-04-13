// Generated automatically by nearley
// Converted to ESM


import * as typeAst from './type_ast.ts';
import moo from 'moo';
import * as util from './grammar_util.js';
const lexer2 = util.makeLexer(moo, {
  WS: /[ \t\r]+/,
  NL: { match: /\n/, lineBreaks: true },
  arrow: '->',
  typeName: /[A-Z][_a-zA-Z0-9]*/,
  variable: { match: /[a-z][_a-zA-Z0-9]*/, type: moo.keywords({ type: 'type' }) },
  pipe: '|',
  colon: ':',
  lparen: '(', rparen: ')', comma: ','
});
const list_to_array = util.list_to_array;
const checkCtorReturnTypes = util.checkCtorReturnTypes;
var grammar = {
    Lexer: lexer2,
    ParserRules: [
    {"name": "Main", "symbols": ["TypeDecl"], "postprocess": ([a]) => a},
    {"name": "Types", "symbols": [(lexer2.has("typeName") ? {type: "typeName"} : typeName)], "postprocess": ([a]) => a.text},
    {"name": "Types", "symbols": ["Types", (lexer2.has("comma") ? {type: "comma"} : comma), (lexer2.has("typeName") ? {type: "typeName"} : typeName)], "postprocess": ([a, _comma, b]) => [b.text, a]},
    {"name": "TypeDecl", "symbols": [(lexer2.has("type") ? {type: "type"} : type), (lexer2.has("typeName") ? {type: "typeName"} : typeName), "Ctors"], "postprocess": ([_type, name, ctors]) => new typeAst.TypeDeclAst(name.text, checkCtorReturnTypes(name, ctors), name.line, name.col, name.text.length)},
    {"name": "Ctors", "symbols": ["Ctor"], "postprocess": ([c]) => [c]},
    {"name": "Ctors", "symbols": ["Ctors", "Ctor"], "postprocess": ([cs, c]) => cs.concat([c])},
    {"name": "Ctor", "symbols": [(lexer2.has("pipe") ? {type: "pipe"} : pipe), (lexer2.has("variable") ? {type: "variable"} : variable), (lexer2.has("colon") ? {type: "colon"} : colon), (lexer2.has("typeName") ? {type: "typeName"} : typeName)], "postprocess": ([_pipe, name, _colon, ret]) => ({retName: ret.text, retToken: ret, ast: new typeAst.ConstructorAst(name.text, [], ret.text, name.line, name.col, name.text.length)})},
    {"name": "Ctor", "symbols": [(lexer2.has("pipe") ? {type: "pipe"} : pipe), (lexer2.has("variable") ? {type: "variable"} : variable), (lexer2.has("colon") ? {type: "colon"} : colon), (lexer2.has("lparen") ? {type: "lparen"} : lparen), "Types", (lexer2.has("rparen") ? {type: "rparen"} : rparen), (lexer2.has("arrow") ? {type: "arrow"} : arrow), (lexer2.has("typeName") ? {type: "typeName"} : typeName)], "postprocess": ([_pipe, name, _colon, _lp, types, _rp, _arrow, ret]) => ({retName: ret.text, retToken: ret, ast: new typeAst.ConstructorAst(name.text, list_to_array(types, true), ret.text, name.line, name.col, name.text.length)})}
]
  , ParserStart: "Main"
};

export default grammar;
