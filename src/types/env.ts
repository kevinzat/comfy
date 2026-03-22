import { UserError } from '../facts/user_error';
import { Formula } from '../facts/formula';
import { TypeDeclAst, ConstructorAst } from '../lang/type_ast';
import { FuncAst, TypeAst } from '../lang/func_ast';
import { getType, checkFormula, checkFuncDecl } from './checker';
import { Type, NamedType } from './type';

export class DuplicateError extends UserError {
  constructor(kind: string, name: string) {
    super(`duplicate ${kind}: "${name}"`);
    Object.setPrototypeOf(this, DuplicateError.prototype);
  }
}

export class ShadowError extends UserError {
  constructor(name: string, shadowedKind: string, shadowingKind: string) {
    super(`${shadowingKind} "${name}" shadows ${shadowedKind} "${name}"`);
    Object.setPrototypeOf(this, ShadowError.prototype);
  }
}

export interface Environment {
  /** Returns true if a type with the given name is defined (including built-ins). */
  hasType(name: string): boolean;
  /**
   * Returns the AST for the type, or null for built-in types.
   * @throws Error if the type is not defined. Use hasType to check first.
   */
  getTypeDecl(name: string): TypeDeclAst | null;

  /** Returns true if a constructor with the given name is defined. */
  hasConstructor(name: string): boolean;
  /**
   * Returns the resolved type for the constructor.
   * @throws Error if the constructor is not defined. Use hasConstructor to check first.
   */
  getConstructorType(name: string): Type;
  /**
   * Returns the AST for the constructor.
   * @throws Error if the constructor is not defined. Use hasConstructor to check first.
   */
  getConstructorDecl(name: string): ConstructorAst;

  /** Returns true if a function with the given name is defined. */
  hasFunction(name: string): boolean;
  /**
   * Returns the resolved type for the function.
   * @throws Error if the function is not defined. Use hasFunction to check first.
   */
  getFunctionType(name: string): Type;
  /**
   * Returns the AST for the function.
   * @throws Error if the function is not defined. Use hasFunction to check first.
   */
  getFunctionDecl(name: string): FuncAst;

  /** Returns true if a variable with the given name is defined. */
  hasVariable(name: string): boolean;
  /**
   * Returns the resolved type for the variable.
   * @throws Error if the variable is not defined. Use hasVariable to check first.
   */
  getVariable(name: string): Type;

  /** Returns the number of known facts. */
  numFacts(): number;
  /**
   * Returns the fact at the given 1-indexed position.
   * @throws UserError if the index is out of range.
   */
  getFact(index: number): Formula;

  /**
   * Validates all definitions and facts in the environment.
   * @throws UnknownTypeError, TypeMismatchError, ArityError, UnknownNameError
   *   if any definition or fact is not well-typed.
   */
  check(): void;
}

export class TopLevelEnv implements Environment {
  private types: Map<string, TypeDeclAst | null>;
  private constructors: Map<string, [Type, ConstructorAst]>;
  private functions: Map<string, [Type, FuncAst]>;
  private variables: Map<string, Type>;
  private facts: Formula[];

  /**
   * Creates a top-level environment with the given types, functions, variables,
   * and known facts. Int is included as a built-in type. Validates name
   * uniqueness, shadowing, and that all referenced type names exist.
   * Call check() to perform full type checking of function bodies and facts.
   * @throws DuplicateError if any name is defined more than once.
   * @throws ShadowError if a function name shadows a constructor name.
   * @throws UnknownTypeError if any definition references an unknown type.
   */
  constructor(
      types: TypeDeclAst[],
      functions: FuncAst[],
      variables: [string, string][],
      facts: Formula[] = [],
  ) {
    this.types = new Map<string, TypeDeclAst | null>([['Int', null]]);
    for (const t of types) {
      if (this.types.has(t.name))
        throw new DuplicateError('type', t.name);
      this.types.set(t.name, t);
    }

    this.constructors = new Map();
    for (const t of types) {
      for (const ctor of t.constructors) {
        if (this.constructors.has(ctor.name))
          throw new DuplicateError('constructor', ctor.name);
        const ref = ctor.paramTypes.length > 0
            ? new TypeAst(ctor.paramTypes, ctor.returnType) : ctor.returnType;
        this.constructors.set(ctor.name, [getType(this, ref), ctor]);
      }
    }

    this.functions = new Map();
    for (const f of functions) {
      if (this.functions.has(f.name))
        throw new DuplicateError('function', f.name);
      if (this.constructors.has(f.name))
        throw new ShadowError(f.name, 'constructor', 'function');
      this.functions.set(f.name, [getType(this, f.type), f]);
    }

    this.variables = new Map();
    for (const [name, typeName] of variables) {
      if (this.variables.has(name))
        throw new DuplicateError('variable', name);
      this.variables.set(name, getType(this, typeName));
    }

    this.facts = facts.slice(0);
  }

  check(): void {
    for (const [_name, entry] of this.functions) {
      checkFuncDecl(this, entry[1]);
    }
    for (const f of this.facts) {
      checkFormula(this, f);
    }
  }

  hasType(name: string): boolean {
    return this.types.has(name);
  }

  getTypeDecl(name: string): TypeDeclAst | null {
    if (!this.types.has(name))
      throw new Error(`unknown type: "${name}"`);
    return this.types.get(name)!;
  }

  hasConstructor(name: string): boolean {
    return this.constructors.has(name);
  }

  getConstructorType(name: string): Type {
    if (!this.constructors.has(name))
      throw new Error(`unknown constructor: "${name}"`);
    return this.constructors.get(name)![0];
  }

  getConstructorDecl(name: string): ConstructorAst {
    if (!this.constructors.has(name))
      throw new Error(`unknown constructor: "${name}"`);
    return this.constructors.get(name)![1];
  }

  hasFunction(name: string): boolean {
    return this.functions.has(name);
  }

  getFunctionType(name: string): Type {
    if (!this.functions.has(name))
      throw new Error(`unknown function: "${name}"`);
    return this.functions.get(name)![0];
  }

  getFunctionDecl(name: string): FuncAst {
    if (!this.functions.has(name))
      throw new Error(`unknown function: "${name}"`);
    return this.functions.get(name)![1];
  }

  hasVariable(name: string): boolean {
    return this.variables.has(name);
  }

  getVariable(name: string): Type {
    if (!this.variables.has(name))
      throw new Error(`unknown variable: "${name}"`);
    return this.variables.get(name)!;
  }

  numFacts(): number {
    return this.facts.length;
  }

  getFact(index: number): Formula {
    if (index < 1 || index > this.facts.length)
      throw new UserError(
          `fact ${index} is out of range (have ${this.facts.length} facts)`);
    return this.facts[index - 1];
  }
}

/**
 * An environment that extends a parent with additional local variables and
 * facts. Variable lookups check locals first (shadowing is allowed).
 * Parent facts are numbered 1..parentN, local facts are numbered
 * parentN+1..parentN+M. Everything else delegates to the parent.
 */
export class NestedEnv implements Environment {
  private parent: Environment;
  private locals: Map<string, NamedType>;
  private localFacts: Formula[];

  /**
   * Creates a nested environment extending the parent with additional local
   * variables and facts. Validates that all variable type names exist.
   * Call check() to validate local facts.
   * @throws UnknownTypeError if any variable references an unknown type.
   */
  constructor(parent: Environment, variables: [string, string][], facts: Formula[] = []) {
    this.parent = parent;
    this.locals = new Map();
    for (const [name, typeName] of variables) {
      this.locals.set(name, getType(parent, typeName) as NamedType);
    }
    this.localFacts = facts.slice(0);
  }

  check(): void {
    for (const f of this.localFacts) {
      checkFormula(this, f);
    }
  }

  hasType(name: string): boolean { return this.parent.hasType(name); }
  getTypeDecl(name: string): TypeDeclAst | null { return this.parent.getTypeDecl(name); }
  hasConstructor(name: string): boolean { return this.parent.hasConstructor(name); }
  getConstructorType(name: string): Type { return this.parent.getConstructorType(name); }
  getConstructorDecl(name: string): ConstructorAst { return this.parent.getConstructorDecl(name); }
  hasFunction(name: string): boolean { return this.parent.hasFunction(name); }
  getFunctionType(name: string): Type { return this.parent.getFunctionType(name); }
  getFunctionDecl(name: string): FuncAst { return this.parent.getFunctionDecl(name); }

  hasVariable(name: string): boolean {
    return this.locals.has(name) || this.parent.hasVariable(name);
  }

  getVariable(name: string): Type {
    if (this.locals.has(name))
      return this.locals.get(name)!;
    return this.parent.getVariable(name);
  }

  numFacts(): number {
    return this.parent.numFacts() + this.localFacts.length;
  }

  getFact(index: number): Formula {
    const total = this.numFacts();
    if (index < 1 || index > total)
      throw new UserError(
          `fact ${index} is out of range (have ${total} facts)`);
    const parentN = this.parent.numFacts();
    if (index <= parentN)
      return this.parent.getFact(index);
    return this.localFacts[index - parentN - 1];
  }
}
