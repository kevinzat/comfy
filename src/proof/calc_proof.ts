import { Expression } from '../facts/exprs';
import { Formula, FormulaOp, OP_EQUAL } from '../facts/formula';
import { Environment } from '../types/env';
import { ParseForwardRule, CreateRule } from '../rules/infer_forward';
import { ParseBackwardRule, CreateTactic } from '../rules/infer_backward';
import { IsEquationChainValid } from '../decision/equation';
import { IsInequalityChainValid } from '../decision/inequality';


export interface Step {
  op: FormulaOp;
  expr: Expression;
}

export function applyForwardRule(
    text: string, current: Expression, env: Environment): Step {
  const parsed = ParseForwardRule(text);
  const rule = CreateRule(parsed, current, env);
  const formula = rule.apply();
  return { op: formula.op, expr: formula.right };
}

export function applyBackwardRule(
    text: string, goal: Expression, env: Environment): Step {
  const parsed = ParseBackwardRule(text);
  const tactic = CreateTactic(parsed, goal, env);
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
