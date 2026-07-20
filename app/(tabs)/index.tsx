import React, { useState, useEffect, useCallback } from "react";
import { View, ScrollView, Pressable, ActivityIndicator, RefreshControl, Text, useWindowDimensions } from "react-native";
import { Card, Chip, useTheme, Avatar, Button } from "react-native-paper";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAuth } from "../../src/lib/auth-context";
import { useModuleVisibility } from "../../src/lib/useModuleVisibility";
import { api } from "../../src/lib/api";
import { useTopInset } from "../../src/lib/useTopInset";

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner", manager: "Store Manager", staff: "Cashier", warehouse_manager: "Warehouse Manager", field_agent: "Field Agent",
};

function timeAgo(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function DashboardScreen() {
  const { user, userRole, activeCompany } = useAuth();
  const { getVisibleCategories } = useModuleVisibility(userRole);
  const router = useRouter();
  const theme = useTheme();
  const topInset = useTopInset();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  const [stats, setStats] = useState({ salesToday: 0, invoicesToday: 0 });
  const [recentBills, setRecentBills] = useState<any[]>([]);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [pendingTransferCount, setPendingTransferCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [greeting] = useState(() => {
    const h = new Date().getHours();
    return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  });

  const roleLabel = ROLE_LABELS[userRole || ""] || "User";
  const isStaff = userRole === "staff";
  const isWarehouse = userRole === "warehouse_manager";
  const outletName = user?.outlet?.name || activeCompany?.name || "";
  const initials = [user?.firstName, user?.lastName].filter(Boolean).map((s: string) => s[0]).join("").toUpperCase() || "U";

  const fetchData = useCallback(async () => {
    try {
      const [dashRes, recentRes] = await Promise.all([
        api.get<any>("/dashboard").catch(() => ({ data: {} })),
        api.get<any>("/invoices", { params: { limit: 5 } }).catch(() => ({ data: [] })),
      ]);
      setStats({
        salesToday: parseFloat(dashRes.data?.salesToday ?? 0),
        invoicesToday: parseInt(dashRes.data?.invoicesToday ?? 0),
      });
      setRecentBills(Array.isArray(recentRes.data) ? recentRes.data.slice(0, 5) : []);
      if (isWarehouse) {
        const stockRes = await api.get<any>("/products/low-stock").catch(() => ({ data: [] }));
        setLowStockCount(Array.isArray(stockRes.data) ? stockRes.data.length : 0);
        const transferRes = await api.get<any>("/stock-transfer-requests?status=pending").catch(() => ({ data: [] }));
        setPendingTransferCount(Array.isArray(transferRes.data) ? transferRes.data.length : 0);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); setRefreshing(false); }
  }, [isWarehouse]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const visibleCategories = getVisibleCategories();

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerStyle={{ paddingTop: topInset + 16, paddingBottom: 32 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} />}
    >
      {/* Greeting */}
      <View className="flex-row items-center justify-between px-4 mb-4">
        <View>
          <Text className="text-2xl font-bold text-on-surface mb-1">
            {greeting}, {user?.firstName || "User"} 👋
          </Text>
          <View className="flex-row items-center" style={{ gap: 6 }}>
            {outletName ? (
              <>
                <MaterialCommunityIcons name="store" size={14} color="#6B7280" />
                <Text className="text-xs text-on-surface-variant">{outletName}</Text>
                <Text className="text-xs text-on-surface-variant">·</Text>
              </>
            ) : null}
            <Chip mode="flat" style={{ backgroundColor: `${theme.colors.primary}15` }} textStyle={{ fontSize: 11, color: theme.colors.primary }}>
              {roleLabel}
            </Chip>
          </View>
        </View>
        <Avatar.Text size={44} label={initials} color="#FFFFFF" style={{ backgroundColor: theme.colors.primary }} />
      </View>

      {/* KPI Cards */}
      <View className="flex-row px-4 mb-4" style={{ gap: 8 }}>
        <Card mode="elevated" className="flex-1">
          <Card.Content className="items-center py-2">
            <Text className="text-3xl font-black" style={{ color: theme.colors.primary }}>
              ₹{stats.salesToday.toLocaleString("en-IN")}
            </Text>
            <Text className="text-xs text-on-surface-variant mt-1">Today's Sales</Text>
          </Card.Content>
        </Card>
        <Card mode="elevated" className="flex-1">
          <Card.Content className="items-center py-2">
            <Text className="text-3xl font-black" style={{ color: theme.colors.secondary }}>
              {stats.invoicesToday}
            </Text>
            <Text className="text-xs text-on-surface-variant mt-1">Bills Today</Text>
          </Card.Content>
        </Card>
        {isWarehouse && (
          <>
            <Card mode="elevated" className="flex-1">
              <Card.Content className="items-center py-2">
                <Text className="text-3xl font-black text-error">{lowStockCount}</Text>
                <Text className="text-xs text-on-surface-variant mt-1">Low Stock</Text>
              </Card.Content>
            </Card>
            <Card mode="elevated" className="flex-1">
              <Card.Content className="items-center py-2">
                <Text className="text-3xl font-black" style={{ color: "#835400" }}>{pendingTransferCount}</Text>
                <Text className="text-xs text-on-surface-variant mt-1">Transfers</Text>
              </Card.Content>
            </Card>
          </>
        )}
      </View>

      {/* Quick Actions — Staff/Biller */}
      {isStaff && (
        <View className="px-4 mb-4">
          <Text className="text-base font-bold text-on-surface mb-3">Quick Actions</Text>
          <View className="flex-row flex-wrap" style={{ gap: 10 }}>
            {[
              { key: "new-sale", label: "New Sale", icon: "point-of-sale", color: theme.colors.primary, route: "/(tabs)/pos" },
              { key: "recent", label: "Recent Bills", icon: "history", color: theme.colors.secondary, route: "/invoice-history" },
              { key: "held", label: "Held Bills", icon: "content-save", color: "#873D34", route: "/held-bills" },
              { key: "returns", label: "Returns", icon: "backup-restore", color: "#2E9E5B", route: "/invoice-history" },
              { key: "reprint", label: "Reprint", icon: "printer", color: theme.colors.primary, route: "/invoice-history" },
              { key: "customers", label: "Customers", icon: "account-group", color: "#835400", route: "/ledger" },
            ].map((action) => (
              <Pressable
                key={action.key}
                onPress={() => router.push(action.route as any)}
                className="items-center justify-center rounded-2xl"
                style={{ width: isTablet ? 80 : 70, height: isTablet ? 80 : 70, backgroundColor: `${action.color}12` }}
              >
                <MaterialCommunityIcons name={action.icon as any} size={26} color={action.color} />
                <Text className="text-[10px] font-semibold mt-1 text-center" style={{ color: action.color }}>{action.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {/* Category Grid — Owner/Manager */}
      {!isStaff && !isWarehouse && visibleCategories.map((cat) => (
        <View key={cat.id} className="px-4 mb-4">
          <View className="flex-row items-center mb-3" style={{ gap: 8 }}>
            <MaterialCommunityIcons name={cat.icon as any} size={20} color={theme.colors.primary} />
            <Text className="text-base font-bold text-on-surface">{cat.label}</Text>
          </View>
          <View className="flex-row flex-wrap" style={{ gap: 10 }}>
            {cat.children.map((child) => (
              <Pressable
                key={child.key}
                onPress={() => router.push(child.route as any)}
                className="items-center justify-center rounded-2xl bg-surface-container-lowest"
                style={{
                  width: isTablet ? 80 : 72,
                  height: isTablet ? 90 : 82,
                  borderWidth: 1,
                  borderColor: theme.colors.outlineVariant,
                }}
              >
                <MaterialCommunityIcons name={child.icon as any} size={26} color={theme.colors.primary} />
                <Text className="text-[10px] font-semibold mt-1 text-center px-1" numberOfLines={2}>{child.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ))}

      {/* Warehouse Quick View */}
      {isWarehouse && (
        <View className="px-4 mb-4">
          <Text className="text-base font-bold text-on-surface mb-3">Warehouse Operations</Text>
          <View className="flex-row flex-wrap" style={{ gap: 10 }}>
            {[
              { key: "stock", label: "Stock", icon: "package-variant-closed", route: "/(tabs)/inventory" },
              { key: "transfers", label: "Transfers", icon: "transfer", route: "/stock-transfer-requests" },
              { key: "purchases", label: "Purchases", icon: "truck", route: "/purchase-entry" },
              { key: "challans", label: "Challans", icon: "clipboard-list", route: "/challans" },
            ].map((action) => (
              <Pressable
                key={action.key}
                onPress={() => router.push(action.route as any)}
                className="items-center justify-center rounded-2xl"
                style={{ width: 72, height: 82, backgroundColor: `${theme.colors.primary}12`, borderWidth: 1, borderColor: theme.colors.outlineVariant }}
              >
                <MaterialCommunityIcons name={action.icon as any} size={26} color={theme.colors.primary} />
                <Text className="text-[10px] font-semibold mt-1 text-center">{action.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {/* Recent Bills */}
      {recentBills.length > 0 && (
        <View className="px-4">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-base font-bold text-on-surface">Recent Bills</Text>
            <Button mode="text" compact onPress={() => router.push("/invoice-history" as any)}>View All</Button>
          </View>
          {recentBills.map((bill: any) => (
            <Card key={bill.id} mode="elevated" className="mb-2" onPress={() => router.push(`/invoice-history?openInvoiceId=${bill.id}` as any)}>
              <Card.Content className="flex-row items-center justify-between">
                <View>
                  <Text className="text-sm font-bold text-on-surface">
                    {bill.invoice_number || "INV-" + bill.id.slice(0, 6)}
                  </Text>
                  <Text className="text-xs text-on-surface-variant mt-0.5">
                    ₹{parseFloat(bill.grand_total || bill.total || 0).toLocaleString("en-IN")}
                    {" · "}{bill.payment_mode || "N/A"}
                  </Text>
                </View>
                <View className="items-end">
                  <Text className="text-xs text-on-surface-variant">{timeAgo(bill.created_at || bill.createdAt)}</Text>
                  <MaterialCommunityIcons name="chevron-right" size={18} color="#9E9E9E" />
                </View>
              </Card.Content>
            </Card>
          ))}
        </View>
      )}
    </ScrollView>
  );
}
