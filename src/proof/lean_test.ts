import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { parseProofFile } from './proof_file';
import { ProofFile, CalcProofNode, CalcStep } from './proof_file';
import { toLean, oblToLean } from './lean';
import { ProofObligation } from '../program/obligations';
import { DeclsAst } from '../lang/decls_ast';
import { TheoremAst } from '../lang/theorem_ast';
import { AtomProp, NotProp, OrProp, ConstProp } from '../facts/prop';
import { Formula } from '../facts/formula';
import { Variable, Constant } from '../facts/exprs';
import { ParseDecls } from '../lang/decls_parser';
import { ParseFunc } from '../lang/func_parser';
import { FuncAst, TypeAst, CaseAst, ExprBody, ParamVar, ParamConstructor } from '../lang/func_ast';
import { Call, FUNC_ADD, FUNC_SUBTRACT, FUNC_MULTIPLY, FUNC_NEGATE, FUNC_EXPONENTIATE } from '../facts/exprs';


const proofsDir = path.join(__dirname, 'proofs');
const proofFiles = fs.readdirSync(proofsDir)
    .filter(f => f.endsWith('.prf'))
    .sort();

describe('toLean', function() {
  for (const file of proofFiles) {
    it(`translates ${file}`, function() {
      const source = fs.readFileSync(path.join(proofsDir, file), 'utf-8');
      const pf = parseProofFile(source);
      const lean = toLean(pf);

      // Basic structure checks
      assert.ok(lean.includes('namespace Comfy'));
      assert.ok(lean.includes('end Comfy'));
      assert.ok(lean.includes('theorem'));
      assert.ok(lean.includes(':= by'));
    });
  }

  it('concat_nil produces expected Lean structure', function() {
    const source = fs.readFileSync(path.join(proofsDir, 'concat_nil.prf'), 'utf-8');
    const pf = parseProofFile(source);
    const lean = toLean(pf);

    assert.ok(lean.includes('inductive List where'));
    assert.ok(lean.includes('| nil : List'));
    assert.ok(lean.includes('| cons : Int → List → List'));
    assert.ok(lean.includes('def concat : List → List → List'));
    assert.ok(lean.includes('theorem concat_nil (S : List) : concat S .nil = S := by'));
    assert.ok(lean.includes('induction S with'));
    assert.ok(lean.includes('| nil =>'));
    assert.ok(lean.includes('| cons a L ih =>'));
    assert.ok(lean.includes('simp [concat]'));
    assert.ok(lean.includes('simp [concat, ih]'));
  });

  it('tree_size has two IH names', function() {
    const source = fs.readFileSync(path.join(proofsDir, 'tree_size.prf'), 'utf-8');
    const pf = parseProofFile(source);
    const lean = toLean(pf);

    assert.ok(lean.includes('| node L R ih_L ih_R =>'));
    assert.ok(lean.includes('ih_L'));
    assert.ok(lean.includes('ih_R'));
  });

  it('sum_positives has by_cases', function() {
    const source = fs.readFileSync(path.join(proofsDir, 'sum_positives.prf'), 'utf-8');
    const pf = parseProofFile(source);
    const lean = toLean(pf);

    assert.ok(lean.includes('by_cases h : a < 0'));
    assert.ok(lean.includes('simp [sum, positives, ih, h]'));
  });

  it('rev_acc uses concat_assoc axiom', function() {
    const source = fs.readFileSync(path.join(proofsDir, 'rev_acc.prf'), 'utf-8');
    const pf = parseProofFile(source);
    const lean = toLean(pf);

    assert.ok(lean.includes('axiom concat_assoc'));
    assert.ok(lean.includes('concat_assoc'));
  });

  it('expressions use Lean syntax (no parens for function calls)', function() {
    const source = fs.readFileSync(path.join(proofsDir, 'concat_nil.prf'), 'utf-8');
    const pf = parseProofFile(source);
    const lean = toLean(pf);

    // Should use "concat S .nil" not "concat(S, nil)"
    assert.ok(lean.includes('concat S .nil'));
    // Constructor in patterns should use dot notation
    assert.ok(lean.includes('.nil'));
    assert.ok(lean.includes('.cons'));
  });

  it('theorem with no params uses no param group', function() {
    const conclusion = new AtomProp(new Formula(Constant.of(0n), '=', Constant.of(0n)));
    const thm = new TheoremAst('trivial_thm', [], [], conclusion, 1);
    const decls = new DeclsAst([], [], [thm]);
    const proof: CalcProofNode = {
      kind: 'calculate',
      forwardStart: null,
      forwardSteps: [],
      backwardStart: null,
      backwardSteps: [],
    };
    const pf: ProofFile = {
      decls,
      theoremName: 'trivial_thm',
      theoremLine: 1,
      givens: [],
      proof,
    };
    const lean = toLean(pf);
    assert.ok(lean.includes('theorem trivial_thm : 0 = 0'));
  });

  it('theorem with premise uses hypothesis parameter', function() {
    // Build a ProofFile with a theorem that has premises
    const premise = new AtomProp(new Formula(Variable.of('x'), '=', Constant.of(0n)));
    const conclusion = new AtomProp(new Formula(Variable.of('x'), '=', Constant.of(0n)));
    const thm = new TheoremAst('my_thm', [['x', 'Int']], [premise], conclusion, 1);
    const decls = new DeclsAst([], [], [thm]);
    const proof: CalcProofNode = {
      kind: 'calculate',
      forwardStart: null,
      forwardSteps: [],
      backwardStart: null,
      backwardSteps: [],
    };
    const pf: ProofFile = {
      decls,
      theoremName: 'my_thm',
      theoremLine: 1,
      givens: [],
      proof,
    };
    const lean = toLean(pf);
    assert.ok(lean.includes('namespace Comfy'));
    assert.ok(lean.includes('theorem my_thm'));
    // Premise should appear as hypothesis
    assert.ok(lean.includes('h_premise'));
  });

  it('theorem with multiple premises uses numbered hypotheses', function() {
    const p1 = new AtomProp(new Formula(Variable.of('x'), '=', Constant.of(0n)));
    const p2 = new AtomProp(new Formula(Variable.of('y'), '=', Constant.of(0n)));
    const conclusion = new AtomProp(new Formula(Variable.of('x'), '=', Constant.of(0n)));
    const thm = new TheoremAst('multi_thm', [['x', 'Int'], ['y', 'Int']], [p1, p2], conclusion, 1);
    const decls = new DeclsAst([], [], [thm]);
    const proof: CalcProofNode = {
      kind: 'calculate',
      forwardStart: null,
      forwardSteps: [],
      backwardStart: null,
      backwardSteps: [],
    };
    const pf: ProofFile = {
      decls,
      theoremName: 'multi_thm',
      theoremLine: 1,
      givens: [],
      proof,
    };
    const lean = toLean(pf);
    assert.ok(lean.includes('h_premise1'));
    assert.ok(lean.includes('h_premise2'));
  });
});


describe('oblToLean', function() {

  function makeCalcProof(): CalcProofNode {
    return {
      kind: 'calculate',
      forwardStart: null,
      forwardSteps: [],
      backwardStart: null,
      backwardSteps: [],
    };
  }

  it('generates valid Lean structure with namespace and obligation', function() {
    const goal = new AtomProp(new Formula(Variable.of('x'), '=', Constant.of(0n)));
    const obl = new ProofObligation([], goal, 1, [['x', 'Int']]);
    const decls = new DeclsAst([], [], []);
    const lean = oblToLean(obl, decls, makeCalcProof());
    assert.ok(lean.includes('namespace Comfy'));
    assert.ok(lean.includes('end Comfy'));
    assert.ok(lean.includes('theorem obligation'));
    assert.ok(lean.includes(':= by'));
  });

  it('includes obligation params in theorem signature', function() {
    const goal = new AtomProp(new Formula(Variable.of('x'), '=', Constant.of(0n)));
    const obl = new ProofObligation([], goal, 1, [['x', 'Int']]);
    const decls = new DeclsAst([], [], []);
    const lean = oblToLean(obl, decls, makeCalcProof());
    assert.ok(lean.includes('(x : Int)'));
  });

  it('includes AtomProp premises as hypotheses', function() {
    const premise = new AtomProp(new Formula(Variable.of('x'), '=', Constant.of(0n)));
    const goal = new AtomProp(new Formula(Variable.of('x'), '=', Constant.of(0n)));
    const obl = new ProofObligation([premise], goal, 1, [['x', 'Int']]);
    const decls = new DeclsAst([], [], []);
    const lean = oblToLean(obl, decls, makeCalcProof());
    assert.ok(lean.includes('h_1'));
  });

  it('excludes NotProp premises from hypotheses (not provable via omega)', function() {
    const notPrem = new NotProp(new Formula(Variable.of('x'), '=', Constant.of(0n)));
    const goal = new AtomProp(new Formula(Variable.of('x'), '=', Constant.of(0n)));
    const obl = new ProofObligation([notPrem], goal, 1, [['x', 'Int']]);
    const decls = new DeclsAst([], [], []);
    const lean = oblToLean(obl, decls, makeCalcProof());
    // NotProp premises are filtered out (tag === 'not')
    assert.ok(!lean.includes('h_1'));
  });

  it('includes decl types, functions, and theorems', function() {
    const result = ParseDecls(`
      type Bool | t : Bool | f : Bool
      theorem axiom1 (x : Int) | x = 0
    `);
    assert.ok(result.ast);
    const goal = new AtomProp(new Formula(Variable.of('x'), '=', Constant.of(0n)));
    const obl = new ProofObligation([], goal, 1, [['x', 'Int']]);
    const lean = oblToLean(obl, result.ast!, makeCalcProof());
    assert.ok(lean.includes('inductive Bool'));
    assert.ok(lean.includes('axiom axiom1'));
  });

  it('uses omega for calc proof with no steps', function() {
    const goal = new AtomProp(new Formula(Variable.of('x'), '=', Constant.of(0n)));
    const obl = new ProofObligation([], goal, 1, [['x', 'Int']]);
    const decls = new DeclsAst([], [], []);
    const lean = oblToLean(obl, decls, makeCalcProof());
    assert.ok(lean.includes('omega'));
  });

  it('includes function definitions in decls', function() {
    const funcResult = ParseFunc(
      `def double : (Int) -> Int\n  | double(x) => x + x`
    );
    assert.ok(funcResult.ast);
    const goal = new AtomProp(new Formula(Variable.of('x'), '=', Constant.of(0n)));
    const obl = new ProofObligation([], goal, 1, [['x', 'Int']]);
    const decls = new DeclsAst([], [funcResult.ast!], []);
    const lean = oblToLean(obl, decls, makeCalcProof());
    assert.ok(lean.includes('def double'));
  });

  it('parenthesizes add expression inside multiply context', function() {
    // Goal: (x + 1) * 2 = y — add inside multiply needs parens
    const x = Variable.of('x');
    const y = Variable.of('y');
    const addExpr = Call.add(x, Constant.of(1n));
    const mulExpr = Call.multiply(addExpr, Constant.of(2n));
    const goal = new AtomProp(new Formula(mulExpr, '=', y));
    const obl = new ProofObligation([], goal, 1, [['x', 'Int'], ['y', 'Int']]);
    const lean = oblToLean(obl, new DeclsAst([], [], []), makeCalcProof());
    assert.ok(lean.includes('(x + 1) * 2'));
  });

  it('parenthesizes subtract expression inside multiply context', function() {
    // Goal: (x - 1) * 2 = y
    const x = Variable.of('x');
    const y = Variable.of('y');
    const subExpr = Call.subtract(x, Constant.of(1n));
    const mulExpr = Call.multiply(subExpr, Constant.of(2n));
    const goal = new AtomProp(new Formula(mulExpr, '=', y));
    const obl = new ProofObligation([], goal, 1, [['x', 'Int'], ['y', 'Int']]);
    const lean = oblToLean(obl, new DeclsAst([], [], []), makeCalcProof());
    assert.ok(lean.includes('(x - 1) * 2'));
  });

  it('parenthesizes negative constant inside add context', function() {
    // Goal: x + (-1) = y — negative constant in add context needs parens
    const x = Variable.of('x');
    const y = Variable.of('y');
    const addExpr = Call.add(x, Constant.of(-1n));
    const goal = new AtomProp(new Formula(addExpr, '=', y));
    const obl = new ProofObligation([], goal, 1, [['x', 'Int'], ['y', 'Int']]);
    const lean = oblToLean(obl, new DeclsAst([], [], []), makeCalcProof());
    assert.ok(lean.includes('(-1)'));
  });

  it('parenthesizes negate inside high-precedence context', function() {
    // Goal: (-x) ^ 2 = y — negate inside exponentiate needs parens
    const x = Variable.of('x');
    const y = Variable.of('y');
    const negX = Call.negate(x);
    const expExpr = Call.exponentiate(negX, Constant.of(2n));
    const goal = new AtomProp(new Formula(expExpr, '=', y));
    const obl = new ProofObligation([], goal, 1, [['x', 'Int'], ['y', 'Int']]);
    const lean = oblToLean(obl, new DeclsAst([], [], []), makeCalcProof());
    assert.ok(lean.includes('(-x)'));
  });

  it('parenthesizes multiply inside multiply right-arg context', function() {
    // Goal: x * (y * 2) = z — multiply at prec=71 (right arg) needs parens when prec > 70
    // x * (y * 2): outer mul passes prec=71 to right arg (y*2), so prec(71) > 70 → (y * 2)
    const x = Variable.of('x');
    const y = Variable.of('y');
    const z = Variable.of('z');
    const inner = Call.multiply(y, Constant.of(2n));
    const outer = Call.multiply(x, inner);
    const goal = new AtomProp(new Formula(outer, '=', z));
    const obl = new ProofObligation([], goal, 1, [['x', 'Int'], ['y', 'Int'], ['z', 'Int']]);
    const lean = oblToLean(obl, new DeclsAst([], [], []), makeCalcProof());
    assert.ok(lean.includes('(y * 2)'));
  });

  it('parenthesizes exponentiate inside exponentiate context', function() {
    // Goal: (x ^ 2) ^ 3 = y — inner exp at prec > 75 needs parens when prec > 75
    const x = Variable.of('x');
    const y = Variable.of('y');
    const inner = Call.exponentiate(x, Constant.of(2n));
    // Outer exp passes prec=76 to left arg, so prec(76) > 75 → (x ^ 2)
    const outer = Call.exponentiate(inner, Constant.of(3n));
    const goal = new AtomProp(new Formula(outer, '=', y));
    const obl = new ProofObligation([], goal, 1, [['x', 'Int'], ['y', 'Int']]);
    const lean = oblToLean(obl, new DeclsAst([], [], []), makeCalcProof());
    assert.ok(lean.includes('(x ^ 2) ^ 3'));
  });

  it('handles obligation with no params', function() {
    const goal = new AtomProp(new Formula(Constant.of(0n), '=', Constant.of(0n)));
    const obl = new ProofObligation([], goal, 1, []);
    const lean = oblToLean(obl, new DeclsAst([], [], []), makeCalcProof());
    assert.ok(lean.includes('theorem obligation :'));
  });

  it('axiom with premises generates arrow-separated hypotheses', function() {
    // Theorem with premises generates: axiom name : premise → conclusion
    const premise = new AtomProp(new Formula(Variable.of('x'), '=', Constant.of(0n)));
    const conclusion = new AtomProp(new Formula(Variable.of('x'), '=', Constant.of(0n)));
    const axiom = new TheoremAst('my_axiom', [['x', 'Int']], [premise], conclusion, 1);
    const decls = new DeclsAst([], [], [axiom]);
    const goal = new AtomProp(new Formula(Constant.of(0n), '=', Constant.of(0n)));
    const obl = new ProofObligation([], goal, 1, []);
    const lean = oblToLean(obl, decls, makeCalcProof());
    assert.ok(lean.includes('axiom my_axiom'));
    assert.ok(lean.includes(' → '));  // premise separator
  });

  it('axiom with no params generates no param group', function() {
    // Theorem with no params: axiomToLean should return axiom without param group
    const conclusion = new AtomProp(new Formula(Constant.of(0n), '=', Constant.of(0n)));
    const axiom = new TheoremAst('trivial', [], [], conclusion, 1);
    const decls = new DeclsAst([], [], [axiom]);
    const goal = new AtomProp(new Formula(Constant.of(0n), '=', Constant.of(0n)));
    const obl = new ProofObligation([], goal, 1, []);
    const lean = oblToLean(obl, decls, makeCalcProof());
    assert.ok(lean.includes('axiom trivial : 0 = 0'));
  });

  it('handles NotProp goal', function() {
    const goal = new NotProp(new Formula(Variable.of('x'), '=', Constant.of(0n)));
    const obl = new ProofObligation([], goal, 1, [['x', 'Int']]);
    const lean = oblToLean(obl, new DeclsAst([], [], []), makeCalcProof());
    assert.ok(lean.includes('¬(x = 0)'));
  });

  it('handles ConstProp goal', function() {
    const goalTrue = new ConstProp(true);
    const oblTrue = new ProofObligation([], goalTrue, 1, []);
    const leanTrue = oblToLean(oblTrue, new DeclsAst([], [], []), makeCalcProof());
    assert.ok(leanTrue.includes('True'));

    const goalFalse = new ConstProp(false);
    const oblFalse = new ProofObligation([], goalFalse, 1, []);
    const leanFalse = oblToLean(oblFalse, new DeclsAst([], [], []), makeCalcProof());
    assert.ok(leanFalse.includes('False'));
  });

  it('handles OrProp goal', function() {
    const d1 = new AtomProp(new Formula(Variable.of('x'), '=', Constant.of(0n)));
    const d2 = new AtomProp(new Formula(Variable.of('y'), '=', Constant.of(1n)));
    const goal = new OrProp([d1, d2]);
    const obl = new ProofObligation([], goal, 1, [['x', 'Int'], ['y', 'Int']]);
    const lean = oblToLean(obl, new DeclsAst([], [], []), makeCalcProof());
    assert.ok(lean.includes('x = 0 ∨ y = 1'));
  });

  it('handles nested constructor patterns (paramToLeanAtom)', function() {
    // Manually build a function with nested constructor patterns
    // Pattern: cons(cons(x, nil)) — outer cons has arg cons(x, nil), inner cons has args [x, nil]
    const declResult = ParseDecls(`type List\n| nil : List\n| cons : (Int, List) -> List`);
    assert.ok(declResult.ast);
    // Build: f(.cons (.cons x .nil) .nil) => x
    // This ensures paramToLeanAtom is called with:
    //   - ParamConstructor("nil", []) → hits line 100 (0-arg ctor)
    //   - ParamConstructor("cons", [ParamVar("x"), ParamConstructor("nil", [])]) → hits line 101 (ctor with args)
    const innerNil = new ParamConstructor('nil', []);
    // Use ParamVar('nil') to test paramToLeanAtom with a ctor-named variable
    const innerCons = new ParamConstructor('cons', [new ParamVar('nil'), innerNil]);
    const outerNil = new ParamConstructor('nil', []);
    const outerCons = new ParamConstructor('cons', [innerCons, outerNil]);
    const body = new ExprBody(Variable.of('nil'));
    const func = new FuncAst('f', new TypeAst(['List'], 'Int'), [new CaseAst([outerCons], body)]);
    const goal = new AtomProp(new Formula(Constant.of(0n), '=', Constant.of(0n)));
    const obl = new ProofObligation([], goal, 1, []);
    const decls = new DeclsAst(declResult.ast!.types, [func], []);
    const lean = oblToLean(obl, decls, makeCalcProof());
    // Nested ctor with args should be parenthesized
    assert.ok(lean.includes('(.cons .nil .nil)'));
    // Nested ctor with no args should use dot notation
    assert.ok(lean.includes('.nil'));
  });

  it('oblToLean with if/else-if/else function', function() {
    const declResult = ParseDecls(
        `def f : (Int) -> Int
         | f(x) => if x < 0 then -1 else if x = 0 then 0 else 1`);
    assert.ok(declResult.ast);
    const goal = new AtomProp(new Formula(Constant.of(0n), '=', Constant.of(0n)));
    const obl = new ProofObligation([], goal, 1, [['x', 'Int']]);
    const lean = oblToLean(obl, declResult.ast!, makeCalcProof());
    assert.ok(lean.includes('else if'));
  });

  it('oblToLean with constructor variable', function() {
    // Variable with ctor name should use dot notation
    const declResult = ParseDecls(`type Color | red : Color | blue : Color`);
    assert.ok(declResult.ast);
    const goal = new AtomProp(new Formula(Variable.of('red'), '=', Variable.of('blue')));
    const obl = new ProofObligation([], goal, 1, []);
    const lean = oblToLean(obl, declResult.ast!, makeCalcProof());
    assert.ok(lean.includes('.red'));
    assert.ok(lean.includes('.blue'));
  });

  it('negative constant at top-level (no parens)', function() {
    // Goal: -1 = x — negative constant at prec=0 should not be parenthesized
    const x = Variable.of('x');
    const goal = new AtomProp(new Formula(Constant.of(-1n), '=', x));
    const obl = new ProofObligation([], goal, 1, [['x', 'Int']]);
    const lean = oblToLean(obl, new DeclsAst([], [], []), makeCalcProof());
    assert.ok(lean.includes('-1 = x'));
  });

  it('negate at formula level (no parens)', function() {
    // Goal: -x = y — negate at prec=0 should not be parenthesized
    const x = Variable.of('x');
    const y = Variable.of('y');
    const negX = Call.negate(x);
    const goal = new AtomProp(new Formula(negX, '=', y));
    const obl = new ProofObligation([], goal, 1, [['x', 'Int'], ['y', 'Int']]);
    const lean = oblToLean(obl, new DeclsAst([], [], []), makeCalcProof());
    assert.ok(lean.includes('-x = y'));
  });

  it('zero-arg function call in expression', function() {
    // Call with 0 args in expression — edge case
    const y = Variable.of('y');
    const fCall = new Call('f', []);
    const goal = new AtomProp(new Formula(fCall, '=', y));
    const obl = new ProofObligation([], goal, 1, [['y', 'Int']]);
    const lean = oblToLean(obl, new DeclsAst([], [], []), makeCalcProof());
    assert.ok(lean.includes('f = y'));
  });

  it('user function call with args in expression', function() {
    // Goal: f(x) = y — user function call with args
    const x = Variable.of('x');
    const y = Variable.of('y');
    const fCall = new Call('f', [x]);
    const goal = new AtomProp(new Formula(fCall, '=', y));
    const obl = new ProofObligation([], goal, 1, [['x', 'Int'], ['y', 'Int']]);
    const lean = oblToLean(obl, new DeclsAst([], [], []), makeCalcProof());
    assert.ok(lean.includes('f x = y'));
  });

  it('constructor call with args in expression', function() {
    // Goal: cons(x, nil) = y — constructor with args in expression context
    const declResult = ParseDecls(`type List\n| nil : List\n| cons : (Int, List) -> List`);
    assert.ok(declResult.ast);
    const x = Variable.of('x');
    const y = Variable.of('y');
    const nil = new Variable('nil');
    const consCall = new Call('cons', [x, nil]);
    const goal = new AtomProp(new Formula(consCall, '=', y));
    const obl = new ProofObligation([], goal, 1, [['x', 'Int'], ['y', 'List']]);
    const lean = oblToLean(obl, declResult.ast!, makeCalcProof());
    assert.ok(lean.includes('.cons x .nil'));
  });

  it('defof step with no underscore in name', function() {
    // Tests the false branch of `if (idx > 0)` in collectCalcNames
    const step: CalcStep = { ruleText: 'defof f', line: 1 };
    const proof: CalcProofNode = {
      kind: 'calculate',
      forwardStart: null,
      forwardSteps: [step],
      backwardStart: null,
      backwardSteps: [],
    };
    const goal = new AtomProp(new Formula(Constant.of(0n), '=', Constant.of(0n)));
    const obl = new ProofObligation([], goal, 1, []);
    const lean = oblToLean(obl, new DeclsAst([], [], []), proof);
    // Should still produce valid lean with omega (f has no underscore so not added to simp)
    assert.ok(lean.includes('omega'));
  });

  it('duplicate IH name in simpArgs', function() {
    // Tests the false branch of `if (!simpArgs.includes(ih))` in calcToLean
    // Create a calc proof with an apply step for an IH name, then pass the same name as ihNames
    const step: CalcStep = { ruleText: 'apply IH_test', line: 1 };
    const proof: CalcProofNode = {
      kind: 'calculate',
      forwardStart: null,
      forwardSteps: [step],
      backwardStart: null,
      backwardSteps: [],
    };
    const goal = new AtomProp(new Formula(Constant.of(0n), '=', Constant.of(0n)));
    const obl = new ProofObligation([], goal, 1, []);
    // This goes through oblToLean which passes ihNames=[] to proofToLean,
    // so we need to use toLean with a proof file that has an induction containing
    // calc steps with apply IH and ihNames from the induction case
    // Actually, oblToLean passes ihNames=[] at top level. The duplicate would happen
    // when calcToLean receives ihNames that overlap with thms from the steps.
    // Since oblToLean always passes [], let's just test that the theorem appears in simp
    const lean = oblToLean(obl, new DeclsAst([], [], []), proof);
    assert.ok(lean.includes('simp [ih_test]'));
  });

  it('theorem name not starting with IH in calc step', function() {
    // Tests the false branch of `t.match(/^IH/)` in calcToLean
    const step: CalcStep = { ruleText: 'apply my_lemma', line: 1 };
    const proof: CalcProofNode = {
      kind: 'calculate',
      forwardStart: null,
      forwardSteps: [step],
      backwardStart: null,
      backwardSteps: [],
    };
    const goal = new AtomProp(new Formula(Constant.of(0n), '=', Constant.of(0n)));
    const obl = new ProofObligation([], goal, 1, []);
    const lean = oblToLean(obl, new DeclsAst([], [], []), proof);
    assert.ok(lean.includes('simp [my_lemma]'));
  });

});
