/**
 * Deterministic pseudo-random numbers.
 *
 * Every renderer must be benchmarked against byte-identical graph data, otherwise the
 * comparison measures the generator rather than the renderer. `Math.random` is therefore
 * never used anywhere in this project.
 *
 * @module lib/graph/random
 */

/**
 * Build a seeded PRNG (mulberry32).
 *
 * Small, fast, and good enough for graph topology — this is not cryptography.
 *
 * @param seed - Any 32-bit integer. The same seed always yields the same sequence.
 * @returns A function producing floats in `[0, 1)`.
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Pick an index from a cumulative-weight table.
 *
 * Binary search over a prefix-sum array, which is what makes preferential attachment
 * affordable at 25,000 nodes.
 *
 * @param cumulative - Ascending prefix sums, last entry equal to the total weight.
 * @param value - A draw in `[0, total)`.
 * @returns The chosen index.
 */
export function weightedPick(cumulative: Float64Array, value: number): number {
  let lo = 0;
  let hi = cumulative.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (cumulative[mid] < value) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}
