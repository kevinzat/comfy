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

export interface IncompleteProofNode {
  kind: 'none';
  methodLine: number;
}

export type ProofNode = CalcProofNode | TacticProofNode | IncompleteProofNode;

export interface ProofEntry {
  theoremName: string;
  theoremLine: number;
  givens: GivenLine[];
  proof: ProofNode;
}

export type ProofFileItem =
  | { kind: 'decls'; decls: DeclsAst; startLine: number }
  | { kind: 'proof'; entry: ProofEntry };

export interface ProofFile {
  items: ProofFileItem[];
}

export interface ParseResult {
  file: ProofFile;
  errors: ParseError[];
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
  lineOffset: number;  // added to 1-indexed pos to get original file line numbers
  errors: ParseError[];
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
  const line = lines.pos + 1 + lines.lineOffset;  // 1-indexed, offset to original file
  lines.pos++;
  return { text, line };
}

function parseMethod(text: string, line: number, errors: ParseError[]): ProofNode {
  const method = parseTacticMethod(text);
  if (method === null) {
    errors.push(new ParseError(line, `expected "calculation", "induction on <var>", or "simple cases on <condition>"`));
    return { kind: 'none', methodLine: line };
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

function parseCalcStep(trimmed: string, line: number, errors: ParseError[]): CalcStep | null {
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
      errors.push(new ParseError(line,
          'expected "<rule> = <expr>", "<rule> < <expr>", or "<rule> <= <expr>"'));
      return null;
    }
    return { ruleText: m[1], statedOp: m[2], statedExpr: m[3], line };
  }

  errors.push(new ParseError(line, `unrecognized rule: "${trimmed}"`));
  return null;
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
    const step = parseCalcStep(trimmed, entry.line, lines.errors);
    if (step !== null) steps.push(step);
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
    const caseBlock = parseCaseBlock(lines);
    if (caseBlock !== null) node.cases.push(caseBlock);
  }
  // Zero cases is valid for tactics whose goals are all auto-discharged.
  // The checker validates the case count against decompose() results.
}

function parseProofBody(lines: Lines, node: ProofNode): void {
  if (node.kind === 'calculate') {
    parseCalcBody(lines, node);
  } else if (node.kind === 'tactic') {
    parseTacticBody(lines, node);
  }
  // kind === 'none': no body to parse.
}

function parseCaseBlock(lines: Lines): CaseBlock | null {
  // Parse "case <label>:"
  const headerLine = readLine(lines);
  const headerMatch = headerLine.text.trim().match(/^case (.+):$/);
  if (!headerMatch) {
    lines.errors.push(new ParseError(headerLine.line, 'expected "case <label>:"'));
    return null;
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
        lines.errors.push(new ParseError(entry.line, `bad IH premise: ${e.message}`));
        continue;
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
  if (provePeek === undefined || !provePeek.trim().startsWith('prove ')) {
    lines.errors.push(new ParseError(headerLine.line, 'expected "prove" after case header'));
    return { label, ihTheorems, givens, goal: '', goalLine: headerLine.line,
        proof: { kind: 'none', methodLine: headerLine.line } };
  }
  const proveEntry = readLine(lines);
  const proveMatch = proveEntry.text.trim().match(/^prove\s+(.+)\s+by\s+(.+)$/);
  if (!proveMatch) {
    lines.errors.push(new ParseError(proveEntry.line, 'expected "prove <formula> by <method>"'));
    return { label, ihTheorems, givens, goal: '', goalLine: proveEntry.line,
        proof: { kind: 'none', methodLine: proveEntry.line } };
  }
  const goal = proveMatch[1];
  const proof = parseMethod(proveMatch[2], proveEntry.line, lines.errors);
  parseProofBody(lines, proof);

  return { label, ihTheorems, givens, goal, goalLine: proveEntry.line, proof };
}

/** True if the line is indented (starts with whitespace). */
function isIndented(line: string): boolean {
  return line.length > 0 && (line[0] === ' ' || line[0] === '\t');
}

/** Strip the common leading whitespace from a block of indented lines. */
function stripIndent(lines: string[]): string[] {
  let minIndent = Infinity;
  for (const line of lines) {
    if (line.trim() === '') continue;
    const indent = line.match(/^(\s*)/)![1].length;
    if (indent < minIndent) minIndent = indent;
  }
  if (!isFinite(minIndent)) minIndent = 0;
  return lines.map(l => l.substring(minIndent));
}

export function parseProofFile(source: string): ParseResult {
  const rawLines = source.split('\n');
  const items: ProofFileItem[] = [];
  const errors: ParseError[] = [];

  let i = 0;
  while (i < rawLines.length) {
    // Skip blank lines.
    if (rawLines[i].trim() === '') { i++; continue; }

    // Check for an unindented "prove" line.
    if (!isIndented(rawLines[i]) && rawLines[i].trim().startsWith('prove ')) {
      const proveIdx = i;
      const proveLine = rawLines[i].trim();

      // Try "prove <name> by <method>" first, fall back to "prove <name>".
      const fullMatch = proveLine.match(/^prove\s+(\S+)\s+by\s+(.+)$/);
      const nameOnlyMatch = !fullMatch ? proveLine.match(/^prove\s+(\S+)$/) : null;
      if (!fullMatch && !nameOnlyMatch) {
        // Has "by" but method is missing or name is missing — record error, skip.
        errors.push(new ParseError(proveIdx + 1, 'expected "prove <name>" or "prove <name> by <method>"'));
        i++;
        while (i < rawLines.length && (rawLines[i].trim() === '' || isIndented(rawLines[i]))) {
          i++;
        }
        continue;
      }

      const theoremName = fullMatch ? fullMatch[1] : nameOnlyMatch![1];
      const proofNode = fullMatch
          ? parseMethod(fullMatch[2], proveIdx + 1, errors)
          : { kind: 'none' as const, methodLine: proveIdx + 1 };
      i++;

      // Collect all indented lines as the proof body.
      const bodyLines: string[] = [];
      while (i < rawLines.length && (rawLines[i].trim() === '' || isIndented(rawLines[i]))) {
        bodyLines.push(rawLines[i]);
        i++;
      }

      // Strip indent and parse the proof body.
      // lineOffset maps 1-indexed positions in stripped back to original file lines.
      const stripped = stripIndent(bodyLines);
      const lines: Lines = { raw: stripped, pos: 0, lineOffset: proveIdx + 1, errors };

      // Parse optional top-level "given N. <formula>" lines (premise).
      const givens: GivenLine[] = [];
      while (true) {
        const next = peekLine(lines);
        if (next === undefined) break;
        const givenMatch = next.trim().match(/^given\s+(\d+)\.\s+(.+)$/);
        if (!givenMatch) break;
        const entry = readLine(lines);
        givens.push({ index: parseInt(givenMatch[1]), text: givenMatch[2],
            line: entry.line });
      }

      parseProofBody(lines, proofNode);

      items.push({ kind: 'proof', entry: {
        theoremName,
        theoremLine: proveIdx + 1,
        givens,
        proof: proofNode,
      }});
      continue;
    }

    // Otherwise, accumulate declaration lines until we hit a "prove" or EOF.
    const declStart = i;
    while (i < rawLines.length) {
      if (!isIndented(rawLines[i]) && rawLines[i].trim().startsWith('prove ')) break;
      i++;
    }

    const declText = rawLines.slice(declStart, i).join('\n').trim();
    const declsResult = ParseDecls(declText);
    for (const e of declsResult.errors) {
      errors.push(new ParseError(declStart + 1, `declaration error: ${e}`));
    }
    items.push({ kind: 'decls', decls: declsResult.ast, startLine: declStart + 1 });
  }

  if (!items.some(item => item.kind === 'proof')) {
    errors.push(new ParseError(rawLines.length, 'missing "prove" statement'));
  }

  return { file: { items }, errors };
}
