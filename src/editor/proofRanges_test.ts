import * as assert from 'assert';
import { findProofRanges, buildDocSections } from './proofRanges';


describe('findProofRanges', () => {
  it('finds no ranges in empty text', () => {
    assert.deepStrictEqual(findProofRanges(''), []);
  });

  it('finds no ranges in declarations only', () => {
    const text = 'theorem foo (x : Int)\n| x = x\n';
    assert.deepStrictEqual(findProofRanges(text), []);
  });

  it('finds a simple prove block', () => {
    const text = 'prove foo by calculation\n  x\n  = x\n';
    const ranges = findProofRanges(text);
    assert.strictEqual(ranges.length, 1);
    assert.strictEqual(ranges[0].theoremName, 'foo');
    assert.strictEqual(ranges[0].from, 0);
    assert.strictEqual(text.substring(ranges[0].from, ranges[0].to), 'prove foo by calculation\n  x\n  = x');
  });

  it('finds a prove block after declarations', () => {
    const text = 'theorem foo (x : Int)\n| x = x\n\nprove foo\n';
    const ranges = findProofRanges(text);
    assert.strictEqual(ranges.length, 1);
    assert.strictEqual(ranges[0].theoremName, 'foo');
    assert.ok(ranges[0].from > 0);
  });

  it('finds multiple prove blocks', () => {
    const text = 'prove foo\n\nprove bar\n';
    const ranges = findProofRanges(text);
    assert.strictEqual(ranges.length, 2);
    assert.strictEqual(ranges[0].theoremName, 'foo');
    assert.strictEqual(ranges[1].theoremName, 'bar');
  });

  it('consumes blank lines between indented lines', () => {
    const text = 'prove foo by calculation\n  x\n\n  = x\n';
    const ranges = findProofRanges(text);
    assert.strictEqual(ranges.length, 1);
    // The blank line between indented lines should be consumed.
    assert.strictEqual(text.substring(ranges[0].from, ranges[0].to),
        'prove foo by calculation\n  x\n\n  = x');
  });

  it('does not consume trailing blank lines', () => {
    const text = 'prove foo by calculation\n  x\n\ntheorem bar (y : Int)\n';
    const ranges = findProofRanges(text);
    assert.strictEqual(ranges.length, 1);
    // Blank line before a non-indented line should not be consumed.
    assert.strictEqual(text.substring(ranges[0].from, ranges[0].to),
        'prove foo by calculation\n  x');
  });

  it('stops at a non-indented non-blank line', () => {
    const text = 'prove foo by calculation\n  x\ntheorem bar (y : Int)\n';
    const ranges = findProofRanges(text);
    assert.strictEqual(ranges.length, 1);
    assert.strictEqual(text.substring(ranges[0].from, ranges[0].to),
        'prove foo by calculation\n  x');
  });
});


describe('buildDocSections', () => {
  it('returns empty for text with no prove blocks', () => {
    const sections = buildDocSections('theorem foo (x : Int)\n| x = x\n');
    assert.strictEqual(sections.length, 0);
  });

  it('returns a section with parsed declarations and theorem', () => {
    const text = 'theorem foo (x : Int)\n| x = x\n\nprove foo\n';
    const sections = buildDocSections(text);
    assert.strictEqual(sections.length, 1);
    assert.strictEqual(sections[0].theorem?.name, 'foo');
    assert.strictEqual(sections[0].range.theoremName, 'foo');
  });

  it('returns undefined theorem when name does not match', () => {
    const text = 'theorem foo (x : Int)\n| x = x\n\nprove bar\n';
    const sections = buildDocSections(text);
    assert.strictEqual(sections.length, 1);
    assert.strictEqual(sections[0].theorem, undefined);
    assert.strictEqual(sections[0].range.theoremName, 'bar');
  });
});
