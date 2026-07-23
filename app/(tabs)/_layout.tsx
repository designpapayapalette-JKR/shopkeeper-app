import React from "react";
import { Tabs } from "expo-router";
import { useAuth } from "../../src/lib/auth-context";
import { useModuleVisibility } from "../../src/lib/useModuleVisibility";
import CustomTabBar from "../../src/components/CustomTabBar";

// PNB-style bar: 4 daily-use tabs (Dashboard, Inventory, Payments, Invoices)
// plus a raised center "+" that opens a quick-actions sheet. Field Tracking,
// Search, More, and Profile are one tap from the Dashboard grid or the
// profile avatar instead of living in the tab bar.
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
    isModuleEnabled("payments") && "payment-history",
    (isModuleEnabled("pos") || isModuleEnabled("b2b")) && "invoice-history",
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
        name="payment-history"
        options={{ title: "Payments", href: isModuleEnabled("payments") ? undefined : null }}
      />
      <Tabs.Screen
        name="invoice-history"
        options={{ title: "Invoices", href: isModuleEnabled("pos") || isModuleEnabled("b2b") ? undefined : null }}
      />
      {/* Reachable via router.push, not shown as tabs. */}
      <Tabs.Screen name="agents" options={{ href: null }} />
      <Tabs.Screen name="pos" options={{ href: null }} />
      <Tabs.Screen name="global-search" options={{ href: null }} />
      <Tabs.Screen name="more" options={{ href: null }} />
      <Tabs.Screen name="profile" options={{ href: null }} />
    </Tabs>
  );
}
