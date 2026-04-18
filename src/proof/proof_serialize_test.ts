import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { parseProofFile } from './proof_file';
import { checkProofFile } from './proof_file_checker';
import { serializeProofEntry } from './proof_serialize';


/** Parse, extract the first proof entry, serialize it, and compare to the original source. */
function roundTrip(source: string): void {
  const result = parseProofFile(source);
  assert.deepStrictEqual(result.errors, [],
      `parse errors: ${result.errors.map(e => e.message).join(', ')}`);
  const entry = result.file.items.find(i => i.kind === 'proof');
  assert.ok(entry && entry.kind === 'proof', 'no proof found');

  const serialized = serializeProofEntry(entry.entry);
  assert.strictEqual(serialized, source);
}


describe('serializeProofEntry', () => {
  it('serializes an incomplete proof (no method)', () => {
    const source = 'prove foo';
    const result = parseProofFile(source);
    const entry = result.file.items.find(i => i.kind === 'proof')!;
    assert.ok(entry.kind === 'proof');
    const text = serializeProofEntry(entry.entry);
    assert.strictEqual(text, 'prove foo');
  });

  it('serializes an empty calculation', () => {
    roundTrip('prove foo by calculation');
  });

  it('serializes a calculation with forward start only', () => {
    roundTrip([
      'prove foo by calculation',
      '  x + y',
    ].join('\n'));
  });

  it('serializes a calculation with forward steps', () => {
    roundTrip([
      'prove foo by calculation',
      '  x + y',
      '  = y + x',
    ].join('\n'));
  });

  it('serializes a calculation with forward and backward sections', () => {
    roundTrip([
      'prove foo by calculation',
      '  x',
      '  = y',
      '  ---',
      '  z',
      '  = y',
    ].join('\n'));
  });

  it('serializes calc steps with statedOp and statedExpr', () => {
    roundTrip([
      'prove foo by calculation',
      '  f(x)',
      '  defof f = x + 1',
    ].join('\n'));
  });

  it('serializes calc steps with arrow rules', () => {
    roundTrip([
      'prove foo by calculation',
      '  f(x)',
      '  defof f => x + 1',
    ].join('\n'));
  });

  it('serializes backward algebra steps', () => {
    roundTrip([
      'prove foo by calculation',
      '  x',
      '  ---',
      '  y',
      '  x + 0 =',
    ].join('\n'));
  });

  it('serializes an induction proof with cases', () => {
    roundTrip([
      'prove foo by induction on n',
      '  case zero:',
      '  prove 0 = 0 by calculation',
      '    0',
      '    = 0',
      '  case succ:',
      '  given IH : f(n) = f(n)',
      '  prove f(n + 1) = f(n + 1) by calculation',
      '    f(n + 1)',
      '    = f(n + 1)',
    ].join('\n'));
  });

  it('serializes IH with params and premises', () => {
    roundTrip([
      'prove foo by induction on n',
      '  case zero:',
      '  prove 0 = 0 by calculation',
      '    0',
      '    = 0',
      '  case succ:',
      '  given IH (x : Int) : x = 0 => f(n, x) = f(n, x)',
      '  prove f(n + 1, x) = f(n + 1, x) by calculation',
      '    f(n + 1, x)',
      '    = f(n + 1, x)',
    ].join('\n'));
  });

  it('serializes simple cases with givens', () => {
    roundTrip([
      'prove foo by simple cases on x > 0',
      '  case then:',
      '  given 1. x > 0',
      '  prove x = x by calculation',
      '    x',
      '    = x',
      '  case else:',
      '  given 1. not (x > 0)',
      '  prove x = x by calculation',
      '    x',
      '    = x',
    ].join('\n'));
  });

  it('serializes top-level givens', () => {
    roundTrip([
      'prove foo by calculation',
      '  given 1. x = y',
      '  x',
      '  = x',
    ].join('\n'));
  });

  it('serializes a tactic proof with no cases', () => {
    roundTrip('prove foo by simple cases on x > 0');
  });

  it('serializes induction with argNames', () => {
    roundTrip([
      'prove foo by induction on n (a, b)',
      '  case zero:',
      '  prove 0 = 0 by calculation',
      '    0',
      '    = 0',
    ].join('\n'));
  });

  it('round-trips multiple proofs in one file', () => {
    const source = [
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
    ].join('\n');
    const result = parseProofFile(source);
    assert.deepStrictEqual(result.errors, []);

    const proofs = result.file.items.filter(i => i.kind === 'proof');
    assert.strictEqual(proofs.length, 2);

    assert.strictEqual(
        serializeProofEntry((proofs[0] as any).entry),
        'prove foo by calculation\n  x\n  = x');
    assert.strictEqual(
        serializeProofEntry((proofs[1] as any).entry),
        'prove bar by calculation\n  y\n  = y');
  });

  it('serializes IH with multiple params of same type', () => {
    roundTrip([
      'prove foo by induction on n',
      '  case zero:',
      '  prove 0 = 0 by calculation',
      '    0',
      '    = 0',
      '  case succ:',
      '  given IH (x, y : Int) : f(n, x, y) = f(n, x, y)',
      '  prove f(n + 1, x, y) = f(n + 1, x, y) by calculation',
      '    f(n + 1, x, y)',
      '    = f(n + 1, x, y)',
    ].join('\n'));
  });

  it('serializes incomplete proof inside case block', () => {
    // When the case block has a bad "prove" line, the parser stores an empty
    // goal with kind 'none'. The serializer should still produce valid output.
    const source = [
      'prove foo by induction on n',
      '  case zero:',
      '  prove 0 = 0',
    ].join('\n');
    const result = parseProofFile(source);
    const entry = result.file.items.find(i => i.kind === 'proof');
    assert.ok(entry && entry.kind === 'proof');
    const proof = entry.entry.proof;
    assert.strictEqual(proof.kind, 'tactic');
    if (proof.kind === 'tactic') {
      // The parser records an incomplete case with empty goal.
      assert.strictEqual(proof.cases[0].proof.kind, 'none');
    }
    const serialized = serializeProofEntry(entry.entry);
    // Should include the case header and an incomplete prove line.
    assert.ok(serialized.includes('case zero:'));
    assert.ok(serialized.includes('prove '));
  });

  it('serializes nested tactic inside case block', () => {
    roundTrip([
      'prove foo by induction on n',
      '  case zero:',
      '  prove 0 = 0 by simple cases on x > 0',
      '    case then:',
      '    given 1. x > 0',
      '    prove 0 = 0 by calculation',
      '      0',
      '      = 0',
      '    case else:',
      '    given 1. not (x > 0)',
      '    prove 0 = 0 by calculation',
      '      0',
      '      = 0',
    ].join('\n'));
  });

  it('serializes bare subst rule (no result expression)', () => {
    roundTrip([
      'prove foo by calculation',
      '  b',
      '  subst 1',
    ].join('\n'));
  });

  it('serializes bare defof rule (no result expression)', () => {
    roundTrip([
      'prove foo by calculation',
      '  f(x)',
      '  defof f',
    ].join('\n'));
  });
});

/**
 * Roundtrip test for all .prf files: parse, serialize, re-parse, and
 * re-validate. This catches bugs where saving and reloading loses proof steps.
 */
const proofsDir = path.join(__dirname, 'proofs');
const proofFiles = fs.readdirSync(proofsDir)
    .filter(f => f.endsWith('.prf'))
    .sort();

describe('proof file roundtrip', function() {
  for (const file of proofFiles) {
    it(`${file} survives serialize/re-parse/re-check`, function() {
      const source = fs.readFileSync(path.join(proofsDir, file), 'utf-8');
      const original = parseProofFile(source);

      // Rebuild the file by serializing each proof entry back into the
      // declaration text, replacing the original prove blocks.
      const parts: string[] = [];
      let cursor = 0;
      for (const item of original.file.items) {
        if (item.kind === 'decls') {
          // Declarations are stored with their startLine but we reconstruct
          // from the raw text to preserve formatting.
          continue;
        }
        // Find the prove block in the source by searching for "prove <name>".
        const entry = item.entry;
        const provePattern = `prove ${entry.theoremName}`;
        const idx = source.indexOf(provePattern, cursor);
        if (idx === -1) continue;
        // Include text before this prove block.
        parts.push(source.substring(cursor, idx));
        // Serialize the proof entry.
        parts.push(serializeProofEntry(entry));
        parts.push('\n');
        // Skip past the original prove block.
        let end = idx;
        const lines = source.substring(idx).split('\n');
        end += lines[0].length + 1;  // prove line
        for (let i = 1; i < lines.length; i++) {
          if (lines[i].length > 0 && (lines[i][0] === ' ' || lines[i][0] === '\t')) {
            end += lines[i].length + 1;
          } else if (lines[i].trim() === '') {
            // Blank line — only include if followed by an indented line.
            let j = i + 1;
            while (j < lines.length && lines[j].trim() === '') j++;
            if (j < lines.length && lines[j].length > 0 &&
                (lines[j][0] === ' ' || lines[j][0] === '\t')) {
              end += lines[i].length + 1;
            } else {
              break;
            }
          } else {
            break;
          }
        }
        cursor = end;
      }
      parts.push(source.substring(cursor));
      const rebuilt = parts.join('');

      // Re-parse and re-check the rebuilt file.
      const reparsed = parseProofFile(rebuilt);
      const reErrors = reparsed.errors.filter(e => !e.message.includes('missing "prove"'));
      assert.deepStrictEqual(reErrors, [],
          `re-parse errors in ${file}: ${reErrors.map(e => e.message).join(', ')}`);
      const { errors: reCheckErrors } = checkProofFile(reparsed.file);
      assert.deepStrictEqual(reCheckErrors, [],
          `re-check errors in ${file}: ${reCheckErrors.map(e => e.message).join(', ')}`);
    });
  }
});
