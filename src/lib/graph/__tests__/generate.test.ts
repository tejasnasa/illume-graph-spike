/**
 * Synthetic generator tests.
 *
 * Determinism is the load-bearing property here. If two runs of the same configuration
 * produced different graphs, every renderer comparison in this project would be measuring
 * the generator instead of the renderer.
 */

import { describe, expect, it } from "vitest";

import { generateGraph } from "../generate";

describe("generateGraph", () => {
  it("is deterministic for a given seed", () => {
    const a = generateGraph({ nodeCount: 500, seed: 7 });
    const b = generateGraph({ nodeCount: 500, seed: 7 });

    expect(a.nodes).toEqual(b.nodes);
    expect(a.links).toEqual(b.links);
  });

  it("produces different graphs for different seeds", () => {
    const a = generateGraph({ nodeCount: 500, seed: 1 });
    const b = generateGraph({ nodeCount: 500, seed: 2 });

    expect(a.links).not.toEqual(b.links);
  });

  it("produces exactly the requested number of nodes", () => {
    for (const nodeCount of [1, 10, 500, 2_500]) {
      expect(generateGraph({ nodeCount }).nodes).toHaveLength(nodeCount);
    }
  });

  it("assigns every node a unique id and path", () => {
    const { nodes } = generateGraph({ nodeCount: 1_000 });

    expect(new Set(nodes.map((n) => n.id)).size).toBe(nodes.length);
    expect(new Set(nodes.map((n) => n.path)).size).toBe(nodes.length);
  });

  it("never emits a self-link", () => {
    const { links } = generateGraph({ nodeCount: 1_000 });
    expect(links.every((l) => l.source !== l.target)).toBe(true);
  });

  it("never emits a duplicate link", () => {
    const { links } = generateGraph({ nodeCount: 1_000 });
    const keys = new Set(links.map((l) => `${l.source}->${l.target}`));
    expect(keys.size).toBe(links.length);
  });

  it("only references nodes that exist", () => {
    const { nodes, links } = generateGraph({ nodeCount: 500 });
    const ids = new Set(nodes.map((n) => n.id));

    expect(links.every((l) => ids.has(l.source) && ids.has(l.target))).toBe(true);
  });

  it("reports fan-in and fan-out consistent with the link list", () => {
    const { nodes, links } = generateGraph({ nodeCount: 1_000 });

    const computedIn = new Map<string, number>();
    const computedOut = new Map<string, number>();
    for (const link of links) {
      computedOut.set(link.source, (computedOut.get(link.source) ?? 0) + 1);
      computedIn.set(link.target, (computedIn.get(link.target) ?? 0) + 1);
    }

    for (const node of nodes) {
      expect(node.fan_in).toBe(computedIn.get(node.id) ?? 0);
      expect(node.fan_out).toBe(computedOut.get(node.id) ?? 0);
    }
  });

  it("produces a heavy-tailed fan-in, not a uniform one", () => {
    // The whole point of preferential attachment: a few hubs, a long tail. A uniform
    // random graph would have no hubs, and hubs are what make rendering expensive.
    const { nodes } = generateGraph({ nodeCount: 5_000 });
    const sorted = nodes.map((n) => n.fan_in).sort((a, b) => b - a);

    const topOnePercent = sorted.slice(0, 50).reduce((sum, n) => sum + n, 0);
    const total = sorted.reduce((sum, n) => sum + n, 0);

    expect(topOnePercent / total).toBeGreaterThan(0.2);
  });

  it("keeps the criticality mix stable as node count grows", () => {
    // Assigned by quantile rather than absolute threshold, so a 25k graph does not end up
    // almost entirely "critical" and stop being colour-comparable with a 500-node graph.
    for (const nodeCount of [500, 5_000]) {
      const { nodes } = generateGraph({ nodeCount });
      const critical = nodes.filter((n) => n.criticality === "critical").length;
      const ratio = critical / nodeCount;

      expect(ratio).toBeGreaterThan(0.02);
      expect(ratio).toBeLessThan(0.12);
    }
  });

  it("gives every node a line count of at least 10", () => {
    // The web client floors node radius at 10 LOC; a node below that would render at the
    // floor and make size comparisons meaningless.
    const { nodes } = generateGraph({ nodeCount: 1_000 });
    expect(nodes.every((n) => n.loc >= 10)).toBe(true);
  });
});
