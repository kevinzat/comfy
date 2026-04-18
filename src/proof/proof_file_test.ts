import * as assert from 'assert';
import { parseProofFile, parseParams, ParseError, ProofFile, ParseResult } from './proof_file';

/** Extract the first proof entry from a ProofFile. */
function firstProof(pf: ProofFile) {
  const item = pf.items.find(i => i.kind === 'proof');
  if (!item || item.kind !== 'proof') throw new Error('no proof found');
  return item.entry;
}

/** Parse and assert no errors. */
function parseOk(source: string): ProofFile {
  const result = parseProofFile(source);
  assert.deepStrictEqual(result.errors, [],
      `expected no errors, got: ${result.errors.map(e => e.message).join(', ')}`);
  return result.file;
}

/** Parse and assert at least one error matches. */
function parseHasError(source: string, lineNum: number, pattern: RegExp): ParseResult {
  const result = parseProofFile(source);
  const match = result.errors.find(e => e.line === lineNum && pattern.test(e.message));
  assert.ok(match,
      `expected error on line ${lineNum} matching ${pattern}, got: [${
        result.errors.map(e => `line ${e.line}: ${e.message}`).join(', ')}]`);
  return result;
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
    const pf = parseOk('prove foo by calculation\n  x\n  = x');
    assert.strictEqual(firstProof(pf).theoremName, 'foo');
    assert.ok(!pf.items.some(i => i.kind === 'decls'));
  });

  it('returns error on missing prove', () => {
    parseHasError('', 1, /missing "prove"/);
  });

  it('returns error on unknown proof method', () => {
    parseHasError('prove foo by magic', 1, /expected "calculation"/);
  });

  it('parses top-level givens', () => {
    const source = [
      'prove foo by calculation',
      '  given 1. x = y',
      '    x',
      '    = x',
    ].join('\n');
    const pf = parseOk(source);
    assert.strictEqual(firstProof(pf).givens.length, 1);
    assert.strictEqual(firstProof(pf).givens[0].index, 1);
    assert.strictEqual(firstProof(pf).givens[0].prop.to_string(), 'x = y');
  });

  it('returns error on unrecognized calc rule but keeps good steps', () => {
    const source = [
      'prove foo by calculation',
      '    x',
      '    badrule here',
      '    = y',
    ].join('\n');
    const result = parseHasError(source, 3, /unrecognized rule/);
    const proof = firstProof(result.file).proof;
    assert.strictEqual(proof.kind, 'calculate');
    if (proof.kind === 'calculate') {
      // The good step "= y" should still be parsed
      assert.strictEqual(proof.forwardSteps.length, 1);
    }
  });

  it('parses cases proof with no case blocks (EOF)', () => {
    const source = 'prove foo by simple cases on x > 0';
    const pf = parseOk(source);
    const proof = firstProof(pf).proof;
    assert.strictEqual(proof.kind, 'tactic');
    if (proof.kind === 'tactic') {
      assert.strictEqual(proof.cases.length, 0);
    }
  });

  it('parses cases proof with non-case line after method', () => {
    const source = [
      'prove foo by simple cases on x > 0',
      '  not a case',
    ].join('\n');
    const pf = parseOk(source);
    const proof = firstProof(pf).proof;
    assert.strictEqual(proof.kind, 'tactic');
    if (proof.kind === 'tactic') {
      assert.strictEqual(proof.cases.length, 0);
    }
  });

  it('returns error on bad case header (no colon)', () => {
    const source = [
      'prove foo by induction on n',
      '  case zero',
    ].join('\n');
    parseHasError(source, 2, /expected "case <label>:"/);
  });

  it('returns error on missing prove after case header', () => {
    const source = [
      'prove foo by induction on n',
      '  case zero:',
    ].join('\n');
    const result = parseHasError(source, 2, /expected "prove" after case header/);
    // Should still produce a case block with an incomplete proof
    const proof = firstProof(result.file).proof;
    assert.strictEqual(proof.kind, 'tactic');
    if (proof.kind === 'tactic') {
      assert.strictEqual(proof.cases.length, 1);
      assert.strictEqual(proof.cases[0].proof.kind, 'none');
    }
  });

  it('accepts prove without method in case block as incomplete', () => {
    const source = [
      'prove foo by induction on n',
      '  case zero:',
      '  prove a = a',
    ].join('\n');
    const pf = parseOk(source);
    const proof = firstProof(pf).proof;
    assert.strictEqual(proof.kind, 'tactic');
    if (proof.kind === 'tactic') {
      assert.strictEqual(proof.cases.length, 1);
      assert.strictEqual(proof.cases[0].goal.to_string(), 'a = a');
      assert.strictEqual(proof.cases[0].proof.kind, 'none');
    }
  });

  it('returns error on bad IH premise', () => {
    const source = [
      'prove foo by induction on n',
      '  case succ:',
      '  given IH : ??? => x = x',
      '  prove x = x by calculation',
      '    x',
      '    = x',
    ].join('\n');
    parseHasError(source, 3, /bad IH premise/);
  });

  it('parses case block with givens', () => {
    const source = [
      'prove foo by simple cases on 0 < x',
      '  case then:',
      '  given 1. 0 < x',
      '  prove x = x by calculation',
      '    x',
      '    = x',
      '  case else:',
      '  given 1. not (0 < x)',
      '  prove x = x by calculation',
      '    x',
      '    = x',
    ].join('\n');
    const pf = parseOk(source);
    const proof = firstProof(pf).proof;
    assert.strictEqual(proof.kind, 'tactic');
    if (proof.kind === 'tactic') {
      assert.strictEqual(proof.cases[0].givens.length, 1);
      assert.strictEqual(proof.cases[1].givens.length, 1);
    }
  });

  it('parses IH with premises', () => {
    const source = [
      'prove foo by induction on n',
      '  case zero:',
      '  prove 0 = 0 by calculation',
      '    0',
      '    = 0',
      '  case succ:',
      '  given IH : n = n => f(n) = f(n)',
      '  prove f(n + 1) = f(n + 1) by calculation',
      '    f(n + 1)',
      '    = f(n + 1)',
    ].join('\n');
    const pf = parseOk(source);
    const proof = firstProof(pf).proof;
    assert.strictEqual(proof.kind, 'tactic');
    if (proof.kind === 'tactic') {
      assert.strictEqual(proof.cases[1].ihTheorems.length, 1);
      assert.strictEqual(proof.cases[1].ihTheorems[0].premises.length, 1);
    }
  });

  it('parses IH without premises', () => {
    const source = [
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
    ].join('\n');
    const pf = parseOk(source);
    const proof = firstProof(pf).proof;

    if (proof.kind === 'tactic') {
      assert.strictEqual(proof.cases[1].ihTheorems[0].premises.length, 0);
    }
  });

  it('parses induction with no cases', () => {
    const source = [
      'prove foo by induction on n',
      '  not a case line',
    ].join('\n');
    const pf = parseOk(source);
    const proof = firstProof(pf).proof;
    assert.strictEqual(proof.kind, 'tactic');
    if (proof.kind === 'tactic') {
      assert.strictEqual(proof.cases.length, 0);
    }
  });

  it('stops induction parsing at non-case line', () => {
    const source = [
      'prove foo by induction on n',
      '  case zero:',
      '  prove 0 = 0 by calculation',
      '    0',
      '    = 0',
    ].join('\n');
    const pf = parseOk(source);
    const proof = firstProof(pf).proof;
    assert.strictEqual(proof.kind, 'tactic');
    if (proof.kind === 'tactic') {
      assert.strictEqual(proof.cases.length, 1);
    }
  });

  it('parses induction with argNames', () => {
    const source = [
      'prove foo by induction on n (a, b)',
      '  case zero:',
      '  prove 0 = 0 by calculation',
      '    0',
      '    = 0',
    ].join('\n');
    const pf = parseOk(source);
    const proof = firstProof(pf).proof;
    assert.strictEqual(proof.kind, 'tactic');
    if (proof.kind === 'tactic') {
      assert.strictEqual(proof.method, 'induction on n (a, b)');
    }
  });

  it('parses backward calc section', () => {
    const source = [
      'prove foo by calculation',
      '    x',
      '    = y',
      '    ---',
      '    z',
      '    = y',
    ].join('\n');
    const pf = parseOk(source);
    const proof = firstProof(pf).proof;

    if (proof.kind === 'calculate') {
      assert.ok(proof.backwardStart !== null);
    }
  });

  it('parses cases proof with one case block', () => {
    const source = [
      'prove foo by simple cases on x > 0',
      '  case then:',
      '  prove x = x by calculation',
      '    x',
      '    = x',
    ].join('\n');
    const pf = parseOk(source);
    const proof = firstProof(pf).proof;
    assert.strictEqual(proof.kind, 'tactic');
    if (proof.kind === 'tactic') {
      assert.strictEqual(proof.cases.length, 1);
    }
  });

  it('parses multiple proofs in one file', () => {
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
    const pf = parseOk(source);
    const proofs = pf.items.filter(i => i.kind === 'proof');
    assert.strictEqual(proofs.length, 2);
    assert.strictEqual((proofs[0] as any).entry.theoremName, 'foo');
    assert.strictEqual((proofs[1] as any).entry.theoremName, 'bar');
  });

  // --- Incomplete proof recovery tests ---

  it('parses prove with no method as incomplete', () => {
    const source = 'prove foo';
    const result = parseProofFile(source);
    assert.strictEqual(result.errors.length, 0);
    const proof = firstProof(result.file).proof;
    assert.strictEqual(proof.kind, 'none');
  });

  it('parses prove with bad method as incomplete with error', () => {
    const source = 'prove foo by magic';
    const result = parseHasError(source, 1, /expected "calculation"/);
    const proof = firstProof(result.file).proof;
    assert.strictEqual(proof.kind, 'none');
  });

  it('parses empty calculation body', () => {
    const source = 'prove foo by calculation';
    const pf = parseOk(source);
    const proof = firstProof(pf).proof;
    assert.strictEqual(proof.kind, 'calculate');
    if (proof.kind === 'calculate') {
      assert.strictEqual(proof.forwardStart, null);
      assert.strictEqual(proof.forwardSteps.length, 0);
    }
  });

  it('parses calculation with only forward start (no steps)', () => {
    const source = [
      'prove foo by calculation',
      '  x + y',
    ].join('\n');
    const pf = parseOk(source);
    const proof = firstProof(pf).proof;
    assert.strictEqual(proof.kind, 'calculate');
    if (proof.kind === 'calculate') {
      assert.strictEqual(proof.forwardStart!.text, 'x + y');
      assert.strictEqual(proof.forwardSteps.length, 0);
    }
  });

  it('parses algebra steps without spaces around operators', () => {
    const source = [
      'prove foo by calculation',
      '  x',
      '  =2*x-x+y',
      '  =y+x',
      '  ---',
      '  z',
      '  2*y-y+x=',
      '  y+x=',
    ].join('\n');
    const pf = parseOk(source);
    const proof = firstProof(pf).proof;
    assert.strictEqual(proof.kind, 'calculate');
    if (proof.kind === 'calculate') {
      assert.strictEqual(proof.forwardSteps.length, 2);
      assert.strictEqual(proof.forwardSteps[0].ruleText, '=2*x-x+y');
      assert.strictEqual(proof.forwardSteps[1].ruleText, '=y+x');
      assert.strictEqual(proof.backwardSteps!.length, 2);
      assert.strictEqual(proof.backwardSteps[0].ruleText, '2*y-y+x=');
      assert.strictEqual(proof.backwardSteps[1].ruleText, 'y+x=');
    }
  });

  it('skips bad calc step and continues parsing good steps', () => {
    const source = [
      'prove foo by calculation',
      '    x',
      '    = y',
      '    garbage line',
      '    = z',
    ].join('\n');
    const result = parseHasError(source, 4, /unrecognized rule/);
    const proof = firstProof(result.file).proof;
    assert.strictEqual(proof.kind, 'calculate');
    if (proof.kind === 'calculate') {
      assert.strictEqual(proof.forwardSteps.length, 2);
      assert.strictEqual(proof.forwardSteps[0].ruleText, '= y');
      assert.strictEqual(proof.forwardSteps[1].ruleText, '= z');
    }
  });

  it('recovers from missing prove in case block at EOF', () => {
    const source = [
      'prove foo by induction on n',
      '  case zero:',
    ].join('\n');
    const result = parseHasError(source, 2, /expected "prove" after case header/);
    const proof = firstProof(result.file).proof;
    assert.strictEqual(proof.kind, 'tactic');
    if (proof.kind === 'tactic') {
      assert.strictEqual(proof.cases.length, 1);
      assert.strictEqual(proof.cases[0].label, 'zero');
      assert.strictEqual(proof.cases[0].proof.kind, 'none');
    }
  });

  it('parses incomplete and complete cases together', () => {
    const source = [
      'prove foo by induction on n',
      '  case zero:',
      '  prove a = a',
      '  case succ:',
      '  prove x = x by calculation',
      '    x',
      '    = x',
    ].join('\n');
    const pf = parseOk(source);
    const proof = firstProof(pf).proof;
    assert.strictEqual(proof.kind, 'tactic');
    if (proof.kind === 'tactic') {
      assert.strictEqual(proof.cases.length, 2);
      assert.strictEqual(proof.cases[0].proof.kind, 'none');
      assert.strictEqual(proof.cases[1].proof.kind, 'calculate');
    }
  });

  it('returns error on malformed prove line and skips body', () => {
    const source = [
      'prove foo bar',
      '  some indented body',
      'prove baz by calculation',
      '  x',
      '  = x',
    ].join('\n');
    const result = parseHasError(source, 1, /expected "prove <name>"/);
    // Should skip the malformed prove and its body, then parse the next proof
    const proofs = result.file.items.filter(i => i.kind === 'proof');
    assert.strictEqual(proofs.length, 1);
    assert.strictEqual((proofs[0] as any).entry.theoremName, 'baz');
  });

  it('file with only declarations and no prove returns empty proofs', () => {
    const source = [
      'theorem foo (x : Int)',
      '| x = x',
    ].join('\n');
    const result = parseHasError(source, 2, /missing "prove"/);
    assert.ok(result.file.items.some(i => i.kind === 'decls'));
    assert.ok(!result.file.items.some(i => i.kind === 'proof'));
  });

  it('declaration error points to bad token line, not decls block start', () => {
    // Theorem keyword on line 3, bad `=>` on line 4.
    const source = [
      'type Bool',          // 1
      '| yes : Bool',       // 2
      'theorem foo (x : Int)', // 3
      '| head(x) => x',     // 4 — bad `=>` (theorem uses `=`, not `=>`)
    ].join('\n');
    const result = parseProofFile(source);
    const declErr = result.errors.find(e => /declaration error/.test(e.message));
    assert.ok(declErr, `expected declaration error, got: [${
        result.errors.map(e => `line ${e.line}: ${e.message}`).join(', ')}]`);
    assert.equal(declErr!.line, 4,
        `expected error on line 4, got line ${declErr!.line}: ${declErr!.message}`);
    assert.ok(!/line \d+ col \d+/.test(declErr!.message),
        `message should not repeat line/col, got: ${declErr!.message}`);
  });
});
