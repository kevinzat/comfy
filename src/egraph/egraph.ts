// A minimal e-graph (equivalence graph) data structure.
//
// An e-graph compactly represents an equivalence class of expressions. Each
// equivalence class ("e-class") contains one or more "e-nodes" — symbolic
// function applications whose children are themselves e-class ids rather than
// concrete sub-expressions. Merging two classes via `union` induces congruence:
// for every e-node f(x, y), if x's class is merged with x''s class, then the
// node f(x, y) becomes equivalent to f(x', y). `rebuild` propagates these
// congruences to a fixpoint.
//
// This is a port of the core data structure from egg (https://egraphs-good.github.io),
// described in Willsey et al., "egg: Fast and Extensible Equality Saturation"
// (POPL 2021). See README.md in this directory for details and references.

import {
  Expression, Constant, Variable, Call,
  EXPR_CONSTANT, EXPR_VARIABLE, EXPR_FUNCTION,
} from '../facts/exprs';


/** Identifier of an e-class. Stable under `find` only after `rebuild`. */
export type EClassId = number;


/**
 * A single e-node. `op` is a tagged operator string (see `opForConstant`,
 * `opForVariable`, `opForCall` below), and `children` are ids of the e-classes
 * that hold the node's arguments.
 */
export interface ENode {
  op: string;
  children: EClassId[];
}


/**
 * Operator tag for a constant node. The integer literal is encoded in the
 * operator itself so that two constants with different values become
 * distinct e-nodes. Uses a prefix to keep variable/function names from
 * colliding with numeric literals that happen to share their name.
 */
export function opForConstant(value: bigint): string {
  return `c:${value}`;
}

/** Operator tag for a variable node. */
export function opForVariable(name: string): string {
  return `v:${name}`;
}

/** Operator tag for an n-ary function call node. */
export function opForCall(name: string): string {
  return `f:${name}`;
}


/** Internal record of one e-class. */
interface EClass {
  /** Canonical id of this class (equals `find(id)` at rest). */
  id: EClassId;
  /** The e-nodes belonging to this class. May contain duplicates across
   * canonicalisations; rebuild deduplicates them. */
  nodes: ENode[];
  /** Upward pointers: e-nodes that have this class as one of their children,
   * paired with the id of the class that contains that parent node. Used by
   * rebuild to detect new congruences. */
  parents: Array<{ node: ENode; classId: EClassId }>;
}


export class EGraph {

  // Union-find over class ids.
  private ufParent: EClassId[] = [];
  private ufRank: number[] = [];

  // Maps from a canonical e-node key (see `keyOf`) to the canonical class id.
  private hashcons: Map<string, EClassId> = new Map();

  // All currently live canonical classes.
  private classes: Map<EClassId, EClass> = new Map();

  // Classes whose parents may have become congruent because of recent unions.
  // Processed by `rebuild`.
  private worklist: EClassId[] = [];


  // ------------------------------------------------------------------
  // Union-find
  // ------------------------------------------------------------------

  /** Returns the canonical id of the class containing `id`, with path
   * compression. */
  find(id: EClassId): EClassId {
    let root = id;
    while (this.ufParent[root] !== root) root = this.ufParent[root];
    let cur = id;
    while (this.ufParent[cur] !== root) {
      const next = this.ufParent[cur];
      this.ufParent[cur] = root;
      cur = next;
    }
    return root;
  }

  /** Returns true if `a` and `b` are in the same class. */
  equiv(a: EClassId, b: EClassId): boolean {
    return this.find(a) === this.find(b);
  }

  /** Unions the two classes. Does NOT restore congruence — call `rebuild`
   * afterwards (possibly batched with other unions). Returns the new
   * canonical id. */
  union(a: EClassId, b: EClassId): EClassId {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra === rb) return ra;

    // Union by rank: attach the shallower tree under the deeper one.
    let root: EClassId;
    let other: EClassId;
    if (this.ufRank[ra] < this.ufRank[rb]) {
      root = rb; other = ra;
    } else if (this.ufRank[ra] > this.ufRank[rb]) {
      root = ra; other = rb;
    } else {
      root = ra; other = rb;
      this.ufRank[ra]++;
    }
    this.ufParent[other] = root;

    // Merge the class contents. `other`'s record is discarded; we preserve
    // both its nodes and its parent pointers in the surviving `root` record.
    const rootCls = this.classes.get(root)!;
    const otherCls = this.classes.get(other)!;
    for (const n of otherCls.nodes) rootCls.nodes.push(n);
    for (const p of otherCls.parents) rootCls.parents.push(p);
    this.classes.delete(other);

    // Schedule root for a congruence repair pass.
    this.worklist.push(root);
    return root;
  }


  // ------------------------------------------------------------------
  // Hashcons / add / lookup
  // ------------------------------------------------------------------

  /** Returns the canonical key for an e-node, based on the current find()
   * values of its children. */
  private keyOf(node: ENode): string {
    if (node.children.length === 0) return node.op;
    const cs: EClassId[] = new Array(node.children.length);
    for (let i = 0; i < node.children.length; i++) {
      cs[i] = this.find(node.children[i]);
    }
    return `${node.op}|${cs.join(',')}`;
  }

  /** Returns a copy of `node` with each child id replaced by its canonical id. */
  private canonicalize(node: ENode): ENode {
    const cs: EClassId[] = new Array(node.children.length);
    for (let i = 0; i < node.children.length; i++) {
      cs[i] = this.find(node.children[i]);
    }
    return { op: node.op, children: cs };
  }

  /** Allocates a fresh class id and installs an empty class record for it. */
  private freshClass(): EClassId {
    const id = this.ufParent.length;
    this.ufParent.push(id);
    this.ufRank.push(0);
    this.classes.set(id, { id, nodes: [], parents: [] });
    return id;
  }

  /** Inserts an e-node into the graph. If an equivalent e-node (modulo the
   * current union-find) already exists, returns that class's id. */
  addNode(node: ENode): EClassId {
    const canon = this.canonicalize(node);
    const key = this.keyOf(canon);
    const existing = this.hashcons.get(key);
    if (existing !== undefined) return this.find(existing);

    const id = this.freshClass();
    const cls = this.classes.get(id)!;
    cls.nodes.push(canon);
    this.hashcons.set(key, id);

    // Record this new node as a parent of each of its children's classes,
    // so that future unions on those children trigger a congruence check
    // for this node.
    for (const childId of canon.children) {
      const childCls = this.classes.get(this.find(childId))!;
      childCls.parents.push({ node: canon, classId: id });
    }
    return id;
  }

  /** Inserts an Expression tree, returning the id of the resulting e-class. */
  add(expr: Expression): EClassId {
    if (expr.variety === EXPR_CONSTANT) {
      return this.addNode({ op: opForConstant(expr.value), children: [] });
    }
    if (expr.variety === EXPR_VARIABLE) {
      return this.addNode({ op: opForVariable(expr.name), children: [] });
    }
    // EXPR_FUNCTION
    const cs: EClassId[] = new Array(expr.args.length);
    for (let i = 0; i < expr.args.length; i++) {
      cs[i] = this.add(expr.args[i]);
    }
    return this.addNode({ op: opForCall(expr.name), children: cs });
  }

  /** Returns the class containing an equivalent e-node, or undefined. */
  lookup(node: ENode): EClassId | undefined {
    const id = this.hashcons.get(this.keyOf(node));
    return id === undefined ? undefined : this.find(id);
  }


  // ------------------------------------------------------------------
  // Rebuild (congruence closure)
  // ------------------------------------------------------------------

  /**
   * Restores the congruence invariant: for every pair of e-nodes with the
   * same operator and pairwise-equivalent children, the e-nodes must be in
   * the same e-class. Unions performed since the last rebuild may have
   * broken this invariant; rebuild walks the affected classes' parents and
   * unions any new congruences it finds, repeating to a fixpoint.
   */
  rebuild(): void {
    while (this.worklist.length > 0) {
      // Deduplicate by canonical id. Multiple entries may point to classes
      // that merged into the same root during a prior iteration.
      const seen = new Set<EClassId>();
      const todo: EClassId[] = [];
      for (const raw of this.worklist) {
        const c = this.find(raw);
        if (!seen.has(c)) { seen.add(c); todo.push(c); }
      }
      this.worklist = [];
      for (const id of todo) this.repair(id);
    }
  }

  /**
   * Repair pass for a single class: re-canonicalise its stored parent
   * e-nodes and detect congruences. If two parents canonicalise to the same
   * key they refer to structurally-equal nodes and must share an e-class;
   * we union them (and let the worklist propagate any follow-on work).
   */
  private repair(eclass: EClassId): void {
    const cls = this.classes.get(eclass);
    // Another todo entry earlier in this rebuild pass may have unioned this
    // class into a different one; skip it in that case.
    if (!cls) return;

    // Group parents by their current canonical key. Whenever we see a
    // duplicate, the old and new classes are congruent and must be merged.
    const byKey = new Map<string, { node: ENode; classId: EClassId }>();
    for (const p of cls.parents) {
      const canonNode = this.canonicalize(p.node);
      const key = this.keyOf(canonNode);
      const pClass = this.find(p.classId);
      const prev = byKey.get(key);
      if (prev !== undefined && prev.classId !== pClass) {
        const merged = this.union(prev.classId, pClass);
        byKey.set(key, { node: canonNode, classId: merged });
      } else {
        byKey.set(key, { node: canonNode, classId: pClass });
      }
      // Keep the hashcons pointing at the canonical class for this key.
      this.hashcons.set(key, this.find(pClass));
    }

    // Store the deduplicated parents back on the class, with nodes in their
    // freshly-canonical form.
    const deduped: Array<{ node: ENode; classId: EClassId }> = [];
    for (const entry of byKey.values()) {
      deduped.push({ node: entry.node, classId: this.find(entry.classId) });
    }
    cls.parents = deduped;

    // Also deduplicate the class's own e-nodes (two nodes that were not
    // structurally equal may have become so after the union).
    const nodeSeen = new Set<string>();
    const newNodes: ENode[] = [];
    for (const n of cls.nodes) {
      const canon = this.canonicalize(n);
      const key = this.keyOf(canon);
      if (nodeSeen.has(key)) continue;
      nodeSeen.add(key);
      newNodes.push(canon);
    }
    cls.nodes = newNodes;
  }


  // ------------------------------------------------------------------
  // Extraction
  // ------------------------------------------------------------------

  /**
   * Extracts a concrete Expression from the class `id`. Chooses the e-node
   * with the smallest total tree size in each class, breaking ties
   * arbitrarily. Assumes `rebuild` has already been run.
   */
  extract(id: EClassId): Expression {
    const costs = this.computeExtractionCosts();
    return this.buildExpr(this.find(id), costs);
  }

  /** Returns, for each canonical class, the cheapest (size, node) pair. */
  private computeExtractionCosts(): Map<EClassId, { cost: number; node: ENode }> {
    const costs = new Map<EClassId, { cost: number; node: ENode }>();
    let changed = true;
    // Iterate to a fixpoint. Each pass can only lower costs, and costs are
    // bounded below by 1, so this terminates in finitely many passes. A class
    // whose only nodes reference not-yet-costed classes is skipped this pass
    // and retried on the next — its children may become costable later.
    while (changed) {
      changed = false;
      for (const cls of this.classes.values()) {
        let best: { cost: number; node: ENode } | undefined;
        for (const node of cls.nodes) {
          let total = 1;
          let ok = true;
          for (const child of node.children) {
            const childCost = costs.get(this.find(child));
            if (childCost === undefined) { ok = false; break; }
            total += childCost.cost;
          }
          if (!ok) continue;
          if (best === undefined || total < best.cost) {
            best = { cost: total, node };
          }
        }
        if (best === undefined) continue;
        const prev = costs.get(cls.id);
        if (prev === undefined || prev.cost > best.cost) {
          costs.set(cls.id, best);
          changed = true;
        }
      }
    }
    // At the fixpoint, any class still without a cost is part of a pure
    // function-call cycle with no leaf anywhere reachable — not extractable.
    for (const cls of this.classes.values()) {
      /* v8 ignore start */
      if (!costs.has(cls.id))
        throw new Error(`no costable node for class ${cls.id}`);
      /* v8 ignore stop */
    }
    return costs;
  }

  /** Recursively reconstruct the Expression for a class using `costs`. */
  private buildExpr(
      id: EClassId,
      costs: Map<EClassId, { cost: number; node: ENode }>): Expression {
    const canonId = this.find(id);
    const best = costs.get(canonId)!;
    const node = best.node;
    if (node.children.length === 0) {
      // Leaf: recover the original kind from the op prefix.
      if (node.op.startsWith('c:')) {
        return Constant.of(BigInt(node.op.slice(2)));
      }
      if (node.op.startsWith('v:')) {
        return Variable.of(node.op.slice(2));
      }
      // Nullary function call, e.g. "f:foo" for foo().
      return Call.of(node.op.slice(2));
    }
    const args: Expression[] = new Array(node.children.length);
    for (let i = 0; i < node.children.length; i++) {
      args[i] = this.buildExpr(node.children[i], costs);
    }
    return new Call(node.op.slice(2), args);
  }


  // ------------------------------------------------------------------
  // Introspection
  // ------------------------------------------------------------------

  /** Number of canonical (live) classes. */
  classCount(): number {
    return this.classes.size;
  }

  /** Total e-node count across all classes. */
  nodeCount(): number {
    let n = 0;
    for (const cls of this.classes.values()) n += cls.nodes.length;
    return n;
  }

  /** Canonical class ids, in no particular order. */
  classIds(): EClassId[] {
    return Array.from(this.classes.keys());
  }

  /** Returns a defensive copy of the e-nodes belonging to a class. Accepts
   * any id in the class (canonical or not). */
  classNodes(id: EClassId): ENode[] {
    const cls = this.classes.get(this.find(id))!;
    return cls.nodes.map(n => ({ op: n.op, children: n.children.slice() }));
  }
}
