import React, { useState } from "react";
import {
 Text,
 View,
 ScrollView,
 TextInput,
 Pressable,
 ActivityIndicator,
 Alert,
 KeyboardAvoidingView,
 Platform,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { api, ApiError } from "../src/lib/api";
import { useTopInset } from "../src/lib/useTopInset";
import { useBottomInset } from "../src/lib/useBottomInset";

interface PurchaseItem {
 productId: string;
 quantity: number;
 cost: number;
 taxRate: number;
 product?: { name?: string };
}

interface PurchaseDetail {
 id: string;
 purchaseNumber: string;
 supplier?: { id: string; name: string };
 items: PurchaseItem[];
 debitNotes?: { items: { productId: string; quantity: number }[] }[];
}

interface ReturnLine {
 productId: string;
 productName: string;
 maxQty: number;
 cost: number;
 taxRate: number;
 quantity: string;
}

export default function DebitNoteScreen() {
 const topInset = useTopInset();
 const bottomInset = useBottomInset();

 const [purchaseNumber, setPurchaseNumber] = useState("");
 const [purchase, setPurchase] = useState<PurchaseDetail | null>(null);
 const [lines, setLines] = useState<ReturnLine[]>([]);
 const [reason, setReason] = useState("");
 const [searching, setSearching] = useState(false);
 const [submitting, setSubmitting] = useState(false);
 const [result, setResult] = useState<any | null>(null);

 const findPurchase = async () => {
 if (!purchaseNumber.trim()) return;
 setSearching(true);
 setPurchase(null);
 setLines([]);
 try {
 const listRes = await api.get<{ data: any[] }>("/purchases", { params: { search: purchaseNumber.trim() } });
 const found = listRes.data.find((p) => p.purchaseNumber === purchaseNumber.trim()) || listRes.data[0];
 if (!found) {
 Alert.alert("Not Found", "No purchase matches that number.");
 return;
 }
 const detailRes = await api.get<{ data: PurchaseDetail }>(`/purchases/${found.id}/detail`);
 const full = detailRes.data;
 setPurchase(full);
 const alreadyReturned: Record<string, number> = {};
 (full.debitNotes || []).forEach((dn) => dn.items.forEach((i) => { alreadyReturned[i.productId] = (alreadyReturned[i.productId] || 0) + Number(i.quantity); }));
 setLines(
 full.items.map((it) => ({
 productId: it.productId,
 productName: it.product?.name || it.productId,
 maxQty: Math.max(0, Number(it.quantity) - (alreadyReturned[it.productId] || 0)),
 cost: Number(it.cost),
 taxRate: Number(it.taxRate),
 quantity: "",
 }))
 );
 } catch (e) {
 Alert.alert("Error", e instanceof ApiError ? e.message : "Failed to look up purchase.");
 } finally {
 setSearching(false);
 }
 };

 const updateQty = (productId: string, value: string) => {
 setLines((prev) => prev.map((l) => (l.productId === productId ? { ...l, quantity: value } : l)));
 };

 const activeLines = lines.filter((l) => (parseFloat(l.quantity) || 0) > 0);
 const subtotal = activeLines.reduce((s, l) => s + l.cost * (parseFloat(l.quantity) || 0), 0);

 const submit = async () => {
 if (!purchase || activeLines.length === 0) return;
 setSubmitting(true);
 try {
 const res = await api.post<{ data: any }>("/debit-notes", {
 purchaseId: purchase.id,
 reason: reason || undefined,
 items: activeLines.map((l) => ({ productId: l.productId, quantity: parseFloat(l.quantity), cost: l.cost, taxRate: l.taxRate })),
 });
 setResult(res.data);
 setPurchase(null);
 setLines([]);
 setPurchaseNumber("");
 setReason("");
 } catch (e) {
 Alert.alert("Error", e instanceof ApiError ? e.message : "Failed to create debit note.");
 } finally {
 setSubmitting(false);
 }
 };

 if (result) {
 return (
 <View className="flex-1 items-center justify-center bg-background px-8" style={{ paddingTop: topInset }}>
 <MaterialCommunityIcons name="check-circle" size={48} color="#2E9E5B" />
 <Text className="text-xl font-black text-text-primary mt-3">Debit Note Created</Text>
 <Text className="text-base text-text-secondary mt-1">#{result.debitNoteNumber}</Text>
 <Text className="text-sm text-text-secondary mt-1">₹{Number(result.grandTotal).toLocaleString("en-IN")} — stock &amp; balance updated</Text>
 <View className="flex-row mt-6" style={{ gap: 10 }}>
 <Pressable onPress={() => setResult(null)} className="bg-primary px-5 py-3 rounded-xl">
 <Text className="text-white font-bold">New Debit Note</Text>
 </Pressable>
 <Pressable onPress={() => router.back()} className="border border-primary px-5 py-3 rounded-xl">
 <Text className="text-primary font-bold">Done</Text>
 </Pressable>
 </View>
 </View>
 );
 }

 return (
 <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : undefined}>
 <ScrollView className="flex-1 bg-background px-6" style={{ paddingTop: topInset }} keyboardShouldPersistTaps="handled">
 <Text className="text-2xl font-black text-text-primary mb-1">Debit Note</Text>
 <Text className="text-sm text-text-secondary mb-4">Record a purchase return against an existing bill.</Text>

 <View className="flex-row mb-4" style={{ gap: 8 }}>
 <TextInput
 value={purchaseNumber}
 onChangeText={setPurchaseNumber}
 placeholder="Purchase number, e.g. PO-2026-000045"
 placeholderTextColor="#A0A0A0"
 className="flex-1 bg-surface border border-gray-200 rounded-xl px-4 py-3 text-base font-medium text-text-primary"
 />
 <Pressable onPress={findPurchase} disabled={searching} className="bg-primary px-5 rounded-xl items-center justify-center">
 {searching ? <ActivityIndicator color="white" size="small" /> : <Text className="text-white font-bold">Find</Text>}
 </Pressable>
 </View>

 {purchase && (
 <>
 <Text className="text-sm text-text-secondary mb-2">
 Supplier: <Text className="font-bold text-text-primary ">{purchase.supplier?.name || "—"}</Text>
 </Text>

 {lines.map((l) => (
 <View key={l.productId} className="bg-surface p-4 rounded-xl border border-gray-100 mb-3">
 <Text className="font-bold text-on-surface mb-1">{l.productName}</Text>
 <View className="flex-row justify-between items-center">
 <Text className="text-sm text-text-secondary">₹{l.cost} × max {l.maxQty}</Text>
 <TextInput
 value={l.quantity}
 onChangeText={(v) => updateQty(l.productId, v)}
 placeholder="0"
 keyboardType="numeric"
 editable={l.maxQty > 0}
 className="bg-background border border-gray-200 rounded-xl px-3 py-2.5 text-base font-bold w-20 text-center"
 />
 </View>
 </View>
 ))}

 <Text className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider mb-2">Reason</Text>
 <TextInput
 value={reason}
 onChangeText={setReason}
 placeholder="Damaged goods, wrong item, etc."
 placeholderTextColor="#A0A0A0"
 className="bg-surface border border-gray-200 rounded-xl px-4 py-3 text-base font-medium text-text-primary mb-4"
 />

 {activeLines.length > 0 && (
 <View className="flex-row justify-between items-center py-3 border-t border-gray-100 mb-4">
 <Text className="text-base font-bold text-text-primary ">Debit Amount</Text>
 <Text className="text-lg font-black text-text-primary ">₹{subtotal.toLocaleString("en-IN")}</Text>
 </View>
 )}

 <Pressable
 onPress={submit}
 disabled={submitting || activeLines.length === 0}
 className="bg-primary py-4 rounded-xl items-center"
 style={{ marginBottom: bottomInset + 16, opacity: submitting || activeLines.length === 0 ? 0.5 : 1 }}
 >
 {submitting ? <ActivityIndicator color="white" /> : <Text className="text-white font-bold text-base">Create Debit Note</Text>}
 </Pressable>
 </>
 )}
 </ScrollView>
 </KeyboardAvoidingView>
 );
}
