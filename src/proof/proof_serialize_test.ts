import * as assert from 'assert';
import { parseProofFile } from './proof_file';
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
});
