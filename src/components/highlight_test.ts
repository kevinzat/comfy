import * as assert from 'assert';
import {
  highlightDecls,
  highlightTheorem,
  highlightCode,
  highlightCodeWithBadges,
  highlightTheoremWithBadges,
} from './highlight';


describe('highlightDecls', function() {

  it('highlights keywords with rust color', function() {
    const out = highlightDecls('type');
    assert.ok(out.includes('#ce9178'));
    assert.ok(out.includes('type'));
  });

  it('highlights all decl keywords', function() {
    for (const kw of ['type', 'def', 'theorem', 'if', 'then', 'else']) {
      const out = highlightDecls(kw);
      assert.ok(out.includes(kw), `missing keyword: ${kw}`);
      assert.ok(out.includes('#ce9178'), `missing color for keyword: ${kw}`);
    }
  });

  it('highlights uppercase identifiers (types) with amber', function() {
    const out = highlightDecls('List');
    assert.ok(out.includes('#d4a96a'));
    assert.ok(out.includes('List'));
  });

  it('highlights numbers with amber', function() {
    const out = highlightDecls('42');
    assert.ok(out.includes('#d4a96a'));
    assert.ok(out.includes('42'));
  });

  it('highlights -> operator', function() {
    const out = highlightDecls('->');
    assert.ok(out.includes('#a07850'));
  });

  it('highlights => operator', function() {
    const out = highlightDecls('=>');
    assert.ok(out.includes('#a07850'));
  });

  it('highlights <= operator', function() {
    const out = highlightDecls('<=');
    assert.ok(out.includes('#a07850'));
  });

  it('highlights single-char operators', function() {
    for (const op of ['|', ':', '=', '<', '(', ')', ',', '^', '*', '+', '-']) {
      const out = highlightDecls(op);
      assert.ok(out.includes('#a07850'), `missing color for op: ${op}`);
    }
  });

  it('leaves lowercase identifiers plain', function() {
    const out = highlightDecls('foo');
    assert.ok(!out.includes('<span'), 'expected no span for plain identifier');
    assert.ok(out.includes('foo'));
  });

  it('escapes HTML special characters', function() {
    const out = highlightDecls('a < b & c > d');
    assert.ok(out.includes('&lt;'));
    assert.ok(out.includes('&amp;'));
    assert.ok(out.includes('&gt;'));
  });

  it('handles a full declaration line', function() {
    const out = highlightDecls('type List | nil : List | cons : (Int, List) -> List');
    assert.ok(out.includes('type'));
    assert.ok(out.includes('List'));
    assert.ok(out.includes('nil'));
  });

  it('handles empty string', function() {
    assert.strictEqual(highlightDecls(''), '');
  });

});


describe('highlightTheorem', function() {

  it('highlights theorem keyword with deep terracotta', function() {
    const out = highlightTheorem('theorem');
    assert.ok(out.includes('#b06040'));
    assert.ok(out.includes('theorem'));
  });

  it('highlights other keywords with rust color', function() {
    const out = highlightTheorem('type');
    assert.ok(out.includes('#ce9178'));
  });

  it('highlights theorem keyword differently from other keywords', function() {
    const thmOut = highlightTheorem('theorem');
    const typeOut = highlightTheorem('type');
    assert.ok(thmOut.includes('#b06040'));
    assert.ok(typeOut.includes('#ce9178'));
    assert.ok(!typeOut.includes('#b06040'));
  });

  it('highlights types with amber', function() {
    const out = highlightTheorem('Int');
    assert.ok(out.includes('#d4a96a'));
  });

  it('highlights numbers with amber', function() {
    const out = highlightTheorem('42');
    assert.ok(out.includes('#d4a96a'));
  });

  it('highlights => operator', function() {
    const out = highlightTheorem('=>');
    assert.ok(out.includes('#a07850'));
  });

  it('leaves lowercase plain', function() {
    const out = highlightTheorem('x');
    assert.ok(!out.includes('<span'));
  });

  it('handles a full theorem line', function() {
    const out = highlightTheorem('theorem foo (x : Int) | x = 0');
    assert.ok(out.includes('#b06040'));
    assert.ok(out.includes('foo'));
  });

});


describe('highlightCode', function() {

  it('highlights while keyword', function() {
    const out = highlightCode('while');
    assert.ok(out.includes('#4a6fa5'));
  });

  it('highlights if keyword', function() {
    const out = highlightCode('if');
    assert.ok(out.includes('#4a6fa5'));
  });

  it('highlights else keyword', function() {
    const out = highlightCode('else');
    assert.ok(out.includes('#4a6fa5'));
  });

  it('highlights pass keyword', function() {
    const out = highlightCode('pass');
    assert.ok(out.includes('#4a6fa5'));
  });

  it('highlights return keyword', function() {
    const out = highlightCode('return');
    assert.ok(out.includes('#4a6fa5'));
  });

  it('highlights type names with amber', function() {
    const out = highlightCode('Int');
    assert.ok(out.includes('#d4a96a'));
  });

  it('highlights numbers with amber', function() {
    const out = highlightCode('10');
    assert.ok(out.includes('#d4a96a'));
  });

  it('highlights == operator', function() {
    const out = highlightCode('==');
    assert.ok(out.includes('#a07850'));
  });

  it('highlights != operator', function() {
    const out = highlightCode('!=');
    assert.ok(out.includes('#a07850'));
  });

  it('highlights <= operator', function() {
    const out = highlightCode('<=');
    assert.ok(out.includes('#a07850'));
  });

  it('highlights >= operator', function() {
    const out = highlightCode('>=');
    assert.ok(out.includes('#a07850'));
  });

  it('highlights single-char operators', function() {
    for (const op of ['=', '<', '>', '(', ')', ',', ';', '^', '*', '+', '-']) {
      const out = highlightCode(op);
      assert.ok(out.includes('#a07850'), `missing color for: ${op}`);
    }
  });

  it('highlights braces with grey', function() {
    for (const brace of ['{', '}']) {
      const out = highlightCode(brace);
      assert.ok(out.includes('#707070'), `missing brace color for: ${brace}`);
    }
  });

  it('leaves lowercase identifiers plain', function() {
    const out = highlightCode('foo');
    assert.ok(!out.includes('<span'));
    assert.ok(out.includes('foo'));
  });

  it('handles a realistic code snippet', function() {
    const out = highlightCode('while (n > 0) {');
    assert.ok(out.includes('while'));
    assert.ok(out.includes('4a6fa5'));
    assert.ok(out.includes('707070'));
  });

  it('handles empty string', function() {
    assert.strictEqual(highlightCode(''), '');
  });

  it('does not highlight "whileX" as keyword', function() {
    const out = highlightCode('whileX');
    assert.ok(!out.includes('#4a6fa5'));
  });

});


describe('highlightCodeWithBadges', function() {

  it('returns plain highlighted lines when no badges', function() {
    const code = 'Int x = 1;\nreturn x;';
    const out = highlightCodeWithBadges(code, new Map());
    assert.ok(out.includes('return'));
    assert.ok(!out.includes('background:#b06000'));
  });

  it('injects badge on specified line', function() {
    const code = 'return x;';
    const badges = new Map([[1, [1]]]);
    const out = highlightCodeWithBadges(code, badges);
    assert.ok(out.includes('background:#b06000'));
    assert.ok(out.includes('\u2460'));  // ①
  });

  it('uses circled digit for obligation numbers 1-20', function() {
    const code = 'return x;';
    for (let n = 1; n <= 20; n++) {
      const badges = new Map([[1, [n]]]);
      const out = highlightCodeWithBadges(code, badges);
      const expected = String.fromCodePoint(0x245F + n);
      assert.ok(out.includes(expected), `missing circled ${n}`);
    }
  });

  it('uses (n) notation for obligation numbers > 20', function() {
    const code = 'return x;';
    const badges = new Map([[1, [21]]]);
    const out = highlightCodeWithBadges(code, badges);
    assert.ok(out.includes('(21)'));
  });

  it('injects badges on multiple lines', function() {
    const code = 'Int x = 1;\nreturn x;';
    const badges = new Map([[1, [1]], [2, [2]]]);
    const out = highlightCodeWithBadges(code, badges);
    assert.ok(out.includes('\u2460'));  // ①
    assert.ok(out.includes('\u2461'));  // ②
  });

  it('injects multiple badges on the same line', function() {
    const code = 'return x;';
    const badges = new Map([[1, [1, 2]]]);
    const out = highlightCodeWithBadges(code, badges);
    assert.ok(out.includes('\u2460'));
    assert.ok(out.includes('\u2461'));
  });

  it('preserves newline structure', function() {
    const code = 'a;\nb;\nc;';
    const out = highlightCodeWithBadges(code, new Map());
    assert.equal(out.split('\n').length, 3);
  });

  it('skips line with empty badge array', function() {
    const code = 'return x;';
    const badges = new Map([[1, [] as number[]]]);
    const out = highlightCodeWithBadges(code, badges);
    assert.ok(!out.includes('background:#b06000'));
  });

});


describe('highlightTheoremWithBadges', function() {

  it('returns plain highlighted lines when no badges', function() {
    const code = 'theorem foo (x : Int) | x = 0';
    const out = highlightTheoremWithBadges(code, new Map());
    assert.ok(out.includes('theorem'));
    assert.ok(!out.includes('background:#b06000'));
  });

  it('injects badge on specified line', function() {
    const code = 'theorem foo (x : Int) | x = 0';
    const badges = new Map([[1, [3]]]);
    const out = highlightTheoremWithBadges(code, badges);
    assert.ok(out.includes('background:#b06000'));
    assert.ok(out.includes('\u2462'));  // ③
  });

  it('preserves newline structure', function() {
    const code = 'theorem a | x = 0\ntheorem b | y = 0';
    const out = highlightTheoremWithBadges(code, new Map());
    assert.equal(out.split('\n').length, 2);
  });

  it('injects badge on second line', function() {
    const code = 'line1\nline2';
    const badges = new Map([[2, [5]]]);
    const out = highlightTheoremWithBadges(code, badges);
    const lines = out.split('\n');
    assert.ok(!lines[0].includes('background:#b06000'));
    assert.ok(lines[1].includes('background:#b06000'));
  });

});
