/**
 * Result shapes for a benchmark run.
 *
 * @module lib/metrics/types
 */

/** The renderers under comparison. */
export type RendererId = "three-gl" | "r3f-native" | "skia-2d";

/** Human-readable renderer names, used in the UI and in exports. */
export const RENDERER_LABELS: Record<RendererId, string> = {
  "three-gl": "Raw expo-gl + three",
  "r3f-native": "R3F v9 (react-three-fiber/native)",
  "skia-2d": "Skia 2D (software projection)",
};

/** Short descriptions shown under each option. */
export const RENDERER_NOTES: Record<RendererId, string> = {
  "three-gl": "First-party GL context, imperative three. No reconciler.",
  "r3f-native": "Declarative, matches the web client's model. Legacy path.",
  "skia-2d": "Not real 3D — depth faked with size and opacity. Stability hedge.",
};

/** Everything identifying the device a run happened on. */
export interface DeviceInfo {
  model: string;
  platform: string;
  osVersion: string;
  isDevice: boolean;
  totalMemoryBytes: number | null;
  screenWidth: number;
  screenHeight: number;
  pixelRatio: number;
  expoSdk: string;
}

/** Aggregated frame statistics for one measurement window. */
export interface FrameStats {
  frames: number;
  durationMs: number;
  fpsAvg: number;
  frameMsP50: number;
  frameMsP95: number;
  frameMsMax: number;
  /** Frames slower than 33ms — the threshold below which motion reads as stutter. */
  jankFrames: number;
}

/** One completed benchmark run. */
export interface BenchResult extends FrameStats {
  id: string;
  renderer: RendererId;
  nodeCount: number;
  linkCount: number;
  seed: number;
  ticks: number;
  simulationMs: number;
  device: DeviceInfo;
  createdAt: string;
}

/** A run's configuration, before it has produced results. */
export interface BenchConfig {
  renderer: RendererId;
  nodeCount: number;
  seed: number;
  /** How long to measure, in milliseconds. */
  durationMs: number;
}
