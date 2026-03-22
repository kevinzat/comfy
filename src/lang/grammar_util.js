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
