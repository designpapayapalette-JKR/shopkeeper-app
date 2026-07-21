import React, { useState, useEffect } from "react";
import { View, ScrollView, TextInput, Pressable, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from "react-native";
import { Text } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useTheme } from "react-native-paper";
import { api, ApiError } from "../src/lib/api";
import { useTopInset } from "../src/lib/useTopInset";
import { useBottomInset } from "../src/lib/useBottomInset";

function formatRupee(n: number): string {
 return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

export default function PurchaseEntryScreen() {
 const theme = useTheme();
 const topInset = useTopInset();
 const bottomInset = useBottomInset();
 const [suppliers, setSuppliers] = useState<any[]>([]);
 const [products, setProducts] = useState<any[]>([]);
 const [warehouses, setWarehouses] = useState<any[]>([]);
 const [loading, setLoading] = useState(true);
 const [submitting, setSubmitting] = useState(false);
 const [supplierId, setSupplierId] = useState<string | null>(null);
 const [warehouseId, setWarehouseId] = useState<string | null>(null);
 const [search, setSearch] = useState("");
 const [isRcm, setIsRcm] = useState(false);
 const [cart, setCart] = useState<any[]>([]);
 const [result, setResult] = useState<any | null>(null);

 useEffect(() => {
 (async () => {
 try {
 const [par, pr, wh] = await Promise.all([
 api.get<{ data: any[] }>("/parties", { params: { type: "supplier" } }),
 api.get<{ data: any[] }>("/products"),
 api.get<{ data: any[] }>("/warehouses"),
 ]);
 setSuppliers(par.data.filter((p) => p.type === "supplier"));
 setProducts(pr.data);
 setWarehouses(wh.data);
 if (wh.data.length > 0) setWarehouseId(wh.data[0].id);
 } catch { Alert.alert("Error", "Could not load suppliers/products."); }
 finally { setLoading(false); }
 })();
 }, []);

 const filteredProducts = products.filter(
 (p) => !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.sku?.toLowerCase().includes(search.toLowerCase())
 );

 const addToCart = (product: any) => {
 setCart((prev) => {
 if (prev.some((c) => c.product.id === product.id)) return prev;
 return [...prev, { product, quantity: "1", cost: "" }];
 });
 };

 const updateLine = (productId: string, field: "quantity" | "cost", value: string) => {
 setCart((prev) => prev.map((c) => (c.product.id === productId ? { ...c, [field]: value } : c)));
 };

 const removeLine = (productId: string) => {
 setCart((prev) => prev.filter((c) => c.product.id !== productId));
 };

 const subtotal = cart.reduce((s, c) => s + (parseFloat(c.cost) || 0) * (parseFloat(c.quantity) || 0), 0);

 const handleSubmit = async () => {
 if (!supplierId || !warehouseId || cart.length === 0) {
 Alert.alert("Required", "Select a supplier, warehouse, and at least one product.");
 return;
 }
 if (cart.some((c) => !c.cost || parseFloat(c.cost) <= 0)) {
 Alert.alert("Missing Cost", "Enter a cost price for every item.");
 return;
 }
 setSubmitting(true);
 try {
 const res = await api.post<{ data: any }>("/purchases", {
 supplierId, warehouseId, isRcm,
 items: cart.map((c) => ({
 productId: c.product.id,
 quantity: parseFloat(c.quantity) || 0,
 cost: parseFloat(c.cost) || 0,
 taxRate: c.product.tax_rate ? parseFloat(c.product.tax_rate) : 0,
 })),
 });
 setResult(res.data);
 setCart([]);
 setSupplierId(null);
 } catch (e) {
 Alert.alert("Error", e instanceof ApiError ? e.message : "Failed to record purchase.");
 } finally { setSubmitting(false); }
 };

 if (loading) {
 return <View className="flex-1 items-center justify-center bg-background"><ActivityIndicator color={theme.colors.primary} /></View>;
 }

 if (result) {
 return (
 <View className="flex-1 items-center justify-center bg-background px-8" style={{ paddingTop: topInset }}>
 <View className="w-16 h-16 rounded-full bg-success/10 items-center justify-center mb-4">
 <MaterialCommunityIcons name="check-circle" size={36} color="#2E9E5B" />
 </View>
 <Text className="font-headline-md text-on-surface" style={{ fontSize: 20, fontWeight: "700" }}>Purchase Recorded</Text>
 <Text className="text-sm text-on-surface-variant mt-1">#{result.purchaseNumber}</Text>
 <Text className="text-sm text-on-surface-variant mt-1">{formatRupee(Number(result.grandTotal))} — stock updated</Text>
 <View className="flex-row mt-8" style={{ gap: 10 }}>
 <Pressable onPress={() => setResult(null)} className="bg-primary px-6 py-3 rounded-xl"><Text className="text-white font-bold">New Purchase</Text></Pressable>
 <Pressable onPress={() => router.back()} className="border border-outline-variant px-6 py-3 rounded-xl"><Text className="text-on-surface-variant font-bold">Done</Text></Pressable>
 </View>
 </View>
 );
 }

 return (
 <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : undefined}>
 <ScrollView className="flex-1 bg-background px-5" style={{ paddingTop: topInset }} keyboardShouldPersistTaps="handled">
 <Text className="font-headline-md text-on-surface mb-1" style={{ fontSize: 20, fontWeight: "700" }}>Record Purchase</Text>
 <Text className="text-sm text-on-surface-variant mb-4">Log stock received from a supplier.</Text>

 {/* Supplier */}
 <Text className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">Supplier</Text>
 <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4" contentContainerStyle={{ gap: 6 }}>
 {suppliers.map((s) => (
 <Pressable
 key={s.id}
 onPress={() => setSupplierId(s.id)}
 className={`rounded-xl px-4 py-2.5 ${supplierId === s.id ? "bg-primary" : "bg-surface-container-lowest border border-outline-variant"}`}
 >
 <Text className={`text-xs font-bold ${supplierId === s.id ? "text-white" : "text-on-surface"}`}>{s.name}</Text>
 </Pressable>
 ))}
 </ScrollView>

 {/* Warehouse */}
 {warehouses.length > 1 && (
 <>
 <Text className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">Warehouse</Text>
 <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4" contentContainerStyle={{ gap: 6 }}>
 {warehouses.map((w) => (
 <Pressable
 key={w.id}
 onPress={() => setWarehouseId(w.id)}
 className={`rounded-xl px-4 py-2.5 ${warehouseId === w.id ? "bg-primary" : "bg-surface-container-lowest border border-outline-variant"}`}
 >
 <Text className={`text-xs font-bold ${warehouseId === w.id ? "text-white" : "text-on-surface"}`}>{w.name}</Text>
 </Pressable>
 ))}
 </ScrollView>
 </>
 )}

 {/* RCM */}
 <Pressable
 onPress={() => setIsRcm(!isRcm)}
 className={`flex-row items-center p-4 rounded-xl border mb-4 ${isRcm ? "bg-primary/10 border-primary" : "bg-surface-container-lowest border-outline-variant"}`}
 >
 <View className={`w-6 h-6 rounded-lg items-center justify-center mr-3 ${isRcm ? "bg-primary" : "bg-surface-container border border-outline-variant"}`}>
 {isRcm && <MaterialCommunityIcons name="check" size={16} color="white" />}
 </View>
 <View className="flex-1">
 <Text className="text-sm font-bold text-on-surface">Reverse Charge (RCM)</Text>
 <Text className="text-xs text-on-surface-variant mt-0.5">GST is payable by the buyer</Text>
 </View>
 </Pressable>

 {/* Add Products */}
 <Text className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">Add Products</Text>
 <View className="flex-row items-center bg-surface-container-lowest rounded-2xl px-4 py-3 border border-outline-variant mb-2">
 <MaterialCommunityIcons name="magnify" size={18} color="#6B7280" />
 <TextInput
 value={search}
 onChangeText={setSearch}
 placeholder="Search products..."
 placeholderTextColor="#9CA3AF"
 className="flex-1 ml-2 text-base font-medium text-on-surface"
 />
 </View>
 <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4" contentContainerStyle={{ gap: 6 }}>
 {filteredProducts.slice(0, 30).map((p) => (
 <Pressable key={p.id} onPress={() => addToCart(p)} className="rounded-xl px-4 py-2.5 border border-dashed border-primary">
 <Text className="text-xs font-bold text-primary">+ {p.name}</Text>
 </Pressable>
 ))}
 </ScrollView>

 {/* Cart */}
 {cart.map((c) => (
 <View key={c.product.id} className="bg-surface-container-lowest p-4 rounded-xl border border-outline-variant mb-3">
 <View className="flex-row justify-between items-center mb-2">
 <Text className="font-bold text-on-surface flex-1 mr-2" numberOfLines={1}>{c.product.name}</Text>
 <Pressable onPress={() => removeLine(c.product.id)}>
 <MaterialCommunityIcons name="trash-can-outline" size={18} color="#D64545" />
 </Pressable>
 </View>
 <View className="flex-row" style={{ gap: 8 }}>
 <View className="flex-1">
 <Text className="text-xs text-on-surface-variant mb-1">Quantity</Text>
 <TextInput
 value={c.quantity}
 onChangeText={(v) => updateLine(c.product.id, "quantity", v)}
 keyboardType="numeric"
 className="bg-surface-container border border-outline-variant rounded-xl px-3 py-2.5 text-base font-bold text-center text-on-surface"
 />
 </View>
 <View className="flex-1">
 <Text className="text-xs text-on-surface-variant mb-1">Cost / Unit (₹)</Text>
 <TextInput
 value={c.cost}
 onChangeText={(v) => updateLine(c.product.id, "cost", v)}
 keyboardType="numeric"
 placeholder="0.00"
 placeholderTextColor="#9CA3AF"
 className="bg-surface-container border border-outline-variant rounded-xl px-3 py-2.5 text-base font-bold text-center text-on-surface"
 />
 </View>
 </View>
 </View>
 ))}

 {cart.length > 0 && (
 <>
 <View className="flex-row justify-between items-center py-3 border-t border-outline-variant mb-4">
 <Text className="text-base font-bold text-on-surface">Subtotal</Text>
 <Text className="text-lg font-bold text-on-surface">{formatRupee(subtotal)}</Text>
 </View>
 <Pressable
 onPress={handleSubmit}
 disabled={submitting}
 className="bg-primary py-4 rounded-2xl items-center"
 style={{ marginBottom: bottomInset + 16, opacity: submitting ? 0.5 : 1 }}
 >
 {submitting ? <ActivityIndicator color="white" /> : <Text className="text-white font-bold text-base">Record Purchase</Text>}
 </Pressable>
 </>
 )}
 </ScrollView>
 </KeyboardAvoidingView>
 );
}
