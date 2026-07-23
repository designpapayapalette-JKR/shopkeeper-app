import React from "react";
import { Tabs } from "expo-router";
import { useAuth } from "../../src/lib/auth-context";
import { useModuleVisibility } from "../../src/lib/useModuleVisibility";
import CustomTabBar from "../../src/components/CustomTabBar";

// Bottom bar: Home, Inventory, and Field Tracker as tabs with a raised
// center FAB for Payments. Search and Profile stay one tap from the
// Dashboard grid or the profile avatar instead of living in the bar.
//
// Uses expo-router's real Tabs navigator (each tab is a genuine file route)
// instead of react-native-paper's BottomNavigation + SceneMap, which only
// switched an internal index and never actually navigated — router.push()
// to any screen outside the hardcoded SceneMap was a silent no-op.
export default function TabsLayout() {
  const { userRole } = useAuth();
  const { isModuleEnabled } = useModuleVisibility(userRole);

  const visibleTabs = [
    "index",
    isModuleEnabled("inventory") && "inventory",
    isModuleEnabled("agents") && "agents",
  ].filter((v): v is string => Boolean(v));

  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} visibleTabs={visibleTabs} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen
        name="inventory"
        options={{ title: "Inventory", href: isModuleEnabled("inventory") ? undefined : null }}
      />
      <Tabs.Screen
        name="agents"
        options={{ title: "Tracking", href: isModuleEnabled("agents") ? undefined : null }}
      />
      {/* Reachable via router.push or FAB, not shown as tabs. */}
      <Tabs.Screen name="payment-history" options={{ href: null }} />
      <Tabs.Screen name="invoice-history" options={{ href: null }} />
      <Tabs.Screen name="more" options={{ href: null }} />
      <Tabs.Screen name="pos" options={{ href: null }} />
      <Tabs.Screen name="global-search" options={{ href: null }} />
      <Tabs.Screen name="profile" options={{ href: null }} />
    </Tabs>
  );
}
