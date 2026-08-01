import React from "react";
import { Tabs } from "expo-router";
import { useAuth } from "../../src/lib/auth-context";
import CustomTabBar from "../../src/components/CustomTabBar";

export default function TabsLayout() {
  const { userRole } = useAuth();

  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} userRole={userRole} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index"     options={{ title: "Home" }} />
      <Tabs.Screen name="sales"     options={{ title: "Sales" }} />
      <Tabs.Screen name="inventory" options={{ title: "Stock" }} />
      <Tabs.Screen name="agents"    options={{ title: "Field" }} />
      {/* POS is only accessible to cashier/staff via router.push — not visible in Owner app tab bar */}
      <Tabs.Screen name="pos"              options={{ href: null }} />
      <Tabs.Screen name="payment-history"  options={{ href: null }} />
      <Tabs.Screen name="invoice-history"  options={{ href: null }} />
      <Tabs.Screen name="more"             options={{ href: null }} />
      <Tabs.Screen name="global-search"    options={{ href: null }} />
      <Tabs.Screen name="profile"          options={{ href: null }} />
    </Tabs>
  );
}
