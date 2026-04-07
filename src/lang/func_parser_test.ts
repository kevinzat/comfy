
import * as assert from 'assert';
import { Constant, Variable, Call } from '../facts/exprs';
import { Formula, OP_LESS_THAN, OP_LESS_EQUAL } from '../facts/formula';
import { FuncAst, TypeAst, CaseAst, ParamVar, ParamConstructor } from './func_ast';
import { ParseFunc } from './func_parser';


describe('func_parser', function() {

  it('parse single-arg function with one case', function() {
    const { ast: result } = ParseFunc(
        `def f : (Int) -> Int
         | f(x) => x + 1`);
    assert.ok(result);
    assert.equal(result.name, 'f');
    assert.deepEqual(result.type.paramTypes, ['Int']);
    assert.equal(result.type.returnType, 'Int');
    assert.equal(result.cases.length, 1);
    assert.deepEqual(result.cases[0].params, [new ParamVar('x')]);
    assert.ok(result.cases[0].body.tag === 'expr' && result.cases[0].body.expr.equals(
        Call.add(Variable.of('x'), Constant.of(1n))));
  });

  it('parse two-arg function with one case', function() {
    const { ast: result } = ParseFunc(
        `def add : (Int, Int) -> Int
         | add(x, y) => x + y`);
    assert.ok(result);
    assert.equal(result.name, 'add');
    assert.deepEqual(result.type.paramTypes, ['Int', 'Int']);
    assert.equal(result.type.returnType, 'Int');
    assert.equal(result.cases.length, 1);
    assert.deepEqual(result.cases[0].params,
        [new ParamVar('x'), new ParamVar('y')]);
    assert.ok(result.cases[0].body.tag === 'expr' && result.cases[0].body.expr.equals(
        Call.add(Variable.of('x'), Variable.of('y'))));
  });

  it('parse function with multiple cases', function() {
    const { ast: result } = ParseFunc(
        `def g : (Int, Int) -> Int
         | g(a, b) => a + b
         | g(a, b) => a * b`);
    assert.ok(result);
    assert.equal(result.name, 'g');
    assert.equal(result.cases.length, 2);
    assert.deepEqual(result.cases[0].params,
        [new ParamVar('a'), new ParamVar('b')]);
    assert.ok(result.cases[0].body.tag === 'expr' && result.cases[0].body.expr.equals(
        Call.add(Variable.of('a'), Variable.of('b'))));
    assert.deepEqual(result.cases[1].params,
        [new ParamVar('a'), new ParamVar('b')]);
    assert.ok(result.cases[1].body.tag === 'expr' && result.cases[1].body.expr.equals(
        Call.multiply(Variable.of('a'), Variable.of('b'))));
  });

  it('parse complex expression in body', function() {
    const { ast: result } = ParseFunc(
        `def h : (Int) -> Int
         | h(x) => x^2 + 2*x + 1`);
    assert.ok(result);
    assert.equal(result.cases.length, 1);
    assert.ok(result.cases[0].body.tag === 'expr' && result.cases[0].body.expr.equals(
        Call.add(
            Call.add(
                Call.exponentiate(Variable.of('x'), Constant.of(2n)),
                Call.multiply(Constant.of(2n), Variable.of('x'))),
            Constant.of(1n))));
  });

  it('parse function with three param types', function() {
    const { ast: result } = ParseFunc(
        `def foo : (Nat, Nat, Nat) -> Nat
         | foo(a, b, c) => a + b + c`);
    assert.ok(result);
    assert.deepEqual(result.type.paramTypes, ['Nat', 'Nat', 'Nat']);
    assert.equal(result.type.returnType, 'Nat');
    assert.deepEqual(result.cases[0].params,
        [new ParamVar('a'), new ParamVar('b'), new ParamVar('c')]);
  });

  it('parse negation in body', function() {
    const { ast: result } = ParseFunc(
        `def neg : (Int) -> Int
         | neg(x) => -x`);
    assert.ok(result);
    assert.ok(result.cases[0].body.tag === 'expr' && result.cases[0].body.expr.equals(
        Call.negate(Variable.of('x'))));
  });

  it('parse function call in body', function() {
    const { ast: result } = ParseFunc(
        `def apply : (Int, Int) -> Int
         | apply(a, b) => gcd(a, b) + 1`);
    assert.ok(result);
    assert.ok(result.cases[0].body.tag === 'expr' && result.cases[0].body.expr.equals(
        Call.add(
            Call.of('gcd', Variable.of('a'), Variable.of('b')),
            Constant.of(1n))));
  });

  it('parse constructor patterns', function() {
    const { ast: result } = ParseFunc(
        `def len : (List) -> Int
         | len(nil) => 0
         | len(cons(a, b)) => 1 + len(b)`);
    assert.ok(result);
    assert.equal(result.name, 'len');
    assert.equal(result.cases.length, 2);
    assert.deepEqual(result.cases[0].params,
        [new ParamVar('nil')]);
    assert.ok(result.cases[0].body.tag === 'expr' && result.cases[0].body.expr.equals(Constant.of(0n)));
    assert.deepEqual(result.cases[1].params,
        [new ParamConstructor('cons', [new ParamVar('a'), new ParamVar('b')])]);
    assert.ok(result.cases[1].body.tag === 'expr' && result.cases[1].body.expr.equals(
        Call.add(Constant.of(1n),
            Call.of('len', Variable.of('b')))));
  });

  it('error on mismatched case name', function() {
    const { ast, error } = ParseFunc(
        `def len : (List) -> Int
         | len(nil) => 0
         | wrong(cons(a, b)) => 1`);
    assert.equal(ast, undefined);
    assert.ok(error);
    assert.ok(error.includes('expected "len"'));
    assert.ok(error.includes('found "wrong"'));
  });

  it('error on syntax error', function() {
    const { ast, error } = ParseFunc(`def f : Int -> Int`);
    assert.equal(ast, undefined);
    assert.ok(error);
  });

  it('error on incomplete input', function() {
    const { ast, error } = ParseFunc(`def f : (Int) -> Int`);
    assert.equal(ast, undefined);
    assert.ok(error);
  });

  it('parse if/else with < condition', function() {
    const { ast: result } = ParseFunc(
        `def abs : (Int) -> Int
         | abs(x) => if x < 0 then -x else x`);
    assert.ok(result);
    assert.equal(result.cases.length, 1);
    const body = result.cases[0].body;
    assert.equal(body.tag, 'if');
    if (body.tag !== 'if') return;
    assert.ok(body.condition.left.equals(Variable.of('x')));
    assert.equal(body.condition.op, '<');
    assert.ok(body.condition.right.equals(Constant.of(0n)));
    assert.ok(body.thenBody.equals(Call.negate(Variable.of('x'))));
    assert.ok(body.elseBody.equals(Variable.of('x')));
  });

  it('parse if/else with <= condition', function() {
    const { ast: result } = ParseFunc(
        `def f : (Int) -> Int
         | f(x) => if x <= 0 then 0 else x`);
    assert.ok(result);
    const body = result.cases[0].body;
    assert.equal(body.tag, 'if');
    if (body.tag !== 'if') return;
    assert.equal(body.condition.op, '<=');
    assert.ok(body.thenBody.equals(Constant.of(0n)));
    assert.ok(body.elseBody.equals(Variable.of('x')));
  });

  it('error on if with = condition', function() {
    const { ast, error } = ParseFunc(
        `def f : (Int) -> Int
         | f(x) => if x = 0 then 0 else x`);
    assert.equal(ast, undefined);
    assert.ok(error);
  });

  it('error on nested if/else', function() {
    const { ast, error } = ParseFunc(
        `def f : (Int) -> Int
         | f(x) => if x < 0 then if x < -1 then 0 else 1 else x`);
    assert.equal(ast, undefined);
    assert.ok(error);
  });

});
