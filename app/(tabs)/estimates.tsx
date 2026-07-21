import React, { useState, useEffect, useMemo } from "react";
import {
 View,
 Text,
 TextInput,
 Pressable,
 FlatList,
 ScrollView,
 Alert,
 ActivityIndicator,
 Modal,
 KeyboardAvoidingView,
 Platform,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useTheme } from "react-native-paper";
import { api } from "../../src/lib/api";
import { useAuth } from "../../src/lib/auth-context";
import { useTopInset } from "../../src/lib/useTopInset";

interface Product {
 id: string;
 name: string;
 sku: string | null;
 price: string;
 tax_rate: string;
 stock_quantity: number;
}

interface Party {
 id: string;
 name: string;
 phone: string | null;
 gstin: string | null;
}

interface CartItem {
 product: Product;
 quantity: number;
 discount: number;
}

interface Estimate {
 id: string;
 invoiceNumber: string;
 party?: { name: string };
 grandTotal: number;
 createdAt: string;
 type: string;
}

export default function EstimatesScreen() {
 const { user } = useAuth();
 const theme = useTheme();
 const topInset = useTopInset();
 const [view, setView] = useState<"new" | "list">("new");
 const [products, setProducts] = useState<Product[]>([]);
 const [parties, setParties] = useState<Party[]>([]);
 const [selectedParty, setSelectedParty] = useState<Party | null>(null);
 const [cart, setCart] = useState<CartItem[]>([]);
 const [searchQuery, setSearchQuery] = useState("");
 const [partySearch, setPartySearch] = useState("");
 const [loading, setLoading] = useState(true);
 const [submitting, setSubmitting] = useState(false);
 const [applyGst, setApplyGst] = useState(false);
 const [discountPercent, setDiscountPercent] = useState(0);
 const [showPartyPicker, setShowPartyPicker] = useState(false);
 const [showProductPicker, setShowProductPicker] = useState(false);
 const [checkoutResult, setCheckoutResult] = useState<any>(null);
 const [estimates, setEstimates] = useState<Estimate[]>([]);
 const [estimatesLoading, setEstimatesLoading] = useState(false);

 const fetchData = async () => {
 setLoading(true);
 try {
 const [pr, par]: any = await Promise.all([
 api.get("/products"),
 api.get("/parties?type=customer"),
 ]);
 if (pr?.data) setProducts(pr.data);
 if (par?.data) setParties(par.data.filter((p: any) => p.type === "customer"));
 } catch {} finally {
 setLoading(false);
 }
 };

 const fetchEstimates = async () => {
 setEstimatesLoading(true);
 try {
 const res: any = await api.get("/invoices?type=estimate");
 if (res?.data) setEstimates(res.data);
 } catch { Alert.alert("Error", "Failed to load estimates."); } finally {
 setEstimatesLoading(false);
 }
 };

 useEffect(() => { fetchData(); }, []);
 useEffect(() => { if (view === "list") fetchEstimates(); }, [view]);

 const filteredParties = parties.filter((p) =>
 !partySearch || p.name.toLowerCase().includes(partySearch.toLowerCase()) || (p.phone && p.phone.includes(partySearch))
 );

 const filteredProducts = products.filter((p) =>
 !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase()) || (p.sku && p.sku.toLowerCase().includes(searchQuery.toLowerCase()))
 );

 const addToCart = (product: Product) => {
 const existing = cart.find((c) => c.product.id === product.id);
 if (existing) {
 setCart(cart.map((c) => c.product.id === product.id ? { ...c, quantity: c.quantity + 1 } : c));
 } else {
 setCart([...cart, { product, quantity: 1, discount: 0 }]);
 }
 };

 const subtotal = cart.reduce((s, c) => s + Number(c.product.price) * c.quantity, 0);
 const discountAmount = subtotal * (discountPercent / 100);
 const taxableAmount = subtotal - discountAmount;
 const taxTotal = applyGst ? taxableAmount * 0.18 : 0;
 const grandTotal = taxableAmount + taxTotal;

 const handleCheckout = async () => {
 if (!selectedParty || cart.length === 0) { Alert.alert("Error", "Select a customer and add items"); return; }
 setSubmitting(true);
 try {
 const body = {
 partyId: selectedParty.id,
 warehouseId: (await api.get("/warehouses") as any)?.data?.[0]?.id,
 type: "estimate",
 applyGst,
 discountTotal: discountAmount,
 items: cart.map((c) => ({ productId: c.product.id, quantity: c.quantity, price: c.product.price, taxRate: c.product.tax_rate, discount: c.discount })),
 };
 const res: any = await api.post("/pos/checkout", body);
 setCheckoutResult(res.data);
 setCart([]);
 setDiscountPercent(0);
 setSelectedParty(null);
 } catch (e: any) {
 Alert.alert("Error", e?.message || "Checkout failed");
 } finally {
 setSubmitting(false);
 }
 };

 const handleConvert = async (estimateId: string) => {
 Alert.alert("Convert to Invoice", "Convert this estimate to a GST invoice?", [
 { text: "Cancel", style: "cancel" },
 { text: "Convert", onPress: async () => {
 try {
 await api.post(`/invoices/${estimateId}/convert-from-estimate`, { targetType: "gst", paymentMode: "cash" });
 Alert.alert("Success", "Estimate converted to invoice");
 fetchEstimates();
 } catch (e: any) {
 Alert.alert("Error", e?.message || "Conversion failed");
 }
 },
 },
 ]);
 };

 if (view === "list") {
 return (
  <View className="flex-1 bg-background" style={{ paddingTop: topInset }}>
  <View className="px-5 pb-3 flex-row items-center justify-between">
  <View className="flex-row items-center" style={{ gap: 10 }}>
  <View className="w-1.5 h-7 rounded-full bg-amber-500" />
  <Text className="text-2xl font-black text-on-surface">Estimates</Text>
  </View>
  <Pressable onPress={() => setView("new")} className="flex-row items-center bg-primary px-4 py-2.5 rounded-xl" style={{ gap: 6 }}>
 <MaterialCommunityIcons name="plus" size={16} color="white" />
 <Text className="text-white text-sm font-bold">New Estimate</Text>
 </Pressable>
 </View>
 {estimatesLoading ? (
 <ActivityIndicator size="large" className="mt-10" color={theme.colors.primary} />
 ) : estimates.length === 0 ? (
  <View className="flex-1 items-center justify-center px-8">
  <View className="bg-surface-container-lowest p-8 rounded-2xl border border-outline-variant items-center">
  <MaterialCommunityIcons name="file-document-outline" size={48} color={theme.colors.outlineVariant} />
  <Text className="text-base text-on-surface-variant mt-3 text-center">No estimates yet</Text>
  <Pressable onPress={() => setView("new")} className="mt-5 bg-primary px-6 py-3 rounded-xl">
  <Text className="text-white font-bold">Create First Estimate</Text>
  </Pressable>
  </View>
  </View>
 ) : (
 <FlatList
 data={estimates}
 keyExtractor={(item) => item.id}
  contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
  renderItem={({ item }) => (
  <View className="bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant mb-3 shadow-sm">
  <View className="flex-row justify-between items-start">
  <View className="flex-1 mr-2">
  <Text className="font-bold text-base text-on-surface">{item.invoiceNumber}</Text>
  <Text className="text-sm text-on-surface-variant mt-0.5">{item.party?.name || "—"}</Text>
  <Text className="text-xs text-on-surface-variant mt-0.5">{new Date(item.createdAt).toLocaleDateString("en-IN")}</Text>
  </View>
  <View className="items-end">
  <Text className="font-bold text-base text-amber-600">₹{Number(item.grandTotal).toLocaleString("en-IN")}</Text>
  <Pressable onPress={() => handleConvert(item.id)} className="mt-2 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-full">
  <Text className="text-amber-700 text-xs font-bold">Convert</Text>
  </Pressable>
  </View>
  </View>
  </View>
  )}
 />
 )}
 </View>
 );
 }

 return (
 <View className="flex-1 bg-background " style={{ paddingTop: topInset }}>
 <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1">
  {checkoutResult ? (
  <View className="flex-1 items-center justify-center px-8">
  <View className="bg-surface-container-lowest p-8 rounded-2xl border border-outline-variant items-center">
  <MaterialCommunityIcons name="check-circle-outline" size={64} color={theme.colors.primary} />
  <Text className="text-xl font-bold text-success mt-4">Estimate Created</Text>
  <Text className="text-base text-on-surface-variant mt-1">#{checkoutResult.invoiceNumber}</Text>
  <Text className="text-lg font-bold text-success mt-2">₹{Number(checkoutResult.grandTotal).toLocaleString("en-IN")}</Text>
  <Pressable onPress={() => setCheckoutResult(null)} className="mt-6 bg-primary px-8 py-3 rounded-xl">
  <Text className="text-white font-bold">New Estimate</Text>
  </Pressable>
  <Pressable onPress={() => setView("list")} className="mt-3">
  <Text className="text-primary font-semibold">View All Estimates</Text>
  </Pressable>
  </View>
  </View>
 ) : (
  <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
  <View className="flex-row items-center justify-between mt-2 mb-4">
  <View className="flex-row items-center" style={{ gap: 10 }}>
  <View className="w-1.5 h-7 rounded-full bg-amber-500" />
  <Text className="text-2xl font-black text-on-surface">New Estimate</Text>
  </View>
  <Pressable onPress={() => setView("list")} className="bg-surface-container px-4 py-2 rounded-lg">
  <Text className="text-sm font-bold text-on-surface-variant">History</Text>
  </Pressable>
  </View>

 {/* Customer Selection */}
 <Text className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Customer</Text>
 <Pressable onPress={() => setShowPartyPicker(true)} className="bg-surface-container-lowest rounded-xl p-3.5 mb-4 border border-outline-variant ">
 <Text className={selectedParty ? "text-base font-semibold text-on-surface " : "text-base text-on-surface-variant "}>
 {selectedParty ? `${selectedParty.name}${selectedParty.phone ? ` (${selectedParty.phone})` : ""}` : "Select customer"}
 </Text>
 </Pressable>

 {/* Product Grid */}
 <Text className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Products</Text>
 <TextInput
 className="bg-surface-container-lowest rounded-xl px-4 py-3 mb-3 border border-outline-variant text-base text-on-surface "
 placeholder="Search products..."
 placeholderTextColor={theme.colors.onSurfaceVariant}
 value={searchQuery}
 onChangeText={setSearchQuery}
 />
 {filteredProducts.length === 0 ? (
 <View className="py-8 items-center">
 <MaterialCommunityIcons name="package-variant-closed" size={32} color={theme.colors.outlineVariant} />
 <Text className="text-sm text-on-surface-variant mt-2">No products found</Text>
 </View>
 ) : (
 <View className="flex-row flex-wrap" style={{ marginHorizontal: -4 }}>
 {filteredProducts.slice(0, 20).map((p) => (
 <Pressable key={p.id} onPress={() => addToCart(p)} className="w-1/2 p-1">
 <View className="bg-surface-container-lowest rounded-xl p-3 border border-outline-variant ">
 <Text className="text-sm font-semibold text-on-surface " numberOfLines={1}>{p.name}</Text>
 <Text className="text-sm font-bold text-success mt-1">₹{Number(p.price).toLocaleString("en-IN")}</Text>
 {p.sku && <Text className="text-[10px] text-on-surface-variant mt-0.5">{p.sku}</Text>}
 <View className={`self-start mt-1.5 rounded-full px-2 py-0.5 ${p.stock_quantity > 5 ? "bg-green-100" : p.stock_quantity > 0 ? "bg-amber-100" : "bg-red-100"}`}>
 <Text className={`text-[10px] font-bold ${p.stock_quantity > 5 ? "text-green-700" : p.stock_quantity > 0 ? "text-amber-700" : "text-red-700"}`}>
 {p.stock_quantity > 0 ? `${p.stock_quantity} left` : "Out"}
 </Text>
 </View>
 </View>
 </Pressable>
 ))}
 </View>
 )}

 {/* Cart */}
 <Text className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5 mt-4">Cart ({cart.length})</Text>
 {cart.length === 0 ? (
 <View className="bg-surface-container-lowest rounded-xl p-6 items-center">
 <MaterialCommunityIcons name="cart-outline" size={32} color={theme.colors.outlineVariant} />
 <Text className="text-sm text-on-surface-variant mt-2">Cart is empty</Text>
 </View>
 ) : (
 <View className="bg-surface-container-lowest rounded-xl overflow-hidden">
 {cart.map((c) => (
 <View key={c.product.id} className="flex-row items-center px-3 py-2.5 border-b border-outline-variant ">
 <Text className="flex-1 text-sm font-medium text-on-surface " numberOfLines={1}>{c.product.name}</Text>
 <View className="flex-row items-center gap-2">
 <Pressable onPress={() => setCart(cart.map((ci) => ci.product.id === c.product.id ? { ...ci, quantity: Math.max(1, ci.quantity - 1) } : ci))}>
 <MaterialCommunityIcons name="minus-circle-outline" size={20} color={theme.colors.onSurfaceVariant} />
 </Pressable>
 <Text className="w-6 text-center font-bold text-on-surface ">{c.quantity}</Text>
 <Pressable onPress={() => setCart(cart.map((ci) => ci.product.id === c.product.id ? { ...ci, quantity: ci.quantity + 1 } : ci))}>
 <MaterialCommunityIcons name="plus-circle-outline" size={20} color={theme.colors.onSurfaceVariant} />
 </Pressable>
 <Text className="w-16 text-right font-semibold text-on-surface ">₹{(Number(c.product.price) * c.quantity).toLocaleString("en-IN")}</Text>
 <Pressable onPress={() => setCart(cart.filter((ci) => ci.product.id !== c.product.id))}>
 <MaterialCommunityIcons name="delete-outline" size={18} color={theme.colors.error} />
 </Pressable>
 </View>
 </View>
 ))}
 </View>
 )}

 {/* Discount & GST */}
 <View className="bg-surface-container-lowest rounded-xl p-3.5 mt-3 space-y-3">
 <View className="flex-row items-center justify-between">
 <Text className="text-sm font-medium text-on-surface ">Discount %</Text>
 <TextInput
 className="bg-surface-container rounded-lg px-3 py-1.5 text-right w-20 text-base text-on-surface "
 keyboardType="numeric"
 value={String(discountPercent)}
 onChangeText={(t) => setDiscountPercent(Math.max(0, Math.min(100, Number(t) || 0)))}
 />
 </View>
 <Pressable onPress={() => setApplyGst(!applyGst)} className="flex-row items-center gap-2">
 <MaterialCommunityIcons name={applyGst ? "checkbox-marked" : "checkbox-blank-outline"} size={20} color={theme.colors.primary} />
 <Text className="text-sm font-medium text-on-surface ">Apply GST (18%)</Text>
 </Pressable>
 </View>

 {/* Totals */}
 <View className="bg-surface-container-lowest rounded-xl p-3.5 mt-3">
 <View className="flex-row justify-between py-1"><Text className="text-sm text-on-surface-variant ">Subtotal</Text><Text className="text-sm font-semibold text-on-surface ">₹{subtotal.toLocaleString("en-IN")}</Text></View>
 {discountPercent > 0 && <View className="flex-row justify-between py-1"><Text className="text-sm text-error">Discount</Text><Text className="text-sm text-error">-₹{discountAmount.toLocaleString("en-IN")}</Text></View>}
 {applyGst && <View className="flex-row justify-between py-1"><Text className="text-sm text-on-surface-variant ">GST (18%)</Text><Text className="text-sm font-semibold text-on-surface ">₹{taxTotal.toLocaleString("en-IN")}</Text></View>}
 <View className="flex-row justify-between pt-2 mt-1 border-t border-outline-variant ">
 <Text className="text-base font-bold text-on-surface ">Total</Text>
 <Text className="text-base font-bold text-success">₹{grandTotal.toLocaleString("en-IN")}</Text>
 </View>
 </View>

 {/* Create button */}
  <Pressable
  onPress={handleCheckout}
  disabled={submitting || !selectedParty || cart.length === 0}
  className="mt-4 bg-amber-500 py-4 rounded-2xl items-center shadow-sm"
  style={{ opacity: submitting || !selectedParty || cart.length === 0 ? 0.5 : 1 }}
  >
  {submitting ? (
  <ActivityIndicator color="white" />
  ) : (
  <Text className="text-white font-black text-lg">Create Estimate</Text>
  )}
  </Pressable>
 </ScrollView>
 )}

 {/* Party Picker Modal */}
  {/* Party Picker Modal */}
  <Modal visible={showPartyPicker} animationType="slide" transparent>
  <View className="flex-1 bg-black/50">
  <View className="bg-surface-container-lowest mt-20 rounded-t-3xl flex-1 px-5 pt-5">
  <View className="flex-row items-center justify-between mb-4">
  <View className="flex-row items-center" style={{ gap: 8 }}>
  <View className="w-1 h-6 rounded-full bg-amber-500" />
  <Text className="text-lg font-bold text-on-surface">Select Customer</Text>
  </View>
  <Pressable onPress={() => setShowPartyPicker(false)} className="bg-surface-container p-2 rounded-full"><MaterialCommunityIcons name="close" size={20} color={theme.colors.onSurfaceVariant} /></Pressable>
  </View>
  <TextInput
  className="bg-surface-container rounded-xl px-4 py-3 mb-4 text-base text-on-surface border border-outline-variant"
  placeholder="Search customer..."
  placeholderTextColor={theme.colors.onSurfaceVariant}
  value={partySearch}
  onChangeText={setPartySearch}
  />
  <FlatList
  data={filteredParties}
  keyExtractor={(item) => item.id}
  contentContainerStyle={{ paddingBottom: 24 }}
  renderItem={({ item }) => (
  <Pressable
  onPress={() => { setSelectedParty(item); setShowPartyPicker(false); }}
  className="bg-surface-container-lowest p-4 rounded-xl mb-2 border border-outline-variant"
  >
  <Text className="text-base font-semibold text-on-surface">{item.name}</Text>
  {item.phone && <Text className="text-sm text-on-surface-variant mt-0.5">{item.phone}</Text>}
  </Pressable>
  )}
  />
  </View>
  </View>
  </Modal>
 </KeyboardAvoidingView>
 </View>
 );
}
