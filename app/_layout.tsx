import "../global.css";
import React, { useEffect, useRef } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, View, AppState } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { colorScheme } from "nativewind";
import { AuthProvider, useAuth } from "../src/lib/auth-context";
import { ConfirmDialogProvider } from "../src/components/ConfirmDialog";
import { syncQueuedSales } from "../src/lib/offlineQueue";

// The app is light-theme only — several screens have incomplete `dark:`
// class coverage (a card gets a dark background but its text stays the
// light-mode color, making it unreadable), and auditing every screen for
// that is a much bigger job than just not following the system theme.
// Locking the scheme here overrides NativeWind's "media" (system) mode app-wide.
colorScheme.set("light");

function NavigationGuard() {
  const { isAuthenticated, isLoading, activeCompany } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const appState = useRef(AppState.currentState);

  // A sale made while offline sits in local storage until this fires — on
  // launch, and again every time the app comes back to the foreground
  // (the moment connectivity most likely just returned, e.g. after
  // switching from airplane mode or walking back into Wi-Fi range).
  useEffect(() => {
    if (!isAuthenticated) return;
    syncQueuedSales().catch((e) => {
      console.error("[syncQueuedSales] Initial sync failed:", e);
    });
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (appState.current.match(/inactive|background/) && nextState === "active") {
        syncQueuedSales().catch((e) => {
          console.error("[syncQueuedSales] Resume sync failed:", e);
        });
      }
      appState.current = nextState;
    });
    return () => subscription.remove();
  }, [isAuthenticated]);

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === "(auth)";
    const onOnboarding = segments.includes("onboarding" as never);
    // A brand-new company (fresh registration via a beta invite link) hasn't
    // completed the onboarding wizard yet — send them straight into it
    // instead of leaving it as an easy-to-miss dashboard banner, so a
    // first-time download actually gets set up properly. Uses the explicit
    // onboardingCompletedAt flag (not "has a GSTIN") since a shop below the
    // GST threshold legitimately has neither and shouldn't get stuck looping.
    const needsOnboarding = !!activeCompany && !activeCompany.onboarding_completed_at;

    if (!isAuthenticated && !inAuthGroup) {
      // Redirect to sign-in if not logged in
      router.replace("/(auth)/login");
    } else if (isAuthenticated && inAuthGroup) {
      // Redirect to dashboard if logged in and trying to access auth screens.
      // Note: the dashboard route file is app/(tabs)/index.tsx, not .../dashboard —
      // "/(tabs)" resolves to that group's index route.
      router.replace("/(tabs)");
    } else if (isAuthenticated && needsOnboarding && !onOnboarding) {
      router.replace("/onboarding" as any);
    }
  }, [isAuthenticated, isLoading, segments, activeCompany]);

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

import { TerminologyProvider } from "../src/lib/terminology-context";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <TerminologyProvider>
        <AuthProvider>
          <ConfirmDialogProvider>
            <StatusBar style="auto" />
            <NavigationGuard />
          </ConfirmDialogProvider>
        </AuthProvider>
      </TerminologyProvider>
    </SafeAreaProvider>
  );
}

