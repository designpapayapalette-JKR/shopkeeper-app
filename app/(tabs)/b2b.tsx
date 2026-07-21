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
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useTopInset, useBottomInset } from "../../src/lib/useTopInset";
import EmptyState from "../../src/components/EmptyState";

// Indian lakh/crore grouping — shopkeeper-mobile-design-system.md §3.1.
// decimals=2 preserves exact paise on amounts actually owed (cart totals);
// 0 is used for catalogue/unit prices, matching prior toFixed(0) usage.
function formatRupee(n: number, decimals: 0 | 2 = 0): string {
 const val = Number.isFinite(n) ? n : 0;
 return `₹${val.toLocaleString("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

interface Product {
 id: string;
 name: string;
 sku: string | null;
 barcode: string | null;
 hsn_code: string | null;
 price: string;
 mrp: string | null;
 tax_rate: string;
 stock_quantity: number;
}

interface Party {
 id: string;
 name: string;
 phone: string | null;
 gstin: string | null;
 current_balance: string | null;
 credit_limit: string | null;
}

interface CartItem {
 product: Product;
 quantity: number;
 discount: number;
}

export default function B2bScreen() {
 const { user } = useAuth();
 const topInset = useTopInset();
 const bottomInset = useBottomInset();
 const theme = useTheme();

 const [products, setProducts] = useState<Product[]>([]);
 const [parties, setParties] = useState<Party[]>([]);
 const [selectedParty, setSelectedParty] = useState<Party | null>(null);
 const [cart, setCart] = useState<CartItem[]>([]);
 const [searchQuery, setSearchQuery] = useState("");
 const [partySearch, setPartySearch] = useState("");
 const [loading, setLoading] = useState(true);

 const [isSelectingParty, setIsSelectingParty] = useState(false);
 const [showCheckout, setShowCheckout] = useState(false);
 const [checkoutLoading, setCheckoutLoading] = useState(false);
 const [addPartyModal, setAddPartyModal] = useState(false);
 const [newPartyName, setNewPartyName] = useState("");
 const [newPartyPhone, setNewPartyPhone] = useState("");
 const [newPartyGstin, setNewPartyGstin] = useState("");
 const [newPartyState, setNewPartyState] = useState("");
 const [newPartyAddress, setNewPartyAddress] = useState("");
 const [newPartyCreditLimit, setNewPartyCreditLimit] = useState("");
 const [newPartyNote, setNewPartyNote] = useState("");
 const [addPartyLoading, setAddPartyLoading] = useState(false);

 const [paymentMode, setPaymentMode] = useState<"cash" | "upi" | "credit">("cash");
 const [invoiceType, setInvoiceType] = useState<"gst" | "retail" | "estimate" | "bill_of_supply">("gst");
 const [applyRoundOff, setApplyRoundOff] = useState(true);

 const B2B_API = "/b2b";

 useEffect(() => {
 loadData();
 }, []);

 const loadData = async () => {
 setLoading(true);
 try {
 const [pRes, ptRes] = await Promise.all([
 api.get<{ data: Product[] }>(`${B2B_API}/products`),
 api.get<{ data: Party[] }>(`${B2B_API}/parties`),
 ]);
 setProducts(pRes.data ?? []);
 setParties(ptRes.data ?? []);
 } catch (e) {
 console.warn("Failed to load B2B data", e);
 } finally {
 setLoading(false);
 }
 };

 const filteredProducts = products.filter(
 (p) =>
 p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
 (p.sku && p.sku.toLowerCase().includes(searchQuery.toLowerCase()))
 );

 const filteredParties = parties.filter(
 (p) =>
 p.name.toLowerCase().includes(partySearch.toLowerCase()) ||
 (p.phone && p.phone.includes(partySearch))
 );

 const addToCart = (product: Product) => {
 if (!selectedParty) {
 setIsSelectingParty(true);
 return;
 }
 setCart((prev) => {
 const existing = prev.find((c) => c.product.id === product.id);
 if (existing) {
 return prev.map((c) =>
 c.product.id === product.id ? { ...c, quantity: c.quantity + 1 } : c
 );
 }
 return [...prev, { product, quantity: 1, discount: 0 }];
 });
 };

 const updateQuantity = (productId: string, delta: number) => {
 setCart((prev) =>
 prev
 .map((c) =>
 c.product.id === productId ? { ...c, quantity: c.quantity + delta } : c
 )
 .filter((c) => c.quantity > 0)
 );
 };

 const subtotal = cart.reduce((s, c) => s + parseFloat(c.product.price) * c.quantity, 0);
 const discountTotal = cart.reduce((s, c) => s + c.discount * c.quantity, 0);
 const taxTotal = invoiceType === "gst"
 ? cart.reduce((s, c) => s + (parseFloat(c.product.price) - c.discount) * c.quantity * (parseFloat(c.product.tax_rate) / 100), 0)
 : 0;
 const grandTotal = Math.max(0, subtotal - discountTotal + taxTotal);

 const handleAddParty = async () => {
 const name = newPartyName.trim();
 if (!name) {
 Alert.alert("Required", "Enter a customer name.");
 return;
 }
 setAddPartyLoading(true);
 try {
 const res = await api.post<{ data: Party }>("/parties", {
 name,
 phone: newPartyPhone.trim() || undefined,
 gstin: newPartyGstin.trim() || undefined,
 state: newPartyState.trim() || undefined,
 address: newPartyAddress.trim() || undefined,
 creditLimit: newPartyCreditLimit.trim() === "" ? undefined : Number(newPartyCreditLimit),
 type: "customer",
 category: "b2b",
 });
 const newParty = res.data;
 if (newPartyNote.trim()) {
 await api.post(`/parties/${newParty.id}/notes`, { body: newPartyNote.trim() }).catch(() => {});
 }
 setParties((prev) => [newParty, ...prev]);
 setSelectedParty(newParty);
 setIsSelectingParty(false);
 setAddPartyModal(false);
 setNewPartyName("");
 setNewPartyPhone("");
 setNewPartyGstin("");
 setNewPartyState("");
 setNewPartyAddress("");
 setNewPartyCreditLimit("");
 setNewPartyNote("");
 } catch (e: any) {
 Alert.alert("Error", e.message || "Failed to add customer");
 } finally {
 setAddPartyLoading(false);
 }
 };

 const handleCheckout = async () => {
 if (cart.length === 0) return;
 if (!selectedParty) {
 Alert.alert("No Customer", "Select or add a customer first.");
 return;
 }
 if (!user?.company_id) return;

 setCheckoutLoading(true);
 try {
 const res = await api.post<{ data: any }>(`${B2B_API}/checkout`, {
 partyId: selectedParty.id,
 warehouseId: user.company_id,
 type: invoiceType,
 paymentMode,
 items: cart.map((c) => ({
 productId: c.product.id,
 quantity: c.quantity,
 price: parseFloat(c.product.price),
 taxRate: parseFloat(c.product.tax_rate),
 discount: c.discount,
 })),
 discountTotal,
 applyRoundOff,
 });
 Alert.alert("Invoice Created", `Invoice #${res.data.invoiceNumber || res.data.id?.substring(0, 8)}`, [
 { text: "New Sale", onPress: () => { setCart([]); setSelectedParty(null); loadData(); } },
 ]);
 setShowCheckout(false);
 } catch (e: any) {
 Alert.alert("Checkout Failed", e.message || "Server error");
 } finally {
 setCheckoutLoading(false);
 }
 };

 const renderProductCard = ({ item }: { item: Product }) => {
 const inCart = cart.find((c) => c.product.id === item.id);
 return (
 <Pressable
 onPress={() => addToCart(item)}
 className="bg-surface-container-lowest rounded-2xl border border-outline-variant p-4 mb-3 active:opacity-75"
 style={inCart ? { borderColor: theme.colors.primary, borderWidth: 2 } : undefined}
 >
 <View className="flex-row justify-between items-start mb-1">
 <Text numberOfLines={2} className="text-base font-bold text-on-surface flex-1 mr-2">
 {item.name}
 </Text>
 {item.sku && (
 <Text className="text-[10px] text-on-surface-variant font-mono bg-surface-container px-1.5 py-0.5 rounded">
 {item.sku}
 </Text>
 )}
 </View>
 <View className="flex-row items-center justify-between mt-1">
 <View>
 <Text className="text-lg font-black text-primary ">
 {formatRupee(parseFloat(item.price))}
 </Text>
 {item.mrp && parseFloat(item.mrp) > parseFloat(item.price) && (
 <Text className="text-xs text-on-surface-variant line-through">{formatRupee(parseFloat(item.mrp))}</Text>
 )}
 </View>
 <View className="flex-row items-center gap-1">
 {inCart && (
 <View className="bg-primary/10 px-2 py-1 rounded-full">
 <Text className="text-primary text-xs font-bold">{inCart.quantity}</Text>
 </View>
 )}
 <MaterialCommunityIcons name="plus-circle" size={24} color={theme.colors.primary} />
 </View>
 </View>
 </Pressable>
 );
 };

 if (loading) {
 return (
 <View className="flex-1 justify-center items-center bg-background ">
 <ActivityIndicator size="large" color={theme.colors.primary} />
 </View>
 );
 }

 return (
 <View className="flex-1 bg-background " style={{ paddingTop: topInset }}>
 {/* Header */}
 <View className="px-5 pt-2 pb-3 border-b border-outline-variant ">
 <View className="flex-row items-center gap-2 mb-1">
 <View className="w-1.5 h-6 rounded-full bg-primary" />
 <Text className="text-[10px] font-bold tracking-widest uppercase text-primary ">B2B Sales</Text>
 <View className="bg-primary/15 px-2 py-0.5 rounded-md">
 <Text className="text-[9px] font-black text-primary tracking-widest">B2B</Text>
 </View>
 </View>
 <View className="flex-row justify-between items-center">
 <Text className="text-2xl font-black text-on-surface ">New B2B Sale</Text>
 </View>
 </View>

 {/* Customer Section — Prominent, always visible */}
 <View className="px-5 pt-3 pb-2 bg-primary/5 border-b border-outline-variant ">
 <Pressable
 onPress={() => setIsSelectingParty(true)}
 className="flex-row items-center justify-between"
 >
 <View className="flex-row items-center flex-1">
 <View className="w-10 h-10 rounded-full bg-primary/20 items-center justify-center mr-3">
 <MaterialCommunityIcons name="account-tie" size={20} color={theme.colors.primary} />
 </View>
 <View className="flex-1">
 <Text className="text-xs font-bold text-primary uppercase tracking-widest">Customer</Text>
 {selectedParty ? (
 <View>
 <Text className="text-base font-bold text-on-surface ">{selectedParty.name}</Text>
 {selectedParty.gstin && (
 <Text className="text-xs text-on-surface-variant ">GST: {selectedParty.gstin}</Text>
 )}
 </View>
 ) : (
 <Text className="text-base font-bold text-on-surface-variant ">Tap to select customer first →</Text>
 )}
 </View>
 </View>
 {selectedParty && (
 <Pressable
 onPress={() => { setSelectedParty(null); setCart([]); }}
 className="bg-surface-container px-3 py-1.5 rounded-full"
 >
 <Text className="text-xs font-bold text-on-surface-variant ">Change</Text>
 </Pressable>
 )}
 </Pressable>
 </View>

 {/* Search */}
 <View className="px-5 pt-3 pb-2">
 <View className="bg-surface-container-lowest border border-outline-variant rounded-2xl px-4 py-3 flex-row items-center">
 <MaterialCommunityIcons name="magnify" size={18} color={theme.colors.onSurfaceVariant} style={{ marginRight: 8 }} />
 <TextInput
 placeholder="Search products..."
 placeholderTextColor="#A0A0A0"
 value={searchQuery}
 onChangeText={setSearchQuery}
 className="flex-1 text-base font-medium text-on-surface "
 />
 </View>
 </View>

 {/* Product Grid */}
 <FlatList
 data={filteredProducts}
 keyExtractor={(item) => item.id}
 renderItem={renderProductCard}
 className="px-5 flex-1"
 contentContainerStyle={{ paddingBottom: 120 }}
 showsVerticalScrollIndicator={false}
 ListEmptyComponent={
 <EmptyState
 icon="package-variant-closed"
 title="No products found"
 description="Try a different search, or add this product from Inventory first."
 />
 }
 />

 {/* Cart Bar */}
 {cart.length > 0 && (
 <View className="absolute bottom-0 left-0 right-0 bg-primary px-5 py-3 flex-row justify-between items-center" style={{ paddingBottom: bottomInset }}>
 <View>
 <Text className="text-white/70 text-xs font-semibold uppercase tracking-wider">
 {cart.reduce((s, c) => s + c.quantity, 0)} item{cart.reduce((s, c) => s + c.quantity, 0) !== 1 ? "s" : ""}
 </Text>
 <Text className="text-white font-black text-lg">{formatRupee(grandTotal)}</Text>
 </View>
 <View className="flex-row items-center gap-2">
 <Pressable
 onPress={() => setCart([])}
 className="bg-white/15 px-3 py-2 rounded-lg"
 >
 <Text className="text-white font-bold text-xs">Clear</Text>
 </Pressable>
 <Pressable
 onPress={() => setShowCheckout(true)}
 className="bg-white px-4 py-2 rounded-lg flex-row items-center gap-1"
 >
 <Text className="text-primary font-black">Review</Text>
 <MaterialCommunityIcons name="arrow-right" size={16} color={theme.colors.primary} />
 </Pressable>
 </View>
 </View>
 )}

 {/* ══════ Select Customer Modal ══════ */}
 <Modal visible={isSelectingParty} animationType="slide" onRequestClose={() => setIsSelectingParty(false)}>
 <SafeAreaProvider>
 <View className="flex-1 bg-background ">
 <View className="px-5 pb-4 border-b border-outline-variant flex-row justify-between items-center" style={{ paddingTop: topInset }}>
 <Text className="text-2xl font-black text-on-surface ">Select Customer</Text>
 <Pressable onPress={() => setIsSelectingParty(false)} className="w-10 h-10 rounded-full bg-surface-container items-center justify-center">
 <MaterialCommunityIcons name="close" size={18} color={theme.colors.onSurfaceVariant} />
 </Pressable>
 </View>

 {/* Add Party */}
 <View className="px-5 pt-4 mb-2">
 <Pressable
 onPress={() => setAddPartyModal(true)}
 className="bg-primary/10 rounded-2xl border border-primary/30 p-4 flex-row items-center gap-3 active:opacity-75"
 >
 <View className="w-10 h-10 rounded-full bg-primary/20 items-center justify-center">
 <MaterialCommunityIcons name="account-plus" size={20} color={theme.colors.primary} />
 </View>
 <View className="flex-1">
 <Text className="text-sm font-bold text-primary ">Add Party</Text>
 <Text className="text-xs text-on-surface-variant ">Name, GST, credit limit, and notes</Text>
 </View>
 <MaterialCommunityIcons name="chevron-right" size={20} color={theme.colors.primary} />
 </Pressable>
 </View>

 <View className="px-5 pt-2 flex-row gap-2 mb-2">
 <View className="flex-1 bg-surface-container-lowest border border-outline-variant rounded-2xl px-4 py-3 flex-row items-center">
 <MaterialCommunityIcons name="magnify" size={18} color={theme.colors.onSurfaceVariant} style={{ marginRight: 8 }} />
 <TextInput
 placeholder="Search by name or phone..."
 placeholderTextColor="#A0A0A0"
 value={partySearch}
 onChangeText={setPartySearch}
 className="flex-1 text-base font-medium text-on-surface "
 />
 </View>
 </View>

 <FlatList
 data={filteredParties}
 keyExtractor={(item) => item.id}
 className="px-5 pt-2"
 keyboardShouldPersistTaps="handled"
 contentContainerStyle={{ paddingBottom: bottomInset }}
 renderItem={({ item }) => (
 <Pressable
 onPress={() => {
 setSelectedParty(item);
 setIsSelectingParty(false);
 }}
 className="bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant mb-3 flex-row justify-between items-center active:opacity-75"
 >
 <View className="flex-1">
 <Text className="font-bold text-base text-on-surface ">{item.name}</Text>
 <Text className="text-sm text-on-surface-variant mt-0.5">
 {item.phone || "No phone"}{item.gstin ? ` · GST: ${item.gstin}` : ""}
 </Text>
 </View>
 <View className="bg-primary/10 px-3 py-1.5 rounded-full ml-3">
 <Text className="text-primary text-sm font-bold">Select</Text>
 </View>
 </Pressable>
 )}
 ListEmptyComponent={
 <EmptyState
 icon="account-group"
 title="No customers found"
 description="Try a different search, or add a new B2B customer below."
 actionLabel="Add Customer"
 onAction={() => setAddPartyModal(true)}
 />
 }
 />
 </View>
 </SafeAreaProvider>
 </Modal>

 {/* ══════ Checkout Modal ══════ */}
 <Modal visible={showCheckout} animationType="slide" onRequestClose={() => setShowCheckout(false)}>
 <SafeAreaProvider>
 <View className="flex-1 bg-background px-5" style={{ paddingTop: topInset, paddingBottom: bottomInset }}>
 <View className="flex-row justify-between items-center mb-6">
 <Text className="text-2xl font-black text-on-surface ">Checkout</Text>
 <Pressable onPress={() => setShowCheckout(false)} className="w-10 h-10 rounded-full bg-surface-container items-center justify-center">
 <MaterialCommunityIcons name="close" size={18} color={theme.colors.onSurfaceVariant} />
 </Pressable>
 </View>

 <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
 {/* Customer summary */}
 <View className="bg-surface-container-lowest rounded-2xl border border-outline-variant p-4 mb-4">
 <Text className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-1">Customer</Text>
 <Text className="text-lg font-bold text-on-surface ">{selectedParty?.name}</Text>
 {selectedParty?.gstin && (
 <Text className="text-sm text-on-surface-variant ">GST: {selectedParty.gstin}</Text>
 )}
 </View>

 {/* Invoice type — 2x2 grid rather than 4-across, since "Bill of
 Supply" doesn't fit on one line in a quarter-width button on
 a 360px-wide phone. */}
 <Text className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2">Bill Type</Text>
 <View className="flex-row flex-wrap mb-4" style={{ gap: 8 }}>
 {(["gst", "retail", "estimate", "bill_of_supply"] as const).map((t) => (
 <Pressable
 key={t}
 onPress={() => setInvoiceType(t)}
 className={`py-3 rounded-xl items-center border ${
 invoiceType === t ? "bg-primary border-primary" : "border-outline-variant "
 }`}
 style={{ width: "48%" }}
 >
 <Text className={`text-xs font-bold text-center ${invoiceType === t ? "text-white" : "text-on-surface-variant "}`} numberOfLines={1}>
 {t === "gst" ? "GST" : t === "retail" ? "Retail" : t === "estimate" ? "Estimate" : "Bill of Supply"}
 </Text>
 </Pressable>
 ))}
 </View>

 <Pressable
 onPress={() => setApplyRoundOff((v) => !v)}
 className={`flex-row items-center justify-between px-3 py-2.5 rounded-xl border mb-4 ${
 applyRoundOff ? "bg-primary/10 border-primary" : "border-outline-variant "
 }`}
 >
 <Text className="text-xs font-bold text-on-surface ">Round off total to nearest ₹1</Text>
 <MaterialCommunityIcons
 name={applyRoundOff ? "toggle-switch" : "toggle-switch-off-outline"}
 size={26}
 color={applyRoundOff ? theme.colors.primary : theme.colors.onSurfaceVariant}
 />
 </Pressable>

 {/* Payment mode */}
 <Text className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2">Payment</Text>
 <View className="flex-row gap-2 mb-4">
 {(["cash", "upi", "credit"] as const).map((m) => (
 <Pressable
 key={m}
 onPress={() => setPaymentMode(m)}
 className={`flex-1 py-3 rounded-xl items-center border ${
 paymentMode === m ? "bg-primary border-primary" : "border-outline-variant "
 }`}
 >
 <MaterialCommunityIcons
 name={m === "cash" ? "cash" : m === "upi" ? "cellphone" : "book-account-outline"}
 size={16}
 color={paymentMode === m ? "white" : theme.colors.onSurfaceVariant}
 />
 <Text className={`text-xs font-bold mt-0.5 capitalize ${paymentMode === m ? "text-white" : "text-on-surface-variant "}`}>{m}</Text>
 </Pressable>
 ))}
 </View>

 {/* Cart items */}
 <Text className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2">Items ({cart.length})</Text>
 {cart.map((c) => (
 <View key={c.product.id} className="bg-surface-container-lowest rounded-xl border border-outline-variant px-4 py-3 mb-2">
 <View className="flex-row items-center">
 <View className="flex-1 mr-2">
 <Text numberOfLines={1} className="font-bold text-sm text-on-surface ">{c.product.name}</Text>
 <Text className="text-xs text-on-surface-variant ">{formatRupee(parseFloat(c.product.price), 2)} × {c.quantity}</Text>
 </View>
 <View className="flex-row items-center gap-2">
 <Pressable onPress={() => updateQuantity(c.product.id, -1)} className="w-7 h-7 rounded-full bg-surface-container items-center justify-center">
 <MaterialCommunityIcons name="minus" size={14} color={theme.colors.onSurfaceVariant} />
 </Pressable>
 <Text className="text-base font-black text-on-surface min-w-[20px] text-center">{c.quantity}</Text>
 <Pressable onPress={() => updateQuantity(c.product.id, 1)} className="w-7 h-7 rounded-full bg-surface-container items-center justify-center">
 <MaterialCommunityIcons name="plus" size={14} color={theme.colors.onSurfaceVariant} />
 </Pressable>
 </View>
 <Text className="font-black text-base text-primary min-w-[60px] text-right ml-2">
 {formatRupee((parseFloat(c.product.price) * c.quantity))}
 </Text>
 </View>
 </View>
 ))}
 </ScrollView>

 {/* Total + Checkout */}
 <View className="pt-4 border-t border-outline-variant ">
 <View className="flex-row justify-between mb-1">
 <Text className="text-sm text-on-surface-variant ">Subtotal</Text>
 <Text className="text-sm font-bold text-on-surface ">{formatRupee(subtotal, 2)}</Text>
 </View>
 {discountTotal > 0 && (
 <View className="flex-row justify-between mb-1">
 <Text className="text-sm text-error">Discount</Text>
 <Text className="text-sm font-bold text-error">−{formatRupee(discountTotal, 2)}</Text>
 </View>
 )}
 {taxTotal > 0 && (
 <View className="flex-row justify-between mb-1">
 <Text className="text-sm text-on-surface-variant ">GST</Text>
 <Text className="text-sm font-bold text-on-surface ">{formatRupee(taxTotal, 2)}</Text>
 </View>
 )}
 <View className="flex-row justify-between pt-2 border-t border-outline-variant ">
 <Text className="text-lg font-black text-on-surface ">Total</Text>
 <Text className="text-lg font-black text-primary ">{formatRupee(grandTotal, 2)}</Text>
 </View>
 <Pressable
 onPress={handleCheckout}
 disabled={checkoutLoading}
 className="bg-primary py-4 rounded-2xl items-center mt-4 active:opacity-90"
 >
 {checkoutLoading ? (
 <ActivityIndicator color="white" />
 ) : (
 <Text className="text-white font-black text-lg">Confirm B2B Sale · {formatRupee(grandTotal)}</Text>
 )}
 </Pressable>
 </View>
 </View>
 </SafeAreaProvider>
 </Modal>

 {/* Add Party Modal */}
 <Modal visible={addPartyModal} animationType="slide" onRequestClose={() => setAddPartyModal(false)}>
 <SafeAreaProvider>
 <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : undefined}>
 <View className="flex-1 bg-background ">
 <View className="px-5 pb-4 border-b border-outline-variant flex-row justify-between items-center" style={{ paddingTop: topInset }}>
 <Text className="text-2xl font-black text-on-surface ">Add Party</Text>
 <Pressable onPress={() => setAddPartyModal(false)} className="w-10 h-10 rounded-full bg-surface-container items-center justify-center">
 <MaterialCommunityIcons name="close" size={18} color={theme.colors.onSurfaceVariant} />
 </Pressable>
 </View>
 <ScrollView className="flex-1 px-5 pt-4" keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 24 }}>
 <Text className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-1">Customer Name *</Text>
 <TextInput
 value={newPartyName}
 onChangeText={setNewPartyName}
 placeholder="e.g. ABC Traders"
 placeholderTextColor="#A0A0A0"
 autoFocus
 className="bg-surface-container-lowest border border-outline-variant rounded-xl px-4 py-3 text-sm text-on-surface mb-3"
 />
 <Text className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-1">Phone Number</Text>
 <TextInput
 value={newPartyPhone}
 onChangeText={setNewPartyPhone}
 placeholder="e.g. 9876543210"
 placeholderTextColor="#A0A0A0"
 keyboardType="phone-pad"
 className="bg-surface-container-lowest border border-outline-variant rounded-xl px-4 py-3 text-sm text-on-surface mb-3"
 />
 <Text className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-1">GSTIN</Text>
 <TextInput
 value={newPartyGstin}
 onChangeText={(v) => setNewPartyGstin(v.toUpperCase())}
 placeholder="e.g. 22AAAAA0000A1Z5"
 placeholderTextColor="#A0A0A0"
 autoCapitalize="characters"
 className="bg-surface-container-lowest border border-outline-variant rounded-xl px-4 py-3 text-sm text-on-surface mb-3"
 />
 <Text className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-1">State</Text>
 <TextInput
 value={newPartyState}
 onChangeText={setNewPartyState}
 placeholder="e.g. Maharashtra"
 placeholderTextColor="#A0A0A0"
 className="bg-surface-container-lowest border border-outline-variant rounded-xl px-4 py-3 text-sm text-on-surface mb-3"
 />
 <Text className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-1">Address</Text>
 <TextInput
 value={newPartyAddress}
 onChangeText={setNewPartyAddress}
 placeholder="Billing address"
 placeholderTextColor="#A0A0A0"
 className="bg-surface-container-lowest border border-outline-variant rounded-xl px-4 py-3 text-sm text-on-surface mb-3"
 />
 <Text className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-1">Credit Limit (₹)</Text>
 <TextInput
 value={newPartyCreditLimit}
 onChangeText={setNewPartyCreditLimit}
 placeholder="Optional — leave blank for no cap"
 placeholderTextColor="#A0A0A0"
 keyboardType="numeric"
 className="bg-surface-container-lowest border border-outline-variant rounded-xl px-4 py-3 text-sm text-on-surface mb-3"
 />
 <Text className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-1">Note</Text>
 <TextInput
 value={newPartyNote}
 onChangeText={setNewPartyNote}
 placeholder="Payment terms agreed, special instructions..."
 placeholderTextColor="#A0A0A0"
 multiline
 numberOfLines={2}
 className="bg-surface-container-lowest border border-outline-variant rounded-xl px-4 py-3 text-sm text-on-surface mb-4"
 style={{ minHeight: 60, textAlignVertical: "top" }}
 />
 <Pressable
 onPress={handleAddParty}
 disabled={addPartyLoading}
 className="bg-primary py-3.5 rounded-xl items-center justify-center active:opacity-90"
 >
 {addPartyLoading ? (
 <ActivityIndicator color="white" size="small" />
 ) : (
 <Text className="text-white font-bold text-sm">Add & Select</Text>
 )}
 </Pressable>
 </ScrollView>
 </View>
 </KeyboardAvoidingView>
 </SafeAreaProvider>
 </Modal>
 </View>
 );
}
