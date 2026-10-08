/**
 * Dark palette and spacing.
 *
 * Hex values approximating Illume's web tokens, which are authored in `oklch`. They are
 * hand-converted here rather than derived, because this project is a standalone repository
 * with no build step shared with the client.
 *
 * Worth knowing if this spike's `diagnostics` screen is used to answer the question: React
 * Native's colour parser has historically accepted only hex, `rgb()`, `hsl()`, and named
 * colours. If a current RN build parses `oklch()` directly, the real port can copy the
 * token block verbatim instead of converting it.
 *
 * @module theme
 */

export const colors = {
  background: "#09090b",
  card: "#18181b",
  elevated: "#27272a",
  foreground: "#fafafa",
  muted: "#a1a1aa",
  faint: "#71717a",
  border: "rgba(255,255,255,0.10)",
  primary: "#be123c",
  accent: "#67e8f9",
  success: "#4ade80",
  caution: "#facc15",
  danger: "#f87171",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
} as const;

export const type = {
  title: 26,
  heading: 18,
  body: 15,
  label: 13,
  caption: 11,
  mono: 13,
} as const;
