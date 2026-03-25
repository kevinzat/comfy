import { DeclsAst } from '../lang/decls_ast';
import { ParseDecls } from '../lang/decls_parser';


/**
 * Parses Lean-style param groups from a string, e.g. "(S, T : List) (x : Int)".
 * Returns [name, typeName] pairs. Throws ParseError on malformed input.
 */
export function parseParams(text: string, line: number): [string, string][] {
  const params: [string, string][] = [];
  const groupRegex = /\(([^)]+)\)/g;
  let match;
  while ((match = groupRegex.exec(text)) !== null) {
    const content = match[1];
    const colonIdx = content.indexOf(':');
    if (colonIdx === -1) {
      throw new ParseError(line, `missing ":" in param group "(${content})"`);
    }
    const namesStr = content.substring(0, colonIdx).trim();
    const typeName = content.substring(colonIdx + 1).trim();
    if (!typeName) {
      throw new ParseError(line, `missing type name in param group "(${content})"`);
    }
    const names = namesStr.split(',').map(s => s.trim()).filter(s => s.length > 0);
    if (names.length === 0) {
      throw new ParseError(line, `missing variable names in param group "(${content})"`);
    }
    for (const name of names) {
      params.push([name, typeName]);
    }
  }
  return params;
}

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

export interface IHLine {
  name: string;
  params: [string, string][];
  premise: string | undefined;
  formula: string;
  line: number;
}

export interface CaseBlock {
  label: string;
  ihTheorems: IHLine[];
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
  theoremName: string;
  theoremLine: number;
  givens: GivenLine[];
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
      thenCase: { label: 'then', ihTheorems: [], givens: [], goal: '', goalLine: 0, proof: { kind: 'calculate', forwardStart: null, forwardSteps: [], backwardStart: null, backwardSteps: [] } },
      elseCase: { label: 'else', ihTheorems: [], givens: [], goal: '', goalLine: 0, proof: { kind: 'calculate', forwardStart: null, forwardSteps: [], backwardStart: null, backwardSteps: [] } },
    };
  }

  throw new ParseError(line, `expected "calculation", "induction on <var>", or "cases on <condition>"`);
}

const ALGEBRA_PREFIX = /^(=|<=|<)\s/;
const NON_ALGEBRA_PREFIX = /^(subst|unsub|defof|undef|apply|unapp)\s/;
const BACKWARD_ALGEBRA_SUFFIX = /\s+(<=|<|=)(\s+since\s+[\d,\s]+)?$/;
const OP_SEPARATOR = /^(.*)\s+(<=|<|=)\s+(.+)$/;
const HAS_ARROW = /=>/;

function parseCalcStep(trimmed: string, line: number): CalcStep {
  // Forward algebra: starts with "= expr", "< expr", "<= expr".
  // Backward algebra: ends with a bare operator "expr =", "expr <", "expr <=".
  if (ALGEBRA_PREFIX.test(trimmed) || BACKWARD_ALGEBRA_SUFFIX.test(trimmed)) {
    return { ruleText: trimmed, line };
  }

  // Non-algebra rules.
  if (NON_ALGEBRA_PREFIX.test(trimmed)) {
    // Rules with "=>" specify their own result — no separate "= expr" needed.
    if (HAS_ARROW.test(trimmed)) {
      return { ruleText: trimmed, line };
    }
    // Rules without "=>" need "<rule> <op> <result>".
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

  // Parse optional "given IH (params) : [premise =>] formula" lines.
  const ihTheorems: IHLine[] = [];
  while (true) {
    const next = peekLine(lines);
    if (next === undefined) break;
    const trimmed = next.trim();
    // Match: given <IH name> [(<params>)] : <body>
    const ihMatch = trimmed.match(
        /^given\s+(IH(?:_\w+|\d+)?)\s*((?:\([^)]*\)\s*)*):\s+(.+)$/);
    if (!ihMatch) break;
    const entry = readLine(lines)!;
    const name = ihMatch[1];
    const paramsText = ihMatch[2].trim();
    const params = parseParams(paramsText, entry.line);
    const body = ihMatch[3];
    // Split on => for optional premise.
    const arrowIdx = body.indexOf('=>');
    let premise: string | undefined;
    let formula: string;
    if (arrowIdx !== -1) {
      premise = body.substring(0, arrowIdx).trim();
      formula = body.substring(arrowIdx + 2).trim();
    } else {
      premise = undefined;
      formula = body;
    }
    ihTheorems.push({ name, params, premise, formula, line: entry.line });
  }

  // Parse optional "given N. <formula>" lines (cases-on conditions).
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

  return { label, ihTheorems, givens, goal, goalLine: proveEntry.line, proof };
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

  // Parse declarations (everything before the prove line).
  const preamble = rawLines.slice(0, proveIdx).join('\n').trim();
  let decls: DeclsAst;
  if (preamble.length === 0) {
    decls = new DeclsAst([], [], [], []);
  } else {
    const declsResult = ParseDecls(preamble);
    if (declsResult.error) {
      throw new ParseError(1, `declaration error: ${declsResult.error}`);
    }
    decls = declsResult.ast!;
  }

  // Parse the prove line: "prove <name> by <method>"
  const proveLine = rawLines[proveIdx].trim();
  const proveMatch = proveLine.match(/^prove\s+(\S+)\s+by\s+(.+)$/);
  if (!proveMatch) {
    throw new ParseError(proveIdx + 1, 'expected "prove <name> by <method>"');
  }
  const theoremName = proveMatch[1];
  const proofNode = parseMethod(proveMatch[2], proveIdx + 1);

  // Parse optional top-level "given N. <formula>" lines (premise).
  const lines: Lines = { raw: rawLines, pos: proveIdx + 1 };
  const givens: GivenLine[] = [];
  while (true) {
    const next = peekLine(lines);
    if (next === undefined) break;
    const givenMatch = next.trim().match(/^given\s+(\d+)\.\s+(.+)$/);
    if (!givenMatch) break;
    const entry = readLine(lines)!;
    givens.push({ index: parseInt(givenMatch[1]), text: givenMatch[2], line: entry.line });
  }

  // Parse the proof body.
  parseProofBody(lines, proofNode);

  return {
    decls,
    theoremName,
    theoremLine: proveIdx + 1,
    givens,
    proof: proofNode,
  };
}
