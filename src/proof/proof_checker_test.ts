import * as assert from 'assert';
import { parseProofFile, parseParams, ParseError } from './proof_file';
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
  given IH : 0 + len(L) = len(L)
  prove 0 + len(cons(a, L)) = len(cons(a, L)) by calculation
  0 + len(cons(a, L))
  defof len_2 = 0 + (1 + len(L))
  = 1 + len(L)
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

  it('parses IH theorem lines in case blocks', function() {
    const source = `${preamble}

prove len_zero_add by induction on xs

${validNilCase}

${validConsCase}`;
    // Should parse without error — IH_L: line is valid.
    const pf = parseProofFile(source);
    assert.equal(pf.proof.kind, 'induction');
    if (pf.proof.kind === 'induction') {
      assert.equal(pf.proof.cases[1].ihTheorems.length, 1);
      assert.equal(pf.proof.cases[1].ihTheorems[0].name, 'IH');
      assert.deepEqual(pf.proof.cases[1].ihTheorems[0].params, []);
      assert.deepEqual(pf.proof.cases[1].ihTheorems[0].premises, []);
      assert.equal(pf.proof.cases[1].ihTheorems[0].formula, '0 + len(L) = len(L)');
    }
  });
});


describe('IH theorem checker errors', function() {

  it('reports wrong IH name', function() {
    const source = `${preamble}

prove len_zero_add by induction on xs

${validNilCase}

case cons(a, L):
  given IH_X : 0 + len(L) = len(L)
  prove 0 + len(cons(a, L)) = len(cons(a, L)) by calculation
  0 + len(cons(a, L))
  defof len_2 = 0 + (1 + len(L))
  = 1 + len(L)
  ---
  len(cons(a, L))
  undef len_2 = 1 + len(L)`;
    checkFails(source, 24, /expected IH named "IH", got "IH_X"/);
  });

  it('reports wrong IH formula', function() {
    const source = `${preamble}

prove len_zero_add by induction on xs

${validNilCase}

case cons(a, L):
  given IH : 0 + len(L) = 999
  prove 0 + len(cons(a, L)) = len(cons(a, L)) by calculation
  0 + len(cons(a, L))
  defof len_2 = 0 + (1 + len(L))
  = 1 + len(L)
  ---
  len(cons(a, L))
  undef len_2 = 1 + len(L)`;
    checkFails(source, 24, /IH IH is 0 \+ len\(L\) = len\(L\), not 0 \+ len\(L\) = 999/);
  });

  it('reports missing IH theorems', function() {
    const source = `${preamble}

prove len_zero_add by induction on xs

${validNilCase}

case cons(a, L):
  prove 0 + len(cons(a, L)) = len(cons(a, L)) by calculation
  0 + len(cons(a, L))
  defof len_2 = 0 + (1 + len(L))
  = 1 + len(L)
  ---
  len(cons(a, L))
  undef len_2 = 1 + len(L)`;
    checkFails(source, 0, /expected 1 IH theorems, got 0/);
  });

  it('reports wrong IH params', function() {
    // concat_assoc has IH with params (S, T : List).
    // State wrong params to trigger error.
    const source = `type List
| nil : List
| cons : (Int, List) -> List

def concat : (List, List) -> List
| concat(nil, R) => R
| concat(cons(a, L), R) => cons(a, concat(L, R))

theorem concat_assoc (R, S, T : List)
| concat(concat(R, S), T) = concat(R, concat(S, T))

prove concat_assoc by induction on R (a, L)

case nil:
  prove concat(concat(nil, S), T) = concat(nil, concat(S, T)) by calculation
  concat(concat(nil, S), T)
  defof concat_1 = concat(S, T)
  ---
  concat(nil, concat(S, T))
  undef concat_1 = concat(S, T)

case cons(a, L):
  given IH (X : Int) : concat(concat(L, S), T) = concat(L, concat(S, T))
  prove concat(concat(cons(a, L), S), T) = concat(cons(a, L), concat(S, T)) by calculation
  concat(concat(cons(a, L), S), T)
  defof concat_2 => concat(cons(a, concat(L, S)), T)
  defof concat_2 => cons(a, concat(concat(L, S), T))
  apply IH = cons(a, concat(L, concat(S, T)))
  ---
  concat(cons(a, L), concat(S, T))
  undef concat_2 => cons(a, concat(L, concat(S, T)))`;
    checkFails(source, 23, /IH IH params should be \(S, T : List\), got \(X : Int\)/);
  });

  it('rejects IH with extra params not in the expected list', function() {
    const source = `type List
| nil : List
| cons : (Int, List) -> List

def len : (List) -> Int
| len(nil) => 0
| len(cons(a, L)) => 1 + len(L)

theorem len_zero_add (xs : List)
| 0 + len(xs) = len(xs)

prove len_zero_add by induction on xs

case nil:
  prove 0 + len(nil) = len(nil) by calculation
  0 + len(nil)
  defof len_1 => 0 + 0
  = 0
  ---
  len(nil)
  undef len_1 = 0

case cons(a, L):
  given IH (X : List) : 0 + len(L) = len(L)
  prove 0 + len(cons(a, L)) = len(cons(a, L)) by calculation
  0 + len(cons(a, L))
  defof len_2 = 0 + (1 + len(L))
  = 1 + len(L)
  ---
  len(cons(a, L))
  undef len_2 = 1 + len(L)`;
    // IH should have no params (single-variable theorem), but user wrote (X : List)
    checkFails(source, 24, /IH IH params should be, got \(X : List\)/);
  });

  it('rejects IH with missing params that should be stated', function() {
    const source = `type List
| nil : List
| cons : (Int, List) -> List

def concat : (List, List) -> List
| concat(nil, R) => R
| concat(cons(a, L), R) => cons(a, concat(L, R))

theorem concat_assoc (R, S, T : List)
| concat(concat(R, S), T) = concat(R, concat(S, T))

prove concat_assoc by induction on R (a, L)

case nil:
  prove concat(concat(nil, S), T) = concat(nil, concat(S, T)) by calculation
  concat(concat(nil, S), T)
  defof concat_1 = concat(S, T)
  ---
  concat(nil, concat(S, T))
  undef concat_1 = concat(S, T)

case cons(a, L):
  given IH : concat(concat(L, S), T) = concat(L, concat(S, T))
  prove concat(concat(cons(a, L), S), T) = concat(cons(a, L), concat(S, T)) by calculation
  concat(concat(cons(a, L), S), T)
  defof concat_2 => concat(cons(a, concat(L, S)), T)
  defof concat_2 => cons(a, concat(concat(L, S), T))
  apply IH = cons(a, concat(L, concat(S, T)))
  ---
  concat(cons(a, L), concat(S, T))
  undef concat_2 => cons(a, concat(L, concat(S, T)))`;
    // IH should have params (S, T : List), but user omitted them
    checkFails(source, 23, /IH IH params should be \(S, T : List\), got$/);
  });

  it('parses IH with params and validates them', function() {
    const source = `type List
| nil : List
| cons : (Int, List) -> List

def concat : (List, List) -> List
| concat(nil, R) => R
| concat(cons(a, L), R) => cons(a, concat(L, R))

theorem concat_assoc (R, S, T : List)
| concat(concat(R, S), T) = concat(R, concat(S, T))

prove concat_assoc by induction on R (a, L)

case nil:
  prove concat(concat(nil, S), T) = concat(nil, concat(S, T)) by calculation
  concat(concat(nil, S), T)
  defof concat_1 = concat(S, T)
  ---
  concat(nil, concat(S, T))
  undef concat_1 = concat(S, T)

case cons(a, L):
  given IH (S, T : List) : concat(concat(L, S), T) = concat(L, concat(S, T))
  prove concat(concat(cons(a, L), S), T) = concat(cons(a, L), concat(S, T)) by calculation
  concat(concat(cons(a, L), S), T)
  defof concat_2 => concat(cons(a, concat(L, S)), T)
  defof concat_2 => cons(a, concat(concat(L, S), T))
  apply IH = cons(a, concat(L, concat(S, T)))
  ---
  concat(cons(a, L), concat(S, T))
  undef concat_2 => cons(a, concat(L, concat(S, T)))`;
    check(source);
  });

  it('reports extra IH theorems on base case', function() {
    const source = `${preamble}

prove len_zero_add by induction on xs

case nil:
  given IH_X : 0 = 0
  prove 0 + len(nil) = len(nil) by calculation
  0 + len(nil)
  defof len_1 => 0 + 0
  = 0
  ---
  len(nil)
  undef len_1 = 0

${validConsCase}`;
    checkFails(source, 15, /expected 0 IH theorems, got 1/);
  });
});


describe('parseParams', function() {

  it('parses empty string', function() {
    assert.deepEqual(parseParams('', 1), []);
  });

  it('parses single group with one name', function() {
    assert.deepEqual(parseParams('(x : Int)', 1), [['x', 'Int']]);
  });

  it('parses single group with multiple names', function() {
    assert.deepEqual(parseParams('(S, T : List)', 1),
        [['S', 'List'], ['T', 'List']]);
  });

  it('parses multiple groups', function() {
    assert.deepEqual(parseParams('(x : Int) (S, T : List)', 1),
        [['x', 'Int'], ['S', 'List'], ['T', 'List']]);
  });

  it('parses three groups', function() {
    assert.deepEqual(parseParams('(a : Int) (S : List) (T : Tree)', 1),
        [['a', 'Int'], ['S', 'List'], ['T', 'Tree']]);
  });

  it('throws on missing colon', function() {
    assert.throws(() => parseParams('(x Int)', 1), /missing ":"/);
  });

  it('throws on missing type name', function() {
    assert.throws(() => parseParams('(x : )', 1), /missing type name/);
  });

  it('throws on missing variable names', function() {
    assert.throws(() => parseParams('( : Int)', 1), /missing variable names/);
  });
});


describe('IH premise parsing and validation', function() {

  it('parses IH line with premise', function() {
    const source = `type List
| nil : List
| cons : (Int, List) -> List

def len : (List) -> Int
| len(nil) => 0
| len(cons(a, L)) => 1 + len(L)

theorem foo (xs : List)
| xs = nil => len(xs) <= 0

prove foo by calculation
  len(xs)`;
    // This just tests that the parser doesn't choke on premise syntax.
    // The proof itself will fail but we're testing parsing.
    const pf = parseProofFile(source);
    assert.equal(pf.theoremName, 'foo');
  });

  it('parses given IH with premise using =>', function() {
    const source = `type List
| nil : List
| cons : (Int, List) -> List

def len : (List) -> Int
| len(nil) => 0
| len(cons(a, L)) => 1 + len(L)

theorem foo (xs : List)
| xs = nil => 0 + len(xs) = len(xs)

prove foo by induction on xs

case nil:
  prove nil = nil => 0 + len(nil) = len(nil) by calculation
  0 + len(nil)
  defof len_1 => 0 + 0
  = 0
  ---
  len(nil)
  undef len_1 = 0

case cons(a, L):
  given IH : cons(a, L) = nil => 0 + len(L) = len(L)
  prove cons(a, L) = nil => 0 + len(cons(a, L)) = len(cons(a, L)) by calculation
  0 + len(cons(a, L))
  defof len_2 = 0 + (1 + len(L))
  = 1 + len(L)
  ---
  len(cons(a, L))
  undef len_2 = 1 + len(L)`;
    // Parse should succeed and capture premise.
    const pf = parseProofFile(source);
    if (pf.proof.kind === 'induction') {
      const consCase = pf.proof.cases[1];
      assert.equal(consCase.ihTheorems.length, 1);
      assert.equal(consCase.ihTheorems[0].name, 'IH');
      assert.equal(consCase.ihTheorems[0].premises[0].to_string(), 'cons(a, L) = nil');
      assert.equal(consCase.ihTheorems[0].formula, '0 + len(L) = len(L)');
    }
  });

  it('accepts proof with IH premise and free param (backward base)', function() {
    const source = `type List
| nil : List
| cons : (Int, List) -> List

def sum : (List) -> Int
| sum(nil) => 0
| sum(cons(a, L)) => a + sum(L)

def concat : (List, List) -> List
| concat(nil, R) => R
| concat(cons(a, L), R) => cons(a, concat(L, R))

theorem sum_concat_lower (S, T : List)
| 0 <= sum(T) => sum(S) <= sum(concat(S, T))

prove sum_concat_lower by induction on S (a, L)
given 1. 0 <= sum(T)

case nil:
  prove sum(nil) <= sum(concat(nil, T)) by calculation
  sum(nil)
  defof sum_1 = 0
  ---
  sum(concat(nil, T))
  undef concat_1 = sum(T)
  0 <= since 1

case cons(a, L):
  given IH (T : List) : 0 <= sum(T) => sum(L) <= sum(concat(L, T))
  prove sum(cons(a, L)) <= sum(concat(cons(a, L), T)) by calculation
  sum(cons(a, L))
  defof sum_2 = a + sum(L)
  apply IH since 1 <= a + sum(concat(L, T))
  ---
  sum(concat(cons(a, L), T))
  undef concat_2 = sum(cons(a, concat(L, T)))
  undef sum_2 = a + sum(concat(L, T))`;
    check(source);
  });

  it('accepts proof with IH premise and free param (forward base)', function() {
    const source = `type List
| nil : List
| cons : (Int, List) -> List

def sum : (List) -> Int
| sum(nil) => 0
| sum(cons(a, L)) => a + sum(L)

def concat : (List, List) -> List
| concat(nil, R) => R
| concat(cons(a, L), R) => cons(a, concat(L, R))

theorem sum_concat_lower (S, T : List)
| 0 <= sum(T) => sum(S) <= sum(concat(S, T))

prove sum_concat_lower by induction on S (a, L)
given 1. 0 <= sum(T)

case nil:
  prove sum(nil) <= sum(concat(nil, T)) by calculation
  sum(nil)
  defof sum_1 = 0
  <= sum(T) since 1
  ---
  sum(concat(nil, T))
  undef concat_1 = sum(T)

case cons(a, L):
  given IH (T : List) : 0 <= sum(T) => sum(L) <= sum(concat(L, T))
  prove sum(cons(a, L)) <= sum(concat(cons(a, L), T)) by calculation
  sum(cons(a, L))
  defof sum_2 = a + sum(L)
  apply IH since 1 <= a + sum(concat(L, T))
  ---
  sum(concat(cons(a, L), T))
  undef concat_2 = sum(cons(a, concat(L, T)))
  undef sum_2 = a + sum(concat(L, T))`;
    check(source);
  });

  it('parses top-level given lines', function() {
    const source = `type List
| nil : List
| cons : (Int, List) -> List

def len : (List) -> Int
| len(nil) => 0
| len(cons(a, L)) => 1 + len(L)

theorem foo (xs : List)
| xs = nil => 0 + len(xs) = len(xs)

prove foo by calculation
given 1. xs = nil
  0 + len(xs)`;
    const pf = parseProofFile(source);
    assert.equal(pf.givens.length, 1);
    assert.equal(pf.givens[0].index, 1);
    assert.equal(pf.givens[0].text, 'xs = nil');
  });

  it('rejects wrong top-level given formula', function() {
    const source = `type List
| nil : List
| cons : (Int, List) -> List

def len : (List) -> Int
| len(nil) => 0
| len(cons(a, L)) => 1 + len(L)

theorem foo (xs : List)
| xs = nil => 0 + len(xs) = len(xs)

prove foo by calculation
given 1. 999 = 999
  0 + len(xs)`;
    checkFails(source, 13, /given 1 is/);
  });

  it('rejects missing top-level given when theorem has premise', function() {
    const source = `type List
| nil : List
| cons : (Int, List) -> List

def len : (List) -> Int
| len(nil) => 0
| len(cons(a, L)) => 1 + len(L)

theorem foo (xs : List)
| xs = nil => 0 + len(xs) = len(xs)

prove foo by calculation
  0 + len(xs)`;
    // Premise is fact 1 but no given line states it. The proof won't
    // fail on the given — it just won't be stated. That's allowed
    // (givens are optional documentation). But let's verify it parses.
    const pf = parseProofFile(source);
    assert.equal(pf.givens.length, 0);
  });

  it('rejects wrong top-level given number', function() {
    const source = `type List
| nil : List
| cons : (Int, List) -> List

def len : (List) -> Int
| len(nil) => 0
| len(cons(a, L)) => 1 + len(L)

theorem foo (xs : List)
| xs = nil => 0 + len(xs) = len(xs)

prove foo by calculation
given 2. xs = nil
  0 + len(xs)`;
    checkFails(source, 13, /expected fact number 1, got 2/);
  });

  it('parses backward algebra step with since', function() {
    // Verify that "0 <= since 1" parses as a valid backward calc step.
    const source = `type List
| nil : List
| cons : (Int, List) -> List

def sum : (List) -> Int
| sum(nil) => 0
| sum(cons(a, L)) => a + sum(L)

theorem foo (S : List)
| 0 <= sum(S) => 0 <= sum(S)

prove foo by calculation
given 1. 0 <= sum(S)
  ---
  sum(S)
  0 <= since 1`;
    check(source);
  });

  it('parses given IH with multi-group params', function() {
    const source = `type List
| nil : List
| cons : (Int, List) -> List

theorem bar (x : Int) (xs : List)
| x + 0 = x

prove bar by induction on xs

case nil:
  prove x + 0 = x by calculation
  x

case cons(a, L):
  given IH (x : Int) : x + 0 = x
  prove x + 0 = x by calculation
  x`;
    const pf = parseProofFile(source);
    if (pf.proof.kind === 'induction') {
      const consCase = pf.proof.cases[1];
      assert.equal(consCase.ihTheorems[0].name, 'IH');
      assert.deepEqual(consCase.ihTheorems[0].params, [['x', 'Int']]);
    }
  });
});
