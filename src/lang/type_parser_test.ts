
import * as assert from 'assert';
import { TypeDeclAst, ConstructorAst } from './type_ast';
import { ParseTypeDecl } from './type_parser';


describe('type_parser', function() {

  it('parse simple enum type', function() {
    const { ast } = ParseTypeDecl(
        `type Bool
         | true : Bool
         | false : Bool`);
    assert.ok(ast);
    assert.equal(ast.name, 'Bool');
    assert.equal(ast.constructors.length, 2);
    assert.deepEqual(ast.constructors[0],
        new ConstructorAst('true', [], 'Bool'));
    assert.deepEqual(ast.constructors[1],
        new ConstructorAst('false', [], 'Bool'));
  });

  it('parse list type', function() {
    const { ast } = ParseTypeDecl(
        `type List
         | nil : List
         | cons : (Int, List) -> List`);
    assert.ok(ast);
    assert.equal(ast.name, 'List');
    assert.equal(ast.constructors.length, 2);
    assert.deepEqual(ast.constructors[0],
        new ConstructorAst('nil', [], 'List'));
    assert.deepEqual(ast.constructors[1],
        new ConstructorAst('cons', ['Int', 'List'], 'List'));
  });

  it('parse tree type', function() {
    const { ast } = ParseTypeDecl(
        `type Tree
         | leaf : Tree
         | node : (Tree, Int, Tree) -> Tree`);
    assert.ok(ast);
    assert.equal(ast.name, 'Tree');
    assert.equal(ast.constructors.length, 2);
    assert.deepEqual(ast.constructors[0],
        new ConstructorAst('leaf', [], 'Tree'));
    assert.deepEqual(ast.constructors[1],
        new ConstructorAst('node', ['Tree', 'Int', 'Tree'], 'Tree'));
  });

  it('parse single constructor type', function() {
    const { ast } = ParseTypeDecl(
        `type Wrapper
         | wrap : (Int) -> Wrapper`);
    assert.ok(ast);
    assert.equal(ast.constructors.length, 1);
    assert.deepEqual(ast.constructors[0],
        new ConstructorAst('wrap', ['Int'], 'Wrapper'));
  });

  it('error on missing constructors', function() {
    const { ast, error } = ParseTypeDecl(`type Foo`);
    assert.equal(ast, undefined);
    assert.ok(error);
  });

  it('error on syntax error', function() {
    const { ast, error } = ParseTypeDecl(`type Foo | bar`);
    assert.equal(ast, undefined);
    assert.ok(error);
  });

  it('error on mismatched constructor return type', function() {
    const { ast, error } = ParseTypeDecl(
        `type List
         | nil : List
         | cons : (Int, List) -> Wrong`);
    assert.equal(ast, undefined);
    assert.ok(error);
    assert.ok(error.includes('expected "List"'));
    assert.ok(error.includes('found "Wrong"'));
  });

});
