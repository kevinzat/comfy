import * as assert from 'assert';
import {
  FindForwardMatches,
  FindBackwardMatches,
  PatternMatch,
  LongestCommonPrefix,
  SplitLine,
} from './infer_complete';


describe('SplitLine', function() {

  it('splits simple tokens', function() {
    assert.deepStrictEqual(SplitLine('= x'), ['=', 'x']);
  });

  it('splits with leading/trailing spaces', function() {
    assert.deepStrictEqual(SplitLine('  = x  '), ['=', 'x']);
  });

  it('splits single token', function() {
    assert.deepStrictEqual(SplitLine('subst'), ['subst']);
  });

  it('splits multiple tokens', function() {
    assert.deepStrictEqual(SplitLine('defof foo'), ['defof', 'foo']);
  });

  it('handles empty string', function() {
    assert.deepStrictEqual(SplitLine(''), []);
  });

  it('handles only spaces', function() {
    assert.deepStrictEqual(SplitLine('   '), []);
  });

  it('parses parenthesized expression as one token', function() {
    assert.deepStrictEqual(SplitLine('= (x + 1)'), ['=', '(x + 1)']);
  });

  it('parses nested parens as one token', function() {
    assert.deepStrictEqual(SplitLine('= (f(x, y))'), ['=', '(f(x, y))']);
  });

  it('splits number token', function() {
    assert.deepStrictEqual(SplitLine('subst 3'), ['subst', '3']);
  });

  it('handles multiple spaces between tokens', function() {
    assert.deepStrictEqual(SplitLine('=   x'), ['=', 'x']);
  });

  it('handles partial open paren with balanced content', function() {
    assert.deepStrictEqual(SplitLine('= (a + (b * c))'), ['=', '(a + (b * c))']);
  });

});


describe('LongestCommonPrefix', function() {

  it('returns empty string for empty array', function() {
    assert.strictEqual(LongestCommonPrefix([]), '');
  });

  it('returns the single string for array of one', function() {
    assert.strictEqual(LongestCommonPrefix(['hello']), 'hello');
  });

  it('returns common prefix of two strings', function() {
    assert.strictEqual(LongestCommonPrefix(['foo', 'foobar']), 'foo');
  });

  it('returns empty string when no common prefix', function() {
    assert.strictEqual(LongestCommonPrefix(['abc', 'xyz']), '');
  });

  it('returns full string when all strings are identical', function() {
    assert.strictEqual(LongestCommonPrefix(['abc', 'abc', 'abc']), 'abc');
  });

  it('handles strings of different lengths', function() {
    assert.strictEqual(LongestCommonPrefix(['concat', 'cons', 'count']), 'co');
  });

  it('finds prefix across three strings', function() {
    assert.strictEqual(LongestCommonPrefix(['defof', 'def', 'define']), 'def');
  });

  it('one character common prefix', function() {
    assert.strictEqual(LongestCommonPrefix(['abc', 'axy']), 'a');
  });

});


describe('PatternMatch', function() {

  it('returns empty when parts exceed pattern length', function() {
    const result = PatternMatch(['a', 'b', 'c'], [{type: 1, text: 'a'}]);
    assert.deepStrictEqual(result, []);
  });

  it('matches empty parts against full pattern (TYPE_LITERAL)', function() {
    const result = PatternMatch([], [{type: 1, text: '='}]);
    assert.ok(result.length > 0);
    assert.strictEqual(result[0].completion, '=');
  });

  it('matches exact literal', function() {
    const result = PatternMatch(['='], [{type: 1, text: '='}]);
    assert.ok(result.length > 0);
    assert.strictEqual(result[0].completion, '=');
  });

  it('completes partial literal', function() {
    const result = PatternMatch(['def'], [{type: 1, text: 'defof'}]);
    assert.ok(result.length > 0);
    assert.strictEqual(result[0].completion, 'defof');
    // description should show partial typed + rest
    const desc = result[0].description;
    const boldParts = desc.filter(w => w.bold).map(w => w.text);
    assert.ok(boldParts.includes('def'));
  });

  it('returns empty when literal does not match prefix', function() {
    const result = PatternMatch(['xyz'], [{type: 1, text: 'defof'}]);
    assert.deepStrictEqual(result, []);
  });

  it('matches TYPE_EXPR with parenthesized input', function() {
    const result = PatternMatch(['(x + 1)'], [{type: 7}]);
    assert.ok(result.length > 0);
    assert.strictEqual(result[0].completion, '(x + 1)');
  });

  it('returns empty for TYPE_EXPR with non-paren input', function() {
    const result = PatternMatch(['x'], [{type: 7}]);
    assert.deepStrictEqual(result, []);
  });

  it('matches TYPE_NUMBER with numeric input', function() {
    const result = PatternMatch(['3'], [{type: 8}]);
    assert.ok(result.length > 0);
    assert.strictEqual(result[0].completion, '3');
  });

  it('returns empty for TYPE_NUMBER with non-number input', function() {
    const result = PatternMatch(['abc'], [{type: 8}]);
    assert.deepStrictEqual(result, []);
  });

  it('TYPE_PREDICATE with no names returns empty', function() {
    const result = PatternMatch(['foo'], [{type: 4, names: []}]);
    assert.deepStrictEqual(result, []);
  });

  it('TYPE_PREDICATE with single matching name', function() {
    const result = PatternMatch(['fo'], [{type: 4, names: ['foo', 'bar']}]);
    assert.ok(result.length === 1);
    assert.strictEqual(result[0].completion, 'foo');
  });

  it('TYPE_PREDICATE with multiple matching names returns multiple results', function() {
    const result = PatternMatch(['f'], [{type: 4, names: ['foo', 'faz', 'bar']}]);
    assert.strictEqual(result.length, 2);
    const completions = result.map(r => r.completion);
    assert.ok(completions.includes('foo'));
    assert.ok(completions.includes('faz'));
  });

  it('TYPE_PREDICATE with no matching names returns empty', function() {
    const result = PatternMatch(['z'], [{type: 4, names: ['foo', 'bar']}]);
    assert.deepStrictEqual(result, []);
  });

  it('TYPE_PREDICATE returns empty for non-predicate input', function() {
    const result = PatternMatch(['123'], [{type: 4, names: ['foo']}]);
    assert.deepStrictEqual(result, []);
  });

  it('empty parts with TYPE_PREDICATE lists all names', function() {
    const result = PatternMatch([], [{type: 4, names: ['foo', 'bar']}]);
    assert.strictEqual(result.length, 2);
    const completions = result.map(r => r.completion);
    assert.ok(completions.includes('foo'));
    assert.ok(completions.includes('bar'));
  });

  it('empty parts with TYPE_EXPR shows placeholder', function() {
    const result = PatternMatch([], [{type: 7}]);
    assert.ok(result.length > 0);
    const descText = result[0].description.map(w => w.text).join('');
    assert.ok(descText.includes('(Expr)'));
  });

  it('empty parts with TYPE_NUMBER shows placeholder', function() {
    const result = PatternMatch([], [{type: 8}]);
    assert.ok(result.length > 0);
    const descText = result[0].description.map(w => w.text).join('');
    assert.ok(descText.includes('N'));
  });

  it('multi-element pattern: literal then expr', function() {
    const result = PatternMatch(['='], [{type: 1, text: '='}, {type: 7}]);
    assert.ok(result.length > 0);
    assert.ok(result[0].completion.startsWith('= '));
    const descText = result[0].description.map(w => w.text).join('');
    assert.ok(descText.includes('(Expr)'));
  });

  it('multi-element pattern with predicate after matched literal', function() {
    const result = PatternMatch(['defof'], [{type: 1, text: 'defof'}, {type: 4, names: ['foo', 'bar']}]);
    assert.strictEqual(result.length, 2);
    assert.ok(result[0].completion.startsWith('defof '));
  });

  it('partial literal match in multi-element pattern fills remaining pattern', function() {
    const result = PatternMatch(['def'], [{type: 1, text: 'defof'}, {type: 4, names: ['foo']}]);
    assert.ok(result.length > 0);
    assert.strictEqual(result[0].completion, 'defof foo');
  });

  it('TYPE_PREDICATE exact match with single name', function() {
    const result = PatternMatch(['foo'], [{type: 4, names: ['foo']}]);
    assert.ok(result.length === 1);
    assert.strictEqual(result[0].completion, 'foo');
  });

  it('multi-match TYPE_PREDICATE with continuation parts', function() {
    const result = PatternMatch(['f', 'extra'], [
      {type: 4, names: ['foo', 'faz']},
      {type: 1, text: 'extra'},
    ]);
    assert.strictEqual(result.length, 2);
  });

  it('multi-match TYPE_PREDICATE with exact name match', function() {
    const result = PatternMatch(['foo'], [
      {type: 4, names: ['foo', 'foobar']},
    ]);
    assert.strictEqual(result.length, 2);
    const completions = result.map(r => r.completion);
    assert.ok(completions.includes('foo'));
    assert.ok(completions.includes('foobar'));
  });

  it('TYPE_PREDICATE with no names property uses empty array', function() {
    const result = PatternMatch(['foo'], [{type: 4}]);
    assert.deepStrictEqual(result, []);
  });

  it('empty parts with PREDICATE with no names property uses empty array', function() {
    const result = PatternMatch([], [{type: 4}]);
    assert.deepStrictEqual(result, []);
  });

  it('throws for unknown pattern type in matched part', function() {
    assert.throws(() => PatternMatch(['x'], [{type: 99}]), /unknown type/);
  });

  it('throws for unknown pattern type in remaining part', function() {
    assert.throws(() => PatternMatch([], [{type: 99}]), /unknown type/);
  });

  it('empty parts with PREDICATE followed by LITERAL describes both', function() {
    const result = PatternMatch([], [
      {type: 4, names: ['foo']},
      {type: 1, text: '='},
    ]);
    assert.strictEqual(result.length, 1);
    const descText = result[0].description.map(w => w.text).join('');
    assert.ok(descText.includes('foo'));
    assert.ok(descText.includes('='));
  });

  it('empty parts with PREDICATE followed by EXPR describes both', function() {
    const result = PatternMatch([], [
      {type: 4, names: ['bar']},
      {type: 7},
    ]);
    assert.strictEqual(result.length, 1);
    const descText = result[0].description.map(w => w.text).join('');
    assert.ok(descText.includes('bar'));
    assert.ok(descText.includes('(Expr)'));
  });

  it('empty parts with PREDICATE followed by NUMBER describes both', function() {
    const result = PatternMatch([], [
      {type: 4, names: ['baz']},
      {type: 8},
    ]);
    assert.strictEqual(result.length, 1);
    const descText = result[0].description.map(w => w.text).join('');
    assert.ok(descText.includes('baz'));
    assert.ok(descText.includes('N'));
  });

});


describe('FindForwardMatches', function() {

  it('returns matches for algebra = rule', function() {
    const matches = FindForwardMatches('=');
    assert.ok(matches.length > 0);
    const completions = matches.map(m => m.completion);
    assert.ok(completions.some(c => c.startsWith('=')));
  });

  it('returns matches for algebra < rule', function() {
    const matches = FindForwardMatches('<');
    assert.ok(matches.length > 0);
  });

  it('returns matches for algebra <= rule', function() {
    const matches = FindForwardMatches('<=');
    assert.ok(matches.length > 0);
  });

  it('returns matches for subst rule', function() {
    const matches = FindForwardMatches('subst');
    assert.ok(matches.length > 0);
    assert.ok(matches.some(m => m.completion.startsWith('subst')));
  });

  it('returns matches for unsub rule', function() {
    const matches = FindForwardMatches('unsub');
    assert.ok(matches.length > 0);
    assert.ok(matches.some(m => m.completion.startsWith('unsub')));
  });

  it('returns defof matches when defNames provided', function() {
    const matches = FindForwardMatches('defof', ['concat', 'reverse']);
    assert.ok(matches.some(m => m.completion.startsWith('defof')));
  });

  it('returns undef matches when defNames provided', function() {
    const matches = FindForwardMatches('undef', ['concat']);
    assert.ok(matches.some(m => m.completion.startsWith('undef')));
  });

  it('returns no duplicates', function() {
    const matches = FindForwardMatches('=');
    const completions = matches.map(m => m.completion);
    const unique = new Set(completions);
    assert.strictEqual(completions.length, unique.size);
  });

  it('filters duplicate completions from repeated defNames', function() {
    const matches = FindForwardMatches('defof', ['foo', 'foo']);
    const completions = matches.map(m => m.completion);
    const fooCount = completions.filter(c => c === 'defof foo').length;
    assert.strictEqual(fooCount, 1);
  });

  it('returns empty array for unrecognized text', function() {
    const matches = FindForwardMatches('zzz');
    assert.deepStrictEqual(matches, []);
  });

  it('returns defof completions with partial name', function() {
    const matches = FindForwardMatches('defof co', ['concat', 'count', 'reverse']);
    assert.ok(matches.length > 0);
    assert.ok(matches.some(m => m.completion.includes('concat') || m.completion.includes('count')));
  });

  it('empty text returns all patterns', function() {
    const matches = FindForwardMatches('');
    assert.ok(matches.length > 0);
  });

  it('works with no defNames argument', function() {
    const matches = FindForwardMatches('=');
    assert.ok(Array.isArray(matches));
  });

});


describe('FindBackwardMatches', function() {

  it('returns matches for algebra rule with expr', function() {
    const matches = FindBackwardMatches('(x + 1)');
    assert.ok(matches.length > 0);
  });

  it('returns matches for expr = pattern', function() {
    const matches = FindBackwardMatches('(x + 1) =');
    assert.ok(matches.length > 0);
    assert.ok(matches.some(m => m.completion.includes('=')));
  });

  it('returns matches for subst rule', function() {
    const matches = FindBackwardMatches('subst');
    assert.ok(matches.length > 0);
    assert.ok(matches.some(m => m.completion.startsWith('subst')));
  });

  it('returns defof matches when defNames provided', function() {
    const matches = FindBackwardMatches('defof', ['concat']);
    assert.ok(matches.some(m => m.completion.startsWith('defof')));
  });

  it('returns no duplicates', function() {
    const matches = FindBackwardMatches('(x)');
    const completions = matches.map(m => m.completion);
    const unique = new Set(completions);
    assert.strictEqual(completions.length, unique.size);
  });

  it('works with no defNames argument', function() {
    const matches = FindBackwardMatches('subst');
    assert.ok(Array.isArray(matches));
  });

  it('empty text returns all patterns', function() {
    const matches = FindBackwardMatches('');
    assert.ok(matches.length > 0);
  });

});
