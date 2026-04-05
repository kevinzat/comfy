import { Expression } from '../facts/exprs';
import { ParseExpr } from '../facts/exprs_parser';
import { Formula } from '../facts/formula';
import { ParseFormula } from '../facts/formula_parser';
import { Prop, AtomProp } from '../facts/prop';
import { Environment, TopLevelEnv, NestedEnv } from '../types/env';
import { TheoremAst } from '../lang/theorem_ast';
import { checkProp } from '../types/checker';
import { buildCases, CaseInfo } from './induction';
import { buildCasesOnCondition } from './cases';
import { Step, applyForwardRule, applyBackwardRule, topFrontier, botFrontier, isComplete, checkValidity } from './calc_proof';
import { ProofFile, ProofNode, CalcProofNode, CalcStep, GivenLine, IHLine, CaseBlock } from './proof_file';


export class CheckError extends Error {
  line: number;
  constructor(line: number, message: string) {
    super(`line ${line}: ${message}`);
    this.line = line;
    Object.setPrototypeOf(this, CheckError.prototype);
  }
}

function verifyExpr(
    line: number, text: string, expected: Expression): void {
  let parsed: Expression;
  try {
    parsed = ParseExpr(text);
  } catch (e: any) {
    throw new CheckError(line, `bad expression: ${e.message}`);
  }
  if (parsed.to_string() !== expected.to_string()) {
    throw new CheckError(line,
        `expected ${expected.to_string()}, got ${parsed.to_string()}`);
  }
}

function verifyStep(step: CalcStep, actual: Step): void {
  if (step.statedOp !== undefined && step.statedOp !== actual.op) {
    throw new CheckError(step.line,
        `expected operator ${step.statedOp}, got ${actual.op}`);
  }
  if (step.statedExpr !== undefined) {
    verifyExpr(step.line, step.statedExpr, actual.expr);
  }
}

function checkCalc(
    goal: Formula, env: Environment, node: CalcProofNode): void {
  // Check forward section.
  const top: Step[] = [];
  if (node.forwardStart) {
    verifyExpr(node.forwardStart.line, node.forwardStart.text, goal.left);
  }
  for (const step of node.forwardSteps) {
    let actual: Step;
    try {
      actual = applyForwardRule(step.ruleText, topFrontier(goal, top), env);
    } catch (e: any) {
      throw new CheckError(step.line, e.message);
    }
    top.push(actual);
    verifyStep(step, actual);
  }

  // Check backward section.
  const bot: Step[] = [];
  if (node.backwardStart) {
    verifyExpr(node.backwardStart.line, node.backwardStart.text, goal.right);
  }
  for (const step of node.backwardSteps) {
    let actual: Step;
    try {
      actual = applyBackwardRule(step.ruleText, botFrontier(goal, bot), env);
    } catch (e: any) {
      throw new CheckError(step.line, e.message);
    }
    bot.push(actual);
    verifyStep(step, actual);
  }

  if (!isComplete(goal, top, bot)) {
    const topExpr = topFrontier(goal, top).to_string();
    const botExpr = botFrontier(goal, bot).to_string();
    const lastLine = node.backwardSteps.length > 0
        ? node.backwardSteps[node.backwardSteps.length - 1].line
        : node.forwardSteps.length > 0
        ? node.forwardSteps[node.forwardSteps.length - 1].line
        : 0;
    throw new CheckError(lastLine,
        `proof incomplete: top reached ${topExpr}, bottom reached ${botExpr}`);
  }

  const err = checkValidity(goal, top, bot);
  if (err) {
    const lastLine = node.forwardSteps.length > 0
        ? node.forwardSteps[node.forwardSteps.length - 1].line : 0;
    throw new CheckError(lastLine, `invalid chain: ${err}`);
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
    let parsed: Formula;
    try {
      parsed = ParseFormula(g.text);
    } catch (e: any) {
      throw new CheckError(g.line, `bad given formula: ${e.message}`);
    }
    const actual = env.getFact(g.index);
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
    parentFactCount: number, expectedIH?: TheoremAst[]): void {
  // Check stated IH theorems match the expected ones.
  if (expectedIH) {
    checkIHTheorems(block.ihTheorems, expectedIH);
  }

  // Check stated givens match the environment's facts.
  checkGivens(block.givens, env, parentFactCount);

  // Check stated goal matches the expected goal.
  if (!(goal instanceof AtomProp)) {
    throw new CheckError(block.goalLine, `case block goal must be a formula`);
  }
  let statedGoal: Formula;
  try {
    statedGoal = ParseFormula(block.goal);
  } catch (e: any) {
    throw new CheckError(block.goalLine, `bad goal formula: ${e.message}`);
  }
  if (statedGoal.to_string() !== goal.formula.to_string()) {
    throw new CheckError(block.goalLine,
        `stated goal ${statedGoal.to_string()} does not match ` +
        `expected goal ${goal.formula.to_string()}`);
  }

  checkProof(goal, env, block.proof);
}

function checkProof(
    goal: Prop, env: Environment, node: ProofNode,
    premises: Prop[] = []): void {
  if (node.kind === 'calculate') {
    if (!(goal instanceof AtomProp)) {
      throw new CheckError(0, `calculation requires a formula goal`);
    }
    checkCalc(goal.formula, env, node);
  } else if (node.kind === 'induction') {
    if (!(goal instanceof AtomProp)) {
      throw new CheckError(0, `induction requires a formula goal`);
    }
    const formulaPremises = premises.flatMap(
        p => p instanceof AtomProp ? [p.formula] : []);
    const parentFactCount = env.numFacts();
    const cases = buildCases(goal.formula, env, node.varName, node.argNames, formulaPremises);
    if (node.cases.length !== cases.length) {
      const line = node.cases.length > 0 ? node.cases[0].goalLine : 0;
      throw new CheckError(line,
          `expected ${cases.length} cases, got ${node.cases.length}`);
    }
    for (let i = 0; i < cases.length; i++) {
      checkCaseBlock(node.cases[i], new AtomProp(cases[i].goal), cases[i].env,
          parentFactCount, cases[i].ihTheorems);
    }
  } else if (node.kind === 'cases') {
    let condition: Formula;
    try {
      condition = ParseFormula(node.condition);
    } catch (e: any) {
      throw new CheckError(node.conditionLine, `bad condition: ${e.message}`);
    }
    let info;
    try {
      info = buildCasesOnCondition(env, condition);
    } catch (e: any) {
      throw new CheckError(node.conditionLine, e.message);
    }
    const parentFactCount = env.numFacts();
    checkCaseBlock(node.thenCase, goal, info.thenEnv, parentFactCount);
    checkCaseBlock(node.elseCase, goal, info.elseEnv, parentFactCount);
  }
}

export function checkProofFile(pf: ProofFile): void {
  // Look up the theorem by name and remove it from the declarations.
  const theoremIdx = pf.decls.theorems.findIndex(t => t.name === pf.theoremName);
  if (theoremIdx === -1) {
    throw new CheckError(pf.theoremLine,
        `unknown theorem "${pf.theoremName}"`);
  }
  const theorem = pf.decls.theorems[theoremIdx];
  const remainingTheorems = pf.decls.theorems.filter((_, i) => i !== theoremIdx);

  // Build the top-level env without the theorem being proved.
  const env = new TopLevelEnv(
      pf.decls.types, pf.decls.functions,
      [], remainingTheorems);

  try {
    env.check();
  } catch (e: any) {
    throw new CheckError(pf.theoremLine, `type error: ${e.message}`);
  }

  // Build the proof env with theorem params as variables and atomic premises as givens.
  const atomPremises = theorem.premises.flatMap(p => p.tag === 'atom' ? [p.formula] : []);
  const proofEnv = new NestedEnv(env, theorem.params, atomPremises);

  // Type-check the theorem being proved (its formulas reference the params).
  try {
    for (const p of theorem.premises) checkProp(proofEnv, p);
    checkProp(proofEnv, theorem.conclusion);
  } catch (e: any) {
    throw new CheckError(pf.theoremLine, `type error: ${e.message}`);
  }

  // Validate top-level given lines (premise).
  checkGivens(pf.givens, proofEnv, 0);

  checkProof(theorem.conclusion, proofEnv, pf.proof, theorem.premises);
}
