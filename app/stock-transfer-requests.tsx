import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, FlatList, ActivityIndicator, Pressable, Alert, TextInput, Modal, ScrollView, Platform, KeyboardAvoidingView, RefreshControl } from "react-native";
import { Text } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { api, ApiError } from "../src/lib/api";
import { useConfirm } from "../src/components/ConfirmDialog";
import { useTopInset } from "../src/lib/useTopInset";
import { useBottomInset } from "../src/lib/useBottomInset";
import { useTheme } from "react-native-paper";
import EmptyState from "../src/components/EmptyState";

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
 const theme = useTheme();

 const [requests, setRequests] = useState<any[]>([]);
 const [warehouses, setWarehouses] = useState<any[]>([]);
 const [products, setProducts] = useState<any[]>([]);
 const [loading, setLoading] = useState(true);
 const [refreshing, setRefreshing] = useState(false);
 const [loadTrigger, setLoadTrigger] = useState(0);
 const [filterStatus, setFilterStatus] = useState("all");
 const [showForm, setShowForm] = useState(false);
 const [showDetail, setShowDetail] = useState<string | null>(null);
 const [detailReq, setDetailReq] = useState<any | null>(null);

 const [fromWh, setFromWh] = useState("");
 const [toWh, setToWh] = useState("");
 const [formNotes, setFormNotes] = useState("");
 const [items, setItems] = useState<any[]>([]);
 const [showPicker, setShowPicker] = useState(false);
 const [saving, setSaving] = useState(false);

 const load = useCallback(async () => {
 setLoading(true);
 try {
 const [rr, wr, pr] = await Promise.all([
 api.get<{ data: any[] }>("/stock-transfer-requests"),
 api.get<{ data: any[] }>("/warehouses"),
 api.get<{ data: any[] }>("/products?limit=200"),
 ]);
 setRequests(rr.data ?? []);
 setWarehouses(wr.data ?? []);
 setProducts(pr.data ?? []);
 } catch {} finally { setLoading(false); }
 }, []);

 const onRefresh = useCallback(async () => {
 setRefreshing(true);
 try { await load(); } finally { setRefreshing(false); }
 }, [load]);

 useEffect(() => { load(); }, [load, loadTrigger]);
 useEffect(() => {
 if (showDetail) {
 api.get<{ data: any }>(`/stock-transfer-requests/${showDetail}`).then((r) => setDetailReq(r.data)).catch(() => {});
 } else setDetailReq(null);
 }, [showDetail]);

 const filtered = useMemo(() => {
 if (filterStatus === "all") return requests;
 return requests.filter((r) => r.status === filterStatus);
 }, [requests, filterStatus]);

 const whName = (id: string) => warehouses.find((w) => w.id === id)?.name || id;

 const handleStatus = async (id: string, status: string) => {
 const label = status === "approved" ? "approve" : status === "rejected" ? "reject" : status === "completed" ? "mark completed" : status;
 const ok = await confirm({ title: `${label} this request?`, message: "This will update the transfer status.", confirmLabel: label, destructive: status === "rejected" });
 if (!ok) return;
 try {
 await api.patch(`/stock-transfer-requests/${id}`, { status });
 setLoadTrigger((n) => n + 1);
 setShowDetail(null);
 } catch (e) { Alert.alert("Error", e instanceof ApiError ? e.message : "Failed."); }
 };

 const pickProduct = (product: any) => {
 if (items.find((i) => i.product_id === product.id)) { Alert.alert("Already added"); return; }
 setItems((prev) => [...prev, { product_id: product.id, product_name: product.name, quantity: 1 }]);
 setShowPicker(false);
 };

 const updateQty = (productId: string, qty: number) => {
 setItems((prev) => prev.map((i) => i.product_id === productId ? { ...i, quantity: Math.max(1, qty) } : i));
 };

 const removeItem = async (productId: string) => {
 const ok = await confirm({ title: "Remove item?", message: "", confirmLabel: "Remove", destructive: true });
 if (ok) setItems((prev) => prev.filter((i) => i.product_id !== productId));
 };

 const handleCreate = async () => {
 if (!fromWh || !toWh) { Alert.alert("Required", "Select both warehouses."); return; }
 if (fromWh === toWh) { Alert.alert("Error", "From and To warehouses must be different."); return; }
 if (items.length === 0) { Alert.alert("Required", "Add at least one product."); return; }
 setSaving(true);
 try {
 await api.post("/stock-transfer-requests", {
 fromWarehouseId: fromWh, toWarehouseId: toWh, notes: formNotes || undefined,
 items: items.map((i) => ({ productId: i.product_id, quantity: i.quantity })),
 });
 setShowForm(false); setFromWh(""); setToWh(""); setFormNotes(""); setItems([]); setLoadTrigger((n) => n + 1);
 } catch (e) { Alert.alert("Error", e instanceof ApiError ? e.message : "Failed."); } finally { setSaving(false); }
 };

 const renderDetail = () => {
 if (!detailReq) return <ActivityIndicator />;
 const s = STATUS_STYLE[detailReq.status] || STATUS_STYLE.draft;
 return (
 <ScrollView className="flex-1 px-5 pb-10" style={{ paddingTop: topInset }}>
 <View className="flex-row justify-between items-start mb-5">
 <View>
 <Text className="font-headline-md text-on-surface" style={{ fontSize: 20, fontWeight: "700" }}>Transfer #{detailReq.id.slice(0, 8)}</Text>
 <Text className="text-xs text-on-surface-variant mt-0.5">{new Date(detailReq.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</Text>
 </View>
 <View style={{ backgroundColor: s.bg }} className="px-3 py-1.5 rounded-full"><Text style={{ color: s.color }} className="text-xs font-bold">{s.label}</Text></View>
 </View>

 <View className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant mb-4">
 <View className="flex-row items-center mb-4" style={{ gap: 8 }}>
 <View className="w-10 h-10 rounded-xl bg-primary/10 items-center justify-center">
 <MaterialCommunityIcons name="export-variant" size={18} color={theme.colors.primary} />
 </View>
 <View className="flex-1">
 <Text className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">From</Text>
 <Text className="text-sm font-bold text-on-surface">{whName(detailReq.from_warehouse_id)}</Text>
 </View>
 </View>
 <View className="flex-row items-center" style={{ gap: 8 }}>
 <View className="w-10 h-10 rounded-xl bg-secondary/10 items-center justify-center">
 <MaterialCommunityIcons name="import" size={18} color="#835400" />
 </View>
 <View className="flex-1">
 <Text className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">To</Text>
 <Text className="text-sm font-bold text-on-surface">{whName(detailReq.to_warehouse_id)}</Text>
 </View>
 </View>
 {detailReq.notes && (
 <View className="mt-4 pt-4 border-t border-outline-variant">
 <Text className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1">Notes</Text>
 <Text className="text-sm text-on-surface">{detailReq.notes}</Text>
 </View>
 )}
 </View>

 <View className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant mb-4">
 <Text className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-3">Items ({detailReq.items?.length || 0})</Text>
 {detailReq.items?.map((item: any, idx: number) => (
 <View key={item.id || item.product_id}
 className={`flex-row justify-between items-center py-3 ${idx < (detailReq.items?.length || 0) - 1 ? "border-b border-outline-variant" : ""}`}>
 <Text className="text-sm font-medium text-on-surface flex-1 mr-2">{item.product_name || item.product_id}</Text>
 <Text className="text-sm font-bold text-on-surface">x{item.quantity}</Text>
 </View>
 ))}
 </View>

 {detailReq.status === "pending" && (
 <View className="flex-row mt-2" style={{ gap: 10 }}>
 <Pressable onPress={() => handleStatus(detailReq.id, "approved")}
 className="flex-1 bg-success py-3.5 rounded-xl items-center" style={{ gap: 4 }}>
 <MaterialCommunityIcons name="check" size={16} color="white" />
 <Text className="text-white font-bold">Approve</Text>
 </Pressable>
 <Pressable onPress={() => handleStatus(detailReq.id, "rejected")}
 className="flex-1 bg-error py-3.5 rounded-xl items-center" style={{ gap: 4 }}>
 <MaterialCommunityIcons name="close" size={16} color="white" />
 <Text className="text-white font-bold">Reject</Text>
 </Pressable>
 </View>
 )}
 {detailReq.status === "approved" && (
 <Pressable onPress={() => handleStatus(detailReq.id, "completed")}
 className="mt-4 bg-primary py-3.5 rounded-xl items-center" style={{ gap: 4 }}>
 <MaterialCommunityIcons name="check-all" size={16} color="white" />
 <Text className="text-white font-bold">Mark Completed</Text>
 </Pressable>
 )}
 </ScrollView>
 );
 };

 const renderItem = ({ item }: { item: any }) => {
 const s = STATUS_STYLE[item.status] || STATUS_STYLE.draft;
 return (
 <Pressable onPress={() => setShowDetail(item.id)}
 className="bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant mb-3">
 <View className="flex-row items-start">
 <View className="w-10 h-10 rounded-xl bg-primary/10 items-center justify-center mr-3">
 <MaterialCommunityIcons name="swap-horizontal" size={18} color={theme.colors.primary} />
 </View>
 <View className="flex-1">
 <View className="flex-row items-center justify-between">
 <Text className="text-sm font-bold text-on-surface">#{item.id.slice(0, 8)}</Text>
 <View style={{ backgroundColor: s.bg }} className="px-2 py-0.5 rounded-full">
 <Text style={{ color: s.color }} className="text-xs font-bold">{s.label}</Text>
 </View>
 </View>
 <View className="flex-row items-center mt-1.5" style={{ gap: 4 }}>
 <Text className="text-xs text-on-surface-variant flex-1" numberOfLines={1}>
 {whName(item.from_warehouse_id)} → {whName(item.to_warehouse_id)}
 </Text>
 <Text className="text-xs text-on-surface-variant">
 {new Date(item.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
 </Text>
 </View>
 </View>
 </View>
 </Pressable>
 );
 };

 return (
 <View className="flex-1 bg-background" style={{ paddingTop: topInset }}>
 {/* Header */}
 <View className="flex-row items-center justify-between px-5 py-4">
 <View className="flex-row items-center" style={{ gap: 8 }}>
 <Pressable onPress={() => router.back()} className="w-9 h-9 items-center justify-center">
 <MaterialCommunityIcons name="arrow-left" size={22} color={theme.colors.onSurfaceVariant} />
 </Pressable>
 <Text className="font-headline-md text-on-surface" style={{ fontSize: 20, fontWeight: "700" }}>Stock Transfers</Text>
 </View>
 <Pressable onPress={() => setShowForm(true)} className="bg-primary px-4 py-2.5 rounded-xl flex-row items-center" style={{ gap: 4 }}>
 <MaterialCommunityIcons name="plus" size={16} color="white" /><Text className="text-white font-bold text-sm">New</Text>
 </Pressable>
 </View>

 {/* Filter chips */}
 <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-5 mb-3" contentContainerStyle={{ gap: 6 }}>
 {["all", ...STATUSES].map((s) => (
 <Pressable key={s} onPress={() => setFilterStatus(s)}
 className={`rounded-xl px-4 py-2.5 ${filterStatus === s ? "bg-primary" : "bg-surface-container-lowest border border-outline-variant"}`}>
 <Text className={`text-xs font-bold capitalize ${filterStatus === s ? "text-white" : "text-on-surface"}`}>{s}</Text>
 </Pressable>
 ))}
 </ScrollView>

 {loading ? (
 <View className="flex-1 items-center justify-center"><ActivityIndicator size="large" color={theme.colors.primary} /></View>
 ) : filtered.length === 0 ? (
 <EmptyState icon="swap-horizontal-bold" title="No transfer requests" description="Create stock transfers between warehouses." />
 ) : (
 <FlatList data={filtered} keyExtractor={(item) => item.id} renderItem={renderItem}
 refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
 contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: bottomInset + 24 }} showsVerticalScrollIndicator={false} />
 )}

 {/* Detail modal */}
 <Modal visible={!!showDetail} animationType="slide" onRequestClose={() => setShowDetail(null)}>
 <SafeAreaProvider>
 <View className="flex-1 bg-background">
 <View className="flex-row items-center px-5 py-4">
 <Pressable onPress={() => setShowDetail(null)} className="w-9 h-9 items-center justify-center">
 <MaterialCommunityIcons name="arrow-left" size={22} color={theme.colors.onSurfaceVariant} />
 </Pressable>
 </View>
 {renderDetail()}
 </View>
 </SafeAreaProvider>
 </Modal>

 {/* Form modal */}
 <Modal visible={showForm} animationType="slide" onRequestClose={() => setShowForm(false)}>
 <SafeAreaProvider>
 <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1">
 <ScrollView className="flex-1 bg-background px-5 pb-10" style={{ paddingTop: topInset }}>
 <View className="flex-row justify-between items-center mb-5">
 <Text className="font-headline-md text-on-surface" style={{ fontSize: 20, fontWeight: "700" }}>New Transfer</Text>
 <Pressable onPress={() => setShowForm(false)} className="w-11 h-11 items-center justify-center">
 <MaterialCommunityIcons name="close" size={20} color={theme.colors.onSurfaceVariant} />
 </Pressable>
 </View>

 {/* From warehouse */}
 <View className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant mb-4">
 <Text className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-3">From Warehouse</Text>
 <View className="flex-row flex-wrap" style={{ gap: 6 }}>
 {warehouses.filter((w) => w.id !== toWh).map((w) => (
 <Pressable key={w.id} onPress={() => setFromWh(w.id)}
 className={`rounded-xl px-4 py-2.5 ${fromWh === w.id ? "bg-primary" : "bg-surface-container-lowest border border-outline-variant"}`}>
 <Text className={`text-xs font-bold ${fromWh === w.id ? "text-white" : "text-on-surface"}`}>{w.name}</Text>
 </Pressable>
 ))}
 </View>
 </View>

 {/* To warehouse */}
 <View className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant mb-4">
 <Text className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-3">To Warehouse</Text>
 <View className="flex-row flex-wrap" style={{ gap: 6 }}>
 {warehouses.filter((w) => w.id !== fromWh).map((w) => (
 <Pressable key={w.id} onPress={() => setToWh(w.id)}
 className={`rounded-xl px-4 py-2.5 ${toWh === w.id ? "bg-primary" : "bg-surface-container-lowest border border-outline-variant"}`}>
 <Text className={`text-xs font-bold ${toWh === w.id ? "text-white" : "text-on-surface"}`}>{w.name}</Text>
 </Pressable>
 ))}
 </View>
 </View>

 {/* Items */}
 <View className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant mb-4">
 <Text className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-3">Items</Text>
 <Pressable onPress={() => setShowPicker(true)}
 className="flex-row items-center justify-center bg-primary/10 border border-dashed border-primary rounded-xl py-3.5 mb-3">
 <MaterialCommunityIcons name="plus" size={16} color={theme.colors.primary} />
 <Text className="text-xs font-bold text-primary ml-1">Add Product</Text>
 </Pressable>
 {items.length === 0 ? (
 <Text className="text-sm text-on-surface-variant text-center py-2">No items added yet</Text>
 ) : (
 items.map((item) => (
 <View key={item.product_id} className="flex-row items-center justify-between py-3 border-b border-outline-variant">
 <Text className="text-sm font-medium text-on-surface flex-1 mr-2" numberOfLines={1}>{item.product_name}</Text>
 <View className="flex-row items-center" style={{ gap: 4 }}>
 <Pressable onPress={() => updateQty(item.product_id, item.quantity - 1)}
 className="w-8 h-8 rounded-lg bg-surface-container items-center justify-center">
 <MaterialCommunityIcons name="minus" size={14} color={theme.colors.onSurfaceVariant} />
 </Pressable>
 <Text className="text-sm font-bold w-6 text-center text-on-surface">{item.quantity}</Text>
 <Pressable onPress={() => updateQty(item.product_id, item.quantity + 1)}
 className="w-8 h-8 rounded-lg bg-surface-container items-center justify-center">
 <MaterialCommunityIcons name="plus" size={14} color={theme.colors.onSurfaceVariant} />
 </Pressable>
 <Pressable onPress={() => removeItem(item.product_id)} className="w-8 h-8 items-center justify-center">
 <MaterialCommunityIcons name="trash-can-outline" size={16} color="#D64545" />
 </Pressable>
 </View>
 </View>
 ))
 )}
 </View>

 {/* Notes */}
 <View className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant mb-4">
 <Text className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">Notes</Text>
 <TextInput value={formNotes} onChangeText={setFormNotes} placeholder="Optional notes" placeholderTextColor="#9CA3AF"
 multiline numberOfLines={2}
 className="bg-surface-container text-on-surface border border-outline-variant rounded-xl px-4 py-3 font-medium" />
 </View>

 <Pressable onPress={handleCreate} disabled={saving}
 className="bg-primary py-4 rounded-2xl items-center mt-2" style={{ marginBottom: bottomInset }}>
 {saving ? <ActivityIndicator color="white" /> : <Text className="text-white font-bold">Create Transfer Request</Text>}
 </Pressable>
 </ScrollView>
 </KeyboardAvoidingView>
 </SafeAreaProvider>
 </Modal>

 {/* Product picker */}
 <Modal visible={showPicker} animationType="slide" onRequestClose={() => setShowPicker(false)}>
 <SafeAreaProvider>
 <View className="flex-1 bg-background" style={{ paddingTop: topInset }}>
 <View className="flex-row items-center justify-between px-5 py-4">
 <Text className="font-headline-md text-on-surface" style={{ fontSize: 20, fontWeight: "700" }}>Select Product</Text>
 <Pressable onPress={() => setShowPicker(false)} className="w-9 h-9 items-center justify-center">
 <MaterialCommunityIcons name="close" size={20} color={theme.colors.onSurfaceVariant} />
 </Pressable>
 </View>
 <FlatList data={products} keyExtractor={(p) => p.id}
 renderItem={({ item }) => (
 <Pressable onPress={() => pickProduct(item)}
 className="px-5 py-4 border-b border-outline-variant flex-row items-center" style={{ gap: 12 }}>
 <View className="w-10 h-10 rounded-lg bg-primary/10 items-center justify-center">
 <MaterialCommunityIcons name="package-variant" size={18} color={theme.colors.primary} />
 </View>
 <View className="flex-1">
 <Text className="text-sm font-bold text-on-surface">{item.name}</Text>
 <Text className="text-xs text-on-surface-variant">{item.sku}</Text>
 </View>
 <MaterialCommunityIcons name="plus-circle-outline" size={20} color={theme.colors.primary} />
 </Pressable>
 )}
 contentContainerStyle={{ paddingBottom: bottomInset + 24 }} />
 </View>
 </SafeAreaProvider>
 </Modal>
 </View>
 );
}
