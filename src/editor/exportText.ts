import { ProofEntry } from '../proof/proof_file';
import { ProofRange } from './proofRanges';
import { serializeProofEntry } from '../proof/proof_serialize';


/**
 * Build a .prf file by interleaving the raw document text (declarations) with
 * serialized proof entries. Each proof entry replaces the corresponding prove
 * block range in the document.
 */
export function buildProofFileText(
    docText: string,
    ranges: ProofRange[],
    entries: ProofEntry[],
): string {
  const entryMap = new Map(entries.map(e => [e.theoremName, e]));

  const parts: string[] = [];
  let cursor = 0;

  for (const range of ranges) {
    // Declaration text before this prove block.
    if (range.from > cursor) {
      parts.push(docText.substring(cursor, range.from));
    }
    // Serialized proof entry, or original text if no widget state.
    const entry = entryMap.get(range.theoremName);
    if (entry) {
      parts.push(serializeProofEntry(entry));
      parts.push('\n');
    } else {
      parts.push(docText.substring(range.from, range.to));
      parts.push('\n');
    }
    cursor = range.to;
    // Skip trailing newline if present.
    if (cursor < docText.length && docText[cursor] === '\n') cursor++;
  }

  // Remaining text after the last prove block.
  if (cursor < docText.length) {
    parts.push(docText.substring(cursor));
  }

  return parts.join('');
}
