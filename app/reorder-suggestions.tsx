import React, { useState, useEffect } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator, Alert, Modal, TextInput } from "react-native";
import { useTheme } from "react-native-paper";
import { api } from "../src/lib/api";
import { useTopInset } from "../src/lib/useTopInset";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import EmptyState from "../src/components/EmptyState";

interface Suggestion {
 product_id: string;
 product_name: string;
 sku?: string;
 current_stock: number;
 reorder_level: number;
 suggested_quantity: number;
 unit: string;
 unit_cost: number;
}

interface Supplier {
 id: string;
 name: string;
 phone: string | null;
}

export default function ReorderSuggestionsScreen() {
 const theme = useTheme();
 const topInset = useTopInset();
 const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
 const [loading, setLoading] = useState(true);
 const [selection, setSelection] = useState<Set<string>>(new Set());
 const [generating, setGenerating] = useState(false);

 // Supplier selection modal
 const [showSupplierModal, setShowSupplierModal] = useState(false);
 const [suppliers, setSuppliers] = useState<Supplier[]>([]);
 const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
 const [poNotes, setPoNotes] = useState("");

 const load = async () => {
 setLoading(true);
 try {
 const res = await api.get<{ data: Suggestion[] }>("/purchases/reorder-suggestions");
 setSuggestions(res.data ?? []);
 } catch (e) {
 Alert.alert("Error", "Could not load reorder suggestions.");
 } finally {
 setLoading(false);
 }
 };

 useEffect(() => { load(); }, []);

 const toggle = (id: string) => {
 setSelection((prev) => {
 const next = new Set(prev);
 if (next.has(id)) next.delete(id);
 else next.add(id);
 return next;
 });
 };

 const selectAll = () => {
 if (selection.size === suggestions.length) setSelection(new Set());
 else setSelection(new Set(suggestions.map((s) => s.product_id)));
 };

 const openGeneratePO = async () => {
 if (selection.size === 0) return;
 setGenerating(true);
 try {
 const res = await api.get<{ data: Supplier[] }>("/purchase-orders/suggestions/suppliers");
 setSuppliers(res.data ?? []);
 setSelectedSupplier(null);
 setPoNotes("");
 setShowSupplierModal(true);
 } catch {
 Alert.alert("Error", "Could not load suppliers.");
 } finally {
 setGenerating(false);
 }
 };

 const generatePO = async () => {
 if (!selectedSupplier) return;
 setGenerating(true);
 try {
 const items = suggestions
 .filter((s) => selection.has(s.product_id))
 .map((s) => ({
 productId: s.product_id,
 quantity: s.suggested_quantity,
 unitCost: s.unit_cost || 0,
 }));

 const res = await api.post<{ data: { poNumber: string } }>("/purchase-orders/generate-from-suggestions", {
 supplierId: selectedSupplier.id,
 notes: poNotes.trim() || undefined,
 items,
 });

 setShowSupplierModal(false);
 setSelection(new Set());
 Alert.alert("PO Generated", `Purchase Order ${res.data.poNumber} created successfully.`);
 load();
 } catch (e: any) {
 Alert.alert("Error", e?.response?.data?.error || "Failed to generate purchase order.");
 } finally {
 setGenerating(false);
 }
 };

 return (
 <View className="flex-1 bg-background " style={{ paddingTop: topInset + 8 }}>
 <ScrollView style={{ flex: 1 }}>
 <View className="px-4 py-3">
 <View className="flex-row justify-between items-center mb-2">
 <Text className="text-xl font-black text-on-surface ">Reorder Suggestions</Text>
 {!loading && (
 <Pressable onPress={load}><MaterialCommunityIcons name="refresh" size={22} color={theme.colors.primary} /></Pressable>
 )}
 </View>
 <Text className="text-sm text-on-surface-variant mb-4">
 Products below reorder level — suggested purchase quantities calculated automatically.
 </Text>

 {loading ? (
 <View className="py-12 items-center"><ActivityIndicator color={theme.colors.primary} /></View>
 ) : suggestions.length === 0 ? (
 <EmptyState icon="check-circle-outline" title="All stocked up" description="All products are above their reorder level." />
 ) : (
 <>
 <View className="flex-row gap-2 mb-4">
 <Pressable onPress={selectAll} className="bg-surface-container-lowest border border-outline-variant px-4 py-2 rounded-xl">
 <Text className="text-sm font-bold text-on-surface ">
 {selection.size === suggestions.length ? "Deselect All" : "Select All"}
 </Text>
 </Pressable>
 <Pressable
 onPress={openGeneratePO}
 disabled={selection.size === 0 || generating}
 className="bg-primary px-4 py-2 rounded-xl"
 >
 <Text className="text-sm font-bold text-white">
 {generating ? "Generating..." : `Generate PO (${selection.size})`}
 </Text>
 </Pressable>
 </View>

 {suggestions.map((s) => (
 <Pressable
 key={s.product_id}
 onPress={() => toggle(s.product_id)}
 className="bg-surface-container-lowest rounded-xl border border-outline-variant p-4 mb-2 flex-row items-center"
 >
 <View className="w-6 h-6 rounded-md border-2 mr-3 items-center justify-center"
 style={{ borderColor: selection.has(s.product_id) ? theme.colors.primary : theme.colors.outline, backgroundColor: selection.has(s.product_id) ? theme.colors.primary : "transparent" }}
 >
 {selection.has(s.product_id) && <MaterialCommunityIcons name="check" size={14} color="white" />}
 </View>
 <View className="flex-1">
 <Text className="text-sm font-bold text-on-surface ">{s.product_name}</Text>
 <Text className="text-xs text-on-surface-variant ">
 Stock: {s.current_stock} {s.unit} · Reorder at: {s.reorder_level}
 </Text>
 <Text className="text-xs font-bold text-primary ">
 Suggested order: {s.suggested_quantity} {s.unit}
 </Text>
 </View>
 </Pressable>
 ))}
 </>
 )}
 </View>

 {/* Supplier Selection Modal */}
 <Modal visible={showSupplierModal} transparent animationType="slide">
 <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)" }}>
 <View className="mt-auto bg-surface-container-lowest rounded-t-3xl p-6 max-h-[80%]">
 <Text className="text-lg font-black mb-2 text-on-surface ">Select Supplier</Text>
 <Text className="text-sm text-on-surface-variant mb-4">
 Choose a supplier for the purchase order.
 </Text>

 {suppliers.length === 0 ? (
 <Text className="text-sm text-on-surface-variant text-center py-4">
 No suppliers found. Add a supplier first.
 </Text>
 ) : (
 <ScrollView className="max-h-64 mb-4">
 {suppliers.map((s) => (
 <Pressable
 key={s.id}
 onPress={() => setSelectedSupplier(s)}
 className={`p-4 rounded-xl mb-2 border ${
 selectedSupplier?.id === s.id
 ? "border-primary bg-primary/5 "
 : "border-outline-variant bg-surface-container "
 }`}
 >
 <Text className="font-bold text-sm text-on-surface ">{s.name}</Text>
 {s.phone && <Text className="text-xs text-on-surface-variant ">{s.phone}</Text>}
 </Pressable>
 ))}
 </ScrollView>
 )}

 <TextInput
 placeholder="Notes (optional)"
 placeholderTextColor={theme.colors.onSurfaceVariant}
 className="bg-surface-container border border-outline-variant rounded-xl px-4 py-3 mb-4 text-sm text-on-surface "
 value={poNotes}
 onChangeText={setPoNotes}
 multiline
 />

 <View className="flex-row gap-3">
 <Pressable
 onPress={() => setShowSupplierModal(false)}
 className="flex-1 bg-surface-container py-3 rounded-xl items-center"
 >
 <Text className="font-bold text-on-surface ">Cancel</Text>
 </Pressable>
 <Pressable
 onPress={generatePO}
 disabled={!selectedSupplier || generating}
 className="flex-1 bg-primary py-3 rounded-xl items-center"
 >
 <Text className="font-bold text-white">
 {generating ? "Generating..." : "Generate PO"}
 </Text>
 </Pressable>
 </View>
 </View>
 </View>
 </Modal>
 </ScrollView>
 </View>
 );
}
