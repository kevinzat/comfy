import { FuncDef, Stmt, condToProps, NotCondAst } from "../lang/code_ast";
import { Expression, Variable } from "../facts/exprs";
import { Formula } from "../facts/formula";
import { AtomProp, NotProp, OrProp, Literal, Prop } from "../facts/prop";
import { DeclsAst } from "../lang/decls_ast";
import { TheoremAst } from "../lang/theorem_ast";

export class ProofObligation {
  premises: Prop[];
  goal: Prop;
  line: number;
  params: [string, string][];

  constructor(premises: Prop[], goal: Prop, line: number, params: [string, string][] = []) {
    this.premises = premises;
    this.goal = goal;
    this.line = line;
    this.params = params;
  }
}

function propStr(p: Prop): string {
  if (p.tag === 'atom') {
    return `${p.formula.left.to_string()}${p.formula.op}${p.formula.right.to_string()}`;
  }
  if (p.tag === 'not') {
    return `!${p.formula.left.to_string()}${p.formula.op}${p.formula.right.to_string()}`;
  }
  if (p.tag === 'const') return p.value ? 'true' : 'false';
  return `(${p.disjuncts.map(propStr).join('|')})`;
}

/** Returns a stable string key identifying an obligation by its premises and goal. */
export function oblKey(obl: ProofObligation): string {
  const premStr = obl.premises.map(propStr).join(',');
  return `${premStr}|${propStr(obl.goal)}`;
}

function propVars(p: Prop): Set<string> {
  if (p.tag === 'atom' || p.tag === 'not') {
    return new Set([...p.formula.left.vars(), ...p.formula.right.vars()]);
  }
  if (p.tag === 'const') return new Set<string>();
  const vars = new Set<string>();
  for (const lit of p.disjuncts) {
    for (const v of propVars(lit)) vars.add(v);
  }
  return vars;
}

function oblVars(obl: ProofObligation): Set<string> {
  const vars = propVars(obl.goal);
  for (const p of obl.premises) propVars(p).forEach(v => vars.add(v));
  return vars;
}

function substFormula(f: Formula, name: string, expr: Expression): Formula {
  const v = Variable.of(name);
  return new Formula(f.left.subst(v, expr), f.op, f.right.subst(v, expr));
}

function substLiteral(p: Literal, name: string, expr: Expression): Literal {
  if (p.tag === 'atom') return new AtomProp(substFormula(p.formula, name, expr));
  return new NotProp(substFormula(p.formula, name, expr));
}

function substProp(p: Prop, name: string, expr: Expression): Prop {
  if (p.tag === 'atom') return new AtomProp(substFormula(p.formula, name, expr));
  if (p.tag === 'not') return new NotProp(substFormula(p.formula, name, expr));
  if (p.tag === 'const') return p;
  return new OrProp(p.disjuncts.map(lit => substLiteral(lit, name, expr)));
}

interface PartialObligation {
  premises: Prop[];
  goals: Prop[];
}

function substPartial(
  p: PartialObligation,
  name: string,
  expr: Expression,
): PartialObligation {
  return {
    premises: p.premises.map((prop) => substProp(prop, name, expr)),
    goals: p.goals.map((prop) => substProp(prop, name, expr)),
  };
}

/** Converts each partial obligation into proof obligations by adding extra premises. */
function partialsToObls(
  partials: PartialObligation[],
  extraPremises: Prop[],
  line: number,
): ProofObligation[] {
  const obls: ProofObligation[] = [];
  for (const p of partials) {
    const premises = [...extraPremises, ...p.premises];
    for (const goal of p.goals) {
      obls.push(new ProofObligation(premises, goal, line));
    }
  }
  return obls;
}

function processStmts(
  stmts: Stmt[],
  incoming: PartialObligation[],
  ensures: Prop[],
): [ProofObligation[], PartialObligation[]] {
  let obligations: ProofObligation[] = [];
  let partials = incoming;

  for (let i = stmts.length - 1; i >= 0; i--) {
    const [newObls, newPartials] = processStmt(stmts[i], partials, ensures);
    obligations = [...obligations, ...newObls];
    partials = newPartials;
  }

  return [obligations, partials];
}

function processStmt(
  stmt: Stmt,
  partials: PartialObligation[],
  ensures: Prop[],
): [ProofObligation[], PartialObligation[]] {
  switch (stmt.tag) {
    case "pass":
      return [[], partials];

    case "assign":
      return [[], partials.map((p) => substPartial(p, stmt.name, stmt.expr))];

    case "decl":
      return [[], partials.map((p) => substPartial(p, stmt.name, stmt.expr))];

    case "return": {
      const goals = ensures.map((p) => substProp(p, "rv", stmt.expr));
      return [[], [{ premises: [], goals }]];
    }

    case "if": {
      const [thenObls, thenTop] = processStmts(
        stmt.thenBody,
        partials,
        ensures,
      );
      const [elseObls, elseTop] = processStmts(
        stmt.elseBody,
        partials,
        ensures,
      );
      const condProps = condToProps(stmt.cond);
      const negRelProps = condToProps(new NotCondAst(stmt.cond));
      const thenExited = thenTop.map((p) => ({
        ...p,
        premises: [...condProps, ...p.premises],
      }));
      const elseExited = elseTop.map((p) => ({
        ...p,
        premises: [...negRelProps, ...p.premises],
      }));
      return [
        [...thenObls, ...elseObls],
        [...thenExited, ...elseExited],
      ];
    }

    case "while": {
      const invariantProps = stmt.invariant.flatMap(condToProps);
      const condProps = condToProps(stmt.cond);
      const negRelProps = condToProps(new NotCondAst(stmt.cond));

      // Incoming partials meet the loop exit: invariant holds and cond is false.
      const afterLoopObls = partialsToObls(
        partials,
        [...invariantProps, ...negRelProps],
        stmt.line,
      );

      // Process loop body: at the bottom sits a partial whose goals are the invariant.
      const bodyInit: PartialObligation = {
        premises: [],
        goals: [...invariantProps],
      };
      const [bodyObls, bodyTop] = processStmts(stmt.body, [bodyInit], ensures);

      // Partials from top of body become proof obligations: prove the invariant is
      // maintained, given that cond and the invariant hold at the start of each iteration.
      const firstBodyLine = stmt.body[0]?.line ?? stmt.line;
      const maintenanceObls = partialsToObls(
        bodyTop,
        [...condProps, ...invariantProps],
        firstBodyLine,
      );

      // A partial obligation for invariant establishment exits upward past the loop.
      const upwardPartial: PartialObligation = {
        premises: [],
        goals: [...invariantProps],
      };

      return [
        [...maintenanceObls, ...bodyObls, ...afterLoopObls],
        [upwardPartial],
      ];
    }
  }
}

/**
 * Returns all proof obligations for the given function definition. Each obligation
 * contains the premises that must hold, the goal that must be proved, and the line
 * number at which that reasoning takes place.
 */
export function getProofObligations(func: FuncDef): ProofObligation[] {
  const ensureProps = func.ensures.flatMap(condToProps);
  const [bodyObls, topPartials] = processStmts(func.body, [], ensureProps);

  const firstLine = func.body[0]?.line ?? func.line;
  const requireProps = func.requires.flatMap(condToProps);
  const topObls = partialsToObls(topPartials, requireProps, firstLine);

  const obls = [...topObls, ...bodyObls];
  for (const obl of obls) {
    const vars = oblVars(obl);
    obl.params = func.params
      .filter(p => vars.has(p.name))
      .map<[string, string]>(p => [p.name, p.type]);
  }
  return obls;
}

/**
 * Converts a TheoremAst into a ProofObligation. Premises and conclusion are
 * wrapped as AtomProps. Params are calculated from which theorem params
 * actually appear in the premises and goal.
 */
export function theoremToProofObligation(thm: TheoremAst): ProofObligation {
  const premises = thm.premises.map(f => new AtomProp(f));
  const goal = new AtomProp(thm.conclusion);
  const obl = new ProofObligation(premises, goal, thm.line);
  const vars = oblVars(obl);
  obl.params = thm.params.filter(([name]) => vars.has(name));
  return obl;
}

export class TheoremObligation {
  theorem: TheoremAst;
  line: number;

  constructor(theorem: TheoremAst, line: number) {
    this.theorem = theorem;
    this.line = line;
  }
}

/**
 * Returns one obligation for each theorem declaration in the given declarations.
 */
export function getTheoremObligations(decls: DeclsAst): TheoremObligation[] {
  return decls.theorems.map(thm => new TheoremObligation(thm, thm.line));
}
