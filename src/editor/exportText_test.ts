import * as assert from 'assert';
import { parseProofFile, ProofEntry } from '../proof/proof_file';
import { findProofRanges } from './proofRanges';
import { buildProofFileText } from './exportText';


/** Parse docText, extract proof entries and ranges, rebuild, and compare. */
function roundTrip(docText: string): void {
  const result = parseProofFile(docText);
  const entries: ProofEntry[] = [];
  for (const item of result.file.items) {
    if (item.kind === 'proof') entries.push(item.entry);
  }
  const ranges = findProofRanges(docText);
  const rebuilt = buildProofFileText(docText, ranges, entries);
  assert.strictEqual(rebuilt, docText);
}


describe('buildProofFileText', () => {
  it('rebuilds a simple file with one proof', () => {
    roundTrip([
      'theorem foo (x : Int)',
      '| x = x',
      '',
      'prove foo by calculation',
      '  x',
      '  = x',
      '',
    ].join('\n'));
  });

  it('rebuilds a file with multiple proofs', () => {
    roundTrip([
      'theorem foo (x : Int)',
      '| x = x',
      '',
      'prove foo by calculation',
      '  x',
      '  = x',
      '',
      'theorem bar (y : Int)',
      '| y = y',
      '',
      'prove bar by calculation',
      '  y',
      '  = y',
      '',
    ].join('\n'));
  });

  it('preserves declarations text exactly', () => {
    roundTrip([
      'type Bool',
      '| true : Bool',
      '| false : Bool',
      '',
      'def not : (Bool) -> Bool',
      '| not(true) = false',
      '| not(false) = true',
      '',
      'theorem not_not (b : Bool)',
      '| not(not(b)) = b',
      '',
      'prove not_not by simple cases on b',
      '',
    ].join('\n'));
  });

  it('substitutes a different proof entry', () => {
    const docText = [
      'theorem foo (x : Int)',
      '| x = x',
      '',
      'prove foo',
      '',
    ].join('\n');
    const ranges = findProofRanges(docText);
    const entry: ProofEntry = {
      theoremName: 'foo',
      theoremLine: 0,
      givens: [],
      proof: { kind: 'calculate', forwardStart: null, forwardSteps: [], backwardStart: null, backwardSteps: [] },
    };
    const result = buildProofFileText(docText, ranges, [entry]);
    assert.ok(result.includes('prove foo by calculation'));
  });

  it('keeps original text when no entry matches', () => {
    const docText = [
      'theorem foo (x : Int)',
      '| x = x',
      '',
      'prove foo',
      '',
    ].join('\n');
    const ranges = findProofRanges(docText);
    const result = buildProofFileText(docText, ranges, []);
    assert.ok(result.includes('prove foo'));
    assert.ok(!result.includes('by calculation'));
  });

  it('handles prove block at start of document', () => {
    const docText = 'prove foo by calculation\n  x\n  = x\n';
    const ranges = findProofRanges(docText);
    const result = parseProofFile(docText);
    const entries: ProofEntry[] = [];
    for (const item of result.file.items) {
      if (item.kind === 'proof') entries.push(item.entry);
    }
    const rebuilt = buildProofFileText(docText, ranges, entries);
    assert.strictEqual(rebuilt, docText);
  });

  it('handles document without trailing newline after prove block', () => {
    const docText = 'prove foo by calculation\n  x\n  = x';
    const ranges = findProofRanges(docText);
    const result = parseProofFile(docText);
    const entries: ProofEntry[] = [];
    for (const item of result.file.items) {
      if (item.kind === 'proof') entries.push(item.entry);
    }
    const rebuilt = buildProofFileText(docText, ranges, entries);
    assert.ok(rebuilt.includes('prove foo by calculation'));
  });

  it('handles declarations after the last proof', () => {
    const docText = [
      'theorem foo (x : Int)',
      '| x = x',
      '',
      'prove foo by calculation',
      '  x',
      '  = x',
      '',
      'theorem bar (y : Int)',
      '| y = y',
      '',
    ].join('\n');
    const ranges = findProofRanges(docText);
    const result = parseProofFile(docText);
    const entries: ProofEntry[] = [];
    for (const item of result.file.items) {
      if (item.kind === 'proof') entries.push(item.entry);
    }
    const rebuilt = buildProofFileText(docText, ranges, entries);
    assert.ok(rebuilt.includes('theorem bar'));
    assert.ok(rebuilt.includes('| y = y'));
  });
});
