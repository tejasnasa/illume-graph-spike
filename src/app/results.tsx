/**
 * Stored results, and export.
 *
 * @module app/results
 */

import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Button, Card, ErrorText, Screen, SectionTitle } from "@/components/ui";
import { formatMemory } from "@/lib/metrics/device";
import { clearResults, exportResults, useResults } from "@/lib/metrics/store";
import { formatFps, formatMs } from "@/lib/metrics/summarise";
import { RENDERER_LABELS, type BenchResult } from "@/lib/metrics/types";
import { colors, spacing, type } from "@/theme";

const EXPORT_FILENAME = "illume-graph-spike-results.json";

/**
 * Render one stored run.
 *
 * @param props - The run to display.
 * @returns A result card.
 */
function ResultCard({ result }: { result: BenchResult }) {
  return (
    <Card>
      <SectionTitle
        title={`${RENDERER_LABELS[result.renderer]} · ${result.nodeCount.toLocaleString()} nodes`}
        subtitle={new Date(result.createdAt).toLocaleString()}
      />
      <View style={styles.grid}>
        <View style={styles.cell}>
          <Text style={styles.cellLabel}>avg</Text>
          <Text style={styles.cellValue}>{formatFps(result.fpsAvg)}</Text>
        </View>
        <View style={styles.cell}>
          <Text style={styles.cellLabel}>p50</Text>
          <Text style={styles.cellValue}>{formatMs(result.frameMsP50)}</Text>
        </View>
        <View style={styles.cell}>
          <Text style={styles.cellLabel}>p95</Text>
          <Text style={styles.cellValue}>{formatMs(result.frameMsP95)}</Text>
        </View>
        <View style={styles.cell}>
          <Text style={styles.cellLabel}>jank</Text>
          <Text style={styles.cellValue}>
            {result.jankFrames}/{result.frames}
          </Text>
        </View>
      </View>
      <Text style={styles.meta}>
        {result.linkCount.toLocaleString()} links · sim{" "}
        {(result.simulationMs / 1000).toFixed(1)}s · {result.device.model} ·{" "}
        {formatMemory(result.device.totalMemoryBytes)}
        {result.device.isDevice ? "" : " · EMULATOR"}
      </Text>
    </Card>
  );
}

/**
 * List stored runs and export them.
 *
 * @returns The results screen.
 */
export default function ResultsScreen() {
  const results = useResults();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onExport = async () => {
    setBusy(true);
    setError(null);
    try {
      const file = new File(Paths.cache, EXPORT_FILENAME);
      // `create` throws when the path already exists, so clear it first — a second export
      // in the same session would otherwise fail.
      if (file.exists) file.delete();
      file.create();
      file.write(exportResults());

      if (!(await Sharing.isAvailableAsync())) {
        setError(`Sharing unavailable. File written to ${file.uri}`);
        return;
      }
      await Sharing.shareAsync(file.uri, {
        mimeType: "application/json",
        dialogTitle: "Export benchmark results",
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      {results.length === 0 ? (
        <Card>
          <SectionTitle
            title="No runs yet"
            subtitle="Results live in memory and are cleared when the app closes, so export before you force-quit."
          />
        </Card>
      ) : (
        <>
          <Button label="Export as JSON" onPress={onExport} disabled={busy} />
          {error ? <ErrorText>{error}</ErrorText> : null}
          {results.map((result) => (
            <ResultCard key={result.id} result={result} />
          ))}
          <Button label="Clear all" variant="danger" onPress={clearResults} />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  cell: {
    flex: 1,
    backgroundColor: colors.elevated,
    borderRadius: 8,
    padding: spacing.sm,
    alignItems: "center",
    gap: 2,
  },
  cellLabel: {
    color: colors.faint,
    fontSize: type.caption,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  cellValue: {
    color: colors.foreground,
    fontSize: type.label,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  meta: {
    color: colors.faint,
    fontSize: type.caption,
    lineHeight: 16,
  },
});
