# .prf File Format

A `.prf` file describes a complete proof that can be checked automatically. Each
part of the file corresponds to something a user would type into the Comfy UI.
This document describes the format and maps every section to its UI counterpart.

## Overall structure

```
<declarations>
<givens>
<prove line>
<proof body>
```

All four sections are described below.

---

## 1. Declarations

Type, function, and variable declarations, using the same syntax as the
**Declarations** textarea on the setup screen (`ProofSetup.tsx`).

```
type List
| nil : List
| cons : (Int, List) -> List

def len : (List) -> Int
| len(nil) => 0
| len(cons(a, L)) => 1 + len(L)

var xs : List
```

**UI correspondence:** The user types this text into the "Declarations" textarea.
The text is parsed by `ParseDecls()` in both the UI and the checker. Both call
`env.check()` to type-check declarations (verifying that function bodies are
well-typed, all referenced types exist, etc.).

---

## 2. Givens

Zero or more `given` lines, each providing a formula that is assumed true. These
appear after declarations and before the `prove` line.

```
given x + y = 5
given x < 10
```

**UI correspondence:** Each `given` line corresponds to one entry in the
"Givens" list on the setup screen. The user clicks "+" to add a given and types
a formula into the input field.

Givens become numbered facts in the environment (fact 1, fact 2, ...) and can be
cited by proof rules (e.g. `= 5 1` cites fact 1, `subst 2` substitutes using
fact 2).

---

## 3. Prove line

A single line stating the goal formula and the proof method.

```
prove <formula> by <method>
```

Where `<method>` is one of:

- `calculation` -- a direct calculation proof
- `induction on <variable>` -- structural induction on a variable of inductive type
- `cases on <condition>` -- proof by cases on an inequality (`<` or `<=`)

**UI correspondence:** The `<formula>` corresponds to what the user types in the
"Prove" input on the setup screen. The `<method>` corresponds to what the user
types into the proof method input inside `ProofBlock` (the dropdown that shows
"calculate / induction on ... / cases on ...").

**Difference:** In the UI, the goal formula and proof method are entered in two
separate steps: the formula on the setup screen, then the method inside the
proof view. In a `.prf` file they are combined on one line.

---

## 4. Proof body

The proof body depends on the method chosen on the `prove` line.

### 4a. `calculation` proof body

A calculation proof lists the full chain of expressions and rules, alternating
between them. The forward section works from the left side of the goal; the
`---` separator begins the backward section, which works from the right side.

```
prove <LHS> = <RHS> by calculation
  <LHS>
  <forward rule 1> : <result 1>
  <forward rule 2> : <result 2>
  ---
  <RHS>
  <backward rule 1> : <result 1>
```

Each section starts with a bare expression (the starting point). Subsequent
lines have the form `<rule> : <expression>`, where the rule is what the user
would type and the expression is the result it produces. The first expression in
the forward section must equal the left side of the goal. The first expression
in the backward section must equal the right side. After each rule, the
expression after the `:` must match what the rule actually produces. The proof is
complete when the last forward expression equals the last backward expression.
The checker verifies all of this.

**Rule syntax** is the same text the user would type into the rule input fields:

- `= <expr>` -- algebra: assert current expression equals `<expr>`
- `= <expr> <ref1> <ref2> ...` -- algebra citing known facts by number
- `< <expr>` or `<= <expr>` -- inequality steps (with optional refs)
- `subst <n>` -- substitute using the right side of fact `<n>`
- `unsub <n>` -- substitute using the left side of fact `<n>`
- `subst <n> (<expr>)` -- substitute with an explicit result expression
- `defof <name>_<n>` -- apply the `<n>`th case of function `<name>`
- `undef <name>_<n>` -- reverse-apply the `<n>`th case of function `<name>`

Backward rules use the tactic syntax (expression before the operator):

- `(<expr>) =` -- algebra: assert `<expr>` equals the current goal
- `(<expr>) = <ref1> ...` -- algebra citing known facts
- `subst <n>`, `unsub <n>`, `defof ...`, `undef ...` -- same as forward

**UI correspondence:** In the UI, the user sees the full chain of expressions
displayed in the `CalcBlock`. Forward rules are typed in the **top** input
field; backward rules in the **bottom** input field. After each rule is applied,
the resulting expression appears in the chain. In a `.prf` file, each step is
`<rule> : <expression>` on one line — the rule is what the user types, the
expression is what appears in the chain. The checker verifies they match.

**Difference:** The UI allows the user to delete the last rule (undo) and
re-enter it. A `.prf` file only contains the final sequence. The UI also shows
autocomplete suggestions; the `.prf` file contains only the final text that was
(or would be) submitted.

### 4b. `induction` proof body

An induction proof body contains one `case` block per constructor of the
inductive type, in constructor declaration order.

```
prove <formula> by induction on <var>

case <ctor1>: prove <sub-goal 1> by <method>
  <proof body for case 1>

case <ctor2>(<arg1>, <arg2>): prove <sub-goal 2> by <method>
  <proof body for case 2>
```

Each case line must state the sub-goal with `prove <formula>`. The checker
verifies that the stated formula matches the goal computed by `buildCases()`.
This catches mistakes like swapping case order or writing the wrong
substitution. The case label (e.g. `nil` or `cons(a, A)`) is not checked --
cases are matched to constructors by position.

Each case has its own `by <method>` and a nested proof body, which can be any
proof method (calculate, induction, or cases). This makes the format recursive.

**UI correspondence:** When the user selects "induction on xs", `InductionBlock`
calls `buildCases()` to generate one sub-proof per constructor. Each sub-proof
is a nested `ProofBlock` where the user selects a method and enters proof steps.
The checker calls the same `buildCases()` function from `proof/induction.ts` to
generate the goals and environments, then checks each case's nested proof.

The checker and UI both:
- Call `buildCases()` from `proof/induction.ts` with the same arguments
- Use the returned `goal` and `env` (which includes induction hypotheses as
  numbered facts) for each case
- Recursively check/display a nested proof for each case

### 4c. `cases` proof body

A proof by cases has exactly two blocks: `case then` and `case else`.

```
prove <formula> by cases on <condition>

case then: by <method>
  <proof body for the "condition holds" case>

case else: by <method>
  <proof body for the "condition negated" case>
```

The `<condition>` must use `<` or `<=` (not `=`). The "then" case gets the
condition as an additional known fact. The "else" case gets the negated
condition: `a < b` negates to `b <= a`, and `a <= b` negates to `b < a`.

Each case has its own `by <method>` and nested proof body.

**UI correspondence:** When the user selects "cases on x < y", `CasesBlock`
calls `buildCasesOnCondition()` from `proof/cases.ts` to create the two nested
environments. The checker calls the same function. Both get back a `CasesInfo`
with `thenEnv` (condition as a fact) and `elseEnv` (negated condition as a
fact), and recursively prove the goal in each environment.

---

## Differences between .prf checking and the UI

| Aspect | UI | .prf checker |
|---|---|---|
| Undo | User can delete and re-enter the last rule | Only the final rule sequence is recorded |
| Autocomplete | Rule input shows suggestions as the user types | Not applicable |
| Induction case labels | Displayed with constructor names and argument types | Present but not validated (matched by position) |
| Setup vs proof split | Goal formula and proof method entered in separate steps | Combined on one `prove ... by ...` line |

All proof logic lives in `src/proof/` and is shared by both the UI and the
checker:

| Function | Module | Used by |
|---|---|---|
| `applyForwardRule` | `proof/calc_proof.ts` | CalcBlock, checker |
| `applyBackwardRule` | `proof/calc_proof.ts` | CalcBlock, checker |
| `isComplete` | `proof/calc_proof.ts` | CalcBlock, checker |
| `checkValidity` | `proof/calc_proof.ts` | CalcBlock, checker |
| `buildCases` | `proof/induction.ts` | InductionBlock, checker |
| `buildCasesOnCondition` | `proof/cases.ts` | CasesBlock, checker |

The only code unique to the checker is parsing `.prf` files and calling these
functions with the parsed data. The only code unique to the UI is rendering and
handling user interaction.

---

## Complete example

```
type List
| nil : List
| cons : (Int, List) -> List

def len : (List) -> Int
| len(nil) => 0
| len(cons(a, L)) => 1 + len(L)

var xs : List

prove 0 + len(xs) = len(xs) by induction on xs

case nil: prove 0 + len(nil) = len(nil) by calculation
  0 + len(nil)
  defof len_1 (0 + 0) : 0 + 0
  = 0 : 0
  ---
  len(nil)
  undef len_1 : 0

case cons(a, A): prove 0 + len(cons(a, A)) = len(cons(a, A)) by calculation
  0 + len(cons(a, A))
  defof len_2 : 0 + (1 + len(A))
  = 1 + len(A) 1 : 1 + len(A)
  ---
  len(cons(a, A))
  undef len_2 : 1 + len(A)
```

This proves `0 + len(xs) = len(xs)` by induction on `xs`:

- **Base case** (`xs = nil`): The goal is `0 + len(nil) = len(nil)`.
  Forward: start with `0 + len(nil)`, apply `defof len_1` to get `0 + 0`,
  then algebra gives `0`. Backward: start with `len(nil)`, apply `undef len_1`
  to get `0`. The frontiers meet at `0`.

- **Inductive case** (`xs = cons(a, A)`): The goal is
  `0 + len(cons(a, A)) = len(cons(a, A))` with induction hypothesis
  `0 + len(A) = len(A)` as known fact 1. Forward: start with
  `0 + len(cons(a, A))`, apply `defof len_2` to get `0 + (1 + len(A))`,
  then `= 1 + len(A) 1` uses algebra citing the IH to get `1 + len(A)`.
  Backward: start with `len(cons(a, A))`, apply `undef len_2` to get
  `1 + len(A)`. The frontiers meet at `1 + len(A)`.
