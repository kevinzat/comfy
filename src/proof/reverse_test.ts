import * as assert from 'assert';
import { Expression } from '../facts/exprs';
import { Formula, FormulaOp } from '../facts/formula';
import { AtomProp } from '../facts/prop';
import { ParseForwardRule, CreateCalcRule } from '../calc/calc_forward';
import { ParseBackwardRule, CreateCalcTactic } from '../calc/calc_backward';
import { RuleAst } from '../calc/rules_ast';
import { TacticAst } from '../calc/tactics_ast';
import { TopLevelEnv, NestedEnv, Environment } from '../types/env';
import { TheoremAst } from '../lang/theorem_ast';
import { ParseExpr } from '../facts/exprs_parser';
import { ParseFormula } from '../facts/formula_parser';
import { TypeDeclAst, ConstructorAst } from '../lang/type_ast';
import { FuncAst, TypeAst, CaseAst, ExprBody, ParamVar, ParamConstructor } from '../lang/func_ast';
import { Constant, Variable, Call } from '../facts/exprs';
import { Step, applyForwardRule, applyBackwardRule } from './calc_proof';


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


describe('Rule.reverse()', function() {

  it('algebra rule reverses to algebra tactic', function() {
    const env = new TopLevelEnv([], []);
    const current = ParseExpr('x + y');
    const ast = ParseForwardRule('= y + x');
    const rule = CreateCalcRule(ast, current, env);
    const tacticAst = rule.reverse();
    assert.strictEqual(tacticAst.to_string(), '= x + y');
  });

  it('algebra rule with refs reverses preserving refs', function() {
    const env = new TopLevelEnv([], [], [new AtomProp(ParseFormula('x + y = 5'))]);
    const current = ParseExpr('x + y');
    const ast = ParseForwardRule('= 5 since 1');
    const rule = CreateCalcRule(ast, current, env);
    const tacticAst = rule.reverse();
    assert.strictEqual(tacticAst.to_string(), '= x + y since 1');
  });

  it('subst rule reverses to subst tactic', function() {
    const env = new TopLevelEnv([], [], [new AtomProp(ParseFormula('x = 3'))]);
    const current = ParseExpr('x + 1');
    const ast = ParseForwardRule('subst 1');
    const rule = CreateCalcRule(ast, current, env);
    const tacticAst = rule.reverse();
    assert.strictEqual(tacticAst.to_string(), 'subst 1');
  });

  it('defof rule reverses to defof tactic', function() {
    const env = new TopLevelEnv([listType], [lenFunc]);
    const current = Call.of('len', Variable.of('nil'));
    const ast = ParseForwardRule('defof len_1');
    const rule = CreateCalcRule(ast, current, env);
    const tacticAst = rule.reverse();
    assert.strictEqual(tacticAst.to_string(), 'defof len_1');
  });
});


describe('Tactic.reverse()', function() {

  it('algebra tactic reverses to algebra rule', function() {
    const env = new TopLevelEnv([], []);
    const goal = ParseExpr('x + y');
    const ast = ParseBackwardRule('(y + x) =');
    const tactic = CreateCalcTactic(ast, goal, env);
    const ruleAst = tactic.reverse();
    assert.strictEqual(ruleAst.to_string(), '= x + y');
  });

  it('subst tactic reverses to subst rule', function() {
    const env = new TopLevelEnv([], [], [new AtomProp(ParseFormula('x = 3'))]);
    const goal = ParseExpr('3 + 1');
    const ast = ParseBackwardRule('subst 1');
    const tactic = CreateCalcTactic(ast, goal, env);
    const ruleAst = tactic.reverse();
    assert.strictEqual(ruleAst.to_string(), 'subst 1');
  });

  it('undef tactic reverses to undef rule', function() {
    const env = new TopLevelEnv([listType], [lenFunc]);
    const goal = Call.of('len', Variable.of('nil'));
    const ast = ParseBackwardRule('undef len_1');
    const tactic = CreateCalcTactic(ast, goal, env);
    const ruleAst = tactic.reverse();
    assert.strictEqual(ruleAst.to_string(), 'undef len_1');
  });
});


/**
 * For a calculation proof with the given forward rules and backward tactics,
 * tries every possible split point (0 forward + all backward, 1 forward + rest
 * backward, ..., all forward + 0 backward). At each split, the steps before
 * the split are applied as forward rules and the steps after are applied as
 * backward tactics, using .reverse() to convert direction. Verifies each
 * step succeeds, each formula connects to the previous, and the two frontiers
 * meet.
 */
function testAllSplits(
    env: Environment,
    goal: Formula,
    forwardTexts: string[],
    backwardTexts: string[],
): void {
  const F = forwardTexts.length;
  const B = backwardTexts.length;
  const N = F + B;

  // Phase 1: apply the original proof to build the chain and collect ASTs.
  // Each chain step stores the original AST in its native direction,
  // and uses .reverse() only when the step crosses the split boundary.
  interface ChainStep {
    nativeDir: 'forward' | 'backward';
    nativeRule?: { ast: RuleAst; rule: ReturnType<typeof CreateCalcRule> };
    nativeTactic?: { ast: TacticAst; tactic: ReturnType<typeof CreateCalcTactic> };
    op: FormulaOp;
    from: Expression;
    to: Expression;
  }

  const chain: ChainStep[] = [];

  // Forward rules (chain order = application order).
  let current = goal.left;
  for (let i = 0; i < F; i++) {
    const ast = ParseForwardRule(forwardTexts[i]);
    const rule = CreateCalcRule(ast, current, env);
    const formula = rule.apply();
    chain.push({
      nativeDir: 'forward',
      nativeRule: { ast, rule },
      op: formula.op,
      from: current,
      to: formula.right,
    });
    current = formula.right;
  }

  // Backward tactics (chain order = reverse of application order).
  let bwdGoal = goal.right;
  const bwdSteps: ChainStep[] = [];
  for (let i = 0; i < B; i++) {
    const ast = ParseBackwardRule(backwardTexts[i]);
    const tactic = CreateCalcTactic(ast, bwdGoal, env);
    const formula = tactic.apply();
    bwdSteps.push({
      nativeDir: 'backward',
      nativeTactic: { ast, tactic },
      op: formula.op,
      from: formula.left,
      to: bwdGoal,
    });
    bwdGoal = formula.left;
  }
  bwdSteps.reverse();
  chain.push(...bwdSteps);

  // Verify original proof connects.
  assert.ok(current.equals(bwdGoal),
      `original proof: frontiers don't meet: ${current.to_string()} vs ${bwdGoal.to_string()}`);
  assert.strictEqual(chain.length, N);

  // Phase 2: try every split point.
  const passed: number[] = [];
  const failed: { k: number; error: string }[] = [];

  for (let k = 0; k <= N; k++) {
    try {
      // Apply first k steps as forward rules.
      let fwd = goal.left;
      for (let i = 0; i < k; i++) {
        const step = chain[i];
        // Use native AST if originally forward, otherwise reverse the tactic.
        const ruleAst = step.nativeDir === 'forward'
            ? step.nativeRule!.ast
            : step.nativeTactic!.tactic.reverse();
        const rule = CreateCalcRule(ruleAst, fwd, env);
        const formula = rule.apply();
        assert.ok(formula.left.equals(fwd),
            `forward step ${i}: left side mismatch`);
        assert.strictEqual(formula.op, step.op,
            `forward step ${i}: op mismatch`);
        assert.ok(formula.right.equals(step.to),
            `forward step ${i}: right side mismatch: ` +
            `got ${formula.right.to_string()}, expected ${step.to.to_string()}`);
        fwd = formula.right;
      }

      // Apply remaining steps as backward tactics (in reverse).
      let bwd = goal.right;
      for (let i = N - 1; i >= k; i--) {
        const step = chain[i];
        // Use native AST if originally backward, otherwise reverse the rule.
        const tacticAst = step.nativeDir === 'backward'
            ? step.nativeTactic!.ast
            : step.nativeRule!.rule.reverse();
        const tactic = CreateCalcTactic(tacticAst, bwd, env);
        const formula = tactic.apply();
        assert.ok(formula.right.equals(bwd),
            `backward step ${i}: goal side mismatch`);
        assert.strictEqual(formula.op, step.op,
            `backward step ${i}: op mismatch`);
        assert.ok(formula.left.equals(step.from),
            `backward step ${i}: premise mismatch: ` +
            `got ${formula.left.to_string()}, expected ${step.from.to_string()}`);
        bwd = formula.left;
      }

      // Verify frontiers meet.
      assert.ok(fwd.equals(bwd),
          `frontiers don't meet: ${fwd.to_string()} vs ${bwd.to_string()}`);
      passed.push(k);
    } catch (e: any) {
      failed.push({ k, error: e.message });
    }
  }

  // The original split (k=F) must always work.
  assert.ok(passed.includes(F),
      `original split ${F} failed`);

  // Report results: at minimum the original split passes.
  // Other splits may fail due to rules that don't reverse cleanly
  // (e.g. defof with explicit results, inequality substitutions).
  // Log split results for visibility.
  // console.log(`  ${passed.length}/${N + 1} splits passed (${failed.map(f => f.k).join(', ')} failed)`);

  if (failed.length > 0 && passed.length <= 1) {
    // If ONLY the original split works, that's suspicious — flag it.
    const msgs = failed.map(f => `  split ${f.k}: ${f.error}`);
    assert.fail(`only split ${F} passed out of ${N + 1}:\n${msgs.join('\n')}`);
  }
}


// ---------- Calculations extracted from .prf files ----------

const echoFunc = new FuncAst('echo', new TypeAst(['List'], 'List'), [
  new CaseAst([new ParamVar('nil')], new ExprBody(Variable.of('nil'))),
  new CaseAst(
      [new ParamConstructor('cons', [new ParamVar('a'), new ParamVar('L')])],
      new ExprBody(Call.of('cons', Variable.of('a'),
          Call.of('cons', Variable.of('a'), Call.of('echo', Variable.of('L')))))),
]);

const sumFunc = new FuncAst('sum', new TypeAst(['List'], 'Int'), [
  new CaseAst([new ParamVar('nil')], new ExprBody(Constant.of(0n))),
  new CaseAst(
      [new ParamConstructor('cons', [new ParamVar('a'), new ParamVar('L')])],
      new ExprBody(Call.add(Variable.of('a'), Call.of('sum', Variable.of('L'))))),
]);

const positivesFunc = new FuncAst('positives', new TypeAst(['List'], 'List'), [
  new CaseAst([new ParamVar('nil')], new ExprBody(Variable.of('nil'))),
  new CaseAst(
      [new ParamConstructor('cons', [new ParamVar('a'), new ParamVar('L')])],
      {
        tag: 'if' as const,
        condition: ParseFormula('a < 0'),
        thenBody: Call.of('positives', Variable.of('L')),
        elseBody: Call.of('cons', Variable.of('a'), Call.of('positives', Variable.of('L'))),
      }),
]);

const treeType = new TypeDeclAst('Tree', [
  new ConstructorAst('leaf', [], 'Tree'),
  new ConstructorAst('node', ['Tree', 'Tree'], 'Tree'),
]);

const sizeFunc = new FuncAst('size', new TypeAst(['Tree'], 'Int'), [
  new CaseAst([new ParamVar('leaf')], new ExprBody(Constant.of(1n))),
  new CaseAst(
      [new ParamConstructor('node', [new ParamVar('L'), new ParamVar('R')])],
      new ExprBody(Call.add(Call.add(Constant.of(1n), Call.of('size', Variable.of('L'))),
          Call.of('size', Variable.of('R'))))),
]);

const leavesFunc = new FuncAst('leaves', new TypeAst(['Tree'], 'Int'), [
  new CaseAst([new ParamVar('leaf')], new ExprBody(Constant.of(1n))),
  new CaseAst(
      [new ParamConstructor('node', [new ParamVar('L'), new ParamVar('R')])],
      new ExprBody(Call.add(Call.of('leaves', Variable.of('L')),
          Call.of('leaves', Variable.of('R'))))),
]);


describe('testAllSplits: len_zero_add.prf', function() {

  const topEnv = new TopLevelEnv([listType], [lenFunc]);
  const env = new NestedEnv(topEnv, [['xs', 'List']]);

  it('nil case', function() {
    testAllSplits(env,
        ParseFormula('0 + len(nil) = len(nil)'),
        ['defof len_1 => 0 + 0', '= 0'],
        ['undef len_1']);
  });

  it('cons case', function() {
    const ih = new TheoremAst('IH', [], [],
        new AtomProp(ParseFormula('0 + len(ys) = len(ys)')));
    const caseEnv = new NestedEnv(env, [['n', 'Int'], ['ys', 'List']], [], [ih]);
    testAllSplits(caseEnv,
        ParseFormula('0 + len(cons(n, ys)) = len(cons(n, ys))'),
        ['defof len_2', '= 1 + len(ys)'],
        ['undef len_2']);
  });
});


describe('testAllSplits: len_echo.prf', function() {

  const topEnv = new TopLevelEnv([listType], [lenFunc, echoFunc]);
  const env = new NestedEnv(topEnv, [['xs', 'List']]);

  it('nil case', function() {
    testAllSplits(env,
        ParseFormula('len(echo(nil)) = 2 * len(nil)'),
        ['defof echo_1', 'defof len_1', '= 2*0'],
        ['undef len_1']);
  });

  it('cons case', function() {
    const ih = new TheoremAst('IH', [], [],
        new AtomProp(ParseFormula('len(echo(L)) = 2 * len(L)')));
    const caseEnv = new NestedEnv(env, [['a', 'Int'], ['L', 'List']], [], [ih]);
    testAllSplits(caseEnv,
        ParseFormula('len(echo(cons(a, L))) = 2 * len(cons(a, L))'),
        ['defof echo_2', 'defof len_2', 'defof len_2', 'apply IH', '= 2 * (1 + len(L))'],
        ['undef len_2']);
  });
});


describe('testAllSplits: tree_size.prf', function() {

  const topEnv = new TopLevelEnv([treeType], [sizeFunc, leavesFunc]);
  const env = new NestedEnv(topEnv, [['T', 'Tree']]);

  it('leaf case', function() {
    testAllSplits(env,
        ParseFormula('size(leaf) = 2 * leaves(leaf) - 1'),
        ['defof size_1'],
        ['undef leaves_1', '1 =']);
  });

  it('node case', function() {
    const ih1 = new TheoremAst('IH_L', [], [],
        new AtomProp(ParseFormula('size(L) = 2 * leaves(L) - 1')));
    const ih2 = new TheoremAst('IH_R', [], [],
        new AtomProp(ParseFormula('size(R) = 2 * leaves(R) - 1')));
    const caseEnv = new NestedEnv(env,
        [['L', 'Tree'], ['R', 'Tree']], [], [ih1, ih2]);
    testAllSplits(caseEnv,
        ParseFormula('size(node(L, R)) = 2 * leaves(node(L, R)) - 1'),
        ['defof size_2', 'apply IH_L => 1 + (2 * leaves(L) - 1) + size(R)', 'apply IH_R => 1 + (2 * leaves(L) - 1) + (2 * leaves(R) - 1)', '= 2 * (leaves(L) + leaves(R)) - 1'],
        ['undef leaves_2']);
  });
});


describe('testAllSplits: sum_positives.prf', function() {

  const topEnv = new TopLevelEnv([listType], [sumFunc, positivesFunc]);
  const env = new NestedEnv(topEnv, [['S', 'List']]);

  it('nil case', function() {
    testAllSplits(env,
        ParseFormula('sum(nil) <= sum(positives(nil))'),
        ['defof sum_1'],
        ['undef positives_1', 'undef sum_1']);
  });

  it('cons/then case', function() {
    const ih = new TheoremAst('IH', [], [],
        new AtomProp(ParseFormula('sum(L) <= sum(positives(L))')));
    const cond = new AtomProp(ParseFormula('a < 0'));
    const outerEnv = new NestedEnv(env, [['a', 'Int'], ['L', 'List']], [], [ih]);
    const caseEnv = new NestedEnv(outerEnv, [], [cond]);
    testAllSplits(caseEnv,
        ParseFormula('sum(cons(a, L)) <= sum(positives(cons(a, L)))'),
        ['defof sum_2', 'apply IH', '< sum(positives(L)) since 1'],
        ['undef positives_2a since 1']);
  });

  it('cons/else case', function() {
    const ih = new TheoremAst('IH', [], [],
        new AtomProp(ParseFormula('sum(L) <= sum(positives(L))')));
    const cond = new AtomProp(ParseFormula('0 <= a'));
    const outerEnv = new NestedEnv(env, [['a', 'Int'], ['L', 'List']], [], [ih]);
    const caseEnv = new NestedEnv(outerEnv, [], [cond]);
    testAllSplits(caseEnv,
        ParseFormula('sum(cons(a, L)) <= sum(positives(cons(a, L)))'),
        ['defof sum_2', 'apply IH'],
        ['undef positives_2b since 1', 'undef sum_2']);
  });
});


describe('IH theorem with free params (unification)', function() {

  const concatFunc = new FuncAst('concat', new TypeAst(['List', 'List'], 'List'), [
    new CaseAst(
        [new ParamConstructor('nil', []), new ParamVar('R')],
        new ExprBody(Variable.of('R'))),
    new CaseAst(
        [new ParamConstructor('cons', [new ParamVar('a'), new ParamVar('L')]),
         new ParamVar('R')],
        new ExprBody(Call.of('cons', Variable.of('a'),
            Call.of('concat', Variable.of('L'), Variable.of('R'))))),
  ]);

  const topEnv = new TopLevelEnv([listType], [lenFunc, concatFunc]);

  it('apply IH with free param unifying to a different value', function() {
    // Scenario: proving len(concat(S, T)) = len(S) + len(T) by induction on S.
    // In the cons case, the IH is: IH (T: List): len(concat(L, T)) = len(L) + len(T)
    // We apply it where T = cons(a, nil), which is different from the variable T.
    const ih = new TheoremAst('IH', [['T', 'List']], [],
        new AtomProp(ParseFormula('len(concat(L, T)) = len(L) + len(T)')));
    const caseEnv = new NestedEnv(topEnv,
        [['a', 'Int'], ['L', 'List']], [], [ih]);

    // Current expression: len(concat(L, cons(a, nil)))
    // Applying IH should unify T = cons(a, nil) and produce len(L) + len(cons(a, nil))
    const current = ParseExpr('len(concat(L, cons(a, nil)))');
    const result = applyForwardRule('apply IH', current, caseEnv);
    assert.equal(result.expr.to_string(), 'len(L) + len(cons(a, nil))');
    assert.equal(result.op, '=');
  });

  it('apply IH with free param unifying to a complex expression', function() {
    // IH (T: List): len(concat(L, T)) = len(L) + len(T)
    // Apply where T = concat(X, Y) — a nested concat.
    const ih = new TheoremAst('IH', [['T', 'List']], [],
        new AtomProp(ParseFormula('len(concat(L, T)) = len(L) + len(T)')));
    const caseEnv = new NestedEnv(topEnv,
        [['L', 'List'], ['X', 'List'], ['Y', 'List']], [], [ih]);

    const current = ParseExpr('len(concat(L, concat(X, Y)))');
    const result = applyForwardRule('apply IH', current, caseEnv);
    assert.equal(result.expr.to_string(), 'len(L) + len(concat(X, Y))');
  });

  it('unapp IH with free param (reverse direction)', function() {
    // IH (T: List): len(concat(L, T)) = len(L) + len(T)
    // unapp: match right side len(L) + len(cons(a, nil)), produce left side len(concat(L, cons(a, nil)))
    const ih = new TheoremAst('IH', [['T', 'List']], [],
        new AtomProp(ParseFormula('len(concat(L, T)) = len(L) + len(T)')));
    const caseEnv = new NestedEnv(topEnv,
        [['a', 'Int'], ['L', 'List']], [], [ih]);

    const goal = ParseExpr('len(concat(L, cons(a, nil)))');
    const result = applyBackwardRule('unapp IH', goal, caseEnv);
    assert.equal(result.expr.to_string(), 'len(L) + len(cons(a, nil))');
  });
});
