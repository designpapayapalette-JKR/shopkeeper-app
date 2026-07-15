import React, { useCallback, useEffect, useState } from "react";
import { View, Text, FlatList, ActivityIndicator, Pressable, Alert, Modal, ScrollView, TextInput } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, ApiError } from "../src/lib/api";
import { useTopInset } from "../src/lib/useTopInset";

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
  party?: { name: string };
}

interface PurchaseSummary {
  id: string;
  purchase_number: string;
  date: string;
  grand_total: string;
  supplier?: { name: string };
  warehouse?: { name: string };
}

const TABS: { key: HistoryTab; label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }[] = [
  { key: "sales", label: "Retail Sales", icon: "cash-register" },
  { key: "b2b", label: "B2B Orders", icon: "briefcase-account" },
  { key: "purchases", label: "Purchases", icon: "truck-delivery" },
];

export default function InvoiceHistoryScreen() {
  const topInset = useTopInset();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<HistoryTab>("sales");
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<InvoiceSummary[]>([]);
  const [b2bInvoices, setB2bInvoices] = useState<B2BInvoiceSummary[]>([]);
  const [purchases, setPurchases] = useState<PurchaseSummary[]>([]);

  const [detailInvoiceId, setDetailInvoiceId] = useState<string | null>(null);
  const [detailInvoice, setDetailInvoice] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showEwbForm, setShowEwbForm] = useState(false);
  const [ewbNumber, setEwbNumber] = useState("");
  const [ewbSubmitting, setEwbSubmitting] = useState(false);
  const [showEInvForm, setShowEInvForm] = useState(false);
  const [einvIrn, setEinvIrn] = useState("");
  const [einvSubmitting, setEinvSubmitting] = useState(false);

  const openDetail = async (id: string) => {
    setDetailInvoiceId(id);
    setDetailLoading(true);
    setShowEwbForm(false);
    setShowEInvForm(false);
    try {
      const res = await api.get<{ data: any }>(`/invoices/${id}/detail`);
      setDetailInvoice(res.data);
    } catch {
      Alert.alert("Error", "Could not load invoice detail.");
    } finally {
      setDetailLoading(false);
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

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")}/${d.getFullYear()}`;
  };

  const renderTab = (tab: typeof TABS[0]) => (
    <Pressable
      key={tab.key}
      onPress={() => setActiveTab(tab.key)}
      className={`py-3 px-4 rounded-full flex-row items-center gap-2 ${activeTab === tab.key ? "bg-primary" : "bg-surface-2"}`}
    >
      <MaterialCommunityIcons name={tab.icon} size={18} color={activeTab === tab.key ? "#fff" : "#666"} />
      <Text className={`text-xs font-bold ${activeTab === tab.key ? "text-white" : "text-text-secondary"}`}>{tab.label}</Text>
    </Pressable>
  );

  const renderInvoiceItem = (item: InvoiceSummary) => (
    <Pressable onPress={() => openDetail(item.id)} className="bg-card border border-border rounded-2xl p-4 mx-4 mb-3">
      <View className="flex-row justify-between items-center mb-2">
        <Text className="font-mono text-sm font-bold text-foreground">{item.invoice_number}</Text>
        <Text className={`badge ${item.type === "gst" ? "badge-blue" : item.type === "retail" ? "badge-neutral" : "badge-amber"}`}>
          {item.type?.toUpperCase()}
        </Text>
      </View>
      <View className="flex-row justify-between items-center">
        <View>
          <Text className="text-xs text-text-secondary">{item.party?.name || "Walk-in Customer"}</Text>
          <Text className="text-xs text-text-secondary mt-0.5">{formatDate(item.date)}</Text>
        </View>
        <Text className="text-base font-bold text-foreground">₹{parseFloat(item.grand_total).toLocaleString("en-IN")}</Text>
      </View>
    </Pressable>
  );

  const renderB2bItem = (item: B2BInvoiceSummary) => (
    <View className="bg-card border border-border rounded-2xl p-4 mx-4 mb-3">
      <View className="flex-row justify-between items-center mb-2">
        <Text className="font-mono text-sm font-bold text-foreground">{item.invoice_number}</Text>
        <Text className="badge badge-blue">B2B</Text>
      </View>
      <View className="flex-row justify-between items-center">
        <View>
          <Text className="text-xs text-text-secondary">{item.party?.name || "B2B Customer"}</Text>
          <Text className="text-xs text-text-secondary mt-0.5">{formatDate(item.date)}</Text>
        </View>
        <Text className="text-base font-bold text-foreground">₹{parseFloat(item.grand_total).toLocaleString("en-IN")}</Text>
      </View>
    </View>
  );

  const renderPurchaseItem = (item: PurchaseSummary) => (
    <View className="bg-card border border-border rounded-2xl p-4 mx-4 mb-3">
      <View className="flex-row justify-between items-center mb-2">
        <Text className="font-mono text-sm font-bold text-foreground">{item.purchase_number}</Text>
        <MaterialCommunityIcons name="truck-delivery" size={18} color="#0F7A5F" />
      </View>
      <View className="flex-row justify-between items-center">
        <View>
          <Text className="text-xs text-text-secondary">{item.supplier?.name || "Supplier"}</Text>
          <Text className="text-xs text-text-secondary mt-0.5">{item.warehouse?.name} • {formatDate(item.date)}</Text>
        </View>
        <Text className="text-base font-bold text-foreground">₹{parseFloat(item.grand_total).toLocaleString("en-IN")}</Text>
      </View>
    </View>
  );

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: topInset }}>
      <View className="px-4 py-4 border-b border-border">
        <View className="flex-row items-center gap-3 mb-3">
          <Pressable onPress={() => router.back()}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="#333" />
          </Pressable>
          <Text className="text-lg font-bold text-foreground">Transaction History</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="gap-2">
          {TABS.map(renderTab)}
        </ScrollView>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#0F7A5F" />
        </View>
      ) : activeTab === "sales" ? (
        invoices.length === 0 ? (
          <View className="flex-1 items-center justify-center px-8">
            <MaterialCommunityIcons name="cash-register" size={48} color="#ccc" />
            <Text className="text-base font-bold text-foreground mt-4">No Retail Invoices</Text>
            <Text className="text-sm text-text-secondary text-center mt-2">Start selling at POS to register sales history.</Text>
          </View>
        ) : (
          <FlatList data={invoices} keyExtractor={(i) => i.id} renderItem={({ item }) => renderInvoiceItem(item)} contentContainerStyle={{ paddingTop: 16, paddingBottom: 40 }} />
        )
      ) : activeTab === "b2b" ? (
        b2bInvoices.length === 0 ? (
          <View className="flex-1 items-center justify-center px-8">
            <MaterialCommunityIcons name="briefcase-account" size={48} color="#ccc" />
            <Text className="text-base font-bold text-foreground mt-4">No B2B Orders</Text>
            <Text className="text-sm text-text-secondary text-center mt-2">Create B2B invoices from the B2B sales module.</Text>
          </View>
        ) : (
          <FlatList data={b2bInvoices} keyExtractor={(i) => i.id} renderItem={({ item }) => renderB2bItem(item)} contentContainerStyle={{ paddingTop: 16, paddingBottom: 40 }} />
        )
      ) : (
        purchases.length === 0 ? (
          <View className="flex-1 items-center justify-center px-8">
            <MaterialCommunityIcons name="truck-delivery" size={48} color="#ccc" />
            <Text className="text-base font-bold text-foreground mt-4">No Purchases</Text>
            <Text className="text-sm text-text-secondary text-center mt-2">Register purchase intakes in Inventory.</Text>
          </View>
        ) : (
          <FlatList data={purchases} keyExtractor={(i) => i.id} renderItem={({ item }) => renderPurchaseItem(item)} contentContainerStyle={{ paddingTop: 16, paddingBottom: 40 }} />
        )
      )}

      <Modal visible={detailInvoiceId !== null} animationType="slide" transparent onRequestClose={() => setDetailInvoiceId(null)}>
        <View className="flex-1 justify-end bg-black/40">
          <View className="bg-background dark:bg-bg-dark rounded-t-3xl px-6 pt-6 pb-10" style={{ maxHeight: "80%" }}>
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-lg font-bold text-foreground flex-1 mr-2">
                {detailInvoice?.invoiceNumber || "Invoice"}
              </Text>
              <Pressable onPress={() => setDetailInvoiceId(null)}>
                <MaterialCommunityIcons name="close" size={20} color="#6B7280" />
              </Pressable>
            </View>

            {detailLoading || !detailInvoice ? (
              <ActivityIndicator color="#0F7A5F" />
            ) : (
              <ScrollView>
                <Text className="text-sm text-text-secondary mb-1">Customer: {detailInvoice.party?.name || "Walk-in Customer"}</Text>
                <Text className="text-lg font-black text-foreground mb-4">₹{Number(detailInvoice.grandTotal).toLocaleString("en-IN")}</Text>

                {/* e-Way Bill / e-Invoice — manual record only, no live NIC/GSP
                    API call. Generate on the government portal / via your GSP,
                    then log the resulting number here for reference. */}
                <View className="border-t border-border pt-4">
                  <Text className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-1">e-Way Bill</Text>
                  {detailInvoice.ewayBill ? (
                    <Text className="text-sm text-foreground mb-3">EWB {detailInvoice.ewayBill.ewbNumber} — {detailInvoice.ewayBill.status}</Text>
                  ) : showEwbForm ? (
                    <View className="mb-4">
                      <TextInput
                        value={ewbNumber}
                        onChangeText={setEwbNumber}
                        placeholder="e-Way bill number (from portal)"
                        placeholderTextColor="#A0A0A0"
                        className="bg-surface border border-border rounded-xl px-3 py-2.5 text-sm font-medium text-foreground mb-2"
                      />
                      <View className="flex-row" style={{ gap: 8 }}>
                        <Pressable onPress={recordEwayBill} disabled={ewbSubmitting || !ewbNumber.trim()} className="bg-primary px-4 py-2 rounded-lg">
                          {ewbSubmitting ? <ActivityIndicator color="white" size="small" /> : <Text className="text-white font-bold text-xs">Save</Text>}
                        </Pressable>
                        <Pressable onPress={() => setShowEwbForm(false)} className="px-4 py-2 rounded-lg border border-border">
                          <Text className="text-text-secondary font-bold text-xs">Cancel</Text>
                        </Pressable>
                      </View>
                    </View>
                  ) : (
                    <Pressable onPress={() => setShowEwbForm(true)} className="mb-4">
                      <Text className="text-primary font-bold text-sm">+ Record e-Way Bill</Text>
                    </Pressable>
                  )}

                  <Text className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-1">e-Invoice (IRN)</Text>
                  {detailInvoice.eInvoice ? (
                    <Text className="text-sm text-foreground mb-1" numberOfLines={2}>IRN {detailInvoice.eInvoice.irn} — {detailInvoice.eInvoice.status}</Text>
                  ) : showEInvForm ? (
                    <View>
                      <TextInput
                        value={einvIrn}
                        onChangeText={setEinvIrn}
                        placeholder="IRN (from your GSP)"
                        placeholderTextColor="#A0A0A0"
                        className="bg-surface border border-border rounded-xl px-3 py-2.5 text-sm font-medium text-foreground mb-2"
                      />
                      <View className="flex-row" style={{ gap: 8 }}>
                        <Pressable onPress={recordEInvoice} disabled={einvSubmitting || !einvIrn.trim()} className="bg-primary px-4 py-2 rounded-lg">
                          {einvSubmitting ? <ActivityIndicator color="white" size="small" /> : <Text className="text-white font-bold text-xs">Save</Text>}
                        </Pressable>
                        <Pressable onPress={() => setShowEInvForm(false)} className="px-4 py-2 rounded-lg border border-border">
                          <Text className="text-text-secondary font-bold text-xs">Cancel</Text>
                        </Pressable>
                      </View>
                    </View>
                  ) : (
                    <Pressable onPress={() => setShowEInvForm(true)}>
                      <Text className="text-primary font-bold text-sm">+ Record e-Invoice</Text>
                    </Pressable>
                  )}
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}