import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, FlatList, ActivityIndicator, Pressable, Alert, TextInput, Modal, ScrollView, Platform, KeyboardAvoidingView } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { api, ApiError } from "../src/lib/api";
import { useConfirm } from "../src/components/ConfirmDialog";
import { useTopInset } from "../src/lib/useTopInset";
import { useBottomInset } from "../src/lib/useBottomInset";

interface TransferItem {
  id?: string;
  product_id: string;
  product_name?: string;
  quantity: number;
}

interface TransferRequest {
  id: string;
  from_warehouse_id: string;
  to_warehouse_id: string;
  status: string;
  notes: string | null;
  created_at: string;
  items?: TransferItem[];
}

interface Warehouse {
  id: string;
  name: string;
}

interface Product {
  id: string;
  name: string;
  sku: string;
}

const STATUSES = ["draft", "pending", "approved", "rejected", "completed"];

const STATUS_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  draft: { label: "Draft", color: "#6B7280", bg: "#F3F4F6" },
  pending: { label: "Pending", color: "#D97706", bg: "#FEF3C7" },
  approved: { label: "Approved", color: "#2563EB", bg: "#DBEAFE" },
  rejected: { label: "Rejected", color: "#DC2626", bg: "#FEE2E2" },
  completed: { label: "Completed", color: "#16A34A", bg: "#DCFCE7" },
};

export default function StockTransferRequestsScreen() {
  const topInset = useTopInset(); const bottomInset = useBottomInset();
  const confirm = useConfirm(); const router = useRouter();

  const [requests, setRequests] = useState<TransferRequest[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadTrigger, setLoadTrigger] = useState(0);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [showForm, setShowForm] = useState(false);
  const [showDetail, setShowDetail] = useState<string | null>(null);
  const [detailReq, setDetailReq] = useState<TransferRequest | null>(null);

  const [fromWarehouse, setFromWarehouse] = useState("");
  const [toWarehouse, setToWarehouse] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [transferItems, setTransferItems] = useState<TransferItem[]>([]);
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [reqRes, wRes, pRes] = await Promise.all([
        api.get<{ data: TransferRequest[] }>("/stock-transfer-requests"),
        api.get<{ data: Warehouse[] }>("/warehouses"),
        api.get<{ data: Product[] }>("/products?limit=200"),
      ]);
      setRequests(reqRes.data ?? []);
      setWarehouses(wRes.data ?? []);
      setProducts(pRes.data ?? []);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load, loadTrigger]);

  useEffect(() => {
    if (showDetail) {
      api.get<{ data: TransferRequest }>(`/stock-transfer-requests/${showDetail}`).then((r) => setDetailReq(r.data)).catch(() => {});
    } else { setDetailReq(null); }
  }, [showDetail]);

  const filtered = useMemo(() => {
    if (filterStatus === "all") return requests;
    return requests.filter((r) => r.status === filterStatus);
  }, [requests, filterStatus]);

  const whName = (id: string) => warehouses.find((w) => w.id === id)?.name || id;
  const whInitial = (id: string) => (whName(id).charAt(0) || "?").toUpperCase();

  const handleStatusChange = async (id: string, status: string) => {
    const label = status === "approved" ? "approve" : status === "rejected" ? "reject" : status === "completed" ? "mark completed" : status;
    const ok = await confirm({ title: `${label} this request?`, message: "This will update the transfer status.", confirmLabel: label, destructive: status === "rejected" });
    if (!ok) return;
    try {
      await api.patch(`/stock-transfer-requests/${id}`, { status });
      setLoadTrigger((n) => n + 1);
      setShowDetail(null);
    } catch (e) { Alert.alert("Error", e instanceof ApiError ? e.message : "Failed."); }
  };

  const addItem = (product: Product) => {
    if (transferItems.find((i) => i.product_id === product.id)) { Alert.alert("Already added"); return; }
    setTransferItems((prev) => [...prev, { product_id: product.id, product_name: product.name, quantity: 1 }]);
    setShowProductPicker(false);
  };

  const updateItemQty = (productId: string, qty: number) => {
    setTransferItems((prev) => prev.map((i) => i.product_id === productId ? { ...i, quantity: Math.max(1, qty) } : i));
  };

  const removeItem = async (productId: string) => {
    const ok = await confirm({ title: "Remove item?", message: "", confirmLabel: "Remove", destructive: true });
    if (ok) setTransferItems((prev) => prev.filter((i) => i.product_id !== productId));
  };

  const handleCreate = async () => {
    if (!fromWarehouse || !toWarehouse) { Alert.alert("Required", "Select both warehouses."); return; }
    if (fromWarehouse === toWarehouse) { Alert.alert("Error", "From and To warehouses must be different."); return; }
    if (transferItems.length === 0) { Alert.alert("Required", "Add at least one product."); return; }
    setSaving(true);
    try {
      await api.post("/stock-transfer-requests", { fromWarehouseId: fromWarehouse, toWarehouseId: toWarehouse, notes: formNotes || undefined, items: transferItems.map((i) => ({ productId: i.product_id, quantity: i.quantity })) });
      setShowForm(false); setFromWarehouse(""); setToWarehouse(""); setFormNotes(""); setTransferItems([]); setLoadTrigger((n) => n + 1);
    } catch (e) { Alert.alert("Error", e instanceof ApiError ? e.message : "Failed."); } finally { setSaving(false); }
  };

  const renderDetail = () => {
    if (!detailReq) return <ActivityIndicator />;
    const s = STATUS_STYLE[detailReq.status] || STATUS_STYLE.draft;
    return (
      <ScrollView className="flex-1 px-6 pb-10" style={{ paddingTop: topInset }}>
        <View className="flex-row justify-between items-center mb-6">
          <View>
            <Text className="text-2xl font-bold text-text-primary dark:text-text-primary-dark">Transfer #{detailReq.id.slice(0, 8)}</Text>
            <Text className="text-sm text-text-secondary dark:text-text-secondary-dark mt-0.5">
              {new Date(detailReq.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
            </Text>
          </View>
          <View style={{ backgroundColor: s.bg }} className="px-3 py-1.5 rounded-full">
            <Text style={{ color: s.color }} className="text-xs font-bold">{s.label}</Text>
          </View>
        </View>

        <View className="bg-surface dark:bg-surface-dark p-5 rounded-3xl border border-gray-100 dark:border-zinc-800 shadow-sm mb-4">
          <View className="flex-row items-center mb-4" style={{ gap: 8 }}>
            <View className="w-10 h-10 rounded-xl bg-primary/10 items-center justify-center">
              <MaterialCommunityIcons name="export-variant" size={18} color="#0368FE" />
            </View>
            <View className="flex-1">
              <Text className="text-xs font-semibold text-text-secondary uppercase tracking-wider">From</Text>
              <Text className="text-sm font-bold text-text-primary dark:text-text-primary-dark">{whName(detailReq.from_warehouse_id)}</Text>
            </View>
          </View>
          <View className="flex-row items-center" style={{ gap: 8 }}>
            <View className="w-10 h-10 rounded-xl bg-secondary/10 items-center justify-center">
              <MaterialCommunityIcons name="import" size={18} color="#835400" />
            </View>
            <View className="flex-1">
              <Text className="text-xs font-semibold text-text-secondary uppercase tracking-wider">To</Text>
              <Text className="text-sm font-bold text-text-primary dark:text-text-primary-dark">{whName(detailReq.to_warehouse_id)}</Text>
            </View>
          </View>
          {detailReq.notes && (
            <View className="mt-4 pt-4 border-t border-gray-100 dark:border-zinc-800">
              <Text className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">Notes</Text>
              <Text className="text-sm text-text-primary dark:text-text-primary-dark">{detailReq.notes}</Text>
            </View>
          )}
        </View>

        <View className="bg-surface dark:bg-surface-dark p-5 rounded-3xl border border-gray-100 dark:border-zinc-800 shadow-sm mb-4">
          <Text className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-3">Items ({detailReq.items?.length || 0})</Text>
          {detailReq.items?.map((item, idx) => (
            <View key={item.id || item.product_id}
              className={`flex-row justify-between items-center py-3 ${idx < (detailReq.items?.length || 0) - 1 ? "border-b border-gray-100 dark:border-zinc-800" : ""}`}>
              <Text className="text-sm font-medium text-text-primary dark:text-text-primary-dark flex-1 mr-2">{item.product_name || item.product_id}</Text>
              <Text className="text-sm font-bold text-text-primary dark:text-text-primary-dark">x{item.quantity}</Text>
            </View>
          ))}
        </View>

        {detailReq.status === "pending" && (
          <View className="flex-row mt-2" style={{ gap: 10 }}>
            <Pressable onPress={() => handleStatusChange(detailReq.id, "approved")}
              className="flex-1 bg-green-600 py-3.5 rounded-xl items-center active:opacity-80 shadow-sm">
              <View className="flex-row items-center" style={{ gap: 4 }}>
                <MaterialCommunityIcons name="check" size={16} color="white" />
                <Text className="text-white font-bold">Approve</Text>
              </View>
            </Pressable>
            <Pressable onPress={() => handleStatusChange(detailReq.id, "rejected")}
              className="flex-1 bg-red-500 py-3.5 rounded-xl items-center active:opacity-80 shadow-sm">
              <View className="flex-row items-center" style={{ gap: 4 }}>
                <MaterialCommunityIcons name="close" size={16} color="white" />
                <Text className="text-white font-bold">Reject</Text>
              </View>
            </Pressable>
          </View>
        )}
        {detailReq.status === "approved" && (
          <Pressable onPress={() => handleStatusChange(detailReq.id, "completed")}
            className="mt-4 bg-primary dark:bg-primary-dark py-3.5 rounded-xl items-center active:opacity-80 shadow-sm">
            <View className="flex-row items-center" style={{ gap: 4 }}>
              <MaterialCommunityIcons name="check-all" size={16} color="white" />
              <Text className="text-white font-bold">Mark Completed</Text>
            </View>
          </Pressable>
        )}
      </ScrollView>
    );
  };

  const renderItem = ({ item }: { item: TransferRequest }) => {
    const s = STATUS_STYLE[item.status] || STATUS_STYLE.draft;
    return (
      <Pressable onPress={() => setShowDetail(item.id)}
        className="bg-surface dark:bg-surface-dark p-4 rounded-2xl border border-gray-100 dark:border-zinc-800 mb-3 shadow-sm active:opacity-80">
        <View className="flex-row items-start">
          <View className="w-10 h-10 rounded-xl bg-primary/10 items-center justify-center mr-3">
            <MaterialCommunityIcons name="swap-horizontal" size={18} color="#0368FE" />
          </View>
          <View className="flex-1">
            <View className="flex-row items-center justify-between">
              <Text className="text-sm font-bold text-text-primary dark:text-text-primary-dark">#{item.id.slice(0, 8)}</Text>
              <View style={{ backgroundColor: s.bg }} className="px-2 py-0.5 rounded-full">
                <Text style={{ color: s.color }} className="text-xs font-bold">{s.label}</Text>
              </View>
            </View>
            <View className="flex-row items-center mt-1.5" style={{ gap: 4 }}>
              <Text className="text-xs text-text-secondary dark:text-text-secondary-dark flex-1" numberOfLines={1}>
                {whName(item.from_warehouse_id)} → {whName(item.to_warehouse_id)}
              </Text>
              <Text className="text-xs text-text-secondary dark:text-text-secondary-dark">
                {new Date(item.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
              </Text>
            </View>
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <View className="flex-1 bg-background dark:bg-background-dark" style={{ paddingTop: topInset }}>
      <View className="flex-row items-center justify-between px-6 py-4">
        <View className="flex-row items-center" style={{ gap: 8 }}>
          <Pressable onPress={() => router.back()} className="w-9 h-9 items-center justify-center active:opacity-70">
            <MaterialCommunityIcons name="arrow-left" size={22} color="#6B7280" />
          </Pressable>
          <Text className="text-xl font-bold text-text-primary dark:text-text-primary-dark">Stock Transfers</Text>
        </View>
        <Pressable onPress={() => setShowForm(true)} className="bg-primary px-4 py-2.5 rounded-xl flex-row items-center active:opacity-80" style={{ gap: 4 }}>
          <MaterialCommunityIcons name="plus" size={16} color="white" /><Text className="text-white font-bold text-sm">New</Text>
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-6 mb-3" contentContainerStyle={{ gap: 6 }}>
        {["all", ...STATUSES].map((s) => (
          <Pressable key={s} onPress={() => setFilterStatus(s)}
            className={`px-4 py-2.5 rounded-xl ${filterStatus === s ? "bg-primary" : "bg-surface dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800"}`}>
            <Text className={`text-sm font-bold capitalize ${filterStatus === s ? "text-white" : "text-text-secondary dark:text-text-secondary-dark"}`}>{s}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {loading ? <View className="flex-1 items-center justify-center"><ActivityIndicator size="large" color="#0368FE" /></View>
      : filtered.length === 0 ? (
        <View className="flex-1 items-center justify-center pb-20 px-6">
          <MaterialCommunityIcons name="swap-horizontal-bold" size={48} color="#D1D5DB" />
          <Text className="text-base font-bold text-text-secondary dark:text-text-secondary-dark mt-4">No transfer requests</Text>
          <Text className="text-sm text-text-secondary dark:text-text-secondary-dark mt-1 text-center">Create stock transfers between warehouses.</Text>
        </View>
      ) : (
        <FlatList data={filtered} keyExtractor={(item) => item.id} renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: bottomInset + 24 }} showsVerticalScrollIndicator={false} />
      )}

      <Modal visible={!!showDetail} animationType="slide" onRequestClose={() => setShowDetail(null)}>
        <SafeAreaProvider>
          <View className="flex-1 bg-background dark:bg-background-dark">
            <View className="flex-row items-center px-6 py-4">
              <Pressable onPress={() => setShowDetail(null)} className="w-9 h-9 items-center justify-center">
                <MaterialCommunityIcons name="arrow-left" size={22} color="#6B7280" />
              </Pressable>
            </View>
            {renderDetail()}
          </View>
        </SafeAreaProvider>
      </Modal>

      <Modal visible={showForm} animationType="slide" onRequestClose={() => setShowForm(false)}>
        <SafeAreaProvider>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1">
            <ScrollView className="flex-1 bg-background dark:bg-background-dark px-6 pb-10" style={{ paddingTop: topInset }}>
              <View className="flex-row justify-between items-center mb-6">
                <Text className="text-2xl font-bold text-text-primary dark:text-text-primary-dark">New Transfer</Text>
                <Pressable onPress={() => setShowForm(false)} className="w-11 h-11 items-center justify-center">
                  <MaterialCommunityIcons name="close" size={20} color="#6B7280" />
                </Pressable>
              </View>

              <View className="bg-surface dark:bg-surface-dark p-5 rounded-3xl border border-gray-100 dark:border-zinc-800 shadow-sm mb-4">
                <Text className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-3">From Warehouse</Text>
                <View className="flex-row flex-wrap" style={{ gap: 6 }}>
                  {warehouses.filter((w) => w.id !== toWarehouse).map((w) => (
                    <Pressable key={w.id} onPress={() => setFromWarehouse(w.id)}
                      className={`px-4 py-3 rounded-xl border ${fromWarehouse === w.id ? "bg-primary border-primary" : "bg-surface dark:bg-zinc-900 border-gray-200 dark:border-zinc-800"}`}>
                      <Text className={`text-sm font-bold ${fromWarehouse === w.id ? "text-white" : "text-text-primary dark:text-text-primary-dark"}`}>{w.name}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View className="bg-surface dark:bg-surface-dark p-5 rounded-3xl border border-gray-100 dark:border-zinc-800 shadow-sm mb-4">
                <Text className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-3">To Warehouse</Text>
                <View className="flex-row flex-wrap" style={{ gap: 6 }}>
                  {warehouses.filter((w) => w.id !== fromWarehouse).map((w) => (
                    <Pressable key={w.id} onPress={() => setToWarehouse(w.id)}
                      className={`px-4 py-3 rounded-xl border ${toWarehouse === w.id ? "bg-primary border-primary" : "bg-surface dark:bg-zinc-900 border-gray-200 dark:border-zinc-800"}`}>
                      <Text className={`text-sm font-bold ${toWarehouse === w.id ? "text-white" : "text-text-primary dark:text-text-primary-dark"}`}>{w.name}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View className="bg-surface dark:bg-surface-dark p-5 rounded-3xl border border-gray-100 dark:border-zinc-800 shadow-sm mb-4">
                <Text className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-3">Items</Text>
                <Pressable onPress={() => setShowProductPicker(true)}
                  className="flex-row items-center justify-center bg-primary/10 border border-dashed border-primary rounded-xl py-3.5 mb-3 active:opacity-70">
                  <MaterialCommunityIcons name="plus" size={16} color="#0368FE" />
                  <Text className="text-sm font-bold text-primary ml-1">Add Product</Text>
                </Pressable>
                {transferItems.length === 0 ? (
                  <Text className="text-sm text-text-secondary dark:text-text-secondary-dark text-center py-2">No items added yet</Text>
                ) : (
                  transferItems.map((item) => (
                    <View key={item.product_id} className="flex-row items-center justify-between py-3 border-b border-gray-100 dark:border-zinc-800">
                      <Text className="text-sm font-medium text-text-primary dark:text-text-primary-dark flex-1 mr-2">{item.product_name}</Text>
                      <View className="flex-row items-center" style={{ gap: 6 }}>
                        <Pressable onPress={() => updateItemQty(item.product_id, item.quantity - 1)}
                          className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-zinc-800 items-center justify-center active:opacity-70">
                          <MaterialCommunityIcons name="minus" size={14} color="#6B7280" />
                        </Pressable>
                        <Text className="text-sm font-bold w-6 text-center text-text-primary dark:text-text-primary-dark">{item.quantity}</Text>
                        <Pressable onPress={() => updateItemQty(item.product_id, item.quantity + 1)}
                          className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-zinc-800 items-center justify-center active:opacity-70">
                          <MaterialCommunityIcons name="plus" size={14} color="#6B7280" />
                        </Pressable>
                        <Pressable onPress={() => removeItem(item.product_id)} className="w-8 h-8 items-center justify-center">
                          <MaterialCommunityIcons name="trash-can-outline" size={16} color="#D64545" />
                        </Pressable>
                      </View>
                    </View>
                  ))
                )}
              </View>

              <View className="bg-surface dark:bg-surface-dark p-5 rounded-3xl border border-gray-100 dark:border-zinc-800 shadow-sm mb-4">
                <Text className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-2">Notes</Text>
                <TextInput value={formNotes} onChangeText={setFormNotes} placeholder="Optional notes about this transfer" placeholderTextColor="#A0A0A0" multiline numberOfLines={2}
                  className="bg-background dark:bg-zinc-900 text-text-primary dark:text-text-primary-dark border border-gray-200 dark:border-zinc-800 rounded-xl px-4 py-3 font-medium" />
              </View>

              <Pressable onPress={handleCreate} disabled={saving}
                className="bg-primary dark:bg-primary-dark py-4 rounded-xl items-center mt-2 shadow-sm" style={{ marginBottom: bottomInset }}>
                {saving ? <ActivityIndicator color="white" /> : <Text className="text-white font-bold">Create Transfer Request</Text>}
              </Pressable>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaProvider>
      </Modal>

      <Modal visible={showProductPicker} animationType="slide" onRequestClose={() => setShowProductPicker(false)}>
        <SafeAreaProvider>
          <View className="flex-1 bg-background dark:bg-background-dark" style={{ paddingTop: topInset }}>
            <View className="flex-row items-center justify-between px-6 py-4">
              <Text className="text-xl font-bold text-text-primary dark:text-text-primary-dark">Select Product</Text>
              <Pressable onPress={() => setShowProductPicker(false)} className="w-9 h-9 items-center justify-center">
                <MaterialCommunityIcons name="close" size={20} color="#6B7280" />
              </Pressable>
            </View>
            <FlatList data={products} keyExtractor={(p) => p.id}
              renderItem={({ item }) => (
                <Pressable onPress={() => addItem(item)} className="px-6 py-4 border-b border-gray-100 dark:border-zinc-800 active:bg-gray-50 dark:active:bg-zinc-800 flex-row items-center" style={{ gap: 12 }}>
                  <View className="w-10 h-10 rounded-lg bg-primary/10 items-center justify-center">
                    <MaterialCommunityIcons name="package-variant" size={18} color="#0368FE" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-bold text-text-primary dark:text-text-primary-dark">{item.name}</Text>
                    <Text className="text-xs text-text-secondary dark:text-text-secondary-dark">{item.sku}</Text>
                  </View>
                  <MaterialCommunityIcons name="plus-circle-outline" size={20} color="#0368FE" />
                </Pressable>
              )}
              contentContainerStyle={{ paddingBottom: bottomInset + 24 }} />
          </View>
        </SafeAreaProvider>
      </Modal>
    </View>
  );
}
