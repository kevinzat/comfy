
import * as assert from 'assert';
import { Constant, Variable, Call } from '../facts/exprs';
import { AtomProp, NotProp, OrProp } from '../facts/prop';
import { ParamVar, ParamConstructor } from './func_ast';
import { ConstructorAst } from './type_ast';
import { ParseDecls, ParsePremises } from './decls_parser';


describe('decls_parser', function() {

  it('parse single type declaration', function() {
    const { ast } = ParseDecls(
        `type Bool
         | yes : Bool
         | no : Bool`);
    assert.ok(ast);
    assert.equal(ast.types.length, 1);
    assert.equal(ast.types[0].name, 'Bool');
    assert.equal(ast.functions.length, 0);
  });

  it('parse single function definition', function() {
    const { ast } = ParseDecls(
        `def f : (Int) -> Int
         | f(x) => x + 1`);
    assert.ok(ast);
    assert.equal(ast.types.length, 0);
    assert.equal(ast.functions.length, 1);
    assert.equal(ast.functions[0].name, 'f');
  });

  it('parse mixed declarations', function() {
    const { ast } = ParseDecls(
        `type List
         | nil : List
         | cons : (Int, List) -> List
         def len : (List) -> Int
         | len(nil) => 0
         | len(cons(a, rest)) => 1 + len(rest)`);
    assert.ok(ast);
    assert.equal(ast.types.length, 1);
    assert.equal(ast.types[0].name, 'List');
    assert.equal(ast.functions.length, 1);
    assert.equal(ast.functions[0].name, 'len');
  });

  it('parse declarations in any order', function() {
    const { ast } = ParseDecls(
        `type Bool
         | yes : Bool
         | no : Bool
         def negate : (Bool) -> Bool
         | negate(b) => b
         theorem foo (x : Int)
         | x = x`);
    assert.ok(ast);
    assert.equal(ast.types.length, 1);
    assert.equal(ast.functions.length, 1);
    assert.equal(ast.theorems.length, 1);
  });

  it('empty input returns empty ast and no errors', function() {
    const { ast, errors } = ParseDecls('');
    assert.ok(ast);
    assert.equal(ast.types.length, 0);
    assert.equal(ast.functions.length, 0);
    assert.equal(ast.theorems.length, 0);
    assert.deepStrictEqual(errors, []);
  });

  it('error on non-keyword tokens', function() {
    const { errors } = ParseDecls('foo bar');
    assert.ok(errors.length > 0);
  });

  it('recovers from bad declaration and parses next one', function() {
    const { ast, errors } = ParseDecls(
        `type BadType
         def f : (Int) -> Int
         | f(x) => x + 1`);
    assert.ok(ast);
    assert.ok(errors.length > 0, 'expected error for bad type');
    assert.equal(ast.functions.length, 1);
    assert.equal(ast.functions[0].name, 'f');
  });

  it('skips garbage before first keyword with error', function() {
    const { ast, errors } = ParseDecls(
        `garbage stuff
         type Bool
         | yes : Bool
         | no : Bool`);
    assert.ok(ast);
    assert.ok(errors.length > 0, 'expected error for garbage');
    assert.equal(ast.types.length, 1);
    assert.equal(ast.types[0].name, 'Bool');
  });

  it('collects multiple errors and keeps good declarations', function() {
    const { ast, errors } = ParseDecls(
        `type BadType
         def f : (Int) -> Int
         | f(x) => x + 1
         type AlsoBad
         theorem foo (x : Int)
         | x = x`);
    assert.ok(ast);
    assert.ok(errors.length >= 2, `expected >= 2 errors, got ${errors.length}`);
    assert.equal(ast.functions.length, 1);
    assert.equal(ast.theorems.length, 1);
  });

  it('ParsePremises throws on invalid premises', function() {
    assert.throws(() => ParsePremises('not a valid premise ###'));
  });

  it('parse error message is concise (no verbose expected-token list)', function() {
    // Nearley's default error dumps every expected production; we strip it.
    const { errors } = ParseDecls('theorem foo (x : Int) | x = + 1');
    assert.equal(errors.length, 1);
    assert.ok(errors[0].split('\n').length <= 2,
        `expected <= 2 lines, got:\n${errors[0]}`);
    assert.ok(!errors[0].includes('Instead, I was expecting'),
        `error should not include verbose production list:\n${errors[0]}`);
  });

  it('lexer error message is concise', function() {
    const { errors } = ParseDecls('theorem foo (x : Int) | ###');
    assert.equal(errors.length, 1);
    assert.ok(errors[0].split('\n').length <= 2,
        `expected <= 2 lines, got:\n${errors[0]}`);
    assert.ok(!errors[0].includes('Instead, I was expecting'),
        `error should not include verbose production list:\n${errors[0]}`);
  });

  it('parse error reports actual bad token line, not decl keyword line', function() {
    // The `theorem` keyword is on line 1, but the bad `=>` is on line 2.
    const { errors } = ParseDecls('theorem foo (x : Int)\n| head(x) => x');
    assert.equal(errors.length, 1);
    const m = errors[0].match(/^line (\d+) col \d+:/);
    assert.ok(m, `expected 'line N col M:' prefix, got: ${errors[0]}`);
    assert.equal(m![1], '2', `expected error on line 2, got: ${errors[0]}`);
  });

  it('incomplete declaration reports last-seen token line, not decl keyword line', function() {
    // Theorem is truncated mid-parse; `=>` on line 2 is the last token before EOF.
    const { errors } = ParseDecls('theorem foo (x : Int)\n| x = x =>');
    assert.equal(errors.length, 1);
    const m = errors[0].match(/^line (\d+) col \d+:/);
    assert.ok(m, `expected 'line N col M:' prefix, got: ${errors[0]}`);
    assert.equal(m![1], '2', `expected error on line 2, got: ${errors[0]}`);
  });

  it('startLine option makes AST and error lines source-absolute', function() {
    // Declaration's internal line is 1, but startLine=17 makes it report as 18.
    const { ast, errors } = ParseDecls(
        'theorem foo (x : Int)\n| head(x) => x',
        { startLine: 17 });
    // Error should be on source line 18 (which is startLine 17 + local line 2).
    assert.equal(errors.length, 1);
    const m = errors[0].match(/^line (\d+) col \d+:/);
    assert.ok(m, `expected 'line N col M:' prefix, got: ${errors[0]}`);
    assert.equal(m![1], '18', `expected error on line 18, got: ${errors[0]}`);
    // A successful parse also has source-absolute lines on the AST.
    const { ast: ast2 } = ParseDecls('theorem foo (x : Int)\n| x = x', { startLine: 10 });
    assert.equal(ast2.theorems[0].line, 10,
        `theorem AST line should be 10, got ${ast2.theorems[0].line}`);
    void ast;
  });

  // --- Theorem declarations ---

  it('parse theorem without premise (pipe syntax)', function() {
    const { ast } = ParseDecls(
        `theorem foo (x : Int)
         | x + 1 = 1 + x`);
    assert.ok(ast);
    assert.equal(ast.theorems.length, 1);
    assert.equal(ast.theorems[0].name, 'foo');
    assert.deepEqual(ast.theorems[0].params, [['x', 'Int']]);
    assert.deepEqual(ast.theorems[0].premises, []);
    assert.ok(ast.theorems[0].conclusion instanceof AtomProp);
    assert.strictEqual(ast.theorems[0].conclusion.formula.op, '=');
  });

  it('parse theorem with premise', function() {
    const { ast } = ParseDecls(
        `theorem foo (x : Int)
         | x < 0 => 0 < x * x`);
    assert.ok(ast, 'parse failed');
    assert.equal(ast.theorems.length, 1);
    assert.equal(ast.theorems[0].premises.length, 1);
    assert.ok(ast.theorems[0].premises[0] instanceof AtomProp);
    assert.strictEqual(ast.theorems[0].premises[0].formula.op, '<');
    assert.ok(ast.theorems[0].conclusion instanceof AtomProp);
    assert.strictEqual(ast.theorems[0].conclusion.formula.op, '<');
  });

  it('parse theorem with multiple params of same type', function() {
    const { ast } = ParseDecls(
        `type List
         | nil : List
         | cons : (Int, List) -> List
         def concat : (List, List) -> List
         | concat(nil, R) => R
         | concat(cons(a, L), R) => cons(a, concat(L, R))
         theorem concat_assoc (R, S, T : List)
         | concat(concat(R, S), T) = concat(R, concat(S, T))`);
    assert.ok(ast);
    assert.equal(ast.theorems.length, 1);
    assert.deepEqual(ast.theorems[0].params,
        [['R', 'List'], ['S', 'List'], ['T', 'List']]);
  });

  it('parse theorem with mixed param groups', function() {
    const { ast } = ParseDecls(
        `type List
         | nil : List
         | cons : (Int, List) -> List
         theorem foo (x : Int) (L, R : List)
         | x = x`);
    assert.ok(ast);
    assert.deepEqual(ast.theorems[0].params,
        [['x', 'Int'], ['L', 'List'], ['R', 'List']]);
  });

  it('parse theorem with uppercase param name', function() {
    const { ast } = ParseDecls(
        `type List
         | nil : List
         theorem foo (L : List)
         | L = L`);
    assert.ok(ast);
    assert.deepEqual(ast.theorems[0].params, [['L', 'List']]);
  });

  it('parse theorem mixed with other declarations', function() {
    const { ast } = ParseDecls(
        `def f : (Int) -> Int
         | f(x) => x + 1
         theorem foo (y : Int)
         | f(y) = y + 1`);
    assert.ok(ast);
    assert.equal(ast.functions.length, 1);
    assert.equal(ast.theorems.length, 1);
  });

  it('parse theorem with not conclusion', function() {
    const { ast } = ParseDecls(
        `theorem foo (x : Int)
         | not x < 0`);
    assert.ok(ast);
    assert.ok(ast.theorems[0].conclusion instanceof NotProp);
    assert.strictEqual(ast.theorems[0].conclusion.formula.op, '<');
  });

  it('parse theorem with parenthesized not conclusion', function() {
    const { ast } = ParseDecls(
        `type List
         | nil : List
         | cons : (Int, List) -> List
         def concat : (List, List) -> List
         | concat(nil, R) => R
         | concat(cons(a, L), R) => cons(a, concat(L, R))
         theorem foo (x : Int) (L : List)
         | not (concat(L, cons(x, nil)) = nil)`);
    assert.ok(ast);
    assert.ok(ast.theorems[0].conclusion instanceof NotProp);
    assert.strictEqual(ast.theorems[0].conclusion.formula.op, '=');
  });

  it('parse theorem with /= conclusion', function() {
    const { ast } = ParseDecls(
        `type List
         | nil : List
         | cons : (Int, List) -> List
         def concat : (List, List) -> List
         | concat(nil, R) => R
         | concat(cons(a, L), R) => cons(a, concat(L, R))
         theorem foo (x : Int) (L : List)
         | concat(L, cons(x, nil)) /= nil`);
    assert.ok(ast);
    assert.ok(ast.theorems[0].conclusion instanceof NotProp);
    assert.strictEqual(ast.theorems[0].conclusion.formula.op, '=');
  });

  it('parse theorem with not premise', function() {
    const { ast } = ParseDecls(
        `theorem foo (x : Int)
         | not x < 0 => 0 < x * x`);
    assert.ok(ast);
    assert.equal(ast.theorems[0].premises.length, 1);
    assert.ok(ast.theorems[0].premises[0] instanceof NotProp);
    assert.ok(ast.theorems[0].conclusion instanceof AtomProp);
  });

  it('parse theorem with or premise', function() {
    const { ast } = ParseDecls(
        `theorem foo (x : Int)
         | x < 0 or x = 0 => 0 <= x * x`);
    assert.ok(ast);
    assert.equal(ast.theorems[0].premises.length, 1);
    assert.ok(ast.theorems[0].premises[0] instanceof OrProp);
    assert.equal(ast.theorems[0].premises[0].disjuncts.length, 2);
    assert.ok(ast.theorems[0].conclusion instanceof AtomProp);
  });

  it('parse theorem with multiple mixed premises', function() {
    const { ast } = ParseDecls(
        `theorem foo (x : Int)
         | x < 0, not x = 0 => 0 <= x * x`);
    assert.ok(ast);
    assert.equal(ast.theorems[0].premises.length, 2);
    assert.ok(ast.theorems[0].premises[0] instanceof AtomProp);
    assert.ok(ast.theorems[0].premises[1] instanceof NotProp);
  });

});
