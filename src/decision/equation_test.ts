import * as assert from 'assert';
import { ParseFormula } from '../facts/formula_parser';
import { IsEquationImplied, IsChainConnected, IsEquationChainValid } from './equation';


describe('equation', function() {

  // TODO: add a lot more tests...

  it('implied', function() {
    assert.ok(IsEquationImplied(
        [ ParseFormula("x + y^2 = 3"), ParseFormula("y^2 + z + 5 = 0")],
        ParseFormula("x - z = 8")));

    assert.ok(IsEquationImplied(
        [ ParseFormula("(1+y)*x + y*(y - x) = 3"), ParseFormula("y^2 + z + 5 = 0") ],
        ParseFormula("x - z = 8")));
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
