/**
 * Benchmark runner.
 *
 * Four phases, in order:
 *
 *   1. `preparing` — generate the graph and run the force simulation to completion
 *   2. `warming`   — mount the renderer and let it settle, unmeasured
 *   3. `measuring` — sample frame times for the configured window
 *   4. `done`      — summarise and store
 *
 * The warmup exists because the first seconds after mounting are dominated by shader
 * compilation, geometry upload, and JIT — costs paid once, which would otherwise drag the
 * average down in a way that says nothing about steady-state performance.
 *
 * @module app/bench
 */

import { useKeepAwake } from "expo-keep-awake";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import RendererErrorBoundary from "@/components/RendererErrorBoundary";
import { Button, Card, Screen, SectionTitle, Stat } from "@/components/ui";
import { generateGraph } from "@/lib/graph/generate";
import {
  boundingRadius,
  computeLayout,
  type LayoutResult,
} from "@/lib/graph/layout";
import { collectDeviceInfo } from "@/lib/metrics/device";
import { addResult } from "@/lib/metrics/store";
import { formatFps, formatMs, summarise } from "@/lib/metrics/summarise";
import { RENDERER_LABELS, type BenchResult, type RendererId } from "@/lib/metrics/types";
import { useFrameSampler } from "@/lib/metrics/useFrameSampler";
import R3FRenderer from "@/renderers/R3FRenderer";
import SkiaRenderer from "@/renderers/SkiaRenderer";
import ThreeGLRenderer from "@/renderers/ThreeGLRenderer";
import { colors, spacing, type } from "@/theme";

/** Unmeasured settling time before sampling begins. */
const WARMUP_MS = 3_000;

/** Fixed seed: two renderers must be compared on identical input. */
const SEED = 1;

type Phase = "preparing" | "warming" | "measuring" | "done";

/**
 * Run one benchmark and report it.
 *
 * @returns The runner screen.
 */
export default function BenchScreen() {
  // A benchmark that pauses because the screen locked is not a benchmark.
  useKeepAwake();

  const params = useLocalSearchParams<{
    renderer?: string;
    nodes?: string;
    duration?: string;
  }>();

  const rendererId = (params.renderer ?? "three-gl") as RendererId;
  const nodeCount = Number(params.nodes ?? 1_000);
  const durationMs = Number(params.duration ?? 20_000);

  const [phase, setPhase] = useState<Phase>("preparing");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [layout, setLayout] = useState<LayoutResult | null>(null);
  const [result, setResult] = useState<BenchResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const graph = useMemo(
    () => generateGraph({ nodeCount, seed: SEED }),
    [nodeCount],
  );

  useEffect(() => {
    let cancelled = false;

    setPhase("preparing");
    setLayout(null);
    setResult(null);
    setError(null);

    computeLayout(graph, {
      onProgress: (done, total) => {
        if (!cancelled) setProgress({ done, total });
      },
    })
      .then((computed) => {
        if (cancelled) return;
        setLayout(computed);
        setPhase("warming");
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setError(cause instanceof Error ? cause.message : String(cause));
      });

    return () => {
      cancelled = true;
    };
  }, [graph]);

  useEffect(() => {
    if (phase !== "warming") return;
    const timer = setTimeout(() => setPhase("measuring"), WARMUP_MS);
    return () => clearTimeout(timer);
  }, [phase]);

  const sampler = useFrameSampler({
    active: phase === "measuring",
    durationMs,
    onComplete: (frameTimes) => {
      const built: BenchResult = {
        id: `${rendererId}-${nodeCount}-${Date.now()}`,
        renderer: rendererId,
        nodeCount,
        linkCount: layout?.links.length ?? 0,
        seed: SEED,
        ticks: layout?.ticks ?? 0,
        simulationMs: layout?.simulationMs ?? 0,
        device: collectDeviceInfo(),
        createdAt: new Date().toISOString(),
        ...summarise(frameTimes),
      };
      addResult(built);
      setResult(built);
      setPhase("done");
    },
  });

  const canvas = useMemo(() => {
    if (!layout) return null;

    const props = {
      positions: layout.positions,
      links: layout.links,
      nodes: graph.nodes,
      // Computed by the layout helper rather than spread into Math.max, which overflows
      // the call stack somewhere around a few hundred thousand arguments.
      boundingRadius: boundingRadius(layout.positions),
      autoRotate: true,
      onError: (message: string) => setError(message),
    };

    switch (rendererId) {
      case "three-gl":
        return <ThreeGLRenderer {...props} />;
      case "r3f-native":
        return <R3FRenderer {...props} />;
      case "skia-2d":
        return <SkiaRenderer {...props} />;
      default:
        return null;
    }
  }, [layout, graph, rendererId]);

  // ── Failure ──
  if (error) {
    return (
      <Screen>
        <Card>
          <SectionTitle title="Run failed" />
          <Text style={styles.errorText}>{error}</Text>
        </Card>
        <Button label="Back" variant="ghost" onPress={() => setPhase("preparing")} />
      </Screen>
    );
  }

  // ── Preparing ──
  if (phase === "preparing") {
    const pct = progress.total > 0 ? progress.done / progress.total : 0;
    return (
      <Screen>
        <Card>
          <SectionTitle
            title="Simulating layout"
            subtitle="Runs before rendering starts, so the two costs are measured separately."
          />
          <Stat label="Renderer" value={RENDERER_LABELS[rendererId]} />
          <Stat label="Nodes" value={nodeCount.toLocaleString()} />
          <Stat
            label="Links"
            value={graph.links.length.toLocaleString()}
          />
          <Stat
            label="Ticks"
            value={`${progress.done} / ${progress.total || "…"}`}
          />
          <View style={styles.progressTrack}>
            <View
              style={[styles.progressFill, { width: `${Math.round(pct * 100)}%` }]}
            />
          </View>
        </Card>
      </Screen>
    );
  }

  // ── Done ──
  if (phase === "done" && result) {
    return (
      <Screen>
        <Card>
          <SectionTitle
            title="Result"
            subtitle={`${RENDERER_LABELS[rendererId]} · ${nodeCount.toLocaleString()} nodes`}
          />
          <Stat
            label="Average"
            value={formatFps(result.fpsAvg)}
            tone={result.fpsAvg >= 50 ? "good" : result.fpsAvg >= 30 ? "warn" : "bad"}
          />
          <Stat label="Median frame" value={formatMs(result.frameMsP50)} />
          <Stat
            label="95th percentile frame"
            value={formatMs(result.frameMsP95)}
            tone={result.frameMsP95 <= 20 ? "good" : result.frameMsP95 <= 33 ? "warn" : "bad"}
          />
          <Stat label="Worst frame" value={formatMs(result.frameMsMax)} />
          <Stat
            label="Janky frames (>33ms)"
            value={`${result.jankFrames} / ${result.frames}`}
            tone={result.jankFrames === 0 ? "good" : "warn"}
          />
          <Stat
            label="Simulation"
            value={`${(result.simulationMs / 1000).toFixed(1)}s · ${result.ticks} ticks`}
          />
        </Card>
        <Button label="Run again" onPress={() => setPhase("preparing")} />
        <Text style={styles.hint}>
          Result stored in memory — export it from the results screen before closing the
          app.
        </Text>
      </Screen>
    );
  }

  // ── Warming / measuring ──
  return (
    <View style={styles.canvasHost}>
      <RendererErrorBoundary
        label={RENDERER_LABELS[rendererId]}
        onError={(message) => setError(message)}
      >
        {canvas}
      </RendererErrorBoundary>

      <View style={styles.hud} pointerEvents="none">
        <Text style={styles.hudPhase}>
          {phase === "warming" ? "warming up…" : "measuring"}
        </Text>
        {phase === "measuring" ? (
          <>
            <Text style={styles.hudFps}>{formatFps(sampler.liveFps)}</Text>
            <Text style={styles.hudMeta}>
              {(sampler.elapsedMs / 1000).toFixed(0)}s /{" "}
              {(durationMs / 1000).toFixed(0)}s
            </Text>
          </>
        ) : null}
        <Text style={styles.hudMeta}>{nodeCount.toLocaleString()} nodes</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  canvasHost: {
    flex: 1,
    backgroundColor: colors.background,
  },
  hud: {
    position: "absolute",
    top: spacing.lg,
    left: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 10,
    backgroundColor: "rgba(24,24,27,0.85)",
    gap: 2,
  },
  hudPhase: {
    color: colors.muted,
    fontSize: type.caption,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  hudFps: {
    color: colors.foreground,
    fontSize: 22,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  hudMeta: {
    color: colors.faint,
    fontSize: type.caption,
    fontVariant: ["tabular-nums"],
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.elevated,
    overflow: "hidden",
    marginTop: spacing.sm,
  },
  progressFill: {
    height: "100%",
    backgroundColor: colors.primary,
  },
  errorText: {
    color: colors.danger,
    fontSize: type.label,
    lineHeight: 18,
  },
  hint: {
    color: colors.faint,
    fontSize: type.caption,
    lineHeight: 16,
    textAlign: "center",
  },
});
