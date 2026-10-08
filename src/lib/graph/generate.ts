/**
 * Synthetic dependency graphs.
 *
 * The bundled sample payloads in the real client top out at 281 nodes, which is two orders
 * of magnitude below the range that actually stresses a phone GPU. These generators produce
 * graphs at the sizes that matter, with a degree distribution that resembles a real
 * repository rather than a uniform mesh — a handful of hubs with high fan-in, a long tail of
 * leaves with almost none.
 *
 * A uniform random graph would be a misleading benchmark: it has no hubs, and hubs are what
 * concentrate the instanced geometry and the link density that make rendering expensive.
 *
 * @module lib/graph/generate
 */

import { mulberry32, weightedPick } from "./random";
import type { Criticality, GraphData, GraphLink, GraphNode } from "./types";

/** Options for {@link generateGraph}. */
export interface GenerateOptions {
  /** How many nodes to produce. */
  nodeCount: number;
  /** PRNG seed. Identical seeds produce identical graphs. */
  seed?: number;
}

const LANGUAGES = [
  "typescript",
  "python",
  "javascript",
  "go",
  "rust",
  "java",
] as const;

const TOP_DIRS = [
  "core",
  "api",
  "services",
  "models",
  "utils",
  "components",
  "hooks",
  "tasks",
  "db",
  "lib",
  "tests",
  "scripts",
] as const;

const SUB_DIRS = [
  "internal",
  "v1",
  "shared",
  "runtime",
  "parsers",
  "handlers",
  "",
] as const;

const STEMS = [
  "index",
  "client",
  "server",
  "config",
  "parser",
  "resolver",
  "builder",
  "adapter",
  "registry",
  "session",
  "worker",
  "scheduler",
  "cache",
  "router",
  "schema",
  "mapper",
  "store",
  "queue",
  "pool",
  "token",
] as const;

/**
 * Draw a heavy-tailed integer.
 *
 * Most draws land near 1; a small fraction reach `max`. This is the shape that produces
 * hubs, and it is deliberately not a uniform distribution.
 *
 * @param rand - Seeded PRNG.
 * @param max - Inclusive upper bound.
 * @param exponent - Larger values push more mass toward 1.
 * @returns An integer in `[1, max]`.
 */
function heavyTail(rand: () => number, max: number, exponent: number): number {
  return Math.max(1, Math.min(max, Math.floor(max * rand() ** exponent) + 1));
}

/**
 * Build a synthetic repository graph.
 *
 * Deterministic for a given `(nodeCount, seed)` pair, so two renderers can be compared
 * against identical input.
 *
 * @param options - Node count and optional seed.
 * @returns A graph in the same shape as the backend's payload.
 */
export function generateGraph({ nodeCount, seed = 1 }: GenerateOptions): GraphData {
  const rand = mulberry32(seed);
  const nodes: GraphNode[] = [];

  // ── Nodes ──
  // Paths are built from a shallow directory tree so `group` looks like a real repo and
  // the layout has some cluster structure to reveal.
  for (let i = 0; i < nodeCount; i += 1) {
    const top = TOP_DIRS[Math.floor(rand() * TOP_DIRS.length)];
    const sub = SUB_DIRS[Math.floor(rand() * SUB_DIRS.length)];
    const stem = STEMS[Math.floor(rand() * STEMS.length)];
    const suffix = i.toString(36);

    const dir = sub ? `src/${top}/${sub}` : `src/${top}`;
    nodes.push({
      id: `n${i}`,
      label: `${stem}-${suffix}`,
      path: `${dir}/${stem}-${suffix}.ts`,
      group: dir,
      kind: "file",
      // Roughly log-normal: most files are small, a few are very large.
      loc: Math.round(20 + rand() ** 3 * 800),
      criticality: "safe",
      criticality_score: 25,
      language: LANGUAGES[Math.floor(rand() * LANGUAGES.length)],
      fan_in: 0,
      fan_out: 0,
    });
  }

  // ── Preferential attachment weights ──
  // Rank a shuffled order, then weight by rank^-alpha. This gives the power-law shape:
  // a few nodes attract most of the links.
  const order = nodes.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }

  // Indexed by *rank*, not by node id. The table has to be ascending for the binary search
  // in `weightedPick` to be valid, and prefix sums in shuffled order are not — so the draw
  // returns a rank, which `order` then maps back to a node.
  const cumulative = new Float64Array(nodeCount);
  let total = 0;
  for (let rank = 0; rank < nodeCount; rank += 1) {
    total += 1 / (rank + 1) ** 1.1;
    cumulative[rank] = total;
  }

  // ── Links ──
  const seen = new Set<number>();
  const links: GraphLink[] = [];
  const fanOut = new Uint32Array(nodeCount);
  const fanIn = new Uint32Array(nodeCount);

  for (let i = 0; i < nodeCount; i += 1) {
    // Out-degree is heavy-tailed too: most files import one or two things, a barrel
    // imports dozens.
    const degree = heavyTail(rand, 12, 2.2);

    for (let k = 0; k < degree; k += 1) {
      const target = order[weightedPick(cumulative, rand() * total)];
      if (target === i) continue;

      // Dedupe on the ordered pair, mirroring the backend's collapsed edges.
      const key = i * nodeCount + target;
      if (seen.has(key)) continue;
      seen.add(key);

      links.push({
        source: `n${i}`,
        target: `n${target}`,
        type: "imports",
        weight: 1,
      });
      fanOut[i] += 1;
      fanIn[target] += 1;
    }
  }

  // ── Criticality ──
  // Assigned from fan-in and size, the two signals the real scorer uses. Thresholds are
  // quantiles rather than absolute counts so the mix stays constant as node count grows —
  // otherwise a 25k graph would be almost entirely "critical" and the colour distribution
  // would stop being comparable between sizes.
  // Ranked, not thresholded. A threshold drawn from the fan-in distribution lands on zero in
  // sparse graphs — most files import nothing at all — and then every node with any fan-in
  // becomes "critical", so the mix no longer matches the intended proportions and stops
  // being comparable between graph sizes. Ranking guarantees the mix regardless of how the
  // distribution happens to fall.
  const byFanIn = Array.from({ length: nodeCount }, (_, i) => i).sort(
    (a, b) => fanIn[b] - fanIn[a],
  );
  const criticalRank = Math.max(1, Math.floor(nodeCount * 0.05));
  const cautionRank = Math.max(criticalRank + 1, Math.floor(nodeCount * 0.2));

  for (let rank = 0; rank < nodeCount; rank += 1) {
    const i = byFanIn[rank];
    const hasCallers = fanIn[i] > 0;

    let bucket: Criticality = "safe";
    let score = 25;
    if (hasCallers && rank < criticalRank) {
      bucket = "critical";
      score = 100;
    } else if (hasCallers && rank < cautionRank) {
      bucket = "caution";
      score = 75;
    }

    nodes[i].criticality = bucket;
    nodes[i].criticality_score = score;
    nodes[i].fan_in = fanIn[i];
    nodes[i].fan_out = fanOut[i];
  }

  return { nodes, links };
}
