import React from "react";
import { Tabs } from "expo-router";
import { useAuth } from "../../src/lib/auth-context";
import CustomTabBar from "../../src/components/CustomTabBar";

// Bottom bar: 4 fixed tabs — Home, Inventory, Tracking, Payments — plus
// a center "+" FAB that opens a role-filtered quick-actions sheet. All 4
// tabs render for every user; individual screens show an access-denied
// state when the user's role lacks the underlying module.
export default function TabsLayout() {
  const { userRole } = useAuth();

  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} userRole={userRole} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="inventory" options={{ title: "Inventory" }} />
      <Tabs.Screen name="agents" options={{ title: "Tracking" }} />
      <Tabs.Screen name="payment-history" options={{ title: "Payments" }} />
      {/* Reachable via router.push, not shown as tabs. */}
      <Tabs.Screen name="invoice-history" options={{ href: null }} />
      <Tabs.Screen name="employee-advances" options={{ href: null }} />
      <Tabs.Screen name="more" options={{ href: null }} />
      <Tabs.Screen name="pos" options={{ href: null }} />
      <Tabs.Screen name="global-search" options={{ href: null }} />
      <Tabs.Screen name="profile" options={{ href: null }} />
    </Tabs>
  );
}
