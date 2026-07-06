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
  const { isAuthenticated, isLoading, activeCompany } = useAuth();
  const segments = useSegments();
  const router = useRouter();

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
