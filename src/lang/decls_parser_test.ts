
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
    assert.equal(ast.variables.length, 0);
  });

  it('parse single function definition', function() {
    const { ast } = ParseDecls(
        `def f : (Int) -> Int
         | f(x) => x + 1`);
    assert.ok(ast);
    assert.equal(ast.types.length, 0);
    assert.equal(ast.functions.length, 1);
    assert.equal(ast.functions[0].name, 'f');
    assert.equal(ast.variables.length, 0);
  });

  it('parse single variable declaration', function() {
    const { ast } = ParseDecls(`var x : Int`);
    assert.ok(ast);
    assert.equal(ast.types.length, 0);
    assert.equal(ast.functions.length, 0);
    assert.equal(ast.variables.length, 1);
    assert.deepEqual(ast.variables[0], ['x', 'Int']);
  });

  it('parse mixed declarations', function() {
    const { ast } = ParseDecls(
        `type List
         | nil : List
         | cons : (Int, List) -> List
         var x : Int
         var L : List
         def len : (List) -> Int
         | len(nil) => 0
         | len(cons(a, rest)) => 1 + len(rest)`);
    assert.ok(ast);
    assert.equal(ast.types.length, 1);
    assert.equal(ast.types[0].name, 'List');
    assert.equal(ast.variables.length, 2);
    assert.deepEqual(ast.variables[0], ['x', 'Int']);
    assert.deepEqual(ast.variables[1], ['L', 'List']);
    assert.equal(ast.functions.length, 1);
    assert.equal(ast.functions[0].name, 'len');
  });

  it('parse declarations in any order', function() {
    const { ast } = ParseDecls(
        `var x : Int
         type Bool
         | true : Bool
         | false : Bool
         var y : Bool
         def not : (Bool) -> Bool
         | not(b) => b`);
    assert.ok(ast);
    assert.equal(ast.types.length, 1);
    assert.equal(ast.variables.length, 2);
    assert.equal(ast.functions.length, 1);
  });

  it('parse multiple variable declarations', function() {
    const { ast } = ParseDecls(
        `var x : Int
         var y : Int
         var z : Int`);
    assert.ok(ast);
    assert.equal(ast.variables.length, 3);
    assert.deepEqual(ast.variables[0], ['x', 'Int']);
    assert.deepEqual(ast.variables[1], ['y', 'Int']);
    assert.deepEqual(ast.variables[2], ['z', 'Int']);
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

});
