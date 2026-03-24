import { Formula, OP_LESS_THAN, OP_LESS_EQUAL } from '../facts/formula';
import { Environment, NestedEnv } from '../types/env';

export function negateCondition(f: Formula): Formula {
  if (f.op === OP_LESS_THAN) {
    return new Formula(f.right, OP_LESS_EQUAL, f.left);
  } else {
    return new Formula(f.right, OP_LESS_THAN, f.left);
  }
}

export interface CasesInfo {
  condition: Formula;
  negated: Formula;
  thenEnv: NestedEnv;
  elseEnv: NestedEnv;
}

export function buildCasesOnCondition(
    env: Environment, condition: Formula): CasesInfo {
  if (condition.op !== OP_LESS_THAN && condition.op !== OP_LESS_EQUAL) {
    throw new Error('cases condition must use < or <=');
  }
  const negated = negateCondition(condition);
  const thenEnv = new NestedEnv(env, [], [condition]);
  const elseEnv = new NestedEnv(env, [], [negated]);
  return { condition, negated, thenEnv, elseEnv };
}
