import React, { useState, useEffect, useCallback } from "react";
import { View, ScrollView, Pressable, ActivityIndicator, RefreshControl, Text, Linking } from "react-native";
import { useTheme } from "react-native-paper";
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
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

const STAFF_QUICK_ACTIONS = [
  { key: "new-sale", label: "New Sale", icon: "point-of-sale", route: "/(tabs)/pos" },
  { key: "recent", label: "Recent Bills", icon: "history", route: "/invoice-history" },
  { key: "held", label: "Held Bills", icon: "content-save", route: "/invoice-history" },
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

  const [stats, setStats] = useState({ salesToday: 0, invoicesToday: 0, cashTotal: 0, upiTotal: 0 });
  const [recentBills, setRecentBills] = useState<any[]>([]);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [pendingTransferCount, setPendingTransferCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [outletBreakdown, setOutletBreakdown] = useState<any[]>([]);

  const roleColorValue = roleColor(userRole);
  const isOwner = userRole === "owner";
  const isStaff = userRole === "staff";
  const isWarehouse = userRole === "warehouse_manager";
  const isManager = userRole === "manager";
  const outletName = user?.outlet?.name || activeCompany?.name || "";
  const initials = [user?.firstName, user?.lastName].filter(Boolean).join("").toUpperCase() || "U";

  const fetchOwnerData = useCallback(async () => {
    try {
      const [dashRes, activityRes, approvalRes] = await Promise.all([
        api.get<any>("/dashboard/owner").catch(() => ({ data: {} })),
        api.get<any>("/activity-log", { params: { limit: 10 } }).catch(() => ({ data: [] })),
        api.get<any>("/approval-queue/pending").catch(() => ({ data: [] })),
      ]);
      setStats({
        salesToday: parseFloat(dashRes.data?.salesToday ?? 0),
        invoicesToday: parseInt(dashRes.data?.invoicesToday ?? 0),
        cashTotal: parseFloat(dashRes.data?.cashTotal ?? 0),
        upiTotal: parseFloat(dashRes.data?.upiTotal ?? 0),
      });
      setOutletBreakdown(Array.isArray(dashRes.data?.outlets) ? dashRes.data.outlets : []);
      setRecentActivity(Array.isArray(activityRes.data) ? activityRes.data.slice(0, 10) : []);
      setPendingApprovals(Array.isArray(approvalRes.data) ? approvalRes.data.length : 0);
    } catch {}
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const [dashRes, recentRes] = await Promise.all([
        api.get<any>("/dashboard").catch(() => ({ data: {} })),
        api.get<any>("/invoices", { params: { limit: 5 } }).catch(() => ({ data: [] })),
      ]);
      setStats({
        salesToday: parseFloat(dashRes.data?.salesToday ?? 0),
        invoicesToday: parseInt(dashRes.data?.invoicesToday ?? 0),
        cashTotal: parseFloat(dashRes.data?.cashTotal ?? 0),
        upiTotal: parseFloat(dashRes.data?.upiTotal ?? 0),
      });
      setRecentBills(Array.isArray(recentRes.data) ? recentRes.data.slice(0, 5) : []);
      if (isWarehouse) {
        const stockRes = await api.get<any>("/products/low-stock").catch(() => ({ data: [] }));
        setLowStockCount(Array.isArray(stockRes.data) ? stockRes.data.length : 0);
        const transferRes = await api.get<any>("/stock-transfer-requests", { params: { status: "pending" } }).catch(() => ({ data: [] }));
        setPendingTransferCount(Array.isArray(transferRes.data) ? transferRes.data.length : 0);
      }
      if (isManager) {
        const approvalRes = await api.get<any>("/approval-queue/pending").catch(() => ({ data: [] }));
        setPendingApprovals(Array.isArray(approvalRes.data) ? approvalRes.data.length : 0);
      }
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, [isWarehouse, isManager]);

  useEffect(() => {
    if (isOwner) {
      fetchOwnerData().then(() => { setLoading(false); setRefreshing(false); });
    } else {
      fetchData();
    }
  }, [fetchData, fetchOwnerData, isOwner]);

  const visibleCategories = getVisibleCategories();

  if (loading) {
    return <View className="flex-1 items-center justify-center bg-background"><ActivityIndicator size="large" color={theme.colors.primary} /></View>;
  }

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerStyle={{ paddingTop: topInset + 16, paddingBottom: 32 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); isOwner ? fetchOwnerData() : fetchData(); }} />}
    >
      {/* Greeting header */}
      <View className="flex-row items-center justify-between px-5 mb-4">
        <View className="flex-1 pr-3">
          <Text className="text-on-surface" style={{ fontSize: 22, fontWeight: "700" }}>Namaste, {user?.firstName || "User"}</Text>
          <View className="flex-row items-center flex-wrap mt-1" style={{ gap: 6 }}>
            {outletName ? (
              <View className="flex-row items-center" style={{ gap: 4 }}>
                <MaterialCommunityIcons name="store" size={13} color="#9CA3AF" />
                <Text className="text-xs text-on-surface-variant">{outletName}</Text>
              </View>
            ) : null}
            <RoleBadge role={userRole} size="sm" />
          </View>
        </View>
        <View className="w-[44px] h-[44px] rounded-full items-center justify-center" style={{ backgroundColor: roleColorValue }}>
          <Text className="text-white font-bold" style={{ fontSize: 17 }}>{initials}</Text>
        </View>
      </View>

      {/* Shift chip — Cashier */}
      {isStaff && (
        <View className="mx-5 mb-3">
          <Pressable onPress={() => router.push("/shift-reconciliation" as any)}
            className="flex-row items-center justify-between bg-teal-50 rounded-2xl px-4 py-3" style={{ borderLeftWidth: 3, borderLeftColor: "#1E8E85" }}>
            <View className="flex-row items-center" style={{ gap: 8 }}>
              <MaterialCommunityIcons name="clock-outline" size={18} color="#1E8E85" />
              <Text className="text-sm text-on-surface" style={{ fontWeight: "600" }}>Shift running</Text>
            </View>
            <View className="flex-row items-center" style={{ gap: 4 }}>
              <Text className="text-xs font-bold" style={{ color: "#1E8E85" }}>Close</Text>
              <MaterialCommunityIcons name="chevron-right" size={16} color="#1E8E85" />
            </View>
          </Pressable>
        </View>
      )}

      {/* Approval alert — Manager & Owner */}
      {(isManager || isOwner) && pendingApprovals > 0 && (
        <Pressable onPress={() => router.push("/approval-queue" as any)}
          className="mx-5 mb-3 rounded-2xl overflow-hidden" style={{ backgroundColor: "#E9F7F6", borderLeftWidth: 3, borderLeftColor: "#1E8E85" }}>
          <View className="flex-row items-center justify-between px-4 py-3">
            <View className="flex-row items-center" style={{ gap: 8 }}>
              <MaterialCommunityIcons name="clipboard-check-outline" size={20} color="#1E8E85" />
              <Text className="text-sm text-on-surface" style={{ fontWeight: "600" }}>{pendingApprovals} approval{pendingApprovals > 1 ? "s" : ""} pending</Text>
            </View>
            <Text className="text-xs font-bold" style={{ color: "#1E8E85" }}>Review</Text>
          </View>
        </Pressable>
      )}

      {/* KPI Row */}
      <View className="px-5 mb-4" style={{ gap: 8 }}>
        <View className="flex-row" style={{ gap: 8 }}>
          <KpiTile value={formatRupee(stats.salesToday)} label="Today's Sales" color={roleColorValue} />
          <KpiTile value={String(stats.invoicesToday)} label="Bills" />
          {isStaff ? (
            <>
              <KpiTile value={formatRupee(stats.cashTotal)} label="Cash" color="#2E9E5B" />
              <KpiTile value={formatRupee(stats.upiTotal)} label="UPI" color="#0368FE" />
            </>
          ) : isWarehouse ? (
            <>
              <KpiTile value={String(lowStockCount)} label="Low Stock" color={lowStockCount > 0 ? "#D64545" : "#6B7280"} />
              <KpiTile value={String(pendingTransferCount)} label="Transfers" color="#835400" />
            </>
          ) : (
            <>
              <KpiTile value={formatRupee(stats.cashTotal)} label="Cash" color="#2E9E5B" />
              <KpiTile value={formatRupee(stats.upiTotal)} label="UPI" color="#0368FE" />
            </>
          )}
        </View>
      </View>

      {/* Per-outlet breakdown — Owner */}
      {isOwner && outletBreakdown.length > 0 && (
        <View className="mx-5 mb-4">
          <Text className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">Outlets Today</Text>
          <View className="bg-surface-container-lowest rounded-2xl border border-outline-variant overflow-hidden">
            {outletBreakdown.map((outlet: any, i: number) => (
              <Pressable key={outlet.id}
                onPress={() => router.push(`/invoice-history?outletId=${outlet.id}` as any)}
                className="flex-row items-center justify-between px-4 py-3" style={{ borderBottomWidth: i < outletBreakdown.length - 1 ? 1 : 0, borderColor: "#E5E7EB" }}>
                <View className="flex-row items-center" style={{ gap: 10 }}>
                  <View className="w-8 h-8 rounded-lg bg-primary/10 items-center justify-center">
                    <MaterialCommunityIcons name="store" size={16} color={theme.colors.primary} />
                  </View>
                  <View>
                    <Text className="text-sm text-on-surface" style={{ fontWeight: "600" }}>{outlet.name}</Text>
                    <Text className="text-xs text-on-surface-variant">{outlet.bills} bills</Text>
                  </View>
                </View>
                <Text className="text-sm font-bold text-on-surface">{formatRupee(parseFloat(outlet.sales ?? 0))}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {/* Live Activity — Owner */}
      {isOwner && recentActivity.length > 0 && (
        <View className="mx-5 mb-4">
          <Text className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">Live Activity</Text>
          <View className="bg-surface-container-lowest rounded-2xl border border-outline-variant overflow-hidden">
            {recentActivity.slice(0, 4).map((item: any, idx: number) => (
              <View key={item.id || idx} className="flex-row items-start px-4 py-3" style={{ gap: 10, borderBottomWidth: idx < Math.min(recentActivity.length, 4) - 1 ? 1 : 0, borderColor: "#E5E7EB" }}>
                <View className="w-2 h-2 rounded-full mt-2" style={{ backgroundColor: roleColorValue }} />
                <View className="flex-1">
                  <Text className="text-sm text-on-surface">
                    <Text className="font-bold">{item.user_name || "Someone"}</Text>
                    {" "}{item.action || "did something"}
                  </Text>
                  <Text className="text-xs text-on-surface-variant mt-0.5">{timeAgo(item.created_at || item.createdAt)}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Quick Actions — Staff */}
      {isStaff && (
        <View className="mx-5 mb-4">
          <Text className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">Quick Actions</Text>
          <View className="bg-surface-container-lowest rounded-2xl border border-outline-variant p-4">
            <View className="flex-row flex-wrap" style={{ gap: 12, rowGap: 14 }}>
              {STAFF_QUICK_ACTIONS.map((action) => (
                <IconGridItem key={action.key} label={action.label} icon={action.icon} onPress={() => router.push(action.route as any)} />
              ))}
            </View>
          </View>
        </View>
      )}

      {/* Warehouse Quick Actions */}
      {isWarehouse && (
        <View className="mx-5 mb-4">
          <Text className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">Warehouse</Text>
          <View className="bg-surface-container-lowest rounded-2xl border border-outline-variant p-4">
            <View className="flex-row flex-wrap" style={{ gap: 12, rowGap: 14 }}>
              {WAREHOUSE_QUICK_ACTIONS.map((action) => (
                <IconGridItem key={action.key} label={action.label} icon={action.icon} onPress={() => router.push(action.route as any)} />
              ))}
            </View>
          </View>
        </View>
      )}

      {/* Manager category grid */}
      {isManager && visibleCategories.map((cat) => (
        <ModuleGridSection key={cat.id} id={cat.id} label={cat.label} icon={cat.icon} items={cat.children} />
      ))}

      {/* Recent Bills */}
      {!isOwner && !isWarehouse && recentBills.length > 0 && (
        <View className="px-5 mt-1 mb-4">
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Recent Bills</Text>
            <Pressable onPress={() => router.push("/invoice-history" as any)}>
              <Text className="text-xs font-bold text-primary">View All</Text>
            </Pressable>
          </View>
          <View className="bg-surface-container-lowest rounded-2xl border border-outline-variant overflow-hidden">
            {recentBills.slice(0, 4).map((bill: any, i: number) => (
              <Pressable key={bill.id}
                onPress={() => router.push(`/invoice-history?openInvoiceId=${bill.id}` as any)}
                className="flex-row items-center px-4 py-3" style={{ borderBottomWidth: i < Math.min(recentBills.length, 4) - 1 ? 1 : 0, borderColor: "#E5E7EB" }}>
                <View className="w-1 h-8 rounded-full mr-3" style={{ backgroundColor: "#2E9E5B" }} />
                <View className="flex-1">
                  <Text className="text-sm text-on-surface" style={{ fontWeight: "600" }}>{bill.invoice_number || "INV-" + bill.id.slice(0, 6)}</Text>
                  <Text className="text-xs text-on-surface-variant mt-0.5">{formatRupee(parseFloat(bill.grand_total || bill.total || 0))} · {bill.payment_mode || "N/A"}</Text>
                </View>
                <Text className="text-xs text-on-surface-variant">{timeAgo(bill.created_at || bill.createdAt)}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {/* Owner Executive Quick Action Stacks */}
      {isOwner && (
        <View className="mx-5 mb-4" style={{ gap: 16 }}>
          {/* Executive Reports Hub */}
          <View>
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Executive Reports</Text>
              <Pressable onPress={() => router.push("/analytics" as any)}>
                <Text className="text-xs font-bold text-primary">All Reports</Text>
              </Pressable>
            </View>
            <View className="bg-surface-container-lowest rounded-2xl border border-outline-variant p-4">
              <View className="flex-row flex-wrap" style={{ gap: 12, rowGap: 14 }}>
                <IconGridItem label="P&L Statement" icon="chart-line" onPress={() => router.push("/pnl-report" as any)} />
                <IconGridItem label="Balance Sheet" icon="scale-balance" onPress={() => router.push("/balance-sheet" as any)} />
                <IconGridItem label="GST Returns" icon="file-document-outline" onPress={() => router.push("/gst-reports" as any)} />
                <IconGridItem label="Daybook" icon="book-open-outline" onPress={() => router.push("/daybook" as any)} />
                <IconGridItem label="Aging Report" icon="clock-alert-outline" onPress={() => router.push("/aging-report" as any)} />
                <IconGridItem label="Analytics" icon="chart-bar" onPress={() => router.push("/analytics" as any)} />
              </View>
            </View>
          </View>

          {/* Operations & Approvals */}
          <View>
            <Text className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">Operations & Approvals</Text>
            <View className="bg-surface-container-lowest rounded-2xl border border-outline-variant p-4">
              <View className="flex-row flex-wrap" style={{ gap: 12, rowGap: 14 }}>
                <IconGridItem label="Approvals" icon="clipboard-check-outline" onPress={() => router.push("/approval-queue" as any)} />
                <IconGridItem label="Outlets" icon="storefront-outline" onPress={() => router.push("/outlets" as any)} />
                <IconGridItem label="Counters" icon="cash-register" onPress={() => router.push("/counters" as any)} />
                <IconGridItem label="Staff Roster" icon="account-group-outline" onPress={() => router.push("/staff" as any)} />
                <IconGridItem label="Field Tracking" icon="map-marker-path" onPress={() => router.push("/(tabs)/agents" as any)} />
                <IconGridItem label="Audit Log" icon="history" onPress={() => router.push("/activity-log" as any)} />
              </View>
            </View>
          </View>
        </View>
      )}

      {/* Owner — web admin card */}
      {isOwner && (
        <View className="mx-5">
          <Pressable onPress={() => Linking.openURL("https://manage.mycounter.com")}
            className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-4 flex-row items-center" style={{ gap: 12 }}>
            <View className="w-10 h-10 rounded-xl bg-primary/10 items-center justify-center">
              <MaterialCommunityIcons name="open-in-new" size={20} color={theme.colors.primary} />
            </View>
            <View className="flex-1">
              <Text className="text-sm text-on-surface" style={{ fontWeight: "600" }}>Full Admin Web Portal</Text>
              <Text className="text-xs text-on-surface-variant mt-0.5">Manage subscription, advanced settings & exports</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={18} color="#9CA3AF" />
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

