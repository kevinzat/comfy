
import * as assert from 'assert';
import { TypeDeclAst, ConstructorAst } from '../lang/type_ast';
import { FuncAst, TypeAst, CaseAst, ExprBody, ParamVar } from '../lang/func_ast';
import { TheoremAst } from '../lang/theorem_ast';
import { Constant, Variable, Call } from '../facts/exprs';
import { Formula, OP_EQUAL } from '../facts/formula';
import { ParseFormula } from '../facts/formula_parser';
import { AtomProp, NotProp, ConstProp, OrProp } from '../facts/prop';
import { TopLevelEnv, NestedEnv, DuplicateError, ShadowError } from './env';
import { UnknownTypeError, UnknownNameError, TypeMismatchError } from './checker';


const listType = new TypeDeclAst('List', [
  new ConstructorAst('nil', [], 'List'),
  new ConstructorAst('cons', ['Int', 'List'], 'List'),
]);

const lenFunc = new FuncAst('len', new TypeAst(['List'], 'Int'), [
  new CaseAst([new ParamVar('nil')], new ExprBody(Constant.of(0n))),
  new CaseAst([new ParamVar('x')],
      new ExprBody(Call.add(Constant.of(1n), Call.of('len', Variable.of('x'))))),
]);


describe('Environment', function() {

  it('has Int as a built-in type', function() {
    const env = new TopLevelEnv([], []);
    assert.ok(env.hasType('Int'));
    assert.equal(env.getTypeDecl('Int'), null);
  });

  it('stores user-defined types', function() {
    const env = new TopLevelEnv([listType], []);
    assert.ok(env.hasType('List'));
    assert.equal(env.getTypeDecl('List'), listType);
  });

  it('stores constructors with types', function() {
    const env = new TopLevelEnv([listType], []);
    assert.ok(env.hasConstructor('nil'));
    assert.ok(env.hasConstructor('cons'));
    assert.equal(env.getConstructorType('nil').kind, 'named');
    assert.equal(env.getConstructorType('cons').kind, 'function');
    assert.equal(env.getConstructorDecl('nil'), listType.constructors[0]);
    assert.equal(env.getConstructorDecl('cons'), listType.constructors[1]);
  });

  it('stores functions with types', function() {
    const env = new TopLevelEnv([listType], [lenFunc]);
    assert.ok(env.hasFunction('len'));
    assert.equal(env.getFunctionType('len').kind, 'function');
    assert.equal(env.getFunctionDecl('len'), lenFunc);
  });

  it('has returns false for undefined names', function() {
    const env = new TopLevelEnv([], []);
    assert.ok(!env.hasType('List'));
    assert.ok(!env.hasFunction('len'));
    assert.ok(!env.hasVariable('x'));
    assert.ok(!env.hasConstructor('nil'));
  });

  it('get throws for undefined names', function() {
    const env = new TopLevelEnv([], []);
    assert.throws(() => env.getTypeDecl('List'), Error);
    assert.throws(() => env.getFunctionDecl('len'), Error);
    assert.throws(() => env.getVariable('x'), Error);
    assert.throws(() => env.getConstructorDecl('nil'), Error);
  });

  it('throws DuplicateError for duplicate type', function() {
    assert.throws(
        () => new TopLevelEnv([listType, listType], []),
        DuplicateError);
  });

  it('throws DuplicateError for type named Int', function() {
    const intType = new TypeDeclAst('Int', []);
    assert.throws(
        () => new TopLevelEnv([intType], []),
        DuplicateError);
  });

  it('throws DuplicateError for duplicate function', function() {
    assert.throws(
        () => new TopLevelEnv([listType], [lenFunc, lenFunc]),
        DuplicateError);
  });

  it('throws ShadowError when function shadows constructor', function() {
    const nilFunc = new FuncAst('nil', new TypeAst(['Int'], 'Int'), [
      new CaseAst([new ParamVar('x')], new ExprBody(Variable.of('x'))),
    ]);
    assert.throws(
        () => new TopLevelEnv([listType], [nilFunc]),
        ShadowError);
  });

  it('throws DuplicateError for duplicate constructor within same type', function() {
    const badType = new TypeDeclAst('Foo', [
      new ConstructorAst('a', [], 'Foo'),
      new ConstructorAst('a', [], 'Foo'),
    ]);
    assert.throws(
        () => new TopLevelEnv([badType], []),
        DuplicateError);
  });

  it('throws DuplicateError when constructors of different types share a name', function() {
    const otherType = new TypeDeclAst('Other', [
      new ConstructorAst('nil', [], 'Other'),
    ]);
    assert.throws(
        () => new TopLevelEnv([listType, otherType], []),
        DuplicateError);
  });

  it('throws UnknownTypeError for constructor with unknown param type', function() {
    const badType = new TypeDeclAst('Wrapper', [
      new ConstructorAst('wrap', ['Unknown'], 'Wrapper'),
    ]);
    assert.throws(
        () => new TopLevelEnv([badType], []),
        UnknownTypeError);
  });

  it('throws UnknownTypeError for function with unknown param type', function() {
    const badFunc = new FuncAst('f', new TypeAst(['Unknown'], 'Int'), [
      new CaseAst([new ParamVar('x')], new ExprBody(Variable.of('x'))),
    ]);
    assert.throws(
        () => new TopLevelEnv([], [badFunc]),
        UnknownTypeError);
  });

});


describe('NestedEnv', function() {

  const top = new NestedEnv(new TopLevelEnv([listType], [lenFunc]), [['x', 'Int']]);

  it('local variables are visible', function() {
    const nested = new NestedEnv(top, [['a', 'Int'], ['b', 'List']]);
    assert.ok(nested.hasVariable('a'));
    assert.equal(nested.getVariable('a').kind, 'named');
    assert.ok(nested.hasVariable('b'));
  });

  it('parent variables are visible', function() {
    const nested = new NestedEnv(top, []);
    assert.ok(nested.hasVariable('x'));
    assert.equal(nested.getVariable('x').kind, 'named');
  });

  it('local variables shadow parent variables', function() {
    const nested = new NestedEnv(top, [['x', 'List']]);
    assert.ok(nested.hasVariable('x'));
    assert.equal(nested.getVariable('x').name, 'List');
  });

  it('delegates types to parent', function() {
    const nested = new NestedEnv(top, []);
    assert.ok(nested.hasType('Int'));
    assert.ok(nested.hasType('List'));
  });

  it('delegates constructors to parent', function() {
    const nested = new NestedEnv(top, []);
    assert.ok(nested.hasConstructor('nil'));
    assert.ok(nested.hasConstructor('cons'));
  });

  it('delegates functions to parent', function() {
    const nested = new NestedEnv(top, []);
    assert.ok(nested.hasFunction('len'));
  });

  it('has returns false for unknown variable', function() {
    const nested = new NestedEnv(top, []);
    assert.ok(!nested.hasVariable('y'));
  });

  it('getConstructorDecl delegates to parent', function() {
    const nested = new NestedEnv(top, []);
    assert.equal(nested.getConstructorDecl('nil'), listType.constructors[0]);
  });

  it('isReadOnly returns false for variables from TopLevelEnv', function() {
    const env = new TopLevelEnv([], []);
    assert.equal(env.isReadOnly('x'), false);
  });

});


describe('TopLevelEnv facts', function() {

  it('numFacts returns correct count', function() {
    const env = new TopLevelEnv([], [], [
      new AtomProp(ParseFormula('x + y = 5')), new AtomProp(ParseFormula('x = 3')),
    ]);
    assert.equal(env.numFacts(), 2);
  });

  it('numFacts is 0 when no facts', function() {
    const env = new TopLevelEnv([], []);
    assert.equal(env.numFacts(), 0);
  });

  it('getFact returns 1-indexed facts', function() {
    const f1 = new AtomProp(ParseFormula('x = 3'));
    const f2 = new AtomProp(ParseFormula('y = 5'));
    const env = new TopLevelEnv([], [], [f1, f2]);
    assert.equal(env.getFact(1), f1);
    assert.equal(env.getFact(2), f2);
  });

  it('getFact throws for index 0', function() {
    const env = new TopLevelEnv([], [], [new AtomProp(ParseFormula('x = 1'))]);
    assert.throws(() => env.getFact(0));
  });

  it('getFact throws for out of range', function() {
    const env = new TopLevelEnv([], [], [new AtomProp(ParseFormula('x = 1'))]);
    assert.throws(() => env.getFact(2));
  });

  it('check succeeds for well-typed facts', function() {
    const env = new NestedEnv(new TopLevelEnv([], []), [['x', 'Int'], ['y', 'Int']], [
      new AtomProp(ParseFormula('x + y = 5')),
    ]);
    env.check();
  });

  it('check throws for fact with unknown variable', function() {
    const env = new TopLevelEnv([], [], [
      new AtomProp(ParseFormula('z = 1')),
    ]);
    assert.throws(() => env.check(), UnknownNameError);
  });

});


describe('NestedEnv facts', function() {

  const parent = new NestedEnv(new TopLevelEnv([], []), [['x', 'Int']], [
    new AtomProp(ParseFormula('x = 3')),
    new AtomProp(ParseFormula('x + 1 = 4')),
  ]);

  it('numFacts includes parent and local facts', function() {
    const localFact = new AtomProp(new Formula(Variable.of('a'), OP_EQUAL, Constant.of(1n)));
    const nested = new NestedEnv(parent, [['a', 'Int']], [localFact]);
    assert.equal(nested.numFacts(), 3);
  });

  it('parent facts come first in numbering', function() {
    const localFact = new AtomProp(new Formula(Variable.of('a'), OP_EQUAL, Constant.of(1n)));
    const nested = new NestedEnv(parent, [['a', 'Int']], [localFact]);
    // Parent facts at 1 and 2
    assert.equal(nested.getFact(1).to_string(), 'x = 3');
    assert.equal(nested.getFact(2).to_string(), 'x + 1 = 4');
    // Local fact at 3
    assert.equal(nested.getFact(3).to_string(), 'a = 1');
  });

  it('getFact throws for out of range', function() {
    const nested = new NestedEnv(parent, [], []);
    assert.equal(nested.numFacts(), 2);
    assert.throws(() => nested.getFact(3));
    assert.throws(() => nested.getFact(0));
  });

  it('check validates local facts', function() {
    const goodFact = new AtomProp(new Formula(Variable.of('a'), OP_EQUAL, Constant.of(1n)));
    const nested = new NestedEnv(parent, [['a', 'Int']], [goodFact]);
    nested.check();
  });

  it('check throws for bad local fact', function() {
    const badFact = new AtomProp(new Formula(Variable.of('unknown'), OP_EQUAL, Constant.of(1n)));
    const nested = new NestedEnv(parent, [], [badFact]);
    assert.throws(() => nested.check(), UnknownNameError);
  });

});


describe('isKnownFact', function() {

  it('returns true for exact fact match in TopLevelEnv', function() {
    const fact = new AtomProp(ParseFormula('x = 3'));
    const env = new TopLevelEnv([], [], [fact]);
    assert.ok(env.isKnownFact(new AtomProp(ParseFormula('x = 3'))));
  });

  it('returns false when no matching fact', function() {
    const fact = new AtomProp(ParseFormula('x = 3'));
    const env = new TopLevelEnv([], [], [fact]);
    assert.ok(!env.isKnownFact(new AtomProp(ParseFormula('x = 5'))));
  });

  it('returns true for equivalent cross-type props (AtomProp/NotProp)', function() {
    // a <= b is equivalent to not (b < a)
    const fact = new AtomProp(ParseFormula('a <= b'));
    const env = new TopLevelEnv([], [], [fact]);
    assert.ok(env.isKnownFact(new NotProp(ParseFormula('b < a'))));
  });

  it('returns true for fact in NestedEnv local facts', function() {
    const parent = new TopLevelEnv([], []);
    const localFact = new AtomProp(ParseFormula('x = 1'));
    const nested = new NestedEnv(parent, [['x', 'Int']], [localFact]);
    assert.ok(nested.isKnownFact(new AtomProp(ParseFormula('x = 1'))));
  });

  it('returns true for fact in NestedEnv parent facts', function() {
    const parentFact = new AtomProp(ParseFormula('x = 1'));
    const parent = new NestedEnv(new TopLevelEnv([], []), [['x', 'Int']], [parentFact]);
    const nested = new NestedEnv(parent, []);
    assert.ok(nested.isKnownFact(new AtomProp(ParseFormula('x = 1'))));
  });

  it('returns false for empty environment', function() {
    const env = new TopLevelEnv([], []);
    assert.ok(!env.isKnownFact(new ConstProp(false)));
  });

  it('returns true for ConstProp false when false is known', function() {
    const env = new TopLevelEnv([], [], [new ConstProp(false)]);
    assert.ok(env.isKnownFact(new ConstProp(false)));
  });
});


describe('TopLevelEnv theorems', function() {

  it('hasTheorem and getTheorem work', function() {
    const thm = new TheoremAst('comm', [['x', 'Int'], ['y', 'Int']],
        [], new AtomProp(ParseFormula('x + y = y + x')));
    const env = new TopLevelEnv([], [], [], [thm]);
    assert.ok(env.hasTheorem('comm'));
    assert.strictEqual(env.getTheorem('comm'), thm);
    assert.ok(!env.hasTheorem('other'));
  });

  it('check succeeds for well-typed theorem', function() {
    const thm = new TheoremAst('comm', [['x', 'Int'], ['y', 'Int']],
        [], new AtomProp(ParseFormula('x + y = y + x')));
    const env = new TopLevelEnv([], [], [], [thm]);
    env.check();
  });

  it('check succeeds for theorem with premise', function() {
    const thm = new TheoremAst('foo', [['x', 'Int']],
        [new AtomProp(ParseFormula('x < 0'))], new AtomProp(ParseFormula('x * x = x * x')));
    const env = new TopLevelEnv([], [], [], [thm]);
    env.check();
  });

  it('check throws for theorem with unknown variable in conclusion', function() {
    const thm = new TheoremAst('bad', [['x', 'Int']],
        [], new AtomProp(ParseFormula('x + z = 0')));
    const env = new TopLevelEnv([], [], [], [thm]);
    assert.throws(() => env.check(), UnknownNameError);
  });

  it('check throws for theorem with unknown variable in premise', function() {
    const thm = new TheoremAst('bad', [['x', 'Int']],
        [new AtomProp(ParseFormula('z < 0'))], new AtomProp(ParseFormula('x = x')));
    const env = new TopLevelEnv([], [], [], [thm]);
    assert.throws(() => env.check(), UnknownNameError);
  });

  it('rejects duplicate theorem names', function() {
    const thm = new TheoremAst('foo', [['x', 'Int']],
        [], new AtomProp(ParseFormula('x = x')));
    assert.throws(
        () => new TopLevelEnv([], [], [], [thm, thm]),
        DuplicateError);
  });

  it('rejects theorem name conflicting with constructor', function() {
    const thm = new TheoremAst('nil', [['x', 'Int']],
        [], new AtomProp(ParseFormula('x = x')));
    assert.throws(
        () => new TopLevelEnv([listType], [], [], [thm]),
        DuplicateError);
  });

  it('rejects theorem name conflicting with function', function() {
    const func = new FuncAst('foo', new TypeAst(['Int'], 'Int'), [
      new CaseAst([new ParamVar('x')], new ExprBody(Variable.of('x'))),
    ]);
    const thm = new TheoremAst('foo', [['x', 'Int']],
        [], new AtomProp(ParseFormula('x = x')));
    assert.throws(
        () => new TopLevelEnv([], [func], [], [thm]),
        DuplicateError);
  });

  it('rejects theorem with unknown param type', function() {
    const thm = new TheoremAst('bad', [['x', 'Unknown']],
        [], new AtomProp(ParseFormula('x = x')));
    assert.throws(
        () => new TopLevelEnv([], [], [], [thm]),
        UnknownTypeError);
  });

  it('check throws for theorem with type mismatch in conclusion', function() {
    // L is List, 0 is Int — can't be equal
    const thm = new TheoremAst('bad', [['L', 'List']],
        [], new AtomProp(ParseFormula('L = 0')));
    const env = new TopLevelEnv([listType], [], [], [thm]);
    assert.throws(() => env.check(), TypeMismatchError);
  });

  it('theorem params scope correctly with user types', function() {
    const thm = new TheoremAst('nil_eq', [['L', 'List']],
        [], new AtomProp(ParseFormula('L = L')));
    const env = new TopLevelEnv([listType], [], [], [thm]);
    env.check();
  });

});
