import { Expression, Variable, Call } from '../facts/exprs';
import { ParseExpr } from '../facts/exprs_parser';
import { Formula, FormulaOp, OP_EQUAL, OP_LESS_THAN } from '../facts/formula';
import { Prop, AtomProp, NotProp } from '../facts/prop';
import { Environment } from '../types/env';
import { ParseForwardRule, CreateCalcRule } from '../calc/calc_forward';
import { ParseBackwardRule, CreateCalcTactic } from '../calc/calc_backward';
import { IsEquationChainValid } from '../decision/equation';
import { IsInequalityChainValid } from '../decision/inequality';
import { Match } from '../calc/calc_complete';
import { CalcProofNode, CalcStep } from './proof_file';
import { CheckError } from './proof_file_checker';
import { ProofMethodParser, ParsedMethod, parseTacticMethod } from './proof_tactic';


export interface Step {
  op: FormulaOp;
  expr: Expression;
}

export function applyForwardRule(
    text: string, current: Expression, env: Environment): Step {
  const parsed = ParseForwardRule(text);
  const rule = CreateCalcRule(parsed, current, env);
  const formula = rule.apply();
  return { op: formula.op, expr: formula.right };
}

export function applyBackwardRule(
    text: string, goal: Expression, env: Environment): Step {
  const parsed = ParseBackwardRule(text);
  const tactic = CreateCalcTactic(parsed, goal, env);
  const formula = tactic.apply();
  return { op: formula.op, expr: formula.left };
}

export function topFrontier(goal: Formula, topSteps: Step[]): Expression {
  return topSteps.length > 0 ? topSteps[topSteps.length - 1].expr : goal.left;
}

export function botFrontier(goal: Formula, botSteps: Step[]): Expression {
  return botSteps.length > 0 ? botSteps[botSteps.length - 1].expr : goal.right;
}

export function isComplete(
    goal: Formula, topSteps: Step[], botSteps: Step[]): boolean {
  return topFrontier(goal, topSteps).equals(botFrontier(goal, botSteps));
}

export function checkValidity(
    goal: Formula, topSteps: Step[], botSteps: Step[]): string | undefined {
  const chain: Formula[] = [];
  let prev = goal.left;
  for (const step of topSteps) {
    chain.push(new Formula(prev, step.op, step.expr));
    prev = step.expr;
  }
  for (let i = botSteps.length - 1; i >= 0; i--) {
    const goalExpr = i > 0 ? botSteps[i - 1].expr : goal.right;
    chain.push(new Formula(prev, botSteps[i].op, goalExpr));
    prev = goalExpr;
  }

  if (goal.op === OP_EQUAL) {
    return IsEquationChainValid(chain);
  } else {
    return IsInequalityChainValid(chain, goal.op);
  }
}


// --- Checking ---

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

/** Returns the constructor name if the expression is a constructor call
 * (including 0-arg constructors, which parse as Variables). */
export function constructorHead(expr: Expression, env: Environment): string | null {
  if (expr instanceof Call && env.hasConstructor(expr.name)) return expr.name;
  if (expr instanceof Variable && env.hasConstructor(expr.name)) return expr.name;
  return null;
}

function validateNotEqual(
    eqFormula: Formula, env: Environment, node: CalcProofNode): void {
  const { left, right } = eqFormula;
  // Integer path: prove a < b or b < a
  const ltGoal = new AtomProp(new Formula(left, OP_LESS_THAN, right));
  try {
    validateCalculation(ltGoal, env, node);
    return;
  } catch (_e) { /* try the other direction */ }
  const gtGoal = new AtomProp(new Formula(right, OP_LESS_THAN, left));
  try {
    validateCalculation(gtGoal, env, node);
    return;
  } catch (_e) { /* try constructor discrimination */ }
  // Constructor discrimination: prove a = c where c and right are different constructors.
  // Process forward steps to find what left equals.
  const ctorRight = constructorHead(right, env);
  if (ctorRight === null) {
    throw new CheckError(0,
        `calculation does not prove not ${eqFormula.to_string()}`);
  }
  let current = left;
  const chain: Formula[] = [];
  for (const step of node.forwardSteps) {
    let actual: Step;
    try {
      actual = applyForwardRule(step.ruleText, current, env);
    } catch (e: any) {
      throw new CheckError(step.line, e.message);
    }
    chain.push(new Formula(current, actual.op, actual.expr));
    current = actual.expr;
  }
  // Verify the chain is all equalities.
  const err = IsEquationChainValid(chain);
  /* v8 ignore start */
  if (err) {
    throw new Error(`invalid chain: ${err}`);
  }
  /* v8 ignore stop */
  const ctorReached = constructorHead(current, env);
  if (ctorReached === null || ctorReached === ctorRight) {
    throw new CheckError(0,
        `calculation does not prove not ${eqFormula.to_string()}`);
  }
}

export function validateCalculation(
    goal: Prop, env: Environment, node: CalcProofNode): void {
  let formula: Formula;
  if (goal instanceof AtomProp) {
    formula = goal.formula;
  } else if (goal instanceof NotProp && goal.formula.op === OP_EQUAL) {
    // not(a = b) is proved by showing a < b or b < a
    return validateNotEqual(goal.formula, env, node);
  } else {
    throw new CheckError(0, `calculation requires a formula goal`);
  }

  // Check forward section.
  const top: Step[] = [];
  if (node.forwardStart) {
    verifyExpr(node.forwardStart.line, node.forwardStart.text, formula.left);
  }
  for (const step of node.forwardSteps) {
    let actual: Step;
    try {
      actual = applyForwardRule(step.ruleText, topFrontier(formula, top), env);
    } catch (e: any) {
      throw new CheckError(step.line, e.message);
    }
    top.push(actual);
    verifyStep(step, actual);
  }

  // Check backward section.
  const bot: Step[] = [];
  if (node.backwardStart) {
    verifyExpr(node.backwardStart.line, node.backwardStart.text, formula.right);
  }
  for (const step of node.backwardSteps) {
    let actual: Step;
    try {
      actual = applyBackwardRule(step.ruleText, botFrontier(formula, bot), env);
    } catch (e: any) {
      throw new CheckError(step.line, e.message);
    }
    bot.push(actual);
    verifyStep(step, actual);
  }

  if (!isComplete(formula, top, bot)) {
    const topExpr = topFrontier(formula, top).to_string();
    const botExpr = botFrontier(formula, bot).to_string();
    const lastLine = node.backwardSteps.length > 0
        ? node.backwardSteps[node.backwardSteps.length - 1].line
        : node.forwardSteps.length > 0
        ? node.forwardSteps[node.forwardSteps.length - 1].line
        : 0;
    throw new CheckError(lastLine,
        `proof incomplete: top reached ${topExpr}, bottom reached ${botExpr}`);
  }

  const err = checkValidity(formula, top, bot);
  if (err) {
    const lastLine = node.forwardSteps.length > 0
        ? node.forwardSteps[node.forwardSteps.length - 1].line : 0;
    throw new CheckError(lastLine, `invalid chain: ${err}`);
  }
}


// --- Parsing & completion ---

export const calculationParser: ProofMethodParser = {
  tryParse(text: string): ParsedMethod | string | null {
    const method = parseTacticMethod(text);
    if (method?.kind === 'calculate') return { kind: 'calculate' };
    return null;
  },

  getMatches(text: string): Match[] {
    const trimmed = text.trim();
    if ('calculation'.startsWith(trimmed)) {
      const desc = trimmed.length > 0
        ? [{ bold: true, text: trimmed },
           { bold: false, text: 'calculation'.substring(trimmed.length) }]
        : [{ bold: false, text: 'calculation' }];
      return [{ description: desc, completion: 'calculation' }];
    }
    return [];
  },
};

