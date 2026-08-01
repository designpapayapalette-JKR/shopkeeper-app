import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  FlatList,
  RefreshControl,
  TextInput,
  StyleSheet,
  Modal,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "react-native-paper";
import { useRouter } from "expo-router";
import { useAuth } from "../../src/lib/auth-context";
import { api } from "../../src/lib/api";
import { useTopInset } from "../../src/lib/useTopInset";
import { useBottomInset } from "../../src/lib/useBottomInset";
import { useOutlet } from "../../src/lib/outlet-context";

// ─── Formatters ──────────────────────────────────────────────────────────────

function formatRupee(n: number): string {
  const val = Number.isFinite(n) ? n : 0;
  if (val >= 10_000_000) return `₹${(val / 10_000_000).toFixed(1)}Cr`;
  if (val >= 100_000) return `₹${(val / 100_000).toFixed(1)}L`;
  return `₹${val.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function formatRupeeFull(n: number): string {
  return `₹${(Number.isFinite(n) ? n : 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1)
    .toString()
    .padStart(2, "0")}/${d.getFullYear()}`;
}

function timeAgo(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// ─── Types ────────────────────────────────────────────────────────────────────

type DatePreset = "today" | "week" | "month" | "quarter";
type SalesTab = "sales" | "b2b" | "purchases";

interface OutletBreakdown {
  id?: string;
  name: string;
  sales: string | number;
  invoice_count?: number;
}

interface Invoice {
  id: string;
  invoice_number?: string;
  purchase_number?: string;
  date: string;
  grand_total: string | number;
  payment_status?: string;
  type?: string;
  outlet?: { name: string };
  party?: { name: string };
  supplier?: { name: string };
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DATE_PRESETS: { id: DatePreset; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "week", label: "This Week" },
  { id: "month", label: "This Month" },
  { id: "quarter", label: "This Quarter" },
];

const INVOICE_TABS: { key: SalesTab; label: string; icon: string }[] = [
  { key: "sales", label: "Retail", icon: "cash-register" },
  { key: "b2b", label: "B2B", icon: "briefcase-account" },
  { key: "purchases", label: "Purchases", icon: "truck-delivery" },
];

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  paid:    { bg: "#DCFCE7", text: "#15803D", label: "Paid" },
  unpaid:  { bg: "#FEF3C7", text: "#B45309", label: "Unpaid" },
  overdue: { bg: "#FEE2E2", text: "#DC2626", label: "Overdue" },
  pending: { bg: "#DBEAFE", text: "#2563EB", label: "Pending" },
};

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function SalesOverviewScreen() {
  const theme = useTheme();
  const router = useRouter();
  const topInset = useTopInset();
  const bottomInset = useBottomInset();
  const { user, activeCompany } = useAuth();
  const { selectedOutletId, locationLabel } = useOutlet();

  // Dashboard stats
  const [stats, setStats] = useState({
    salesToday: 0,
    salesWeek: 0,
    salesMonth: 0,
    invoicesToday: 0,
    receivables: 0,
    returns: 0,
  });
  const [outletBreakdown, setOutletBreakdown] = useState<OutletBreakdown[]>([]);
  const [datePreset, setDatePreset] = useState<DatePreset>("today");
  const [loadingStats, setLoadingStats] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Invoice list
  const [activeTab, setActiveTab] = useState<SalesTab>("sales");
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [b2bInvoices, setB2bInvoices] = useState<Invoice[]>([]);
  const [purchases, setPurchases] = useState<Invoice[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);

  const companyName = activeCompany?.name || "ManageMyCounter";
  const firstName = user?.first_name || user?.firstName || "Owner";

  // ── Load KPI stats from dashboard/owner endpoint ──────────────────────────
  const fetchStats = useCallback(async () => {
    try {
      const params: Record<string, string> = { period: datePreset };
      if (selectedOutletId) params.outletId = selectedOutletId;
      const res = await api.get<any>("/dashboard/owner", { params }).catch(() => ({ data: {} }));
      const d = res.data || {};
      setStats({
        salesToday:    parseFloat(d.salesToday    ?? d.totalSales     ?? 0),
        salesWeek:     parseFloat(d.salesWeek     ?? 0),
        salesMonth:    parseFloat(d.salesMonth    ?? 0),
        invoicesToday: parseInt(d.invoicesToday   ?? 0),
        receivables:   parseFloat(d.receivables   ?? d.totalReceivables ?? 0),
        returns:       parseFloat(d.returns       ?? 0),
      });
      setOutletBreakdown(Array.isArray(d.outlets) ? d.outlets : []);
    } catch {
      // silently fail — network may be down
    } finally {
      setLoadingStats(false);
      setRefreshing(false);
    }
  }, [datePreset, selectedOutletId]);

  // ── Load invoice list ──────────────────────────────────────────────────────
  const fetchInvoices = useCallback(async () => {
    setLoadingInvoices(true);
    try {
      const params: Record<string, string> = {};
      if (selectedOutletId) params.outletId = selectedOutletId;
      const endpoints: Record<SalesTab, string> = {
        sales:     "/invoices",
        b2b:       "/b2b/invoices",
        purchases: "/purchases",
      };
      const res = await api.get<any>(endpoints[activeTab], { params });
      const data = res?.data || [];
      if (activeTab === "sales")     setInvoices(data);
      else if (activeTab === "b2b")  setB2bInvoices(data);
      else                           setPurchases(data);
    } catch {
      // silently fail
    } finally {
      setLoadingInvoices(false);
    }
  }, [activeTab, selectedOutletId]);

  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchStats(), fetchInvoices()]);
    setRefreshing(false);
  }, [fetchStats, fetchInvoices]);

  // ── Filtered invoices ──────────────────────────────────────────────────────
  const activeList = useMemo(() => {
    const list = activeTab === "sales" ? invoices : activeTab === "b2b" ? b2bInvoices : purchases;
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter((i) => {
      const num = (i.invoice_number || i.purchase_number || "").toLowerCase();
      const party = (i.party?.name || i.supplier?.name || "").toLowerCase();
      return num.includes(q) || party.includes(q);
    });
  }, [activeTab, invoices, b2bInvoices, purchases, searchQuery]);

  // ─── Sub-components ──────────────────────────────────────────────────────

  const KpiCard = ({
    label, value, icon, color, sub,
  }: { label: string; value: string; icon: string; color: string; sub?: string }) => (
    <View style={[styles.kpiCard, { borderLeftColor: color }]}>
      <View style={[styles.kpiIcon, { backgroundColor: color + "1A" }]}>
        <MaterialCommunityIcons name={icon as any} size={18} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.kpiValue}>{value}</Text>
        <Text style={styles.kpiLabel}>{label}</Text>
        {sub ? <Text style={styles.kpiSub}>{sub}</Text> : null}
      </View>
    </View>
  );

  const OutletBar = ({ outlet, maxSales }: { outlet: OutletBreakdown; maxSales: number }) => {
    const sales = parseFloat(String(outlet.sales ?? 0));
    const pct = maxSales > 0 ? sales / maxSales : 0;
    return (
      <View style={styles.outletRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.outletName} numberOfLines={1}>{outlet.name}</Text>
          <View style={styles.outletBarBg}>
            <View style={[styles.outletBarFill, { width: `${Math.round(pct * 100)}%` }]} />
          </View>
        </View>
        <Text style={styles.outletSales}>{formatRupee(sales)}</Text>
      </View>
    );
  };

  const StatusBadge = ({ status }: { status?: string }) => {
    if (!status) return null;
    const cfg = STATUS_COLORS[status] ?? { bg: "#F3F4F6", text: "#374151", label: status };
    return (
      <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
        <Text style={[styles.statusText, { color: cfg.text }]}>{cfg.label}</Text>
      </View>
    );
  };

  const InvoiceRow = ({ item }: { item: Invoice }) => (
    <Pressable
      style={styles.invoiceRow}
      onPress={() => router.push(`/invoice-history` as any)}
      android_ripple={{ color: "#0368FE11" }}
    >
      <View style={styles.invoiceIcon}>
        <MaterialCommunityIcons
          name={activeTab === "purchases" ? "truck-delivery" : "file-document-outline"}
          size={18}
          color="#0368FE"
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.invoiceNumber} numberOfLines={1}>
          {item.invoice_number || item.purchase_number || "—"}
        </Text>
        <Text style={styles.invoiceParty} numberOfLines={1}>
          {item.party?.name || item.supplier?.name || item.outlet?.name || "—"}
        </Text>
      </View>
      <View style={{ alignItems: "flex-end", gap: 4 }}>
        <Text style={styles.invoiceAmount}>{formatRupeeFull(Number(item.grand_total))}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text style={styles.invoiceDate}>{timeAgo(item.date)}</Text>
          <StatusBadge status={item.payment_status} />
        </View>
      </View>
    </Pressable>
  );

  const maxOutletSales = useMemo(
    () => Math.max(...outletBreakdown.map((o) => parseFloat(String(o.sales ?? 0))), 1),
    [outletBreakdown]
  );

  return (
    <View style={{ flex: 1, backgroundColor: "#F8FAFC" }}>
      {/* ── Hero Header ───────────────────────────────────────────────── */}
      <LinearGradient
        colors={["#0B1F4A", "#0368FE"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: topInset + 10 }]}
      >
        {/* Decorative blobs */}
        <View style={styles.blob1} />
        <View style={styles.blob2} />

        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Sales Overview</Text>
            <Text style={styles.headerSub}>{companyName} · All Branches</Text>
          </View>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Pressable onPress={() => setShowSearch(true)} style={styles.headerBtn}>
              <MaterialCommunityIcons name="magnify" size={20} color="#FFF" />
            </Pressable>
            <Pressable onPress={() => router.push("/invoice-history" as any)} style={styles.headerBtn}>
              <MaterialCommunityIcons name="history" size={20} color="#FFF" />
            </Pressable>
          </View>
        </View>

        {/* Date preset tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingTop: 14, paddingBottom: 4 }}
        >
          {DATE_PRESETS.map((p) => {
            const active = datePreset === p.id;
            return (
              <Pressable
                key={p.id}
                onPress={() => setDatePreset(p.id)}
                style={[
                  styles.presetChip,
                  active && { backgroundColor: "#FFFFFF", borderColor: "#FFFFFF" },
                ]}
              >
                <Text style={[styles.presetLabel, active && { color: "#0368FE" }]}>
                  {p.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={{ paddingBottom: bottomInset + 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0368FE" />}
        showsVerticalScrollIndicator={false}
      >
        {/* ── KPI Grid ─────────────────────────────────────────────────── */}
        {loadingStats ? (
          <ActivityIndicator style={{ marginTop: 24 }} color="#0368FE" />
        ) : (
          <View style={styles.kpiGrid}>
            <KpiCard
              label="Total Sales"
              value={formatRupee(stats.salesToday)}
              icon="cash-register"
              color="#0368FE"
              sub={`${stats.invoicesToday} bills`}
            />
            <KpiCard
              label="Receivables"
              value={formatRupee(stats.receivables)}
              icon="account-arrow-left-outline"
              color="#2E9E5B"
            />
            <KpiCard
              label="Returns"
              value={formatRupee(stats.returns)}
              icon="arrow-u-left-top"
              color="#D64545"
            />
            <KpiCard
              label="Invoices Raised"
              value={String(stats.invoicesToday)}
              icon="file-document-multiple-outline"
              color="#7C3AED"
            />
          </View>
        )}

        {/* ── Branch Revenue Breakdown ──────────────────────────────────── */}
        {outletBreakdown.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="store-outline" size={16} color="#0368FE" />
              <Text style={styles.sectionTitle}>Branch Revenue</Text>
              <Text style={styles.sectionSub}>{locationLabel || "All Locations"}</Text>
            </View>
            {outletBreakdown.map((o, i) => (
              <OutletBar key={o.id || i} outlet={o} maxSales={maxOutletSales} />
            ))}
          </View>
        )}

        {/* ── Transaction History ───────────────────────────────────────── */}
        <View style={styles.section}>
          {/* Tab bar */}
          <View style={styles.tabBar}>
            {INVOICE_TABS.map((tab) => {
              const active = activeTab === tab.key;
              return (
                <Pressable
                  key={tab.key}
                  onPress={() => setActiveTab(tab.key)}
                  style={[styles.tabBtn, active && styles.tabBtnActive]}
                >
                  <MaterialCommunityIcons
                    name={tab.icon as any}
                    size={14}
                    color={active ? "#0368FE" : "#6B7280"}
                  />
                  <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
                    {tab.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Search bar (inline when searching) */}
          {showSearch && (
            <View style={styles.searchBar}>
              <MaterialCommunityIcons name="magnify" size={18} color="#6B7280" />
              <TextInput
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search invoices, party name…"
                placeholderTextColor="#9CA3AF"
                autoFocus
              />
              {searchQuery.length > 0 && (
                <Pressable onPress={() => setSearchQuery("")}>
                  <MaterialCommunityIcons name="close-circle" size={18} color="#6B7280" />
                </Pressable>
              )}
              <Pressable onPress={() => { setShowSearch(false); setSearchQuery(""); }} style={{ marginLeft: 8 }}>
                <Text style={{ color: "#0368FE", fontWeight: "600", fontSize: 13 }}>Done</Text>
              </Pressable>
            </View>
          )}

          {/* Invoice list */}
          {loadingInvoices ? (
            <ActivityIndicator style={{ marginTop: 20 }} color="#0368FE" />
          ) : activeList.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="file-document-outline" size={40} color="#D1D5DB" />
              <Text style={styles.emptyText}>No {activeTab} transactions found</Text>
              <Text style={styles.emptySub}>Pull to refresh or change filters</Text>
            </View>
          ) : (
            activeList.slice(0, 50).map((item) => (
              <InvoiceRow key={item.id} item={item} />
            ))
          )}

          {activeList.length > 0 && (
            <Pressable
              style={styles.viewAllBtn}
              onPress={() => router.push("/invoice-history" as any)}
            >
              <Text style={styles.viewAllText}>View full history</Text>
              <MaterialCommunityIcons name="arrow-right" size={16} color="#0368FE" />
            </Pressable>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    position: "relative",
    overflow: "hidden",
  },
  blob1: {
    position: "absolute",
    top: -40,
    right: -40,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "rgba(255,255,255,0.07)",
  },
  blob2: {
    position: "absolute",
    bottom: -30,
    left: -20,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  headerSub: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 12,
    fontWeight: "500",
    marginTop: 2,
  },
  headerBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  },
  presetChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.4)",
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  presetLabel: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 12,
    fontWeight: "700",
  },

  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 12,
    paddingTop: 14,
    gap: 10,
  },
  kpiCard: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderLeftWidth: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  kpiIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
    letterSpacing: -0.5,
  },
  kpiLabel: {
    fontSize: 11,
    fontWeight: "500",
    color: "#6B7280",
    marginTop: 1,
  },
  kpiSub: {
    fontSize: 10,
    color: "#9CA3AF",
    marginTop: 2,
  },

  section: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 12,
    marginTop: 14,
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#111827",
    flex: 1,
  },
  sectionSub: {
    fontSize: 11,
    color: "#6B7280",
    fontWeight: "500",
  },

  outletRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  outletName: {
    fontSize: 12,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 5,
  },
  outletBarBg: {
    height: 6,
    backgroundColor: "#F3F4F6",
    borderRadius: 3,
    overflow: "hidden",
  },
  outletBarFill: {
    height: 6,
    backgroundColor: "#0368FE",
    borderRadius: 3,
  },
  outletSales: {
    fontSize: 13,
    fontWeight: "700",
    color: "#111827",
    width: 64,
    textAlign: "right",
  },

  tabBar: {
    flexDirection: "row",
    backgroundColor: "#F9FAFB",
    borderRadius: 10,
    padding: 3,
    marginBottom: 12,
    gap: 2,
  },
  tabBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: 8,
    gap: 5,
  },
  tabBtnActive: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
  },
  tabLabelActive: {
    color: "#0368FE",
    fontWeight: "700",
  },

  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: "#111827",
  },

  invoiceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  invoiceIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
  },
  invoiceNumber: {
    fontSize: 13,
    fontWeight: "700",
    color: "#111827",
  },
  invoiceParty: {
    fontSize: 11,
    color: "#6B7280",
    marginTop: 2,
  },
  invoiceAmount: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0368FE",
  },
  invoiceDate: {
    fontSize: 10,
    color: "#9CA3AF",
  },

  statusBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "700",
  },

  emptyState: {
    alignItems: "center",
    paddingVertical: 36,
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
  },
  emptySub: {
    fontSize: 12,
    color: "#9CA3AF",
  },

  viewAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 16,
    gap: 6,
  },
  viewAllText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0368FE",
  },
});
