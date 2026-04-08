
import * as assert from 'assert';
import { Constant, Variable, Call } from '../facts/exprs';
import { Formula, OP_EQUAL, OP_LESS_THAN, OP_LESS_EQUAL } from '../facts/formula';
import { AtomProp, NotProp, OrProp, ConstProp } from '../facts/prop';
import { FuncAst, TypeAst, CaseAst, ExprBody, IfBranch, IfElseBody, ParamVar, ParamConstructor, funcToDefinitions } from './func_ast';


describe('CaseBody.to_string', function() {

  it('ExprBody.to_string', function() {
    const body = new ExprBody(Call.add(Variable.of('x'), Constant.of(1n)));
    assert.equal(body.to_string(), 'x + 1');
  });

  it('IfElseBody.to_string with single branch', function() {
    const body = new IfElseBody(
        [new IfBranch(
            [new AtomProp(new Formula(Variable.of('x'), OP_LESS_THAN, Constant.of(0n)))],
            Call.negate(Variable.of('x')))],
        Variable.of('x'));
    assert.equal(body.to_string(), 'if x < 0 then -x else x');
  });

  it('IfElseBody.to_string with else-if', function() {
    const body = new IfElseBody(
        [new IfBranch(
            [new AtomProp(new Formula(Variable.of('x'), OP_LESS_THAN, Constant.of(0n)))],
            Constant.of(0n)),
         new IfBranch(
            [new AtomProp(new Formula(Variable.of('x'), OP_LESS_THAN, Constant.of(10n)))],
            Constant.of(1n))],
        Constant.of(2n));
    assert.equal(body.to_string(), 'if x < 0 then 0 else if x < 10 then 1 else 2');
  });

});


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
              [new IfBranch(
                  [new AtomProp(new Formula(Variable.of('x'), OP_LESS_THAN, Constant.of(0n)))],
                  Call.negate(Variable.of('x')))],
              Variable.of('x'))),
    ]);

    const defs = funcToDefinitions(func);
    assert.equal(defs.length, 2);

    assert.equal(defs[0].name, 'abs_1a');
    assert.equal(defs[0].conditions.length, 1);
    const cond0 = defs[0].conditions[0];
    assert.equal(cond0.tag, 'atom');
    if (cond0.tag === 'atom') {
      assert.equal(cond0.formula.op, '<');
      assert.ok(cond0.formula.left.equals(Variable.of('x')));
      assert.ok(cond0.formula.right.equals(Constant.of(0n)));
    }
    assert.ok(defs[0].formula.left.equals(Call.of('abs', Variable.of('x'))));
    assert.ok(defs[0].formula.right.equals(Call.negate(Variable.of('x'))));

    assert.equal(defs[1].name, 'abs_1b');
    assert.equal(defs[1].conditions.length, 1);
    const cond1 = defs[1].conditions[0];
    assert.equal(cond1.tag, 'atom');
    if (cond1.tag === 'atom') {
      assert.equal(cond1.formula.op, '<=');
      assert.ok(cond1.formula.left.equals(Constant.of(0n)));
      assert.ok(cond1.formula.right.equals(Variable.of('x')));
    }
    assert.ok(defs[1].formula.left.equals(Call.of('abs', Variable.of('x'))));
    assert.ok(defs[1].formula.right.equals(Variable.of('x')));
  });

  it('produces conditional definitions for if/else with <= condition', function() {
    const func = new FuncAst('f', new TypeAst(['Int'], 'Int'), [
      new CaseAst([new ParamVar('x')],
          new IfElseBody(
              [new IfBranch(
                  [new AtomProp(new Formula(Variable.of('x'), OP_LESS_EQUAL, Constant.of(0n)))],
                  Constant.of(0n))],
              Variable.of('x'))),
    ]);

    const defs = funcToDefinitions(func);
    assert.equal(defs.length, 2);
    const cond0 = defs[0].conditions[0];
    assert.equal(cond0.tag, 'atom');
    if (cond0.tag === 'atom') assert.equal(cond0.formula.op, '<=');
    const cond1 = defs[1].conditions[0];
    assert.equal(cond1.tag, 'atom');
    if (cond1.tag === 'atom') {
      assert.equal(cond1.formula.op, '<');
      assert.ok(cond1.formula.left.equals(Constant.of(0n)));
      assert.ok(cond1.formula.right.equals(Variable.of('x')));
    }
  });

  it('ExprBody definitions have empty conditions', function() {
    const func = new FuncAst('f', new TypeAst(['Int'], 'Int'), [
      new CaseAst([new ParamVar('x')], new ExprBody(Variable.of('x'))),
    ]);
    const defs = funcToDefinitions(func);
    assert.deepEqual(defs[0].conditions, []);
  });

  it('produces definitions for if/else-if/else', function() {
    const func = new FuncAst('g', new TypeAst(['Int'], 'Int'), [
      new CaseAst([new ParamVar('x')],
          new IfElseBody(
              [
                new IfBranch(
                    [new AtomProp(new Formula(Variable.of('x'), OP_LESS_THAN, Constant.of(0n)))],
                    Constant.of(-1n)),
                new IfBranch(
                    [new AtomProp(new Formula(Variable.of('x'), OP_LESS_THAN, Constant.of(10n)))],
                    Constant.of(0n)),
              ],
              Constant.of(1n))),
    ]);

    const defs = funcToDefinitions(func);
    assert.equal(defs.length, 3);

    // Branch a: if x < 0
    assert.equal(defs[0].name, 'g_1a');
    assert.equal(defs[0].conditions.length, 1);
    assert.ok(defs[0].conditions[0].equivalent(
        new AtomProp(new Formula(Variable.of('x'), OP_LESS_THAN, Constant.of(0n)))));

    // Branch b: else if x < 10 — conditions include negation of prior branch
    assert.equal(defs[1].name, 'g_1b');
    assert.equal(defs[1].conditions.length, 2);
    assert.ok(defs[1].conditions[0].equivalent(
        new AtomProp(new Formula(Constant.of(0n), OP_LESS_EQUAL, Variable.of('x')))));
    assert.ok(defs[1].conditions[1].equivalent(
        new AtomProp(new Formula(Variable.of('x'), OP_LESS_THAN, Constant.of(10n)))));

    // Branch c: else — both prior conditions negated
    assert.equal(defs[2].name, 'g_1c');
    assert.equal(defs[2].conditions.length, 2);
    assert.ok(defs[2].conditions[0].equivalent(
        new AtomProp(new Formula(Constant.of(0n), OP_LESS_EQUAL, Variable.of('x')))));
    assert.ok(defs[2].conditions[1].equivalent(
        new AtomProp(new Formula(Constant.of(10n), OP_LESS_EQUAL, Variable.of('x')))));
  });

  it('negates equality condition to NotProp', function() {
    const func = new FuncAst('f', new TypeAst(['Int'], 'Int'), [
      new CaseAst([new ParamVar('x')],
          new IfElseBody(
              [new IfBranch(
                  [new AtomProp(new Formula(Variable.of('x'), OP_EQUAL, Constant.of(0n)))],
                  Constant.of(1n))],
              Constant.of(0n))),
    ]);
    const defs = funcToDefinitions(func);
    assert.equal(defs[1].conditions[0].tag, 'not');
  });

  it('negates NotProp condition back to AtomProp', function() {
    const func = new FuncAst('f', new TypeAst(['Int'], 'Int'), [
      new CaseAst([new ParamVar('x')],
          new IfElseBody(
              [new IfBranch(
                  [new NotProp(new Formula(Variable.of('x'), OP_EQUAL, Constant.of(0n)))],
                  Constant.of(1n))],
              Constant.of(0n))),
    ]);
    const defs = funcToDefinitions(func);
    assert.equal(defs[1].conditions[0].tag, 'atom');
    if (defs[1].conditions[0].tag === 'atom')
      assert.equal(defs[1].conditions[0].formula.op, '=');
  });

  it('negates OrProp condition to conjunction of negated literals', function() {
    const func = new FuncAst('f', new TypeAst(['Int'], 'Int'), [
      new CaseAst([new ParamVar('x')],
          new IfElseBody(
              [new IfBranch(
                  [new OrProp([
                      new AtomProp(new Formula(Variable.of('x'), OP_LESS_THAN, Constant.of(0n))),
                      new AtomProp(new Formula(Variable.of('x'), OP_LESS_THAN, Constant.of(10n)))])],
                  Constant.of(1n))],
              Constant.of(0n))),
    ]);
    const defs = funcToDefinitions(func);
    // NOT(x < 0 or x < 10) = (0 <= x) AND (10 <= x)
    assert.equal(defs[1].conditions.length, 2);
    assert.equal(defs[1].conditions[0].tag, 'atom');
    assert.equal(defs[1].conditions[1].tag, 'atom');
  });

  it('negates ConstProp condition', function() {
    const func = new FuncAst('f', new TypeAst(['Int'], 'Int'), [
      new CaseAst([new ParamVar('x')],
          new IfElseBody(
              [new IfBranch(
                  [new ConstProp(true)],
                  Constant.of(1n))],
              Constant.of(0n))),
    ]);
    const defs = funcToDefinitions(func);
    assert.equal(defs[1].conditions[0].tag, 'const');
    if (defs[1].conditions[0].tag === 'const')
      assert.equal(defs[1].conditions[0].value, false);
  });

  it('produces definitions for multiple conditions on a branch', function() {
    const func = new FuncAst('h', new TypeAst(['Int', 'Int'], 'Int'), [
      new CaseAst([new ParamVar('x'), new ParamVar('y')],
          new IfElseBody(
              [new IfBranch(
                  [new AtomProp(new Formula(Variable.of('x'), OP_LESS_THAN, Constant.of(0n))),
                   new AtomProp(new Formula(Variable.of('y'), OP_LESS_THAN, Constant.of(0n)))],
                  Constant.of(1n))],
              Constant.of(0n))),
    ]);

    const defs = funcToDefinitions(func);
    assert.equal(defs.length, 2);

    // Branch a: conditions = [x < 0, y < 0]
    assert.equal(defs[0].conditions.length, 2);

    // Branch b (else): conditions = [NOT(x < 0) OR NOT(y < 0)] = [0 <= x or 0 <= y]
    assert.equal(defs[1].conditions.length, 1);
    assert.equal(defs[1].conditions[0].tag, 'or');
    if (defs[1].conditions[0].tag === 'or') {
      assert.equal(defs[1].conditions[0].disjuncts.length, 2);
    }
  });

});
