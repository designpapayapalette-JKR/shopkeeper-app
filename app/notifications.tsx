import React, { useCallback, useEffect, useState } from "react";
import { View, Text, FlatList, ActivityIndicator, Pressable, Alert, RefreshControl, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "react-native-paper";
import { api } from "../src/lib/api";
import { useTopInset } from "../src/lib/useTopInset";
import EmptyState from "../src/components/EmptyState";

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  type: string;
  is_read: boolean;
  created_at: string;
  data?: any;
}

const TYPE_CONFIG: Record<
  string,
  { icon: keyof typeof MaterialCommunityIcons.glyphMap; color: string; route: string; category: string }
> = {
  pos_sale: { icon: "cash-register", color: "#0368FE", route: "/(tabs)/pos", category: "sales" },
  b2b_invoice: { icon: "file-document-outline", color: "#7C3AED", route: "/(tabs)/pos", category: "sales" },
  order: { icon: "package-variant-closed", color: "#0368FE", route: "/(tabs)/pos", category: "sales" },
  invoice: { icon: "receipt", color: "#7C3AED", route: "/(tabs)/pos", category: "sales" },
  inventory_alert: { icon: "alert-box-outline", color: "#D64545", route: "/(tabs)/inventory", category: "stock" },
  warning: { icon: "alert-outline", color: "#D64545", route: "/(tabs)/inventory", category: "stock" },
  alert: { icon: "alert-circle-outline", color: "#D64545", route: "/(tabs)/inventory", category: "stock" },
  agent_expense: { icon: "wallet-outline", color: "#1E8E85", route: "/expenses", category: "agent" },
  update: { icon: "update", color: "#1E8E85", route: "/expenses", category: "agent" },
  attendance_alert: { icon: "account-clock-outline", color: "#2E9E5B", route: "/attendance", category: "attendance" },
  udhaar_reminder: { icon: "account-arrow-left-outline", color: "#835400", route: "/aging-report", category: "finance" },
  payment: { icon: "bank-transfer", color: "#835400", route: "/(tabs)/payment-history", category: "finance" },
  reminder: { icon: "bell-ring-outline", color: "#835400", route: "/aging-report", category: "finance" },
  system: { icon: "cog-outline", color: "#0368FE", route: "/notification-settings", category: "system" },
};

const DEFAULT_CONFIG = { icon: "bell-outline" as const, color: "#0368FE", route: "/notifications", category: "all" };

function timeAgo(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export default function NotificationsScreen() {
  const router = useRouter();
  const topInset = useTopInset();
  const insets = useSafeAreaInsets();
  const theme = useTheme();

  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "sales" | "stock" | "agent" | "attendance" | "finance">("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: NotificationItem[] }>("/notifications");
      let remoteItems = res.data ?? [];

      try {
        const SecureStore = require("expo-secure-store");
        const raw = await SecureStore.getItemAsync("mmc_owner_notifications_list_v1");
        if (raw) {
          const localItems: NotificationItem[] = JSON.parse(raw);
          const combined = [...localItems, ...remoteItems];
          const uniqueMap = new Map();
          combined.forEach((n) => uniqueMap.set(n.id, n));
          remoteItems = Array.from(uniqueMap.values());
        }
      } catch {}

      setItems(remoteItems);
    } catch {
      try {
        const SecureStore = require("expo-secure-store");
        const raw = await SecureStore.getItemAsync("mmc_owner_notifications_list_v1");
        if (raw) setItems(JSON.parse(raw));
      } catch {
        setItems([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const getNotificationTargetRoute = (item: NotificationItem): string => {
    if (item.data?.route && typeof item.data.route === "string") return item.data.route;
    if (item.data?.link && typeof item.data.link === "string") return item.data.link;
    if ((item as any).link && typeof (item as any).link === "string") return (item as any).link;

    const cfg = TYPE_CONFIG[item.type];
    if (cfg && cfg.route && cfg.route !== "/notifications") return cfg.route;

    const text = `${item.title || ""} ${item.body || ""}`.toLowerCase();
    if (text.includes("stock") || text.includes("reorder") || text.includes("inventory")) return "/(tabs)/inventory";
    if (text.includes("order") || text.includes("quote")) return "/(tabs)/pos";
    if (text.includes("invoice") || text.includes("sale") || text.includes("bill") || text.includes("challan")) return "/(tabs)/invoice-history";
    if (text.includes("payment") || text.includes("jama") || text.includes("udhar") || text.includes("ledger") || text.includes("credit")) return "/ledger";
    if (text.includes("purchase") || text.includes("supplier") || text.includes("po")) return "/purchase-history";
    if (text.includes("attendance") || text.includes("check-in") || text.includes("leave")) return "/attendance";
    if (text.includes("staff") || text.includes("employee")) return "/staff";
    if (text.includes("expense")) return "/expenses";
    if (text.includes("barcode")) return "/barcode-generator";
    if (text.includes("b2b")) return "/b2b";

    return "/(tabs)";
  };

  const handleNotificationPress = async (item: NotificationItem) => {
    // 1. Mark as read
    if (!item.is_read) {
      setItems((prev) => prev.map((n) => (n.id === item.id ? { ...n, is_read: true } : n)));
      try {
        await api.patch(`/notifications/${item.id}/read`);
      } catch {}
    }

    // 2. Redirect dynamically to target screen
    const targetRoute = getNotificationTargetRoute(item);
    if (targetRoute) {
      router.push(targetRoute as any);
    }
  };

  const handleMarkAllRead = async () => {
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
    try {
      await api.post("/notifications/read-all");
    } catch {}
  };

  const handleDelete = (item: NotificationItem) => {
    Alert.alert("Delete notification?", `"${item.title}" will be removed.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          setItems((prev) => prev.filter((n) => n.id !== item.id));
          try {
            await api.delete(`/notifications/${item.id}`);
          } catch {}
        },
      },
    ]);
  };

  const handleClearAll = () => {
    Alert.alert("Clear all notifications?", "All notifications will be permanently removed.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear All",
        style: "destructive",
        onPress: async () => {
          setItems([]);
          try {
            await api.delete("/notifications/clear-all");
          } catch {}
        },
      },
    ]);
  };

  const filteredItems = items.filter((item) => {
    if (activeTab === "all") return true;
    const cfg = TYPE_CONFIG[item.type] || DEFAULT_CONFIG;
    return cfg.category === activeTab;
  });

  const unreadCount = items.filter((n) => !n.is_read).length;

  const filterTabs: { id: typeof activeTab; label: string; count: number }[] = [
    { id: "all", label: "All", count: items.length },
    {
      id: "sales",
      label: "Sales",
      count: items.filter((i) => (TYPE_CONFIG[i.type] || DEFAULT_CONFIG).category === "sales").length,
    },
    {
      id: "stock",
      label: "Stock Alerts",
      count: items.filter((i) => (TYPE_CONFIG[i.type] || DEFAULT_CONFIG).category === "stock").length,
    },
    {
      id: "agent",
      label: "Field Agents",
      count: items.filter((i) => (TYPE_CONFIG[i.type] || DEFAULT_CONFIG).category === "agent").length,
    },
    {
      id: "attendance",
      label: "Attendance",
      count: items.filter((i) => (TYPE_CONFIG[i.type] || DEFAULT_CONFIG).category === "attendance").length,
    },
    {
      id: "finance",
      label: "Finance",
      count: items.filter((i) => (TYPE_CONFIG[i.type] || DEFAULT_CONFIG).category === "finance").length,
    },
  ];

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: topInset }}>
      {/* Header Bar */}
      <View className="px-5 py-3 border-b border-outline-variant bg-surface-container-lowest flex-row items-center justify-between">
        <View className="flex-row items-center" style={{ gap: 10 }}>
          <Pressable onPress={() => router.back()} className="p-1 -ml-1">
            <MaterialCommunityIcons name="arrow-left" size={24} color="#15171A" />
          </Pressable>
          <View>
            <Text className="text-xl font-extrabold text-on-surface">Notification Center</Text>
            <Text className="text-xs text-on-surface-variant mt-0.5">
              {unreadCount > 0 ? `${unreadCount} unread business alerts` : "All notifications read"}
            </Text>
          </View>
        </View>

        <View className="flex-row items-center" style={{ gap: 8 }}>
          <Pressable
            onPress={() => router.push("/notification-settings" as any)}
            className="w-9 h-9 rounded-full bg-primary/10 items-center justify-center border border-primary/20"
          >
            <MaterialCommunityIcons name="tune-variant" size={18} color="#0368FE" />
          </Pressable>

          {unreadCount > 0 && (
            <Pressable onPress={handleMarkAllRead} className="px-2.5 py-1.5 rounded-lg bg-primary/10 flex-row items-center" style={{ gap: 4 }}>
              <MaterialCommunityIcons name="check-all" size={16} color="#0368FE" />
              <Text className="text-xs font-bold text-primary">Mark Read</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* Category Filter Chips */}
      <View className="bg-surface-container-lowest py-2.5 px-5 border-b border-outline-variant">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row" style={{ gap: 8 }}>
          {filterTabs.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <Pressable
                key={tab.id}
                onPress={() => setActiveTab(tab.id)}
                className={`px-3.5 py-1.5 rounded-full flex-row items-center border ${
                  active ? "bg-primary border-primary" : "bg-surface-container-low border-outline-variant"
                }`}
                style={{ gap: 6 }}
              >
                <Text className={`text-xs font-bold ${active ? "text-white" : "text-on-surface"}`}>
                  {tab.label}
                </Text>
                {tab.count > 0 && (
                  <View className={`px-1.5 py-0.2 rounded-full ${active ? "bg-white/25" : "bg-outline-variant"}`}>
                    <Text className={`text-[10px] font-extrabold ${active ? "text-white" : "text-on-surface-variant"}`}>
                      {tab.count}
                    </Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Notifications List */}
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#0368FE" />
        </View>
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={{ paddingTop: 12, paddingBottom: 110 + insets.bottom }}
          renderItem={({ item }) => {
            const cfg = TYPE_CONFIG[item.type] || DEFAULT_CONFIG;

            return (
              <Pressable
                onPress={() => handleNotificationPress(item)}
                onLongPress={() => handleDelete(item)}
                className="mx-5 mb-3 rounded-2xl bg-surface-container-lowest border border-outline-variant overflow-hidden shadow-sm active:opacity-85"
                style={{
                  borderLeftWidth: item.is_read ? 1 : 4,
                  borderLeftColor: item.is_read ? "#E5E7EB" : cfg.color,
                }}
              >
                <View className="p-4 flex-row items-center justify-between">
                  <View className="flex-row items-start flex-1 mr-2" style={{ gap: 12 }}>
                    <View
                      className="w-10 h-10 rounded-xl items-center justify-center mt-0.5"
                      style={{ backgroundColor: `${cfg.color}15` }}
                    >
                      <MaterialCommunityIcons name={cfg.icon} size={22} color={cfg.color} />
                    </View>

                    <View className="flex-1" style={{ gap: 2 }}>
                      <View className="flex-row items-center justify-between">
                        <Text
                          className={`text-sm flex-1 mr-2 ${item.is_read ? "font-semibold text-on-surface" : "font-extrabold text-on-surface"}`}
                          numberOfLines={1}
                        >
                          {item.title}
                        </Text>
                        <Text className="text-[11px] text-on-surface-variant font-medium">
                          {timeAgo(item.created_at)}
                        </Text>
                      </View>

                      <Text className="text-xs text-on-surface-variant leading-relaxed" numberOfLines={2}>
                        {item.body}
                      </Text>

                      <View className="flex-row items-center mt-1.5" style={{ gap: 6 }}>
                        <View className="flex-row items-center" style={{ gap: 3 }}>
                          <Text className="text-[10px] font-bold text-primary">Tap to view details</Text>
                          <MaterialCommunityIcons name="chevron-right" size={14} color="#0368FE" />
                        </View>
                      </View>
                    </View>
                  </View>

                  <Pressable onPress={() => handleDelete(item)} className="p-1.5 -mr-1">
                    <MaterialCommunityIcons name="close" size={18} color="#9CA3AF" />
                  </Pressable>
                </View>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <View className="mx-5 my-8 bg-surface-container-lowest border border-outline-variant rounded-2xl p-8 items-center">
              <MaterialCommunityIcons name="bell-off-outline" size={42} color="#9CA3AF" />
              <Text className="text-sm font-bold text-on-surface mt-3">No notifications in this channel</Text>
              <Text className="text-xs text-on-surface-variant text-center mt-1">
                Real-time sales, inventory, and field agent updates will appear here automatically.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}
