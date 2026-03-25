import * as assert from 'assert';
import { ParseExpr } from '../facts/exprs_parser';
import { ParseFormula } from '../facts/formula_parser';
import { Constant, Variable, Call } from '../facts/exprs';
import { Formula, OP_LESS_THAN } from '../facts/formula';
import { EquationRewriter, InequalityRewriter, DefinitionRewriter } from './rewriter';
import { TypeDeclAst, ConstructorAst } from '../lang/type_ast';
import { FuncAst, TypeAst, CaseAst, ExprBody, IfElseBody, ParamVar, ParamConstructor } from '../lang/func_ast';
import { funcToDefinitions } from '../lang/func_ast';
import { TopLevelEnv } from '../types/env';


describe('EquationRewriter', function() {

  it('replaces a single occurrence', function() {
    const rw = new EquationRewriter('test', ParseExpr('x + 1'),
      Variable.of('x'), Constant.of(3n));
    assert.strictEqual(rw.rewrite().to_string(), '3 + 1');
  });

  it('enumerates all match sites', function() {
    const rw = new EquationRewriter('test', ParseExpr('x + x'),
      Variable.of('x'), Constant.of(3n));
    const candidates = rw.enumerate();
    assert.strictEqual(candidates.length, 2);
    assert.strictEqual(candidates[0].result.to_string(), '3 + x');
    assert.strictEqual(candidates[1].result.to_string(), 'x + 3');
  });

  it('enumerates nested matches', function() {
    const rw = new EquationRewriter('test', ParseExpr('f(x, g(x))'),
      Variable.of('x'), Constant.of(1n));
    const candidates = rw.enumerate();
    assert.strictEqual(candidates.length, 2);
    assert.strictEqual(candidates[0].result.to_string(), 'f(1, g(x))');
    assert.strictEqual(candidates[1].result.to_string(), 'f(x, g(1))');
  });

  it('rejects when no match found', function() {
    const rw = new EquationRewriter('test', ParseExpr('y + 1'),
      Variable.of('x'), Constant.of(3n));
    assert.throws(() => rw.rewrite(), /no matches found/);
  });

  it('rejects multiple matches without explicit result', function() {
    const rw = new EquationRewriter('test', ParseExpr('x + x'),
      Variable.of('x'), Constant.of(3n));
    assert.throws(() => rw.rewrite(), /multiple matches/);
  });

  it('accepts explicit result selecting first occurrence', function() {
    const rw = new EquationRewriter('test', ParseExpr('x + x'),
      Variable.of('x'), Constant.of(3n));
    assert.strictEqual(rw.rewrite(ParseExpr('3 + x')).to_string(), '3 + x');
  });

  it('accepts explicit result selecting second occurrence', function() {
    const rw = new EquationRewriter('test', ParseExpr('x + x'),
      Variable.of('x'), Constant.of(3n));
    assert.strictEqual(rw.rewrite(ParseExpr('x + 3')).to_string(), 'x + 3');
  });

  it('rejects invalid explicit result', function() {
    const rw = new EquationRewriter('test', ParseExpr('x + x'),
      Variable.of('x'), Constant.of(3n));
    assert.throws(() => rw.rewrite(ParseExpr('y + 1')), /cannot be produced/);
  });

  it('replaces a compound subexpression', function() {
    const rw = new EquationRewriter('test', ParseExpr('(x + 1) * 2'),
      ParseExpr('x + 1'), Variable.of('y'));
    assert.strictEqual(rw.rewrite().to_string(), 'y*2');
  });
});


describe('InequalityRewriter', function() {

  it('replaces at positive position (add)', function() {
    const rw = new InequalityRewriter('test', ParseExpr('x + 1'),
      Variable.of('x'), Constant.of(3n));
    rw.rewrite();
    assert.strictEqual(rw.result.to_string(), '3 + 1');
    assert.strictEqual(rw.positive, true);
  });

  it('replaces at negative position (subtract second arg)', function() {
    const rw = new InequalityRewriter('test', ParseExpr('5 - x'),
      Variable.of('x'), Constant.of(3n));
    rw.rewrite();
    assert.strictEqual(rw.result.to_string(), '5 - 3');
    assert.strictEqual(rw.positive, false);
  });

  it('replaces at negative position (negate)', function() {
    const rw = new InequalityRewriter('test', ParseExpr('-x'),
      Variable.of('x'), Constant.of(3n));
    rw.rewrite();
    assert.strictEqual(rw.result.to_string(), '-3');
    assert.strictEqual(rw.positive, false);
  });

  it('replaces at positive position (multiply by positive constant)', function() {
    const rw = new InequalityRewriter('test', ParseExpr('2*x'),
      Variable.of('x'), Constant.of(3n));
    rw.rewrite();
    assert.strictEqual(rw.result.to_string(), '2*3');
    assert.strictEqual(rw.positive, true);
  });

  it('replaces at negative position (multiply by negative constant)', function() {
    const rw = new InequalityRewriter('test', ParseExpr('-2*x'),
      Variable.of('x'), Constant.of(3n));
    rw.rewrite();
    assert.strictEqual(rw.result.to_string(), '-2*3');
    assert.strictEqual(rw.positive, false);
  });

  it('rejects mixed positive and negative positions', function() {
    const rw = new InequalityRewriter('test', ParseExpr('x - x'),
      Variable.of('x'), Constant.of(3n));
    assert.throws(() => rw.rewrite(), /multiple matches/);
  });

  it('does not recurse into user-defined functions', function() {
    const rw = new InequalityRewriter('test', ParseExpr('f(x)'),
      Variable.of('x'), Constant.of(3n));
    assert.throws(() => rw.rewrite(), /no matches found/);
  });

  it('does not recurse into exponentiation', function() {
    const rw = new InequalityRewriter('test', ParseExpr('x^2'),
      Variable.of('x'), Constant.of(3n));
    assert.throws(() => rw.rewrite(), /no matches found/);
  });

  it('accepts explicit result for mixed positions', function() {
    const rw = new InequalityRewriter('test', ParseExpr('x - x'),
      Variable.of('x'), Constant.of(3n));
    rw.rewrite(ParseExpr('3 - x'));
    assert.strictEqual(rw.result.to_string(), '3 - x');
    assert.strictEqual(rw.positive, true);
  });
});


describe('DefinitionRewriter', function() {

  const listType = new TypeDeclAst('List', [
    new ConstructorAst('nil', [], 'List'),
    new ConstructorAst('cons', ['Int', 'List'], 'List'),
  ]);

  const lenFunc = new FuncAst('len', new TypeAst(['List'], 'Int'), [
    new CaseAst([new ParamVar('nil')], new ExprBody(Constant.of(0n))),
    new CaseAst(
        [new ParamConstructor('cons', [new ParamVar('a'), new ParamVar('L')])],
        new ExprBody(Call.add(Constant.of(1n), Call.of('len', Variable.of('L'))))),
  ]);

  const positivesFunc = new FuncAst('positives', new TypeAst(['List'], 'List'), [
    new CaseAst([new ParamVar('nil')], new ExprBody(Variable.of('nil'))),
    new CaseAst(
        [new ParamConstructor('cons', [new ParamVar('a'), new ParamVar('L')])],
        new IfElseBody(
            new Formula(Variable.of('a'), OP_LESS_THAN, Constant.of(0n)),
            Call.of('positives', Variable.of('L')),
            Call.of('cons', Variable.of('a'), Call.of('positives', Variable.of('L'))))),
  ]);

  const env = new TopLevelEnv([listType], [lenFunc, positivesFunc], [], []);

  function getDef(name: string) {
    const funcName = name.match(/^(.+)_/)![1];
    const funcAst = env.getFunctionDecl(funcName);
    const defs = funcToDefinitions(funcAst);
    return defs.find(d => d.name === name)!;
  }

  it('applies len_1: len(nil) => 0', function() {
    const def = getDef('len_1');
    const rw = new DefinitionRewriter('test', env,
      Call.of('len', Variable.of('nil')),
      def.formula, true, def.condition, []);
    assert.strictEqual(rw.rewrite().to_string(), '0');
  });

  it('applies len_2 with variable freshening', function() {
    const def = getDef('len_2');
    const ex = Call.of('len', Call.of('cons', Variable.of('a'), Variable.of('nil')));
    const rw = new DefinitionRewriter('test', env, ex,
      def.formula, true, def.condition, []);
    assert.ok(rw.rewrite().equals(
      Call.add(Constant.of(1n), Call.of('len', Variable.of('nil')))));
  });

  it('applies undef len_1: 0 => len(nil)', function() {
    const def = getDef('len_1');
    const rw = new DefinitionRewriter('test', env,
      Constant.of(0n),
      def.formula, false, def.condition, []);
    assert.ok(rw.rewrite().equals(Call.of('len', Variable.of('nil'))));
  });

  it('rejects when no match', function() {
    const def = getDef('len_1');
    const rw = new DefinitionRewriter('test', env,
      Constant.of(5n),
      def.formula, true, def.condition, []);
    assert.throws(() => rw.rewrite(), /no matches found/);
  });

  it('accepts explicit result', function() {
    const def = getDef('len_1');
    const ex = Call.add(Constant.of(1n), Call.of('len', Variable.of('nil')));
    const rw = new DefinitionRewriter('test', env, ex,
      def.formula, true, def.condition, []);
    const result = rw.rewrite(Call.add(Constant.of(1n), Constant.of(0n)));
    assert.strictEqual(result.to_string(), '1 + 0');
  });

  it('rejects invalid explicit result', function() {
    const def = getDef('len_1');
    const rw = new DefinitionRewriter('test', env,
      Call.of('len', Variable.of('nil')),
      def.formula, true, def.condition, []);
    assert.throws(() => rw.rewrite(Constant.of(99n)), /cannot be produced/);
  });

  it('applies conditional definition with satisfied condition', function() {
    const def = getDef('positives_2a');
    const knownFacts = [ParseFormula('a < 0')];
    const ex = Call.of('positives', Call.of('cons', Variable.of('a'), Variable.of('L')));
    const rw = new DefinitionRewriter('test', env, ex,
      def.formula, true, def.condition, knownFacts);
    assert.ok(rw.rewrite().equals(Call.of('positives', Variable.of('L'))));
  });

  it('rejects conditional definition when condition not implied', function() {
    const def = getDef('positives_2a');
    const knownFacts = [ParseFormula('a <= 0')];
    const ex = Call.of('positives', Call.of('cons', Variable.of('a'), Variable.of('L')));
    const rw = new DefinitionRewriter('test', env, ex,
      def.formula, true, def.condition, knownFacts);
    assert.throws(() => rw.rewrite(), /condition.*not implied/);
  });
});
