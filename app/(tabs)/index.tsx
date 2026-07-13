import React, { useState, useEffect, useCallback } from "react";
import {
  Text,
  View,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Modal,
  useWindowDimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAuth } from "../../src/lib/auth-context";
import { api } from "../../src/lib/api";
import { useTopInset } from "../../src/lib/useTopInset";
import { useBottomInset } from "../../src/lib/useBottomInset";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useConfirm } from "../../src/components/ConfirmDialog";
import ToggleSwitch from "../../src/components/ToggleSwitch";
import { shareLedgerReminder } from "../../src/lib/sharer";
import { getQueueCount, syncQueuedSales } from "../../src/lib/offlineQueue";
import { useTerminology } from "../../src/lib/terminology-context";

interface DashboardStats {
  salesToday: number;
  yesterdaySales: number;
  invoicesToday: number;
  pendingReceivables: number;
  cashOut: number;
}

interface LowStockItem {
  id: string;
  name: string;
  stock_quantity: number;
  reorder_level: number;
}

interface ActivityItem {
  id: string;
  kind: "invoice";
  invoice_number: string;
  grand_total: number;
  date_created: string;
}

interface TrendDay {
  date: string;
  total: number;
}

interface TopProduct {
  name: string;
  revenue: number;
  quantity: number;
}

interface OverdueParty {
  id: string;
  name: string;
  phone: string | null;
  current_balance: string;
}

const QUICK_ACTIONS = [
  { id: "pos", label: "New Bill", icon: "receipt", route: "/pos", primary: true },
  { id: "scan", label: "Scan", icon: "qrcode-scan", route: "/inventory?openScanner=1", primary: false },
  { id: "payment", label: "Payment", icon: "cash-multiple", route: "/ledger", primary: false },
  { id: "purchase", label: "Purchase", icon: "cart-check", route: "/more?openPurchase=1", primary: false },
  { id: "expense", label: "Expense", icon: "wallet-outline", route: "/more?openExpense=1", primary: false },
] as const;

function timeAgo(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function DashboardScreen() {
  const { user, activeCompany, activeBrand, availableBrands, setActiveBrand, logout } =
    useAuth();
  const { t, mode, setMode } = useTerminology();
  const router = useRouter();
  const confirm = useConfirm();
  const topInset = useTopInset();
  const bottomInset = useBottomInset();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const isTablet = screenWidth >= 768;
  const [isScanHubOpen, setIsScanHubOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isBrandSwitcherOpen, setIsBrandSwitcherOpen] = useState(false);

  const [stats, setStats] = useState<DashboardStats>({
    salesToday: 0,
    yesterdaySales: 0,
    invoicesToday: 0,
    pendingReceivables: 0,
    cashOut: 0,
  });
  const [lowStockItems, setLowStockItems] = useState<LowStockItem[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [weekTrend, setWeekTrend] = useState<TrendDay[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [overdueParties, setOverdueParties] = useState<OverdueParty[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [syncingNow, setSyncingNow] = useState(false);

  const todayStr = new Date().toISOString().slice(0, 10);
  const yesterdayStr = new Date(Date.now() - 86_400_000)
    .toISOString()
    .slice(0, 10);

  const loadStats = useCallback(async () => {
    if (!user?.company_id) return;
    try {
      // The generic invoice CRUD list doesn't support server-side date
      // filtering, so fetch the recent window (createdAt-desc, capped at
      // 500 by the API) and slice it client-side for today/yesterday.
      let salesToday = 0;
      let invoicesToday = 0;
      let recentInvoices: ActivityItem[] = [];
      let yesterdaySales = 0;
      try {
        const invoicesRes = await api.get<{ data: any[] }>("/invoices", {
          params: { brandId: activeBrand?.id },
        });
        const invoices = invoicesRes.data ?? [];

        const todaysInvoices = invoices.filter((inv) => (inv.created_at ?? "").startsWith(todayStr));
        invoicesToday = todaysInvoices.length;
        salesToday = todaysInvoices.reduce((sum, inv) => sum + parseFloat(inv.grand_total ?? "0"), 0);
        recentInvoices = todaysInvoices.slice(0, 3).map((inv) => ({
          id: inv.id,
          kind: "invoice" as const,
          invoice_number: inv.invoice_number,
          grand_total: parseFloat(inv.grand_total ?? "0"),
          date_created: inv.created_at,
        }));

        yesterdaySales = invoices
          .filter((inv) => (inv.created_at ?? "").startsWith(yesterdayStr))
          .reduce((sum, inv) => sum + parseFloat(inv.grand_total ?? "0"), 0);
      } catch (_) {}

      let pendingReceivables = 0;
      try {
        const partiesRes = await api.get<{ data: any[] }>("/parties", { params: { type: "customer" } });
        pendingReceivables = (partiesRes.data ?? [])
          .filter((p) => parseFloat(p.current_balance ?? "0") > 0)
          .reduce((sum, p) => sum + parseFloat(p.current_balance ?? "0"), 0);
      } catch (_) {}

      let cashOut = 0;
      try {
        const expensesRes = await api.get<{ data: any[] }>("/expenses");
        cashOut = (expensesRes.data ?? [])
          .filter((e) => (e.created_at ?? "").startsWith(todayStr))
          .reduce((sum, e) => sum + parseFloat(e.amount ?? "0"), 0);
      } catch (_) {}

      let lowStock: LowStockItem[] = [];
      try {
        const productsRes = await api.get<{ data: any[] }>("/products", {
          params: { brandId: activeBrand?.id },
        });
        const products = productsRes.data ?? [];
        lowStock = products
          .filter(
            (p) =>
              p.reorder_level !== null &&
              parseFloat(p.stock_quantity ?? "0") <=
                parseFloat(p.reorder_level ?? "0")
          )
          .map((p) => ({
            id: p.id,
            name: p.name,
            stock_quantity: parseFloat(p.stock_quantity ?? "0"),
            reorder_level: parseFloat(p.reorder_level ?? "0"),
          }))
          .sort((a, b) => a.stock_quantity - b.stock_quantity)
          .slice(0, 3);
      } catch (_) {}

      setStats({ salesToday, yesterdaySales, invoicesToday, pendingReceivables, cashOut });
      setLowStockItems(lowStock);
      setActivity(recentInvoices);

      try {
        const insightsRes = await api.get<{ data: { week_trend: TrendDay[]; top_products: TopProduct[] } }>(
          "/invoices/dashboard/insights"
        );
        setWeekTrend(insightsRes.data.week_trend ?? []);
        setTopProducts(insightsRes.data.top_products ?? []);
      } catch (_) {}

      try {
        const overdueRes = await api.get<{ data: OverdueParty[] }>("/reminders/overdue");
        setOverdueParties(overdueRes.data ?? []);
      } catch (_) {}
    } catch (e) {
      console.error("Dashboard stats load failed:", e);
    } finally {
      setStatsLoading(false);
      setRefreshing(false);
    }
  }, [user, activeBrand]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const refreshPendingSyncCount = useCallback(() => {
    getQueueCount()
      .then(setPendingSyncCount)
      .catch(() => {});
  }, []);

  useEffect(() => {
    refreshPendingSyncCount();
    // Sales queued while offline sync automatically on app foreground
    // (see app/_layout.tsx), which can happen while this screen is mounted —
    // re-check periodically so the badge doesn't go stale until the next
    // manual pull-to-refresh.
    const interval = setInterval(refreshPendingSyncCount, 15_000);
    return () => clearInterval(interval);
  }, [refreshPendingSyncCount]);

  const handleSyncNow = async () => {
    if (syncingNow) return;
    setSyncingNow(true);
    try {
      await syncQueuedSales();
    } finally {
      refreshPendingSyncCount();
      setSyncingNow(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    refreshPendingSyncCount();
    loadStats();
  };

  const formatCurrency = (amount: number) => {
    if (amount >= 100_000) return `₹${(amount / 100_000).toFixed(1)}L`;
    if (amount >= 1_000) return `₹${(amount / 1_000).toFixed(1)}k`;
    return `₹${amount.toFixed(0)}`;
  };

  const salesTrendPct =
    stats.yesterdaySales > 0
      ? ((stats.salesToday - stats.yesterdaySales) / stats.yesterdaySales) * 100
      : null;

  const initials = (user?.first_name ?? "S").slice(0, 1).toUpperCase();

  return (
    <View className="flex-1 bg-background dark:bg-bg-dark">
      {/* ── Top App Bar ── */}
      <View
        className="bg-surface-container-highest dark:bg-surface-dark border-b border-outline-variant dark:border-outline flex-row justify-between items-center px-margin-mobile pb-3"
        style={{ paddingTop: topInset }}
      >
        <View className="flex-row items-center gap-sm flex-1">
          <View className="w-10 h-10 rounded-lg items-center justify-center bg-primary dark:bg-primary-dark">
            <Text className="text-on-primary font-headline-sm text-headline-sm">S</Text>
          </View>
          <View className="flex-col flex-1">
            <Text
              className="font-headline-md text-headline-md text-primary dark:text-primary-dark font-bold"
              numberOfLines={1}
            >
              SwiftRetail
            </Text>
            <Pressable
              onPress={() => setIsBrandSwitcherOpen(true)}
              className="flex-row items-center gap-xs"
            >
              <Text
                className="font-label-md text-label-md text-on-surface-variant dark:text-text-secondary-dark"
                numberOfLines={1}
              >
                {activeBrand ? activeBrand.name : activeCompany?.name ?? "Main Branch"}
              </Text>
              <MaterialCommunityIcons
                name="chevron-down"
                size={16}
                color="#6e7a74"
              />
            </Pressable>
          </View>
        </View>
        <View className="flex-row items-center gap-sm">
          <Pressable
            onPress={() => router.push("/pos" as any)}
            className="w-touch-target h-touch-target items-center justify-center rounded-full active:bg-surface-container-low"
          >
            <MaterialCommunityIcons name="barcode-scan" size={22} color="#005f49" />
          </Pressable>
          <Pressable
            onPress={() => setIsProfileMenuOpen(true)}
            className="w-touch-target h-touch-target rounded-full items-center justify-center bg-primary/10 border border-outline-variant active:opacity-70"
          >
            <Text className="text-primary dark:text-primary-dark font-bold">
              {initials}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Terminology Mode — Traditional swaps the dashboard for a big-button,
          quick-actions-only layout for shopkeepers who want the simplest
          possible screen; Modern keeps the full stats dashboard. */}
      <Pressable
        onPress={() => setMode(mode === "traditional" ? "modern" : "traditional")}
        className="bg-surface-container-highest dark:bg-surface-dark border-b border-outline-variant dark:border-outline px-margin-mobile py-2 flex-row items-center justify-between"
      >
        <View className="flex-row items-center flex-1 mr-2" style={{ gap: 8 }}>
          <MaterialCommunityIcons
            name={mode === "traditional" ? "account-voice" : "view-dashboard-outline"}
            size={16}
            color="#0F7A5F"
          />
          <Text className="text-sm font-bold text-on-surface dark:text-text-primary-dark">
            {mode === "traditional" ? "Traditional Mode" : "Modern Mode"}
          </Text>
          <Text className="text-xs text-on-surface-variant dark:text-text-secondary-dark flex-1" numberOfLines={1}>
            {mode === "traditional" ? "Simple screen, big buttons" : "Full dashboard & reports"}
          </Text>
        </View>
        <ToggleSwitch
          value={mode === "traditional"}
          onValueChange={(v) => setMode(v ? "traditional" : "modern")}
        />
      </Pressable>

      {/* Profile menu — the only way to reach Operations/Settings now that
          "More" is no longer a bottom tab, plus Sign Out. */}
      <Modal visible={isProfileMenuOpen} animationType="fade" transparent onRequestClose={() => setIsProfileMenuOpen(false)}>
        <Pressable className="flex-1 bg-black/40 justify-start items-end" onPress={() => setIsProfileMenuOpen(false)} style={{ paddingTop: topInset + 56, paddingRight: 12 }}>
          <View className="bg-surface-container-lowest dark:bg-surface-dark rounded-2xl border border-outline-variant dark:border-outline shadow-lg overflow-hidden" style={{ minWidth: 220 }}>
            <Pressable
              onPress={() => {
                setIsProfileMenuOpen(false);
                router.push("/more" as any);
              }}
              className="flex-row items-center px-4 py-3.5 active:bg-surface-container-low"
              style={{ gap: 10 }}
            >
              <MaterialCommunityIcons name="cog-outline" size={20} color="#6e7a74" />
              <Text className="text-base font-semibold text-on-surface dark:text-text-primary-dark">Operations & Settings</Text>
            </Pressable>
            <View className="h-px bg-outline-variant dark:bg-outline" />
            <Pressable
              onPress={async () => {
                setIsProfileMenuOpen(false);
                const ok = await confirm({
                  title: "Sign out?",
                  message: "You'll need your email and password (or Quick PIN) to sign back in.",
                  confirmLabel: "Sign Out",
                  destructive: true,
                });
                if (ok) logout();
              }}
              className="flex-row items-center px-4 py-3.5 active:bg-surface-container-low"
              style={{ gap: 10 }}
            >
              <MaterialCommunityIcons name="logout" size={20} color="#D64545" />
              <Text className="text-base font-semibold text-error">Sign Out</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* Brand switcher — the header's business-name chevron now actually
          does something instead of being a dead decoration. */}
      <Modal visible={isBrandSwitcherOpen} animationType="slide" transparent onRequestClose={() => setIsBrandSwitcherOpen(false)}>
        <Pressable className="flex-1 bg-black/40 justify-end" onPress={() => setIsBrandSwitcherOpen(false)}>
          <Pressable className="bg-background dark:bg-bg-dark rounded-t-3xl px-6 pt-6" style={{ paddingBottom: bottomInset + 24 }} onPress={() => {}}>
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-xl font-bold text-on-surface dark:text-text-primary-dark">Switch Brand</Text>
              <Pressable onPress={() => setIsBrandSwitcherOpen(false)} className="w-10 h-10 items-center justify-center">
                <MaterialCommunityIcons name="close" size={20} color="#6B7280" />
              </Pressable>
            </View>
            {availableBrands.length === 0 ? (
              <Text className="text-sm text-on-surface-variant dark:text-text-secondary-dark">
                {activeCompany?.name ?? "Main Branch"} — no additional brands set up yet.
              </Text>
            ) : (
              <ScrollView style={{ maxHeight: 320 }}>
                <Pressable
                  onPress={() => { setActiveBrand(null); setIsBrandSwitcherOpen(false); }}
                  className={`flex-row items-center justify-between px-4 py-3.5 rounded-xl mb-2 border ${
                    activeBrand === null ? "bg-primary/10 border-primary" : "border-outline-variant dark:border-outline"
                  }`}
                >
                  <Text className={`text-base font-bold ${activeBrand === null ? "text-primary dark:text-primary-dark" : "text-on-surface dark:text-text-primary-dark"}`}>
                    All Brands
                  </Text>
                  {activeBrand === null && <MaterialCommunityIcons name="check" size={18} color="#0F7A5F" />}
                </Pressable>
                {availableBrands.map((brand) => (
                  <Pressable
                    key={brand.id}
                    onPress={() => { setActiveBrand(brand); setIsBrandSwitcherOpen(false); }}
                    className={`flex-row items-center justify-between px-4 py-3.5 rounded-xl mb-2 border ${
                      activeBrand?.id === brand.id ? "bg-primary/10 border-primary" : "border-outline-variant dark:border-outline"
                    }`}
                  >
                    <Text className={`text-base font-bold ${activeBrand?.id === brand.id ? "text-primary dark:text-primary-dark" : "text-on-surface dark:text-text-primary-dark"}`}>
                      {brand.name}
                    </Text>
                    {activeBrand?.id === brand.id && <MaterialCommunityIcons name="check" size={18} color="#0F7A5F" />}
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Complete Setup nudge — shows until the shop has filled in the basics
          that matter for a real GST invoice (never asked for at signup). */}
      {!activeCompany?.gstin && !activeCompany?.address && (
        <Pressable
          onPress={() => router.push("/onboarding" as any)}
          className="bg-primary/10 dark:bg-primary-dark/10 border-b border-primary/20 px-margin-mobile py-3 flex-row items-center justify-between"
        >
          <View className="flex-row items-center flex-1 mr-3" style={{ gap: 10 }}>
            <MaterialCommunityIcons name="rocket-launch-outline" size={20} color="#0F7A5F" />
            <View className="flex-1">
              <Text className="font-bold text-sm text-primary dark:text-primary-dark">Finish setting up your business</Text>
              <Text className="text-xs text-on-surface-variant dark:text-text-secondary-dark mt-0.5">Add GSTIN, address & your team — 2 minutes</Text>
            </View>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={20} color="#0F7A5F" />
        </Pressable>
      )}

      {/* Pending Sync banner — sales taken while offline sit queued on-device
          until connectivity returns (see src/lib/offlineQueue.ts); surface the
          count so a cashier isn't left wondering where a sale went. */}
      {pendingSyncCount > 0 && (
        <View className="bg-secondary/10 dark:bg-secondary-dark/10 border-b border-secondary/30 px-margin-mobile py-3 flex-row items-center justify-between">
          <View className="flex-row items-center flex-1 mr-3" style={{ gap: 10 }}>
            <MaterialCommunityIcons name="cloud-off-outline" size={20} color="#835400" />
            <View className="flex-1">
              <Text className="font-bold text-sm text-secondary dark:text-secondary-dark">
                {pendingSyncCount} sale{pendingSyncCount > 1 ? "s" : ""} pending sync
              </Text>
              <Text className="text-xs text-on-surface-variant dark:text-text-secondary-dark mt-0.5">
                Recorded offline — will sync automatically once online
              </Text>
            </View>
          </View>
          <Pressable
            onPress={handleSyncNow}
            disabled={syncingNow}
            className="px-3 py-1.5 rounded-lg bg-secondary/10 flex-row items-center"
            style={{ gap: 6 }}
          >
            {syncingNow ? (
              <ActivityIndicator size="small" color="#835400" />
            ) : (
              <MaterialCommunityIcons name="sync" size={16} color="#835400" />
            )}
            <Text className="text-xs font-bold text-secondary dark:text-secondary-dark">Sync now</Text>
          </Pressable>
        </View>
      )}

      {/* Brand filter pills (only if multiple brands) */}
      {availableBrands.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="bg-surface-container-highest dark:bg-surface-dark border-b border-outline-variant dark:border-outline"
          contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 8, gap: 8 }}
        >
          <Pressable
            onPress={() => setActiveBrand(null)}
            className={`px-4 py-2 rounded-full border ${
              activeBrand === null
                ? "bg-primary border-primary"
                : "bg-surface-container-lowest border-outline-variant"
            }`}
          >
            <Text
              className={`font-label-md text-label-md ${
                activeBrand === null ? "text-on-primary" : "text-on-surface-variant"
              }`}
            >
              All Brands
            </Text>
          </Pressable>
          {availableBrands.map((brand) => (
            <Pressable
              key={brand.id}
              onPress={() => setActiveBrand(brand)}
              className={`px-4 py-2 rounded-full border ${
                activeBrand?.id === brand.id
                  ? "bg-primary border-primary"
                  : "bg-surface-container-lowest border-outline-variant"
              }`}
            >
              <Text
                className={`font-label-md text-label-md ${
                  activeBrand?.id === brand.id
                    ? "text-on-primary"
                    : "text-on-surface-variant"
                }`}
              >
                {brand.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      <ScrollView
        className="flex-1"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 96 }}
      >
        {mode === "traditional" ? (
          <View className="px-margin-mobile pt-lg" style={{ gap: 18 }}>
            <View>
              <Text className="font-headline-lg text-headline-lg text-on-surface dark:text-text-primary-dark">
                Namaste, {user?.first_name ?? "Malik"}!
              </Text>
              <Text className="text-sm text-on-surface-variant dark:text-text-secondary-dark mt-0.5">
                {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
              </Text>
            </View>

            {/* Big Quick Actions grid — the whole point of Traditional mode
                is fewer decisions, bigger touch targets. */}
            <View className="flex-row flex-wrap" style={{ gap: 12 }}>
              {QUICK_ACTIONS.map((action) => (
                <Pressable
                  key={action.id}
                  onPress={() => (action.id === "scan" ? setIsScanHubOpen(true) : router.push(action.route as any))}
                  className={`items-center justify-center rounded-2xl active:scale-95 ${
                    action.primary ? "bg-primary dark:bg-primary-dark shadow-md" : "bg-surface-container-lowest dark:bg-surface-dark border border-outline-variant dark:border-outline"
                  }`}
                  style={{ width: "47%", aspectRatio: 1, gap: 8 }}
                >
                  <MaterialCommunityIcons name={action.icon} size={40} color={action.primary ? "#ffffff" : "#005f49"} />
                  <Text className={`font-bold text-base ${action.primary ? "text-white" : "text-on-surface dark:text-text-primary-dark"}`}>
                    {action.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Big standalone info rows — everything else (charts, low
                stock, overdue reminders) is deliberately hidden in this
                mode. Each gets its own accent color so the eye can scan
                the list without reading every label. */}
            {[
              {
                route: "/invoice-history",
                icon: "cash-multiple" as const,
                color: "#0F7A5F",
                bg: "bg-primary/10",
                title: "Aaj Ki Bikri",
                subtitle: statsLoading ? "…" : `${formatCurrency(stats.salesToday)} · ${stats.invoicesToday} bill${stats.invoicesToday !== 1 ? "s" : ""}`,
              },
              {
                route: "/ledger",
                icon: "book-open-variant" as const,
                color: "#B45309",
                bg: "bg-secondary/10",
                title: "Baaki Paisa (Balance)",
                subtitle: statsLoading ? "…" : `${formatCurrency(stats.pendingReceivables)} lena hai`,
              },
              {
                route: "/expenses",
                icon: "wallet-outline" as const,
                color: "#D64545",
                bg: "bg-error/10",
                title: "Kharcha (Expenses)",
                subtitle: statsLoading ? "…" : `${formatCurrency(stats.cashOut)} aaj ka kharcha`,
              },
              {
                route: "/gst-reports?tab=daybook",
                icon: "notebook-outline" as const,
                color: "#1E6FA6",
                bg: "bg-info/10",
                title: "Roznamcha (Day Book)",
                subtitle: "Aaj ki poori entry ek jagah",
              },
            ].map((row) => (
              <Pressable
                key={row.route}
                onPress={() => router.push(row.route as any)}
                className="bg-surface-container-lowest dark:bg-surface-dark border border-outline-variant dark:border-outline rounded-2xl p-4 flex-row items-center active:opacity-80"
                style={{ gap: 14 }}
              >
                <View className={`w-14 h-14 rounded-full ${row.bg} items-center justify-center`}>
                  <MaterialCommunityIcons name={row.icon} size={26} color={row.color} />
                </View>
                <View className="flex-1">
                  <Text className="font-bold text-lg text-on-surface dark:text-text-primary-dark">{row.title}</Text>
                  <Text className="text-sm text-on-surface-variant dark:text-text-secondary-dark" numberOfLines={1}>
                    {row.subtitle}
                  </Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={24} color="#9E9E9E" />
              </Pressable>
            ))}
          </View>
        ) : (
        <View className="px-margin-mobile pt-lg" style={{ gap: 24 }}>
          {/* ── Today's Snapshot ── */}
          <View style={{ gap: 8 }}>
            <View className="flex-row justify-between items-center">
              <Text className="font-headline-sm text-headline-sm text-on-surface dark:text-text-primary-dark">
                Today's Snapshot
              </Text>
              <Pressable onPress={() => router.push("/more?openReport=1" as any)}>
                <Text className="text-primary dark:text-primary-dark font-label-md text-label-md">
                  View Analytics
                </Text>
              </Pressable>
            </View>

            {statsLoading ? (
              <View className="bg-surface-container-lowest dark:bg-surface-dark rounded-xl p-8 border border-outline-variant items-center">
                <ActivityIndicator size="small" color="#0F7A5F" />
              </View>
            ) : (
              <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                {/* To Collect */}
                <View className="p-md rounded-xl" style={{ width: isTablet ? "24%" : "47%", backgroundColor: "#E4F6DC" }}>
                  <View className="flex-row justify-between items-start">
                    <Text className="font-label-md text-label-md uppercase tracking-wider" style={{ color: "#3E8E2F" }}>
                      {t("receivables")}
                    </Text>
                    <MaterialCommunityIcons name="arrow-down-bold-circle" size={16} color="#3E8E2F" />
                  </View>
                  <Text className="font-headline-md text-headline-md mt-1" style={{ color: "#1F5A19" }}>
                    {formatCurrency(stats.pendingReceivables)}
                  </Text>
                </View>

                {/* Cash Out */}
                <View className="p-md rounded-xl" style={{ width: isTablet ? "24%" : "47%", backgroundColor: "#FBE1E6" }}>
                  <View className="flex-row justify-between items-start">
                    <Text className="font-label-md text-label-md uppercase tracking-wider" style={{ color: "#B0345C" }}>
                      {t("payables")}
                    </Text>
                    <MaterialCommunityIcons name="arrow-up-bold-circle" size={16} color="#B0345C" />
                  </View>
                  <Text className="font-headline-md text-headline-md mt-1" style={{ color: "#7A1F3D" }}>
                    {formatCurrency(stats.cashOut)}
                  </Text>
                </View>

                {/* Invoices Today */}
                <View className="p-md rounded-xl" style={{ width: isTablet ? "24%" : "47%", backgroundColor: "#F5F0E1" }}>
                  <View className="flex-row justify-between items-start">
                    <Text className="font-label-md text-label-md uppercase tracking-wider" style={{ color: "#8B6914" }}>
                      Invoices
                    </Text>
                    <MaterialCommunityIcons name="file-document-outline" size={16} color="#8B6914" />
                  </View>
                  <Text className="font-headline-md text-headline-md mt-1" style={{ color: "#5C4510" }}>
                    {stats.invoicesToday}
                  </Text>
                </View>

                {/* Net Sales */}
                <View
                  className="p-md rounded-xl shadow-sm"
                  style={{ width: isTablet ? "24%" : "100%", backgroundColor: "#E1F0FB" }}
                >
                  <View className="flex-row justify-between items-start">
                    <View>
                      <Text className="font-label-md text-label-md uppercase tracking-wider" style={{ color: "#1E6FA6" }}>
                        {t("sales")}
                      </Text>
                      <Text className="font-headline-md text-headline-md mt-1" style={{ color: "#0E3E5C" }}>
                        {formatCurrency(stats.salesToday)}
                      </Text>
                    </View>
                    <View style={{ backgroundColor: "rgba(30,111,166,0.15)" }} className="p-2 rounded-lg">
                      <MaterialCommunityIcons name="trending-up" size={22} color="#1E6FA6" />
                    </View>
                  </View>
                  <View className="mt-md flex-row items-center" style={{ gap: 4 }}>
                    {salesTrendPct !== null ? (
                      <>
                        <Text
                          className={`font-caption text-caption font-bold ${
                            salesTrendPct >= 0 ? "text-success" : "text-error"
                          }`}
                        >
                          {salesTrendPct >= 0 ? "+" : ""}
                          {salesTrendPct.toFixed(1)}%
                        </Text>
                        <Text className="font-caption text-caption" style={{ color: "#1E6FA6" }}>
                          from yesterday
                        </Text>
                      </>
                    ) : (
                      <Text className="font-caption text-caption" style={{ color: "#1E6FA6" }}>
                        {stats.invoicesToday} invoice{stats.invoicesToday !== 1 ? "s" : ""} today
                      </Text>
                    )}
                  </View>
                </View>
              </View>
            )}
          </View>

          {/* ── Quick Actions ── */}
          <View style={{ gap: 8 }}>
            <Text className="font-headline-sm text-headline-sm text-on-surface dark:text-text-primary-dark">
              Quick Actions
            </Text>
            <View className={`${isTablet ? "flex-row flex-wrap" : "flex-row"}`} style={{ gap: 12 }}>
              {QUICK_ACTIONS.map((action) => (
                <View key={action.id} className={isTablet ? "items-center" : "flex-1 items-center"} style={{ gap: 4, width: isTablet ? "18%" : undefined }}>
                  <Pressable
                    onPress={() => (action.id === "scan" ? setIsScanHubOpen(true) : router.push(action.route as any))}
                    className={`w-full aspect-square rounded-xl items-center justify-center active:scale-90 ${
                      action.primary
                        ? "bg-primary dark:bg-primary-dark shadow-md"
                        : "bg-surface-container-lowest dark:bg-surface-dark border border-outline-variant dark:border-outline"
                    }`}
                  >
                    <MaterialCommunityIcons
                      name={action.icon}
                      size={30}
                      color={action.primary ? "#ffffff" : "#005f49"}
                    />
                  </Pressable>
                  <Text
                    className="font-label-md text-label-md text-on-surface dark:text-text-primary-dark text-center"
                    numberOfLines={1}
                  >
                    {action.label}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* ── This Week ── */}
          {weekTrend.length > 0 && (
            <View style={{ gap: 8 }}>
              <Text className="font-headline-sm text-headline-sm text-on-surface dark:text-text-primary-dark">
                This Week
              </Text>
              <View className="bg-surface-container-lowest dark:bg-surface-dark border border-outline-variant dark:border-outline rounded-2xl p-4">
                {(() => {
                  const max = Math.max(1, ...weekTrend.map((d) => d.total));
                  return (
                    <View className="flex-row items-end justify-between" style={{ height: 100, gap: 6 }}>
                      {weekTrend.map((d) => {
                        const dayLabel = new Date(d.date + "T00:00:00").toLocaleDateString(undefined, { weekday: "short" });
                        const isToday = d.date === todayStr;
                        const heightPct = Math.max(4, (d.total / max) * 100);
                        return (
                          <View key={d.date} className="flex-1 items-center" style={{ gap: 4 }}>
                            <View className="w-full flex-1 justify-end">
                              <View
                                className={`w-full rounded-md ${isToday ? "bg-primary dark:bg-primary-dark" : "bg-primary/25 dark:bg-primary-dark/25"}`}
                                style={{ height: `${heightPct}%`, minHeight: 3 }}
                              />
                            </View>
                            <Text className={`text-xs font-bold ${isToday ? "text-primary dark:text-primary-dark" : "text-on-surface-variant dark:text-text-secondary-dark"}`}>
                              {dayLabel[0]}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  );
                })()}
              </View>
            </View>
          )}

          {/* ── Top Products This Month ── */}
          {topProducts.length > 0 && (
            <View style={{ gap: 8 }}>
              <Text className="font-headline-sm text-headline-sm text-on-surface dark:text-text-primary-dark">
                Top Products This Month
              </Text>
              <View className="bg-surface-container-lowest dark:bg-surface-dark border border-outline-variant dark:border-outline rounded-2xl p-4" style={{ gap: 10 }}>
                {topProducts.map((p, idx) => {
                  const max = topProducts[0]?.revenue || 1;
                  return (
                    <View key={p.name + idx}>
                      <View className="flex-row justify-between items-center mb-1">
                        <Text className="text-sm font-bold text-on-surface dark:text-text-primary-dark flex-1 mr-2" numberOfLines={1}>
                          {idx + 1}. {p.name}
                        </Text>
                        <Text className="text-sm font-black text-primary dark:text-primary-dark">
                          {formatCurrency(p.revenue)}
                        </Text>
                      </View>
                      <View className="w-full h-1.5 bg-surface-container dark:bg-bg-dark rounded-full overflow-hidden">
                        <View
                          className="h-full bg-primary dark:bg-primary-dark rounded-full"
                          style={{ width: `${Math.max(4, (p.revenue / max) * 100)}%` }}
                        />
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* ── Overdue Payment Reminders ── */}
          {overdueParties.length > 0 && (
            <View style={{ gap: 8 }}>
              <View className="flex-row justify-between items-center">
                <Text className="font-headline-sm text-headline-sm text-on-surface dark:text-text-primary-dark">
                  Overdue Payments
                </Text>
                <View className="bg-amber-500/10 px-2 py-0.5 rounded-full flex-row items-center" style={{ gap: 4 }}>
                  <View className="w-2 h-2 bg-amber-500 rounded-full" />
                  <Text className="text-amber-700 dark:text-amber-400 font-label-md text-label-md">
                    {overdueParties.length} customer{overdueParties.length !== 1 ? "s" : ""}
                  </Text>
                </View>
              </View>
              <View className="bg-surface-container-lowest dark:bg-surface-dark rounded-xl border border-outline-variant dark:border-outline overflow-hidden">
                {overdueParties.slice(0, 5).map((party, idx) => (
                  <View
                    key={party.id}
                    className={`p-md flex-row items-center justify-between ${idx > 0 ? "border-t border-outline-variant dark:border-outline" : ""}`}
                  >
                    <View className="flex-1 mr-2">
                      <Text className="font-body-md text-body-md font-bold text-on-surface dark:text-text-primary-dark" numberOfLines={1}>
                        {party.name}
                      </Text>
                      <Text className="font-caption text-caption text-error mt-0.5">
                        ₹{parseFloat(party.current_balance).toFixed(2)} overdue
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => {
                        shareLedgerReminder(party.name, party.phone ?? "", parseFloat(party.current_balance), false);
                        api.post(`/reminders/${party.id}/mark-sent`).catch((e) => {
                          console.warn("[Dashboard] Failed to mark reminder as sent:", e);
                        });
                        setOverdueParties((prev) => prev.filter((p) => p.id !== party.id));
                      }}
                      className="bg-primary/10 px-3 py-2 rounded-lg flex-row items-center"
                      style={{ gap: 4 }}
                    >
                      <MaterialCommunityIcons name="whatsapp" size={14} color="#0F7A5F" />
                      <Text className="text-xs font-bold text-primary dark:text-primary-dark">Remind</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* ── Low Stock Alerts ── */}
          <View style={{ gap: 8 }}>
            <View className="flex-row justify-between items-center">
              <Text className="font-headline-sm text-headline-sm text-on-surface dark:text-text-primary-dark">
                Low Stock Alerts
              </Text>
              {lowStockItems.length > 0 && (
                <View className="bg-error/10 px-2 py-0.5 rounded-full flex-row items-center" style={{ gap: 4 }}>
                  <View className="w-2 h-2 bg-error rounded-full" />
                  <Text className="text-error font-label-md text-label-md">
                    {lowStockItems.length} Item{lowStockItems.length !== 1 ? "s" : ""}
                  </Text>
                </View>
              )}
            </View>

            {lowStockItems.length === 0 ? (
              <View className="bg-surface-container-lowest dark:bg-surface-dark rounded-xl border border-outline-variant dark:border-outline p-md items-center">
                <Text className="font-body-md text-body-md text-on-surface-variant dark:text-text-secondary-dark">
                  All products are stocked above reorder level.
                </Text>
              </View>
            ) : (
              <View className="bg-surface-container-lowest dark:bg-surface-dark rounded-xl border border-outline-variant dark:border-outline overflow-hidden">
                {lowStockItems.map((item, idx) => {
                  const critical = item.stock_quantity <= item.reorder_level / 2;
                  return (
                    <View
                      key={item.id}
                      className={`p-md flex-row items-center justify-between ${
                        idx > 0 ? "border-t border-outline-variant dark:border-outline" : ""
                      }`}
                    >
                      <View className="flex-row items-center flex-1" style={{ gap: 16 }}>
                        <View className="w-12 h-12 bg-surface-container-low rounded-lg items-center justify-center border border-outline-variant">
                          <MaterialCommunityIcons name="package-variant" size={22} color="#6e7a74" />
                        </View>
                        <View className="flex-1">
                          <Text
                            className="font-body-md text-body-md text-on-surface dark:text-text-primary-dark font-semibold"
                            numberOfLines={1}
                          >
                            {item.name}
                          </Text>
                          <Text className="font-caption text-caption text-on-surface-variant dark:text-text-secondary-dark">
                            {item.stock_quantity} units left
                          </Text>
                        </View>
                      </View>
                      <View
                        className={`px-3 py-1 rounded-full ${
                          critical ? "bg-error/10" : "bg-secondary-container/20"
                        }`}
                      >
                        <Text
                          className={`font-label-md text-label-md ${
                            critical ? "text-error" : "text-secondary"
                          }`}
                        >
                          {critical ? "Critical" : "Low Stock"}
                        </Text>
                      </View>
                    </View>
                  );
                })}
                <Pressable
                  onPress={() => router.push("/inventory" as any)}
                  className="w-full py-md bg-surface-container-low border-t border-outline-variant items-center active:bg-surface-container-high"
                >
                  <Text className="text-primary font-label-md text-label-md">
                    Restock All Items
                  </Text>
                </Pressable>
              </View>
            )}
          </View>

          {/* ── Recent Activity ── */}
          <View style={{ gap: 8 }}>
            <Text className="font-headline-sm text-headline-sm text-on-surface dark:text-text-primary-dark">
              Recent Activity
            </Text>
            {activity.length === 0 ? (
              <Text className="font-body-md text-body-md text-on-surface-variant dark:text-text-secondary-dark">
                No activity yet today.
              </Text>
            ) : (
              <View style={{ gap: 16 }}>
                {activity.map((item, idx) => (
                  <Pressable
                    key={item.id}
                    onPress={() => router.push(`/invoice-history?openInvoiceId=${item.id}` as any)}
                    className="flex-row items-start active:opacity-70"
                    style={{ gap: 16 }}
                  >
                    <View className="mt-1 w-8 h-8 rounded-full bg-primary/10 items-center justify-center">
                      <MaterialCommunityIcons name="receipt" size={16} color="#005f49" />
                    </View>
                    <View
                      className={`flex-1 pb-md flex-row items-center justify-between ${
                        idx < activity.length - 1
                          ? "border-b border-outline-variant dark:border-outline"
                          : ""
                      }`}
                    >
                      <View className="flex-1">
                        <View className="flex-row justify-between">
                          <Text
                            className="font-body-md text-body-md text-on-surface dark:text-text-primary-dark font-medium flex-1"
                            numberOfLines={1}
                          >
                            New bill{" "}
                            <Text className="text-primary dark:text-primary-dark">
                              #{item.invoice_number}
                            </Text>
                          </Text>
                          <Text className="font-caption text-caption text-on-surface-variant dark:text-text-secondary-dark">
                            {timeAgo(item.date_created)}
                          </Text>
                        </View>
                        <Text className="font-label-md text-label-md text-on-surface-variant dark:text-text-secondary-dark">
                          {formatCurrency(item.grand_total)}
                        </Text>
                      </View>
                      <MaterialCommunityIcons name="chevron-right" size={18} color="#9E9E9E" style={{ marginLeft: 8 }} />
                    </View>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        </View>
        )}
      </ScrollView>

      {/* Scan & Record Hub — camera/scan actions only. Non-camera shortcuts
          (New Sale, Record Payment, plain Record Purchase) already live in
          Quick Actions / More, so they don't belong in a "Scan" menu. */}
      <Modal visible={isScanHubOpen} animationType="slide" transparent onRequestClose={() => setIsScanHubOpen(false)}>
        <Pressable className="flex-1 justify-end bg-black/40" onPress={() => setIsScanHubOpen(false)}>
          <Pressable
            onPress={(e) => e.stopPropagation()}
            className="bg-background dark:bg-bg-dark rounded-t-3xl px-6 pt-6"
            style={{ paddingBottom: Math.max(insets.bottom, 16) + 16 }}
          >
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-xl font-bold text-on-surface dark:text-text-primary-dark">
                Scan & Record
              </Text>
              <Pressable onPress={() => setIsScanHubOpen(false)} className="w-10 h-10 items-center justify-center">
                <MaterialCommunityIcons name="close" size={20} color="#6B7280" />
              </Pressable>
            </View>

            <View className="flex-row flex-wrap" style={{ gap: 12 }}>
              {[
                { label: "Scan Barcode", icon: "barcode-scan" as const, route: "/inventory?openScanner=1" },
                { label: "Purchase Bill", icon: "cart-arrow-down" as const, route: "/bill-scanner?category=purchase" },
                { label: "Product Photo", icon: "package-variant-closed" as const, route: "/bill-scanner?category=product" },
                { label: "Expense Receipt", icon: "receipt" as const, route: "/bill-scanner?category=expense" },
              ].map((opt) => (
                <Pressable
                  key={opt.label}
                  onPress={() => {
                    setIsScanHubOpen(false);
                    router.push(opt.route as any);
                  }}
                  className="items-center"
                  style={{ width: "30%", gap: 6 }}
                >
                  <View className="w-16 h-16 rounded-2xl bg-primary/10 dark:bg-primary-dark/15 items-center justify-center">
                    <MaterialCommunityIcons name={opt.icon} size={26} color="#0F7A5F" />
                  </View>
                  <Text className="text-xs font-bold text-on-surface dark:text-text-primary-dark text-center">
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Pressable
              onPress={() => {
                setIsScanHubOpen(false);
                router.push("/scanned-documents" as any);
              }}
              className="flex-row items-center justify-center mt-6 py-3.5 rounded-2xl border border-outline-variant dark:border-outline"
              style={{ gap: 8 }}
            >
              <MaterialCommunityIcons name="folder-image" size={18} color="#0F7A5F" />
              <Text className="text-primary dark:text-primary-dark font-bold text-sm">View Scanned Documents</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
