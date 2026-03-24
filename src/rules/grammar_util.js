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

export function makeRuleLexer(moo) {
  return makeLexer(moo, {
    WS: /[ \t\r]+/,
    NL: { match: /\n/, lineBreaks: true },
    constant: /[0-9]+/,
    variable: { match: /[a-zA-Z][_a-zA-Z0-9]*/, type: moo.keywords({
      subst: 'subst', unsub: 'unsub', defof: 'defof', undef: 'undef'
    }) },
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
