import { Expression, Constant, Variable, Call,
         FUNC_ADD, FUNC_SUBTRACT, FUNC_MULTIPLY, FUNC_NEGATE, FUNC_EXPONENTIATE
} from '../facts/exprs';
import { Formula, OP_LESS_EQUAL } from '../facts/formula';
import { ParseFormula } from '../facts/formula_parser';
import { TypeDeclAst } from '../lang/type_ast';
import { FuncAst, Param, ParamVar, ParamConstructor } from '../lang/func_ast';
import { TheoremAst } from '../lang/theorem_ast';
import { condToFormula } from '../lang/code_ast';
import { ProofFile, ProofNode, CalcProofNode, CaseBlock } from './proof_file';
import { DeclsAst } from '../lang/decls_ast';
import { ProofObligation } from '../program/obligations';


function collectCtors(decls: DeclsAst): Set<string> {
  const names = new Set<string>();
  for (const type of decls.types) {
    for (const ctor of type.constructors) {
      names.add(ctor.name);
    }
  }
  return names;
}

/**
 * Convert an Expression to Lean 4 syntax.
 * @param prec outer precedence — compound expressions wrap in parens when needed
 */
function exprToLean(expr: Expression, ctors: Set<string>, prec: number = 0): string {
  if (expr instanceof Constant) {
    const v = expr.value;
    if (v < 0n) return prec > 0 ? `(${v})` : `${v}`;
    return `${v}`;
  }

  if (expr instanceof Variable) {
    return ctors.has(expr.name) ? `.${expr.name}` : expr.name;
  }

  if (!(expr instanceof Call)) return expr.to_string();

  const { name, args } = expr;

  if (name === FUNC_NEGATE && args.length === 1) {
    const s = `-${exprToLean(args[0], ctors, 75)}`;
    return prec > 70 ? `(${s})` : s;
  }
  if (name === FUNC_EXPONENTIATE && args.length === 2) {
    const s = `${exprToLean(args[0], ctors, 76)} ^ ${exprToLean(args[1], ctors, 75)}`;
    return prec > 75 ? `(${s})` : s;
  }
  if (name === FUNC_MULTIPLY) {
    const parts = args.map((a, i) => exprToLean(a, ctors, i === 0 ? 70 : 71));
    const s = parts.join(' * ');
    return prec > 70 ? `(${s})` : s;
  }
  if (name === FUNC_ADD) {
    const parts = args.map((a, i) => exprToLean(a, ctors, i === 0 ? 65 : 66));
    const s = parts.join(' + ');
    return prec > 65 ? `(${s})` : s;
  }
  if (name === FUNC_SUBTRACT) {
    const parts = args.map((a, i) => exprToLean(a, ctors, i === 0 ? 65 : 66));
    const s = parts.join(' - ');
    return prec > 65 ? `(${s})` : s;
  }

  // Constructor or user function
  const leanName = ctors.has(name) ? `.${name}` : name;
  if (args.length === 0) return leanName;
  const leanArgs = args.map(a => exprToLean(a, ctors, 1000));
  const s = `${leanName} ${leanArgs.join(' ')}`;
  return prec >= 1000 ? `(${s})` : s;
}

function formulaToLean(f: Formula, ctors: Set<string>): string {
  const left = exprToLean(f.left, ctors);
  const op = f.op === OP_LESS_EQUAL ? '≤' : f.op;
  const right = exprToLean(f.right, ctors);
  return `${left} ${op} ${right}`;
}

function paramToLean(p: Param, ctors: Set<string>): string {
  if (p instanceof ParamVar) {
    return ctors.has(p.name) ? `.${p.name}` : p.name;
  }
  if (p.args.length === 0) return `.${p.name}`;
  return `.${p.name} ${p.args.map(a => paramToLeanAtom(a, ctors)).join(' ')}`;
}

function paramToLeanAtom(p: Param, ctors: Set<string>): string {
  if (p instanceof ParamVar) {
    return ctors.has(p.name) ? `.${p.name}` : p.name;
  }
  if (p instanceof ParamConstructor && p.args.length === 0) return `.${p.name}`;
  return `(${paramToLean(p, ctors)})`;
}

function paramsToLean(params: [string, string][]): string {
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
  return groups.map(g => `(${g.names.join(' ')} : ${g.type})`).join(' ');
}

function typeToLean(type: TypeDeclAst): string {
  const lines: string[] = [];
  lines.push(`inductive ${type.name} where`);
  for (const ctor of type.constructors) {
    if (ctor.paramTypes.length === 0) {
      lines.push(`  | ${ctor.name} : ${ctor.returnType}`);
    } else {
      lines.push(`  | ${ctor.name} : ${ctor.paramTypes.join(' → ')} → ${ctor.returnType}`);
    }
  }
  return lines.join('\n');
}

function funcToLean(func: FuncAst, ctors: Set<string>): string {
  const typeStr = [...func.type.paramTypes, func.type.returnType].join(' → ');
  const lines: string[] = [];
  lines.push(`def ${func.name} : ${typeStr}`);
  for (const c of func.cases) {
    const params = c.params.map(p => paramToLean(p, ctors)).join(', ');
    let body: string;
    if (c.body.tag === 'expr') {
      body = exprToLean(c.body.expr, ctors);
    } else {
      const cond = formulaToLean(c.body.condition, ctors);
      const thenExpr = exprToLean(c.body.thenBody, ctors);
      const elseExpr = exprToLean(c.body.elseBody, ctors);
      body = `if ${cond} then ${thenExpr} else ${elseExpr}`;
    }
    lines.push(`  | ${params} => ${body}`);
  }
  return lines.join('\n');
}

function axiomToLean(thm: TheoremAst, ctors: Set<string>): string {
  const params = paramsToLean(thm.params);
  const conclusion = formulaToLean(thm.conclusion, ctors);
  const paramStr = params ? ` ${params}` : '';
  if (thm.premises.length > 0) {
    const premiseStr = thm.premises.map(p => formulaToLean(p, ctors)).join(' → ');
    return `axiom ${thm.name}${paramStr} : ${premiseStr} → ${conclusion}`;
  }
  return `axiom ${thm.name}${paramStr} : ${conclusion}`;
}

function ihNameToLean(name: string): string {
  return name.replace(/^IH/, 'ih');
}

function parseCaseLabel(label: string): { name: string; args: string[] } {
  const m = label.match(/^(\w+)(?:\(([^)]*)\))?$/);
  if (!m) throw new Error(`bad case label: ${label}`);
  return {
    name: m[1],
    args: m[2] ? m[2].split(',').map(s => s.trim()) : [],
  };
}

function collectCalcNames(node: CalcProofNode): { fns: Set<string>; thms: Set<string> } {
  const fns = new Set<string>();
  const thms = new Set<string>();
  for (const step of [...node.forwardSteps, ...node.backwardSteps]) {
    const text = step.ruleText;
    // defof or undef: extract function name from "func_N" or "func_Na"
    let m = text.match(/^(?:defof|undef)\s+(\S+)/);
    if (m) {
      const full = m[1]; // e.g. "concat_1", "positives_2a"
      const idx = full.lastIndexOf('_');
      if (idx > 0) fns.add(full.substring(0, idx));
      continue;
    }
    // apply or unapp: extract theorem/IH name
    m = text.match(/^(?:apply|unapp)\s+(\S+)/);
    if (m) {
      thms.add(m[1]);
      continue;
    }
  }
  return { fns, thms };
}

function calcToLean(
    node: CalcProofNode, ihNames: string[], condVar: string | undefined, indent: string): string {
  const { fns, thms } = collectCalcNames(node);
  const simpArgs: string[] = [...fns];

  for (const t of thms) {
    const leanName = t.match(/^IH/) ? ihNameToLean(t) : t;
    if (!simpArgs.includes(leanName)) simpArgs.push(leanName);
  }
  for (const ih of ihNames) {
    if (!simpArgs.includes(ih)) simpArgs.push(ih);
  }
  if (condVar && !simpArgs.includes(condVar)) {
    simpArgs.push(condVar);
  }

  if (simpArgs.length === 0) {
    return `${indent}omega`;
  }
  return `${indent}simp [${simpArgs.join(', ')}] <;> omega`;
}

function proofToLean(
    node: ProofNode, ctors: Set<string>, indent: string,
    ihNames: string[], condVar?: string): string {
  if (node.kind === 'calculate') {
    return calcToLean(node, ihNames, condVar, indent);
  }

  if (node.kind === 'induction') {
    // Collect parameter names from IH theorems that need generalizing.
    const generalize = new Set<string>();
    for (const block of node.cases) {
      for (const ih of block.ihTheorems) {
        for (const [name, _type] of ih.params) {
          generalize.add(name);
        }
      }
    }
    const genClause = generalize.size > 0
        ? ` generalizing ${[...generalize].join(' ')}`
        : '';
    const lines: string[] = [];
    lines.push(`${indent}induction ${node.varName}${genClause} with`);
    for (const block of node.cases) {
      const { name, args } = parseCaseLabel(block.label);
      const ihs = block.ihTheorems.map(ih => ihNameToLean(ih.name));
      lines.push(`${indent}| ${[name, ...args, ...ihs].join(' ')} =>`);
      lines.push(proofToLean(block.proof, ctors, indent + '  ', ihs));
    }
    return lines.join('\n');
  }

  if (node.kind === 'cases') {
    const condFormula = ParseFormula(node.condition);
    const condLean = formulaToLean(condFormula, ctors);
    const lines: string[] = [];
    lines.push(`${indent}by_cases h : ${condLean}`);
    lines.push(`${indent}·`);
    lines.push(proofToLean(node.thenCase.proof, ctors, indent + '  ', ihNames, 'h'));
    lines.push(`${indent}·`);
    lines.push(proofToLean(node.elseCase.proof, ctors, indent + '  ', ihNames, 'h'));
    return lines.join('\n');
  }

  throw new Error(`unknown proof kind`);
}

/**
 * Convert a proof obligation and its completed proof to a Lean 4 source string.
 * Premises with != are skipped (they have no Formula equivalent).
 * Multiple premises become separate hypothesis parameters h_1, h_2, etc.
 */
export function oblToLean(
  obl: ProofObligation,
  decls: DeclsAst,
  proof: ProofNode,
): string {
  const ctors = collectCtors(decls);
  const lines: string[] = [];

  lines.push('namespace Comfy');
  lines.push('');

  for (const type of decls.types) {
    lines.push(typeToLean(type));
    lines.push('');
  }
  for (const func of decls.functions) {
    lines.push(funcToLean(func, ctors));
    lines.push('');
  }
  for (const thm of decls.theorems) {
    lines.push(axiomToLean(thm, ctors));
    lines.push('');
  }

  const paramStr = paramsToLean(obl.params);
  const provable = obl.premises.filter(c => c.op !== '!=');
  const hyps = provable.map((c, i) =>
    `(h_${i + 1} : ${formulaToLean(condToFormula(c), ctors)})`
  ).join(' ');
  const conclusion = formulaToLean(condToFormula(obl.goal), ctors);

  const sig = ['obligation', paramStr, hyps].filter(Boolean).join(' ');
  lines.push(`theorem ${sig} : ${conclusion} := by`);
  lines.push(proofToLean(proof, ctors, '  ', []));
  lines.push('');
  lines.push('end Comfy');
  lines.push('');

  return lines.join('\n');
}

/** Convert a parsed proof file to a valid Lean 4 source string. */
export function toLean(pf: ProofFile): string {
  const ctors = collectCtors(pf.decls);
  const lines: string[] = [];

  lines.push('namespace Comfy');
  lines.push('');

  for (const type of pf.decls.types) {
    lines.push(typeToLean(type));
    lines.push('');
  }

  for (const func of pf.decls.functions) {
    lines.push(funcToLean(func, ctors));
    lines.push('');
  }

  const theorem = pf.decls.theorems.find(t => t.name === pf.theoremName)!;
  for (const thm of pf.decls.theorems) {
    if (thm.name === pf.theoremName) continue;
    lines.push(axiomToLean(thm, ctors));
    lines.push('');
  }

  // Main theorem with proof
  const params = paramsToLean(theorem.params);
  const conclusion = formulaToLean(theorem.conclusion, ctors);
  const paramStr = params ? ` ${params}` : '';
  if (theorem.premises.length > 0) {
    const hypotheses = theorem.premises
        .map((p, i) => `(h_premise${theorem.premises.length === 1 ? '' : i + 1} : ${formulaToLean(p, ctors)})`)
        .join(' ');
    lines.push(`theorem ${theorem.name}${paramStr} ${hypotheses} : ${conclusion} := by`);
  } else {
    lines.push(`theorem ${theorem.name}${paramStr} : ${conclusion} := by`);
  }
  lines.push(proofToLean(pf.proof, ctors, '  ', []));

  lines.push('');
  lines.push('end Comfy');
  lines.push('');

  return lines.join('\n');
}
