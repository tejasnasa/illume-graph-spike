/**
 * The contract every renderer implements.
 *
 * All three receive byte-identical input — the same frozen positions, the same indexed
 * links, the same colours — so a difference in the numbers is a difference in the
 * renderer, not in the data.
 *
 * @module renderers/types
 */

import type { IndexedLink } from "@/lib/graph/layout";
import type { GraphNode } from "@/lib/graph/types";

/** Props shared by every renderer. */
export interface RendererProps {
  /** Frozen `xyz` positions, one triple per node. */
  positions: Float32Array;
  /** Links resolved to node indices. */
  links: IndexedLink[];
  /** Node metadata, used for colour and size. */
  nodes: GraphNode[];
  /** Radius that contains every node, used to frame the camera. */
  boundingRadius: number;
  /**
   * Whether the camera should orbit automatically.
   *
   * Auto-orbit exists so the benchmark is reproducible: a hand-dragged camera moves
   * differently every run, and a still camera measures nothing interesting, since a static
   * scene can be cached.
   */
  autoRotate: boolean;
  /** Reports a fatal renderer problem so the UI can show it instead of a blank canvas. */
  onError?: (message: string) => void;
}
