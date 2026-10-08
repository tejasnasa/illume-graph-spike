/**
 * `@react-three/fiber` v9 renderer, using its `native` entry.
 *
 * This is the declarative path, and the one closest to what the real client does today —
 * `GraphClient.tsx` drives `react-force-graph-3d` through React, and selection and halo
 * logic are written against that model. If this renderer holds up, the production port is
 * a far smaller change than rewriting it imperatively.
 *
 * It is also the path the maintainers have withdrawn from. `@react-three/fiber` v10 moved
 * React Native support into a separate `@react-three/native` package whose own README says
 * "DO NOT USE YET", and the team cites performance problems with ExpoGL as their reason for
 * steering native toward WebGPU. v9 is pinned here deliberately: it is the last release
 * where the native entry is part of the main package.
 *
 * @module renderers/R3FRenderer
 */

import { Canvas, useFrame } from "@react-three/fiber/native";
import { useLayoutEffect, useMemo, useRef } from "react";
import { StyleSheet } from "react-native";
import * as THREE from "three";

import { criticalityColor, nodeRadius } from "@/lib/graph/types";
import { orbitAt } from "./camera";
import type { RendererProps } from "./types";

const SPHERE_SEGMENTS = 6;
const SPHERE_RINGS = 4;
const LINK_COLOR = "#2a3550";

/** Instanced node spheres. */
function Nodes({ positions, nodes, boundingRadius }: Pick<RendererProps, "positions" | "nodes" | "boundingRadius">) {
  const ref = useRef<THREE.InstancedMesh>(null);

  const colors = useMemo(
    () => nodes.map((node) => criticalityColor(node.criticality)),
    [nodes],
  );

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;

    const worldScale = boundingRadius / 50;
    const matrix = new THREE.Matrix4();
    const color = new THREE.Color();

    for (let i = 0; i < nodes.length; i += 1) {
      const r = nodeRadius(nodes[i].loc, 1) * worldScale * 0.35;
      matrix.makeScale(r, r, r);
      matrix.setPosition(
        positions[i * 3],
        positions[i * 3 + 1],
        positions[i * 3 + 2],
      );
      mesh.setMatrixAt(i, matrix);
      color.set(colors[i]);
      mesh.setColorAt(i, color);
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [positions, nodes, colors, boundingRadius]);

  return (
    <instancedMesh
      ref={ref}
      args={[undefined, undefined, nodes.length]}
      // A force graph is spread far wider than the initial frustum guess; culling by a
      // stale bounding sphere would pop the whole graph out of view.
      frustumCulled={false}
    >
      <sphereGeometry args={[1, SPHERE_SEGMENTS, SPHERE_RINGS]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  );
}

/** One LineSegments draw call for every edge. */
function Links({ positions, links }: Pick<RendererProps, "positions" | "links">) {
  const geometry = useMemo(() => {
    const array = new Float32Array(links.length * 6);
    for (let i = 0; i < links.length; i += 1) {
      const { source, target } = links[i];
      array[i * 6] = positions[source * 3];
      array[i * 6 + 1] = positions[source * 3 + 1];
      array[i * 6 + 2] = positions[source * 3 + 2];
      array[i * 6 + 3] = positions[target * 3];
      array[i * 6 + 4] = positions[target * 3 + 1];
      array[i * 6 + 5] = positions[target * 3 + 2];
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(array, 3));
    return g;
  }, [positions, links]);

  useLayoutEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <lineSegments geometry={geometry} frustumCulled={false}>
      <lineBasicMaterial color={LINK_COLOR} />
    </lineSegments>
  );
}

/** Moves the camera along the shared orbit path. */
function Orbit({
  boundingRadius,
  autoRotate,
}: Pick<RendererProps, "boundingRadius" | "autoRotate">) {
  useFrame(({ camera, clock }) => {
    if (!autoRotate) return;

    const orbit = orbitAt(clock.getElapsedTime() * 1000, boundingRadius);
    const cosPhi = Math.cos(orbit.phi);
    camera.position.set(
      -orbit.radius * cosPhi * Math.sin(orbit.theta),
      orbit.radius * Math.sin(orbit.phi),
      orbit.radius * cosPhi * Math.cos(orbit.theta),
    );
    camera.lookAt(0, 0, 0);
  });
  return null;
}

/**
 * Render the graph through React Three Fiber.
 *
 * @param props - Frozen graph data and camera options.
 * @returns A full-bleed R3F canvas.
 */
export default function R3FRenderer({
  positions,
  links,
  nodes,
  boundingRadius,
  autoRotate,
}: RendererProps) {
  return (
    <Canvas
      style={StyleSheet.absoluteFill}
      // Higher than the raw-GL renderer's 50°: R3F's native canvas has historically
      // mis-reported its viewport on first layout, and the wider angle hides the resulting
      // framing error rather than showing a graph that fills a third of the screen.
      camera={{ fov: 55, near: 0.1, far: boundingRadius * 20 }}
      gl={{ antialias: false }}
      onCreated={({ gl }) => {
        gl.setClearColor(0x09090b, 1);
      }}
    >
      <Nodes
        positions={positions}
        nodes={nodes}
        boundingRadius={boundingRadius}
      />
      <Links positions={positions} links={links} />
      <Orbit boundingRadius={boundingRadius} autoRotate={autoRotate} />
    </Canvas>
  );
}
