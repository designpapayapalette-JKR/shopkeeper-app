import React, { useCallback, useEffect, useState } from "react";
import { View, Text, FlatList, ActivityIndicator, Pressable, Alert, Modal, ScrollView, TextInput, RefreshControl, Share } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { api, ApiError, apiUrl } from "../src/lib/api";
import { useTopInset } from "../src/lib/useTopInset";
import { Searchbar, useTheme } from "react-native-paper";
import { shareDataAsPdf } from "../src/lib/pdfExport";

type HistoryTab = "sales" | "b2b" | "purchases";

interface InvoiceSummary {
  id: string;
  invoice_number: string;
  date: string;
  type: string;
  grand_total: string;
  payment_status: string;
  party?: { name: string };
}

interface B2BInvoiceSummary {
  id: string;
  invoice_number: string;
  date: string;
  type: string;
  grand_total: string;
  payment_status?: string;
  party?: { name: string };
}

interface PurchaseSummary {
  id: string;
  purchase_number: string;
  date: string;
  grand_total: string;
  payment_status?: string;
  supplier?: { name: string };
  warehouse?: { name: string };
}

const TABS: { key: HistoryTab; label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }[] = [
  { key: "sales", label: "Retail Sales", icon: "cash-register" },
  { key: "b2b", label: "B2B Orders", icon: "briefcase-account" },
  { key: "purchases", label: "Purchases", icon: "truck-delivery" },
];

export default function InvoiceHistoryScreen() {
  const theme = useTheme();
  const topInset = useTopInset();
  const [activeTab, setActiveTab] = useState<HistoryTab>("sales");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [invoices, setInvoices] = useState<InvoiceSummary[]>([]);
  const [b2bInvoices, setB2bInvoices] = useState<B2BInvoiceSummary[]>([]);
  const [purchases, setPurchases] = useState<PurchaseSummary[]>([]);

  const [detailTab, setDetailTab] = useState<HistoryTab>("sales");
  const [detailInvoiceId, setDetailInvoiceId] = useState<string | null>(null);
  const [detailInvoice, setDetailInvoice] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showEwbForm, setShowEwbForm] = useState(false);
  const [ewbNumber, setEwbNumber] = useState("");
  const [ewbSubmitting, setEwbSubmitting] = useState(false);
  const [showEInvForm, setShowEInvForm] = useState(false);
  const [einvIrn, setEinvIrn] = useState("");
  const [einvSubmitting, setEinvSubmitting] = useState(false);
  const [voiding, setVoiding] = useState(false);
  const [returning, setReturning] = useState(false);
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const openDetail = async (id: string, tab: HistoryTab = "sales") => {
    setDetailTab(tab);
    setDetailInvoiceId(id);
    setDetailLoading(true);
    setShowEwbForm(false);
    setShowEInvForm(false);
    setDetailInvoice(null);
    try {
      const endpoint = tab === "b2b" ? `/b2b/invoices/${id}` :
        tab === "purchases" ? `/purchases/${id}` :
        `/invoices/${id}/detail`;
      const res = await api.get<{ data: any }>(endpoint);
      setDetailInvoice(res.data);
    } catch {
      Alert.alert("Error", "Could not load detail.");
    } finally {
      setDetailLoading(false);
    }
  };

  const handleVoid = async () => {
    if (!detailInvoice) return;
    Alert.alert("Void Invoice", "Are you sure you want to void this invoice?", [
      { text: "Cancel", style: "cancel" },
      { text: "Void", style: "destructive", onPress: async () => {
        setVoiding(true);
        try {
          await api.patch(`/invoices/${detailInvoice.id}/void`);
          Alert.alert("Voided", "Invoice has been voided.");
          setDetailInvoiceId(null);
          loadData();
        } catch (e) {
          Alert.alert("Error", e instanceof ApiError ? e.message : "Failed to void.");
        } finally {
          setVoiding(false);
        }
      }},
    ]);
  };

  const handleReturn = async () => {
    if (!detailInvoice) return;
    Alert.alert("Return / Refund", "Create a return/refund for this invoice?", [
      { text: "Cancel", style: "cancel" },
      { text: "Create Return", onPress: async () => {
        setReturning(true);
        try {
          await api.post(`/invoices/${detailInvoice.id}/return`);
          Alert.alert("Return Created", "Return has been processed.");
          setDetailInvoiceId(null);
          loadData();
        } catch (e) {
          Alert.alert("Error", e instanceof ApiError ? e.message : "Failed to create return.");
        } finally {
          setReturning(false);
        }
      }},
    ]);
  };

  const handleSend = async () => {
    if (!detailInvoice) return;
    setSending(true);
    try {
      await api.post(`/invoices/${detailInvoice.id}/send`);
      Alert.alert("Sent", "Invoice has been sent to the customer.");
    } catch (e) {
      Alert.alert("Error", e instanceof ApiError ? e.message : "Failed to send.");
    } finally {
      setSending(false);
    }
  };

  const handleShare = async () => {
    if (!detailInvoice) return;
    try {
      await Share.share({
        message: `Invoice ${detailInvoice.invoiceNumber || detailInvoice.invoice_number}: ₹${Number(detailInvoice.grandTotal || detailInvoice.grand_total).toLocaleString("en-IN")}`,
      });
    } catch {
      // user cancelled
    }
  };

  const handleDownloadPdf = async () => {
    if (!detailInvoice) return;
    try {
      const pdfUrl = `${apiUrl}/invoices/${detailInvoice.id}/pdf`;
      await Share.share({ message: `Download invoice PDF: ${pdfUrl}` });
    } catch (e) {
      Alert.alert("Error", "Could not generate PDF.");
    }
  };

  const recordEwayBill = async () => {
    if (!detailInvoice || !ewbNumber.trim()) return;
    setEwbSubmitting(true);
    try {
      const res = await api.post<{ data: any }>(`/eway-bills/${detailInvoice.id}`, { ewbNumber: ewbNumber.trim() });
      setDetailInvoice({ ...detailInvoice, ewayBill: res.data });
      setShowEwbForm(false);
      setEwbNumber("");
    } catch (e) {
      Alert.alert("Error", e instanceof ApiError ? e.message : "Failed to record e-way bill.");
    } finally {
      setEwbSubmitting(false);
    }
  };

  const recordEInvoice = async () => {
    if (!detailInvoice || !einvIrn.trim()) return;
    setEinvSubmitting(true);
    try {
      const res = await api.post<{ data: any }>(`/e-invoices/${detailInvoice.id}`, { irn: einvIrn.trim() });
      setDetailInvoice({ ...detailInvoice, eInvoice: res.data });
      setShowEInvForm(false);
      setEinvIrn("");
    } catch (e) {
      Alert.alert("Error", e instanceof ApiError ? e.message : "Failed to record e-invoice.");
    } finally {
      setEinvSubmitting(false);
    }
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      if (activeTab === "sales") {
        const res: any = await api.get("/invoices");
        setInvoices(res?.data || []);
      } else if (activeTab === "b2b") {
        const res: any = await api.get("/b2b/invoices");
        setB2bInvoices(res?.data || []);
      } else {
        const res: any = await api.get("/purchases");
        setPurchases(res?.data || []);
      }
    } catch (err) {
      console.error("Failed to load history:", err);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await loadData(); } finally { setRefreshing(false); }
  }, [loadData]);

  const filteredInvoices = invoices.filter((item) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q ||
      item.invoice_number.toLowerCase().includes(q) ||
      (item.party?.name || "").toLowerCase().includes(q);
    const matchesStatus = statusFilter === "All" || item.payment_status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const filteredB2bInvoices = b2bInvoices.filter((item) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q ||
      item.invoice_number.toLowerCase().includes(q) ||
      (item.party?.name || "").toLowerCase().includes(q);
    const matchesStatus = statusFilter === "All" || item.payment_status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const filteredPurchases = purchases.filter((item) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q ||
      item.purchase_number.toLowerCase().includes(q) ||
      (item.supplier?.name || "").toLowerCase().includes(q);
    const matchesStatus = statusFilter === "All" || item.payment_status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")}/${d.getFullYear()}`;
  };

  const BADGE_STYLES: Record<string, { bg: string; text: string }> = {
    gst: { bg: "bg-primary/10", text: "text-primary" },
    retail: { bg: "bg-gray-100 dark:bg-zinc-800", text: "text-on-surface-variant dark:text-text-secondary-dark" },
    estimate: { bg: "bg-secondary/10", text: "text-secondary" },
    bill_of_supply: { bg: "bg-secondary/10", text: "text-secondary" },
    b2b: { bg: "bg-primary/10", text: "text-primary" },
  };

  const renderBadge = (type: string) => {
    const s = BADGE_STYLES[type] || BADGE_STYLES.retail;
    return (
      <Text className={`text-[10px] font-bold px-2 py-1 rounded-full ${s.bg} ${s.text}`} numberOfLines={1}>
        {type.replace(/_/g, " ").toUpperCase()}
      </Text>
    );
  };

  const renderTab = (tab: typeof TABS[0]) => (
    <Pressable
      key={tab.key}
      onPress={() => setActiveTab(tab.key)}
      className={`py-3 px-4 rounded-full flex-row items-center gap-2 ${activeTab === tab.key ? "bg-primary" : "bg-surface-container-lowest dark:bg-surface-dark"}`}
    >
      <MaterialCommunityIcons name={tab.icon} size={18} color={activeTab === tab.key ? "#fff" : theme.colors.onSurfaceVariant} />
      <Text className={`text-xs font-bold ${activeTab === tab.key ? "text-white" : "text-on-surface-variant dark:text-text-secondary-dark"}`}>{tab.label}</Text>
    </Pressable>
  );

  const renderInvoiceItem = (item: InvoiceSummary) => (
    <Pressable onPress={() => openDetail(item.id, "sales")} className="bg-surface-container-lowest dark:bg-surface-dark border border-gray-100 dark:border-zinc-800 rounded-2xl p-4 mx-4 mb-3">
      <View className="flex-row justify-between items-center mb-2">
        <Text className="font-mono text-sm font-bold text-on-surface dark:text-text-primary-dark flex-1 mr-2" numberOfLines={1}>{item.invoice_number}</Text>
        {renderBadge(item.type)}
      </View>
      <View className="flex-row justify-between items-center">
        <View className="flex-1 mr-2">
          <Text className="text-xs text-on-surface-variant dark:text-text-secondary-dark" numberOfLines={1}>{item.party?.name || "Walk-in Customer"}</Text>
          <Text className="text-xs text-on-surface-variant dark:text-text-secondary-dark mt-0.5">{formatDate(item.date)}</Text>
        </View>
        <Text className="text-base font-bold text-on-surface dark:text-text-primary-dark shrink-0" numberOfLines={1}>₹{parseFloat(item.grand_total).toLocaleString("en-IN")}</Text>
      </View>
    </Pressable>
  );

  const renderB2bItem = (item: B2BInvoiceSummary) => (
    <Pressable onPress={() => openDetail(item.id, "b2b")} className="bg-surface-container-lowest dark:bg-surface-dark border border-gray-100 dark:border-zinc-800 rounded-2xl p-4 mx-4 mb-3">
      <View className="flex-row justify-between items-center mb-2">
        <Text className="font-mono text-sm font-bold text-on-surface dark:text-text-primary-dark flex-1 mr-2" numberOfLines={1}>{item.invoice_number}</Text>
        {renderBadge("b2b")}
      </View>
      <View className="flex-row justify-between items-center">
        <View className="flex-1 mr-2">
          <Text className="text-xs text-on-surface-variant dark:text-text-secondary-dark" numberOfLines={1}>{item.party?.name || "B2B Customer"}</Text>
          <Text className="text-xs text-on-surface-variant dark:text-text-secondary-dark mt-0.5">{formatDate(item.date)}</Text>
        </View>
        <Text className="text-base font-bold text-on-surface dark:text-text-primary-dark shrink-0" numberOfLines={1}>₹{parseFloat(item.grand_total).toLocaleString("en-IN")}</Text>
      </View>
    </Pressable>
  );

  const renderPurchaseItem = (item: PurchaseSummary) => (
    <Pressable onPress={() => openDetail(item.id, "purchases")} className="bg-surface-container-lowest dark:bg-surface-dark border border-gray-100 dark:border-zinc-800 rounded-2xl p-4 mx-4 mb-3">
      <View className="flex-row justify-between items-center mb-2">
        <Text className="font-mono text-sm font-bold text-on-surface dark:text-text-primary-dark flex-1 mr-2" numberOfLines={1}>{item.purchase_number}</Text>
        <MaterialCommunityIcons name="truck-delivery" size={18} color={theme.colors.primary} />
      </View>
      <View className="flex-row justify-between items-center">
        <View className="flex-1 mr-2">
          <Text className="text-xs text-on-surface-variant dark:text-text-secondary-dark" numberOfLines={1}>{item.supplier?.name || "Supplier"}</Text>
          <Text className="text-xs text-on-surface-variant dark:text-text-secondary-dark mt-0.5" numberOfLines={1}>{item.warehouse?.name} • {formatDate(item.date)}</Text>
        </View>
        <Text className="text-base font-bold text-on-surface dark:text-text-primary-dark shrink-0" numberOfLines={1}>₹{parseFloat(item.grand_total).toLocaleString("en-IN")}</Text>
      </View>
    </Pressable>
  );

  const renderSalesDetail = () => (
    <ScrollView>
      <Text className="text-sm text-on-surface-variant dark:text-text-secondary-dark mb-1" numberOfLines={1}>Customer: {detailInvoice.party?.name || "Walk-in Customer"}</Text>
      <Text className="text-lg font-black text-on-surface dark:text-text-primary-dark mb-4">₹{Number(detailInvoice.grandTotal).toLocaleString("en-IN")}</Text>

      <View className="border-t border-gray-100 dark:border-zinc-800 pt-4">
        <Text className="text-xs font-bold text-on-surface-variant dark:text-text-secondary-dark uppercase tracking-wider mb-1">e-Way Bill</Text>
        {detailInvoice.ewayBill ? (
          <Text className="text-sm text-on-surface dark:text-text-primary-dark mb-3" numberOfLines={1}>EWB {detailInvoice.ewayBill.ewbNumber} — {detailInvoice.ewayBill.status}</Text>
        ) : showEwbForm ? (
          <View className="mb-4">
            <TextInput
              value={ewbNumber}
              onChangeText={setEwbNumber}
              placeholder="e-Way bill number (from portal)"
              placeholderTextColor="#A0A0A0"
              className="bg-surface-container-lowest dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl px-3 py-2.5 text-sm font-medium text-on-surface dark:text-text-primary-dark mb-2"
            />
            <View className="flex-row" style={{ gap: 8 }}>
              <Pressable onPress={recordEwayBill} disabled={ewbSubmitting || !ewbNumber.trim()} className="bg-primary px-4 py-2 rounded-lg">
                {ewbSubmitting ? <ActivityIndicator color="white" size="small" /> : <Text className="text-white font-bold text-xs">Save</Text>}
              </Pressable>
              <Pressable onPress={() => setShowEwbForm(false)} className="px-4 py-2 rounded-lg border border-gray-200 dark:border-zinc-800">
                <Text className="text-on-surface-variant dark:text-text-secondary-dark font-bold text-xs">Cancel</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable onPress={() => setShowEwbForm(true)} className="mb-4">
            <Text className="text-primary font-bold text-sm">+ Record e-Way Bill</Text>
          </Pressable>
        )}

        <Text className="text-xs font-bold text-on-surface-variant dark:text-text-secondary-dark uppercase tracking-wider mb-1">e-Invoice (IRN)</Text>
        {detailInvoice.eInvoice ? (
          <Text className="text-sm text-on-surface dark:text-text-primary-dark mb-1" numberOfLines={2}>IRN {detailInvoice.eInvoice.irn} — {detailInvoice.eInvoice.status}</Text>
        ) : showEInvForm ? (
          <View className="mb-4">
            <TextInput
              value={einvIrn}
              onChangeText={setEinvIrn}
              placeholder="IRN (from your GSP)"
              placeholderTextColor="#A0A0A0"
              className="bg-surface-container-lowest dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl px-3 py-2.5 text-sm font-medium text-on-surface dark:text-text-primary-dark mb-2"
            />
            <View className="flex-row" style={{ gap: 8 }}>
              <Pressable onPress={recordEInvoice} disabled={einvSubmitting || !einvIrn.trim()} className="bg-primary px-4 py-2 rounded-lg">
                {einvSubmitting ? <ActivityIndicator color="white" size="small" /> : <Text className="text-white font-bold text-xs">Save</Text>}
              </Pressable>
              <Pressable onPress={() => setShowEInvForm(false)} className="px-4 py-2 rounded-lg border border-gray-200 dark:border-zinc-800">
                <Text className="text-on-surface-variant dark:text-text-secondary-dark font-bold text-xs">Cancel</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable onPress={() => setShowEInvForm(true)} className="mb-4">
            <Text className="text-primary font-bold text-sm">+ Record e-Invoice</Text>
          </Pressable>
        )}
      </View>

      <View className="border-t border-gray-100 dark:border-zinc-800 pt-4 mt-2">
        <Text className="text-xs font-bold text-on-surface-variant dark:text-text-secondary-dark uppercase tracking-wider mb-3">Actions</Text>
        <View className="flex-row flex-wrap" style={{ gap: 8 }}>
          <Pressable onPress={handleShare} className="flex-row items-center gap-1.5 bg-surface-container-lowest dark:bg-surface-dark border border-gray-200 dark:border-zinc-800 px-3 py-2 rounded-lg">
            <MaterialCommunityIcons name="share-variant" size={16} color={theme.colors.primary} />
            <Text className="text-xs font-bold text-primary">Share</Text>
          </Pressable>
          <Pressable onPress={handleDownloadPdf} className="flex-row items-center gap-1.5 bg-surface-container-lowest dark:bg-surface-dark border border-gray-200 dark:border-zinc-800 px-3 py-2 rounded-lg">
            <MaterialCommunityIcons name="file-pdf-box" size={16} color={theme.colors.primary} />
            <Text className="text-xs font-bold text-primary">PDF</Text>
          </Pressable>
          <Pressable onPress={handleSend} disabled={sending} className="flex-row items-center gap-1.5 bg-primary px-3 py-2 rounded-lg">
            <MaterialCommunityIcons name="email" size={16} color="white" />
            <Text className="text-xs font-bold text-white">{sending ? "Sending..." : "Send"}</Text>
          </Pressable>
          <Pressable onPress={handleReturn} disabled={returning} className="flex-row items-center gap-1.5 bg-orange-500 px-3 py-2 rounded-lg">
            <MaterialCommunityIcons name="undo" size={16} color="white" />
            <Text className="text-xs font-bold text-white">{returning ? "..." : "Return"}</Text>
          </Pressable>
          <Pressable onPress={handleVoid} disabled={voiding} className="flex-row items-center gap-1.5 bg-red-500 px-3 py-2 rounded-lg">
            <MaterialCommunityIcons name="cancel" size={16} color="white" />
            <Text className="text-xs font-bold text-white">{voiding ? "..." : "Void"}</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );

  const renderB2bDetail = () => (
    <ScrollView>
      <Text className="text-sm text-on-surface-variant dark:text-text-secondary-dark mb-1" numberOfLines={1}>Customer: {detailInvoice.party?.name || "B2B Customer"}</Text>
      <Text className="text-lg font-black text-on-surface dark:text-text-primary-dark mb-4">₹{Number(detailInvoice.grandTotal || detailInvoice.grand_total).toLocaleString("en-IN")}</Text>

      <View className="border-t border-gray-100 dark:border-zinc-800 pt-4">
        <Text className="text-xs font-bold text-on-surface-variant dark:text-text-secondary-dark uppercase tracking-wider mb-2">Details</Text>
        <Text className="text-sm text-on-surface dark:text-text-primary-dark mb-1">Invoice: {detailInvoice.invoiceNumber || detailInvoice.invoice_number}</Text>
        <Text className="text-sm text-on-surface dark:text-text-primary-dark mb-1">Date: {formatDate(detailInvoice.date)}</Text>
        <Text className="text-sm text-on-surface dark:text-text-primary-dark mb-1">Status: {detailInvoice.paymentStatus || detailInvoice.payment_status || "N/A"}</Text>
      </View>

      <View className="border-t border-gray-100 dark:border-zinc-800 pt-4 mt-2">
        <Text className="text-xs font-bold text-on-surface-variant dark:text-text-secondary-dark uppercase tracking-wider mb-3">Actions</Text>
        <View className="flex-row flex-wrap" style={{ gap: 8 }}>
          <Pressable onPress={handleShare} className="flex-row items-center gap-1.5 bg-surface-container-lowest dark:bg-surface-dark border border-gray-200 dark:border-zinc-800 px-3 py-2 rounded-lg">
            <MaterialCommunityIcons name="share-variant" size={16} color={theme.colors.primary} />
            <Text className="text-xs font-bold text-primary">Share</Text>
          </Pressable>
          <Pressable onPress={handleDownloadPdf} className="flex-row items-center gap-1.5 bg-surface-container-lowest dark:bg-surface-dark border border-gray-200 dark:border-zinc-800 px-3 py-2 rounded-lg">
            <MaterialCommunityIcons name="file-pdf-box" size={16} color={theme.colors.primary} />
            <Text className="text-xs font-bold text-primary">PDF</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );

  const renderPurchaseDetail = () => (
    <ScrollView>
      <Text className="text-sm text-on-surface-variant dark:text-text-secondary-dark mb-1" numberOfLines={1}>Supplier: {detailInvoice.supplier?.name || detailInvoice.party?.name || "Supplier"}</Text>
      <Text className="text-lg font-black text-on-surface dark:text-text-primary-dark mb-4">₹{Number(detailInvoice.grandTotal || detailInvoice.grand_total).toLocaleString("en-IN")}</Text>

      <View className="border-t border-gray-100 dark:border-zinc-800 pt-4">
        <Text className="text-xs font-bold text-on-surface-variant dark:text-text-secondary-dark uppercase tracking-wider mb-2">Details</Text>
        <Text className="text-sm text-on-surface dark:text-text-primary-dark mb-1">Purchase #: {detailInvoice.purchaseNumber || detailInvoice.purchase_number}</Text>
        <Text className="text-sm text-on-surface dark:text-text-primary-dark mb-1">Date: {formatDate(detailInvoice.date)}</Text>
        {detailInvoice.warehouse?.name && (
          <Text className="text-sm text-on-surface dark:text-text-primary-dark mb-1">Warehouse: {detailInvoice.warehouse.name}</Text>
        )}
      </View>

      {detailInvoice.items && detailInvoice.items.length > 0 && (
        <View className="border-t border-gray-100 dark:border-zinc-800 pt-4 mt-2">
          <Text className="text-xs font-bold text-on-surface-variant dark:text-text-secondary-dark uppercase tracking-wider mb-3">Items</Text>
          {detailInvoice.items.map((item: any, idx: number) => (
            <View key={idx} className="flex-row justify-between py-1.5 border-b border-gray-50 dark:border-zinc-800/50">
              <Text className="text-sm text-on-surface dark:text-text-primary-dark flex-1 mr-2" numberOfLines={1}>{item.product?.name || item.name || `Item ${idx + 1}`}</Text>
              <Text className="text-sm font-bold text-on-surface dark:text-text-primary-dark shrink-0">
                {item.quantity || 0} × ₹{Number(item.rate || item.price || 0).toLocaleString("en-IN")}
              </Text>
            </View>
          ))}
        </View>
      )}

      <View className="border-t border-gray-100 dark:border-zinc-800 pt-4 mt-2">
        <Text className="text-xs font-bold text-on-surface-variant dark:text-text-secondary-dark uppercase tracking-wider mb-3">Actions</Text>
        <View className="flex-row flex-wrap" style={{ gap: 8 }}>
          <Pressable onPress={handleShare} className="flex-row items-center gap-1.5 bg-surface-container-lowest dark:bg-surface-dark border border-gray-200 dark:border-zinc-800 px-3 py-2 rounded-lg">
            <MaterialCommunityIcons name="share-variant" size={16} color={theme.colors.primary} />
            <Text className="text-xs font-bold text-primary">Share</Text>
          </Pressable>
          <Pressable onPress={handleDownloadPdf} className="flex-row items-center gap-1.5 bg-surface-container-lowest dark:bg-surface-dark border border-gray-200 dark:border-zinc-800 px-3 py-2 rounded-lg">
            <MaterialCommunityIcons name="file-pdf-box" size={16} color={theme.colors.primary} />
            <Text className="text-xs font-bold text-primary">PDF</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );

  return (
    <View className="flex-1 bg-background dark:bg-bg-dark" style={{ paddingTop: topInset }}>
      <View className="px-4 py-4 border-b border-gray-100 dark:border-zinc-800">
        <View className="flex-row items-center gap-3 mb-3">
          <Pressable onPress={() => router.back()}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={theme.colors.onSurfaceVariant} />
          </Pressable>
          <Text className="text-lg font-bold text-on-surface dark:text-text-primary-dark flex-1">Transaction History</Text>
          <Pressable onPress={() => {
            const data = activeTab === "sales" ? invoices : activeTab === "b2b" ? b2bInvoices : purchases;
            const headers = activeTab === "purchases" ? ["Purchase #", "Supplier", "Date", "Total"] : ["Invoice #", "Customer", "Date", "Total"];
            const rows = data.map((i: any) => [i.invoice_number || i.purchase_number, i.party?.name || i.supplier?.name || "—", new Date(i.date).toLocaleDateString("en-IN"), `₹${parseFloat(i.grand_total).toLocaleString("en-IN")}`]);
            shareDataAsPdf(activeTab === "sales" ? "Retail Invoices" : activeTab === "b2b" ? "B2B Invoices" : "Purchases", headers, rows, `${activeTab}.pdf`);
          }} className="flex-row items-center gap-1 bg-primary px-3 py-2 rounded-lg">
            <MaterialCommunityIcons name="file-pdf-box" size={14} color="white" />
            <Text className="text-xs font-bold text-white">Export</Text>
          </Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="gap-2">
          {TABS.map(renderTab)}
        </ScrollView>
      </View>

      <View className="px-4 py-2 border-b border-gray-100 dark:border-zinc-800" style={{ gap: 10 }}>
        <Searchbar
          placeholder="Search by invoice or party name"
          onChangeText={setSearchQuery}
          value={searchQuery}
          className="bg-surface-container-lowest dark:bg-surface-dark"
          elevation={1}
          inputStyle={{ fontSize: 14 }}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="gap-2">
          {["All", "paid", "unpaid", "overdue"].map((status) => (
            <Pressable
              key={status}
              onPress={() => setStatusFilter(status)}
              className={`py-1.5 px-3 rounded-full ${statusFilter === status ? "bg-primary" : "bg-surface-container-lowest dark:bg-surface-dark border border-gray-200 dark:border-zinc-700"}`}
            >
              <Text className={`text-xs font-bold ${statusFilter === status ? "text-white" : "text-on-surface-variant dark:text-text-secondary-dark"}`}>
                {status === "All" ? "All" : status.charAt(0).toUpperCase() + status.slice(1)}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : activeTab === "sales" ? (
        filteredInvoices.length === 0 ? (
          <View className="flex-1 items-center justify-center px-8">
            <MaterialCommunityIcons name="cash-register" size={48} color={theme.colors.outline} />
            <Text className="text-base font-bold text-on-surface dark:text-text-primary-dark mt-4">No Retail Invoices</Text>
            <Text className="text-sm text-on-surface-variant dark:text-text-secondary-dark text-center mt-2">Start selling at POS to register sales history.</Text>
          </View>
        ) : (
          <FlatList data={filteredInvoices} keyExtractor={(i) => i.id} renderItem={({ item }) => renderInvoiceItem(item)} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />} contentContainerStyle={{ paddingTop: 16, paddingBottom: 40 }} />
        )
      ) : activeTab === "b2b" ? (
        filteredB2bInvoices.length === 0 ? (
          <View className="flex-1 items-center justify-center px-8">
            <MaterialCommunityIcons name="briefcase-account" size={48} color={theme.colors.outline} />
            <Text className="text-base font-bold text-on-surface dark:text-text-primary-dark mt-4">No B2B Orders</Text>
            <Text className="text-sm text-on-surface-variant dark:text-text-secondary-dark text-center mt-2">Create B2B invoices from the B2B sales module.</Text>
          </View>
        ) : (
          <FlatList data={filteredB2bInvoices} keyExtractor={(i) => i.id} renderItem={({ item }) => renderB2bItem(item)} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />} contentContainerStyle={{ paddingTop: 16, paddingBottom: 40 }} />
        )
      ) : (
        filteredPurchases.length === 0 ? (
          <View className="flex-1 items-center justify-center px-8">
            <MaterialCommunityIcons name="truck-delivery" size={48} color={theme.colors.outline} />
            <Text className="text-base font-bold text-on-surface dark:text-text-primary-dark mt-4">No Purchases</Text>
            <Text className="text-sm text-on-surface-variant dark:text-text-secondary-dark text-center mt-2">Register purchase intakes in Inventory.</Text>
          </View>
        ) : (
          <FlatList data={filteredPurchases} keyExtractor={(i) => i.id} renderItem={({ item }) => renderPurchaseItem(item)} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />} contentContainerStyle={{ paddingTop: 16, paddingBottom: 40 }} />
        )
      )}

      <Modal visible={detailInvoiceId !== null} animationType="slide" transparent onRequestClose={() => setDetailInvoiceId(null)}>
        <View className="flex-1 justify-end bg-black/40">
          <View className="bg-background dark:bg-bg-dark rounded-t-3xl px-6 pt-6 pb-10" style={{ maxHeight: "80%" }}>
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-lg font-bold text-on-surface dark:text-text-primary-dark flex-1 mr-2" numberOfLines={1}>
                {detailInvoice?.invoiceNumber || detailInvoice?.invoice_number ||
                 detailInvoice?.purchaseNumber || detailInvoice?.purchase_number || "Detail"}
              </Text>
              <Pressable onPress={() => setDetailInvoiceId(null)}>
                <MaterialCommunityIcons name="close" size={20} color={theme.colors.onSurfaceVariant} />
              </Pressable>
            </View>

            {detailLoading || !detailInvoice ? (
              <ActivityIndicator color={theme.colors.primary} />
            ) : detailTab === "sales" ? (
              renderSalesDetail()
            ) : detailTab === "b2b" ? (
              renderB2bDetail()
            ) : (
              renderPurchaseDetail()
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}
