/**
 * Small presentational primitives.
 *
 * Deliberately minimal: this is a measurement harness, and every dependency added to it is
 * another thing that could be the reason a frame was slow.
 *
 * @module components/ui
 */

import type { ReactNode } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";

import { colors, radius, spacing, type } from "@/theme";

/** A tappable button. */
export function Button({
  label,
  onPress,
  variant = "primary",
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  variant?: "primary" | "ghost" | "danger";
  disabled?: boolean;
}) {
  const background =
    variant === "primary"
      ? colors.primary
      : variant === "danger"
        ? "rgba(248,113,113,0.15)"
        : "transparent";

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: background, opacity: disabled ? 0.4 : pressed ? 0.75 : 1 },
        variant === "ghost" && styles.buttonGhost,
      ]}
    >
      <Text
        style={[
          styles.buttonLabel,
          variant === "danger" && { color: colors.danger },
          variant === "ghost" && { color: colors.muted },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** A bordered surface. */
export function Card({
  children,
  style,
}: {
  children: ReactNode;
  style?: ViewStyle;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}

/** Section heading with optional supporting text. */
export function SectionTitle({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <View style={styles.sectionTitle}>
      <Text style={styles.sectionTitleText}>{title}</Text>
      {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

/** A label/value row. */
export function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "good" | "warn" | "bad";
}) {
  const toneColor =
    tone === "good"
      ? colors.success
      : tone === "warn"
        ? colors.caution
        : tone === "bad"
          ? colors.danger
          : colors.foreground;

  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, { color: toneColor }]}>{value}</Text>
    </View>
  );
}

/** A selectable pill, used for renderer and size choices. */
export function Choice({
  label,
  note,
  selected,
  onPress,
}: {
  label: string;
  note?: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.choice,
        selected && styles.choiceSelected,
        { opacity: pressed ? 0.75 : 1 },
      ]}
    >
      <Text style={[styles.choiceLabel, selected && { color: colors.foreground }]}>
        {label}
      </Text>
      {note ? <Text style={styles.choiceNote}>{note}</Text> : null}
    </Pressable>
  );
}

/** Page scaffold with consistent padding and background. */
export function Screen({
  children,
  scroll = true,
}: {
  children: ReactNode;
  scroll?: boolean;
}) {
  if (!scroll) return <View style={styles.screen}>{children}</View>;
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.screenContent}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

/** Inline error text. */
export function ErrorText({ children }: { children: ReactNode }) {
  return <Text style={styles.error}>{children}</Text>;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  screenContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl * 2,
    gap: spacing.lg,
  },
  button: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonGhost: {
    borderWidth: 1,
    borderColor: colors.border,
  },
  buttonLabel: {
    color: "#ffffff",
    fontSize: type.body,
    fontWeight: "600",
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  sectionTitle: {
    gap: 2,
  },
  sectionTitleText: {
    color: colors.foreground,
    fontSize: type.heading,
    fontWeight: "600",
  },
  sectionSubtitle: {
    color: colors.faint,
    fontSize: type.label,
    lineHeight: 18,
  },
  stat: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.xs,
  },
  statLabel: {
    color: colors.muted,
    fontSize: type.label,
  },
  statValue: {
    fontSize: type.label,
    fontVariant: ["tabular-nums"],
    fontWeight: "600",
  },
  choice: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    gap: 2,
  },
  choiceSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.elevated,
  },
  choiceLabel: {
    color: colors.muted,
    fontSize: type.body,
    fontWeight: "500",
  },
  choiceNote: {
    color: colors.faint,
    fontSize: type.caption,
    lineHeight: 15,
  },
  error: {
    color: colors.danger,
    fontSize: type.label,
    lineHeight: 18,
  },
});
