export type Type = NamedType | FunctionType;

/** A named type like Int or List. */
export class NamedType {
  readonly kind = 'named';
  name: string;

  constructor(name: string) {
    this.name = name;
  }
}

/** A function type like (Int, List) -> Int. */
export class FunctionType {
  readonly kind = 'function';
  paramTypes: NamedType[];
  returnType: NamedType;

  constructor(paramTypes: NamedType[], returnType: NamedType) {
    this.paramTypes = paramTypes;
    this.returnType = returnType;
  }
}
