/**
 * Raw `expo-gl` + three renderer.
 *
 * No reconciler in the path: the scene is built once with imperative three calls, then a
 * `requestAnimationFrame` loop moves the camera and redraws. This is the most direct
 * measurement of what the GPU and the JS thread can actually do.
 *
 * Two details matter for correctness on `expo-gl`:
 *
 *   1. Three's `WebGLRenderer` expects an `HTMLCanvasElement`, which does not exist here.
 *      A shim object supplies the handful of properties three reads.
 *   2. `gl.endFrameEXP()` must be called after every draw to present the buffer. Omitting
 *      it yields a permanently blank view with no error — the single most common way this
 *      integration fails silently.
 *
 * @module renderers/ThreeGLRenderer
 */

import { GLView } from "expo-gl";
import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import * as THREE from "three";

import { criticalityColor, nodeRadius } from "@/lib/graph/types";
import { orbitAt } from "./camera";
import type { RendererProps } from "./types";

/** Low-poly spheres. A force graph draws thousands of them; detail is not affordable. */
const SPHERE_SEGMENTS = 6;
const SPHERE_RINGS = 4;

/** Link colour, deliberately dim so it does not wash out the node colours. */
const LINK_COLOR = 0x2a3550;

interface Scene {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  geometry: THREE.SphereGeometry;
  nodeMaterial: THREE.MeshBasicMaterial;
  linkGeometry: THREE.BufferGeometry;
  linkMaterial: THREE.LineBasicMaterial;
  nodeMesh: THREE.InstancedMesh;
  linkMesh: THREE.LineSegments;
}

/**
 * Render the graph with raw three over an `expo-gl` context.
 *
 * @param props - Frozen graph data and camera options.
 * @returns A GL surface, or an error message if the context could not be built.
 */
export default function ThreeGLRenderer(props: RendererProps) {
  const [error, setError] = useState<string | null>(null);

  // The render loop reads props through a ref so that the context is created exactly once.
  // Rebuilding the scene on every prop change would mean re-uploading hundreds of thousands
  // of vertices mid-measurement, which would be measured as renderer cost.
  const propsRef = useRef(props);
  propsRef.current = props;

  const sceneRef = useRef<Scene | null>(null);
  const rafRef = useRef(0);
  const startedAtRef = useRef(0);

  /** Tear down GL resources. Called on unmount only. */
  const dispose = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    const scene = sceneRef.current;
    if (!scene) return;

    scene.nodeMesh.dispose();
    scene.linkMesh.dispose();
    scene.geometry.dispose();
    scene.nodeMaterial.dispose();
    scene.linkGeometry.dispose();
    scene.linkMaterial.dispose();
    scene.renderer.dispose();
    sceneRef.current = null;
  }, []);

  useEffect(() => dispose, [dispose]);

  /** Build the scene once the GL context exists. */
  const onContextCreate = useCallback(
    (gl: {
      drawingBufferWidth: number;
      drawingBufferHeight: number;
      canvas?: unknown;
      endFrameEXP: () => void;
    }) => {
      try {
        const { positions, links, nodes, boundingRadius, autoRotate } =
          propsRef.current;
        const width = gl.drawingBufferWidth;
        const height = gl.drawingBufferHeight;

        // Three reads these properties off the canvas; nothing else is required of it.
        const canvasShim = {
          width,
          height,
          style: {},
          addEventListener: () => {},
          removeEventListener: () => {},
          clientHeight: height,
          clientWidth: width,
          getContext: () => gl,
        } as unknown as HTMLCanvasElement;
        (gl as unknown as { canvas: unknown }).canvas = canvasShim;

        const renderer = new THREE.WebGLRenderer({
          canvas: canvasShim,
          context: gl as unknown as WebGLRenderingContext,
          antialias: false,
          alpha: false,
          powerPreference: "high-performance",
        });
        renderer.setSize(width, height, false);
        // expo-gl already renders at the device's native resolution, so a pixel ratio
        // above 1 would multiply fill cost for no visible gain.
        renderer.setPixelRatio(1);
        renderer.setClearColor(0x09090b, 1);

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(
          50,
          width / height,
          0.1,
          boundingRadius * 20,
        );

        // ── Nodes ──
        // Scale node size relative to the graph so the same formula reads correctly at
        // 500 nodes and at 25,000.
        const worldScale = boundingRadius / 50;
        const geometry = new THREE.SphereGeometry(
          1,
          SPHERE_SEGMENTS,
          SPHERE_RINGS,
        );
        const nodeMaterial = new THREE.MeshBasicMaterial({ toneMapped: false });
        const nodeMesh = new THREE.InstancedMesh(
          geometry,
          nodeMaterial,
          nodes.length,
        );
        nodeMesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);

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
          nodeMesh.setMatrixAt(i, matrix);
          color.set(criticalityColor(nodes[i].criticality));
          nodeMesh.setColorAt(i, color);
        }
        nodeMesh.instanceMatrix.needsUpdate = true;
        if (nodeMesh.instanceColor) nodeMesh.instanceColor.needsUpdate = true;
        scene.add(nodeMesh);

        // ── Links ──
        // One LineSegments draw call for the whole edge set. Individual lines would be
        // thousands of draw calls and would make this renderer look far worse than it is.
        const linkPositions = new Float32Array(links.length * 6);
        for (let i = 0; i < links.length; i += 1) {
          const { source, target } = links[i];
          linkPositions[i * 6] = positions[source * 3];
          linkPositions[i * 6 + 1] = positions[source * 3 + 1];
          linkPositions[i * 6 + 2] = positions[source * 3 + 2];
          linkPositions[i * 6 + 3] = positions[target * 3];
          linkPositions[i * 6 + 4] = positions[target * 3 + 1];
          linkPositions[i * 6 + 5] = positions[target * 3 + 2];
        }
        const linkGeometry = new THREE.BufferGeometry();
        linkGeometry.setAttribute(
          "position",
          new THREE.BufferAttribute(linkPositions, 3),
        );
        const linkMaterial = new THREE.LineBasicMaterial({ color: LINK_COLOR });
        const linkMesh = new THREE.LineSegments(linkGeometry, linkMaterial);
        scene.add(linkMesh);

        sceneRef.current = {
          renderer,
          scene,
          camera,
          geometry,
          nodeMaterial,
          linkGeometry,
          linkMaterial,
          nodeMesh,
          linkMesh,
        };

        startedAtRef.current = Date.now();

        const animate = () => {
          const active = sceneRef.current;
          if (!active) return;

          const { boundingRadius: radius } = propsRef.current;

          if (propsRef.current.autoRotate) {
            const orbit = orbitAt(Date.now() - startedAtRef.current, radius);
            const cosPhi = Math.cos(orbit.phi);
            // Inverse of the rotation the projection applies, so all three renderers
            // travel the same path rather than merely a similar one.
            active.camera.position.set(
              -orbit.radius * cosPhi * Math.sin(orbit.theta),
              orbit.radius * Math.sin(orbit.phi),
              orbit.radius * cosPhi * Math.cos(orbit.theta),
            );
            active.camera.lookAt(0, 0, 0);
          }

          active.renderer.render(active.scene, active.camera);
          gl.endFrameEXP();

          rafRef.current = requestAnimationFrame(animate);
        };

        rafRef.current = requestAnimationFrame(animate);
      } catch (cause) {
        const message =
          cause instanceof Error ? cause.message : "Unknown GL error";
        setError(message);
        propsRef.current.onError?.(message);
      }
    },
    [],
  );

  if (error) {
    return (
      <View style={styles.errorBox}>
        <Text style={styles.errorTitle}>expo-gl renderer failed</Text>
        <Text style={styles.errorBody}>{error}</Text>
      </View>
    );
  }

  return (
    <GLView style={StyleSheet.absoluteFill} onContextCreate={onContextCreate} />
  );
}

const styles = StyleSheet.create({
  errorBox: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#18181b",
  },
  errorTitle: {
    color: "#f87171",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
  },
  errorBody: {
    color: "#a1a1aa",
    fontSize: 13,
    textAlign: "center",
  },
});
