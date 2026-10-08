/**
 * Frame-time sampling over a fixed window.
 *
 * Uses `requestAnimationFrame`, which React Native drives from the display link. The
 * sampler therefore measures the JS thread's ability to keep up with the display — for all
 * three renderers equally, which is what makes the comparison fair.
 *
 * One caveat worth stating plainly, because it shapes how the results should be read:
 * a renderer whose drawing happens entirely on the UI thread (Skia, and much of GL) can
 * keep painting smoothly while the JS thread is congested. This sampler will report that
 * congestion, which is a real cost — it is what makes the UI feel unresponsive — but it is
 * not the same thing as dropped GPU frames.
 *
 * @module lib/metrics/useFrameSampler
 */

import { useEffect, useRef, useState } from "react";

/** Live state exposed while a measurement is running. */
export interface SamplerState {
  /** True between start and the end of the window. */
  running: boolean;
  /** Milliseconds elapsed so far. */
  elapsedMs: number;
  /** Rolling frame rate over roughly the last second, for a live readout. */
  liveFps: number;
}

/** Options for {@link useFrameSampler}. */
export interface SamplerOptions {
  /** Sampling runs while true. Flipping to false ends the run and fires `onComplete`. */
  active: boolean;
  /** Window length in milliseconds. */
  durationMs: number;
  /** Called once with every frame duration collected. */
  onComplete: (frameTimesMs: number[]) => void;
}

/**
 * Collect frame durations for a fixed window.
 *
 * @param options - Activation flag, window length, and completion callback.
 * @returns Live progress for the UI.
 */
export function useFrameSampler({
  active,
  durationMs,
  onComplete,
}: SamplerOptions): SamplerState {
  const [elapsedMs, setElapsedMs] = useState(0);
  const [liveFps, setLiveFps] = useState(0);

  // Held in a ref so the rAF loop never captures a stale callback. The loop runs for the
  // whole window and re-subscribing on every render would restart it.
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (!active) return;

    const frameTimes: number[] = [];
    const recent: number[] = [];
    let last = 0;
    let rafId = 0;
    let cancelled = false;

    const tick = (now: number) => {
      if (cancelled) return;

      if (last !== 0) {
        const delta = now - last;
        // A zero or negative delta means the clock went backwards or two callbacks landed
        // in the same millisecond. Counting it would skew the average toward infinity.
        if (delta > 0) {
          frameTimes.push(delta);
          recent.push(delta);
          if (recent.length > 60) recent.shift();
        }
      }
      last = now;

      const total = frameTimes.reduce((sum, t) => sum + t, 0);
      setElapsedMs(total);

      const recentTotal = recent.reduce((sum, t) => sum + t, 0);
      setLiveFps(recentTotal > 0 ? (recent.length / recentTotal) * 1000 : 0);

      if (total >= durationMs) {
        onCompleteRef.current(frameTimes);
        return;
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
    };
  }, [active, durationMs]);

  useEffect(() => {
    if (!active) {
      setElapsedMs(0);
      setLiveFps(0);
    }
  }, [active]);

  return { running: active, elapsedMs, liveFps };
}
