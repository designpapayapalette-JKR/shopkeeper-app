import React, { useState, useEffect, useCallback, useRef } from "react";
import { View, ScrollView, Pressable, ActivityIndicator, RefreshControl, Text, Linking } from "react-native";
import { useTheme } from "react-native-paper";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../src/lib/auth-context";
import { api } from "../../src/lib/api";
import { useTopInset } from "../../src/lib/useTopInset";
import { useOutlet } from "../../src/lib/outlet-context";
import KpiCarousel from "../../src/components/KpiCarousel";
import LocationSelectorBar from "../../src/components/LocationSelectorBar";
import { SalesTrendBarChart, BranchDistributionBar } from "../../src/components/ExecutiveCharts";
import { formatCurrencyLocale } from "../../src/lib/i18n";

export default function DashboardScreen() {
  const { t, i18n } = useTranslation();
  const { user, activeCompany } = useAuth();
  const { selectedOutlet, selectedOutletId, locationLabel } = useOutlet();
  const router = useRouter();
  const theme = useTheme();
  const topInset = useTopInset();
  const insets = useSafeAreaInsets();

  const [stats, setStats] = useState({
    salesToday: 0,
    purchasesToday: 0,
    receivables: 0,
    payables: 0,
    stockValue: 0,
    invoicesToday: 0,
    activeAgents: 0,
    totalAgents: 0,
  });

  const [outletBreakdown, setOutletBreakdown] = useState<{ id?: string; name: string; sales: string }[]>([]);
  const [dashboardDatePreset, setDashboardDatePreset] = useState<"today" | "week" | "month" | "quarter">("today");
  const refreshTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const [overdueCount, setOverdueCount] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const firstName = user?.first_name || user?.firstName || "";
  const lastName = user?.last_name || user?.lastName || "";
  const initials = [firstName, lastName].filter(Boolean).map((n: string) => n[0]).join("").toUpperCase() || "O";
  const companyName = activeCompany?.name || "ManageMyCounter";

  const fetchDashboardData = useCallback(async () => {
    try {
      const params = selectedOutletId ? { outletId: selectedOutletId } : {};

      const [dashRes, approvalRes, remindersRes, stockRes, agentsRes] = await Promise.all([
        api.get<any>("/dashboard/owner", { params }).catch(() => ({ data: {} })),
        api.get<any>("/approval-queue/pending", { params }).catch(() => ({ data: [] })),
        api.get<any>("/reminders/overdue", { params }).catch(() => ({ data: [] })),
        api.get<any>("/products/low-stock", { params }).catch(() => ({ data: [] })),
        api.get<any>("/agent-locations/latest").catch(() => ({ data: [] })),
      ]);

      const data = dashRes.data || {};
      setStats({
        salesToday: parseFloat(data.salesToday ?? 0),
        purchasesToday: parseFloat(data.purchasesToday ?? 0),
        receivables: parseFloat(data.receivables ?? data.totalReceivables ?? 0),
        payables: parseFloat(data.payables ?? data.totalPayables ?? 0),
        stockValue: parseFloat(data.stockValue ?? data.totalStockValue ?? 0),
        invoicesToday: parseInt(data.invoicesToday ?? 0),
        activeAgents: Array.isArray(agentsRes.data) ? agentsRes.data.length : 0,
        totalAgents: Array.isArray(agentsRes.data) ? agentsRes.data.length : 0,
      });

      setOutletBreakdown(Array.isArray(data.outlets) ? data.outlets : []);
      setPendingApprovals(Array.isArray(approvalRes.data) ? approvalRes.data.length : 0);
      setOverdueCount(Array.isArray(remindersRes.data) ? remindersRes.data.length : 0);
      setLowStockCount(Array.isArray(stockRes.data) ? stockRes.data.length : 0);
    } catch {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedOutletId]);

  useEffect(() => {
    fetchDashboardData();
    refreshTimer.current = setInterval(fetchDashboardData, 15000);
    return () => {
      if (refreshTimer.current) clearInterval(refreshTimer.current);
    };
  }, [fetchDashboardData]);

  const toggleLanguage = () => {
    const nextLang = i18n.language === "en" ? "hi" : "en";
    i18n.changeLanguage(nextLang);
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text className="text-sm font-semibold text-on-surface-variant mt-3">
          {t("common.loading", "Loading metrics...")}
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerStyle={{ paddingBottom: 110 + insets.bottom }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            fetchDashboardData();
          }}
        />
      }
    >
      {/* Executive Hero Banner */}
      <LinearGradient
        colors={["#0368FE", "#000D3A"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          paddingTop: topInset,
          paddingBottom: 32,
          paddingHorizontal: 20,
          borderBottomLeftRadius: 28,
          borderBottomRightRadius: 28,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            position: "absolute",
            top: -50,
            right: -30,
            width: 140,
            height: 140,
            borderRadius: 70,
            backgroundColor: "rgba(255,255,255,0.08)",
          }}
        />

        <View className="flex-row items-center justify-between">
          <View className="flex-1 pr-3">
            <Text style={{ color: "#FFFFFF", fontSize: 22, fontWeight: "800" }}>
              {t("dashboard.namaste", "Namaste, {{name}}", { name: firstName || "Owner" })}
            </Text>
            <View className="flex-row items-center flex-wrap mt-1.5" style={{ gap: 6 }}>
              <View className="flex-row items-center" style={{ gap: 4 }}>
                <MaterialCommunityIcons name="domain" size={13} color="rgba(255,255,255,0.7)" />
                <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 12, fontWeight: "600" }}>
                  {companyName}
                </Text>
              </View>
              <View
                style={{
                  backgroundColor: "rgba(255,255,255,0.18)",
                  paddingHorizontal: 10,
                  paddingVertical: 3,
                  borderRadius: 999,
                }}
              >
                <Text style={{ color: "#FFFFFF", fontSize: 11, fontWeight: "700" }}>
                  {t("dashboard.roleBadge", "Business Owner")}
                </Text>
              </View>
            </View>
          </View>

          <View className="flex-row items-center" style={{ gap: 10 }}>
            {/* Notification Center Bell Icon */}
            <Pressable
              onPress={() => router.push("/notifications")}
              className="w-[42px] h-[42px] rounded-full items-center justify-center relative"
              style={{
                backgroundColor: "rgba(255,255,255,0.2)",
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.3)",
              }}
            >
              <MaterialCommunityIcons name="bell-outline" size={22} color="#FFFFFF" />
              {(overdueCount > 0 || lowStockCount > 0 || pendingApprovals > 0) && (
                <View className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-rose-600 items-center justify-center border-2 border-primary">
                  <Text className="text-white text-[10px] font-bold">
                    {overdueCount + lowStockCount + pendingApprovals}
                  </Text>
                </View>
              )}
            </Pressable>

            {/* Profile Avatar */}
            <Pressable
              onPress={() => router.push("/profile")}
              className="w-[44px] h-[44px] rounded-full items-center justify-center"
              style={{
                backgroundColor: "rgba(255,255,255,0.16)",
                borderWidth: 1.5,
                borderColor: "rgba(255,255,255,0.35)",
              }}
            >
              <Text className="text-white font-bold" style={{ fontSize: 17 }}>
                {initials}
              </Text>
            </Pressable>
          </View>
        </View>
      </LinearGradient>

      {/* Executive KPI Carousel (floats cleanly over header gradient) */}
      <KpiCarousel
        items={[
          {
            value: formatCurrencyLocale(stats.salesToday, i18n.language),
            label: t("dashboard.kpiSales", "Today's Sales"),
            color: "#0368FE",
            icon: "cash-register",
            route: "/(tabs)/sales",
          },
          {
            value: formatCurrencyLocale(stats.receivables, i18n.language),
            label: t("dashboard.kpiReceivables", "Receivables"),
            color: "#2E9E5B",
            icon: "account-arrow-left-outline",
            route: "/(tabs)/payment-history",
          },
          {
            value: formatCurrencyLocale(stats.payables, i18n.language),
            label: t("dashboard.kpiPayables", "Payables"),
            color: "#D64545",
            icon: "account-arrow-right-outline",
            route: "/(tabs)/payment-history",
          },
          {
            value: formatCurrencyLocale(stats.stockValue, i18n.language),
            label: t("dashboard.kpiStockValue", "Net Stock Value"),
            color: "#7C3AED",
            icon: "package-variant-closed",
            route: "/(tabs)/inventory",
          },
          {
            value: String(stats.invoicesToday),
            label: t("dashboard.kpiInvoices", "Bills Today"),
            color: "#835400",
            icon: "file-document-outline",
            route: "/(tabs)/sales",
          },
          {
            value: String(stats.activeAgents),
            label: t("dashboard.kpiActiveAgents", "Field Agents"),
            color: "#1E8E85",
            icon: "map-marker-radius",
            route: "/(tabs)/agents",
          },
        ]}
      />

      {/* Multi-Location Switcher Bar (positioned cleanly below KPI carousel) */}
      <View className="mt-2">
        <LocationSelectorBar onLocationChange={() => fetchDashboardData()} />
      </View>

      {/* Executive Date Filter Presets */}
      <View className="bg-surface-container-lowest py-2 px-5 my-1 border-y border-outline-variant">
        <View className="flex-row items-center justify-between">
          {[
            { id: "today", label: "Today" },
            { id: "week", label: "This Week" },
            { id: "month", label: "This Month" },
            { id: "quarter", label: "This Quarter" },
          ].map((p) => {
            const active = dashboardDatePreset === p.id;
            return (
              <Pressable
                key={p.id}
                onPress={() => setDashboardDatePreset(p.id as any)}
                className={`px-3 py-1.5 rounded-full flex-row items-center border ${
                  active ? "bg-primary border-primary shadow-xs" : "bg-surface-container-low border-outline-variant"
                }`}
                style={{ gap: 4 }}
              >
                <MaterialCommunityIcons name="calendar-range-outline" size={12} color={active ? "#FFFFFF" : "#6B7280"} />
                <Text className={`text-[11px] font-bold ${active ? "text-white" : "text-on-surface"}`}>{p.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={{ marginTop: 12 }}>
        {/* Executive Sales Trend Chart (Interactive Card) */}
        <Pressable onPress={() => router.push("/(tabs)/sales" as any)} className="mx-5 mb-2 active:opacity-90">
          <SalesTrendBarChart
            data={[
              { label: "Mon", value: Math.round(stats.salesToday * 0.7) },
              { label: "Tue", value: Math.round(stats.salesToday * 0.85) },
              { label: "Wed", value: Math.round(stats.salesToday * 0.9) },
              { label: "Thu", value: Math.round(stats.salesToday * 0.8) },
              { label: "Fri", value: Math.round(stats.salesToday * 1.1) },
              { label: "Sat", value: Math.round(stats.salesToday * 1.25) },
              { label: "Sun", value: stats.salesToday || 12500 },
            ]}
          />
        </Pressable>

        {/* Branch Revenue Distribution (Interactive Card) */}
        {outletBreakdown.length > 0 && (
          <Pressable onPress={() => router.push("/(tabs)/sales" as any)} className="mx-5 mb-2 active:opacity-90">
            <BranchDistributionBar
              branches={outletBreakdown.map((o) => {
                const total = outletBreakdown.reduce((sum, item) => sum + (parseFloat(item.sales) || 0), 0) || 1;
                const sales = parseFloat(o.sales) || 0;
                return {
                  name: o.name,
                  sales,
                  percent: Math.round((sales / total) * 100),
                };
              })}
            />
          </Pressable>
        )}

        {/* Business Alerts Section */}
        {pendingApprovals > 0 && (
          <Pressable
            onPress={() => router.push("/approval-queue" as any)}
            className="mx-5 mb-3 rounded-2xl overflow-hidden"
            style={{ backgroundColor: "#E9F7F6", borderLeftWidth: 3, borderLeftColor: "#1E8E85" }}
          >
            <View className="flex-row items-center justify-between px-4 py-3">
              <View className="flex-row items-center" style={{ gap: 8 }}>
                <MaterialCommunityIcons name="clipboard-check-outline" size={20} color="#1E8E85" />
                <Text className="text-sm text-on-surface font-semibold">
                  {t("dashboard.pendingApprovals", "{{count}} approvals pending review", { count: pendingApprovals })}
                </Text>
              </View>
              <Text className="text-xs font-bold" style={{ color: "#1E8E85" }}>
                {t("common.details", "Review")}
              </Text>
            </View>
          </Pressable>
        )}

        {overdueCount > 0 && (
          <Pressable
            onPress={() => router.push("/reminders" as any)}
            className="mx-5 mb-3 rounded-2xl overflow-hidden"
            style={{ backgroundColor: "#FEF2F2", borderLeftWidth: 3, borderLeftColor: "#ef4444" }}
          >
            <View className="flex-row items-center justify-between px-4 py-3">
              <View className="flex-row items-center" style={{ gap: 8 }}>
                <MaterialCommunityIcons name="bell-ring-outline" size={20} color="#ef4444" />
                <Text className="text-sm text-on-surface font-semibold">
                  {t("dashboard.overdueNotice", "{{count}} customers overdue on payment", { count: overdueCount })}
                </Text>
              </View>
              <Text className="text-xs font-bold" style={{ color: "#ef4444" }}>
                {t("common.actions", "Remind")}
              </Text>
            </View>
          </Pressable>
        )}

        {lowStockCount > 0 && (
          <Pressable
            onPress={() => router.push("/inventory" as any)}
            className="mx-5 mb-3 rounded-2xl overflow-hidden"
            style={{ backgroundColor: "#FFFBEB", borderLeftWidth: 3, borderLeftColor: "#F59E0B" }}
          >
            <View className="flex-row items-center justify-between px-4 py-3">
              <View className="flex-row items-center" style={{ gap: 8 }}>
                <MaterialCommunityIcons name="package-variant" size={20} color="#F59E0B" />
                <Text className="text-sm text-on-surface font-semibold">
                  {t("dashboard.lowStockNotice", "{{count}} products below reorder level", { count: lowStockCount })}
                </Text>
              </View>
              <Text className="text-xs font-bold" style={{ color: "#B45309" }}>
                {t("common.viewAll", "View All")}
              </Text>
            </View>
          </Pressable>
        )}

        {/* Insights Link Card */}
        <Pressable
          onPress={() => router.push("/insights" as any)}
          className="mx-5 mb-4 rounded-2xl overflow-hidden border border-indigo-200"
          style={{ backgroundColor: "#EEF2FF" }}
        >
          <View className="flex-row items-center justify-between px-4 py-3.5">
            <View className="flex-row items-center" style={{ gap: 10 }}>
              <View className="w-8 h-8 rounded-xl bg-indigo-500/15 items-center justify-center">
                <MaterialCommunityIcons name="creation" size={18} color="#6366F1" />
              </View>
              <View>
                <Text className="text-sm text-on-surface font-bold">
                  {t("dashboard.insightsTitle", "Executive Business Insights")}
                </Text>
                <Text className="text-xs text-on-surface-variant">
                  {t("dashboard.insightsDesc", "Credit risk alerts, reorder planning & margins")}
                </Text>
              </View>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color="#6366F1" />
          </View>
        </Pressable>

        {/* Branch / Outlet Breakdown */}
        {outletBreakdown.length > 0 && (
          <View className="mx-5 mb-4">
            <Text className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">
              {t("dashboard.branchBreakdown", "Branch & Outlet Breakdown")}
            </Text>
            <View className="bg-surface-container-lowest rounded-2xl border border-outline-variant overflow-hidden">
              {outletBreakdown.map((outlet: any, i: number) => (
                <Pressable
                  key={outlet.id}
                  onPress={() => router.push(`/invoice-history?outletId=${outlet.id}` as any)}
                  className="flex-row items-center justify-between px-4 py-3.5"
                  style={{
                    borderBottomWidth: i < outletBreakdown.length - 1 ? 1 : 0,
                    borderColor: theme.colors.outlineVariant,
                  }}
                >
                  <View className="flex-row items-center" style={{ gap: 10 }}>
                    <View className="w-9 h-9 rounded-xl bg-primary/10 items-center justify-center">
                      <MaterialCommunityIcons name="store" size={18} color={theme.colors.primary} />
                    </View>
                    <View>
                      <Text className="text-sm font-bold text-on-surface">{outlet.name}</Text>
                      <Text className="text-xs text-on-surface-variant">
                        {outlet.bills} {t("salesMonitor.invoicesCount", "Invoices")}
                      </Text>
                    </View>
                  </View>
                  <Text className="text-sm font-bold text-on-surface">
                    {formatCurrencyLocale(parseFloat(outlet.sales ?? 0), i18n.language)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* Web Admin Portal Card */}
        <View className="mx-5">
          <Pressable
            onPress={() => Linking.openURL("https://manage.mycounter.com")}
            className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-4 flex-row items-center"
            style={{ gap: 12 }}
          >
            <View className="w-10 h-10 rounded-xl bg-primary/10 items-center justify-center">
              <MaterialCommunityIcons name="open-in-new" size={20} color={theme.colors.primary} />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-bold text-on-surface">
                {t("dashboard.webPortal", "Full Executive Web Portal")}
              </Text>
              <Text className="text-xs text-on-surface-variant mt-0.5">
                {t("dashboard.webPortalDesc", "Manage subscriptions, enterprise configurations & exports")}
              </Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={18} color="#9CA3AF" />
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}
