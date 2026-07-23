import React, { useState, useEffect, useCallback } from "react";
import { View, ScrollView, Pressable, ActivityIndicator, RefreshControl, Text, Linking } from "react-native";
import { useTheme } from "react-native-paper";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAuth } from "../../src/lib/auth-context";
import { useModuleVisibility } from "../../src/lib/useModuleVisibility";
import { api } from "../../src/lib/api";
import { useTopInset } from "../../src/lib/useTopInset";
import { roleColor, roleLabel } from "../../src/lib/roles";
import KpiCarousel from "../../src/components/KpiCarousel";
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
  { key: "new-sale", label: "New Sale", icon: "point-of-sale", route: "/pos" },
  { key: "recent", label: "Recent Bills", icon: "history", route: "/invoice-history" },
  { key: "held", label: "Held Bills", icon: "content-save", route: "/invoice-history" },
  { key: "returns", label: "Returns", icon: "backup-restore", route: "/invoice-history" },
  { key: "reprint", label: "Reprint", icon: "printer", route: "/invoice-history" },
  { key: "customers", label: "Customers", icon: "account-group", route: "/ledger" },
  // Was only reachable via Profile > My Attendance before — promoted to a
  // one-tap home tile since check-in/out is a daily action. See docs/
  // web-vs-mobile-role-access-gap-analysis.md R5.
  { key: "attendance", label: "Attendance", icon: "calendar-check", route: "/attendance" },
];

const WAREHOUSE_QUICK_ACTIONS = [
  { key: "stock", label: "Stock", icon: "package-variant-closed", route: "/inventory" },
  { key: "transfers", label: "Transfers", icon: "transfer", route: "/stock-transfer-requests" },
  { key: "purchases", label: "Purchases", icon: "truck", route: "/purchase-entry" },
  { key: "challans", label: "Challans", icon: "clipboard-list", route: "/challans" },
  // Web gives warehouse managers Attendance and Scanned Docs; mobile had
  // neither. See docs/web-vs-mobile-role-access-gap-analysis.md R4.
  { key: "attendance", label: "Attendance", icon: "calendar-check", route: "/attendance" },
  { key: "scanned-docs", label: "Scanned Docs", icon: "file-image", route: "/scanned-documents" },
];

export default function DashboardScreen() {
  const { user, userRole, activeCompany } = useAuth();
  const { getVisibleCategories } = useModuleVisibility(userRole);
  const router = useRouter();
  const theme = useTheme();
  const topInset = useTopInset();

  const [stats, setStats] = useState({ salesToday: 0, invoicesToday: 0, cashTotal: 0, upiTotal: 0 });
  const [recentBills, setRecentBills] = useState<any[]>([]);
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
      // Live Activity intentionally not fetched/shown here — that feed
      // stays web-only per product decision; mobile just shows the Owner's
      // own KPIs/outlets/approvals.
      const [dashRes, approvalRes] = await Promise.all([
        api.get<any>("/dashboard/owner").catch(() => ({ data: {} })),
        api.get<any>("/approval-queue/pending").catch(() => ({ data: [] })),
      ]);
      setStats({
        salesToday: parseFloat(dashRes.data?.salesToday ?? 0),
        invoicesToday: parseInt(dashRes.data?.invoicesToday ?? 0),
        cashTotal: parseFloat(dashRes.data?.cashTotal ?? 0),
        upiTotal: parseFloat(dashRes.data?.upiTotal ?? 0),
      });
      setOutletBreakdown(Array.isArray(dashRes.data?.outlets) ? dashRes.data.outlets : []);
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
      contentContainerStyle={{ paddingBottom: 32 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); isOwner ? fetchOwnerData() : fetchData(); }} />}
    >
      {/* Gradient hero — matches the login screen's visual language
          (feedback_ui_visual_quality.md): dark gradient band, decorative
          depth circles, bold white type, instead of a flat white header. */}
      <LinearGradient
        colors={["#0368FE", "#000D3A"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          paddingTop: topInset + 16,
          paddingBottom: 36,
          paddingHorizontal: 20,
          borderBottomLeftRadius: 28,
          borderBottomRightRadius: 28,
          overflow: "hidden",
        }}
      >
        <View style={{ position: "absolute", top: -50, right: -30, width: 130, height: 130, borderRadius: 65, backgroundColor: "rgba(255,255,255,0.08)" }} />
        <View style={{ position: "absolute", bottom: -40, left: -20, width: 100, height: 100, borderRadius: 50, backgroundColor: "rgba(3,168,254,0.16)" }} />

        <View className="flex-row items-center justify-between">
          <View className="flex-1 pr-3">
            <Text style={{ color: "#FFFFFF", fontSize: 22, fontWeight: "800" }}>Namaste, {user?.firstName || "User"}</Text>
            <View className="flex-row items-center flex-wrap mt-1.5" style={{ gap: 6 }}>
              {outletName ? (
                <View className="flex-row items-center" style={{ gap: 4 }}>
                  <MaterialCommunityIcons name="store" size={12} color="rgba(255,255,255,0.65)" />
                  <Text style={{ color: "rgba(255,255,255,0.75)", fontSize: 12 }}>{outletName}</Text>
                </View>
              ) : null}
              <View style={{ backgroundColor: "rgba(255,255,255,0.18)", paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999 }}>
                <Text style={{ color: "#FFFFFF", fontSize: 11, fontWeight: "700" }}>{roleLabel(userRole)}</Text>
              </View>
            </View>
          </View>
          <Pressable
            onPress={() => router.push("/profile")}
            className="w-[44px] h-[44px] rounded-full items-center justify-center"
            style={{ backgroundColor: "rgba(255,255,255,0.16)", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.35)" }}
          >
            <Text className="text-white font-bold" style={{ fontSize: 17 }}>{initials}</Text>
          </Pressable>
        </View>
      </LinearGradient>

      {/* KPI Carousel — full-width swipeable stat cards + dot pagination,
          floating up over the header's gradient bottom edge (same
          "anchored card" language as Login/Profile) rather than sitting in
          a dead gap below it. Replaces the earlier 4-cards-in-a-row layout
          that wrapped labels awkwardly and left no room for large rupee
          amounts to grow (feedback_ui_visual_quality.md). Pattern from the
          PNB reference (data/Mobile App Ref/PNB.jpg). Placed directly under
          the header (before the shift/approval chips) so its negative
          top-margin overlaps the gradient, not unrelated content below it. */}
      <KpiCarousel
        items={[
          { value: formatRupee(stats.salesToday), label: "Today's Sales", color: roleColorValue, icon: "cash" },
          { value: String(stats.invoicesToday), label: "Bills", color: "#375DFB", icon: "receipt" },
          ...(isStaff || isManager || isOwner
            ? [
                { value: formatRupee(stats.cashTotal), label: "Cash", color: "#2E9E5B", icon: "cash-multiple" },
                { value: formatRupee(stats.upiTotal), label: "UPI", color: "#0368FE", icon: "qrcode" },
              ]
            : []),
          ...(isWarehouse
            ? [
                { value: String(lowStockCount), label: "Low Stock", color: lowStockCount > 0 ? "#D64545" : "#6B7280", icon: "package-variant-closed" },
                { value: String(pendingTransferCount), label: "Transfers", color: "#835400", icon: "transfer" },
              ]
            : []),
        ]}
      />

      <View style={{ marginTop: 16 }}>

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

      {/* Manager / Owner category grid — Owner's full MODULE_CATEGORIES set
          (Billing, Inventory, Purchases, Accounting, Staff, Approvals & Ops,
          Financial Reports, Back Office, Business Settings) replaces the
          old hardcoded 12-item "Owner Snapshot" stacks below with the same
          dynamic, data-driven grid Manager already uses — 100% web parity
          per docs/Deep-Review-and-Dual-Mobile-Apps-Architectural-Plan.md §4. */}
      {/* Business Settings, Back Office, and the standalone Printer entry
          live under the profile avatar now (matches shopkeeper-web's
          top-right account menu — General Settings, Back Office, etc. all
          moved out of the sidebar into one place), not in this grid. */}
      {(isManager || isOwner) && visibleCategories
        .filter((cat) => !["settings-hub", "back-office", "settings"].includes(cat.id))
        .map((cat) => (
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
      </View>
    </ScrollView>
  );
}

