@lexer lexer2

FuncDef -> %def %variable %colon TypeSig Cases
      {% ([_def, name, _colon, type, cases]) => new funcAst.FuncAst(name.text, type, checkCaseNames(name, cases), name.line, name.col, name.text.length) %}

TypeSig -> %lparen Types %rparen %arrow %typeName
      {% ([_lp, types, _rp, _arrow, ret]) => new funcAst.TypeAst(list_to_array(types, true), ret.text, _lp.line, _lp.col, 0) %}

Cases -> Case
      {% ([c]) => [c] %}
    | Cases Case
      {% ([cs, c]) => cs.concat([c]) %}

Case -> %pipe %variable %lparen Params %rparen %fatArrow Body
      {% ([_pipe, name, _lp, params, _rp, _arrow, body]) => ({name: name.text, token: name, ast: new funcAst.CaseAst(list_to_array(params, true), body)}) %}

Body -> Expr
      {% ([e]) => new funcAst.ExprBody(e) %}
    | IfChain
      {% ([chain]) => chain %}

IfChain -> %kw_if CondList %kw_then Expr %kw_else ElseBody
      {% ([_if, conds, _then, body, _else, elseBody]) => {
          if (elseBody instanceof funcAst.IfElseBody) {
            return new funcAst.IfElseBody(
              [new funcAst.IfBranch(conds, body), ...elseBody.branches],
              elseBody.elseBody);
          } else {
            return new funcAst.IfElseBody(
              [new funcAst.IfBranch(conds, body)],
              elseBody);
          }
      } %}

ElseBody -> Expr {% ([e]) => e %}
          | IfChain {% ([chain]) => chain %}

CondList -> Prop
      {% ([p]) => [p] %}
    | CondList %comma Prop
      {% ([list, _comma, p]) => list.concat([p]) %}

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
