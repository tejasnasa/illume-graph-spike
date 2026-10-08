/**
 * Force-directed layout, shared by every renderer.
 *
 * The simulation is deliberately run to a fixed tick count *before* rendering begins and
 * then stopped. That isolates the two costs the benchmark exists to separate:
 *
 *   - simulation cost, reported once as `simulationMs`
 *   - render cost, measured as sustained FPS once positions are frozen
 *
 * Leaving the simulation running while measuring FPS would conflate them, and a renderer
 * that happened to be slower at drawing would look like a renderer with worse physics.
 *
 * `d3-force-3d` is the same simulation the real client uses under `react-force-graph-3d`,
 * so the layout matches production rather than approximating it.
 *
 * @module lib/graph/layout
 */

import {
  forceCenter,
  forceLink,
  forceManyBody,
  forceSimulation,
  type SimulationNodeDatum,
} from "d3-force-3d";
import type { GraphData } from "./types";

/** A simulation node, carrying its position in three dimensions. */
interface SimNode extends SimulationNodeDatum {
  id: string;
}

/** A link resolved to node indices rather than ids. */
export interface IndexedLink {
  source: number;
  target: number;
}

/** What {@link computeLayout} produces. */
export interface LayoutResult {
  /** `xyz` triples, one per node, in node order. */
  positions: Float32Array;
  /** Links resolved to node indices. */
  links: IndexedLink[];
  /** Wall-clock time spent simulating, in milliseconds. */
  simulationMs: number;
  /** How many ticks were actually run. */
  ticks: number;
}

/** Tuning for {@link computeLayout}. */
export interface LayoutOptions {
  /** Total simulation ticks. More ticks means a more settled layout and more time. */
  ticks?: number;
  /** Ticks between yields, so progress can paint. Smaller keeps the UI responsive. */
  chunkSize?: number;
  /** Repulsion strength. Scaled by node count if omitted. */
  chargeStrength?: number;
  /** Called after each chunk with ticks completed so far. */
  onProgress?: (done: number, total: number) => void;
}

/**
 * Choose a default tick count for a graph size.
 *
 * Large graphs get fewer ticks: the layout is worse, but the benchmark is about rendering
 * and spending a minute in the simulation would make the 25k case untestable. The
 * resulting layout is still legible, and identical across renderers either way.
 *
 * @param nodeCount - Number of nodes.
 * @returns A tick count.
 */
export function defaultTicks(nodeCount: number): number {
  if (nodeCount <= 1_000) return 300;
  if (nodeCount <= 5_000) return 200;
  if (nodeCount <= 10_000) return 150;
  return 100;
}

/**
 * Yield to the event loop so React can paint progress.
 *
 * `setTimeout(0)` rather than a microtask: a microtask would drain before the renderer got
 * a chance to commit, so the progress bar would never move.
 *
 * @returns A promise resolving on the next macrotask.
 */
function yieldToUI(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Run a 3D force simulation and freeze the result.
 *
 * @param data - The graph to lay out.
 * @param options - Tick count, chunk size, and progress callback.
 * @returns Positions, indexed links, and timing.
 */
export async function computeLayout(
  data: GraphData,
  options: LayoutOptions = {},
): Promise<LayoutResult> {
  const nodeCount = data.nodes.length;
  const ticks = options.ticks ?? defaultTicks(nodeCount);
  const chunkSize = options.chunkSize ?? 10;
  const chargeStrength = options.chargeStrength ?? -30;

  const simNodes: SimNode[] = data.nodes.map((node) => ({ id: node.id }));
  const indexById = new Map<string, number>();
  simNodes.forEach((node, i) => indexById.set(node.id, i));

  const simLinks: IndexedLink[] = [];
  for (const link of data.links) {
    const source = indexById.get(link.source);
    const target = indexById.get(link.target);
    if (source === undefined || target === undefined) continue;
    simLinks.push({ source, target });
  }

  // The link force rewrites `source` and `target` from indices into node references, so it
  // gets throwaway copies. Handing it `simLinks` directly would leave the returned array
  // holding objects where the renderers expect numbers.
  //
  // The `id` accessor is deliberately left at its default, which is positional. Overriding
  // it with the node's string id would make d3 try to resolve the numeric indices in these
  // links against that accessor and fail with "node not found".
  const forceLinks = simLinks.map((link) => ({
    source: link.source,
    target: link.target,
  }));

  const started = Date.now();

  const sim = forceSimulation(simNodes, 3)
    .force(
      "link",
      forceLink<SimNode, { source: number; target: number }>(forceLinks)
        .distance(30)
        .strength(0.3),
    )
    .force("charge", forceManyBody().strength(chargeStrength))
    .force("center", forceCenter(0, 0, 0))
    .stop();

  for (let done = 0; done < ticks; done += chunkSize) {
    const end = Math.min(done + chunkSize, ticks);
    for (let t = done; t < end; t += 1) sim.tick();
    options.onProgress?.(end, ticks);
    if (end < ticks) await yieldToUI();
  }

  const simulationMs = Date.now() - started;

  const positions = new Float32Array(nodeCount * 3);
  for (let i = 0; i < nodeCount; i += 1) {
    positions[i * 3] = simNodes[i].x ?? 0;
    positions[i * 3 + 1] = simNodes[i].y ?? 0;
    positions[i * 3 + 2] = simNodes[i].z ?? 0;
  }

  return { positions, links: simLinks, simulationMs, ticks };
}

/**
 * Find the radius that contains every node.
 *
 * Used to frame the camera without hardcoding a distance, so a 500-node graph and a
 * 25,000-node graph both fill the viewport sensibly.
 *
 * @param positions - `xyz` triples.
 * @returns The maximum distance from the origin.
 */
export function boundingRadius(positions: Float32Array): number {
  let maxSq = 0;
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i];
    const y = positions[i + 1];
    const z = positions[i + 2];
    const d = x * x + y * y + z * z;
    if (d > maxSq) maxSq = d;
  }
  return Math.sqrt(maxSq) || 1;
}
