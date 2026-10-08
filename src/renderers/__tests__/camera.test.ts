/**
 * Orbit camera tests.
 *
 * All three renderers share this maths, so a defect here would be a defect in every
 * measurement the project produces — and it would look like a renderer difference rather
 * than a projection bug.
 */

import { describe, expect, it } from "vitest";

import { ORBIT_PERIOD_MS, orbitAt, projectPoint } from "../camera";

const WIDTH = 400;
const HEIGHT = 800;

describe("orbitAt", () => {
  it("starts at theta 0", () => {
    expect(orbitAt(0, 100).theta).toBe(0);
  });

  it("advances a quarter turn per quarter period", () => {
    expect(orbitAt(ORBIT_PERIOD_MS / 4, 100).theta).toBeCloseTo(Math.PI / 2, 10);
    expect(orbitAt(ORBIT_PERIOD_MS / 2, 100).theta).toBeCloseTo(Math.PI, 10);
  });

  it("wraps to zero at exactly one period rather than accumulating 2π", () => {
    // The angle is taken modulo the period so it cannot grow without bound over a long
    // run. Landing on 0 rather than 2π is the wrap working, not a bug.
    expect(orbitAt(ORBIT_PERIOD_MS, 100).theta).toBe(0);
  });

  it("wraps rather than growing without bound", () => {
    const oneRevolution = orbitAt(ORBIT_PERIOD_MS, 100).theta;
    const twoRevolutions = orbitAt(ORBIT_PERIOD_MS * 2, 100).theta;

    expect(twoRevolutions).toBeCloseTo(oneRevolution, 10);
  });

  it("frames the graph proportionally to its radius", () => {
    expect(orbitAt(0, 500).radius).toBe(500 * 2.4);
    expect(orbitAt(0, 5_000).radius).toBe(5_000 * 2.4);
  });
});

describe("projectPoint", () => {
  it("places the origin at the centre of the viewport", () => {
    const point = projectPoint(0, 0, 0, orbitAt(0, 100), WIDTH, HEIGHT);

    expect(point.x).toBeCloseTo(WIDTH / 2, 6);
    expect(point.y).toBeCloseTo(HEIGHT / 2, 6);
  });

  it("reports a positive depth for a point in front of the camera", () => {
    const point = projectPoint(0, 0, 0, orbitAt(0, 100), WIDTH, HEIGHT);
    expect(point.depth).toBeGreaterThan(0);
  });

  it("scales perspective with depth", () => {
    const camera = orbitAt(0, 100);
    // The camera sits on the +Z axis looking back at the origin, so positive z is further
    // away, not nearer.
    const farHalf = projectPoint(0, 0, 50, camera, WIDTH, HEIGHT);
    const nearHalf = projectPoint(0, 0, -50, camera, WIDTH, HEIGHT);

    expect(nearHalf.depth).toBeLessThan(farHalf.depth);
    expect(nearHalf.scale).toBeGreaterThan(farHalf.scale);
  });

  it("returns zero scale for a point behind the camera instead of a negative one", () => {
    const camera = orbitAt(0, 100);
    // Well beyond the camera plane. `-camera.radius` would not be enough: the camera looks
    // down a rotated axis, so the z at which depth reaches zero is radius / cos(phi).
    const behind = projectPoint(0, 0, -1_000, camera, WIDTH, HEIGHT);

    expect(behind.depth).toBeLessThan(0);
    expect(behind.scale).toBe(0);
  });

  it("inverts the y axis, so positive world y is up the screen", () => {
    const camera = orbitAt(0, 100);
    const up = projectPoint(0, 50, 0, camera, WIDTH, HEIGHT);

    // Screen coordinates grow downward; a point above the origin must have a smaller y.
    expect(up.y).toBeLessThan(HEIGHT / 2);
  });

  it("keeps the origin centred through a full revolution", () => {
    // A rotation applied to the origin must be a no-op. If this drifts, the camera is
    // translating rather than orbiting and every renderer would show the graph sliding.
    for (let t = 0; t < ORBIT_PERIOD_MS; t += ORBIT_PERIOD_MS / 8) {
      const point = projectPoint(0, 0, 0, orbitAt(t, 100), WIDTH, HEIGHT);
      expect(point.x).toBeCloseTo(WIDTH / 2, 6);
      expect(point.y).toBeCloseTo(HEIGHT / 2, 6);
    }
  });

  it("returns to its starting position after one full revolution", () => {
    const start = projectPoint(30, 20, -10, orbitAt(0, 100), WIDTH, HEIGHT);
    const end = projectPoint(
      30,
      20,
      -10,
      orbitAt(ORBIT_PERIOD_MS, 100),
      WIDTH,
      HEIGHT,
    );

    expect(end.x).toBeCloseTo(start.x, 6);
    expect(end.y).toBeCloseTo(start.y, 6);
    expect(end.depth).toBeCloseTo(start.depth, 6);
  });

  it("uses the smaller viewport dimension for focal length", () => {
    // Portrait and landscape should frame the graph identically, so a result from a phone
    // is comparable with one from a tablet.
    const camera = orbitAt(0, 100);
    const portrait = projectPoint(40, 0, 0, camera, 400, 800);
    const landscape = projectPoint(40, 0, 0, camera, 800, 400);

    const portraitOffset = portrait.x - 400 / 2;
    const landscapeOffset = landscape.x - 800 / 2;

    expect(portraitOffset).toBeCloseTo(landscapeOffset, 6);
  });
});
