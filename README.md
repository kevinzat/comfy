# Comfy

Comfy is an interactive proof assistant for theorems about simple, recursive
functions and types and programs written in a simple, imperative language.

The built-in supported types are Bool and Int, with the latter being
arbitrary-size integers. Comfy includes decision procedures for checking
equalities and inequalities over the integers. All other types must be defined
inductively.

Proofs are done primarily using three techniques: calculation, cases, and
induction. Individual steps in a calculation block can make use of the decision
procedures over the integers or recursive function definitions. Induction takes
advantage of recursive type definitions.

The system is also able to check proofs stored as `.prf` text files without the
UI (see `src/proof/proofs/FORMAT.md` for the file format).

---

## `src/` directory layout

```
src/
  facts/       — core data types and algorithms (no dependencies on other src/ dirs)
  decision/    — arithmetic decision procedures (depends on: facts)
  lang/        — ASTs and parsers for the source language (depends on: facts)
  types/       — type checker and type environment (depends on: facts, lang)
  rules/       — inference rules and tactics (depends on: facts, decision, types)
  proof/       — proof methods and proof-file checker (depends on: facts, decision, lang, types, rules)
  program/     — proof obligations extracted from programs (depends on: facts, lang)
  components/  — React UI components (depends on: everything above)
```

---

## Subdirectory descriptions

### `facts/`

The foundation of the system. Contains the core data types (`Expression`,
`Formula`, `Prop`) and pure algorithms (parsing, unification) that everything
else builds on.

### `decision/`

Arithmetic decision procedures. Decides whether equations and inequalities over
the integers are valid or implied by a set of known facts, using an exact
rational linear arithmetic solver.

### `lang/`

ASTs and parsers for the user-facing source language. Purely syntactic — no
type-checking or evaluation.

### `types/`

Type-checking and the proof environment. Verifies that function definitions are
well-typed and maintains the environment of named types, functions, and numbered
known facts that proof steps can cite.

### `rules/`

Inference rules and rewriting. Implements the individual proof steps a user
applies in a calculation chain: parsing rule text, unifying against expressions,
applying substitutions, and finding matching rules for autocomplete.

### `proof/`

Proof methods and the `.prf` file checker. Implements calculation chains,
structural induction, and proof by cases. The core logic is shared between the
interactive UI and the batch file checker.

### `program/`

Extracts proof obligations from programs. Walks function definitions and
produces the premises and `Prop` goals that the user must prove.

### `components/`

React UI. Each component corresponds to one part of the interactive proof
interface: setup screen, calculation block, induction block, cases block, and
rule autocomplete.

---

## Dependency rules

The directories form a strict layered hierarchy. A module may only import from
directories **at or below its own level**. No upward or sideways imports are
permitted (except within the same directory).

```
components      (top — UI only)
    |
program         proof
    \            /
     \          /
      types   rules
          \   /
           \ /
           lang
            |
         decision
            |
          facts   (bottom — no internal src/ imports)
```

Concretely:

| Directory    | May import from |
|--------------|-----------------|
| `facts`      | *(nothing in src/)* |
| `decision`   | `facts` |
| `lang`       | `facts` |
| `types`      | `facts`, `lang` |
| `rules`      | `facts`, `decision`, `types` |
| `proof`      | `facts`, `decision`, `lang`, `types`, `rules` |
| `program`    | `facts`, `lang` |
| `components` | all of the above |

`program` and `proof` are peers — neither imports from the other. `lang` and
`decision` are peers — neither imports from the other. `components` is the only
layer that may import from every other directory.
