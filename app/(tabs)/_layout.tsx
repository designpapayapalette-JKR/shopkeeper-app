import { Tabs } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMemo } from "react";
import { useEnabledModules } from "../../src/lib/useEnabledModules";

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

function TabIcon({
  active,
  inactive,
  focused,
}: {
  active: IconName;
  inactive: IconName;
  focused: boolean;
}) {
  return (
    <MaterialCommunityIcons
      name={focused ? active : inactive}
      size={focused ? 24 : 22}
      color={focused ? "#0F7A5F" : "#9E9E9E"}
    />
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const { isEnabled } = useEnabledModules();

  const baseOptions = {
    headerShown: false,
    tabBarStyle: {
      backgroundColor: "#FFFFFF",
      borderTopWidth: 0,
      elevation: 12,
      shadowColor: "#000",
      shadowOpacity: 0.06,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: -2 },
      height: 62 + insets.bottom,
      paddingBottom: 8 + insets.bottom,
      paddingTop: 8,
    },
    tabBarActiveTintColor: "#0F7A5F",
    tabBarInactiveTintColor: "#9E9E9E",
    tabBarLabelStyle: {
      fontSize: 10.5,
      fontWeight: "700" as const,
      marginTop: 3,
    },
  };

  const dashboardOptions = useMemo(() => ({
    ...baseOptions,
    title: "Dashboard",
    tabBarIcon: ({ focused }: { focused: boolean }) => (
      <TabIcon active="view-dashboard" inactive="view-dashboard-outline" focused={focused} />
    ),
  }), []);

  const posOptions = useMemo(() => ({
    ...baseOptions,
    title: "POS",
    tabBarIcon: ({ focused }: { focused: boolean }) => (
      <TabIcon active="point-of-sale" inactive="point-of-sale" focused={focused} />
    ),
    tabBarButton: isEnabled("pos") ? undefined : (() => null) as any,
  }), [isEnabled]);

  const b2bOptions = useMemo(() => ({
    ...baseOptions,
    title: "B2B",
    tabBarIcon: ({ focused }: { focused: boolean }) => (
      <TabIcon active="briefcase-account" inactive="briefcase-account-outline" focused={focused} />
    ),
    tabBarButton: isEnabled("b2b") ? undefined : (() => null) as any,
  }), [isEnabled]);

  const inventoryOptions = useMemo(() => ({
    ...baseOptions,
    title: "Inventory",
    tabBarIcon: ({ focused }: { focused: boolean }) => (
      <TabIcon active="package-variant" inactive="package-variant-closed" focused={focused} />
    ),
    tabBarButton: isEnabled("inventory") ? undefined : (() => null) as any,
  }), [isEnabled]);

  const ledgerOptions = useMemo(() => ({
    ...baseOptions,
    title: "Party",
    tabBarIcon: ({ focused }: { focused: boolean }) => (
      <TabIcon active="account-group" inactive="account-group-outline" focused={focused} />
    ),
    tabBarButton: isEnabled("ledger") ? undefined : (() => null) as any,
  }), [isEnabled]);

  const agentsOptions = useMemo(() => ({
    ...baseOptions,
    title: "Agents",
    tabBarIcon: ({ focused }: { focused: boolean }) => (
      <TabIcon active="map-marker-radius" inactive="map-marker-radius-outline" focused={focused} />
    ),
    tabBarButton: isEnabled("agents") ? undefined : (() => null) as any,
  }), [isEnabled]);

  return (
    <Tabs screenOptions={baseOptions as any}>
      <Tabs.Screen name="index" options={dashboardOptions as any} />
      <Tabs.Screen name="pos" options={posOptions as any} />
      <Tabs.Screen name="b2b" options={b2bOptions as any} />
      <Tabs.Screen name="inventory" options={inventoryOptions as any} />
      <Tabs.Screen name="ledger" options={ledgerOptions as any} />
      <Tabs.Screen name="agents" options={agentsOptions as any} />
    </Tabs>
  );
}
