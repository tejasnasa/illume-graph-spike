/**
 * Frame statistics tests.
 *
 * These numbers are the entire output of the project, so the arithmetic behind them is the
 * one part that must be verifiable without a phone attached.
 */

import { describe, expect, it } from "vitest";

import { formatFps, formatMs, percentile, summarise } from "../summarise";

describe("percentile", () => {
  it("returns 0 for an empty array", () => {
    expect(percentile([], 0.5)).toBe(0);
  });

  it("returns the only element for a single-value array", () => {
    expect(percentile([42], 0.5)).toBe(42);
    expect(percentile([42], 0.95)).toBe(42);
  });

  it("returns the median at p50", () => {
    expect(percentile([1, 2, 3, 4, 5], 0.5)).toBe(3);
  });

  it("returns the maximum at p100", () => {
    expect(percentile([1, 2, 3, 4, 5], 1)).toBe(5);
  });

  it("uses nearest-rank, so p95 of 100 values is the 95th", () => {
    const sorted = Array.from({ length: 100 }, (_, i) => i + 1);
    expect(percentile(sorted, 0.95)).toBe(95);
  });
});

describe("summarise", () => {
  it("returns zeroes for an empty run rather than NaN", () => {
    const stats = summarise([]);

    expect(stats).toEqual({
      frames: 0,
      durationMs: 0,
      fpsAvg: 0,
      frameMsP50: 0,
      frameMsP95: 0,
      frameMsMax: 0,
      jankFrames: 0,
    });
  });

  it("computes average fps from total duration", () => {
    // 100 frames of 10ms each = 1000ms total = 100 fps.
    const stats = summarise(new Array(100).fill(10));

    expect(stats.frames).toBe(100);
    expect(stats.durationMs).toBe(1000);
    expect(stats.fpsAvg).toBeCloseTo(100, 5);
  });

  it("reports the median and the 95th percentile frame time", () => {
    const times = [...new Array(90).fill(16), ...new Array(10).fill(100)];
    const stats = summarise(times);

    expect(stats.frameMsP50).toBe(16);
    expect(stats.frameMsP95).toBe(100);
    expect(stats.frameMsMax).toBe(100);
  });

  it("uses nearest-rank, so a tail of exactly 5% sits on the p95 boundary", () => {
    // Nearest-rank asks for the smallest value at or below which 95% of samples fall. With
    // exactly 5 slow frames in 100, that value is the last fast frame, not the first slow
    // one. Documented rather than changed: it is the standard definition, and a tail this
    // precisely sized is a contrived case. Read `frameMsMax` alongside `frameMsP95`.
    const times = [...new Array(95).fill(16), ...new Array(5).fill(100)];
    const stats = summarise(times);

    expect(stats.frameMsP95).toBe(16);
    expect(stats.frameMsMax).toBe(100);
    expect(stats.jankFrames).toBe(5);
  });

  it("counts frames slower than 33ms as jank", () => {
    const stats = summarise([10, 10, 40, 10, 50, 20]);
    expect(stats.jankFrames).toBe(2);
  });

  it("does not count a frame of exactly 33ms as jank", () => {
    // The threshold is "below 30fps", and 33ms is exactly 30fps.
    expect(summarise([33, 33, 33]).jankFrames).toBe(0);
  });

  it("exposes stutter that the average frame rate hides", () => {
    // This is the reason percentiles are reported at all. Both runs below have an identical
    // mean frame time, but one is smooth and the other visibly stutters.
    const smooth = summarise(new Array(100).fill(20));
    const stuttery = summarise([
      ...new Array(50).fill(2),
      ...new Array(50).fill(38),
    ]);

    expect(smooth.fpsAvg).toBeCloseTo(stuttery.fpsAvg, 5);
    expect(stuttery.jankFrames).toBe(50);
    expect(smooth.jankFrames).toBe(0);
  });

  it("does not mutate the input array", () => {
    const times = [30, 10, 20];
    summarise(times);
    expect(times).toEqual([30, 10, 20]);
  });
});

describe("formatting", () => {
  it("formats milliseconds to one decimal place", () => {
    expect(formatMs(16.666)).toBe("16.7ms");
  });

  it("formats fps to one decimal place", () => {
    expect(formatFps(59.99)).toBe("60.0 fps");
  });
});
