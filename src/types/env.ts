import { UserError } from '../facts/user_error';
import { Prop, AtomProp } from '../facts/prop';
import { TypeDeclAst, ConstructorAst } from '../lang/type_ast';
import { FuncAst, TypeAst } from '../lang/func_ast';
import { TheoremAst } from '../lang/theorem_ast';
import { getType, checkProp, checkFuncDecl } from './checker';
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
  getVariable(name: string): NamedType;

  /** Returns true if the variable exists and is read-only (e.g. a function parameter). */
  isReadOnly(name: string): boolean;

  /** Returns the number of known facts. */
  numFacts(): number;
  /**
   * Returns the fact at the given 1-indexed position.
   * @throws UserError if the index is out of range.
   */
  getFact(index: number): Prop;

  /** Returns true if a theorem with the given name is defined. */
  hasTheorem(name: string): boolean;
  /**
   * Returns the AST for the theorem.
   * @throws Error if the theorem is not defined. Use hasTheorem to check first.
   */
  getTheorem(name: string): TheoremAst;

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
  private facts: Prop[];
  private theorems_: TheoremAst[];

  /**
   * Creates a top-level environment with the given types, functions,
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
      facts: Prop[] = [],
      theorems: TheoremAst[] = [],
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

    this.theorems_ = [];
    for (const thm of theorems) {
      if (this.functions.has(thm.name))
        throw new DuplicateError('theorem (conflicts with function)', thm.name);
      if (this.constructors.has(thm.name))
        throw new DuplicateError('theorem (conflicts with constructor)', thm.name);
      if (this.theorems_.some(t => t.name === thm.name))
        throw new DuplicateError('theorem', thm.name);
      // Validate that all param types exist
      for (const [_, typeName] of thm.params) {
        getType(this, typeName);
      }
      this.theorems_.push(thm);
    }

    this.facts = facts.slice(0);
  }

  check(): void {
    for (const [_name, entry] of this.functions) {
      checkFuncDecl(this, entry[1]);
    }
    for (const f of this.facts) {
      checkProp(this, f);
    }
    for (const thm of this.theorems_) {
      const thmEnv = new NestedEnv(this, thm.params);
      for (const p of thm.premises) {
        checkProp(thmEnv, p);
      }
      checkProp(thmEnv, thm.conclusion);
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
    /* v8 ignore start */
    if (!this.constructors.has(name))
      throw new Error(`unknown constructor: "${name}"`);
    /* v8 ignore stop */
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
    /* v8 ignore start */
    if (!this.functions.has(name))
      throw new Error(`unknown function: "${name}"`);
    /* v8 ignore stop */
    return this.functions.get(name)![0];
  }

  getFunctionDecl(name: string): FuncAst {
    if (!this.functions.has(name))
      throw new Error(`unknown function: "${name}"`);
    return this.functions.get(name)![1];
  }

  hasTheorem(name: string): boolean {
    return this.theorems_.some(t => t.name === name);
  }

  getTheorem(name: string): TheoremAst {
    const thm = this.theorems_.find(t => t.name === name);
    /* v8 ignore start */
    if (!thm)
      throw new Error(`unknown theorem: "${name}"`);
    /* v8 ignore stop */
    return thm;
  }

  hasVariable(_name: string): boolean {
    return false;
  }

  getVariable(name: string): NamedType {
    throw new Error(`unknown variable: "${name}"`);
  }

  isReadOnly(_name: string): boolean {
    return false;
  }

  numFacts(): number {
    return this.facts.length;
  }

  getFact(index: number): Prop {
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
  private readOnly_: Set<string>;
  private localFacts: Prop[];
  private localTheorems: TheoremAst[];

  /**
   * Creates a nested environment extending the parent with additional local
   * variables, facts, and theorems. Validates that all variable type names
   * exist. Call check() to validate local facts.
   * @throws UnknownTypeError if any variable references an unknown type.
   */
  constructor(parent: Environment, variables: [string, string][],
      facts: Prop[] = [], theorems: TheoremAst[] = [],
      readOnly: Set<string> = new Set()) {
    this.parent = parent;
    this.locals = new Map();
    this.readOnly_ = readOnly;
    for (const [name, typeName] of variables) {
      this.locals.set(name, getType(parent, typeName));
    }
    this.localFacts = facts.slice(0);
    this.localTheorems = theorems.slice(0);
  }

  check(): void {
    for (const f of this.localFacts) {
      checkProp(this, f);
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
  hasTheorem(name: string): boolean {
    return this.localTheorems.some(t => t.name === name) ||
        this.parent.hasTheorem(name);
  }

  getTheorem(name: string): TheoremAst {
    const local = this.localTheorems.find(t => t.name === name);
    if (local) return local;
    return this.parent.getTheorem(name);
  }

  hasVariable(name: string): boolean {
    return this.locals.has(name) || this.parent.hasVariable(name);
  }

  getVariable(name: string): NamedType {
    if (this.locals.has(name))
      return this.locals.get(name)!;
    return this.parent.getVariable(name);
  }

  isReadOnly(name: string): boolean {
    if (this.locals.has(name))
      return this.readOnly_.has(name);
    return this.parent.isReadOnly(name);
  }

  numFacts(): number {
    return this.parent.numFacts() + this.localFacts.length;
  }

  getFact(index: number): Prop {
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
