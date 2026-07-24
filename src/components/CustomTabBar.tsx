import React, { useState } from "react";
import { View, Pressable, Text, StyleSheet, Modal } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BottomTabBarProps } from "expo-router/build/react-navigation/bottom-tabs";
import type { UserRole } from "../lib/moduleCategories";

const ICONS: Record<string, string> = {
  index: "view-dashboard-outline",
  inventory: "package-variant-closed",
  agents: "map-marker-radius-outline",
  "payment-history": "credit-card-outline",
};

const LABELS: Record<string, string> = {
  index: "Home",
  inventory: "Inventory",
  agents: "Tracking",
  "payment-history": "Payments",
};

const ROLE_FAB_ACTIONS: Record<string, { key: string; label: string; desc: string; icon: string; route: string }[]> = {
  owner: [
    { key: "new-sale", label: "New Sale", desc: "Start a POS bill", icon: "point-of-sale", route: "/pos" },
    { key: "new-invoice", label: "New Invoice", desc: "Create an order or quote", icon: "file-document-outline", route: "/estimates" },
    { key: "new-expense", label: "New Expense", desc: "Log a business expense", icon: "wallet-outline", route: "/expenses" },
    { key: "new-payment", label: "New Payment", desc: "Record money in or out", icon: "credit-card-outline", route: "/payment-history" },
  ],
  manager: [
    { key: "new-sale", label: "New Sale", desc: "Start a POS bill", icon: "point-of-sale", route: "/pos" },
    { key: "new-invoice", label: "New Invoice", desc: "Create an order or quote", icon: "file-document-outline", route: "/estimates" },
    { key: "new-expense", label: "New Expense", desc: "Log a business expense", icon: "wallet-outline", route: "/expenses" },
    { key: "new-payment", label: "New Payment", desc: "Record money in or out", icon: "credit-card-outline", route: "/payment-history" },
  ],
  staff: [
    { key: "new-sale", label: "New Sale", desc: "Start a POS bill", icon: "point-of-sale", route: "/pos" },
    { key: "new-payment", label: "New Payment", desc: "Record money in or out", icon: "credit-card-outline", route: "/payment-history" },
  ],
  warehouse_manager: [
    { key: "record-purchase", label: "Record Purchase", desc: "Log stock received", icon: "truck", route: "/purchase-entry" },
    { key: "stock-transfer", label: "Stock Transfer", desc: "Move stock between warehouses", icon: "transfer", route: "/stock-transfer-requests" },
  ],
  field_agent: [
    { key: "mark-attendance", label: "Mark Attendance", desc: "Check in to your shift", icon: "calendar-check", route: "/attendance" },
  ],
};

const TAB_ORDER = ["index", "inventory", "agents", "payment-history"];

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

function QuickActionsSheet({ visible, onClose, userRole }: { visible: boolean; onClose: () => void; userRole: UserRole }) {
  const router = useRouter();
  const actions = ROLE_FAB_ACTIONS[userRole] ?? ROLE_FAB_ACTIONS.owner;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose}>
        <Pressable style={styles.sheetCard} onPress={() => {}}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Quick Actions</Text>
          <View style={styles.sheetGrid}>
            {actions.map((action) => (
              <Pressable
                key={action.key}
                style={styles.sheetCell}
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
                  <MaterialCommunityIcons name={action.icon as any} size={26} color="#FFFFFF" />
                </LinearGradient>
                <Text style={styles.sheetCellLabel}>{action.label}</Text>
                <Text style={styles.sheetCellDesc} numberOfLines={2}>{action.desc}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default function CustomTabBar({
  state,
  navigation,
  userRole,
}: BottomTabBarProps & { userRole?: UserRole | null }) {
  const insets = useSafeAreaInsets();
  const [sheetOpen, setSheetOpen] = useState(false);
  const role = userRole ?? "owner";

  // Always render 4 tabs in a fixed left/right split regardless of role.
  // Role-based access control happens inside each screen, not by hiding tabs.
  const leftRoutes = TAB_ORDER.slice(0, 2);
  const rightRoutes = TAB_ORDER.slice(2);

  const renderTab = (routeName: string) => {
    const route = state.routes.find((r) => r.name === routeName);
    if (!route) return null;
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
        onPress={() => setSheetOpen(true)}
        hitSlop={8}
      >
        <View style={styles.fabHalo}>
          <LinearGradient
            colors={["#0368FE", "#03A8FE"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.fab}
          >
            <MaterialCommunityIcons name="plus" size={30} color="#FFFFFF" />
          </LinearGradient>
        </View>
        <Text style={styles.fabLabel}>New</Text>
      </Pressable>
      <QuickActionsSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} userRole={role} />
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
    marginBottom: 16,
  },
  sheetGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  sheetCell: {
    width: "47%",
    backgroundColor: "#F7F5F3",
    borderRadius: 20,
    padding: 16,
    alignItems: "flex-start",
  },
  sheetIconChip: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  sheetCellLabel: {
    fontSize: 14.5,
    fontWeight: "700",
    color: "#1C1B1B",
  },
  sheetCellDesc: {
    fontSize: 11.5,
    color: "#7A756F",
    marginTop: 2,
  },
});
