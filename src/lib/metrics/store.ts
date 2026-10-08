/**
 * In-memory results store.
 *
 * Results are held in memory and exported as JSON rather than persisted on device. The
 * deliverable of this project is a table someone reads and acts on, not a database — and
 * an export is what makes a run quotable in an issue or a decision write-up.
 *
 * The trade-off is explicit: closing the app clears the history, so export before you
 * force-quit.
 *
 * @module lib/metrics/store
 */

import { useSyncExternalStore } from "react";
import type { BenchResult } from "./types";

let results: BenchResult[] = [];
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

/**
 * Record a completed run.
 *
 * @param result - The run to store.
 */
export function addResult(result: BenchResult) {
  // Newest first: the run you just did is the one you want to look at.
  results = [result, ...results];
  emit();
}

/**
 * Remove every stored run.
 */
export function clearResults() {
  results = [];
  emit();
}

/**
 * Read the current results.
 *
 * @returns The stored runs, newest first.
 */
export function getResults(): BenchResult[] {
  return results;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Subscribe a component to the results list.
 *
 * @returns The stored runs, re-rendering the caller when they change.
 */
export function useResults(): BenchResult[] {
  return useSyncExternalStore(subscribe, getResults, getResults);
}

/**
 * Serialise every run.
 *
 * @returns Pretty-printed JSON, suitable for committing to `docs/` or pasting into an issue.
 */
export function exportResults(): string {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      runs: results,
    },
    null,
    2,
  );
}
