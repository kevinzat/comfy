
import * as assert from 'assert';
import { Constant, Variable } from '../facts/exprs';
import { FuncDef, Param, DeclStmt, AssignStmt, ReturnStmt, WhileStmt, PassStmt, Cond } from '../lang/code_ast';
import { TopLevelEnv, NestedEnv } from './env';
import { UnknownTypeError, TypeMismatchError, UnknownNameError } from './checker';
import { checkFuncDef, UnknownVariableError, MissingReturnError } from './code_checker';
import { ParseCode } from '../lang/code_parser';
import { TypeDeclAst, ConstructorAst } from '../lang/type_ast';


const listType = new TypeDeclAst('List', [
  new ConstructorAst('nil', [], 'List'),
  new ConstructorAst('cons', ['Int', 'List'], 'List'),
]);

function makeEnv() {
  return new TopLevelEnv([], []);
}

/** Env that also has a List type, so we can produce non-Int variables. */
function makeEnvWithList() {
  return new TopLevelEnv([listType], []);
}

function parse(src: string): FuncDef {
  const { ast, error } = ParseCode(src);
  if (!ast) throw new Error(error ?? 'parse failed');
  return ast;
}


describe('checkFuncDef', function() {

  it('accepts empty function', function() {
    const env = makeEnv();
    assert.doesNotThrow(() => checkFuncDef(env, parse(`Int f() { return 0; }`)));
  });

  it('accepts function with params and return', function() {
    const env = makeEnv();
    assert.doesNotThrow(() => checkFuncDef(env, parse(`Int double(Int x) { return x + 1; }`)));
  });

  it('throws UnknownTypeError for unknown return type', function() {
    const env = makeEnv();
    assert.throws(() => checkFuncDef(env, new FuncDef('Foo', 'f', [], [])),
        UnknownTypeError);
  });

  it('throws UnknownTypeError for unknown param type', function() {
    const env = makeEnv();
    assert.throws(() => checkFuncDef(env, new FuncDef('Int', 'f', [new Param('Foo', 'x')], [])),
        UnknownTypeError);
  });

  it('params are in scope for the body', function() {
    const env = makeEnv();
    assert.doesNotThrow(() => checkFuncDef(env, parse(`Int f(Int a, Int b) { return a + b; }`)));
  });

  it('accepts decl statement with matching type', function() {
    const env = makeEnv();
    assert.doesNotThrow(() => checkFuncDef(env, parse(`Int f() { Int x = 1; return x; }`)));
  });

  it('throws UnknownTypeError for unknown decl type', function() {
    const env = makeEnv();
    assert.throws(
        () => checkFuncDef(env, new FuncDef('Int', 'f', [], [
          new DeclStmt('Foo', 'x', Constant.of(1n)),
        ])),
        UnknownTypeError);
  });

  it('throws UnknownVariableError for assignment to undeclared variable', function() {
    const env = makeEnv();
    assert.throws(
        () => checkFuncDef(env, new FuncDef('Int', 'f', [], [
          new AssignStmt('x', Constant.of(1n)),
        ])),
        UnknownVariableError);
  });

  it('accepts assignment to declared variable', function() {
    const env = makeEnv();
    assert.doesNotThrow(() => checkFuncDef(env, parse(`Int f(Int x) { x = 5; return x; }`)));
  });

  it('decl variable is in scope for subsequent statements', function() {
    const env = makeEnv();
    assert.doesNotThrow(() => checkFuncDef(env, parse(`Int f() { Int x = 1; x = 2; return x; }`)));
  });

  it('decl variable is NOT in scope for its own initializer', function() {
    const env = makeEnv();
    assert.throws(
        () => checkFuncDef(env, new FuncDef('Int', 'f', [], [
          new DeclStmt('Int', 'x', Variable.of('x')),
        ])),
        UnknownNameError);
  });

  it('throws UnknownVariableError for assignment before decl', function() {
    const env = makeEnv();
    assert.throws(
        () => checkFuncDef(env, new FuncDef('Int', 'f', [], [
          new AssignStmt('x', Constant.of(1n)),
          new DeclStmt('Int', 'x', Constant.of(0n)),
        ])),
        UnknownVariableError);
  });

  it('accepts while loop with valid condition and body', function() {
    const env = makeEnv();
    assert.doesNotThrow(() =>
        checkFuncDef(env, parse(`Int f(Int n) { while (n != 0) { n = n - 1; } return n; }`)));
  });

  it('accepts while with < condition on Int operands', function() {
    const env = makeEnv();
    assert.doesNotThrow(() =>
        checkFuncDef(env, parse(`Int f(Int n) { while (n < 10) { n = n + 1; } return n; }`)));
  });

  it('accepts while with <= condition on Int operands', function() {
    const env = makeEnv();
    assert.doesNotThrow(() =>
        checkFuncDef(env, parse(`Int f(Int n) { while (n <= 10) { n = n + 1; } return n; }`)));
  });

  it('accepts while with > condition on Int operands', function() {
    const env = makeEnv();
    assert.doesNotThrow(() =>
        checkFuncDef(env, parse(`Int f(Int n) { while (n > 0) { n = n - 1; } return n; }`)));
  });

  it('accepts while with >= condition on Int operands', function() {
    const env = makeEnv();
    assert.doesNotThrow(() =>
        checkFuncDef(env, parse(`Int f(Int n) { while (n >= 0) { n = n - 1; } return n; }`)));
  });

  it('accepts if statement with valid condition and branches', function() {
    const env = makeEnv();
    assert.doesNotThrow(() =>
        checkFuncDef(env, parse(`Int f(Int x) { if (x == 0) { return 0; } else { return x + 1; } }`)));
  });

  it('accepts if with < condition on Int operands', function() {
    const env = makeEnv();
    assert.doesNotThrow(() =>
        checkFuncDef(env, parse(`Int f(Int x) { if (x < 10) { return x; } else { return x; } }`)));
  });

  it('throws TypeMismatchError for < when both operands are non-Int', function() {
    const env = makeEnvWithList();
    // Both sides are List — currently passes the type-equality check but must fail the Int check
    const func = new FuncDef('Int', 'f', [new Param('List', 'xs'), new Param('List', 'ys')], [
      new WhileStmt(new Cond(Variable.of('xs'), '<', Variable.of('ys')), [new PassStmt()]),
      new PassStmt(),
    ]);
    assert.throws(() => checkFuncDef(env, func), TypeMismatchError);
  });

  it('throws TypeMismatchError for < with non-Int left operand', function() {
    const env = makeEnvWithList();
    // Param "xs" has type List; using it with < should require Int
    const func = new FuncDef('Int', 'f', [new Param('List', 'xs')], [
      new WhileStmt(new Cond(Variable.of('xs'), '<', Constant.of(0n)), [new PassStmt()]),
      new PassStmt(),
    ]);
    assert.throws(() => checkFuncDef(env, func), TypeMismatchError);
  });

  it('throws TypeMismatchError for < with non-Int right operand', function() {
    const env = makeEnvWithList();
    const func = new FuncDef('Int', 'f', [new Param('List', 'xs')], [
      new WhileStmt(new Cond(Constant.of(0n), '<', Variable.of('xs')), [new PassStmt()]),
      new PassStmt(),
    ]);
    assert.throws(() => checkFuncDef(env, func), TypeMismatchError);
  });

  it('throws TypeMismatchError for <= with non-Int operand', function() {
    const env = makeEnvWithList();
    const func = new FuncDef('Int', 'f', [new Param('List', 'xs')], [
      new WhileStmt(new Cond(Variable.of('xs'), '<=', Constant.of(0n)), [new PassStmt()]),
      new PassStmt(),
    ]);
    assert.throws(() => checkFuncDef(env, func), TypeMismatchError);
  });

  it('throws TypeMismatchError for > with non-Int operand', function() {
    const env = makeEnvWithList();
    const func = new FuncDef('Int', 'f', [new Param('List', 'xs')], [
      new WhileStmt(new Cond(Variable.of('xs'), '>', Constant.of(0n)), [new PassStmt()]),
      new PassStmt(),
    ]);
    assert.throws(() => checkFuncDef(env, func), TypeMismatchError);
  });

  it('throws TypeMismatchError for >= with non-Int operand', function() {
    const env = makeEnvWithList();
    const func = new FuncDef('Int', 'f', [new Param('List', 'xs')], [
      new WhileStmt(new Cond(Variable.of('xs'), '>=', Constant.of(0n)), [new PassStmt()]),
      new PassStmt(),
    ]);
    assert.throws(() => checkFuncDef(env, func), TypeMismatchError);
  });

  it('outer variables are accessible inside while body', function() {
    const env = makeEnv();
    assert.doesNotThrow(() => checkFuncDef(env, parse(
        `Int f(Int n) { Int x = 0; while (n != 0) { x = x + 1; n = n - 1; } return x; }`)));
  });

  it('outer variables are accessible inside if branches', function() {
    const env = makeEnv();
    assert.doesNotThrow(() => checkFuncDef(env, parse(
        `Int f(Int x) { Int y = 0; if (x == 0) { y = 1; } else { y = 2; } return y; }`)));
  });

  it('accepts return statement with matching type', function() {
    const env = makeEnv();
    assert.doesNotThrow(() => checkFuncDef(env, parse(`Int f(Int x) { return x + 1; }`)));
  });

  it('throws TypeMismatchError for return with wrong type', function() {
    // returning an Int from a function but with a mismatched declared return type
    const env = makeEnv();
    assert.throws(
        () => checkFuncDef(env, new FuncDef('Int', 'f', [], [
          new ReturnStmt(Variable.of('z')),
        ])),
        UnknownNameError);
  });

  it('error message includes line number for unknown variable', function() {
    const env = makeEnv();
    const func = parse(`Int f() {\n  x = 1;\n}`);
    let err: Error | undefined;
    try {
      checkFuncDef(env, func);
    } catch (e: any) {
      err = e;
    }
    assert.ok(err);
    assert.ok(err.message.includes('line 2'), `expected "line 2" in: ${err.message}`);
  });

  it('error message includes line number for assignment type mismatch', function() {
    const env = makeEnv();
    const func = parse(`Int f(Int x) {\n  y = 1;\n}`);
    let err: Error | undefined;
    try {
      checkFuncDef(env, func);
    } catch (e: any) {
      err = e;
    }
    assert.ok(err);
    assert.ok(err.message.includes('line 2'), `expected "line 2" in: ${err.message}`);
  });

  it('error message includes line number for unknown name in expression', function() {
    const env = makeEnv();
    // Variable node at line 3 references unknown name z
    const func = new FuncDef('Int', 'f', [], [
      new PassStmt(),
      new PassStmt(),
      new ReturnStmt(new Variable('z', 3, 10), 3, 3),
    ]);
    let err: Error | undefined;
    try { checkFuncDef(env, func); } catch (e: any) { err = e; }
    assert.ok(err);
    assert.ok(err.message.includes('line 3'), `expected "line 3" in: ${err.message}`);
  });

  it('error message includes line number for unknown type in decl', function() {
    const env = makeEnv();
    const func = new FuncDef('Int', 'f', [], [
      new DeclStmt('Foo', 'x', Constant.of(1n), 2, 5),
    ]);
    let err: Error | undefined;
    try { checkFuncDef(env, func); } catch (e: any) { err = e; }
    assert.ok(err);
    assert.ok(err.message.includes('line 2'), `expected "line 2" in: ${err.message}`);
  });

  it('error message includes line number for unknown param type', function() {
    const env = makeEnv();
    const func = new FuncDef('Int', 'f', [new Param('Foo', 'x', 1, 7)], []);
    let err: Error | undefined;
    try { checkFuncDef(env, func); } catch (e: any) { err = e; }
    assert.ok(err);
    assert.ok(err.message.includes('line 1'), `expected "line 1" in: ${err.message}`);
  });

  it('error message includes line number for unknown return type', function() {
    const env = makeEnv();
    const func = new FuncDef('Foo', 'f', [], [], [], [], 1, 1);
    let err: Error | undefined;
    try { checkFuncDef(env, func); } catch (e: any) { err = e; }
    assert.ok(err);
    assert.ok(err.message.includes('line 1'), `expected "line 1" in: ${err.message}`);
  });

  it('accepts function with valid requires condition', function() {
    const env = makeEnv();
    assert.doesNotThrow(() => checkFuncDef(env, parse(
        `Int f(Int x) requires x >= 0 { return x; }`)));
  });

  it('accepts function with valid ensures condition', function() {
    const env = makeEnv();
    assert.doesNotThrow(() => checkFuncDef(env, parse(
        `Int f(Int x) ensures x >= 0 { return x; }`)));
  });

  it('accepts function with valid requires and ensures', function() {
    const env = makeEnv();
    assert.doesNotThrow(() => checkFuncDef(env, parse(
        `Int f(Int x) requires x >= 0 ensures x >= 1 { return x; }`)));
  });

  it('throws TypeMismatchError for requires condition with non-Int operand in < comparison', function() {
    const env = makeEnvWithList();
    const func = new FuncDef('Int', 'f', [new Param('List', 'xs')], [],
        [new Cond(Variable.of('xs'), '<', Constant.of(0n))], []);
    assert.throws(() => checkFuncDef(env, func), TypeMismatchError);
  });

  it('throws TypeMismatchError for ensures condition with non-Int operand in < comparison', function() {
    const env = makeEnvWithList();
    const func = new FuncDef('Int', 'f', [new Param('List', 'xs')], [],
        [], [new Cond(Variable.of('xs'), '<', Constant.of(0n))]);
    assert.throws(() => checkFuncDef(env, func), TypeMismatchError);
  });

  it('throws UnknownNameError for requires condition referencing unknown variable', function() {
    const env = makeEnv();
    const func = new FuncDef('Int', 'f', [], [],
        [new Cond(Variable.of('z'), '>=', Constant.of(0n))], []);
    assert.throws(() => checkFuncDef(env, func), UnknownNameError);
  });

  it('rv is in scope in ensures', function() {
    const env = makeEnv();
    assert.doesNotThrow(() => checkFuncDef(env, parse(
        `Int f(Int x) ensures rv >= 0 { return x; }`)));
  });

  it('rv has the return type of the function in ensures', function() {
    const env = makeEnvWithList();
    // rv has type List (the return type), so rv == xs where xs: List should type-check
    assert.doesNotThrow(() => checkFuncDef(env, parse(
        `List f(List xs) ensures rv == xs { return xs; }`)));
    // rv (type List) used with < should fail since < requires Int
    const func = new FuncDef('List', 'f', [new Param('List', 'xs')], [],
        [], [new Cond(Variable.of('rv'), '<', Constant.of(0n))]);
    assert.throws(() => checkFuncDef(env, func), TypeMismatchError);
  });

  it('rv is not in scope in requires', function() {
    const env = makeEnv();
    const func = new FuncDef('Int', 'f', [], [],
        [new Cond(Variable.of('rv'), '>=', Constant.of(0n))], []);
    assert.throws(() => checkFuncDef(env, func), UnknownNameError);
  });

  it('rv is not in scope in the body', function() {
    const env = makeEnv();
    assert.throws(
        () => checkFuncDef(env, parse(`Int f() { Int x = rv + 1; }`)),
        UnknownNameError);
  });

  it('throws MissingReturnError for empty function body', function() {
    const env = makeEnv();
    assert.throws(() => checkFuncDef(env, parse(`Int f() { }`)), MissingReturnError);
  });

  it('throws MissingReturnError for function body ending with pass', function() {
    const env = makeEnv();
    assert.throws(() => checkFuncDef(env, parse(`Int f(Int x) { pass; }`)), MissingReturnError);
  });

  it('throws MissingReturnError for function body ending with while', function() {
    const env = makeEnv();
    assert.throws(
        () => checkFuncDef(env, parse(`Int f(Int n) { while (n != 0) { n = n - 1; } }`)),
        MissingReturnError);
  });

  it('throws MissingReturnError for function body ending with decl', function() {
    const env = makeEnv();
    assert.throws(
        () => checkFuncDef(env, parse(`Int f() { Int x = 1; }`)),
        MissingReturnError);
  });

  it('accepts function body ending with if where both branches return', function() {
    const env = makeEnv();
    assert.doesNotThrow(() => checkFuncDef(env, parse(
        `Int f(Int x) { if (x == 0) { return 0; } else { return x; } }`)));
  });

  it('throws MissingReturnError for if where then branch does not return', function() {
    const env = makeEnv();
    assert.throws(
        () => checkFuncDef(env, parse(
            `Int f(Int x) { if (x == 0) { pass; } else { return x; } }`)),
        MissingReturnError);
  });

  it('throws MissingReturnError for if where else branch does not return', function() {
    const env = makeEnv();
    assert.throws(
        () => checkFuncDef(env, parse(
            `Int f(Int x) { if (x == 0) { return 0; } else { pass; } }`)),
        MissingReturnError);
  });

  it('accepts nested if where all branches return', function() {
    const env = makeEnv();
    assert.doesNotThrow(() => checkFuncDef(env, parse(
        `Int f(Int x) { if (x == 0) { return 0; } else { if (x == 1) { return 1; } else { return x; } } }`)));
  });

  it('throws MissingReturnError for nested if where inner else does not return', function() {
    const env = makeEnv();
    assert.throws(
        () => checkFuncDef(env, parse(
            `Int f(Int x) { if (x == 0) { return 0; } else { if (x == 1) { return 1; } else { pass; } } }`)),
        MissingReturnError);
  });

});
