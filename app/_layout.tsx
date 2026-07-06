import "../global.css";
import React, { useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { colorScheme } from "nativewind";
import { AuthProvider, useAuth } from "../src/lib/auth-context";
import { ConfirmDialogProvider } from "../src/components/ConfirmDialog";

// The app is light-theme only — several screens have incomplete `dark:`
// class coverage (a card gets a dark background but its text stays the
// light-mode color, making it unreadable), and auditing every screen for
// that is a much bigger job than just not following the system theme.
// Locking the scheme here overrides NativeWind's "media" (system) mode app-wide.
colorScheme.set("light");

function NavigationGuard() {
  const { isAuthenticated, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === "(auth)";

    if (!isAuthenticated && !inAuthGroup) {
      // Redirect to sign-in if not logged in
      router.replace("/(auth)/login");
    } else if (isAuthenticated && inAuthGroup) {
      // Redirect to dashboard if logged in and trying to access auth screens.
      // Note: the dashboard route file is app/(tabs)/index.tsx, not .../dashboard —
      // "/(tabs)" resolves to that group's index route.
      router.replace("/(tabs)");
    }
  }, [isAuthenticated, isLoading, segments]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#030712" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <ConfirmDialogProvider>
          <StatusBar style="auto" />
          <NavigationGuard />
        </ConfirmDialogProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
