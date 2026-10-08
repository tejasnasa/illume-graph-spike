/**
 * Shared orbit-camera mathematics.
 *
 * Kept pure and free of any renderer or React Native import so it can be unit-tested
 * off-device. It is also what lets the three renderers be compared honestly: they all move
 * through the same path, at the same angular velocity, for the same wall-clock duration.
 *
 * @module renderers/camera
 */

/** Camera placement in spherical coordinates about the origin. */
export interface OrbitCamera {
  /** Rotation about the vertical axis, in radians. */
  theta: number;
  /** Elevation, in radians. */
  phi: number;
  /** Distance from the origin. */
  radius: number;
}

/** Where a world point lands on screen. */
export interface ProjectedPoint {
  x: number;
  y: number;
  /** Distance in front of the camera. Negative means the point is behind it. */
  depth: number;
  /** Perspective scale factor at this depth; 0 when behind the camera. */
  scale: number;
}

/** Default time for one full revolution, in milliseconds. */
export const ORBIT_PERIOD_MS = 24_000;

/** Elevation held constant during auto-orbit. Roughly 35° above the equator. */
const ORBIT_PHI = (35 * Math.PI) / 180;

/**
 * Where the camera is at a moment in time.
 *
 * @param elapsedMs - Milliseconds since the orbit began.
 * @param boundingRadius - Radius containing the graph.
 * @param periodMs - Duration of one full revolution.
 * @returns The camera placement.
 */
export function orbitAt(
  elapsedMs: number,
  boundingRadius: number,
  periodMs = ORBIT_PERIOD_MS,
): OrbitCamera {
  return {
    theta: ((elapsedMs % periodMs) / periodMs) * Math.PI * 2,
    phi: ORBIT_PHI,
    // 2.4× the bounding radius frames the graph with a little margin.
    radius: boundingRadius * 2.4,
  };
}

/**
 * Project a world point through an orbit camera onto a viewport.
 *
 * Implemented as two rotations followed by a perspective divide rather than a full view
 * matrix: the camera always looks at the origin, so the general case buys nothing.
 *
 * @param x - World x.
 * @param y - World y.
 * @param z - World z.
 * @param camera - Camera placement.
 * @param width - Viewport width in pixels.
 * @param height - Viewport height in pixels.
 * @returns Screen position, depth, and perspective scale.
 */
export function projectPoint(
  x: number,
  y: number,
  z: number,
  camera: OrbitCamera,
  width: number,
  height: number,
): ProjectedPoint {
  const cosT = Math.cos(camera.theta);
  const sinT = Math.sin(camera.theta);
  const cosP = Math.cos(camera.phi);
  const sinP = Math.sin(camera.phi);

  // Rotate about Y.
  const x1 = x * cosT - z * sinT;
  const z1 = x * sinT + z * cosT;

  // Rotate about X.
  const y2 = y * cosP - z1 * sinP;
  const z2 = y * sinP + z1 * cosP;

  // Push the camera back along +Z.
  const depth = z2 + camera.radius;

  // The viewport's smaller dimension sets the focal length, so a portrait phone and a
  // landscape tablet frame the graph the same way.
  const focal = Math.min(width, height) * 0.9;
  const scale = depth > 0.01 ? focal / depth : 0;

  return {
    x: width / 2 + x1 * scale,
    y: height / 2 - y2 * scale,
    depth,
    scale,
  };
}
