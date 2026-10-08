/**
 * Frame-time statistics.
 *
 * Deliberately pure and free of React Native imports so it can be unit-tested off-device.
 * The numbers this produces are the entire output of the project, so they are the one part
 * that should not depend on a phone being plugged in to verify.
 *
 * @module lib/metrics/summarise
 */

import type { FrameStats } from "./types";

/**
 * Nearest-rank percentile over a pre-sorted array.
 *
 * @param sorted - Ascending-sorted numbers.
 * @param p - Percentile in `[0, 1]`.
 * @returns The value at that percentile, or 0 for an empty array.
 */
export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const rank = Math.ceil(p * sorted.length) - 1;
  const index = Math.min(Math.max(rank, 0), sorted.length - 1);
  return sorted[index];
}

/**
 * Turn a list of frame durations into a report.
 *
 * Percentiles are reported on *frame times*, not on FPS. Averaging FPS hides stutter: a
 * run alternating between 10ms and 100ms frames has a respectable mean frame rate and
 * feels terrible. p95 frame time is the number that exposes that, and `jankFrames` counts
 * the frames that fell below 30fps.
 *
 * @param frameTimesMs - Durations between successive presented frames.
 * @returns Aggregated statistics.
 */
export function summarise(frameTimesMs: number[]): FrameStats {
  const frames = frameTimesMs.length;
  if (frames === 0) {
    return {
      frames: 0,
      durationMs: 0,
      fpsAvg: 0,
      frameMsP50: 0,
      frameMsP95: 0,
      frameMsMax: 0,
      jankFrames: 0,
    };
  }

  const durationMs = frameTimesMs.reduce((sum, t) => sum + t, 0);
  const sorted = [...frameTimesMs].sort((a, b) => a - b);

  return {
    frames,
    durationMs,
    fpsAvg: durationMs > 0 ? (frames / durationMs) * 1000 : 0,
    frameMsP50: percentile(sorted, 0.5),
    frameMsP95: percentile(sorted, 0.95),
    frameMsMax: sorted[sorted.length - 1],
    jankFrames: frameTimesMs.filter((t) => t > 33).length,
  };
}

/**
 * Render a frame-time value for display.
 *
 * @param ms - Milliseconds.
 * @returns A short string, e.g. `16.7ms`.
 */
export function formatMs(ms: number): string {
  return `${ms.toFixed(1)}ms`;
}

/**
 * Render a frame rate for display.
 *
 * @param fps - Frames per second.
 * @returns A short string, e.g. `59.4 fps`.
 */
export function formatFps(fps: number): string {
  return `${fps.toFixed(1)} fps`;
}
