import {
  ProofEntry, ProofNode, CalcProofNode, TacticProofNode,
  CalcStep, CaseBlock, GivenLine, IHLine, TaggedLine,
} from './proof_file';


/** Serialize a ProofEntry back into the text format understood by parseProofFile. */
export function serializeProofEntry(entry: ProofEntry): string {
  const lines: string[] = [];

  // "prove <name>" or "prove <name> by <method>"
  const methodStr = proofMethodString(entry.proof);
  if (methodStr) {
    lines.push(`prove ${entry.theoremName} by ${methodStr}`);
  } else {
    lines.push(`prove ${entry.theoremName}`);
  }

  // Top-level givens.
  for (const g of entry.givens) {
    lines.push(`  ${serializeGiven(g)}`);
  }

  // Proof body (indented).
  const bodyLines = serializeProofBody(entry.proof);
  for (const line of bodyLines) {
    lines.push(`  ${line}`);
  }

  return lines.join('\n');
}


/** Returns the method string for the "prove ... by <method>" line, or null for incomplete. */
function proofMethodString(node: ProofNode): string | null {
  switch (node.kind) {
    case 'calculate': return 'calculation';
    case 'tactic': return node.method;
    case 'none': return null;
  }
}

/** Serialize the body of a ProofNode (without indentation — caller adds it). */
function serializeProofBody(node: ProofNode): string[] {
  switch (node.kind) {
    case 'calculate': return serializeCalcBody(node);
    case 'tactic': return serializeTacticBody(node);
    case 'none': return [];
  }
}

function serializeCalcBody(node: CalcProofNode): string[] {
  const lines: string[] = [];

  // Forward section.
  if (node.forwardStart) {
    lines.push(node.forwardStart.text);
    for (const step of node.forwardSteps) {
      lines.push(serializeCalcStep(step));
    }
  }

  // Backward section.
  if (node.backwardStart) {
    lines.push('---');
    lines.push(node.backwardStart.text);
    for (const step of node.backwardSteps) {
      lines.push(serializeCalcStep(step));
    }
  }

  return lines;
}

function serializeCalcStep(step: CalcStep): string {
  if (step.statedOp && step.statedExpr) {
    return `${step.ruleText} ${step.statedOp} ${step.statedExpr}`;
  }
  return step.ruleText;
}

function serializeTacticBody(node: TacticProofNode): string[] {
  const lines: string[] = [];
  for (const caseBlock of node.cases) {
    lines.push(...serializeCaseBlock(caseBlock));
  }
  return lines;
}

function serializeCaseBlock(block: CaseBlock): string[] {
  const lines: string[] = [];

  lines.push(`case ${block.label}:`);

  // IH lines.
  for (const ih of block.ihTheorems) {
    lines.push(serializeIH(ih));
  }

  // Given lines.
  for (const g of block.givens) {
    lines.push(serializeGiven(g));
  }

  // "prove <goal> by <method>" line.
  const methodStr = proofMethodString(block.proof);
  if (methodStr) {
    lines.push(`prove ${block.goal} by ${methodStr}`);
  } else {
    lines.push(`prove ${block.goal}`);
  }

  // Nested proof body (indented one more level).
  const bodyLines = serializeProofBody(block.proof);
  for (const line of bodyLines) {
    lines.push(`  ${line}`);
  }

  return lines;
}

function serializeGiven(g: GivenLine): string {
  return `given ${g.index}. ${g.text}`;
}

function serializeIH(ih: IHLine): string {
  const params = ih.params.length > 0
      ? ' ' + serializeIHParams(ih.params)
      : '';
  const premiseStr = ih.premises.length > 0
      ? ih.premises.map(p => p.to_string()).join(', ') + ' => '
      : '';
  return `given ${ih.name}${params} : ${premiseStr}${ih.formula}`;
}

function serializeIHParams(params: [string, string][]): string {
  // Group consecutive params with the same type.
  const groups: { names: string[]; type: string }[] = [];
  for (const [name, type] of params) {
    const last = groups[groups.length - 1];
    if (last && last.type === type) {
      last.names.push(name);
    } else {
      groups.push({ names: [name], type });
    }
  }
  return groups.map(g => `(${g.names.join(', ')} : ${g.type})`).join(' ');
}
