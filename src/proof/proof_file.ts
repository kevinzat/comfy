import { DeclsAst } from '../lang/decls_ast';
import { ParseDecls, ParsePremises } from '../lang/decls_parser';
import { Prop } from '../facts/prop';
import { parseTacticMethod } from './proof_tactic';


export interface TaggedLine { text: string; line: number; }

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
  premises: Prop[];
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

export interface TacticProofNode {
  kind: 'tactic';
  method: string;
  methodLine: number;
  cases: CaseBlock[];
}

export type ProofNode = CalcProofNode | TacticProofNode;

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

function readLine(lines: Lines): { text: string; line: number } {
  peekLine(lines);  // skip blanks
  /* v8 ignore start */
  if (lines.pos >= lines.raw.length) throw new Error("impossible: no line");
  /* v8 ignore stop */
  const text = lines.raw[lines.pos];
  const line = lines.pos + 1;  // 1-indexed
  lines.pos++;
  return { text, line };
}

function parseMethod(text: string, line: number): ProofNode {
  const method = parseTacticMethod(text);
  if (method === null) {
    throw new ParseError(line, `expected "calculation", "induction on <var>", or "simple cases on <condition>"`);
  }
  if (method.kind === 'calculate') {
    return { kind: 'calculate', forwardStart: null, forwardSteps: [], backwardStart: null, backwardSteps: [] };
  }
  return { kind: 'tactic', method: text.trim(), methodLine: line, cases: [] };
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

function parseCalcSection(lines: Lines): { start: { text: string; line: number } | null; steps: CalcStep[] } {
  const first = peekLine(lines);
  if (first === undefined) return { start: null, steps: [] };
  const firstTrimmed = first.trim();
  if (firstTrimmed.startsWith('case ') || firstTrimmed === '---' ||
      firstTrimmed.startsWith('given ') || firstTrimmed.startsWith('prove ')) {
    return { start: null, steps: [] };
  }
  const firstEntry = readLine(lines);

  const steps: CalcStep[] = [];
  while (true) {
    const next = peekLine(lines);
    if (next === undefined) break;
    const trimmed = next.trim();
    if (trimmed.startsWith('case ') || trimmed === '---' ||
        trimmed.startsWith('given ') || trimmed.startsWith('prove ')) break;
    const entry = readLine(lines);
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

function parseTacticBody(lines: Lines, node: TacticProofNode): void {
  while (true) {
    const next = peekLine(lines);
    if (next === undefined) break;
    if (!next.trim().startsWith('case ')) break;
    node.cases.push(parseCaseBlock(lines));
  }
  // Zero cases is valid for tactics whose goals are all auto-discharged.
  // The checker validates the case count against decompose() results.
}

function parseProofBody(lines: Lines, node: ProofNode): void {
  if (node.kind === 'calculate') {
    parseCalcBody(lines, node);
  } else {
    parseTacticBody(lines, node);
  }
}

function parseCaseBlock(lines: Lines): CaseBlock {
  // Parse "case <label>:"
  const headerLine = readLine(lines);
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
    const entry = readLine(lines);
    const name = ihMatch[1];
    const paramsText = ihMatch[2].trim();
    const params = parseParams(paramsText, entry.line);
    const body = ihMatch[3];
    // Split on => for optional premises.
    const arrowIdx = body.indexOf('=>');
    let premises: Prop[];
    let formula: string;
    if (arrowIdx !== -1) {
      const premiseText = body.substring(0, arrowIdx).trim();
      try {
        premises = ParsePremises(premiseText);
      } catch (e: any) {
        throw new ParseError(entry.line, `bad IH premise: ${e.message}`);
      }
      formula = body.substring(arrowIdx + 2).trim();
    } else {
      premises = [];
      formula = body;
    }
    ihTheorems.push({ name, params, premises, formula, line: entry.line });
  }

  // Parse optional "given N. <formula>" lines (cases-on conditions).
  const givens: GivenLine[] = [];
  while (true) {
    const next = peekLine(lines);
    if (next === undefined) break;
    const givenMatch = next.trim().match(/^given\s+(\d+)\.\s+(.+)$/);
    if (!givenMatch) break;
    const entry = readLine(lines);
    givens.push({ index: parseInt(givenMatch[1]), text: givenMatch[2], line: entry.line });
  }

  // Parse "prove <formula> by <method>"
  const provePeek = peekLine(lines);
  if (provePeek === undefined) {
    throw new ParseError(headerLine.line, 'expected "prove" after case header');
  }
  const proveEntry = readLine(lines);
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
    decls = new DeclsAst([], [], []);
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
    const entry = readLine(lines);
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
