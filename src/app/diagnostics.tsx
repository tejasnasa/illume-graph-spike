/**
 * Environment diagnostics.
 *
 * Answers two questions that are cheap to ask here and awkward to answer later:
 *
 *   1. Does this React Native build parse `oklch()` colours? The real client's theme is
 *      authored entirely in oklch, so a yes turns the token port into a copy-paste and a no
 *      turns it into a conversion step.
 *   2. Which of the three renderers' native modules actually loaded?
 *
 * @module app/diagnostics
 */

import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Card, Screen, SectionTitle, Stat } from "@/components/ui";
import { collectDeviceInfo, formatMemory } from "@/lib/metrics/device";
import { colors, radius, spacing, type } from "@/theme";

/**
 * Swatches for the oklch question.
 *
 * Each pair is the same token expressed two ways. If the two halves of a swatch are
 * indistinguishable, this build understands `oklch` and the web theme can be copied
 * verbatim. If the left half is blank or wildly different, it does not.
 */
const OKLCH_PAIRS = [
  { label: "background", oklch: "oklch(0.141 0.005 285.823)", hex: "#09090b" },
  { label: "card", oklch: "oklch(0.21 0.006 285.885)", hex: "#18181b" },
  { label: "primary", oklch: "oklch(0.459 0.187 3.815)", hex: "#be123c" },
  { label: "success", oklch: "oklch(0.75 0.16 155)", hex: "#4ade80" },
] as const;

/**
 * Report the runtime environment.
 *
 * @returns The diagnostics screen.
 */
export default function DiagnosticsScreen() {
  const device = useMemo(() => collectDeviceInfo(), []);

  return (
    <Screen>
      <Card>
        <SectionTitle
          title="oklch support"
          subtitle="Left half is the oklch token from the web client; right half is its hex equivalent. If a pair looks like two different colours, this build cannot parse oklch and the theme needs converting."
        />
        {OKLCH_PAIRS.map((pair) => (
          <View key={pair.label} style={styles.swatchRow}>
            <Text style={styles.swatchLabel}>{pair.label}</Text>
            <View style={styles.swatchTrack}>
              <View style={[styles.swatchHalf, { backgroundColor: pair.oklch }]} />
              <View style={[styles.swatchHalf, { backgroundColor: pair.hex }]} />
            </View>
            <Text style={styles.swatchValue}>{pair.hex}</Text>
          </View>
        ))}
      </Card>

      <Card>
        <SectionTitle title="Device" />
        <Stat label="Model" value={device.model} />
        <Stat label="Platform" value={`${device.platform} ${device.osVersion}`} />
        <Stat
          label="Physical device"
          value={device.isDevice ? "yes" : "no — emulator"}
          tone={device.isDevice ? "good" : "bad"}
        />
        <Stat label="Memory" value={formatMemory(device.totalMemoryBytes)} />
        <Stat
          label="Screen"
          value={`${device.screenWidth}×${device.screenHeight} @${device.pixelRatio}x`}
        />
        <Stat label="Expo SDK" value={device.expoSdk} />
      </Card>

      <Card>
        <SectionTitle
          title="Renderer modules"
          subtitle="All three are imported at bundle time, so a failure here is a failure of this whole app rather than of one option."
        />
        <Stat label="expo-gl" value="bundled" tone="good" />
        <Stat label="three" value="bundled" tone="good" />
        <Stat label="@react-three/fiber" value="v9 (native entry)" tone="good" />
        <Stat label="@shopify/react-native-skia" value="bundled" tone="good" />
        <Text style={styles.note}>
          On-device availability is only proven by a run. Use the renderer that produced a
          frame, not this list.
        </Text>
      </Card>

      <Card>
        <SectionTitle title="Reading the numbers" />
        <Text style={styles.note}>
          The sampler measures how fast the JS thread keeps up with the display, for all
          three renderers equally. A renderer that draws on the UI thread can keep painting
          smoothly while the JS thread is congested — this reports that congestion, which is
          a real cost to responsiveness, but it is not the same as dropped GPU frames.
        </Text>
        <Text style={styles.note}>
          Skia projects on the JS thread and rebuilds its paths every frame. Treat its result
          as a floor, not a ceiling.
        </Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  swatchRow: {
    gap: spacing.xs,
  },
  swatchLabel: {
    color: colors.muted,
    fontSize: type.caption,
  },
  swatchTrack: {
    flexDirection: "row",
    height: 44,
    borderRadius: radius.sm,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
  },
  swatchHalf: {
    flex: 1,
  },
  swatchValue: {
    color: colors.faint,
    fontSize: type.caption,
    fontVariant: ["tabular-nums"],
  },
  note: {
    color: colors.faint,
    fontSize: type.caption,
    lineHeight: 16,
  },
});
