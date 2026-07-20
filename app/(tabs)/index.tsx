import React, { useState, useEffect, useCallback } from "react";
import { View, ScrollView, Pressable, ActivityIndicator, RefreshControl, Text } from "react-native";
import { useTheme, Avatar, Button } from "react-native-paper";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAuth } from "../../src/lib/auth-context";
import { useModuleVisibility } from "../../src/lib/useModuleVisibility";
import { api } from "../../src/lib/api";
import { useTopInset } from "../../src/lib/useTopInset";
import { roleColor } from "../../src/lib/roles";
import RoleBadge from "../../src/components/RoleBadge";
import KpiTile from "../../src/components/KpiTile";
import IconGridItem from "../../src/components/IconGridItem";
import ModuleGridSection from "../../src/components/ModuleGridSection";

function timeAgo(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function formatRupee(n: number): string {
  // Indian lakh/crore grouping, not Western thousands grouping — a
  // shopkeeper reads "₹1,20,000" fluently and "₹120,000" as foreign.
  // shopkeeper-mobile-design-system.md §3.1.
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

// Staff/Cashier quick actions — a flat grid, not grouped sections, because
// a biller's whole job is these 6 actions (design system §5.2).
const STAFF_QUICK_ACTIONS = [
  { key: "new-sale", label: "New Sale", icon: "point-of-sale", route: "/(tabs)/pos" },
  { key: "recent", label: "Recent Bills", icon: "history", route: "/invoice-history" },
  { key: "held", label: "Held Bills", icon: "content-save", route: "/held-bills" },
  { key: "returns", label: "Returns", icon: "backup-restore", route: "/invoice-history" },
  { key: "reprint", label: "Reprint", icon: "printer", route: "/invoice-history" },
  { key: "customers", label: "Customers", icon: "account-group", route: "/(tabs)/ledger" },
];

const WAREHOUSE_QUICK_ACTIONS = [
  { key: "stock", label: "Stock", icon: "package-variant-closed", route: "/(tabs)/inventory" },
  { key: "transfers", label: "Transfers", icon: "transfer", route: "/stock-transfer-requests" },
  { key: "purchases", label: "Purchases", icon: "truck", route: "/purchase-entry" },
  { key: "challans", label: "Challans", icon: "clipboard-list", route: "/challans" },
];

export default function DashboardScreen() {
  const { user, userRole, activeCompany } = useAuth();
  const { getVisibleCategories } = useModuleVisibility(userRole);
  const router = useRouter();
  const theme = useTheme();
  const topInset = useTopInset();

  const [stats, setStats] = useState({ salesToday: 0, invoicesToday: 0 });
  const [recentBills, setRecentBills] = useState<any[]>([]);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [pendingTransferCount, setPendingTransferCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const roleColorValue = roleColor(userRole);
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
      {/* Greeting — a plain name greeting, not a time-of-day one: "Good
          morning/evening" is a translation and timezone headache across 8
          languages for no real benefit (design system §5.2). */}
      <View className="flex-row items-center justify-between px-4 mb-4">
        <View className="flex-1 pr-3">
          <Text className="font-headline-md text-on-surface" style={{ fontSize: 22, fontWeight: "700" }}>
            Namaste, {user?.firstName || "User"}
          </Text>
          <View className="flex-row items-center flex-wrap mt-1.5" style={{ gap: 6 }}>
            {outletName ? (
              <>
                <MaterialCommunityIcons name="store" size={14} color={theme.colors.onSurfaceVariant} />
                <Text className="text-sm text-on-surface-variant">{outletName}</Text>
              </>
            ) : null}
            <RoleBadge role={userRole} size="sm" />
          </View>
        </View>
        <Avatar.Text size={48} label={initials} color="#FFFFFF" style={{ backgroundColor: roleColorValue }} />
      </View>

      {/* Today's Summary — the biggest numbers on the screen (Principle #3) */}
      <View className="px-4 mb-4">
        <Text className="font-headline-sm text-on-surface mb-2" style={{ fontSize: 15, fontWeight: "700" }}>
          Aaj Ka Hisaab (Today&apos;s Summary)
        </Text>
        <View className="flex-row" style={{ gap: 8 }}>
          <KpiTile value={formatRupee(stats.salesToday)} label="Sales" color={theme.colors.primary} />
          <KpiTile value={String(stats.invoicesToday)} label="Bills" />
          {isWarehouse && (
            <>
              <KpiTile value={String(lowStockCount)} label="Low Stock" color={lowStockCount > 0 ? "#D64545" : undefined} />
              <KpiTile value={String(pendingTransferCount)} label="Transfers" color="#835400" />
            </>
          )}
        </View>
      </View>

      {/* Staff/Cashier — flat Quick Actions grid, no grouped sections */}
      {isStaff && (
        <View className="mx-4 mb-3 rounded-xl bg-surface-container" style={{ padding: 14 }}>
          <Text className="font-headline-sm text-on-surface mb-3" style={{ fontSize: 15, fontWeight: "700" }}>
            Quick Actions
          </Text>
          <View className="flex-row flex-wrap" style={{ gap: 12, rowGap: 14 }}>
            {STAFF_QUICK_ACTIONS.map((action) => (
              <IconGridItem
                key={action.key}
                label={action.label}
                icon={action.icon}
                onPress={() => router.push(action.route as any)}
              />
            ))}
          </View>
        </View>
      )}

      {/* Godown Manager — flat Warehouse Operations grid */}
      {isWarehouse && (
        <View className="mx-4 mb-3 rounded-xl bg-surface-container" style={{ padding: 14 }}>
          <Text className="font-headline-sm text-on-surface mb-3" style={{ fontSize: 15, fontWeight: "700" }}>
            Warehouse Operations
          </Text>
          <View className="flex-row flex-wrap" style={{ gap: 12, rowGap: 14 }}>
            {WAREHOUSE_QUICK_ACTIONS.map((action) => (
              <IconGridItem
                key={action.key}
                label={action.label}
                icon={action.icon}
                onPress={() => router.push(action.route as any)}
              />
            ))}
          </View>
        </View>
      )}

      {/* Owner/Manager — grouped "banking app" category grid, one card per section */}
      {!isStaff && !isWarehouse &&
        visibleCategories.map((cat) => (
          <ModuleGridSection key={cat.id} id={cat.id} label={cat.label} icon={cat.icon} items={cat.children} />
        ))}

      {/* Recent Bills */}
      {recentBills.length > 0 && (
        <View className="px-4 mt-1">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="font-headline-sm text-on-surface" style={{ fontSize: 15, fontWeight: "700" }}>Recent Bills</Text>
            <Button mode="text" compact onPress={() => router.push("/invoice-history" as any)}>View All</Button>
          </View>
          {recentBills.map((bill: any) => (
            <Pressable
              key={bill.id}
              onPress={() => router.push(`/invoice-history?openInvoiceId=${bill.id}` as any)}
              className="flex-row items-center justify-between bg-surface-container-lowest rounded-xl mb-2 active:opacity-80"
              style={{ minHeight: 64, paddingHorizontal: 14, paddingVertical: 10 }}
            >
              <View className="flex-1 pr-2">
                <Text className="font-body-lg text-on-surface" style={{ fontSize: 16, fontWeight: "700" }}>
                  {bill.invoice_number || "INV-" + bill.id.slice(0, 6)}
                </Text>
                <Text className="text-sm text-on-surface-variant mt-0.5">
                  {formatRupee(parseFloat(bill.grand_total || bill.total || 0))}
                  {" · "}{bill.payment_mode || "N/A"}
                </Text>
              </View>
              <View className="items-end flex-row" style={{ gap: 4 }}>
                <Text className="text-xs text-on-surface-variant">{timeAgo(bill.created_at || bill.createdAt)}</Text>
                <MaterialCommunityIcons name="chevron-right" size={20} color={theme.colors.onSurfaceVariant} />
              </View>
            </Pressable>
          ))}
        </View>
      )}
    </ScrollView>
  );
}
