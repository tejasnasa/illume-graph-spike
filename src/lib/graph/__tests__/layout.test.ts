/**
 * Layout tests.
 *
 * The simulation is the part of the pipeline that runs identically for every renderer, so
 * what matters here is that it produces well-formed output and stays off the render
 * measurement — not that the layout is pretty.
 */

import { describe, expect, it } from "vitest";

import { generateGraph } from "../generate";
import { boundingRadius, computeLayout, defaultTicks } from "../layout";

describe("defaultTicks", () => {
  it("decreases as the graph grows", () => {
    // A 25k graph at 300 ticks would spend minutes in the simulation, which would make the
    // largest size untestable.
    expect(defaultTicks(500)).toBeGreaterThan(defaultTicks(5_000));
    expect(defaultTicks(5_000)).toBeGreaterThan(defaultTicks(25_000));
  });

  it("never returns zero or a negative count", () => {
    for (const count of [1, 500, 1_000, 5_000, 10_000, 25_000]) {
      expect(defaultTicks(count)).toBeGreaterThan(0);
    }
  });
});

describe("computeLayout", () => {
  it("produces one xyz triple per node", async () => {
    const graph = generateGraph({ nodeCount: 100, seed: 3 });
    const result = await computeLayout(graph, { ticks: 5 });

    expect(result.positions).toHaveLength(graph.nodes.length * 3);
  });

  it("produces finite coordinates", async () => {
    const graph = generateGraph({ nodeCount: 200, seed: 4 });
    const result = await computeLayout(graph, { ticks: 10 });

    for (const value of result.positions) {
      expect(Number.isFinite(value)).toBe(true);
    }
  });

  it("runs the requested number of ticks", async () => {
    const graph = generateGraph({ nodeCount: 50, seed: 5 });
    const result = await computeLayout(graph, { ticks: 12 });

    expect(result.ticks).toBe(12);
  });

  it("reports progress once per chunk and finishes at the total", async () => {
    const graph = generateGraph({ nodeCount: 50, seed: 6 });
    const seen: Array<[number, number]> = [];

    const result = await computeLayout(graph, {
      ticks: 10,
      chunkSize: 4,
      onProgress: (done, total) => seen.push([done, total]),
    });

    expect(seen).toEqual([
      [4, 10],
      [8, 10],
      [10, 10],
    ]);
    expect(seen[seen.length - 1][0]).toBe(result.ticks);
  });

  it("resolves links to node indices", async () => {
    const graph = generateGraph({ nodeCount: 100, seed: 7 });
    const result = await computeLayout(graph, { ticks: 5 });

    for (const link of result.links) {
      expect(link.source).toBeGreaterThanOrEqual(0);
      expect(link.source).toBeLessThan(graph.nodes.length);
      expect(link.target).toBeGreaterThanOrEqual(0);
      expect(link.target).toBeLessThan(graph.nodes.length);
    }
  });

  it("is deterministic for the same input", async () => {
    const graph = generateGraph({ nodeCount: 100, seed: 8 });
    const a = await computeLayout(graph, { ticks: 8 });
    const b = await computeLayout(graph, { ticks: 8 });

    expect(Array.from(a.positions)).toEqual(Array.from(b.positions));
  });

  it("separates nodes rather than collapsing them onto the origin", async () => {
    const graph = generateGraph({ nodeCount: 300, seed: 9 });
    const result = await computeLayout(graph, { ticks: 50 });

    expect(boundingRadius(result.positions)).toBeGreaterThan(1);
  });

  it("handles an empty graph without throwing", async () => {
    const result = await computeLayout({ nodes: [], links: [] }, { ticks: 5 });

    expect(result.positions).toHaveLength(0);
    expect(result.links).toHaveLength(0);
  });

  it("drops links that reference a missing node rather than emitting NaN indices", async () => {
    const graph = generateGraph({ nodeCount: 10, seed: 10 });
    graph.links.push({ source: "n0", target: "does-not-exist", type: "imports", weight: 1 });

    const result = await computeLayout(graph, { ticks: 5 });

    expect(result.links).toHaveLength(graph.links.length - 1);
  });
});

describe("boundingRadius", () => {
  it("returns the distance of the furthest node", () => {
    const positions = new Float32Array([0, 0, 0, 3, 4, 0]);
    expect(boundingRadius(positions)).toBeCloseTo(5, 6);
  });

  it("returns 1 for an empty graph so callers never divide by zero", () => {
    expect(boundingRadius(new Float32Array([]))).toBe(1);
  });

  it("returns 1 when every node sits at the origin", () => {
    expect(boundingRadius(new Float32Array([0, 0, 0, 0, 0, 0]))).toBe(1);
  });
});
