import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { colors } from "@/theme";

/**
 * Root navigation.
 *
 * @returns The stack every screen is pushed onto.
 */
export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.foreground,
          headerTitleStyle: { fontWeight: "600" },
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="index" options={{ title: "Graph renderer bench" }} />
        <Stack.Screen name="bench" options={{ title: "Running" }} />
        <Stack.Screen name="results" options={{ title: "Results" }} />
        <Stack.Screen
          name="diagnostics"
          options={{ title: "Environment diagnostics" }}
        />
      </Stack>
    </>
  );
}
