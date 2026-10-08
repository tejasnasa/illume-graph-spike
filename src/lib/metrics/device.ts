/**
 * Device identification for benchmark reports.
 *
 * A frame rate without the device attached to it is not a result. Phone GPUs vary by more
 * than an order of magnitude across price tiers, and thermal throttling means the same
 * phone produces different numbers at different times — so every run records where and on
 * what it happened.
 *
 * @module lib/metrics/device
 */

import Constants from "expo-constants";
import * as Device from "expo-device";
import { Dimensions, PixelRatio, Platform } from "react-native";
import type { DeviceInfo } from "./types";

/**
 * Snapshot the current device.
 *
 * @returns Everything needed to interpret a result later.
 */
export function collectDeviceInfo(): DeviceInfo {
  const { width, height } = Dimensions.get("window");

  return {
    model: Device.modelName ?? "unknown",
    platform: Platform.OS,
    osVersion: String(Platform.Version),
    // Emulators are the single most misleading environment for GPU work, so whether this
    // was a real device is recorded rather than assumed.
    isDevice: Device.isDevice,
    totalMemoryBytes: Device.totalMemory ?? null,
    screenWidth: Math.round(width),
    screenHeight: Math.round(height),
    pixelRatio: PixelRatio.get(),
    expoSdk: Constants.expoConfig?.sdkVersion ?? "unknown",
  };
}

/**
 * Render a memory figure for display.
 *
 * @param bytes - Total memory, or null when unavailable.
 * @returns A short string such as `7.6 GB`.
 */
export function formatMemory(bytes: number | null): string {
  if (!bytes) return "unknown";
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}
