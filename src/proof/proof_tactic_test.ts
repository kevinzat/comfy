import * as assert from 'assert';
import { ParseFormula } from '../facts/formula_parser';
import { TopLevelEnv, NestedEnv } from '../types/env';
import { TypeDeclAst, ConstructorAst } from '../lang/type_ast';
import { FuncAst, TypeAst, CaseAst, ExprBody, ParamVar } from '../lang/func_ast';
import { Constant, Variable, Call } from '../facts/exprs';
import { ParseProofMethod, FindProofMethodMatches } from './proof_tactic';


const listType = new TypeDeclAst('List', [
  new ConstructorAst('nil', [], 'List'),
  new ConstructorAst('cons', ['Int', 'List'], 'List'),
]);

const lenFunc = new FuncAst('len', new TypeAst(['List'], 'Int'), [
  new CaseAst([new ParamVar('nil')], new ExprBody(Constant.of(0n))),
  new CaseAst([new ParamVar('x')],
      new ExprBody(Call.add(Constant.of(1n), Call.of('len', Variable.of('x'))))),
]);


describe('ParseProofMethod', function() {

  const env = new NestedEnv(new TopLevelEnv([listType], [lenFunc]), [['xs', 'List']]);
  const formula = ParseFormula('len(xs) = len(xs)');

  it('parses "calculation"', function() {
    const result = ParseProofMethod('calculation', formula, env, []);
    assert.ok(typeof result !== 'string');
    assert.strictEqual(result.kind, 'calculate');
  });

  it('parses "induction on xs"', function() {
    const result = ParseProofMethod('induction on xs', formula, env, []);
    assert.ok(typeof result !== 'string');
    assert.strictEqual(result.kind, 'tactic');
  });

  it('parses "cases on x < y"', function() {
    const intEnv = new NestedEnv(new TopLevelEnv([], []), [['x', 'Int'], ['y', 'Int']]);
    const f = ParseFormula('x = x');
    const result = ParseProofMethod('cases on x < y', f, intEnv, []);
    assert.ok(typeof result !== 'string');
    assert.strictEqual(result.kind, 'tactic');
  });

  it('returns error for empty text', function() {
    const result = ParseProofMethod('', formula, env, []);
    assert.ok(typeof result === 'string');
  });

  it('returns error for unknown method', function() {
    const result = ParseProofMethod('magic', formula, env, []);
    assert.ok(typeof result === 'string');
  });
});


describe('FindProofMethodMatches', function() {

  const env = new NestedEnv(new TopLevelEnv([listType], [lenFunc]), [['xs', 'List']]);
  const formula = ParseFormula('len(xs) = len(xs)');

  it('returns matches for empty text', function() {
    const matches = FindProofMethodMatches('', formula, env);
    assert.ok(matches.length > 0);
  });

  it('returns matches for "calc"', function() {
    const matches = FindProofMethodMatches('calc', formula, env);
    assert.ok(matches.some(m => m.completion === 'calculation'));
  });

  it('returns matches for "ind"', function() {
    const matches = FindProofMethodMatches('ind', formula, env);
    assert.ok(matches.some(m => m.completion.startsWith('induction on')));
  });
});
