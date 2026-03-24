import { DeclsAst } from '../lang/decls_ast';
import { ParseDecls } from '../lang/decls_parser';
import { Formula, OP_LESS_THAN, OP_LESS_EQUAL } from '../facts/formula';
import { ParseFormula } from '../facts/formula_parser';


interface TaggedLine { text: string; line: number; }

export interface CalcStep {
  ruleText: string;
  statedOp?: string;
  statedExpr?: string;
  line: number;
}

export interface CalcProofNode {
  kind: 'calculate';
  forwardStart: TaggedLine | null;
  forwardSteps: CalcStep[];
  backwardStart: TaggedLine | null;
  backwardSteps: CalcStep[];
}

export interface GivenLine {
  index: number;
  text: string;
  line: number;
}

export interface CaseBlock {
  label: string;
  givens: GivenLine[];
  goal: string;
  goalLine: number;
  proof: ProofNode;
}

export interface InductionProofNode {
  kind: 'induction';
  varName: string;
  argNames?: string[];
  cases: CaseBlock[];
}

export interface CasesProofNode {
  kind: 'cases';
  condition: string;
  conditionLine: number;
  thenCase: CaseBlock;
  elseCase: CaseBlock;
}

export type ProofNode = CalcProofNode | InductionProofNode | CasesProofNode;

export interface ProofFile {
  decls: DeclsAst;
  givens: GivenLine[];
  formula: string;
  formulaLine: number;
  proof: ProofNode;
}

export class ParseError extends Error {
  line: number;
  constructor(line: number, message: string) {
    super(`line ${line}: ${message}`);
    this.line = line;
    Object.setPrototypeOf(this, ParseError.prototype);
  }
}

interface Lines {
  raw: string[];
  pos: number;
}

function peekLine(lines: Lines): string | undefined {
  while (lines.pos < lines.raw.length && lines.raw[lines.pos].trim() === '') {
    lines.pos++;
  }
  if (lines.pos >= lines.raw.length) return undefined;
  return lines.raw[lines.pos];
}

function readLine(lines: Lines): { text: string; line: number } | undefined {
  peekLine(lines);  // skip blanks
  if (lines.pos >= lines.raw.length) return undefined;
  const text = lines.raw[lines.pos];
  const line = lines.pos + 1;  // 1-indexed
  lines.pos++;
  return { text, line };
}

function parseMethod(text: string, line: number): ProofNode {
  const trimmed = text.trim();
  if (trimmed === 'calculation') {
    return { kind: 'calculate', forwardStart: null, forwardSteps: [], backwardStart: null, backwardSteps: [] };
  }

  const indMatch = trimmed.match(/^induction on (\S+)(?:\s+\(([^)]+)\))?$/);
  if (indMatch) {
    const argNames = indMatch[2]
        ? indMatch[2].split(',').map(s => s.trim())
        : undefined;
    return { kind: 'induction', varName: indMatch[1], argNames, cases: [] };
  }

  const casesMatch = trimmed.match(/^cases on (.+)$/);
  if (casesMatch) {
    return {
      kind: 'cases',
      condition: casesMatch[1],
      conditionLine: line,
      thenCase: { label: 'then', givens: [], goal: '', goalLine: 0, proof: { kind: 'calculate', forwardStart: null, forwardSteps: [], backwardStart: null, backwardSteps: [] } },
      elseCase: { label: 'else', givens: [], goal: '', goalLine: 0, proof: { kind: 'calculate', forwardStart: null, forwardSteps: [], backwardStart: null, backwardSteps: [] } },
    };
  }

  throw new ParseError(line, `expected "calculation", "induction on <var>", or "cases on <condition>"`);
}

const ALGEBRA_PREFIX = /^(=|<=|<)\s/;
const NON_ALGEBRA_PREFIX = /^(subst|unsub|defof|undef)\s/;
const BACKWARD_ALGEBRA_PREFIX = /^\(/;
const OP_SEPARATOR = /^(.*)\s+(<=|<|=)\s+(.+)$/;

function parseCalcStep(trimmed: string, line: number): CalcStep {
  // Algebra rules (forward: "= expr", "< expr", "<= expr")
  // and backward algebra ("(expr) =", etc.) — the whole line is the rule.
  if (ALGEBRA_PREFIX.test(trimmed) || BACKWARD_ALGEBRA_PREFIX.test(trimmed)) {
    return { ruleText: trimmed, line };
  }

  // Non-algebra rules: "<rule> <op> <result>" where op is =, <, or <=
  if (NON_ALGEBRA_PREFIX.test(trimmed)) {
    const m = trimmed.match(OP_SEPARATOR);
    if (!m) {
      throw new ParseError(line,
          'expected "<rule> = <expr>", "<rule> < <expr>", or "<rule> <= <expr>"');
    }
    return { ruleText: m[1], statedOp: m[2], statedExpr: m[3], line };
  }

  throw new ParseError(line, `unrecognized rule: "${trimmed}"`);
}

function parseCalcSection(lines: Lines): { start: TaggedLine | null; steps: CalcStep[] } {
  // First line is a bare expression (the starting point).
  // Subsequent lines are rule steps.
  const first = peekLine(lines);
  if (first === undefined) return { start: null, steps: [] };
  const firstTrimmed = first.trim();
  if (firstTrimmed.startsWith('case ') || firstTrimmed === '---' ||
      firstTrimmed.startsWith('given ') || firstTrimmed.startsWith('prove ')) {
    return { start: null, steps: [] };
  }
  const firstEntry = readLine(lines)!;

  const steps: CalcStep[] = [];
  while (true) {
    const next = peekLine(lines);
    if (next === undefined) break;
    const trimmed = next.trim();
    if (trimmed.startsWith('case ') || trimmed === '---' ||
        trimmed.startsWith('given ') || trimmed.startsWith('prove ')) break;
    const entry = readLine(lines)!;
    steps.push(parseCalcStep(trimmed, entry.line));
  }
  return { start: { text: firstTrimmed, line: firstEntry.line }, steps };
}

function parseCalcBody(lines: Lines, calc: CalcProofNode): void {
  const fwd = parseCalcSection(lines);
  calc.forwardStart = fwd.start;
  calc.forwardSteps = fwd.steps;

  const next = peekLine(lines);
  if (next !== undefined && next.trim() === '---') {
    readLine(lines);  // consume separator
    const bwd = parseCalcSection(lines);
    calc.backwardStart = bwd.start;
    calc.backwardSteps = bwd.steps;
  }
}

function parseProofBody(lines: Lines, node: ProofNode): void {
  if (node.kind === 'calculate') {
    parseCalcBody(lines, node);
  } else if (node.kind === 'induction') {
    while (true) {
      const next = peekLine(lines);
      if (next === undefined) break;
      if (!next.trim().startsWith('case ')) break;
      node.cases.push(parseCaseBlock(lines));
    }
    if (node.cases.length === 0) {
      const lineNum = lines.pos < lines.raw.length ? lines.pos + 1 : lines.raw.length;
      throw new ParseError(lineNum, 'induction proof has no cases');
    }
  } else if (node.kind === 'cases') {
    for (let i = 0; i < 2; i++) {
      const next = peekLine(lines);
      if (next === undefined) {
        throw new ParseError(lines.raw.length, `expected case ${i === 0 ? 'then' : 'else'} block`);
      }
      if (!next.trim().startsWith('case ')) {
        const entry = readLine(lines)!;
        throw new ParseError(entry.line, `expected "case then:" or "case else:" block`);
      }
      const block = parseCaseBlock(lines);
      if (block.label === 'then') {
        node.thenCase = block;
      } else if (block.label === 'else') {
        node.elseCase = block;
      } else {
        throw new ParseError(block.goalLine, `expected "then" or "else", got "${block.label}"`);
      }
    }
  }
}

function parseCaseBlock(lines: Lines): CaseBlock {
  // Parse "case <label>:"
  const headerLine = readLine(lines)!;
  const headerMatch = headerLine.text.trim().match(/^case (.+):$/);
  if (!headerMatch) {
    throw new ParseError(headerLine.line, 'expected "case <label>:"');
  }
  const label = headerMatch[1];

  // Parse optional "given N. <formula>" lines
  const givens: GivenLine[] = [];
  while (true) {
    const next = peekLine(lines);
    if (next === undefined) break;
    const givenMatch = next.trim().match(/^given\s+(\d+)\.\s+(.+)$/);
    if (!givenMatch) break;
    const entry = readLine(lines)!;
    givens.push({ index: parseInt(givenMatch[1]), text: givenMatch[2], line: entry.line });
  }

  // Parse "prove <formula> by <method>"
  const provePeek = peekLine(lines);
  if (provePeek === undefined) {
    throw new ParseError(headerLine.line, 'expected "prove" after case header');
  }
  const proveEntry = readLine(lines)!;
  const proveMatch = proveEntry.text.trim().match(/^prove\s+(.+)\s+by\s+(.+)$/);
  if (!proveMatch) {
    throw new ParseError(proveEntry.line, 'expected "prove <formula> by <method>"');
  }
  const goal = proveMatch[1];
  const proof = parseMethod(proveMatch[2], proveEntry.line);
  parseProofBody(lines, proof);

  return { label, givens, goal, goalLine: proveEntry.line, proof };
}

export function parseProofFile(source: string): ProofFile {
  const rawLines = source.split('\n');

  // Find the "prove" line to split preamble from proof.
  let proveIdx = -1;
  for (let i = 0; i < rawLines.length; i++) {
    if (rawLines[i].trim().startsWith('prove ')) {
      proveIdx = i;
      break;
    }
  }
  if (proveIdx === -1) {
    throw new ParseError(rawLines.length, 'missing "prove" statement');
  }

  // Split preamble into declarations and givens.
  const declLines: string[] = [];
  const givens: GivenLine[] = [];
  for (let i = 0; i < proveIdx; i++) {
    const trimmed = rawLines[i].trim();
    const givenMatch = trimmed.match(/^given\s+(\d+)\.\s+(.+)$/);
    if (givenMatch) {
      givens.push({ index: parseInt(givenMatch[1]), text: givenMatch[2], line: i + 1 });
    } else {
      declLines.push(rawLines[i]);
    }
  }

  // Parse declarations.
  const preamble = declLines.join('\n').trim();
  let decls: DeclsAst;
  if (preamble.length === 0) {
    decls = new DeclsAst([], [], []);
  } else {
    const declsResult = ParseDecls(preamble);
    if (declsResult.error) {
      throw new ParseError(1, `declaration error: ${declsResult.error}`);
    }
    decls = declsResult.ast!;
  }

  // Parse the prove line: "prove <formula> by <method>"
  const proveLine = rawLines[proveIdx].trim();
  const proveMatch = proveLine.match(/^prove\s+(.+)\s+by\s+(.+)$/);
  if (!proveMatch) {
    throw new ParseError(proveIdx + 1, 'expected "prove <formula> by <method>"');
  }
  const formula = proveMatch[1];
  const proofNode = parseMethod(proveMatch[2], proveIdx + 1);

  // Parse the proof body.
  const lines: Lines = { raw: rawLines, pos: proveIdx + 1 };
  parseProofBody(lines, proofNode);

  return {
    decls,
    givens,
    formula,
    formulaLine: proveIdx + 1,
    proof: proofNode,
  };
}
