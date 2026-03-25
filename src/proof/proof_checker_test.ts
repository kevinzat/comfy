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

theorem len_zero_add (xs : List)
| 0 + len(xs) = len(xs)`;

const validNilCase =
`case nil:
  prove 0 + len(nil) = len(nil) by calculation
  0 + len(nil)
  defof len_1 => 0 + 0
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
  = 1 + len(L) since 1
  ---
  len(cons(a, L))
  undef len_2 = 1 + len(L)`;


describe('proof_checker errors', function() {

  it('reports bad forward rule with line number', function() {
    const source = `${preamble}

prove len_zero_add by induction on xs

case nil:
  prove 0 + len(nil) = len(nil) by calculation
  0 + len(nil)
  = 999

${validConsCase}`;
    checkFails(source, 17, /algebra/);
  });

  it('reports bad backward rule with line number', function() {
    const source = `${preamble}

prove len_zero_add by induction on xs

case nil:
  prove 0 + len(nil) = len(nil) by calculation
  0 + len(nil)
  defof len_1 => 0 + 0
  = 0
  ---
  len(nil)
  = 999

${validConsCase}`;
    checkFails(source, 21, /syntax error/);
  });

  it('reports wrong explicit result in forward rule', function() {
    const source = `${preamble}

prove len_zero_add by induction on xs

case nil:
  prove 0 + len(nil) = len(nil) by calculation
  0 + len(nil)
  defof len_1 => 999
  ---
  len(nil)
  undef len_1 = 0

${validConsCase}`;
    checkFails(source, 17, /cannot be produced/);
  });

  it('reports wrong start expression', function() {
    const source = `${preamble}

prove len_zero_add by induction on xs

case nil:
  prove 0 + len(nil) = len(nil) by calculation
  999
  ---
  len(nil)

${validConsCase}`;
    checkFails(source, 16, /expected 0 \+ len\(nil\), got 999/);
  });

  it('reports incomplete proof', function() {
    const source = `${preamble}

prove len_zero_add by induction on xs

case nil:
  prove 0 + len(nil) = len(nil) by calculation
  0 + len(nil)
  defof len_1 => 0 + 0

${validConsCase}`;
    checkFails(source, 17, /incomplete/);
  });

  it('reports wrong number of induction cases', function() {
    const source = `${preamble}

prove len_zero_add by induction on xs

${validNilCase}`;
    checkFails(source, 15, /expected 2 cases, got 1/);
  });

  it('reports mismatched induction goal', function() {
    const source = `${preamble}

prove len_zero_add by induction on xs

case nil:
  prove 0 + len(nil) = 999 by calculation

${validConsCase}`;
    checkFails(source, 15, /stated goal.*does not match/);
  });

  it('reports wrong operator on non-algebra step', function() {
    const source = `type List
| nil : List
| cons : (Int, List) -> List

def len : (List) -> Int
| len(nil) => 0
| len(cons(a, L)) => 1 + len(L)

theorem foo (xs : List)
| xs = nil => len(xs) <= 0

prove foo by calculation
  len(xs)
  subst 1 < len(nil)`;
    checkFails(source, 14, /expected operator </);
  });

  it('accepts a valid simple calculation', function() {
    const source = `theorem comm (x, y : Int)
| x + y = y + x

prove comm by calculation
  x + y
  = y + x`;
    check(source);
  });

  it('accepts a valid inequality proof', function() {
    const source = `theorem foo (x, y : Int)
| x < x + 2

prove foo by calculation
  x
  < x + 1
  <= x + 2`;
    check(source);
  });

  it('accepts a proof using a given fact (premise)', function() {
    const source = `theorem foo (x : Int)
| x = 3 => x + 1 = 4

prove foo by calculation
  x + 1
  = 3 + 1 since 1
  = 4`;
    check(source);
  });

  it('rejects unknown theorem name', function() {
    const source = `theorem foo (x : Int)
| x = x

prove bar by calculation
  x`;
    checkFails(source, 4, /unknown theorem/);
  });

  it('rejects cases condition with = operator', function() {
    const source = `theorem foo (x : Int)
| x = x

prove foo by cases on x = 0

case then:
  prove x = x by calculation
  x

case else:
  prove x = x by calculation
  x`;
    checkFails(source, 4, /cases condition must use < or <=/);
  });
});


describe('proof_file parse errors', function() {

  it('rejects missing prove statement', function() {
    parseFails(`theorem foo (x : Int)\n| x = x`, 2, /missing "prove"/);
  });

  it('rejects malformed prove line', function() {
    parseFails(`theorem foo (x : Int)\n| x = x\nprove foo`, 3, /expected "prove <name> by <method>"/);
  });

  it('rejects unknown proof method', function() {
    parseFails(`theorem foo (x : Int)\n| x = x\nprove foo by magic`, 3, /expected "calculation"/);
  });

  it('rejects induction with no cases', function() {
    const source = `${preamble}

prove len_zero_add by induction on xs`;
    parseFails(source, 12, /no cases/);
  });

  it('rejects bad declarations', function() {
    parseFails(`type = bad\n\ntheorem foo (x : Int)\n| x = x\nprove foo by calculation`, 1, /declaration error/);
  });

  it('rejects non-algebra rule without operator separator', function() {
    parseFails(`theorem foo (x, y : Int)\n| x + y = y + x\nprove foo by calculation\n  x + y\n  defof bar`, 5, /expected.*<rule> =/);
  });
});
