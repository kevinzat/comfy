# `src/egraph` — a minimal e-graph

This directory contains a small TypeScript port of the core e-graph data
structure from **egg** (Willsey, Nandi, Wang, Flatt, Tatlock, Panchekha —
*"egg: Fast and Extensible Equality Saturation"*, POPL 2021). Only the data
structure is ported; the pattern matcher, rewrite scheduler, and extraction
search that sit on top of egg are deliberately out of scope.

- Paper: <https://dl.acm.org/doi/10.1145/3434304> (also on arXiv: 2004.03082)
- Reference implementation: <https://github.com/egraphs-good/egg>, in
  particular [`src/egraph.rs`](https://github.com/egraphs-good/egg/blob/main/src/egraph.rs).
- Appendix A of the paper contains the pseudo-code this port follows.

## What is an e-graph?

An e-graph is a compact representation of a (potentially infinite) set of
equivalent expressions. It has three interlocking pieces:

1. A set of **e-classes**, each of which is an equivalence class under the
   relation we are maintaining (e.g., "equal as arithmetic expressions").
2. Inside each e-class, a set of **e-nodes**: labelled function applications
   `f(c₁, …, cₙ)` whose arguments are *e-class ids*, not sub-expressions.
3. A **union-find** over e-class ids and a **hashcons** mapping every
   canonical e-node to its canonical e-class.

The critical difference from an ordinary expression tree is that an e-node's
children are e-classes, not other e-nodes. That gives an e-graph two useful
invariants:

- **Congruence.** If e-class `A` is merged with `A'`, then `f(A, B)` and
  `f(A', B)` become the *same* e-node by canonicalisation — every expression
  that was built atop the old classes automatically follows.
- **Sharing.** Every structurally-equal sub-expression lives in exactly one
  e-class, because the hashcons deduplicates on insertion.

Together these let an e-graph hold, in linear space, what would otherwise
be an exponential number of equivalent expression trees.

## What's in this port

[`egraph.ts`](./egraph.ts) exposes a single class, `EGraph`, with the
operations you need to build and query an e-graph:

| Method | Purpose |
|---|---|
| `add(expr)` / `addNode(node)` | Insert an `Expression` (or raw `ENode`), return its e-class id. Deduplicates on canonical key. |
| `find(id)` | Canonicalise an e-class id via union-find with path compression. |
| `union(a, b)` | Merge two e-classes. *Does not* restore congruence on its own. |
| `rebuild()` | Restore the congruence invariant after a batch of unions. Must be called before querying. |
| `equiv(a, b)` | `find(a) === find(b)`. |
| `lookup(node)` | Canonical class containing an equivalent e-node, or `undefined`. |
| `extract(id)` | Rebuild a concrete `Expression` by picking the smallest representative of each class. |
| `classCount`, `nodeCount`, `classIds`, `classNodes` | Introspection. |

The `Expression` type from `src/facts/exprs.ts` is used only at the
boundaries (`add` and `extract`); internally every argument is an
`EClassId: number`.

### Data layout

Inside `EGraph`:

```
ufParent:  EClassId[]                    // union-find parent array
ufRank:    number[]                      // union-find rank array
hashcons:  Map<string, EClassId>         // canonical e-node key -> canonical class
classes:   Map<EClassId, EClass>         // canonical class id -> class record
worklist:  EClassId[]                    // classes pending a congruence repair
```

An `EClass` stores its own id, the e-nodes it contains, and a list of
**parents**: (node, class-of-node) pairs for every e-node that has this
class as one of its children. The parents list is the engine that drives
upward congruence propagation — without it, every rebuild would need to
sweep every e-node in the graph.

Each e-node's canonical key is formed as `op|c1,c2,…` where the `cᵢ` are
`find(child_i)`. The `op` field uses a short prefix (`c:` for integer
constants, `v:` for variables, `f:` for function calls) so that a variable
named `foo` and a nullary call `foo()` never collide in the hashcons.

## How it works

### `add(expr)` / `addNode(node)`

Expressions are walked bottom-up so that every child already has a class
id by the time its parent node is inserted. For each e-node we compute its
canonical key; if the hashcons already has that key we return the existing
class (and the original object is discarded). Otherwise we allocate a
fresh class (union-find entry + `EClass` record), store the e-node in it,
and append a `{node, classId}` entry to each child class's `parents` list.

This is the operation the egg paper calls `add`, and the structure mirrors
`EGraph::add` in `src/egraph.rs`.

### `union(a, b)`

The hard part of union in an e-graph isn't the union-find itself — it's
what happens to *congruence*. Consider:

```
add f(x), f(y)           // two distinct classes, say 3 and 4
union(x, y)              // x and y are now equivalent
```

After the union, `f(x)` and `f(y)` are structurally equal e-nodes (their
arguments are in the same class). Classes 3 and 4 should therefore be
merged, and any parents of 3 and 4 might recursively need to merge, and so
on up the graph. A naive implementation would walk all parents on every
union, which is catastrophic for equality saturation.

egg's insight (§3 of the paper) is to **defer**: `union` does only the
cheap work (merge the union-find, concatenate the nodes and parents lists)
and pushes the merged class onto a worklist. The caller batches many
unions together and then calls `rebuild()` once. Between `union` and
`rebuild`, the hashcons can contain stale keys (keys whose `cᵢ` are
non-canonical) — but that's fine, because we always canonicalise on
lookup.

Union-by-rank is used so the union-find's `find` is
near-O(α(n)) amortised, matching the egg implementation.

### `rebuild()`

The repair loop:

```
while worklist is non-empty:
    todo = dedup(find(x) for x in worklist)
    worklist = []
    for id in todo:
        repair(id)
```

`repair(id)` does the actual congruence closure for one class:

1. Walk the class's `parents` list. For each parent, compute its current
   canonical key.
2. If two parents of this class produce the same key, their e-nodes are
   structurally equal by the current equivalence — so `union` their
   classes (which pushes a fresh entry onto the worklist for the outer
   loop to pick up).
3. Rewrite the hashcons entry for that key so it points to the canonical
   class.
4. Replace the `parents` list with the deduplicated, re-canonicalised
   version. Also deduplicate the class's own e-nodes (two of them may
   have become equal under the new equivalences).

This is the algorithm named `rebuild` in Appendix A of the paper and in
[`EGraph::process_unions` /
`rebuild`](https://github.com/egraphs-good/egg/blob/main/src/egraph.rs) in
the Rust source. A subtle point: during one pass of the inner `for` loop,
a `repair` call may `union` two classes that are *both* in the current
`todo`. When we later reach the absorbed class, its record is gone from
`classes` — the `if (!cls) return` at the top of `repair` handles that.

### Why deferred rebuild is fast

The naive "rebuild after every union" runs the upward propagation once
per union. The deferred version runs it once per batch, and (critically)
each e-class is visited O(number-of-times-its-root-changes) times — which,
summed over a saturation run, is bounded by the number of unions, not the
number of e-nodes. See §3.2 of the paper (the "amortised rebuild")
theorem) for the actual bound.

### When to call `rebuild`

The amortised bound relies on `rebuild` being called **in batches**, not
after every `union`. The standard equality-saturation pattern:

```ts
// one "iteration" of applying rewrites
for (const rule of rules) {
  for (const match of findMatches(egraph, rule)) {
    const newId = egraph.add(rule.apply(match));
    egraph.union(match.id, newId);
  }
}
egraph.rebuild();   // once, at the end of the iteration
```

The key rules:

- **Before any query, call `rebuild` once.** This includes `equiv`,
  `lookup`, `extract`, and any `add` whose result you're going to compare
  to existing classes. Without a rebuild, the answers reflect only the
  explicit unions you performed — they do not reflect the congruences
  those unions imply. Concretely: after `union(a, b)`, `equiv(f(a), f(b))`
  returns `false` until you `rebuild`, even though mathematically `f(a)`
  and `f(b)` are now equal. And the hashcons can be holding keys that
  canonicalised to pre-union ids, so a fresh `add` of a congruent
  expression can miss its correct class.
- **`union` itself does not require a prior rebuild.** It only touches
  the union-find and appends to the worklist. So the standard pattern is
  many `union`s in a row, followed by one `rebuild`, then queries.
- **Don't call `rebuild` inside the inner rewrite-application loop.**
  That's the pattern that degenerates to the classical, quadratic
  behaviour: every union pays for the full upward walk instead of
  amortising it across the batch.
- **`rebuild` is cheap when there's nothing to do.** If the worklist is
  empty (no `union` since the last call), it returns immediately, so it
  is safe to call defensively before every batch of queries.

Why batching matters: egg's amortised analysis (Theorem 4.2 in the paper,
or "Proposition 1" in the appendix) bounds the total work across an
entire equality-saturation run by O(n·α(n)) where `n` is roughly the
number of e-nodes touched — but *only* when rebuilds are batched across
rewrite iterations. Per-`union` rebuilds turn that into Θ(n²) because
every intermediate congruence is re-discovered up the parent chain as if
from scratch. Section 3 of the paper compares the two regimes directly
(their Figure 5 shows roughly a 5–50× speedup on real benchmarks from
batching).

A good mental model: think of `union` as "mark these two classes
equivalent" and `rebuild` as "propagate all the marks". The propagation
cost is the same whether you pay it per-mark or per-batch — but doing it
per-batch lets the work collapse (two parents that would each trigger
their own rebuild in the classical scheme are now merged in a single
pass).

### `extract(id)`

The port includes a simple "smallest tree" extractor: iterate over every
class, compute the cheapest e-node (children's cost + 1), and iterate to
a fixpoint. This is the textbook extraction algorithm and matches
[`Extractor::find_best`](https://github.com/egraphs-good/egg/blob/main/src/extract.rs)
with cost function `AstSize`. More sophisticated strategies (ILP, greedy
top-down with memoisation, etc.) would live alongside this if the project
ever grows toward that.

## What's intentionally missing

- **Pattern matching.** egg's `Searcher` / `Applier` machinery, the e-matching
  algorithm, and the rewrite scheduler are all omitted.
- **Analyses.** egg lets each class carry a piece of user-defined data that
  is merged on `union`; none of that is here.
- **Persistent / undo-able operations.** `union` is destructive, as in egg.
- **Specialised extraction.** Only a size-based cost function is provided.

Adding any of these on top of this data structure is straightforward in
principle — they all go through `add` / `union` / `lookup` / `rebuild`.

## Performance notes

See the main discussion for this port. The asymptotic complexity matches
egg's, because the algorithm is the same. The constant factors are
higher in TypeScript than in Rust:

- Canonical keys are strings rather than hashed value types, so `keyOf`
  allocates on every call.
- E-nodes and class records are heap-allocated JS objects; egg uses
  contiguous `Vec`s and `SmallVec`s.
- JS `Map` is keyed by string (in our case); we cannot use an e-node
  object directly as a key.

For proof-assistant-sized workloads (hundreds to a few thousand e-nodes)
this is fine. For egg-scale workloads (millions of e-nodes across a
saturation run), the constant factors would matter a lot.
