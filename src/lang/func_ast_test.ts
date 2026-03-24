
import * as assert from 'assert';
import { Constant, Variable, Call } from '../facts/exprs';
import { Formula, OP_EQUAL, OP_LESS_THAN, OP_LESS_EQUAL } from '../facts/formula';
import { FuncAst, TypeAst, CaseAst, ExprBody, IfElseBody, ParamVar, ParamConstructor, funcToDefinitions } from './func_ast';


describe('funcToDefinitions', function() {

  it('produces definitions for len', function() {
    const func = new FuncAst('len', new TypeAst(['List'], 'Int'), [
      new CaseAst([new ParamVar('nil')], new ExprBody(Constant.of(0n))),
      new CaseAst(
          [new ParamConstructor('cons', [new ParamVar('a'), new ParamVar('L')])],
          new ExprBody(Call.add(Constant.of(1n), Call.of('len', Variable.of('L'))))),
    ]);

    const defs = funcToDefinitions(func);
    assert.equal(defs.length, 2);

    assert.equal(defs[0].name, 'len_1');
    assert.equal(defs[0].formula.op, OP_EQUAL);
    assert.ok(defs[0].formula.left.equals(
        Call.of('len', Variable.of('nil'))));
    assert.ok(defs[0].formula.right.equals(Constant.of(0n)));

    assert.equal(defs[1].name, 'len_2');
    assert.equal(defs[1].formula.op, OP_EQUAL);
    assert.ok(defs[1].formula.left.equals(
        Call.of('len', Call.of('cons', Variable.of('a'), Variable.of('L')))));
    assert.ok(defs[1].formula.right.equals(
        Call.add(Constant.of(1n), Call.of('len', Variable.of('L')))));
  });

  it('produces definitions for simple function', function() {
    const func = new FuncAst('f', new TypeAst(['Int'], 'Int'), [
      new CaseAst([new ParamVar('x')],
          new ExprBody(Call.add(Variable.of('x'), Constant.of(1n)))),
    ]);

    const defs = funcToDefinitions(func);
    assert.equal(defs.length, 1);
    assert.equal(defs[0].name, 'f_1');
    assert.ok(defs[0].formula.left.equals(
        Call.of('f', Variable.of('x'))));
    assert.ok(defs[0].formula.right.equals(
        Call.add(Variable.of('x'), Constant.of(1n))));
  });

  it('produces conditional definitions for if/else', function() {
    const func = new FuncAst('abs', new TypeAst(['Int'], 'Int'), [
      new CaseAst([new ParamVar('x')],
          new IfElseBody(
              new Formula(Variable.of('x'), OP_LESS_THAN, Constant.of(0n)),
              Call.negate(Variable.of('x')),
              Variable.of('x'))),
    ]);

    const defs = funcToDefinitions(func);
    assert.equal(defs.length, 2);

    assert.equal(defs[0].name, 'abs_1a');
    assert.ok(defs[0].condition);
    assert.equal(defs[0].condition!.op, '<');
    assert.ok(defs[0].condition!.left.equals(Variable.of('x')));
    assert.ok(defs[0].condition!.right.equals(Constant.of(0n)));
    assert.ok(defs[0].formula.left.equals(Call.of('abs', Variable.of('x'))));
    assert.ok(defs[0].formula.right.equals(Call.negate(Variable.of('x'))));

    assert.equal(defs[1].name, 'abs_1b');
    assert.ok(defs[1].condition);
    assert.equal(defs[1].condition!.op, '<=');
    assert.ok(defs[1].condition!.left.equals(Constant.of(0n)));
    assert.ok(defs[1].condition!.right.equals(Variable.of('x')));
    assert.ok(defs[1].formula.left.equals(Call.of('abs', Variable.of('x'))));
    assert.ok(defs[1].formula.right.equals(Variable.of('x')));
  });

  it('ExprBody definitions have no condition', function() {
    const func = new FuncAst('f', new TypeAst(['Int'], 'Int'), [
      new CaseAst([new ParamVar('x')], new ExprBody(Variable.of('x'))),
    ]);
    const defs = funcToDefinitions(func);
    assert.equal(defs[0].condition, undefined);
  });

});
