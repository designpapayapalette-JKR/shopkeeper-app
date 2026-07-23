import React, { Component, ErrorInfo, ReactNode } from "react";
import { View, Text, Pressable } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Paths, File, Directory } from "expo-file-system";

async function saveCrashReport(error: Error, errorInfo: ErrorInfo) {
  try {
    const report = [
      `=== MMC Shop Crash Report ===`,
      `Timestamp: ${new Date().toISOString()}`,
      `Error: ${error.name}: ${error.message}`,
      `Stack: ${error.stack || "(no stack)"}`,
      `Component Stack: ${errorInfo.componentStack || "(none)"}`,
      `==============================`,
    ].join("\n");

    const filename = `crash-${Date.now()}.log`;
    const crashDir = new Directory(Paths.document, "crash-reports");
    await crashDir.create({ intermediates: true });
    const crashFile = new File(crashDir, filename);
    await crashFile.write(report);
  } catch {
    // best-effort — crash report should never cascade into a second crash
  }
}

interface ErrorBoundaryProps {
  children: ReactNode;
  /** A human-readable label for this boundary scope */
  scope?: string;
  /** Custom fallback UI — if omitted, a generic error card is shown */
  fallback?: ReactNode;
  onRetry?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    saveCrashReport(error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
    this.props.onRetry?.();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <View className="flex-1 items-center justify-center bg-background px-6">
          <View className="w-16 h-16 rounded-full bg-error/10 items-center justify-center mb-4">
            <MaterialCommunityIcons name="alert-circle" size={32} color="#D64545" />
          </View>
          <Text className="font-headline-sm text-on-surface text-center mb-2">
            {this.props.scope || "Something went wrong"}
          </Text>
          <Text className="font-body-md text-on-surface-variant text-center mb-6" style={{ fontSize: 14, lineHeight: 20 }}>
            {this.state.error?.message || "An unexpected error occurred."}
          </Text>
          <Pressable
            onPress={this.handleRetry}
            className="bg-primary px-6 py-3 rounded-xl"
          >
            <Text className="text-white font-bold text-sm">Try Again</Text>
          </Pressable>
        </View>
      );
    }

    return this.props.children;
  }
}
