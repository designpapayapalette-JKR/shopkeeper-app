import React, { useCallback, useEffect, useState } from "react";
import { View, Text, FlatList, ActivityIndicator, Pressable, Alert, Modal, ScrollView } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../src/lib/api";
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
    <View className="bg-card border border-border rounded-2xl p-4 mx-4 mb-3">
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
    </View>
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
    </View>
  );
}