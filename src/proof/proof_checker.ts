import { Expression } from '../facts/exprs';
import { ParseExpr } from '../facts/exprs_parser';
import { Formula } from '../facts/formula';
import { ParseFormula } from '../facts/formula_parser';
import { Environment, TopLevelEnv, NestedEnv } from '../types/env';
import { checkFormula } from '../types/checker';
import { buildCases } from './induction';
import { buildCasesOnCondition } from './cases';
import { Step, applyForwardRule, applyBackwardRule, topFrontier, botFrontier, isComplete, checkValidity } from './calc_proof';
import { ProofFile, ProofNode, CalcProofNode, CalcStep, GivenLine, CaseBlock } from './proof_file';


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

function checkCaseBlock(
    block: CaseBlock, goal: Formula, env: Environment,
    parentFactCount: number): void {
  // Check stated givens match the environment's facts.
  checkGivens(block.givens, env, parentFactCount);

  // Check stated goal matches the expected goal.
  let statedGoal: Formula;
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
    goal: Formula, env: Environment, node: ProofNode): void {
  if (node.kind === 'calculate') {
    checkCalc(goal, env, node);
  } else if (node.kind === 'induction') {
    const parentFactCount = env.numFacts();
    const cases = buildCases(goal, env, node.varName, node.argNames);
    if (node.cases.length !== cases.length) {
      const line = node.cases.length > 0 ? node.cases[0].goalLine : 0;
      throw new CheckError(line,
          `expected ${cases.length} cases, got ${node.cases.length}`);
    }
    for (let i = 0; i < cases.length; i++) {
      checkCaseBlock(node.cases[i], cases[i].goal, cases[i].env, parentFactCount);
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

  // Build the proof env with theorem params as variables and premise as given.
  const givens: Formula[] = theorem.premise ? [theorem.premise] : [];
  const proofEnv = new NestedEnv(env, theorem.params, givens);

  // Type-check the theorem being proved (its formulas reference the params).
  // proofEnv.check() validates the premise (it's in givens); the conclusion
  // must be checked separately.
  try {
    proofEnv.check();
    checkFormula(proofEnv, theorem.conclusion);
  } catch (e: any) {
    throw new CheckError(pf.theoremLine, `type error: ${e.message}`);
  }

  checkProof(theorem.conclusion, proofEnv, pf.proof);
}
