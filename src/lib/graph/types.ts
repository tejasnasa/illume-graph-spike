/**
 * Graph shapes shared by every renderer.
 *
 * These mirror the payload of Illume's `GET /api/v1/repository/{id}/graph` endpoint, so
 * anything measured against them transfers directly to the real client without a
 * translation layer in between.
 *
 * @module lib/graph/types
 */

/** Criticality buckets the backend assigns during ingest. */
export type Criticality = "critical" | "caution" | "safe";

/** One file-level node. */
export interface GraphNode {
  id: string;
  label: string;
  path: string;
  group: string;
  kind: string;
  loc: number;
  criticality: Criticality | string;
  criticality_score: number;
  language: string;
  fan_in: number;
  fan_out: number;
}

/** One collapsed dependency edge. */
export interface GraphLink {
  source: string;
  target: string;
  type: string;
  weight: number;
}

/** A complete graph payload. */
export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

/** Node counts offered in the UI, chosen to bracket the realistic range. */
export const SIZES = [500, 1_000, 2_500, 5_000, 10_000, 25_000] as const;

/** A size from {@link SIZES}. */
export type GraphSize = (typeof SIZES)[number];

/**
 * Colour a node by its criticality, matching the web client's mapping.
 *
 * @param criticality - Bucket name from the backend.
 * @returns A hex colour.
 */
export function criticalityColor(criticality: string): string {
  switch (criticality) {
    case "critical":
      return "#ef4444";
    case "caution":
      return "#facc15";
    case "safe":
      return "#22c55e";
    default:
      return "#64748b";
  }
}

/**
 * Node radius from lines of code, matching the web client's formula.
 *
 * @param loc - Lines of code for the node.
 * @param scale - View scale, so the same data reads well in 3D and in 2D.
 * @returns Radius in world units.
 */
export function nodeRadius(loc: number, scale = 1): number {
  return Math.sqrt(Math.max(loc, 10)) * 0.5 * scale;
}
