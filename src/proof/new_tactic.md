# Adding a New Proof Tactic

This guide explains how to add a new proof tactic (e.g., "strong induction",
"contradiction"). A tactic decomposes a proof goal into sub-goals that the
user proves independently.

## What you need to change

### 1. New tactic file (e.g., `src/proof/strong_induction.ts`)

This is where the core logic lives. You need:

**A class implementing `ProofTactic`** with a `decompose()` method that returns
`ProofGoal[]`. Each `ProofGoal` has:
- `label` -- displayed as "Case {label}:" in the UI
- `goal` -- the sub-goal (a `Prop`) to prove
- `env` -- the environment for this case, with any new variables/facts/theorems
- `newTheorems` -- theorems introduced in this case (displayed under
  "Induction hypotheses:")
- `newFacts` -- facts introduced in this case (displayed as numbered knowns)

**A `ProofMethodParser`** with two methods:
- `tryParse(text, formula, env, premises)` -- parse the method text (e.g.,
  "strong induction on n"), validate against the environment, and return a
  `ProofTactic`. Return `null` if the text doesn't match this tactic, or a
  string error message if it matches but is invalid.
- `getMatches(text, formula, env)` -- return autocomplete `Match[]` for partial
  input.

Use `parseTacticMethod()` inside `tryParse` for the text parsing (see step 2).

See `induction.ts` or `cases.ts` for examples.

### 2. `src/proof/proof_tactic.ts`

Three changes:

1. **Add a variant to `TacticMethod`** and a regex to `parseTacticMethod()`.
   This is the shared parser used by both the UI and the proof file parser.

2. **Add your parser to the `parsers` array.** This enables UI parsing and
   code completion.

3. **Add a case to `CreateProofTactic()`.** This is the factory used by the
   proof file checker to create your tactic from a parsed proof file.

### 3. `src/proof/lean.ts`

Add a case to `proofToLean()` for generating Lean 4 code from your tactic.
Each tactic maps to different Lean syntax (e.g., `induction ... with` vs
`by_cases h`), so this is inherently per-tactic.

## What you get for free

The following require zero changes when adding a new tactic:

- **Proof file parsing** (`proof_file.ts`) -- the parser reads `prove ... by
  <method>` and then parses case blocks generically. Any tactic that
  decomposes into labeled cases is handled automatically.

- **Proof file checking** (`proof_file_checker.ts`) -- the checker calls
  `decompose()` on your tactic, gets the expected `ProofGoal[]`, and validates
  each stated case block against the corresponding goal. No per-tactic code.

- **UI rendering** (`ProofBlock.tsx`, `ProofGoalBlock.tsx`) -- the UI calls
  `ParseProofMethod()` to get your tactic, calls `decompose()` to get the
  sub-goals, and renders them generically. Each case shows its label, theorems,
  facts, and a nested proof block.

- **UI code completion** -- `FindProofMethodMatches()` aggregates matches from
  all registered parsers. Your `getMatches` method is called automatically.

## Proof file format

A tactic proof in a `.prf` file looks like:

```
prove <theorem> by <method text>
case <label>:
given IH (params) : <formula>     -- optional, for theorems
given N. <formula>                 -- optional, for facts
prove <goal> by <sub-method>
  <sub-proof>
case <label>:
  ...
```

The parser reads case blocks until it finds a non-case line. The checker
validates that the number and content of cases match what `decompose()` returns.
