import * as assert from 'assert';
import { parseProofFile, ParseError } from './proof_file';
import { checkProofFile, CheckError } from './proof_checker';


function check(source: string): void {
  const pf = parseProofFile(source);
  checkProofFile(pf);
}

function checkFails(source: string, lineNum: number, pattern: RegExp): void {
  const pf = parseProofFile(source);
  try {
    checkProofFile(pf);
    assert.fail('expected CheckError');
  } catch (e: any) {
    assert.ok(e instanceof CheckError,
        `expected CheckError, got ${e.constructor.name}: ${e.message}`);
    assert.strictEqual(e.line, lineNum,
        `expected error on line ${lineNum}, got line ${e.line}: ${e.message}`);
    assert.ok(pattern.test(e.message),
        `expected message matching ${pattern}, got: ${e.message}`);
  }
}

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

const preamble = `type List
| nil : List
| cons : (Int, List) -> List

def len : (List) -> Int
| len(nil) => 0
| len(cons(a, L)) => 1 + len(L)

var xs : List`;

const validNilCase =
`case nil:
  prove 0 + len(nil) = len(nil) by calculation
  0 + len(nil)
  defof len_1 (0 + 0) = 0 + 0
  = 0
  ---
  len(nil)
  undef len_1 = 0`;

const validConsCase =
`case cons(a, L):
  given 1. 0 + len(L) = len(L)
  prove 0 + len(cons(a, L)) = len(cons(a, L)) by calculation
  0 + len(cons(a, L))
  defof len_2 = 0 + (1 + len(L))
  = 1 + len(L) 1
  ---
  len(cons(a, L))
  undef len_2 = 1 + len(L)`;


describe('proof_checker errors', function() {

  it('reports bad forward rule with line number', function() {
    const source = `${preamble}

prove 0 + len(xs) = len(xs) by induction on xs

case nil:
  prove 0 + len(nil) = len(nil) by calculation
  0 + len(nil)
  = 999

${validConsCase}`;
    checkFails(source, 16, /algebra/);
  });

  it('reports bad backward rule with line number', function() {
    const source = `${preamble}

prove 0 + len(xs) = len(xs) by induction on xs

case nil:
  prove 0 + len(nil) = len(nil) by calculation
  0 + len(nil)
  defof len_1 (0 + 0) = 0 + 0
  = 0
  ---
  len(nil)
  = 999

${validConsCase}`;
    checkFails(source, 20, /syntax error/);
  });

  it('reports wrong expression after forward rule', function() {
    const source = `${preamble}

prove 0 + len(xs) = len(xs) by induction on xs

case nil:
  prove 0 + len(nil) = len(nil) by calculation
  0 + len(nil)
  defof len_1 (0 + 0) = 999
  ---
  len(nil)
  undef len_1 = 0

${validConsCase}`;
    checkFails(source, 16, /expected 0 \+ 0, got 999/);
  });

  it('reports wrong start expression', function() {
    const source = `${preamble}

prove 0 + len(xs) = len(xs) by induction on xs

case nil:
  prove 0 + len(nil) = len(nil) by calculation
  999
  ---
  len(nil)

${validConsCase}`;
    checkFails(source, 15, /expected 0 \+ len\(nil\), got 999/);
  });

  it('reports incomplete proof', function() {
    const source = `${preamble}

prove 0 + len(xs) = len(xs) by induction on xs

case nil:
  prove 0 + len(nil) = len(nil) by calculation
  0 + len(nil)
  defof len_1 (0 + 0) = 0 + 0

${validConsCase}`;
    checkFails(source, 16, /incomplete/);
  });

  it('reports wrong number of induction cases', function() {
    const source = `${preamble}

prove 0 + len(xs) = len(xs) by induction on xs

${validNilCase}`;
    checkFails(source, 14, /expected 2 cases, got 1/);
  });

  it('reports mismatched induction goal', function() {
    const source = `${preamble}

prove 0 + len(xs) = len(xs) by induction on xs

case nil:
  prove 0 + len(nil) = 999 by calculation

${validConsCase}`;
    checkFails(source, 14, /stated goal.*does not match/);
  });

  it('reports wrong operator on non-algebra step', function() {
    const source = `${preamble}

given 1. xs = nil

prove len(xs) <= 0 by calculation
  len(xs)
  subst 1 = len(nil)`;
    // subst with fact "xs = nil" produces =, but we stated =, so this should pass.
    // Let's test a real mismatch: state < when it's actually =.
    const badSource = `${preamble}

given 1. xs = nil

prove len(xs) <= 0 by calculation
  len(xs)
  subst 1 < len(nil)`;
    checkFails(badSource, 15, /expected operator </);
  });

  it('accepts a valid simple calculation', function() {
    const source = `prove x + y = y + x by calculation
  x + y
  = y + x`;
    check(source);
  });

  it('accepts a valid inequality proof', function() {
    const source = `var x : Int
var y : Int

prove x < x + 2 by calculation
  x
  < x + 1
  <= x + 2`;
    check(source);
  });

  it('accepts a proof using a given fact', function() {
    const source = `var x : Int

given 1. x = 3

prove x + 1 = 4 by calculation
  x + 1
  = 3 + 1 1
  = 4`;
    check(source);
  });

  it('reports bad given formula', function() {
    const source = `given 1. ??? bad

prove x = x by calculation
  x`;
    checkFails(source, 1, /bad given/);
  });

  it('rejects cases condition with = operator', function() {
    const source = `var x : Int

prove x = x by cases on x = 0

case then:
  prove x = x by calculation
  x

case else:
  prove x = x by calculation
  x`;
    checkFails(source, 3, /cases condition must use < or <=/);
  });
});


describe('proof_file parse errors', function() {

  it('rejects missing prove statement', function() {
    parseFails(`var x : Int`, 1, /missing "prove"/);
  });

  it('rejects malformed prove line', function() {
    parseFails(`prove x = x`, 1, /expected "prove <formula> by <method>"/);
  });

  it('rejects unknown proof method', function() {
    parseFails(`prove x = x by magic`, 1, /expected "calculation"/);
  });

  it('rejects induction with no cases', function() {
    const source = `${preamble}

prove 0 + len(xs) = len(xs) by induction on xs`;
    parseFails(source, 11, /no cases/);
  });

  it('rejects bad declarations', function() {
    parseFails(`type = bad\n\nprove x = x by calculation`, 1, /declaration error/);
  });

  it('rejects non-algebra rule without operator separator', function() {
    parseFails(`prove x + y = y + x by calculation
  x + y
  defof foo`, 3, /expected.*<rule> =/);
  });
});
