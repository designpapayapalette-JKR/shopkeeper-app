import React, { useState, useEffect, useCallback, useRef } from "react";
import { View, Text, ScrollView, Pressable, TextInput, ActivityIndicator, RefreshControl, Modal } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTopInset } from "../../src/lib/useTopInset";
import { useBottomInset } from "../../src/lib/useBottomInset";
import { useOutlet } from "../../src/lib/outlet-context";
import { api } from "../../src/lib/api";
import { formatCurrencyLocale, formatDateLocale } from "../../src/lib/i18n";
import LocationSelectorBar from "../../src/components/LocationSelectorBar";
import InvoicePreviewModal from "../../src/components/InvoicePreviewModal";

type DatePreset = "today" | "week" | "month" | "quarter" | "all" | "custom";

function isDateInPreset(dateIso: string, preset: DatePreset, customStart?: string, customEnd?: string): boolean {
  if (preset === "all" || !dateIso) return true;
  const d = new Date(dateIso);
  if (isNaN(d.getTime())) return true;
  const now = new Date();

  if (preset === "today") {
    return d.toDateString() === now.toDateString();
  }
  if (preset === "week") {
    const startOfWeek = new Date(now);
    const day = now.getDay() || 7;
    startOfWeek.setDate(now.getDate() - day + 1);
    startOfWeek.setHours(0, 0, 0, 0);
    return d >= startOfWeek;
  }
  if (preset === "month") {
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }
  if (preset === "quarter") {
    const currentQuarter = Math.floor(now.getMonth() / 3);
    const itemQuarter = Math.floor(d.getMonth() / 3);
    return currentQuarter === itemQuarter && d.getFullYear() === now.getFullYear();
  }
  if (preset === "custom" && customStart && customEnd) {
    const s = new Date(customStart);
    const e = new Date(customEnd);
    e.setHours(23, 59, 59, 999);
    return d >= s && d <= e;
  }
  return true;
}

export default function SalesMonitorScreen() {
  const { t, i18n } = useTranslation();
  const topInset = useTopInset();
  const insets = useSafeAreaInsets();
  const { selectedOutletId } = useOutlet();

  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "gst" | "retail" | "estimate">("all");
  const [datePreset, setDatePreset] = useState<DatePreset>("today");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [isCustomDateModal, setIsCustomDateModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const fetchInvoices = useCallback(async () => {
    try {
      const params: any = {};
      if (selectedOutletId) params.outletId = selectedOutletId;
      const res = await api.get<any>("/invoices", { params });
      if (Array.isArray(res.data)) {
        setInvoices(res.data);
      }
    } catch {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedOutletId]);

  // Real-time direct sync with Web & Desktop (auto-refresh every 15s)
  useEffect(() => {
    fetchInvoices();
    const interval = setInterval(fetchInvoices, 15000);
    return () => clearInterval(interval);
  }, [fetchInvoices]);

  const filteredInvoices = invoices.filter((inv) => {
    const num = (inv.invoice_number || inv.invoiceNumber || "").toLowerCase();
    const cust = (inv.party?.name || inv.customer_name || "").toLowerCase();
    const query = searchQuery.toLowerCase();
    const matchesSearch = num.includes(query) || cust.includes(query);

    if (!matchesSearch) return false;

    // Type filter
    if (filterType === "gst" && inv.bill_type !== "gst" && inv.type !== "gst") return false;
    if (filterType === "retail" && inv.bill_type !== "retail" && inv.type !== "retail") return false;
    if (filterType === "estimate" && inv.bill_type !== "estimate" && inv.type !== "estimate") return false;

    // Date preset filter
    const createdDate = inv.created_at || inv.invoice_date || inv.date;
    return isDateInPreset(createdDate, datePreset, customStart, customEnd);
  });

  const totalSalesVolume = filteredInvoices.reduce(
    (acc, inv) => acc + (parseFloat(inv.grand_total || inv.total || 0) || 0),
    0
  );

  const paidCount = filteredInvoices.filter((inv) => inv.payment_status === "paid" || inv.status === "paid").length;

  const datePresets: { id: DatePreset; label: string }[] = [
    { id: "today", label: "Today" },
    { id: "week", label: "This Week" },
    { id: "month", label: "This Month" },
    { id: "quarter", label: "This Quarter" },
    { id: "all", label: "All Time" },
    { id: "custom", label: "Custom Date" },
  ];

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color="#0368FE" />
        <Text className="text-sm text-on-surface-variant mt-2 font-semibold">
          {t("common.loading", "Syncing real-time sales & invoices...")}
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: topInset }}>
      {/* Header Bar */}
      <View className="px-5 py-3 border-b border-outline-variant bg-surface-container-lowest flex-row items-center justify-between">
        <View>
          <Text className="text-xl font-extrabold text-on-surface">
            {t("salesMonitor.title", "Sales & Orders Oversight")}
          </Text>
          <Text className="text-xs text-on-surface-variant mt-0.5 flex-row items-center">
            <MaterialCommunityIcons name="sync" size={12} color="#2E9E5B" /> Real-time Desktop & Web Sync Active
          </Text>
        </View>
        <View className="w-10 h-10 rounded-2xl bg-primary/10 items-center justify-center border border-primary/20">
          <MaterialCommunityIcons name="receipt" size={22} color="#0368FE" />
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 110 + insets.bottom }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchInvoices();
            }}
          />
        }
      >
        {/* Location Selector */}
        <LocationSelectorBar onLocationChange={() => fetchInvoices()} />

        {/* Date Filter Bar */}
        <View className="bg-surface-container-lowest py-2.5 px-5 border-b border-outline-variant">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row" style={{ gap: 8 }}>
            {datePresets.map((p) => {
              const active = datePreset === p.id;
              return (
                <Pressable
                  key={p.id}
                  onPress={() => {
                    if (p.id === "custom") {
                      setDatePreset("custom");
                      setIsCustomDateModal(true);
                    } else {
                      setDatePreset(p.id);
                    }
                  }}
                  className={`px-3.5 py-1.5 rounded-full flex-row items-center border ${
                    active ? "bg-primary border-primary shadow-xs" : "bg-surface-container-low border-outline-variant"
                  }`}
                  style={{ gap: 6 }}
                >
                  <MaterialCommunityIcons
                    name="calendar-range-outline"
                    size={14}
                    color={active ? "#FFFFFF" : "#6B7280"}
                  />
                  <Text className={`text-xs font-bold ${active ? "text-white" : "text-on-surface"}`}>{p.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Executive Sales KPI Summary Cards */}
        <View className="px-5 my-3 flex-row" style={{ gap: 10 }}>
          <View className="flex-1 bg-surface-container-lowest border border-outline-variant rounded-2xl p-3.5 shadow-sm">
            <Text className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
              {t("salesMonitor.salesVolume", "Sales Volume")}
            </Text>
            <Text className="text-lg font-extrabold text-primary mt-1">
              {formatCurrencyLocale(totalSalesVolume, i18n.language)}
            </Text>
          </View>

          <View className="flex-1 bg-surface-container-lowest border border-outline-variant rounded-2xl p-3.5 shadow-sm">
            <Text className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
              {t("salesMonitor.billsGenerated", "Bills Generated")}
            </Text>
            <Text className="text-lg font-extrabold text-on-surface mt-1">{filteredInvoices.length}</Text>
          </View>

          <View className="flex-1 bg-surface-container-lowest border border-outline-variant rounded-2xl p-3.5 shadow-sm">
            <Text className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
              {t("salesMonitor.paidBills", "Paid Invoices")}
            </Text>
            <Text className="text-lg font-extrabold text-emerald-600 mt-1">{paidCount}</Text>
          </View>
        </View>

        {/* Search & Bill Type Filter */}
        <View className="px-5 mb-3">
          <View className="flex-row items-center bg-surface-container-lowest border border-outline-variant rounded-2xl px-4 py-2.5 mb-2 shadow-xs" style={{ gap: 8 }}>
            <MaterialCommunityIcons name="magnify" size={20} color="#9CA3AF" />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={t("salesMonitor.searchPlaceholder", "Search invoice # or party name...")}
              placeholderTextColor="#9CA3AF"
              className="flex-1 text-sm font-medium text-on-surface"
            />
            {searchQuery !== "" && (
              <Pressable onPress={() => setSearchQuery("")}>
                <MaterialCommunityIcons name="close-circle" size={18} color="#9CA3AF" />
              </Pressable>
            )}
          </View>

          {/* Type Filter Buttons */}
          <View className="flex-row" style={{ gap: 8 }}>
            {(["all", "gst", "retail", "estimate"] as const).map((type) => {
              const active = filterType === type;
              return (
                <Pressable
                  key={type}
                  onPress={() => setFilterType(type)}
                  className={`px-3 py-1.5 rounded-xl border flex-1 items-center ${
                    active ? "bg-primary/10 border-primary" : "bg-surface-container-low border-outline-variant"
                  }`}
                >
                  <Text className={`text-xs font-bold capitalize ${active ? "text-primary" : "text-on-surface-variant"}`}>
                    {type}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Invoices List */}
        <View className="px-5">
          {filteredInvoices.length === 0 ? (
            <View className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-8 items-center my-4">
              <MaterialCommunityIcons name="file-document-outline" size={40} color="#9CA3AF" />
              <Text className="text-sm font-bold text-on-surface mt-2">No invoices match criteria</Text>
              <Text className="text-xs text-on-surface-variant text-center mt-1">
                Try changing date presets or search terms. New sales from Web/Desktop sync automatically.
              </Text>
            </View>
          ) : (
            filteredInvoices.map((inv) => {
              const invNo = inv.invoice_number || inv.invoiceNumber || `INV-${inv.id?.slice(0, 6)}`;
              const partyName = inv.party?.name || inv.customer_name || "Walk-in Customer";
              const amount = parseFloat(inv.grand_total || inv.total || 0);
              const isPaid = inv.payment_status === "paid" || inv.status === "paid";
              const type = (inv.bill_type || inv.type || "gst").toUpperCase();
              const dateStr = inv.created_at || inv.invoice_date || inv.date;

              return (
                <Pressable
                  key={inv.id}
                  onPress={async () => {
                    try {
                      const res: any = await api.get(`/invoices/${inv.id}`);
                      if (res && res.data) {
                        setSelectedInvoice(res.data);
                      } else {
                        setSelectedInvoice(inv);
                      }
                    } catch {
                      setSelectedInvoice(inv);
                    }
                  }}
                  className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-4 mb-3 shadow-xs active:opacity-85"
                >
                  <View className="flex-row items-center justify-between">
                    <View className="flex-1 mr-2">
                      <View className="flex-row items-center" style={{ gap: 8 }}>
                        <Text className="text-base font-extrabold text-on-surface">{invNo}</Text>
                        <View className="bg-primary/10 px-2 py-0.5 rounded-md">
                          <Text className="text-[10px] font-extrabold text-primary">{type}</Text>
                        </View>
                      </View>

                      <Text className="text-xs text-on-surface-variant font-medium mt-1" numberOfLines={1}>
                        Party: {partyName}
                      </Text>

                      <Text className="text-[11px] text-on-surface-variant mt-0.5">
                        {dateStr ? formatDateLocale(dateStr, i18n.language) : "Today"}
                      </Text>
                    </View>

                    <View className="items-end">
                      <Text className="text-base font-extrabold text-on-surface">
                        {formatCurrencyLocale(amount, i18n.language)}
                      </Text>
                      <View
                        className={`px-2.5 py-0.5 rounded-full mt-1 ${
                          isPaid ? "bg-emerald-100" : "bg-amber-100"
                        }`}
                      >
                        <Text className={`text-[10px] font-extrabold ${isPaid ? "text-emerald-700" : "text-amber-700"}`}>
                          {isPaid ? "PAID" : "UNPAID"}
                        </Text>
                      </View>
                    </View>
                  </View>
                </Pressable>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Custom Date Range Picker Modal */}
      <Modal visible={isCustomDateModal} transparent animationType="slide" onRequestClose={() => setIsCustomDateModal(false)}>
        <Pressable className="flex-1 bg-black/50 justify-end" onPress={() => setIsCustomDateModal(false)}>
          <Pressable className="bg-surface-container-lowest rounded-t-3xl p-6" style={{ paddingBottom: 28 + insets.bottom }} onPress={() => {}}>
            <View className="flex-row items-center justify-between mb-4 border-b border-outline-variant pb-3">
              <Text className="text-lg font-extrabold text-on-surface">Select Custom Date Range</Text>
              <Pressable onPress={() => setIsCustomDateModal(false)}>
                <MaterialCommunityIcons name="close-circle" size={24} color="#9CA3AF" />
              </Pressable>
            </View>

            <View className="space-y-4">
              <View>
                <Text className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">
                  Start Date (YYYY-MM-DD)
                </Text>
                <TextInput
                  value={customStart}
                  onChangeText={setCustomStart}
                  placeholder="e.g. 2026-07-01"
                  className="bg-surface-container-low border border-outline-variant rounded-xl px-4 py-3 text-sm font-bold"
                />
              </View>

              <View className="mt-3">
                <Text className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">
                  End Date (YYYY-MM-DD)
                </Text>
                <TextInput
                  value={customEnd}
                  onChangeText={setCustomEnd}
                  placeholder="e.g. 2026-07-31"
                  className="bg-surface-container-low border border-outline-variant rounded-xl px-4 py-3 text-sm font-bold"
                />
              </View>
            </View>

            <Pressable
              onPress={() => setIsCustomDateModal(false)}
              className="bg-primary py-3.5 rounded-2xl items-center mt-6 shadow-sm"
            >
              <Text className="text-white font-bold text-sm">Apply Custom Filter</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Invoice Detail Drawer Modal */}
      {selectedInvoice && (
        <Modal visible transparent animationType="slide" onRequestClose={() => setSelectedInvoice(null)}>
          <View className="flex-1 bg-black/50 justify-end">
            <View className="bg-surface-container-lowest rounded-t-3xl max-h-[85%] flex-1 flex-col overflow-hidden">
              <View className="p-5 pb-3 border-b border-outline-variant flex-row items-center justify-between">
                <View>
                  <Text className="text-xl font-extrabold text-on-surface">
                    {selectedInvoice.invoice_number || selectedInvoice.invoiceNumber || `INV-${selectedInvoice.id?.slice(0, 6)}`}
                  </Text>
                  <Text className="text-xs text-on-surface-variant mt-0.5">
                    {selectedInvoice.created_at ? formatDateLocale(selectedInvoice.created_at, i18n.language) : "Today"}
                  </Text>
                </View>
                <Pressable onPress={() => setSelectedInvoice(null)} className="p-1">
                  <MaterialCommunityIcons name="close-circle" size={24} color="#9CA3AF" />
                </Pressable>
              </View>

              <ScrollView className="flex-1 p-5" showsVerticalScrollIndicator={false}>
                {/* Party & Payment Info */}
                <View className="bg-surface-container-low p-4 rounded-2xl mb-4 border border-outline-variant">
                  <Text className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1">
                    Customer / Party Details
                  </Text>
                  <Text className="text-base font-extrabold text-on-surface">
                    {selectedInvoice.party?.name || selectedInvoice.customer_name || "Walk-in Customer"}
                  </Text>
                  {selectedInvoice.party?.phone && (
                    <Text className="text-xs text-on-surface-variant mt-0.5">Phone: {selectedInvoice.party.phone}</Text>
                  )}
                  {selectedInvoice.party?.gstin && (
                    <Text className="text-xs text-on-surface-variant mt-0.5">GSTIN: {selectedInvoice.party.gstin}</Text>
                  )}
                </View>

                {/* Purchased Line Items */}
                <Text className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">
                  Line Items Purchased
                </Text>
                {Array.isArray(selectedInvoice.items) && selectedInvoice.items.length > 0 ? (
                  selectedInvoice.items.map((item: any, idx: number) => (
                    <View key={idx} className="flex-row items-center justify-between py-2 border-b border-outline-variant">
                      <View className="flex-1 mr-2">
                        <Text className="text-sm font-bold text-on-surface">{item.product_name || item.name || "Item"}</Text>
                        <Text className="text-xs text-on-surface-variant">
                          {item.quantity} x {formatCurrencyLocale(parseFloat(item.unit_price || item.rate || 0), i18n.language)}
                        </Text>
                      </View>
                      <Text className="text-sm font-extrabold text-on-surface">
                        {formatCurrencyLocale(parseFloat(item.total || item.amount || 0), i18n.language)}
                      </Text>
                    </View>
                  ))
                ) : (
                  <Text className="text-xs text-on-surface-variant italic mb-4">Standard counter sales summary</Text>
                )}

                {/* Total Summary */}
                <View className="bg-primary/5 p-4 rounded-2xl my-4 border border-primary/20 flex-row items-center justify-between">
                  <Text className="text-sm font-extrabold text-on-surface">Grand Total (Incl. GST)</Text>
                  <Text className="text-xl font-black text-primary">
                    {formatCurrencyLocale(parseFloat(selectedInvoice.grand_total || selectedInvoice.total || 0), i18n.language)}
                  </Text>
                </View>
              </ScrollView>

              <View className="p-4 border-t border-outline-variant bg-surface-container-lowest" style={{ paddingBottom: 28 + insets.bottom }}>
                <View className="flex-row" style={{ gap: 10 }}>
                  <Pressable onPress={() => setShowPreview(true)} className="flex-1 bg-surface border border-outline-variant py-3.5 rounded-2xl items-center">
                    <Text className="text-primary font-bold text-sm">Preview</Text>
                  </Pressable>
                  <Pressable onPress={() => setSelectedInvoice(null)} className="flex-1 bg-primary py-3.5 rounded-2xl items-center">
                    <Text className="text-white font-bold text-sm">Close Invoice</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </View>
        </Modal>
      )}

  {/* Invoice Preview Modal */}
  <InvoicePreviewModal visible={showPreview} onClose={() => setShowPreview(false)} detail={selectedInvoice} />
</View>
  );
}
