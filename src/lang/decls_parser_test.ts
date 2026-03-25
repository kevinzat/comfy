
import * as assert from 'assert';
import { Constant, Variable, Call } from '../facts/exprs';
import { ParamVar, ParamConstructor } from './func_ast';
import { ConstructorAst } from './type_ast';
import { ParseDecls } from './decls_parser';


describe('decls_parser', function() {

  it('parse single type declaration', function() {
    const { ast } = ParseDecls(
        `type Bool
         | true : Bool
         | false : Bool`);
    assert.ok(ast);
    assert.equal(ast.types.length, 1);
    assert.equal(ast.types[0].name, 'Bool');
    assert.equal(ast.functions.length, 0);
  });

  it('parse single function definition', function() {
    const { ast } = ParseDecls(
        `def f : (Int) -> Int
         | f(x) => x + 1`);
    assert.ok(ast);
    assert.equal(ast.types.length, 0);
    assert.equal(ast.functions.length, 1);
    assert.equal(ast.functions[0].name, 'f');
  });

  it('parse mixed declarations', function() {
    const { ast } = ParseDecls(
        `type List
         | nil : List
         | cons : (Int, List) -> List
         def len : (List) -> Int
         | len(nil) => 0
         | len(cons(a, rest)) => 1 + len(rest)`);
    assert.ok(ast);
    assert.equal(ast.types.length, 1);
    assert.equal(ast.types[0].name, 'List');
    assert.equal(ast.functions.length, 1);
    assert.equal(ast.functions[0].name, 'len');
  });

  it('parse declarations in any order', function() {
    const { ast } = ParseDecls(
        `type Bool
         | true : Bool
         | false : Bool
         def not : (Bool) -> Bool
         | not(b) => b
         theorem foo (x : Int)
         | x = x`);
    assert.ok(ast);
    assert.equal(ast.types.length, 1);
    assert.equal(ast.functions.length, 1);
    assert.equal(ast.theorems.length, 1);
  });

  it('error on empty input', function() {
    const { ast, error } = ParseDecls('');
    assert.equal(ast, undefined);
    assert.ok(error);
  });

  it('error on invalid syntax', function() {
    const { ast, error } = ParseDecls('foo bar');
    assert.equal(ast, undefined);
    assert.ok(error);
  });

  // --- Theorem declarations ---

  it('parse theorem without premise (pipe syntax)', function() {
    const { ast } = ParseDecls(
        `theorem foo (x : Int)
         | x + 1 = 1 + x`);
    assert.ok(ast);
    assert.equal(ast.theorems.length, 1);
    assert.equal(ast.theorems[0].name, 'foo');
    assert.deepEqual(ast.theorems[0].params, [['x', 'Int']]);
    assert.equal(ast.theorems[0].premise, undefined);
    assert.strictEqual(ast.theorems[0].conclusion.op, '=');
  });

  it('parse theorem with premise', function() {
    const { ast } = ParseDecls(
        `theorem foo (x : Int)
         | x < 0 => 0 < x * x`);
    assert.ok(ast, 'parse failed');
    assert.equal(ast.theorems.length, 1);
    assert.ok(ast.theorems[0].premise);
    assert.strictEqual(ast.theorems[0].premise!.op, '<');
    assert.strictEqual(ast.theorems[0].conclusion.op, '<');
  });

  it('parse theorem with multiple params of same type', function() {
    const { ast } = ParseDecls(
        `type List
         | nil : List
         | cons : (Int, List) -> List
         def concat : (List, List) -> List
         | concat(nil, R) => R
         | concat(cons(a, L), R) => cons(a, concat(L, R))
         theorem concat_assoc (R, S, T : List)
         | concat(concat(R, S), T) = concat(R, concat(S, T))`);
    assert.ok(ast);
    assert.equal(ast.theorems.length, 1);
    assert.deepEqual(ast.theorems[0].params,
        [['R', 'List'], ['S', 'List'], ['T', 'List']]);
  });

  it('parse theorem with mixed param groups', function() {
    const { ast } = ParseDecls(
        `type List
         | nil : List
         | cons : (Int, List) -> List
         theorem foo (x : Int) (L, R : List)
         | x = x`);
    assert.ok(ast);
    assert.deepEqual(ast.theorems[0].params,
        [['x', 'Int'], ['L', 'List'], ['R', 'List']]);
  });

  it('parse theorem with uppercase param name', function() {
    const { ast } = ParseDecls(
        `type List
         | nil : List
         theorem foo (L : List)
         | L = L`);
    assert.ok(ast);
    assert.deepEqual(ast.theorems[0].params, [['L', 'List']]);
  });

  it('parse theorem mixed with other declarations', function() {
    const { ast } = ParseDecls(
        `def f : (Int) -> Int
         | f(x) => x + 1
         theorem foo (y : Int)
         | f(y) = y + 1`);
    assert.ok(ast);
    assert.equal(ast.functions.length, 1);
    assert.equal(ast.theorems.length, 1);
  });

});
