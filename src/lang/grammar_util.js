export function makeLexer(moo, tokens) {
  const lexer = moo.compile(tokens);
  return {
    save: () => lexer.save(),
    reset: (chunk, info) => lexer.reset(chunk, info),
    formatError: (tok) => lexer.formatError(tok),
    has: (name) => lexer.has(name),
    next: () => {
      let tok;
      do {
        tok = lexer.next();
      } while (tok !== undefined && (tok.type === 'WS' || tok.type === 'NL'));
      return tok;
    }
  };
}

export function makeLangLexer(moo) {
  return makeLexer(moo, {
    WS: /[ \t\r]+/,
    NL: { match: /\n/, lineBreaks: true },
    arrow: '->',
    fatArrow: '=>',
    constant: /[0-9]+/,
    typeName: /[A-Z][_a-zA-Z0-9]*/,
    variable: { match: /[a-z][_a-zA-Z0-9]*/, type: moo.keywords({
      def: 'def', type: 'type', kw_theorem: 'theorem',
      kw_if: 'if', kw_then: 'then', kw_else: 'else'
    }) },
    pipe: '|',
    colon: ':',
    lessequal: '<=',
    lessthan: '<',
    equal: '=',
    lparen: '(', rparen: ')', comma: ',',
    exp: '^', times: '*', plus: '+', minus: '-'
  });
}

export function list_to_array(a, rev) {
  const res = [];
  while (a instanceof Array && a.length == 2) {
    res.push(a[0]);
    a = a[1];
  }
  res.push(a);
  if (rev)
    res.reverse();
  return res;
}

export function checkCaseNames(defName, casePairs) {
  for (const pair of casePairs) {
    if (pair.name !== defName.text) {
      const tok = pair.token;
      throw new Error("line " + tok.line + " col " + tok.col +
          ": expected \"" + defName.text + "\" but found \"" + pair.name + "\"");
    }
  }
  return casePairs.map(function(p) { return p.ast; });
}

export function checkCtorReturnTypes(typeName, ctorPairs) {
  for (const pair of ctorPairs) {
    if (pair.retName !== typeName.text) {
      const tok = pair.retToken;
      throw new Error("line " + tok.line + " col " + tok.col +
          ": expected \"" + typeName.text + "\" but found \"" + pair.retName + "\"");
    }
  }
  return ctorPairs.map(function(p) { return p.ast; });
}
