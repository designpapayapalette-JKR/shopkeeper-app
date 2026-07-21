import React, { useCallback, useEffect, useState } from "react";
import {
 View,
 Text,
 FlatList,
 ActivityIndicator,
 Pressable,
 Alert,
 TextInput,
 Modal,
 ScrollView,
 KeyboardAvoidingView,
 Platform,
 RefreshControl,
} from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { api, ApiError } from "../src/lib/api";
import { useConfirm } from "../src/components/ConfirmDialog";
import { useTopInset } from "../src/lib/useTopInset";
import { useBottomInset } from "../src/lib/useBottomInset";
import { useTheme } from "react-native-paper";
import EmptyState from "../src/components/EmptyState";

interface Product {
 id: string;
 name: string;
 sku: string | null;
 unit: string;
}

interface Supplier {
 id: string;
 name: string;
 phone: string | null;
}

interface CartItem {
 productId: string;
 name: string;
 quantity: number;
 unitCost: number;
 sku: string | null;
 unit: string;
}

interface POItem {
 id: string;
 product_id: string;
 quantity: string;
 received_quantity: string;
 unit_cost: string;
 product: { id: string; name: string; sku: string | null; unit: string };
}

interface PurchaseOrder {
 id: string;
 po_number: string;
 date: string;
 status: string;
 notes: string | null;
 supplier: { id: string; name: string; phone: string | null };
 items: POItem[];
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
 draft: { label: "Draft", color: "#6B7280", bg: "#F3F4F6" },
 sent: { label: "Sent", color: "#2563EB", bg: "#DBEAFE" },
 partially_received: { label: "Partial", color: "#D97706", bg: "#FEF3C7" },
 received: { label: "Received", color: "#16A34A", bg: "#DCFCE7" },
 cancelled: { label: "Cancelled", color: "#DC2626", bg: "#FEE2E2" },
};

const VALID_TRANSITIONS: Record<string, string[]> = {
 draft: ["sent", "cancelled"],
 sent: ["partially_received", "received", "cancelled"],
 partially_received: ["received", "cancelled"],
};

export default function PurchaseOrdersScreen() {
 const topInset = useTopInset();
 const bottomInset = useBottomInset();
 const confirm = useConfirm();
 const router = useRouter();
 const theme = useTheme();

 const [tab, setTab] = useState<"list" | "new">("list");
 const [orders, setOrders] = useState<PurchaseOrder[]>([]);
 const [loading, setLoading] = useState(false);
 const [refreshing, setRefreshing] = useState(false);
 const [loadTrigger, setLoadTrigger] = useState(0);

 const [products, setProducts] = useState<Product[]>([]);
 const [suppliers, setSuppliers] = useState<Supplier[]>([]);
 const [cart, setCart] = useState<CartItem[]>([]);
 const [searchQuery, setSearchQuery] = useState("");
 const [supplierId, setSupplierId] = useState("");
 const [notes, setNotes] = useState("");
 const [formLoading, setFormLoading] = useState(false);
 const [submitting, setSubmitting] = useState(false);

 const [activePO, setActivePO] = useState<PurchaseOrder | null>(null);
 const [showReceive, setShowReceive] = useState(false);
 const [receiveQtys, setReceiveQtys] = useState<Record<string, string>>({});
 const [receiving, setReceiving] = useState(false);

 const loadOrders = useCallback(async () => {
 setLoading(true);
 try {
 const res = await api.get<{ data: PurchaseOrder[] }>("/purchase-orders");
 setOrders(res.data ?? []);
 } catch (e) {
 console.error("Failed to load purchase orders:", e);
 } finally {
 setLoading(false);
 }
 }, []);

 const onRefresh = useCallback(async () => {
 setRefreshing(true);
 try { await loadOrders(); } finally { setRefreshing(false); }
 }, [loadOrders]);

 useEffect(() => {
 loadOrders();
 }, [loadOrders, loadTrigger]);

 const loadFormData = useCallback(async () => {
 setFormLoading(true);
 try {
 const [pr, sr] = await Promise.all([
 api.get<{ data: Product[] }>("/products"),
 api.get<{ data: Supplier[] }>("/parties", { params: { type: "supplier" } }),
 ]);
 setProducts(pr.data ?? []);
 setSuppliers(sr.data ?? []);
 } catch {
 Alert.alert("Error", "Failed to load form data.");
 } finally {
 setFormLoading(false);
 }
 }, []);

 const openNewTab = () => {
 setTab("new");
 loadFormData();
 setCart([]);
 setSupplierId("");
 setNotes("");
 setSearchQuery("");
 };

 const filteredProducts = products.filter(
 (p) =>
 !searchQuery ||
 p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
 (p.sku && p.sku.toLowerCase().includes(searchQuery.toLowerCase()))
 );

 const addToCart = (product: Product) => {
 setCart((prev) => {
 const existing = prev.find((c) => c.productId === product.id);
 if (existing) {
 return prev.map((c) =>
 c.productId === product.id ? { ...c, quantity: c.quantity + 1 } : c
 );
 }
 return [...prev, { productId: product.id, name: product.name, sku: product.sku, unit: product.unit, quantity: 1, unitCost: 0 }];
 });
 };

 const updateCartQty = (productId: string, delta: number) => {
 setCart((prev) => prev.map((c) => (c.productId === productId ? { ...c, quantity: Math.max(1, c.quantity + delta) } : c)));
 };

 const updateCartCost = (productId: string, cost: string) => {
 const num = parseFloat(cost);
 if (isNaN(num)) return;
 setCart((prev) => prev.map((c) => (c.productId === productId ? { ...c, unitCost: Math.max(0, num) } : c)));
 };

 const removeCartItem = (productId: string) => {
 setCart((prev) => prev.filter((c) => c.productId !== productId));
 };

 const handleCreatePO = async () => {
 if (!supplierId || cart.length === 0) {
 Alert.alert("Required", "Select a supplier and add at least one item.");
 return;
 }
 setSubmitting(true);
 try {
 await api.post("/purchase-orders", {
 supplierId,
 notes: notes.trim() || undefined,
 items: cart.map((c) => ({ productId: c.productId, quantity: c.quantity, unitCost: c.unitCost })),
 });
 Alert.alert("Success", "Purchase order created.");
 setTab("list");
 setLoadTrigger((n) => n + 1);
 } catch (e) {
 Alert.alert("Error", e instanceof ApiError ? e.message : "Failed to create purchase order.");
 } finally {
 setSubmitting(false);
 }
 };

 const updateStatus = async (id: string, status: string) => {
 try {
 await api.patch(`/purchase-orders/${id}/status`, { status });
 setLoadTrigger((n) => n + 1);
 setActivePO((prev) => (prev && prev.id === id ? { ...prev, status } : prev));
 } catch (e) {
 Alert.alert("Error", e instanceof ApiError ? e.message : "Failed to update status.");
 }
 };

 const openDetail = (po: PurchaseOrder) => setActivePO(po);

 const openReceive = () => {
 if (!activePO) return;
 const initQtys: Record<string, string> = {};
 activePO.items.forEach((item) => {
 initQtys[item.id] = String(Math.max(0, Number(item.quantity) - Number(item.received_quantity)));
 });
 setReceiveQtys(initQtys);
 setShowReceive(true);
 };

 const handleReceive = async () => {
 if (!activePO) return;
 setReceiving(true);
 try {
 const items = Object.entries(receiveQtys)
 .filter(([, qty]) => parseFloat(qty) > 0)
 .map(([itemId, qty]) => {
 const item = activePO.items.find((i) => i.id === itemId);
 return { productId: item!.product_id, quantity: parseFloat(qty) };
 });
 if (items.length === 0) {
 Alert.alert("Nothing to Receive", "Enter at least one item quantity.");
 return;
 }
 await api.post(`/purchase-orders/${activePO.id}/receive`, { items });
 Alert.alert("Success", "Items received.");
 setShowReceive(false);
 setActivePO(null);
 setLoadTrigger((n) => n + 1);
 } catch (e) {
 Alert.alert("Error", e instanceof ApiError ? e.message : "Failed to receive items.");
 } finally {
 setReceiving(false);
 }
 };

 const renderOrder = ({ item }: { item: PurchaseOrder }) => {
 const cfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.draft;
 const totalQty = item.items.reduce((s, i) => s + Number(i.quantity), 0);
 return (
 <Pressable
 onPress={() => openDetail(item)}
 className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant mb-3 shadow-sm active:opacity-80"
 >
 <View className="flex-row items-start justify-between">
 <View className="flex-1 mr-2">
 <Text className="text-base font-bold text-on-surface ">{item.po_number}</Text>
 <Text className="text-sm text-on-surface-variant mt-0.5">{item.supplier.name}</Text>
 <View className="flex-row items-center mt-2" style={{ gap: 8 }}>
 <View style={{ backgroundColor: cfg.bg }} className="px-2.5 py-1 rounded-full">
 <Text style={{ color: cfg.color }} className="text-xs font-bold">{cfg.label}</Text>
 </View>
 <Text className="text-xs text-on-surface-variant ">{totalQty} items</Text>
 </View>
 </View>
 <Text className="text-sm text-on-surface-variant ">
 {new Date(item.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
 </Text>
 </View>
 </Pressable>
 );
 };

 return (
 <View className="flex-1 bg-background " style={{ paddingTop: topInset }}>
 <View className="flex-row items-center justify-between px-6 py-4">
 <View className="flex-row items-center" style={{ gap: 8 }}>
 <Pressable onPress={() => router.back()} className="w-9 h-9 items-center justify-center active:opacity-70">
 <MaterialCommunityIcons name="arrow-left" size={22} color={theme.colors.onSurfaceVariant} />
 </Pressable>
 <Text className="text-xl font-bold text-on-surface ">Purchase Orders</Text>
 </View>
 </View>

 <View className="px-6 mb-4 flex-row" style={{ gap: 8 }}>
 <Pressable
 onPress={() => setTab("list")}
 className={`flex-1 py-2.5 rounded-xl items-center border ${tab === "list" ? "bg-primary border-primary" : "bg-surface-container-lowest border-outline-variant "}`}
 >
 <Text className={`text-xs font-bold uppercase tracking-wider ${tab === "list" ? "text-white" : "text-on-surface-variant "}`}>Orders</Text>
 </Pressable>
 <Pressable
 onPress={openNewTab}
 className={`flex-1 py-2.5 rounded-xl items-center border ${tab === "new" ? "bg-primary border-primary" : "bg-surface-container-lowest border-outline-variant "}`}
 >
 <Text className={`text-xs font-bold uppercase tracking-wider ${tab === "new" ? "text-white" : "text-on-surface-variant "}`}>New PO</Text>
 </Pressable>
 </View>

 {tab === "list" ? (
 loading ? (
 <View className="flex-1 items-center justify-center pb-20"><ActivityIndicator size="large" color={theme.colors.primary} /></View>
 ) : orders.length === 0 ? (
 <EmptyState
 icon="file-document-outline"
 title="No purchase orders yet"
 description="Create a PO to track orders before they arrive."
 actionLabel="New PO"
 onAction={() => setTab("new")}
 />
 ) : (
 <FlatList data={orders} keyExtractor={(item) => item.id} renderItem={renderOrder}
 refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
 contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: bottomInset + 24 }} showsVerticalScrollIndicator={false} />
 )
 ) : formLoading ? (
 <View className="flex-1 items-center justify-center"><ActivityIndicator size="large" color={theme.colors.primary} /></View>
 ) : (
 <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1">
 <ScrollView className="flex-1 px-6" contentContainerStyle={{ paddingBottom: bottomInset + 24 }} showsVerticalScrollIndicator={false}>
 <View className="bg-surface-container-lowest p-5 rounded-3xl border border-outline-variant shadow-sm mb-4">
 <Text className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider mb-2">Supplier *</Text>
 <View className="flex-row flex-wrap" style={{ gap: 6 }}>
 {suppliers.length === 0 ? (
 <Text className="text-sm text-on-surface-variant ">No suppliers found.</Text>
 ) : (
 suppliers.slice(0, 20).map((s) => (
 <Pressable key={s.id} onPress={() => setSupplierId(s.id)}
 className={`px-3.5 py-2.5 rounded-xl border ${supplierId === s.id ? "bg-primary border-primary" : "bg-surface-container-lowest border-outline-variant "}`}>
 <Text className={`text-sm font-bold ${supplierId === s.id ? "text-white" : "text-on-surface-variant "}`}>{s.name}</Text>
 </Pressable>
 ))
 )}
 </View>
 </View>

 <View className="bg-surface-container-lowest p-5 rounded-3xl border border-outline-variant shadow-sm mb-4">
 <Text className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider mb-2">Products</Text>
 <TextInput value={searchQuery} onChangeText={setSearchQuery} placeholder="Search products..." placeholderTextColor="#A0A0A0"
 className="bg-background text-on-surface border border-outline-variant rounded-xl px-4 py-3 font-medium mb-3" />
 <View className="flex-row flex-wrap" style={{ gap: 6 }}>
 {filteredProducts.slice(0, 30).map((p) => (
 <Pressable key={p.id} onPress={() => addToCart(p)}
 className="px-3.5 py-2.5 rounded-xl border border-outline-variant bg-surface-container-lowest active:opacity-70">
 <Text className="text-sm font-bold text-on-surface ">{p.name}</Text>
 <Text className="text-xs text-on-surface-variant ">{p.sku || "No SKU"}</Text>
 </Pressable>
 ))}
 </View>
 </View>

 <View className="bg-surface-container-lowest p-5 rounded-3xl border border-outline-variant shadow-sm mb-4">
 <Text className="text-lg font-bold text-on-surface mb-3">Cart ({cart.length})</Text>
 {cart.length === 0 ? (
 <Text className="text-sm text-on-surface-variant ">No items added yet.</Text>
 ) : (
 cart.map((item) => (
 <View key={item.productId} className="flex-row items-center py-3 border-b border-outline-variant ">
 <View className="flex-1 mr-2">
 <Text className="text-sm font-bold text-on-surface " numberOfLines={1}>{item.name}</Text>
 <View className="flex-row items-center mt-1" style={{ gap: 6 }}>
 <Pressable onPress={() => updateCartQty(item.productId, -1)} className="w-7 h-7 rounded-lg bg-surface-container items-center justify-center">
 <MaterialCommunityIcons name="minus" size={12} color={theme.colors.onSurfaceVariant} />
 </Pressable>
 <Text className="text-sm font-bold w-6 text-center">{item.quantity}</Text>
 <Pressable onPress={() => updateCartQty(item.productId, 1)} className="w-7 h-7 rounded-lg bg-surface-container items-center justify-center">
 <MaterialCommunityIcons name="plus" size={12} color={theme.colors.onSurfaceVariant} />
 </Pressable>
 <TextInput value={item.unitCost.toString()} onChangeText={(v) => updateCartCost(item.productId, v)} keyboardType="decimal-pad"
 className="bg-background text-on-surface border border-outline-variant rounded-lg px-2 py-1 text-xs font-bold w-20 text-right" />
 </View>
 </View>
 <Pressable onPress={() => removeCartItem(item.productId)} className="w-8 h-8 items-center justify-center">
 <MaterialCommunityIcons name="close" size={16} color="#D64545" />
 </Pressable>
 </View>
 ))
 )}
 </View>

 <View className="bg-surface-container-lowest p-5 rounded-3xl border border-outline-variant shadow-sm mb-4">
 <Text className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider mb-2">Notes</Text>
 <TextInput value={notes} onChangeText={setNotes} placeholder="Order notes..." placeholderTextColor="#A0A0A0" multiline numberOfLines={2}
 className="bg-background text-on-surface border border-outline-variant rounded-xl px-4 py-3 font-medium" />
 </View>

 <Pressable onPress={handleCreatePO} disabled={submitting || !supplierId || cart.length === 0}
 className="bg-primary py-4 rounded-xl items-center mb-6 opacity-100 disabled:opacity-50">
 {submitting ? <ActivityIndicator color="white" /> : <Text className="text-white font-bold text-base">Create Purchase Order</Text>}
 </Pressable>
 </ScrollView>
 </KeyboardAvoidingView>
 )}

 <Modal visible={!!activePO && !showReceive} animationType="slide" onRequestClose={() => setActivePO(null)}>
 <SafeAreaProvider>
 <ScrollView className="flex-1 bg-background " style={{ paddingTop: topInset }}>
 <View className="px-6 pb-8">
 <View className="flex-row justify-between items-center mb-6">
 <Text className="text-2xl font-bold text-on-surface ">{activePO?.po_number}</Text>
 <Pressable onPress={() => setActivePO(null)} className="w-11 h-11 items-center justify-center">
 <MaterialCommunityIcons name="close" size={20} color={theme.colors.onSurfaceVariant} />
 </Pressable>
 </View>
 {activePO && (
 <>
 <View className="bg-surface-container-lowest p-5 rounded-3xl border border-outline-variant shadow-sm mb-4">
 <Text className="text-sm font-bold text-on-surface-variant ">{activePO.supplier.name}</Text>
 {activePO.supplier.phone && <Text className="text-sm text-on-surface-variant mt-1">{activePO.supplier.phone}</Text>}
 {(() => { const cfg = STATUS_CONFIG[activePO.status] || STATUS_CONFIG.draft; return (
 <View style={{ backgroundColor: cfg.bg }} className="px-3 py-1.5 rounded-full self-start mt-2">
 <Text style={{ color: cfg.color }} className="text-xs font-bold">{cfg.label}</Text>
 </View>
 ); })()}
 </View>

 <View className="bg-surface-container-lowest p-5 rounded-3xl border border-outline-variant shadow-sm mb-4">
 <Text className="text-sm font-bold text-on-surface mb-3">Items</Text>
 {activePO.items.map((item) => (
 <View key={item.id} className="flex-row items-center py-2 border-b border-outline-variant ">
 <View className="flex-1 mr-2">
 <Text className="text-sm font-bold text-on-surface ">{item.product.name}</Text>
 <Text className="text-xs text-on-surface-variant ">Qty: {item.quantity} · Received: {item.received_quantity}</Text>
 </View>
 <Text className="text-sm font-bold text-on-surface ">₹{Number(item.unit_cost).toLocaleString("en-IN")}</Text>
 </View>
 ))}
 </View>

 {activePO.notes && (
 <View className="bg-surface-container-lowest p-5 rounded-3xl border border-outline-variant shadow-sm mb-4">
 <Text className="text-sm font-bold text-on-surface mb-1">Notes</Text>
 <Text className="text-sm text-on-surface-variant ">{activePO.notes}</Text>
 </View>
 )}

 {(VALID_TRANSITIONS[activePO.status] || []).length > 0 && (
 <View className="bg-surface-container-lowest p-5 rounded-3xl border border-outline-variant shadow-sm mb-4">
 <Text className="text-sm font-bold text-on-surface mb-3">Actions</Text>
 <View className="flex-row flex-wrap" style={{ gap: 8 }}>
 {VALID_TRANSITIONS[activePO.status].map((nextStatus) => {
 const cfg = STATUS_CONFIG[nextStatus];
 return (
 <Pressable key={nextStatus} onPress={() => {
 if (nextStatus === "cancelled") {
 confirm({ title: "Cancel PO?", message: `Cancel ${activePO.po_number}?`, confirmLabel: "Cancel", destructive: true })
 .then((ok) => { if (ok) updateStatus(activePO.id, nextStatus); });
 } else { updateStatus(activePO.id, nextStatus); }
 }} style={{ backgroundColor: cfg.bg }} className="px-4 py-3 rounded-xl active:opacity-70">
 <Text style={{ color: cfg.color }} className="text-sm font-bold">
 {nextStatus === "sent" ? "Mark Sent" : nextStatus === "received" ? "Mark Received" : nextStatus === "partially_received" ? "Partial" : cfg.label}
 </Text>
 </Pressable>
 );
 })}
 {(activePO.status === "sent" || activePO.status === "partially_received") && (
 <Pressable onPress={openReceive} className="px-4 py-3 rounded-xl bg-primary active:opacity-70">
 <Text className="text-sm font-bold text-white">Receive Items</Text>
 </Pressable>
 )}
 </View>
 </View>
 )}
 </>
 )}
 </View>
 </ScrollView>
 </SafeAreaProvider>
 </Modal>

 <Modal visible={showReceive} animationType="slide" onRequestClose={() => setShowReceive(false)}>
 <SafeAreaProvider>
 <ScrollView className="flex-1 bg-background " style={{ paddingTop: topInset }}>
 <View className="px-6 pb-8">
 <View className="flex-row justify-between items-center mb-6">
 <Text className="text-2xl font-bold text-on-surface ">Receive Items</Text>
 <Pressable onPress={() => setShowReceive(false)} className="w-11 h-11 items-center justify-center">
 <MaterialCommunityIcons name="close" size={20} color={theme.colors.onSurfaceVariant} />
 </Pressable>
 </View>
 <Text className="text-sm font-bold text-on-surface-variant mb-4">{activePO?.po_number} · {activePO?.supplier.name}</Text>
 {activePO?.items.map((item) => (
 <View key={item.id} className="bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant mb-3">
 <Text className="text-sm font-bold text-on-surface ">{item.product.name}</Text>
 <View className="flex-row items-center justify-between mt-2">
 <Text className="text-xs text-on-surface-variant ">Ordered: {item.quantity} · Received: {item.received_quantity}</Text>
 <TextInput value={receiveQtys[item.id] || "0"} onChangeText={(v) => setReceiveQtys((prev) => ({ ...prev, [item.id]: v }))}
 keyboardType="numeric"
 className="bg-background text-on-surface border border-outline-variant rounded-xl px-3 py-2 text-sm font-bold w-24 text-right" />
 </View>
 </View>
 ))}
 <Pressable onPress={handleReceive} disabled={receiving} className="bg-primary py-4 rounded-xl items-center mt-4">
 {receiving ? <ActivityIndicator color="white" /> : <Text className="text-white font-bold text-base">Submit Receipt</Text>}
 </Pressable>
 </View>
 </ScrollView>
 </SafeAreaProvider>
 </Modal>
 </View>
 );
}
