
import * as assert from 'assert';
import { Constant, Variable, Call } from '../facts/exprs';
import { OP_EQUAL } from '../facts/formula';
import { FuncAst, TypeAst, CaseAst, ParamVar, ParamConstructor, funcToDefinitions } from './func_ast';


describe('funcToDefinitions', function() {

  it('produces definitions for len', function() {
    const func = new FuncAst('len', new TypeAst(['List'], 'Int'), [
      new CaseAst([new ParamVar('nil')], Constant.of(0n)),
      new CaseAst(
          [new ParamConstructor('cons', [new ParamVar('a'), new ParamVar('L')])],
          Call.add(Constant.of(1n), Call.of('len', Variable.of('L')))),
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
          Call.add(Variable.of('x'), Constant.of(1n))),
    ]);

    const defs = funcToDefinitions(func);
    assert.equal(defs.length, 1);
    assert.equal(defs[0].name, 'f_1');
    assert.ok(defs[0].formula.left.equals(
        Call.of('f', Variable.of('x'))));
    assert.ok(defs[0].formula.right.equals(
        Call.add(Variable.of('x'), Constant.of(1n))));
  });

});
