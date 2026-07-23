import React from "react";
import { View, Pressable, Text, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BottomTabBarProps } from "expo-router/build/react-navigation/bottom-tabs";

// Bottom bar: Home, Inventory, and Field Tracker as tabs with a raised
// center FAB for Payments.
const ICONS: Record<string, string> = {
  index: "view-dashboard-outline",
  inventory: "package-variant-closed",
  agents: "map-marker-radius-outline",
};

const LABELS: Record<string, string> = {
  index: "Home",
  inventory: "Inventory",
  agents: "Tracking",
};

function TabButton({ routeName, focused, onPress }: { routeName: string; focused: boolean; onPress: () => void }) {
  const color = focused ? "#0368FE" : "#9A9591";
  return (
    <Pressable onPress={onPress} style={styles.tabButton} hitSlop={6}>
      <MaterialCommunityIcons name={(ICONS[routeName] ?? ICONS.index) as any} size={21} color={color} />
      <Text style={[styles.tabLabel, { color, fontWeight: focused ? "700" : "500" }]} numberOfLines={1}>
        {LABELS[routeName] ?? routeName}
      </Text>
    </Pressable>
  );
}

export default function CustomTabBar({
  state,
  navigation,
  visibleTabs,
}: BottomTabBarProps & { visibleTabs: string[] }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // expo-router's `href: null` convention hides a Tabs.Screen from its own
  // default tab bar and Link generation, but does NOT strip `href` from the
  // options object handed to a *custom* tabBar — so filtering on
  // `descriptors[key].options.href` here always saw `undefined` and let
  // every declared screen (including the intentionally-hidden ones) render.
  // Filtering by an explicit name list from the layout is unambiguous.
  const visibleRoutes = state.routes.filter((route: (typeof state.routes)[number]) =>
    visibleTabs.includes(route.name)
  );
  const half = Math.ceil(visibleRoutes.length / 2);
  const leftRoutes = visibleRoutes.slice(0, half);
  const rightRoutes = visibleRoutes.slice(half);

  const renderTab = (route: (typeof state.routes)[number]) => {
    const isFocused = state.routes[state.index]?.key === route.key;
    const onPress = () => {
      const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
      if (!isFocused && !event.defaultPrevented) {
        navigation.navigate(route.name);
      }
    };
    return <TabButton key={route.key} routeName={route.name} focused={isFocused} onPress={onPress} />;
  };

  return (
    <>
      <View style={[styles.bar, { height: 62 + insets.bottom, paddingBottom: insets.bottom }]}>
        {leftRoutes.map(renderTab)}
        <View style={styles.centerSpacer} />
        {rightRoutes.map(renderTab)}
      </View>
      <Pressable
        style={[styles.fabWrapper, { bottom: 30 + insets.bottom }]}
        onPress={() => router.push("/payment-history")}
        hitSlop={8}
      >
        <View style={styles.fabHalo}>
          <LinearGradient
            colors={["#0368FE", "#03A8FE"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.fab}
          >
            <MaterialCommunityIcons name="credit-card-outline" size={30} color="#FFFFFF" />
          </LinearGradient>
        </View>
        <Text style={styles.fabLabel}>Payments</Text>
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingTop: 9,
    paddingHorizontal: 4,
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 16,
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 3,
  },
  tabLabel: {
    fontSize: 10.5,
  },
  centerSpacer: {
    width: 72,
  },
  fabWrapper: {
    position: "absolute",
    left: "50%",
    marginLeft: -34,
    alignItems: "center",
  },
  fabHalo: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    shadowColor: "#0368FE",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
  },
  fab: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  fabLabel: {
    marginTop: 3,
    fontSize: 10.5,
    fontWeight: "700",
    color: "#0368FE",
  },
});
