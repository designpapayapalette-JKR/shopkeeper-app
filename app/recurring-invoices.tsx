import React, { useState, useEffect, useCallback } from "react";
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
  RefreshControl,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useTheme } from "react-native-paper";
import { api, ApiError } from "../src/lib/api";
import { useTopInset } from "../src/lib/useTopInset";
import { useBottomInset } from "../src/lib/useBottomInset";
import DatePickerModal from "../src/components/DatePickerModal";

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

interface CartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  taxRate: number;
}

interface Template {
  id: string;
  party_id: string;
  warehouse_id: string;
  frequency: "weekly" | "monthly" | "quarterly" | "yearly";
  next_run_date: string;
  is_active: boolean;
  party?: { name: string };
  items?: { product_id: string; quantity: number; price: number; tax_rate: number; name?: string }[];
}

const FREQUENCIES = ["weekly", "monthly", "quarterly", "yearly"] as const;

export default function RecurringInvoicesScreen() {
  const theme = useTheme();
  const topInset = useTopInset();
  const bottomInset = useBottomInset();

  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [parties, setParties] = useState<Party[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [partyId, setPartyId] = useState<string | null>(null);
  const [warehouseId, setWarehouseId] = useState<string | null>(null);
  const [frequency, setFrequency] = useState<typeof FREQUENCIES[number]>("monthly");
  const [nextRunDate, setNextRunDate] = useState(new Date().toISOString().split("T")[0]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showProductPicker, setShowProductPicker] = useState(false);
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
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await load(); } finally { setRefreshing(false); }
  }, []);
  useEffect(() => { load(); }, []);

  const openForm = async () => {
    setEditingId(null);
    setPartyId(null);
    setWarehouseId(null);
    setFrequency("monthly");
    setNextRunDate(new Date().toISOString().split("T")[0]);
    setCart([]);
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
    } catch { Alert.alert("Error", "Failed to load form data."); }
  };

  const openEdit = async (t: Template) => {
    setEditingId(t.id);
    setPartyId(t.party_id);
    setWarehouseId(t.warehouse_id);
    setFrequency(t.frequency);
    setNextRunDate(t.next_run_date?.split("T")[0] || new Date().toISOString().split("T")[0]);
    setCart((t.items || []).map((i) => ({
      productId: i.product_id,
      name: i.name || "",
      price: i.price,
      quantity: i.quantity,
      taxRate: i.tax_rate,
    })));
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
    } catch { Alert.alert("Error", "Failed to load form data."); }
  };

  const addProductToCart = (product: Product) => {
    const existing = cart.findIndex((c) => c.productId === product.id);
    if (existing >= 0) {
      const updated = [...cart];
      updated[existing] = { ...updated[existing], quantity: updated[existing].quantity + 1 };
      setCart(updated);
    } else {
      setCart([...cart, {
        productId: product.id,
        name: product.name,
        price: parseFloat(product.price),
        quantity: 1,
        taxRate: product.tax_rate ? parseFloat(product.tax_rate) : 0,
      }]);
    }
    setShowProductPicker(false);
  };

  const updateCartQty = (index: number, qty: number) => {
    if (qty <= 0) {
      setCart(cart.filter((_, i) => i !== index));
      return;
    }
    const updated = [...cart];
    updated[index] = { ...updated[index], quantity: qty };
    setCart(updated);
  };

  const submit = async () => {
    if (!partyId || !warehouseId) {
      Alert.alert("Required Fields", "Select a customer and warehouse.");
      return;
    }
    if (cart.length === 0) {
      Alert.alert("Required Fields", "Add at least one product.");
      return;
    }
    setSubmitting(true);
    try {
      const body = {
        partyId,
        warehouseId,
        frequency,
        nextRunDate,
        type: "gst",
        items: cart.map((c) => ({ productId: c.productId, quantity: c.quantity, price: c.price, taxRate: c.taxRate, discount: 0 })),
      };
      if (editingId) {
        await api.patch(`/recurring-invoices/${editingId}`, body);
      } else {
        await api.post("/recurring-invoices", body);
      }
      setShowForm(false);
      load();
    } catch (e) {
      Alert.alert("Error", e instanceof ApiError ? e.message : `Failed to ${editingId ? "update" : "create"} schedule.`);
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActive = async (t: Template) => {
    try {
      await api.patch(`/recurring-invoices/${t.id}`, { isActive: !t.is_active });
      load();
    } catch {
      Alert.alert("Error", "Failed to update.");
    }
  };

  const totalItems = (items?: { quantity: number }[]) =>
    items?.reduce((s, i) => s + i.quantity, 0) || 0;

  return (
    <View className="flex-1 bg-background dark:bg-bg-dark" style={{ paddingTop: topInset + 8 }}>
      <View className="flex-row justify-between items-center px-4 mb-4">
        <View className="flex-row items-center gap-3 flex-1">
          <Pressable onPress={() => router.back()}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={theme.colors.primary} />
          </Pressable>
          <View className="flex-1 mr-2">
            <Text className="text-xl font-black text-on-surface dark:text-text-primary-dark">Recurring Invoices</Text>
            <Text className="text-sm text-on-surface-variant dark:text-text-secondary-dark mt-0.5">Auto-generate on a repeating schedule.</Text>
          </View>
        </View>
        <Pressable onPress={openForm} className="bg-primary px-4 py-3 rounded-xl flex-row items-center" style={{ gap: 6 }}>
          <MaterialCommunityIcons name="plus" size={16} color="white" />
          <Text className="text-white font-bold text-sm">New</Text>
        </Pressable>
      </View>

      <ScrollView className="flex-1 px-4" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        {loading ? (
          <View className="py-10 items-center"><ActivityIndicator color={theme.colors.primary} /></View>
        ) : templates.length === 0 ? (
          <View className="py-10 items-center">
            <MaterialCommunityIcons name="repeat" size={48} color={theme.colors.outlineVariant} />
            <Text className="text-base font-bold text-on-surface dark:text-text-primary-dark mt-4">No Recurring Invoices</Text>
            <Text className="text-sm text-on-surface-variant dark:text-text-secondary-dark text-center mt-2">Set up auto-repeating invoices for regular customers.</Text>
          </View>
        ) : (
          templates.map((t) => (
            <Pressable key={t.id} onPress={() => openEdit(t)} onLongPress={() => {
              Alert.alert("Delete", `Delete this recurring invoice?`, [
                { text: "Cancel", style: "cancel" },
                { text: "Delete", style: "destructive", onPress: async () => {
                  try { await api.delete(`/recurring-invoices/${t.id}`); load(); }
                  catch { Alert.alert("Error", "Failed to delete."); }
                }},
              ]);
            }} className="bg-surface-container-lowest dark:bg-surface-dark p-4 rounded-xl border border-outline-variant dark:border-zinc-800 mb-3">
              <View className="flex-row justify-between items-center mb-2">
                <Text className="font-bold text-on-surface dark:text-text-primary-dark flex-1 mr-2" numberOfLines={1}>{t.party?.name || "—"}</Text>
                <Pressable onPress={() => toggleActive(t)} className={`px-3 py-2 rounded-lg ${t.is_active ? "bg-success/10" : "bg-surface-container dark:bg-zinc-800"}`}>
                  <Text className={`text-xs font-bold ${t.is_active ? "text-success" : "text-on-surface-variant dark:text-text-secondary-dark"}`}>{t.is_active ? "Active" : "Paused"}</Text>
                </Pressable>
              </View>
              <View className="flex-row items-center gap-2">
                <Text className="text-xs text-on-surface-variant dark:text-text-secondary-dark capitalize">{t.frequency}</Text>
                <Text className="text-xs text-on-surface-variant dark:text-text-secondary-dark">·</Text>
                <Text className="text-xs text-on-surface-variant dark:text-text-secondary-dark">next {new Date(t.next_run_date).toLocaleDateString("en-IN")}</Text>
                <Text className="text-xs text-on-surface-variant dark:text-text-secondary-dark">·</Text>
                <Text className="text-xs text-on-surface-variant dark:text-text-secondary-dark">{totalItems(t.items)} items</Text>
              </View>
            </Pressable>
          ))
        )}
      </ScrollView>

      <Modal visible={showForm} animationType="slide" onRequestClose={() => setShowForm(false)}>
        <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView className="flex-1 bg-background dark:bg-bg-dark px-6" style={{ paddingTop: topInset }} keyboardShouldPersistTaps="handled">
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-2xl font-bold text-on-surface dark:text-text-primary-dark">
                {editingId ? "Edit Recurring Invoice" : "New Recurring Invoice"}
              </Text>
              <Pressable onPress={() => setShowForm(false)} className="w-11 h-11 items-center justify-center">
                <MaterialCommunityIcons name="close" size={20} color={theme.colors.onSurfaceVariant} />
              </Pressable>
            </View>

            <Text className="text-sm font-semibold text-on-surface-variant dark:text-text-secondary-dark uppercase tracking-wider mb-2">Customer</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row mb-4">
              {parties.map((p) => (
                <Pressable key={p.id} onPress={() => setPartyId(p.id)} className={`mr-2 px-4 py-3 rounded-lg border ${partyId === p.id ? "bg-primary border-primary" : "bg-surface-container-lowest dark:bg-surface-dark border-outline-variant dark:border-zinc-800"}`}>
                  <Text className={`text-sm font-semibold ${partyId === p.id ? "text-white" : "text-on-surface-variant dark:text-text-secondary-dark"}`}>{p.name}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <Text className="text-sm font-semibold text-on-surface-variant dark:text-text-secondary-dark uppercase tracking-wider mb-2">Frequency</Text>
            <View className="flex-row flex-wrap mb-4" style={{ gap: 8 }}>
              {FREQUENCIES.map((f) => (
                <Pressable key={f} onPress={() => setFrequency(f)} className={`px-4 py-2.5 rounded-lg border ${frequency === f ? "bg-primary border-primary" : "bg-surface-container-lowest dark:bg-surface-dark border-outline-variant dark:border-zinc-800"}`}>
                  <Text className={`text-sm font-semibold capitalize ${frequency === f ? "text-white" : "text-on-surface-variant dark:text-text-secondary-dark"}`}>{f}</Text>
                </Pressable>
              ))}
            </View>

            <Text className="text-sm font-semibold text-on-surface-variant dark:text-text-secondary-dark uppercase tracking-wider mb-2">Next Run Date</Text>
            <Pressable onPress={() => setShowDatePicker(true)} className="bg-surface-container-lowest dark:bg-surface-dark border border-outline-variant dark:border-zinc-800 rounded-xl px-4 py-3 mb-4 flex-row items-center justify-between">
              <Text className="text-base font-bold text-on-surface dark:text-text-primary-dark">{nextRunDate}</Text>
              <MaterialCommunityIcons name="calendar" size={20} color={theme.colors.primary} />
            </Pressable>

            <Text className="text-sm font-semibold text-on-surface-variant dark:text-text-secondary-dark uppercase tracking-wider mb-2">Products ({cart.length})</Text>
            {cart.map((item, idx) => (
              <View key={item.productId} className="bg-surface-container-lowest dark:bg-surface-dark border border-outline-variant dark:border-zinc-800 rounded-xl p-3 mb-2 flex-row items-center">
                <View className="flex-1 mr-2">
                  <Text className="text-sm font-bold text-on-surface dark:text-text-primary-dark" numberOfLines={1}>{item.name}</Text>
                  <Text className="text-xs text-on-surface-variant dark:text-text-secondary-dark mt-0.5">₹{item.price.toLocaleString("en-IN")} each</Text>
                </View>
                <View className="flex-row items-center gap-2">
                  <Pressable onPress={() => updateCartQty(idx, item.quantity - 1)} className="w-8 h-8 rounded-full bg-surface-container dark:bg-zinc-800 items-center justify-center">
                    <MaterialCommunityIcons name="minus" size={16} color={theme.colors.onSurfaceVariant} />
                  </Pressable>
                  <Text className="text-sm font-bold text-on-surface dark:text-text-primary-dark w-6 text-center">{item.quantity}</Text>
                  <Pressable onPress={() => updateCartQty(idx, item.quantity + 1)} className="w-8 h-8 rounded-full bg-surface-container dark:bg-zinc-800 items-center justify-center">
                    <MaterialCommunityIcons name="plus" size={16} color={theme.colors.onSurfaceVariant} />
                  </Pressable>
                </View>
              </View>
            ))}
            <Pressable onPress={() => setShowProductPicker(true)} className="bg-surface-container-lowest dark:bg-surface-dark border border-dashed border-outline-variant dark:border-zinc-700 rounded-xl p-3 mb-4 items-center">
              <MaterialCommunityIcons name="plus" size={20} color={theme.colors.primary} />
              <Text className="text-xs font-bold text-primary mt-1">Add Product</Text>
            </Pressable>

            <Pressable
              onPress={submit}
              disabled={submitting}
              className="bg-primary py-4 rounded-xl items-center"
              style={{ marginBottom: bottomInset + 16, opacity: submitting ? 0.5 : 1 }}
            >
              {submitting ? <ActivityIndicator color="white" /> : <Text className="text-white font-bold text-base">{editingId ? "Update Schedule" : "Create Schedule"}</Text>}
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={showProductPicker} transparent animationType="fade" onRequestClose={() => setShowProductPicker(false)}>
        <Pressable className="flex-1 bg-black/40 justify-center px-6" onPress={() => setShowProductPicker(false)}>
          <Pressable className="bg-background dark:bg-bg-dark rounded-2xl p-4 max-h-96" onPress={() => {}}>
            <Text className="text-lg font-bold text-on-surface dark:text-text-primary-dark mb-3">Select Product</Text>
            <ScrollView>
              {products.slice(0, 50).map((p) => (
                <Pressable key={p.id} onPress={() => addProductToCart(p)} className="py-3 border-b border-outline-variant dark:border-zinc-800 flex-row justify-between">
                  <Text className="text-sm font-semibold text-on-surface dark:text-text-primary-dark flex-1 mr-2" numberOfLines={1}>{p.name}</Text>
                  <Text className="text-sm font-bold text-primary">₹{p.price}</Text>
                </Pressable>
              ))}
              {products.length === 0 && (
                <Text className="text-sm text-on-surface-variant dark:text-text-secondary-dark text-center py-4">No products found.</Text>
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <DatePickerModal
        visible={showDatePicker}
        onConfirm={(date: Date) => { setNextRunDate(date.toISOString().split("T")[0]); setShowDatePicker(false); }}
        onDismiss={() => setShowDatePicker(false)}
      />
    </View>
  );
}
