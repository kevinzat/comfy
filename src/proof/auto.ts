/**
 * The "auto" proof tactic.
 *
 * Shared pipeline for both equation (=) and inequality (<, <=) goals:
 *
 *   1. Fast path (inequality only): if IsInequalityImplied discharges the
 *      goal directly from the raw knowns, succeed without building the
 *      e-graph. This covers plain arithmetic reasoning.
 *
 *   2. Seed an e-graph with the goal sides and both sides of each equation
 *      known, unioning the two sides of each. Inequality knowns never enter
 *      the graph — they can't propagate equalities.
 *
 *   3. Saturate up to MAX_ITERATIONS passes. Each pass collects pending
 *      unions from two sources and applies them in a batch, then rebuilds:
 *
 *       a. Defof saturation. For every function definition, e-match its
 *          (freshened) LHS against every class; on a match, add the
 *          substituted RHS and union it with the matched class. Conditional
 *          definitions are applied only when every condition can be
 *          discharged from the raw knowns for some choice of concrete
 *          representatives of the matched variables (cartesian product over
 *          each variable's e-class members). Supported condition shapes:
 *          an AtomProp with op =, <, or <= (discharged by
 *          IsInequalityImplied, which handles = via a two-sided check); or
 *          a NotProp of an equality (discharged by showing either strict
 *          inequality direction). Any other shape — e.g. an OrProp guard —
 *          causes the whole def to be skipped.
 *
 *       b. Arithmetic saturation. For every pair of distinct classes, try
 *          every pair of candidate expressions — one per e-node, with
 *          children extracted cheaply — where at least one side has outer-
 *          layer arithmetic. IsEquationImplied (linearising over the
 *          equation knowns) decides whether the pair is equal; if so, the
 *          classes are unioned. Enumerating multiple candidates per class
 *          matters because a class may contain both a variable and a
 *          constant of equal size (e.g. after `a = 1`), and only the
 *          constant exposes usable arithmetic.
 *
 *      An equation goal short-circuits the loop as soon as its two sides
 *      land in the same class.
 *
 *   4. Decide:
 *       - Equation goal: succeed if the two goal sides are in the same
 *         class after saturation.
 *       - Inequality goal: enumerate candidate expressions for each goal
 *         side from its class and call IsInequalityImplied on each
 *         (left, right) pair. This lets equation knowns reshape the goal —
 *         e.g. `b = 1` rewrites `(b - 1)^2 < c` to `(b - b)^2 < c`, which
 *         normalises to `0 < c`.
 */

import {
  Expression, Constant, Variable, Call,
  EXPR_CONSTANT, EXPR_VARIABLE, EXPR_FUNCTION,
  FUNC_ADD, FUNC_SUBTRACT, FUNC_MULTIPLY, FUNC_NEGATE, FUNC_EXPONENTIATE,
} from '../facts/exprs';
import { Formula, FormulaOp, OP_EQUAL, OP_LESS_THAN, OP_LESS_EQUAL, subst_formula } from '../facts/formula';
import { Prop, AtomProp, NotProp } from '../facts/prop';
import { Environment } from '../types/env';
import { Match } from '../calc/calc_complete';
import { UserError } from '../facts/user_error';
import {
  EGraph, EClassId, ENode, opForConstant, opForVariable, opForCall,
} from '../egraph/egraph';
import { FreshVarName } from '../facts/unify';
import { funcToDefinitions } from '../lang/func_ast';
import { IsInequalityImplied } from '../decision/inequality';
import { IsEquationImplied } from '../decision/equation';
import {
  ProofTactic, ProofGoal, ProofMethodParser, ParsedMethod, parseTacticMethod,
} from './proof_tactic';


const MAX_ITERATIONS = 100;


const ARITHMETIC_FUNCS: ReadonlySet<string> = new Set([
  FUNC_ADD, FUNC_SUBTRACT, FUNC_MULTIPLY, FUNC_NEGATE, FUNC_EXPONENTIATE,
]);


function isSupportedOp(op: FormulaOp): boolean {
  return op === OP_EQUAL || op === OP_LESS_THAN || op === OP_LESS_EQUAL;
}


/**
 * True if `expr` has arithmetic at the outer layer — either an integer
 * constant or a top-level arithmetic operator. IsEquationImplied treats
 * every non-arithmetic function call as an opaque atom, so arithmetic
 * buried inside a function call is invisible and doesn't qualify.
 */
function hasOuterArithmetic(expr: Expression): boolean {
  if (expr.variety === EXPR_CONSTANT) return true;
  if (expr.variety === EXPR_VARIABLE) return false;
  return ARITHMETIC_FUNCS.has(expr.name);
}


/**
 * A compiled condition. `neq: true` encodes a `NotProp` guard on an equality
 * (the only form a NotProp takes, per `negateLiteral`); discharging it means
 * showing the two sides are known to be strictly less than or greater than
 * each other. `neq: false` is an ordinary atom whose op is `=`, `<`, or `<=`.
 */
interface DefCondition {
  neq: boolean;
  formula: Formula;
}


interface CompiledDef {
  name: string;
  pattern: Expression;        // freshened LHS
  replacement: Expression;    // freshened RHS
  conditions: DefCondition[]; // freshened conditions; empty for unconditional
  freeVars: Set<string>;      // fresh names standing in for the pattern vars
}


/**
 * Collects every definition reachable from the environment whose conditions
 * (if any) are plain equation/inequality atoms the decision procedure can
 * discharge. Pattern variables are freshened throughout LHS, RHS, and
 * conditions so they can't collide with variables in the goal or knowns.
 */
function compileDefs(env: Environment): CompiledDef[] {
  const result: CompiledDef[] = [];
  for (const funcName of env.functionNames()) {
    const funcAst = env.getFunctionDecl(funcName);
    for (const def of funcToDefinitions(funcAst)) {
      const origConds: DefCondition[] = [];
      let allSupported = true;
      for (const c of def.conditions) {
        if (c instanceof AtomProp && isSupportedOp(c.formula.op)) {
          origConds.push({ neq: false, formula: c.formula });
        } else if (c instanceof NotProp && c.formula.op === OP_EQUAL) {
          origConds.push({ neq: true, formula: c.formula });
        } else {
          allSupported = false;
          break;
        }
      }
      if (!allSupported) continue;
      const origLHS = def.formula.left;
      const origRHS = def.formula.right;
      const origVars = new Set(
          origLHS.var_refs().filter(v => !env.hasConstructor(v)));
      let lhs = origLHS;
      let rhs = origRHS;
      let conds = origConds;
      const freeVars = new Set<string>();
      for (const v of origVars) {
        const fresh = FreshVarName();
        freeVars.add(fresh);
        lhs = lhs.subst(Variable.of(v), Variable.of(fresh));
        rhs = rhs.subst(Variable.of(v), Variable.of(fresh));
        conds = conds.map(c => ({
          neq: c.neq,
          formula: subst_formula(c.formula, Variable.of(v), Variable.of(fresh)),
        }));
      }
      result.push({
        name: def.name, pattern: lhs, replacement: rhs,
        conditions: conds, freeVars,
      });
    }
  }
  return result;
}


/**
 * Rebuilds an Expression from an e-node op and already-extracted children.
 * Mirrors the encoding in egraph.ts.
 */
function exprFromNode(node: ENode, children: Expression[]): Expression {
  if (node.op.startsWith('c:')) return Constant.of(BigInt(node.op.slice(2)));
  if (node.op.startsWith('v:')) return Variable.of(node.op.slice(2));
  /* v8 ignore start */
  if (!node.op.startsWith('f:')) throw new Error(`bad op: ${node.op}`);
  /* v8 ignore stop */
  return new Call(node.op.slice(2), children);
}


/**
 * Returns one candidate Expression per e-node in `cid`'s class. Each
 * candidate uses the e-graph's cheapest extraction for the node's children.
 * This lets condition checks try multiple concrete forms of the matched
 * argument (e.g. both `abs(x)` and `-x` when those were unioned).
 */
function candidateExprs(egraph: EGraph, cid: EClassId): Expression[] {
  const exprs: Expression[] = [];
  for (const node of egraph.classNodes(cid)) {
    const children = node.children.map(c => egraph.extract(c));
    exprs.push(exprFromNode(node, children));
  }
  return exprs;
}


/**
 * Checks whether `def`'s conditions can be discharged from `knowns` for some
 * choice of concrete representatives of each pattern variable's e-class.
 * Tries every combination of candidates (cartesian product over vars).
 */
function conditionsHold(
    def: CompiledDef, subst: Map<string, EClassId>,
    egraph: EGraph, knowns: Formula[]): boolean {
  if (def.conditions.length === 0) return true;
  const vars = Array.from(subst.keys());
  const candidates = vars.map(v => candidateExprs(egraph, subst.get(v)!));

  const indices = new Array<number>(vars.length).fill(0);
  while (true) {
    const exprSubst = new Map<string, Expression>();
    for (let i = 0; i < vars.length; i++) {
      exprSubst.set(vars[i], candidates[i][indices[i]]);
    }
    let ok = true;
    for (const cond of def.conditions) {
      let f = cond.formula;
      for (const [v, e] of exprSubst) f = subst_formula(f, Variable.of(v), e);
      if (cond.neq) {
        // NotProp on an equality: discharged if either strict inequality
        // direction is implied. Either `left < right` or `right < left`
        // proves `left != right`.
        const lt = new Formula(f.left, OP_LESS_THAN, f.right);
        const gt = new Formula(f.right, OP_LESS_THAN, f.left);
        if (!IsInequalityImplied(knowns, lt) &&
            !IsInequalityImplied(knowns, gt)) { ok = false; break; }
      } else if (!IsInequalityImplied(knowns, f)) {
        ok = false; break;
      }
    }
    if (ok) return true;

    // Advance to next combination.
    let i = 0;
    while (i < vars.length) {
      indices[i]++;
      if (indices[i] < candidates[i].length) break;
      indices[i] = 0;
      i++;
    }
    if (i === vars.length) return false;
  }
}


/**
 * E-matches `pattern` against class `classId`. Returns a substitution from
 * pattern variables (the names in `freeVars`) to e-class ids, or undefined if
 * no match. A pattern variable binds directly to the class it is matched
 * against. Concrete nodes (constants, non-variable callers, constructor-name
 * variables) must be represented by an e-node with the matching op; the
 * search tries each qualifying e-node in the class.
 */
function matchPatternInClass(
    egraph: EGraph, classId: EClassId, pattern: Expression,
    freeVars: Set<string>): Map<string, EClassId> | undefined {
  if (pattern.variety === EXPR_VARIABLE && freeVars.has(pattern.name)) {
    return new Map([[pattern.name, classId]]);
  }

  let expectedOp: string;
  let argPatterns: Expression[];
  /* v8 ignore start */
  if (pattern.variety === EXPR_CONSTANT) {
    // funcToDefinitions never emits a constant literal in an LHS pattern —
    // params are always Variable or Call — so this branch is defensive.
    expectedOp = opForConstant(pattern.value);
    argPatterns = [];
  } else if (pattern.variety === EXPR_VARIABLE) {
  /* v8 ignore stop */
    expectedOp = opForVariable(pattern.name);
    argPatterns = [];
  } else {  // EXPR_FUNCTION
    expectedOp = opForCall(pattern.name);
    argPatterns = pattern.args;
  }

  for (const node of egraph.classNodes(classId)) {
    if (node.op !== expectedOp) continue;
    // Arity is fixed per function name in this codebase, so matching op
    // implies matching arity. This is defensive.
    /* v8 ignore start */
    if (node.children.length !== argPatterns.length) continue;
    /* v8 ignore stop */

    const subst = new Map<string, EClassId>();
    let ok = true;
    for (let i = 0; ok && i < argPatterns.length; i++) {
      const childSubst = matchPatternInClass(
          egraph, node.children[i], argPatterns[i], freeVars);
      if (childSubst === undefined) { ok = false; break; }
      for (const [k, v] of childSubst) {
        const prev = subst.get(k);
        /* v8 ignore start */
        if (prev !== undefined) {
          // Repeated pattern variable with conflicting bindings. Function
          // params must be distinct names upstream, so this is defensive.
          if (!egraph.equiv(prev, v)) { ok = false; break; }
        } else {
        /* v8 ignore stop */
          subst.set(k, v);
        }
      }
    }
    if (ok) return subst;
  }
  return undefined;
}


/**
 * Adds `expr` to the e-graph, replacing each pattern variable in `freeVars`
 * with its bound e-class id from `subst`. Returns the class id of the result.
 */
function addWithSubst(
    egraph: EGraph, expr: Expression, subst: Map<string, EClassId>,
    freeVars: Set<string>): EClassId {
  if (expr.variety === EXPR_CONSTANT) {
    return egraph.addNode({ op: opForConstant(expr.value), children: [] });
  }
  if (expr.variety === EXPR_VARIABLE) {
    if (freeVars.has(expr.name)) {
      const cid = subst.get(expr.name);
      /* v8 ignore start */
      if (cid === undefined)
        throw new Error(`auto: unbound pattern variable ${expr.name}`);
      /* v8 ignore stop */
      return cid;
    }
    return egraph.addNode({ op: opForVariable(expr.name), children: [] });
  }
  // EXPR_FUNCTION
  const children = expr.args.map(
      a => addWithSubst(egraph, a, subst, freeVars));
  return egraph.addNode({ op: opForCall(expr.name), children });
}


export class AutoTactic implements ProofTactic {
  private env: Environment;
  private goalFormula: Formula;
  private known: Formula[];

  constructor(env: Environment, goal: Prop, refs: Array<number | string>) {
    if (goal.tag !== 'atom' || !isSupportedOp(goal.formula.op))
      throw new UserError('auto requires an equation or inequality goal', 0, 0, 0);
    this.env = env;
    this.goalFormula = goal.formula;

    // Start with all nested (non-top-level) knowns: facts from enclosing
    // case/proof scopes and theorems like the IH from induction. Unsupported
    // shapes are silently skipped — the user didn't cite them.
    this.known = [];
    for (const fact of env.getLocalFacts()) {
      if (fact instanceof AtomProp && isSupportedOp(fact.formula.op))
        this.known.push(fact.formula);
    }
    for (const thm of env.getLocalTheorems()) {
      if (thm.params.length > 0) continue;
      if (thm.premises.length > 0) continue;
      if (thm.conclusion instanceof AtomProp &&
          isSupportedOp(thm.conclusion.formula.op))
        this.known.push(thm.conclusion.formula);
    }

    // Then add explicit refs: numbers index into facts, names must resolve
    // to a theorem. Citations validate strictly — mismatches are errors.
    for (const ref of refs) {
      if (typeof ref === 'number') {
        const prop = env.getFact(ref);
        if (!(prop instanceof AtomProp) || !isSupportedOp(prop.formula.op))
          throw new UserError(
              `auto: fact ${ref} is not an equation or inequality`, 0, 0, 0);
        this.known.push(prop.formula);
        continue;
      }
      if (!env.hasTheorem(ref))
        throw new UserError(`auto: no theorem named "${ref}"`, 0, 0, 0);
      const thm = env.getTheorem(ref);
      if (thm.params.length > 0)
        throw new UserError(
            `auto: theorem "${ref}" has parameters (not yet supported)`, 0, 0, 0);
      if (thm.premises.length > 0)
        throw new UserError(
            `auto: theorem "${ref}" has premises (not yet supported)`, 0, 0, 0);
      if (!(thm.conclusion instanceof AtomProp) ||
          !isSupportedOp(thm.conclusion.formula.op))
        throw new UserError(
            `auto: theorem "${ref}" is not an equation or inequality`, 0, 0, 0);
      this.known.push(thm.conclusion.formula);
    }
  }

  decompose(): ProofGoal[] {
    // Fast path: if the decision procedure handles the goal directly from
    // the raw knowns, skip the e-graph. This covers plain arithmetic
    // inequalities and saves the cost of saturation.
    if (this.goalFormula.op !== OP_EQUAL &&
        IsInequalityImplied(this.known, this.goalFormula)) return [];

    // E-graph path: seeded with goal sides and equation knowns.
    const egraph = new EGraph();
    const goalL = egraph.add(this.goalFormula.left);
    const goalR = egraph.add(this.goalFormula.right);
    for (const k of this.known) {
      if (k.op === OP_EQUAL) {
        egraph.union(egraph.add(k.left), egraph.add(k.right));
      }
    }
    egraph.rebuild();

    const defs = compileDefs(this.env);
    const eqKnowns = this.known.filter(k => k.op === OP_EQUAL);

    for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
      if (this.goalFormula.op === OP_EQUAL && egraph.equiv(goalL, goalR))
        return [];

      // Snapshot class ids; new classes created during this pass are visited
      // on the next iteration.
      const classes = egraph.classIds();

      // Collect all pending unions first, then apply in a batch so each
      // step sees a consistent graph state.
      const unions: Array<[EClassId, EClassId]> = [];

      // 1. defof saturation: apply every function definition once to every
      // class it matches.
      for (const def of defs) {
        for (const id of classes) {
          const subst = matchPatternInClass(
              egraph, id, def.pattern, def.freeVars);
          if (subst === undefined) continue;
          if (!conditionsHold(def, subst, egraph, this.known)) continue;
          const replId = addWithSubst(
              egraph, def.replacement, subst, def.freeVars);
          if (!egraph.equiv(id, replId)) unions.push([id, replId]);
        }
      }

      // 2. Arithmetic saturation: for every pair of distinct classes, try
      // every pair of candidate expressions (one per e-node, children
      // extracted cheaply) where at least one side has outer-layer
      // arithmetic. Non-arithmetic function calls are opaque to the decision
      // procedure, so a pair with arithmetic on neither side contributes no
      // signal. Multiple candidates per class are required because the
      // cheapest extraction may hide a constant behind a variable of equal
      // size (e.g. a class containing both `v:a` and `c:1` after `a = 1`).
      const classCandidates = classes.map(c => candidateExprs(egraph, c));
      for (let i = 0; i < classes.length; i++) {
        for (let j = i + 1; j < classes.length; j++) {
          // Snapshotted ids are all canonical-distinct at the start of this
          // pass; unions are batched below so no intra-pass merges occur.
          /* v8 ignore start */
          if (egraph.equiv(classes[i], classes[j])) continue;
          /* v8 ignore stop */
          let merged = false;
          for (const e1 of classCandidates[i]) {
            if (merged) break;
            for (const e2 of classCandidates[j]) {
              if (!hasOuterArithmetic(e1) && !hasOuterArithmetic(e2)) continue;
              if (IsEquationImplied(
                  eqKnowns, new Formula(e1, OP_EQUAL, e2))) {
                unions.push([classes[i], classes[j]]);
                merged = true;
                break;
              }
            }
          }
        }
      }

      if (unions.length === 0) break;
      for (const [a, b] of unions) egraph.union(a, b);
      egraph.rebuild();
    }

    if (this.goalFormula.op === OP_EQUAL) {
      // Only reachable at MAX_ITERATIONS exhaustion — the normal `break`
      // path exits when no unions were applied this pass, so the
      // top-of-loop equiv check was the last word.
      /* v8 ignore start */
      if (egraph.equiv(goalL, goalR)) return [];
      /* v8 ignore stop */
    } else {
      // Inequality goal: try rewriting each side via the saturated graph
      // and asking the decision procedure about the rewritten inequality.
      // Enumerating candidates on both sides lets an equation known like
      // `b = 1` rewrite `(b - 1)^2` into `(b - b)^2`, which normalises to 0.
      const leftCands = candidateExprs(egraph, goalL);
      const rightCands = candidateExprs(egraph, goalR);
      for (const l of leftCands) {
        for (const r of rightCands) {
          if (IsInequalityImplied(
              this.known, new Formula(l, this.goalFormula.op, r))) return [];
        }
      }
    }
    throw new UserError(
        `auto: could not prove ${this.goalFormula.to_string()}`, 0, 0, 0);
  }
}


export const autoParser: ProofMethodParser = {
  tryParse(text: string, goal: Prop, env: Environment): ParsedMethod | string | null {
    const method = parseTacticMethod(text);
    if (method?.kind !== 'auto') return null;
    if (goal.tag !== 'atom' || !isSupportedOp(goal.formula.op))
      return 'auto requires an equation or inequality goal';
    try {
      return { kind: 'tactic', tactic: new AutoTactic(env, goal, method.refs) };
    } catch (e) {
      /* v8 ignore start */
      if (!(e instanceof UserError)) throw new Error(`unexpected: ${e}`);
      /* v8 ignore stop */
      return e.message;
    }
  },

  getMatches(text: string): Match[] {
    const trimmed = text.trim();
    if ('auto'.startsWith(trimmed) && trimmed.length > 0) {
      return [{
        description: [
          { bold: true, text: trimmed },
          { bold: false, text: 'auto'.substring(trimmed.length) },
        ],
        completion: 'auto',
      }];
    } else if (trimmed.startsWith('auto ')) {
      return [{
        description: [
          { bold: true, text: trimmed },
          { bold: false, text: '' },
        ],
        completion: trimmed,
      }];
    }
    return [];
  },
};
