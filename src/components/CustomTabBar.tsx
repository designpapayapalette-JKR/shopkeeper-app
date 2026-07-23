import React, { useState } from "react";
import { View, Pressable, Text, StyleSheet, Modal } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BottomTabBarProps } from "expo-router/build/react-navigation/bottom-tabs";

// PNB-style bottom bar: a plain, edge-to-edge bar with flat icon+label tabs,
// and a raised gradient "+" button punched through the middle that opens a
// quick-actions sheet — mirrors data/Mobile App Ref/PNB.jpg's layout, in our
// brand colors instead of theirs.
const ICONS: Record<string, string> = {
  index: "view-dashboard-outline",
  inventory: "package-variant-closed",
  "payment-history": "credit-card-outline",
  "invoice-history": "history",
};

const LABELS: Record<string, string> = {
  index: "Home",
  inventory: "Inventory",
  "payment-history": "Payments",
  "invoice-history": "Invoices",
};

const QUICK_ACTIONS: { key: string; label: string; desc: string; icon: string; route: string }[] = [
  { key: "new-sale", label: "New Sale", desc: "Start a POS bill", icon: "point-of-sale", route: "/pos" },
  { key: "new-invoice", label: "New Invoice", desc: "Create an order or quote", icon: "file-document-outline", route: "/estimates" },
  { key: "new-expense", label: "New Expense", desc: "Log a business expense", icon: "wallet-outline", route: "/expenses" },
  { key: "new-payment", label: "New Payment", desc: "Record money in or out", icon: "credit-card-outline", route: "/payment-history" },
];

function TabButton({ routeName, focused, onPress }: { routeName: string; focused: boolean; onPress: () => void }) {
  const color = focused ? "#0368FE" : "#9A9591";
  return (
    <Pressable onPress={onPress} style={styles.tabButton} hitSlop={8}>
      <MaterialCommunityIcons name={(ICONS[routeName] ?? ICONS.index) as any} size={23} color={color} />
      <Text style={[styles.tabLabel, { color, fontWeight: focused ? "700" : "500" }]} numberOfLines={1}>
        {LABELS[routeName] ?? routeName}
      </Text>
    </Pressable>
  );
}

function QuickActionsSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const router = useRouter();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose}>
        <Pressable style={styles.sheetCard} onPress={() => {}}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Quick Actions</Text>
          {QUICK_ACTIONS.map((action) => (
            <Pressable
              key={action.key}
              style={styles.sheetRow}
              onPress={() => {
                onClose();
                router.push(action.route as any);
              }}
            >
              <LinearGradient
                colors={["#0368FE", "#03A8FE"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.sheetIconChip}
              >
                <MaterialCommunityIcons name={action.icon as any} size={22} color="#FFFFFF" />
              </LinearGradient>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetRowLabel}>{action.label}</Text>
                <Text style={styles.sheetRowDesc}>{action.desc}</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color="#9A9591" />
            </Pressable>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default function CustomTabBar({
  state,
  navigation,
  visibleTabs,
}: BottomTabBarProps & { visibleTabs: string[] }) {
  const insets = useSafeAreaInsets();
  const [sheetOpen, setSheetOpen] = useState(false);

  // expo-router's `href: null` convention hides a Tabs.Screen from its own
  // default tab bar and Link generation, but does NOT strip `href` from the
  // options object handed to a *custom* tabBar — so filtering on
  // `descriptors[key].options.href` here always saw `undefined` and let
  // every declared screen (including the intentionally-hidden ones) render.
  // Filtering by an explicit name list from the layout is unambiguous.
  const visibleRoutes = state.routes.filter((route: (typeof state.routes)[number]) =>
    visibleTabs.includes(route.name)
  );
  const leftRoutes = visibleRoutes.slice(0, 2);
  const rightRoutes = visibleRoutes.slice(2, 4);

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
      <View style={[styles.bar, { height: 64 + insets.bottom, paddingBottom: insets.bottom }]}>
        {leftRoutes.map(renderTab)}
        <View style={styles.centerSpacer} />
        {rightRoutes.map(renderTab)}
      </View>
      <Pressable
        style={[styles.fabWrapper, { bottom: 34 + insets.bottom }]}
        onPress={() => setSheetOpen(true)}
        hitSlop={8}
      >
        <LinearGradient
          colors={["#0368FE", "#03A8FE"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.fab}
        >
          <MaterialCommunityIcons name="plus" size={30} color="#FFFFFF" />
        </LinearGradient>
        <Text style={styles.fabLabel}>New</Text>
      </Pressable>
      <QuickActionsSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingTop: 10,
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
    gap: 4,
  },
  tabLabel: {
    fontSize: 11.5,
  },
  centerSpacer: {
    width: 76,
  },
  fabWrapper: {
    position: "absolute",
    left: "50%",
    marginLeft: -34,
    alignItems: "center",
  },
  fab: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 4,
    borderColor: "#FFFFFF",
    shadowColor: "#0368FE",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 10,
  },
  fabLabel: {
    marginTop: 2,
    fontSize: 11.5,
    fontWeight: "700",
    color: "#0368FE",
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  sheetCard: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E5E1DC",
    alignSelf: "center",
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1C1B1B",
    marginBottom: 12,
  },
  sheetRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 12,
  },
  sheetIconChip: {
    width: 44,
    height: 44,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetRowLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1C1B1B",
  },
  sheetRowDesc: {
    fontSize: 12.5,
    color: "#7A756F",
    marginTop: 1,
  },
});
