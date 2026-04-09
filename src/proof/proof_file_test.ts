import * as assert from 'assert';
import { parseProofFile, parseParams, ParseError } from './proof_file';


function parseFails(source: string, lineNum: number, pattern: RegExp): void {
  try {
    parseProofFile(source);
    assert.fail('expected ParseError');
  } catch (e: any) {
    assert.ok(e instanceof ParseError,
        `expected ParseError, got ${e.constructor.name}: ${e.message}`);
    assert.strictEqual(e.line, lineNum,
        `expected error on line ${lineNum}, got line ${e.line}: ${e.message}`);
    assert.ok(pattern.test(e.message),
        `expected message matching ${pattern}, got: ${e.message}`);
  }
}


describe('parseParams', () => {
  it('returns empty array for empty string', () => {
    assert.deepStrictEqual(parseParams('', 1), []);
  });

  it('parses a single group', () => {
    assert.deepStrictEqual(parseParams('(x : Int)', 1), [['x', 'Int']]);
  });

  it('parses multiple names in one group', () => {
    assert.deepStrictEqual(parseParams('(x, y : Int)', 1),
        [['x', 'Int'], ['y', 'Int']]);
  });

  it('parses multiple groups', () => {
    assert.deepStrictEqual(parseParams('(x : Int) (y : Bool)', 1),
        [['x', 'Int'], ['y', 'Bool']]);
  });

  it('fails on missing colon', () => {
    assert.throws(() => parseParams('(x Int)', 5), (e: any) => {
      assert.ok(e instanceof ParseError);
      assert.strictEqual(e.line, 5);
      assert.ok(/missing ":"/.test(e.message));
      return true;
    });
  });

  it('fails on missing type name', () => {
    assert.throws(() => parseParams('(x :)', 3), (e: any) => {
      assert.ok(e instanceof ParseError);
      assert.strictEqual(e.line, 3);
      assert.ok(/missing type name/.test(e.message));
      return true;
    });
  });

  it('fails on missing variable names', () => {
    assert.throws(() => parseParams('( : Int)', 7), (e: any) => {
      assert.ok(e instanceof ParseError);
      assert.strictEqual(e.line, 7);
      assert.ok(/missing variable names/.test(e.message));
      return true;
    });
  });
});


describe('parseProofFile', () => {
  it('parses empty preamble', () => {
    const pf = parseProofFile('prove foo by calculation\n  x\n  = x');
    assert.strictEqual(pf.theoremName, 'foo');
    assert.strictEqual(pf.decls.types.length, 0);
  });

  it('fails on missing prove', () => {
    parseFails('type Nat', 1, /missing "prove"/);
  });

  it('fails on bad prove format', () => {
    parseFails('prove foo', 1, /expected "prove <name> by <method>"/);
  });

  it('fails on unknown proof method', () => {
    parseFails('prove foo by magic', 1, /expected "calculation"/);
  });

  it('parses top-level givens', () => {
    const source = [
      'prove foo by calculation',
      'given 1. x = y',
      '  x',
      '  = x',
    ].join('\n');
    const pf = parseProofFile(source);
    assert.strictEqual(pf.givens.length, 1);
    assert.strictEqual(pf.givens[0].index, 1);
    assert.strictEqual(pf.givens[0].text, 'x = y');
  });

  it('fails on unrecognized calc rule', () => {
    const source = [
      'prove foo by calculation',
      '  x',
      '  badrule here',
    ].join('\n');
    parseFails(source, 3, /unrecognized rule/);
  });

  it('parses cases proof with no case blocks (EOF)', () => {
    const source = 'prove foo by simple cases on x > 0';
    const pf = parseProofFile(source);
    assert.strictEqual(pf.proof.kind, 'tactic');
    if (pf.proof.kind === 'tactic') {
      assert.strictEqual(pf.proof.cases.length, 0);
    }
  });

  it('parses cases proof with non-case line after method', () => {
    const source = [
      'prove foo by simple cases on x > 0',
      'not a case',
    ].join('\n');
    const pf = parseProofFile(source);
    assert.strictEqual(pf.proof.kind, 'tactic');
    if (pf.proof.kind === 'tactic') {
      assert.strictEqual(pf.proof.cases.length, 0);
    }
  });

  it('fails on bad case header (no colon)', () => {
    const source = [
      'prove foo by induction on n',
      'case zero',
    ].join('\n');
    parseFails(source, 2, /expected "case <label>:"/);
  });

  it('fails on missing prove after case header', () => {
    const source = [
      'prove foo by induction on n',
      'case zero:',
    ].join('\n');
    parseFails(source, 2, /expected "prove" after case header/);
  });

  it('fails on bad prove format in case block', () => {
    const source = [
      'prove foo by induction on n',
      'case zero:',
      'prove stuff',
    ].join('\n');
    parseFails(source, 3, /expected "prove <formula> by <method>"/);
  });

  it('fails on bad IH premise', () => {
    const source = [
      'prove foo by induction on n',
      'case succ:',
      'given IH : ??? => x = x',
      'prove x = x by calculation',
      '  x',
      '  = x',
    ].join('\n');
    parseFails(source, 3, /bad IH premise/);
  });

  it('parses case block with givens', () => {
    const source = [
      'prove foo by simple cases on x > 0',
      'case then:',
      'given 1. x > 0',
      'prove x = x by calculation',
      '  x',
      '  = x',
      'case else:',
      'given 1. not (x > 0)',
      'prove x = x by calculation',
      '  x',
      '  = x',
    ].join('\n');
    const pf = parseProofFile(source);
    assert.strictEqual(pf.proof.kind, 'tactic');
    if (pf.proof.kind === 'tactic') {
      assert.strictEqual(pf.proof.cases[0].givens.length, 1);
      assert.strictEqual(pf.proof.cases[1].givens.length, 1);
    }
  });

  it('parses IH with premises', () => {
    const source = [
      'prove foo by induction on n',
      'case zero:',
      'prove 0 = 0 by calculation',
      '  0',
      '  = 0',
      'case succ:',
      'given IH : n = n => f(n) = f(n)',
      'prove f(n + 1) = f(n + 1) by calculation',
      '  f(n + 1)',
      '  = f(n + 1)',
    ].join('\n');
    const pf = parseProofFile(source);
    assert.strictEqual(pf.proof.kind, 'tactic');
    if (pf.proof.kind === 'tactic') {
      assert.strictEqual(pf.proof.cases[1].ihTheorems.length, 1);
      assert.strictEqual(pf.proof.cases[1].ihTheorems[0].premises.length, 1);
    }
  });

  it('parses IH without premises', () => {
    const source = [
      'prove foo by induction on n',
      'case zero:',
      'prove 0 = 0 by calculation',
      '  0',
      '  = 0',
      'case succ:',
      'given IH : f(n) = f(n)',
      'prove f(n + 1) = f(n + 1) by calculation',
      '  f(n + 1)',
      '  = f(n + 1)',
    ].join('\n');
    const pf = parseProofFile(source);
    if (pf.proof.kind === 'tactic') {
      assert.strictEqual(pf.proof.cases[1].ihTheorems[0].premises.length, 0);
    }
  });

  it('parses induction with no cases', () => {
    const source = [
      'prove foo by induction on n',
      'not a case line',
    ].join('\n');
    const pf = parseProofFile(source);
    assert.strictEqual(pf.proof.kind, 'tactic');
    if (pf.proof.kind === 'tactic') {
      assert.strictEqual(pf.proof.cases.length, 0);
    }
  });

  it('stops induction parsing at non-case line', () => {
    const source = [
      'prove foo by induction on n',
      'case zero:',
      'prove 0 = 0 by calculation',
      '  0',
      '  = 0',
      '',
      'prove leftover',
    ].join('\n');
    const pf = parseProofFile(source);
    assert.strictEqual(pf.proof.kind, 'tactic');
    if (pf.proof.kind === 'tactic') {
      assert.strictEqual(pf.proof.cases.length, 1);
    }
  });

  it('parses induction with argNames', () => {
    const source = [
      'prove foo by induction on n (a, b)',
      'case zero:',
      'prove 0 = 0 by calculation',
      '  0',
      '  = 0',
    ].join('\n');
    const pf = parseProofFile(source);
    assert.strictEqual(pf.proof.kind, 'tactic');
    if (pf.proof.kind === 'tactic') {
      assert.strictEqual(pf.proof.method, 'induction on n (a, b)');
    }
  });

  it('parses backward calc section', () => {
    const source = [
      'prove foo by calculation',
      '  x',
      '  = y',
      '  ---',
      '  z',
      '  = y',
    ].join('\n');
    const pf = parseProofFile(source);
    if (pf.proof.kind === 'calculate') {
      assert.ok(pf.proof.backwardStart !== null);
    }
  });

  it('parses cases proof with one case block', () => {
    const source = [
      'prove foo by simple cases on x > 0',
      'case then:',
      'prove x = x by calculation',
      '  x',
      '  = x',
    ].join('\n');
    const pf = parseProofFile(source);
    assert.strictEqual(pf.proof.kind, 'tactic');
    if (pf.proof.kind === 'tactic') {
      assert.strictEqual(pf.proof.cases.length, 1);
    }
  });
});
