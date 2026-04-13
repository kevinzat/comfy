@lexer lexer2

TypeDecl -> %type %typeName Ctors
      {% ([_type, name, ctors]) => new typeAst.TypeDeclAst(name.text, checkCtorReturnTypes(name, ctors), name.line, name.col, name.text.length) %}

Ctors -> Ctor
      {% ([c]) => [c] %}
    | Ctors Ctor
      {% ([cs, c]) => cs.concat([c]) %}

Ctor -> %pipe %variable %colon %typeName
      {% ([_pipe, name, _colon, ret]) => ({retName: ret.text, retToken: ret, ast: new typeAst.ConstructorAst(name.text, [], ret.text, name.line, name.col, name.text.length)}) %}
    | %pipe %variable %colon %lparen Types %rparen %arrow %typeName
      {% ([_pipe, name, _colon, _lp, types, _rp, _arrow, ret]) => ({retName: ret.text, retToken: ret, ast: new typeAst.ConstructorAst(name.text, list_to_array(types, true), ret.text, name.line, name.col, name.text.length)}) %}
