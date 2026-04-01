
import * as assert from 'assert';
import { Constant, Variable, Call } from '../facts/exprs';
import {
  FuncDef, Param, DeclStmt, AssignStmt, WhileStmt, IfStmt, PassStmt, ReturnStmt, Cond
} from './code_ast';
import { ParseCode } from './code_parser';


describe('code_parser', function() {

  it('parse empty function', function() {
    const { ast } = ParseCode(`Int foo() { }`);
    assert.ok(ast);
    assert.equal(ast.returnType, 'Int');
    assert.equal(ast.name, 'foo');
    assert.deepEqual(ast.params, []);
    assert.deepEqual(ast.body, []);
  });

  it('parse function with one param', function() {
    const { ast } = ParseCode(`Int double(Int x) { }`);
    assert.ok(ast);
    assert.equal(ast.name, 'double');
    assert.equal(ast.params.length, 1);
    assert.equal(ast.params[0].type, 'Int');
    assert.equal(ast.params[0].name, 'x');
  });

  it('parse function with multiple params', function() {
    const { ast } = ParseCode(`Int add(Int x, Int y) { }`);
    assert.ok(ast);
    assert.equal(ast.params.length, 2);
    assert.equal(ast.params[0].type, 'Int');
    assert.equal(ast.params[0].name, 'x');
    assert.equal(ast.params[1].type, 'Int');
    assert.equal(ast.params[1].name, 'y');
  });

  it('parse declaration statement', function() {
    const { ast } = ParseCode(`Int f() { Int x = 1; }`);
    assert.ok(ast);
    assert.equal(ast.body.length, 1);
    const stmt = ast.body[0];
    assert.ok(stmt instanceof DeclStmt);
    if (!(stmt instanceof DeclStmt)) return;
    assert.equal(stmt.type, 'Int');
    assert.equal(stmt.name, 'x');
    assert.ok(stmt.expr.equals(Constant.of(1n)));
  });

  it('parse assignment statement', function() {
    const { ast } = ParseCode(`Int f() { Int x = 0; x = 2; }`);
    assert.ok(ast);
    assert.equal(ast.body.length, 2);
    const stmt = ast.body[1];
    assert.ok(stmt instanceof AssignStmt);
    if (!(stmt instanceof AssignStmt)) return;
    assert.equal(stmt.name, 'x');
    assert.ok(stmt.expr.equals(Constant.of(2n)));
  });

  it('parse while loop', function() {
    const { ast } = ParseCode(`Int f(Int n) { while (n != 0) { n = n - 1; } }`);
    assert.ok(ast);
    assert.equal(ast.body.length, 1);
    const stmt = ast.body[0];
    assert.ok(stmt instanceof WhileStmt);
    if (!(stmt instanceof WhileStmt)) return;
    assert.equal(stmt.cond.op, '!=');
    assert.ok(stmt.cond.left.equals(Variable.of('n')));
    assert.ok(stmt.cond.right.equals(Constant.of(0n)));
    assert.equal(stmt.body.length, 1);
  });

  it('parse if/else', function() {
    const { ast } = ParseCode(`Int f(Int x) { if (x == 0) { pass; } else { x = 1; } }`);
    assert.ok(ast);
    assert.equal(ast.body.length, 1);
    const stmt = ast.body[0];
    assert.ok(stmt instanceof IfStmt);
    if (!(stmt instanceof IfStmt)) return;
    assert.equal(stmt.cond.op, '==');
    assert.ok(stmt.cond.left.equals(Variable.of('x')));
    assert.ok(stmt.cond.right.equals(Constant.of(0n)));
    assert.equal(stmt.thenBody.length, 1);
    assert.ok(stmt.thenBody[0] instanceof PassStmt);
    assert.equal(stmt.elseBody.length, 1);
  });

  it('parse pass statement', function() {
    const { ast } = ParseCode(`Int f() { pass; }`);
    assert.ok(ast);
    assert.equal(ast.body.length, 1);
    assert.ok(ast.body[0] instanceof PassStmt);
  });

  it('parse arithmetic expression', function() {
    const { ast } = ParseCode(`Int f(Int x) { Int y = x + 2; }`);
    assert.ok(ast);
    const stmt = ast.body[0];
    assert.ok(stmt instanceof DeclStmt);
    if (!(stmt instanceof DeclStmt)) return;
    assert.ok(stmt.expr.equals(Call.add(Variable.of('x'), Constant.of(2n))));
  });

  it('parse nested statements', function() {
    const { ast } = ParseCode(
        `Int gcd(Int a, Int b) {
           while (b != 0) {
             Int t = b;
             b = a - b;
             a = t;
           }
           pass;
         }`);
    assert.ok(ast);
    assert.equal(ast.body.length, 2);
    assert.ok(ast.body[0] instanceof WhileStmt);
    assert.ok(ast.body[1] instanceof PassStmt);
    const loop = ast.body[0] as WhileStmt;
    assert.equal(loop.body.length, 3);
  });

  it('parse return statement', function() {
    const { ast } = ParseCode(`Int f(Int x) { return x + 1; }`);
    assert.ok(ast);
    assert.equal(ast.body.length, 1);
    const stmt = ast.body[0];
    assert.ok(stmt instanceof ReturnStmt);
    if (!(stmt instanceof ReturnStmt)) return;
    assert.ok(stmt.expr.equals(Call.add(Variable.of('x'), Constant.of(1n))));
  });

  it('records line/col on FuncDef', function() {
    const { ast } = ParseCode(`Int f() { }`);
    assert.ok(ast);
    assert.equal(ast.line, 1);
    assert.equal(ast.col, 1);
  });

  it('records line/col on Param', function() {
    const { ast } = ParseCode(`Int f(Int x) { }`);
    assert.ok(ast);
    assert.equal(ast.params[0].line, 1);
    assert.ok(ast.params[0].col > 0);
  });

  it('records line/col on DeclStmt', function() {
    const { ast } = ParseCode(`Int f() { Int x = 1; }`);
    assert.ok(ast);
    assert.equal(ast.body[0].line, 1);
    assert.ok(ast.body[0].col > 0);
  });

  it('records line/col on AssignStmt', function() {
    const { ast } = ParseCode(`Int f(Int x) { x = 1; }`);
    assert.ok(ast);
    assert.equal(ast.body[0].line, 1);
    assert.ok(ast.body[0].col > 0);
  });

  it('records line/col on WhileStmt', function() {
    const { ast } = ParseCode(`Int f(Int n) { while (n != 0) { pass; } }`);
    assert.ok(ast);
    assert.equal(ast.body[0].line, 1);
    assert.ok(ast.body[0].col > 0);
  });

  it('records line/col on IfStmt', function() {
    const { ast } = ParseCode(`Int f(Int x) { if (x == 0) { pass; } else { pass; } }`);
    assert.ok(ast);
    assert.equal(ast.body[0].line, 1);
    assert.ok(ast.body[0].col > 0);
  });

  it('records line/col on PassStmt', function() {
    const { ast } = ParseCode(`Int f() { pass; }`);
    assert.ok(ast);
    assert.equal(ast.body[0].line, 1);
    assert.ok(ast.body[0].col > 0);
  });

  it('records line/col on ReturnStmt', function() {
    const { ast } = ParseCode(`Int f(Int x) { return x; }`);
    assert.ok(ast);
    assert.equal(ast.body[0].line, 1);
    assert.ok(ast.body[0].col > 0);
  });

  it('parse condition with <', function() {
    const { ast } = ParseCode(`Int f(Int x) { while (x < 10) { pass; } }`);
    assert.ok(ast);
    const loop = ast.body[0] as WhileStmt;
    assert.equal(loop.cond.op, '<');
  });

  it('parse condition with <=', function() {
    const { ast } = ParseCode(`Int f(Int x) { while (x <= 10) { pass; } }`);
    assert.ok(ast);
    const loop = ast.body[0] as WhileStmt;
    assert.equal(loop.cond.op, '<=');
  });

  it('parse condition with >', function() {
    const { ast } = ParseCode(`Int f(Int x) { while (x > 0) { pass; } }`);
    assert.ok(ast);
    const loop = ast.body[0] as WhileStmt;
    assert.equal(loop.cond.op, '>');
  });

  it('parse condition with >=', function() {
    const { ast } = ParseCode(`Int f(Int x) { while (x >= 0) { pass; } }`);
    assert.ok(ast);
    const loop = ast.body[0] as WhileStmt;
    assert.equal(loop.cond.op, '>=');
  });

  it('records line/col on Cond', function() {
    const { ast } = ParseCode(`Int f(Int n) { while (n != 0) { pass; } }`);
    assert.ok(ast);
    const loop = ast.body[0] as WhileStmt;
    assert.equal(loop.cond.line, 1);
    assert.ok(loop.cond.col > 0);
  });

  it('records correct line for multiline function', function() {
    const { ast } = ParseCode(`Int f(Int n) {\n  while (n != 0) {\n    pass;\n  }\n}`);
    assert.ok(ast);
    assert.equal(ast.body[0].line, 2);
  });

  it('error on missing else', function() {
    const { ast, error } = ParseCode(`Int f() { if (x == 0) { pass; } }`);
    assert.equal(ast, undefined);
    assert.ok(error);
  });

  it('error on syntax error', function() {
    const { ast, error } = ParseCode(`Int f(`);
    assert.equal(ast, undefined);
    assert.ok(error);
  });

});
