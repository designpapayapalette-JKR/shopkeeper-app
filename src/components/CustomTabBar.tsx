import React, { useState, useEffect, useRef } from "react";
import { View, Pressable, Text, StyleSheet, Modal, Animated } from "react-native";
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

  // Animations
  const anims = useRef([...Array(5)].map(() => new Animated.Value(0))).current;

  useEffect(() => {
    if (visible) {
      anims.forEach(v => v.setValue(0));
      Animated.stagger(
        60,
        anims.map(v =>
          Animated.spring(v, {
            toValue: 1,
            friction: 7,
            tension: 50,
            useNativeDriver: true,
          })
        )
      ).start();
    }
  }, [visible]);

  const executiveActions = [
    {
      key: "notifications",
      label: t("notifications.title", "Notification Center"),
      desc: t("notifications.subtitle", "System alerts & notices"),
      icon: "bell-outline",
      route: "/notifications",
      color: "#0368FE",
      bg: "rgba(3,104,254,0.1)",
    },
    {
      key: "financials",
      label: t("financialsMonitor.title", "Financials"),
      desc: t("financialsMonitor.subtitle", "Cashflow & receivables"),
      icon: "credit-card-outline",
      route: "/payment-history",
      color: "#10B981",
      bg: "rgba(16,185,129,0.1)",
    },
    {
      key: "reports",
      label: t("reportsHub.title", "Reports Hub"),
      desc: t("reportsHub.subtitle", "Executive summaries"),
      icon: "chart-bar",
      route: "/more",
      color: "#F59E0B",
      bg: "rgba(245,158,11,0.1)",
    },
    {
      key: "insights",
      label: t("dashboard.insightsTitle", "Insights"),
      desc: t("dashboard.insightsDesc", "Credit & inventory AI"),
      icon: "creation",
      route: "/insights",
      color: "#8B5CF6",
      bg: "rgba(139,92,246,0.1)",
    },
    {
      key: "approvals",
      label: t("dashboard.businessAlerts", "Approvals & Tasks"),
      desc: t("dashboard.pendingApprovals", "Pending reviews"),
      icon: "clipboard-check-outline",
      route: "/approval-queue",
      color: "#EC4899",
      bg: "rgba(236,72,153,0.1)",
    },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose}>
        <Pressable style={styles.sheetCardLight} onPress={() => {}}>
          <View style={styles.sheetHandleLight} />
          
          <View style={styles.sheetHeaderLight}>
            <View style={styles.sheetTitleIconBgLight}>
              <MaterialCommunityIcons name="briefcase-outline" size={24} color="#0368FE" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sheetTitleLight}>{t("dashboard.title", "Business Control Center")}</Text>
              <Text style={styles.sheetSubLight}>Select a module to manage</Text>
            </View>
          </View>

          <View style={styles.sheetGridLight}>
            {executiveActions.map((action, index) => {
              const isLastOdd = executiveActions.length % 2 !== 0 && index === executiveActions.length - 1;
              return (
                <Animated.View
                  key={action.key}
                  style={[
                    styles.sheetCellLight,
                    isLastOdd && { width: '100%' },
                    {
                      opacity: anims[index],
                      transform: [
                        { scale: anims[index].interpolate({ inputRange: [0, 1], outputRange: [0.95, 1] }) },
                        { translateY: anims[index].interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) },
                      ]
                    }
                  ]}
                >
                  <Pressable
                    style={{ flex: 1, alignItems: 'flex-start', padding: 18 }}
                    onPress={() => {
                      onClose();
                      router.push(action.route as any);
                    }}
                  >
                    <View style={styles.sheetTopRow}>
                      <View style={[styles.sheetIconChipLight, { backgroundColor: action.bg }]}>
                        <MaterialCommunityIcons name={action.icon as any} size={28} color={action.color} />
                      </View>
                      <View style={styles.arrowContainer}>
                        <MaterialCommunityIcons name="arrow-top-right" size={18} color="#94A3B8" />
                      </View>
                    </View>
                    <View style={{ marginTop: 'auto', paddingTop: 16 }}>
                      <Text style={styles.sheetCellLabelLight} numberOfLines={1}>{action.label}</Text>
                      <Text style={styles.sheetCellDescLight} numberOfLines={2}>{action.desc}</Text>
                    </View>
                  </Pressable>
                </Animated.View>
              );
            })}
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
    backgroundColor: "rgba(15, 23, 42, 0.4)",
    justifyContent: "flex-end",
  },
  sheetCardLight: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 20,
  },
  sheetHandleLight: {
    width: 48,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#E2E8F0",
    alignSelf: "center",
    marginBottom: 24,
  },
  sheetHeaderLight: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    gap: 14,
  },
  sheetTitleIconBgLight: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  sheetTitleLight: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0F172A",
  },
  sheetSubLight: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 2,
    fontWeight: "500",
  },
  sheetGridLight: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  sheetCellLight: {
    width: "48%",
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 3,
  },
  sheetTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    alignItems: 'flex-start',
  },
  arrowContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetIconChipLight: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetCellLabelLight: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 4,
  },
  sheetCellDescLight: {
    fontSize: 12,
    color: "#64748B",
    lineHeight: 16,
    fontWeight: "500",
  },
});
