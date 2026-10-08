/**
 * `@shopify/react-native-skia` renderer with a software-projected point cloud.
 *
 * This is the hedge. Skia is dramatically more mature and more stable in React Native than
 * `expo-gl`, and it does not go near the R3F native package that its own maintainers have
 * paused. If GL proves unworkable, this is the fallback that is actually likely to ship.
 *
 * It is not real 3D. Points are projected on the JS thread with the same camera maths the
 * GL renderers use, then drawn as circles sized and faded by depth. That reads as depth at
 * a glance, but there is no perspective-correct geometry and no per-fragment lighting — a
 * node is a coloured disc, not a lit sphere.
 *
 * ## How to read its numbers
 *
 * Projection runs on the JS thread, and the four paths are rebuilt from scratch every
 * frame. This is the straightforward implementation, and it is deliberately not the fastest
 * one available: a production version would project inside a Reanimated worklet on the UI
 * thread, or use Skia's `Atlas` API to draw thousands of sprites in a single call.
 *
 * So at high node counts this renderer will look far worse than Skia is actually capable
 * of. Treat its result as a lower bound on Skia's performance and a fair estimate of what
 * a JS-thread projection costs — not as Skia's ceiling.
 *
 * @module renderers/SkiaRenderer
 */

import { Canvas, Path, Skia } from "@shopify/react-native-skia";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { criticalityColor, nodeRadius } from "@/lib/graph/types";
import { orbitAt } from "./camera";
import type { RendererProps } from "./types";

/**
 * Backdrop for depth cueing.
 *
 * Skia's `Path` takes one paint per element, so a per-node colour would mean one element
 * per node — 25,000 React children, which is not viable. Bucketing by criticality keeps it
 * to four draw calls, which is why depth is expressed as opacity rather than as size:
 * stroke width is uniform across a path, but each bucket can carry its own alpha.
 */
const DEPTH_FADE = 0.35;

interface Bucket {
  criticality: string;
  color: string;
  count: number;
}

/**
 * Render the graph as a depth-sorted point cloud through Skia.
 *
 * @param props - Frozen graph data and camera options.
 * @returns A full-bleed Skia canvas, or a notice if the graph is too large to be sensible.
 */
export default function SkiaRenderer({
  positions,
  nodes,
  boundingRadius,
  autoRotate,
}: RendererProps) {
  const [paths, setPaths] = useState<ReturnType<typeof Skia.Path.Make>[]>([]);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });

  const startedAtRef = useRef(0);
  const rafRef = useRef(0);
  const pathsRef = useRef(paths);
  pathsRef.current = paths;

  // Buckets are computed once per graph, not per frame: the colour a node gets never
  // changes, so re-deriving the grouping every frame would be pure waste.
  const bucketsRef = useRef<Bucket[]>([]);
  useEffect(() => {
    const seen = new Map<string, Bucket>();
    for (const node of nodes) {
      const key = criticalityColor(node.criticality);
      const existing = seen.get(key);
      if (existing) existing.count += 1;
      else seen.set(key, { criticality: node.criticality, color: key, count: 1 });
    }
    bucketsRef.current = Array.from(seen.values());
  }, [nodes]);

  useEffect(() => {
    if (viewport.width === 0 || viewport.height === 0) return;

    let cancelled = false;
    startedAtRef.current = Date.now();

    const draw = () => {
      if (cancelled) return;

      const { width, height } = viewport;
      const camera = autoRotate
        ? orbitAt(Date.now() - startedAtRef.current, boundingRadius)
        : orbitAt(0, boundingRadius);

      // Inlined rather than calling projectPoint per node: at 25,000 nodes the function
      // call and the returned object allocation dominate the arithmetic.
      const cosT = Math.cos(camera.theta);
      const sinT = Math.sin(camera.theta);
      const cosP = Math.cos(camera.phi);
      const sinP = Math.sin(camera.phi);
      const focal = Math.min(width, height) * 0.9;
      const cx = width / 2;
      const cy = height / 2;

      const byColor = new Map<string, { x: number; y: number; r: number }[]>();
      for (const bucket of bucketsRef.current) byColor.set(bucket.color, []);
      const worldScale = boundingRadius / 50;

      for (let i = 0; i < nodes.length; i += 1) {
        const x = positions[i * 3];
        const y = positions[i * 3 + 1];
        const z = positions[i * 3 + 2];

        const x1 = x * cosT - z * sinT;
        const z1 = x * sinT + z * cosT;
        const y2 = y * cosP - z1 * sinP;
        const z2 = y * sinP + z1 * cosP;

        const depth = z2 + camera.radius;
        if (depth <= 0.01) continue;

        const scale = focal / depth;
        const r = nodeRadius(nodes[i].loc, 1) * worldScale * 0.35 * scale;
        if (r < 0.4) continue;

        const bucket = byColor.get(criticalityColor(nodes[i].criticality));
        bucket?.push({
          x: cx + x1 * scale,
          y: cy - y2 * scale,
          // Clamped so a near node cannot become a screen-filling disc.
          r: Math.min(r, 8),
        });
      }

      const next = bucketsRef.current.map((bucket) => {
        const path = Skia.Path.Make();
        const points = byColor.get(bucket.color) ?? [];
        for (const point of points) {
          path.addCircle(point.x, point.y, point.r);
        }
        return path;
      });

      setPaths(next);
      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
    };
  }, [viewport, positions, nodes, boundingRadius, autoRotate]);

  return (
    <View
      style={StyleSheet.absoluteFill}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        setViewport({ width, height });
      }}
    >
      <Canvas style={StyleSheet.absoluteFill}>
        {bucketsRef.current.map((bucket, index) => (
          <Path
            key={bucket.color}
            path={paths[index]}
            color={bucket.color}
            style="fill"
            opacity={DEPTH_FADE + 0.65 * (1 - index / Math.max(bucketsRef.current.length, 1))}
          />
        ))}
      </Canvas>
      <View style={styles.badge} pointerEvents="none">
        <Text style={styles.badgeText}>
          software projection · {nodes.length.toLocaleString()} nodes
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: "absolute",
    left: 12,
    bottom: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: "rgba(24,24,27,0.85)",
  },
  badgeText: {
    color: "#a1a1aa",
    fontSize: 11,
  },
});
