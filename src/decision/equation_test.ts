import * as assert from 'assert';
import { ParseFormula } from '../facts/formula_parser';
import { IsEquationImplied, IsChainConnected, IsEquationChainValid, _GetTerms } from './equation';
import { FUNC_MULTIPLY } from '../facts/exprs';
import { Constant, Call, Variable } from '../facts/exprs';


describe('equation', function() {

  // TODO: add a lot more tests...

  it('implied', function() {
    assert.ok(IsEquationImplied(
        [ ParseFormula("x + y^2 = 3"), ParseFormula("y^2 + z + 5 = 0")],
        ParseFormula("x - z = 8")));

    assert.ok(IsEquationImplied(
        [ ParseFormula("(1+y)*x + y*(y - x) = 3"), ParseFormula("y^2 + z + 5 = 0") ],
        ParseFormula("x - z = 8")));

    // Tests 3-arg MULTIPLY (constant * var1 * var2): 2*x*y normalized gives MULTIPLY(2,x,y)
    assert.ok(IsEquationImplied(
        [ ParseFormula("2*x*y = z"), ParseFormula("z = 0") ],
        ParseFormula("2*x*y = 0")));
  });

});


describe('IsChainConnected', function() {

  it('accepts empty chain', function() {
    assert.strictEqual(IsChainConnected([]), undefined);
  });

  it('accepts single step', function() {
    assert.strictEqual(IsChainConnected([ParseFormula('a = b')]), undefined);
  });

  it('accepts connected chain', function() {
    assert.strictEqual(IsChainConnected([
      ParseFormula('a = b'),
      ParseFormula('b = c'),
      ParseFormula('c < d'),
    ]), undefined);
  });

  it('rejects disconnected chain', function() {
    const err = IsChainConnected([
      ParseFormula('a = b'),
      ParseFormula('c = d'),
    ]);
    assert.ok(err !== undefined);
    assert.ok(err!.includes('b'));
    assert.ok(err!.includes('c'));
  });

});


describe('IsEquationChainValid', function() {

  it('rejects disconnected chain', function() {
    const err = IsEquationChainValid([
      ParseFormula('a = b'),
      ParseFormula('c = d'),
    ]);
    assert.ok(err !== undefined);
  });

  it('accepts all-equals chain', function() {
    assert.strictEqual(IsEquationChainValid([
      ParseFormula('a = b'),
      ParseFormula('b = c'),
    ]), undefined);
  });

  it('rejects chain with <', function() {
    const err = IsEquationChainValid([
      ParseFormula('a = b'),
      ParseFormula('b < c'),
    ]);
    assert.ok(err !== undefined);
    assert.ok(err!.includes('<'));
  });

  it('rejects chain with <=', function() {
    const err = IsEquationChainValid([
      ParseFormula('a = b'),
      ParseFormula('b <= c'),
    ]);
    assert.ok(err !== undefined);
    assert.ok(err!.includes('<='));
  });

});


describe('_GetTerms', function() {

  it('handles 3-arg multiply term', function() {
    // MULTIPLY(2, x, y) has constant first arg and >2 args, hitting the else branch
    const expr = new Call(FUNC_MULTIPLY, [new Constant(2n), new Variable('x'), new Variable('y')]);
    const terms = _GetTerms(expr);
    assert.strictEqual(terms.length, 1);
    assert.strictEqual(terms[0][0], 2n);
    assert.ok(terms[0][1] !== undefined);
  });

});
