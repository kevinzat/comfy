@lexer lexer2

FuncDef -> %def %variable %colon TypeSig Cases
      {% ([_def, name, _colon, type, cases]) => new funcAst.FuncAst(name.text, type, checkCaseNames(name, cases)) %}

TypeSig -> %lparen Types %rparen %arrow %typeName
      {% ([_lp, types, _rp, _arrow, ret]) => new funcAst.TypeAst(list_to_array(types, true), ret.text) %}

Cases -> Case
      {% ([c]) => [c] %}
    | Cases Case
      {% ([cs, c]) => cs.concat([c]) %}

Case -> %pipe %variable %lparen Params %rparen %fatArrow Expr
      {% ([_pipe, name, _lp, params, _rp, _arrow, body]) => ({name: name.text, token: name, ast: new funcAst.CaseAst(list_to_array(params, true), body)}) %}

Params -> Param
      {% ([a]) => a %}
    | Params %comma Param
      {% ([a, _comma, b]) => [b, a] %}

Param -> %variable
      {% ([a]) => new funcAst.ParamVar(a.text) %}
    | %typeName
      {% ([a]) => new funcAst.ParamVar(a.text) %}
    | %variable %lparen Params %rparen
      {% ([a, _lp, params, _rp]) => new funcAst.ParamConstructor(a.text, list_to_array(params, true)) %}
