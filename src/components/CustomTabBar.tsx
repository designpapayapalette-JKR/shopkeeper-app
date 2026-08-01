import React, { useState } from "react";
import { View, Pressable, Text, StyleSheet, Modal } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import type { BottomTabBarProps } from "expo-router/build/react-navigation/bottom-tabs";
import type { UserRole } from "../lib/moduleCategories";

const ICONS: Record<string, string> = {
  index: "view-dashboard-outline",
  sales: "chart-bar",
  pos: "receipt",
  inventory: "package-variant-closed",
  agents: "map-marker-radius-outline",
};

const TAB_ORDER = ["index", "sales", "inventory", "agents"];

function TabButton({
  routeName,
  focused,
  onPress,
}: {
  routeName: string;
  focused: boolean;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const color = focused ? "#0368FE" : "#9A9591";

  const getLabel = (name: string) => {
    switch (name) {
      case "index":
        return t("nav.home", "Home");
      case "sales":
        return t("nav.sales", "Sales");
      case "pos":
        return t("nav.pos", "POS");
      case "inventory":
        return t("nav.inventory", "Stock");
      case "agents":
        return t("nav.agents", "Field");
      default:
        return name;
    }
  };

  return (
    <Pressable onPress={onPress} style={styles.tabButton} hitSlop={6}>
      <MaterialCommunityIcons name={(ICONS[routeName] ?? ICONS.index) as any} size={22} color={color} />
      <Text style={[styles.tabLabel, { color, fontWeight: focused ? "700" : "500" }]} numberOfLines={1}>
        {getLabel(routeName)}
      </Text>
    </Pressable>
  );
}

function ExecutiveQuickActionsSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const executiveActions = [
    {
      key: "notifications",
      label: t("notifications.title", "Notification Center"),
      desc: t("notifications.subtitle", "System alerts, payment notices & warnings"),
      icon: "bell-outline",
      route: "/notifications",
    },
    {
      key: "financials",
      label: t("financialsMonitor.title", "Financials & Cashflow"),
      desc: t("financialsMonitor.subtitle", "Receivables, payables & collection log"),
      icon: "credit-card-outline",
      route: "/payment-history",
    },
    {
      key: "reports",
      label: t("reportsHub.title", "Reports Hub"),
      desc: t("reportsHub.subtitle", "Executive summaries & GST returns"),
      icon: "chart-bar",
      route: "/more",
    },
    {
      key: "insights",
      label: t("dashboard.insightsTitle", "Business Insights"),
      desc: t("dashboard.insightsDesc", "Credit risk & inventory analysis"),
      icon: "creation",
      route: "/insights",
    },
    {
      key: "approvals",
      label: t("dashboard.businessAlerts", "Approvals & Alerts"),
      desc: t("dashboard.pendingApprovals", "Pending reviews & tasks"),
      icon: "clipboard-check-outline",
      route: "/approval-queue",
    },
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose}>
        <Pressable style={styles.sheetCard} onPress={() => {}}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>{t("dashboard.title", "Executive Shortcuts")}</Text>
          <View style={styles.sheetGrid}>
            {executiveActions.map((action) => (
              <Pressable
                key={action.key}
                style={styles.sheetCell}
                onPress={() => {
                  onClose();
                  router.push(action.route as any);
                }}
              >
                <LinearGradient
                  colors={["#0368FE", "#000D3A"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.sheetIconChip}
                >
                  <MaterialCommunityIcons name={action.icon as any} size={24} color="#FFFFFF" />
                </LinearGradient>
                <Text style={styles.sheetCellLabel} numberOfLines={1}>
                  {action.label}
                </Text>
                <Text style={styles.sheetCellDesc} numberOfLines={2}>
                  {action.desc}
                </Text>
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
}: BottomTabBarProps & { userRole?: UserRole | null }) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [sheetOpen, setSheetOpen] = useState(false);

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
            colors={["#0368FE", "#000D3A"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.fab}
          >
            <MaterialCommunityIcons name="chart-box-outline" size={28} color="#FFFFFF" />
          </LinearGradient>
        </View>
        <Text style={styles.fabLabel}>{t("nav.shortcuts", "Shortcuts")}</Text>
      </Pressable>
      <ExecutiveQuickActionsSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} />
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
    fontSize: 14,
    fontWeight: "700",
    color: "#1C1B1B",
  },
  sheetCellDesc: {
    fontSize: 11,
    color: "#7A756F",
    marginTop: 2,
  },
});
