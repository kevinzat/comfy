
import * as assert from 'assert';
import { TypeDeclAst, ConstructorAst } from '../lang/type_ast';
import { FuncAst, TypeAst, CaseAst, ExprBody, IfElseBody, ParamVar, ParamConstructor } from '../lang/func_ast';
import { Constant, Variable, Call } from '../facts/exprs';
import { TopLevelEnv, NestedEnv } from './env';
import { Formula, OP_EQUAL, OP_LESS_THAN, OP_LESS_EQUAL } from '../facts/formula';
import { getType, checkExpr, checkFuncDecl, checkFormula, checkProp, UnknownTypeError,
    UnknownNameError, ArityError, TypeMismatchError } from './checker';
import { AtomProp, OrProp, ConstProp } from '../facts/prop';
import { NamedType, FunctionType } from './type';


const listType = new TypeDeclAst('List', [
  new ConstructorAst('nil', [], 'List'),
  new ConstructorAst('cons', ['Int', 'List'], 'List'),
]);

const lenFunc = new FuncAst('len', new TypeAst(['List'], 'Int'), [
  new CaseAst([new ParamVar('nil')], new ExprBody(Constant.of(0n))),
  new CaseAst([new ParamVar('x')],
      new ExprBody(Call.add(Constant.of(1n), Call.of('len', Variable.of('x'))))),
]);


describe('getType', function() {

  it('resolves built-in type name to NamedType', function() {
    const env = new TopLevelEnv([], []);
    const t = getType(env, 'Int');
    assert.equal(t.kind, 'named');
    assert.equal(t.name, 'Int');
  });

  it('resolves user-defined type name to NamedType', function() {
    const env = new TopLevelEnv([listType], []);
    const t = getType(env, 'List');
    assert.equal(t.kind, 'named');
    assert.equal(t.name, 'List');
  });

  it('resolves TypeAst to FunctionType', function() {
    const env = new TopLevelEnv([listType], []);
    const ft = getType(env, new TypeAst(['List'], 'Int'));
    assert.equal(ft.kind, 'function');
    assert.equal(ft.paramTypes.length, 1);
    assert.equal(ft.paramTypes[0].name, 'List');
    assert.equal(ft.returnType.name, 'Int');
  });

  it('resolves multi-param TypeAst', function() {
    const env = new TopLevelEnv([listType], []);
    const ft = getType(env, new TypeAst(['Int', 'List'], 'List'));
    assert.equal(ft.kind, 'function');
    assert.equal(ft.paramTypes.length, 2);
    assert.equal(ft.paramTypes[0].name, 'Int');
    assert.equal(ft.paramTypes[1].name, 'List');
    assert.equal(ft.returnType.name, 'List');
  });

  it('throws UnknownTypeError for unknown type name', function() {
    const env = new TopLevelEnv([], []);
    assert.throws(() => getType(env, 'Foo'), UnknownTypeError);
  });

  it('throws UnknownTypeError for unknown param type in TypeAst', function() {
    const env = new TopLevelEnv([], []);
    assert.throws(
        () => getType(env, new TypeAst(['Foo'], 'Int')),
        UnknownTypeError);
  });

  it('throws UnknownTypeError for unknown return type in TypeAst', function() {
    const env = new TopLevelEnv([], []);
    assert.throws(
        () => getType(env, new TypeAst(['Int'], 'Foo')),
        UnknownTypeError);
  });

});


describe('checkExpr', function() {

  const env = new NestedEnv(new TopLevelEnv([listType], [lenFunc]), [['x', 'Int'], ['L', 'List']]);

  it('constant returns Int', function() {
    assert.equal(checkExpr(env, Constant.of(42n)).name, 'Int');
  });

  it('variable returns its declared type', function() {
    assert.equal(checkExpr(env, Variable.of('x')).name, 'Int');
    assert.equal(checkExpr(env, Variable.of('L')).name, 'List');
  });

  it('zero-arg constructor as variable returns its type', function() {
    assert.equal(checkExpr(env, Variable.of('nil')).name, 'List');
  });

  it('constructor call returns its return type', function() {
    const expr = Call.of('cons', Constant.of(1n), Variable.of('nil'));
    assert.equal(checkExpr(env, expr).name, 'List');
  });

  it('function call returns its return type', function() {
    const expr = Call.of('len', Variable.of('L'));
    assert.equal(checkExpr(env, expr).name, 'Int');
  });

  it('built-in arithmetic returns Int', function() {
    assert.equal(checkExpr(env, Call.add(Variable.of('x'), Constant.of(1n))).name, 'Int');
    assert.equal(checkExpr(env, Call.negate(Variable.of('x'))).name, 'Int');
    assert.equal(checkExpr(env, Call.multiply(Constant.of(2n), Variable.of('x'))).name, 'Int');
  });

  it('nested expression: 1 + len(L)', function() {
    const expr = Call.add(Constant.of(1n), Call.of('len', Variable.of('L')));
    assert.equal(checkExpr(env, expr).name, 'Int');
  });

  it('throws UnknownNameError for unknown variable', function() {
    assert.throws(
        () => checkExpr(env, Variable.of('y')),
        UnknownNameError);
  });

  it('throws UnknownNameError for unknown function call', function() {
    assert.throws(
        () => checkExpr(env, Call.of('unknown', Constant.of(1n))),
        UnknownNameError);
  });

  it('throws ArityError for wrong number of arguments', function() {
    assert.throws(
        () => checkExpr(env, Call.of('len', Constant.of(1n), Constant.of(2n))),
        ArityError);
  });

  it('throws ArityError for multi-arg constructor referenced as a bare variable', function() {
    assert.throws(
        () => checkExpr(env, Variable.of('cons')),
        ArityError);
  });

  it('throws ArityError for calling zero-arg constructor with args', function() {
    assert.throws(
        () => checkExpr(env, Call.of('nil', Constant.of(1n))),
        ArityError);
  });

  it('throws TypeMismatchError for wrong argument type', function() {
    // len expects List, not Int
    assert.throws(
        () => checkExpr(env, Call.of('len', Constant.of(1n))),
        TypeMismatchError);
  });

  it('throws TypeMismatchError for wrong constructor argument type', function() {
    // cons expects (Int, List), passing (List, Int) should fail
    assert.throws(
        () => checkExpr(env, Call.of('cons', Variable.of('nil'), Constant.of(1n))),
        TypeMismatchError);
  });

  it('throws TypeMismatchError for non-Int in arithmetic', function() {
    // nil + 1 should fail because nil is List, not Int
    assert.throws(
        () => checkExpr(env, Call.add(Variable.of('nil'), Constant.of(1n))),
        TypeMismatchError);
  });

});


describe('checkFormula', function() {

  const env = new NestedEnv(new TopLevelEnv([listType], [lenFunc]), [['x', 'Int'], ['L', 'List']]);

  it('accepts = with matching types (Int)', function() {
    checkFormula(env, new Formula(Variable.of('x'), OP_EQUAL, Constant.of(1n)));
  });

  it('accepts = with matching types (List)', function() {
    checkFormula(env, new Formula(Variable.of('L'), OP_EQUAL, Variable.of('nil')));
  });

  it('accepts < with Int on both sides', function() {
    checkFormula(env, new Formula(Variable.of('x'), OP_LESS_THAN, Constant.of(5n)));
  });

  it('accepts <= with Int on both sides', function() {
    checkFormula(env, new Formula(Constant.of(0n), OP_LESS_EQUAL, Variable.of('x')));
  });

  it('throws TypeMismatchError for = with different types', function() {
    assert.throws(
        () => checkFormula(env, new Formula(Variable.of('x'), OP_EQUAL, Variable.of('L'))),
        TypeMismatchError);
  });

  it('throws TypeMismatchError for < with non-Int left side', function() {
    assert.throws(
        () => checkFormula(env, new Formula(Variable.of('L'), OP_LESS_THAN, Constant.of(1n))),
        TypeMismatchError);
  });

  it('throws TypeMismatchError for <= with non-Int right side', function() {
    assert.throws(
        () => checkFormula(env, new Formula(Constant.of(1n), OP_LESS_EQUAL, Variable.of('L'))),
        TypeMismatchError);
  });

});


describe('checkProp', function() {

  const env = new NestedEnv(new TopLevelEnv([listType], [lenFunc]), [['x', 'Int'], ['L', 'List']]);

  it('accepts or-prop with valid formulas', function() {
    const f1 = new Formula(Variable.of('x'), OP_EQUAL, Constant.of(1n));
    const f2 = new Formula(Variable.of('x'), OP_EQUAL, Constant.of(2n));
    assert.doesNotThrow(() => checkProp(env, new OrProp([new AtomProp(f1), new AtomProp(f2)])));
  });

  it('accepts const-prop without any type checking', function() {
    assert.doesNotThrow(() => checkProp(env, new ConstProp(true)));
    assert.doesNotThrow(() => checkProp(env, new ConstProp(false)));
  });

});


describe('checkFuncDecl', function() {

  const env = new TopLevelEnv([listType], [lenFunc]);

  it('accepts valid function with simple params', function() {
    const f = new FuncAst('f', new TypeAst(['Int'], 'Int'), [
      new CaseAst([new ParamVar('x')],
          new ExprBody(Call.add(Variable.of('x'), Constant.of(1n)))),
    ]);
    checkFuncDecl(env, f);
  });

  it('accepts valid function with constructor patterns', function() {
    checkFuncDecl(env, lenFunc);
  });

  it('throws ArityError for wrong param count', function() {
    const f = new FuncAst('f', new TypeAst(['Int', 'Int'], 'Int'), [
      new CaseAst([new ParamVar('x')], new ExprBody(Variable.of('x'))),
    ]);
    assert.throws(() => checkFuncDecl(env, f), ArityError);
  });

  it('throws TypeMismatchError for wrong return type', function() {
    // Declared as returning Int, but body returns List
    const f = new FuncAst('f', new TypeAst(['Int'], 'Int'), [
      new CaseAst([new ParamVar('x')], new ExprBody(Variable.of('nil'))),
    ]);
    assert.throws(() => checkFuncDecl(env, f), TypeMismatchError);
  });

  it('pattern variables get correct types from constructor', function() {
    // echo : (List) -> List, case with cons(a, rest) pattern
    // a should be Int, rest should be List
    const echo = new FuncAst('echo', new TypeAst(['List'], 'List'), [
      new CaseAst([new ParamVar('x')], new ExprBody(Variable.of('x'))),
      new CaseAst(
          [new ParamConstructor('cons', [new ParamVar('a'), new ParamVar('rest')])],
          new ExprBody(Call.of('cons', Variable.of('a'), Variable.of('rest')))),
    ]);
    checkFuncDecl(env, echo);
  });

  it('throws when constructor pattern var used with wrong type', function() {
    // cons(a, rest): a is Int, so using a as List arg should fail
    const bad = new FuncAst('bad', new TypeAst(['List'], 'List'), [
      new CaseAst(
          [new ParamConstructor('cons', [new ParamVar('a'), new ParamVar('rest')])],
          // len expects List, but a is Int
          new ExprBody(Variable.of('a'))),
    ]);
    // body returns Int (type of a), but function declares List return
    assert.throws(() => checkFuncDecl(env, bad), TypeMismatchError);
  });

  it('throws ArityError for constructor pattern with wrong arity', function() {
    const bad = new FuncAst('bad', new TypeAst(['List'], 'Int'), [
      new CaseAst(
          [new ParamConstructor('cons', [new ParamVar('a')])],
          new ExprBody(Constant.of(0n))),
    ]);
    assert.throws(() => checkFuncDecl(env, bad), ArityError);
  });

  it('accepts zero-arg constructor used explicitly as ParamConstructor with no args', function() {
    const f = new FuncAst('f', new TypeAst(['List'], 'Int'), [
      new CaseAst([new ParamConstructor('nil', [])], new ExprBody(Constant.of(0n))),
      new CaseAst([new ParamVar('x')], new ExprBody(Constant.of(1n))),
    ]);
    assert.doesNotThrow(() => checkFuncDecl(env, f));
  });

  it('throws ArityError for zero-arg constructor pattern used with args', function() {
    const bad = new FuncAst('bad', new TypeAst(['List'], 'Int'), [
      new CaseAst(
          [new ParamConstructor('nil', [new ParamVar('x')])],
          new ExprBody(Constant.of(0n))),
    ]);
    assert.throws(() => checkFuncDecl(env, bad), ArityError);
  });

  it('throws ArityError for multi-arg constructor used as bare pattern variable', function() {
    const bad = new FuncAst('bad', new TypeAst(['List'], 'Int'), [
      new CaseAst(
          [new ParamVar('cons')],
          new ExprBody(Constant.of(0n))),
    ]);
    assert.throws(() => checkFuncDecl(env, bad), ArityError);
  });

  it('throws UnknownNameError for unknown constructor in pattern', function() {
    const bad = new FuncAst('bad', new TypeAst(['List'], 'Int'), [
      new CaseAst(
          [new ParamConstructor('unknown', [new ParamVar('a')])],
          new ExprBody(Constant.of(0n))),
    ]);
    assert.throws(() => checkFuncDecl(env, bad), UnknownNameError);
  });

  it('zero-arg constructor in pattern is not bound as variable', function() {
    // nil should be recognized as a constructor, not a variable
    // so the body can't reference it as a List variable
    const f = new FuncAst('f', new TypeAst(['List'], 'Int'), [
      new CaseAst([new ParamVar('nil')], new ExprBody(Constant.of(0n))),
      new CaseAst(
          [new ParamConstructor('cons', [new ParamVar('a'), new ParamVar('rest')])],
          new ExprBody(Call.add(Variable.of('a'), Constant.of(1n)))),
    ]);
    checkFuncDecl(env, f);
  });

  it('zero-arg constructor in pattern does not shadow as variable', function() {
    // nil is a constructor, so using it in the body should resolve
    // to the constructor (List), not a pattern-bound variable
    const f = new FuncAst('f', new TypeAst(['List'], 'List'), [
      new CaseAst([new ParamVar('nil')], new ExprBody(Variable.of('nil'))),
    ]);
    // nil in body resolves to List via constructor, return type is List — should pass
    checkFuncDecl(env, f);
  });

  it('accepts valid if/else body', function() {
    const f = new FuncAst('f', new TypeAst(['Int'], 'Int'), [
      new CaseAst([new ParamVar('x')],
          new IfElseBody(
              new Formula(Variable.of('x'), OP_LESS_THAN, Constant.of(0n)),
              Call.negate(Variable.of('x')),
              Variable.of('x'))),
    ]);
    checkFuncDecl(env, f);
  });

  it('throws TypeMismatchError when if/else branches differ', function() {
    const f = new FuncAst('f', new TypeAst(['List'], 'Int'), [
      new CaseAst([new ParamVar('x')],
          new IfElseBody(
              new Formula(Constant.of(0n), OP_LESS_THAN, Constant.of(1n)),
              Constant.of(0n),
              Variable.of('nil'))),
    ]);
    assert.throws(() => checkFuncDecl(env, f), TypeMismatchError);
  });

  it('throws TypeMismatchError when condition operands are not Int', function() {
    const f = new FuncAst('f', new TypeAst(['List'], 'List'), [
      new CaseAst([new ParamVar('x')],
          new IfElseBody(
              new Formula(Variable.of('nil'), OP_LESS_THAN, Variable.of('nil')),
              Variable.of('x'),
              Variable.of('x'))),
    ]);
    assert.throws(() => checkFuncDecl(env, f), TypeMismatchError);
  });

});
