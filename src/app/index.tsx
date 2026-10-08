/**
 * Benchmark setup.
 *
 * @module app/index
 */

import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Button, Card, Choice, Screen, SectionTitle } from "@/components/ui";
import { collectDeviceInfo, formatMemory } from "@/lib/metrics/device";
import {
  RENDERER_LABELS,
  RENDERER_NOTES,
  type RendererId,
} from "@/lib/metrics/types";
import { SIZES } from "@/lib/graph/types";
import { colors, spacing, type } from "@/theme";

const RENDERERS: RendererId[] = ["three-gl", "r3f-native", "skia-2d"];

/** Measurement windows offered. */
const DURATIONS = [
  { label: "Quick · 20s", value: 20_000 },
  { label: "Sustained · 2 min", value: 120_000 },
] as const;

/**
 * Choose a renderer and a graph size, then run.
 *
 * @returns The setup screen.
 */
export default function SetupScreen() {
  const router = useRouter();
  const [renderer, setRenderer] = useState<RendererId>("three-gl");
  const [nodeCount, setNodeCount] = useState<number>(1_000);
  const [durationMs, setDurationMs] = useState<number>(20_000);

  // Collected once: a device cannot change mid-session, and re-reading memory on every
  // keystroke would be pointless work.
  const device = useMemo(() => collectDeviceInfo(), []);

  return (
    <Screen>
      <Card>
        <SectionTitle
          title="Device"
          subtitle="Recorded with every run. Frame rates are meaningless without it."
        />
        <View style={styles.deviceGrid}>
          <Text style={styles.deviceLine}>
            {device.model} · {device.platform} {device.osVersion}
          </Text>
          <Text style={styles.deviceLine}>
            {device.screenWidth}×{device.screenHeight} @{device.pixelRatio}x ·{" "}
            {formatMemory(device.totalMemoryBytes)}
          </Text>
          <Text style={styles.deviceLine}>
            {device.isDevice
              ? "Physical device"
              : "⚠ Emulator — GPU numbers will not transfer to real hardware"}
          </Text>
          <Text style={styles.deviceLine}>Expo SDK {device.expoSdk}</Text>
        </View>
      </Card>

      <View style={styles.group}>
        <SectionTitle title="Renderer" />
        {RENDERERS.map((id) => (
          <Choice
            key={id}
            label={RENDERER_LABELS[id]}
            note={RENDERER_NOTES[id]}
            selected={renderer === id}
            onPress={() => setRenderer(id)}
          />
        ))}
      </View>

      <View style={styles.group}>
        <SectionTitle
          title="Nodes"
          subtitle="Links scale with node count — roughly 2–4 per node."
        />
        <View style={styles.wrap}>
          {SIZES.map((size) => (
            <Choice
              key={size}
              label={size.toLocaleString()}
              selected={nodeCount === size}
              onPress={() => setNodeCount(size)}
            />
          ))}
        </View>
      </View>

      <View style={styles.group}>
        <SectionTitle
          title="Window"
          subtitle="The sustained window is the one that exposes thermal throttling — a phone can look fine for 20 seconds and fall apart after two minutes."
        />
        {DURATIONS.map((option) => (
          <Choice
            key={option.value}
            label={option.label}
            selected={durationMs === option.value}
            onPress={() => setDurationMs(option.value)}
          />
        ))}
      </View>

      <Button
        label="Run benchmark"
        onPress={() =>
          router.push({
            pathname: "/bench",
            params: {
              renderer,
              nodes: String(nodeCount),
              duration: String(durationMs),
            },
          })
        }
      />

      <View style={styles.group}>
        <Button
          label="View results"
          variant="ghost"
          onPress={() => router.push("/results")}
        />
        <Button
          label="Environment diagnostics"
          variant="ghost"
          onPress={() => router.push("/diagnostics")}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: spacing.sm,
  },
  wrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  deviceGrid: {
    gap: spacing.xs,
  },
  deviceLine: {
    color: colors.muted,
    fontSize: type.caption,
    lineHeight: 16,
  },
});
