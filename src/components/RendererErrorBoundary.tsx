/**
 * Catches a renderer throwing during mount or render.
 *
 * Without this, a failing renderer takes the whole benchmark screen down and the run is
 * lost — which matters most for exactly the case this project exists to investigate.
 *
 * @module components/RendererErrorBoundary
 */

import { Component, type ErrorInfo, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

interface Props {
  children: ReactNode;
  /** Shown in the fallback so the failure names the renderer that produced it. */
  label: string;
  /** Forwarded so a run can be recorded as failed rather than silently missing. */
  onError?: (message: string) => void;
}

interface State {
  message: string | null;
}

/** Error boundary with a renderer-shaped fallback. */
export default class RendererErrorBoundary extends Component<Props, State> {
  state: State = { message: null };

  static getDerivedStateFromError(error: unknown): State {
    return {
      message: error instanceof Error ? error.message : "Unknown render error",
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.props.onError?.(`${error.message}\n${info.componentStack ?? ""}`);
  }

  render() {
    if (this.state.message) {
      return (
        <View style={styles.box}>
          <Text style={styles.title}>{this.props.label} failed</Text>
          <Text style={styles.body}>{this.state.message}</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  box: {
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
  title: {
    color: "#f87171",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
  },
  body: {
    color: "#a1a1aa",
    fontSize: 13,
    textAlign: "center",
  },
});
