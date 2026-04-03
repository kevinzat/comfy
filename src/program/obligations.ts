import { FuncDef, Stmt, Cond, negCond, substCond, formulaToCond } from "../lang/code_ast";
import { Expression } from "../facts/exprs";
import { DeclsAst } from "../lang/decls_ast";
import { TheoremAst } from "../lang/theorem_ast";

export class ProofObligation {
  premises: Cond[];
  goal: Cond;
  line: number;
  params: [string, string][];

  constructor(premises: Cond[], goal: Cond, line: number, params: [string, string][] = []) {
    this.premises = premises;
    this.goal = goal;
    this.line = line;
    this.params = params;
  }
}

/** Returns a stable string key identifying an obligation by its premises and goal. */
export function oblKey(obl: ProofObligation): string {
  const premStr = obl.premises
    .map(c => `${c.left.to_string()}${c.op}${c.right.to_string()}`)
    .join(',');
  const goalStr = `${obl.goal.left.to_string()}${obl.goal.op}${obl.goal.right.to_string()}`;
  return `${premStr}|${goalStr}`;
}

function condVars(c: Cond): Set<string> {
  return new Set([...c.left.vars(), ...c.right.vars()]);
}

function oblVars(obl: ProofObligation): Set<string> {
  const vars = condVars(obl.goal);
  for (const p of obl.premises) condVars(p).forEach(v => vars.add(v));
  return vars;
}

interface PartialObligation {
  premises: Cond[];
  goals: Cond[];
}

function substPartial(
  p: PartialObligation,
  name: string,
  expr: Expression,
): PartialObligation {
  return {
    premises: p.premises.map((c) => substCond(c, name, expr)),
    goals: p.goals.map((c) => substCond(c, name, expr)),
  };
}

/** Converts each partial obligation into proof obligations by adding extra premises. */
function partialsToObls(
  partials: PartialObligation[],
  extraPremises: Cond[],
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
  ensures: Cond[],
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
  ensures: Cond[],
): [ProofObligation[], PartialObligation[]] {
  switch (stmt.tag) {
    case "pass":
      return [[], partials];

    case "assign":
      return [[], partials.map((p) => substPartial(p, stmt.name, stmt.expr))];

    case "decl":
      return [[], partials.map((p) => substPartial(p, stmt.name, stmt.expr))];

    case "return": {
      const goals = ensures.map((c) => substCond(c, "rv", stmt.expr));
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
      const thenExited = thenTop.map((p) => ({
        ...p,
        premises: [stmt.cond, ...p.premises],
      }));
      const elseExited = elseTop.map((p) => ({
        ...p,
        premises: [negCond(stmt.cond), ...p.premises],
      }));
      return [
        [...thenObls, ...elseObls],
        [...thenExited, ...elseExited],
      ];
    }

    case "while": {
      // Incoming partials meet the loop exit: invariant holds and cond is false.
      const afterLoopObls = partialsToObls(
        partials,
        [...stmt.invariant, negCond(stmt.cond)],
        stmt.line,
      );

      // Process loop body: at the bottom sits a partial whose goals are the invariant.
      const bodyInit: PartialObligation = {
        premises: [],
        goals: [...stmt.invariant],
      };
      const [bodyObls, bodyTop] = processStmts(stmt.body, [bodyInit], ensures);

      // Partials from top of body become proof obligations: prove the invariant is
      // maintained, given that cond and the invariant hold at the start of each iteration.
      const firstBodyLine = stmt.body[0]?.line ?? stmt.line;
      const maintenanceObls = partialsToObls(
        bodyTop,
        [stmt.cond, ...stmt.invariant],
        firstBodyLine,
      );

      // A partial obligation for invariant establishment exits upward past the loop.
      const upwardPartial: PartialObligation = {
        premises: [],
        goals: [...stmt.invariant],
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
  const [bodyObls, topPartials] = processStmts(func.body, [], func.ensures);

  const firstLine = func.body[0]?.line ?? func.line;
  const topObls = partialsToObls(topPartials, [...func.requires], firstLine);

  const obls = [...topObls, ...bodyObls];
  for (const obl of obls) {
    const vars = oblVars(obl);
    obl.params = func.params
      .filter(p => vars.has(p.name))
      .map(p => [p.name, p.type] as [string, string]);
  }
  return obls;
}

/**
 * Converts a TheoremAst into a ProofObligation. The premise (if any) and
 * conclusion are converted via formulaToCond. Params are calculated from
 * which theorem params actually appear in the premises and goal.
 */
export function theoremToProofObligation(thm: TheoremAst): ProofObligation {
  const premises = thm.premise ? [formulaToCond(thm.premise)] : [];
  const goal = formulaToCond(thm.conclusion);
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
