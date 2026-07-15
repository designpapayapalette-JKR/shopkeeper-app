import React, { useState, useEffect } from "react";
import {
  Text,
  View,
  ScrollView,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { api, ApiError } from "../src/lib/api";
import { useTopInset } from "../src/lib/useTopInset";
import { useBottomInset } from "../src/lib/useBottomInset";

interface Party {
  id: string;
  name: string;
}

interface Product {
  id: string;
  name: string;
  price: string;
  tax_rate?: string;
}

interface Warehouse {
  id: string;
  name: string;
}

interface Template {
  id: string;
  frequency: "weekly" | "monthly" | "quarterly" | "yearly";
  nextRunDate: string;
  isActive: boolean;
  party?: { name: string };
}

const FREQUENCIES = ["weekly", "monthly", "quarterly", "yearly"] as const;

export default function RecurringInvoicesScreen() {
  const topInset = useTopInset();
  const bottomInset = useBottomInset();

  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const [parties, setParties] = useState<Party[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [partyId, setPartyId] = useState<string | null>(null);
  const [warehouseId, setWarehouseId] = useState<string | null>(null);
  const [frequency, setFrequency] = useState<typeof FREQUENCIES[number]>("monthly");
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: Template[] }>("/recurring-invoices");
      setTemplates(res.data);
    } catch {
      Alert.alert("Error", "Could not load recurring invoices.");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const openForm = async () => {
    setShowForm(true);
    try {
      const [par, pr, wh] = await Promise.all([
        api.get<{ data: any[] }>("/parties", { params: { type: "customer" } }),
        api.get<{ data: Product[] }>("/products"),
        api.get<{ data: Warehouse[] }>("/warehouses"),
      ]);
      setParties(par.data.filter((p) => p.type === "customer"));
      setProducts(pr.data);
      setWarehouses(wh.data);
      if (wh.data.length > 0) setWarehouseId(wh.data[0].id);
    } catch {}
  };

  const submit = async () => {
    if (!partyId || !warehouseId || !selectedProductId) {
      Alert.alert("Required Fields", "Select a customer, warehouse, and product.");
      return;
    }
    const product = products.find((p) => p.id === selectedProductId);
    if (!product) return;
    setSubmitting(true);
    try {
      await api.post("/recurring-invoices", {
        partyId,
        warehouseId,
        frequency,
        nextRunDate: new Date().toISOString(),
        type: "gst",
        items: [{ productId: product.id, quantity: parseFloat(quantity) || 1, price: parseFloat(product.price), taxRate: product.tax_rate ? parseFloat(product.tax_rate) : 0, discount: 0 }],
      });
      setShowForm(false);
      setPartyId(null);
      setSelectedProductId(null);
      setQuantity("1");
      load();
    } catch (e) {
      Alert.alert("Error", e instanceof ApiError ? e.message : "Failed to create schedule.");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActive = async (t: Template) => {
    try {
      await api.patch(`/recurring-invoices/${t.id}`, { isActive: !t.isActive });
      load();
    } catch {
      Alert.alert("Error", "Failed to update.");
    }
  };

  return (
    <ScrollView className="flex-1 bg-background dark:bg-bg-dark px-4" style={{ paddingTop: topInset + 8 }}>
      <View className="flex-row justify-between items-center mb-4">
        <View className="flex-1 mr-2">
          <Text className="text-xl font-black text-text-primary">Recurring Invoices</Text>
          <Text className="text-sm text-text-secondary mt-0.5">Auto-generate on a repeating schedule.</Text>
        </View>
        <Pressable onPress={openForm} className="bg-primary px-4 py-3 rounded-xl flex-row items-center" style={{ gap: 6 }}>
          <MaterialCommunityIcons name="plus" size={16} color="white" />
          <Text className="text-white font-bold text-sm">New</Text>
        </Pressable>
      </View>

      {loading ? (
        <View className="py-10 items-center"><ActivityIndicator color="#0F7A5F" /></View>
      ) : templates.length === 0 ? (
        <View className="py-10 items-center">
          <Text className="text-sm text-text-secondary">No recurring invoices scheduled yet.</Text>
        </View>
      ) : (
        templates.map((t) => (
          <View key={t.id} className="bg-surface dark:bg-surface-dark p-4 rounded-xl border border-gray-100 dark:border-zinc-800 mb-3 flex-row justify-between items-center">
            <View className="flex-1 mr-2">
              <Text className="font-bold text-text-primary dark:text-text-primary-dark">{t.party?.name || "—"}</Text>
              <Text className="text-xs text-text-secondary capitalize mt-0.5">{t.frequency} · next {new Date(t.nextRunDate).toLocaleDateString("en-IN")}</Text>
            </View>
            <Pressable onPress={() => toggleActive(t)} className={`px-3 py-2 rounded-lg ${t.isActive ? "bg-success/10" : "bg-gray-100 dark:bg-zinc-800"}`}>
              <Text className={`text-xs font-bold ${t.isActive ? "text-success" : "text-text-secondary"}`}>{t.isActive ? "Active" : "Paused"}</Text>
            </Pressable>
          </View>
        ))
      )}

      <Modal visible={showForm} animationType="slide" onRequestClose={() => setShowForm(false)}>
        <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView className="flex-1 bg-background dark:bg-bg-dark px-6" style={{ paddingTop: topInset }} keyboardShouldPersistTaps="handled">
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-2xl font-bold text-on-surface dark:text-text-primary-dark">New Recurring Invoice</Text>
              <Pressable onPress={() => setShowForm(false)} className="w-11 h-11 items-center justify-center">
                <MaterialCommunityIcons name="close" size={20} color="#6B7280" />
              </Pressable>
            </View>

            <Text className="text-sm font-semibold text-on-surface-variant dark:text-text-secondary-dark uppercase tracking-wider mb-2">Customer</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row mb-4">
              {parties.map((p) => (
                <Pressable key={p.id} onPress={() => setPartyId(p.id)} className={`mr-2 px-4 py-3 rounded-lg border ${partyId === p.id ? "bg-primary border-primary" : "bg-surface border-gray-200 dark:border-zinc-800"}`}>
                  <Text className={`text-sm font-semibold ${partyId === p.id ? "text-white" : "text-text-secondary"}`}>{p.name}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <Text className="text-sm font-semibold text-on-surface-variant dark:text-text-secondary-dark uppercase tracking-wider mb-2">Frequency</Text>
            <View className="flex-row flex-wrap mb-4" style={{ gap: 8 }}>
              {FREQUENCIES.map((f) => (
                <Pressable key={f} onPress={() => setFrequency(f)} className={`px-4 py-2.5 rounded-lg border ${frequency === f ? "bg-primary border-primary" : "bg-surface border-gray-200 dark:border-zinc-800"}`}>
                  <Text className={`text-sm font-semibold capitalize ${frequency === f ? "text-white" : "text-text-secondary"}`}>{f}</Text>
                </Pressable>
              ))}
            </View>

            <Text className="text-sm font-semibold text-on-surface-variant dark:text-text-secondary-dark uppercase tracking-wider mb-2">Product</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row mb-4">
              {products.slice(0, 30).map((p) => (
                <Pressable key={p.id} onPress={() => setSelectedProductId(p.id)} className={`mr-2 px-4 py-3 rounded-lg border ${selectedProductId === p.id ? "bg-primary border-primary" : "bg-surface border-gray-200 dark:border-zinc-800"}`}>
                  <Text className={`text-sm font-semibold ${selectedProductId === p.id ? "text-white" : "text-text-secondary"}`}>{p.name} (₹{p.price})</Text>
                </Pressable>
              ))}
            </ScrollView>

            <Text className="text-sm font-semibold text-on-surface-variant dark:text-text-secondary-dark uppercase tracking-wider mb-2">Quantity</Text>
            <TextInput
              value={quantity}
              onChangeText={setQuantity}
              keyboardType="numeric"
              className="bg-surface dark:bg-surface-dark border border-gray-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-base font-bold text-text-primary mb-6 w-24 text-center"
            />

            <Pressable
              onPress={submit}
              disabled={submitting}
              className="bg-primary py-4 rounded-xl items-center"
              style={{ marginBottom: bottomInset + 16, opacity: submitting ? 0.5 : 1 }}
            >
              {submitting ? <ActivityIndicator color="white" /> : <Text className="text-white font-bold text-base">Create Schedule</Text>}
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>
  );
}
