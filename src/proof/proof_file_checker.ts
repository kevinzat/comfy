import { Formula } from '../facts/formula';
import { ParseFormula } from '../facts/formula_parser';
import { Prop } from '../facts/prop';
import { Environment, TopLevelEnv, NestedEnv } from '../types/env';
import { TypeDeclAst } from '../lang/type_ast';
import { FuncAst } from '../lang/func_ast';
import { TheoremAst } from '../lang/theorem_ast';
import { checkProp } from '../types/checker';
import { ProofFile, ProofEntry, ProofFileItem, ProofNode, GivenLine, IHLine, CaseBlock } from './proof_file';
import { validateCalculation } from './calc_proof';
import { CreateProofTactic, filterDischargedGoals } from './proof_tactic';


export class CheckError extends Error {
  line: number;
  constructor(line: number, message: string) {
    super(`line ${line}: ${message}`);
    this.line = line;
    Object.setPrototypeOf(this, CheckError.prototype);
  }
}

function checkGivens(
    givens: GivenLine[], env: Environment, parentFactCount: number): void {
  for (const g of givens) {
    const expectedIdx = parentFactCount + 1 + givens.indexOf(g);
    if (g.index !== expectedIdx) {
      throw new CheckError(g.line,
          `expected fact number ${expectedIdx}, got ${g.index}`);
    }
    const actual = env.getFact(g.index);
    let parsed;
    try {
      parsed = ParseFormula(g.text);
    } catch (e: any) {
      throw new CheckError(g.line, `bad given formula: ${e.message}`);
    }
    if (parsed.to_string() !== actual.to_string()) {
      throw new CheckError(g.line,
          `given ${g.index} is ${actual.to_string()}, not ${parsed.to_string()}`);
    }
  }
}

function paramsEqual(
    a: [string, string][], b: [string, string][]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i][0] !== b[i][0] || a[i][1] !== b[i][1]) return false;
  }
  return true;
}

function formatParams(params: [string, string][]): string {
  if (params.length === 0) return '';
  const groups: { names: string[]; type: string }[] = [];
  for (const [name, type] of params) {
    const last = groups[groups.length - 1];
    if (last && last.type === type) {
      last.names.push(name);
    } else {
      groups.push({ names: [name], type });
    }
  }
  return ' ' + groups.map(g =>
      `(${g.names.join(', ')} : ${g.type})`).join(' ');
}

function checkIHTheorems(
    ihLines: IHLine[], expected: TheoremAst[]): void {
  if (ihLines.length !== expected.length) {
    const line = ihLines.length > 0 ? ihLines[0].line : 0;
    throw new CheckError(line,
        `expected ${expected.length} IH theorems, got ${ihLines.length}`);
  }
  for (let i = 0; i < ihLines.length; i++) {
    const ih = ihLines[i];
    const exp = expected[i];
    if (ih.name !== exp.name) {
      throw new CheckError(ih.line,
          `expected IH named "${exp.name}", got "${ih.name}"`);
    }
    if (!paramsEqual(ih.params, exp.params)) {
      throw new CheckError(ih.line,
          `IH ${ih.name} params should be${formatParams(exp.params)}, ` +
          `got${formatParams(ih.params)}`);
    }
    // Check premises if expected.
    if (ih.premises.length !== exp.premises.length) {
      throw new CheckError(ih.line,
          `IH ${ih.name} should have ${exp.premises.length} premise(s), got ${ih.premises.length}`);
    }
    for (let j = 0; j < exp.premises.length; j++) {
      if (ih.premises[j].to_string() !== exp.premises[j].to_string()) {
        throw new CheckError(ih.line,
            `IH ${ih.name} premise is ${exp.premises[j].to_string()}, not ${ih.premises[j].to_string()}`);
      }
    }
    // Check conclusion.
    let parsed: Formula;
    try {
      parsed = ParseFormula(ih.formula);
    } catch (e: any) {
      throw new CheckError(ih.line, `bad IH formula: ${e.message}`);
    }
    if (parsed.to_string() !== exp.conclusion.to_string()) {
      throw new CheckError(ih.line,
          `IH ${ih.name} is ${exp.conclusion.to_string()}, not ${parsed.to_string()}`);
    }
  }
}

function checkCaseBlock(
    block: CaseBlock, goal: Prop, env: Environment,
    parentFactCount: number, newTheorems: TheoremAst[]): void {
  // Check stated IH theorems match the expected ones.
  checkIHTheorems(block.ihTheorems, newTheorems);

  // Check stated givens match the environment's facts.
  checkGivens(block.givens, env, parentFactCount);

  // Check stated goal matches the expected goal.
  let statedGoal;
  try {
    statedGoal = ParseFormula(block.goal);
  } catch (e: any) {
    throw new CheckError(block.goalLine, `bad goal formula: ${e.message}`);
  }
  if (statedGoal.to_string() !== goal.to_string()) {
    throw new CheckError(block.goalLine,
        `stated goal ${statedGoal.to_string()} does not match ` +
        `expected goal ${goal.to_string()}`);
  }

  checkProof(goal, env, block.proof);
}

function checkProof(
    goal: Prop, env: Environment, node: ProofNode,
    premises: Prop[] = []): void {
  if (node.kind === 'calculate') {
    validateCalculation(goal, env, node);
    return;
  }
  const tactic = CreateProofTactic(node, goal, env, premises);
  const allGoals = tactic.decompose();
  const proofGoals = filterDischargedGoals(allGoals);
  const parentFactCount = env.numFacts();
  if (node.cases.length !== proofGoals.length) {
    const line = node.cases.length > 0 ? node.cases[0].goalLine : node.methodLine;
    throw new CheckError(line,
        `expected ${proofGoals.length} cases, got ${node.cases.length}`);
  }
  for (let i = 0; i < proofGoals.length; i++) {
    const pg = proofGoals[i];
    checkCaseBlock(node.cases[i], pg.goal, pg.env, parentFactCount, pg.newTheorems);
  }
}

function checkProofEntry(
    entry: ProofEntry, types: TypeDeclAst[], functions: FuncAst[],
    provedTheorems: TheoremAst[], allTheorems: TheoremAst[]): void {
  // Look up the theorem by name.
  const theorem = allTheorems.find(t => t.name === entry.theoremName);
  if (!theorem) {
    throw new CheckError(entry.theoremLine,
        `unknown theorem "${entry.theoremName}"`);
  }
  // The environment includes all theorems except the one being proved.
  const otherTheorems = [...provedTheorems, ...allTheorems.filter(t => t.name !== entry.theoremName)];

  const env = new TopLevelEnv(types, functions, [], otherTheorems);

  try {
    env.check();
  } catch (e: any) {
    throw new CheckError(entry.theoremLine, `type error: ${e.message}`);
  }

  // Build the proof env with theorem params as variables and premises as givens.
  const proofEnv = new NestedEnv(env, theorem.params, theorem.premises);

  // Type-check the theorem being proved (its formulas reference the params).
  try {
    for (const p of theorem.premises) checkProp(proofEnv, p);
    checkProp(proofEnv, theorem.conclusion);
  } catch (e: any) {
    throw new CheckError(entry.theoremLine, `type error: ${e.message}`);
  }

  // Validate top-level given lines (premise).
  checkGivens(entry.givens, proofEnv, 0);

  checkProof(theorem.conclusion, proofEnv, entry.proof, theorem.premises);
}

export function checkProofFile(pf: ProofFile): void {
  // Process items in order, accumulating declarations and proved theorems.
  const types: TypeDeclAst[] = [];
  const functions: FuncAst[] = [];
  const declaredTheorems: TheoremAst[] = [];  // unproved theorems from current decl block
  const provedTheorems: TheoremAst[] = [];    // theorems proved so far

  for (const item of pf.items) {
    if (item.kind === 'decls') {
      types.push(...item.decls.types);
      functions.push(...item.decls.functions);
      declaredTheorems.push(...item.decls.theorems);
    } else {
      checkProofEntry(item.entry, types, functions, provedTheorems, declaredTheorems);
      // Move the proved theorem from declared to proved.
      const idx = declaredTheorems.findIndex(t => t.name === item.entry.theoremName);
      if (idx !== -1) {
        provedTheorems.push(declaredTheorems[idx]);
        declaredTheorems.splice(idx, 1);
      }
    }
  }
}
