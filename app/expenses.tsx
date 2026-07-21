import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, FlatList, Pressable, ActivityIndicator, Image, Modal, Alert, TextInput, ScrollView, KeyboardAvoidingView, Platform, RefreshControl } from "react-native";
import { Text } from "react-native";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "react-native-paper";
import { useTopInset } from "../src/lib/useTopInset";
import { useBottomInset } from "../src/lib/useBottomInset";
import { api, ApiError } from "../src/lib/api";
import EmptyState from "../src/components/EmptyState";

function formatRupee(n: number): string {
 return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

type PeriodKey = "day" | "week" | "month" | "year";
const PERIODS: { key: PeriodKey; label: string }[] = [
 { key: "day", label: "Today" },
 { key: "week", label: "This Week" },
 { key: "month", label: "This Month" },
 { key: "year", label: "This Year" },
];

const CATEGORY_ICON: Record<string, keyof typeof MaterialCommunityIcons.glyphMap> = {
 travel: "car-outline", fuel: "gas-station-outline", food: "food-outline",
 rent: "home-outline", utilities: "flash-outline", salaries: "account-cash-outline",
 marketing: "bullhorn-outline", maintenance: "wrench-outline", packaging: "package-variant-closed",
 other: "receipt",
};

function categoryIcon(category: string): keyof typeof MaterialCommunityIcons.glyphMap {
 return CATEGORY_ICON[category.toLowerCase()] ?? "receipt";
}

function startOfPeriod(period: PeriodKey): Date {
 const now = new Date();
 if (period === "day") return new Date(now.getFullYear(), now.getMonth(), now.getDate());
 if (period === "week") {
 const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
 d.setDate(d.getDate() - d.getDay());
 return d;
 }
 if (period === "month") return new Date(now.getFullYear(), now.getMonth(), 1);
 return new Date(now.getFullYear(), 0, 1);
}

export default function ExpensesScreen() {
 const router = useRouter();
 const theme = useTheme();
 const topInset = useTopInset();
 const bottomInset = useBottomInset();
 const [expenses, setExpenses] = useState<any[]>([]);
 const [categories, setCategories] = useState<string[]>(["Travel", "Fuel", "Food", "Other"]);
 const [loading, setLoading] = useState(true);
 const [refreshing, setRefreshing] = useState(false);
 const [period, setPeriod] = useState<PeriodKey>("month");
 const [viewingUri, setViewingUri] = useState<string | null>(null);
 const [editing, setEditing] = useState<any | null>(null);
 const [editAmt, setEditAmt] = useState("");
 const [editCat, setEditCat] = useState("");
 const [editNotes, setEditNotes] = useState("");
 const [editLoading, setEditLoading] = useState(false);

 const load = useCallback(async () => {
 setLoading(true);
 try {
 const res = await api.get<{ data: any[] }>("/expenses");
 setExpenses(res.data ?? []);
 } catch (e) {
 console.error("Failed to load expenses:", e);
 Alert.alert("Error", "Could not load expenses.");
 } finally { setLoading(false); }
 }, []);

 const onRefresh = useCallback(async () => {
 setRefreshing(true);
 try { await load(); } finally { setRefreshing(false); }
 }, [load]);

 useEffect(() => {
 load();
 api.get<{ data: string[] }>("/expenses/categories")
 .then((res) => { if (res.data) setCategories(res.data); })
 .catch(() => {});
 }, [load]);

 const filtered = useMemo(() => {
 const from = startOfPeriod(period).getTime();
 return expenses
 .filter((e) => new Date(e.date).getTime() >= from)
 .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
 }, [expenses, period]);

 const total = filtered.reduce((sum, e) => sum + parseFloat(e.amount || "0"), 0);

 const handleEditSave = async () => {
 if (!editing) return;
 const amt = parseFloat(editAmt);
 if (!amt || amt <= 0) { Alert.alert("Error", "Enter a valid amount"); return; }
 setEditLoading(true);
 try {
 await api.patch(`/expenses/${editing.id}`, {
 amount: amt, category: editCat, notes: editNotes.trim() || undefined,
 });
 setEditing(null);
 load();
 } catch (e: any) {
 Alert.alert("Error", e instanceof ApiError ? e.message : "Failed to update expense");
 } finally { setEditLoading(false); }
 };

 return (
 <View className="flex-1 bg-background" style={{ paddingTop: topInset }}>
 {/* Header */}
 <View className="flex-row items-center px-5 py-4" style={{ gap: 12 }}>
 <Pressable onPress={() => router.back()} className="w-9 h-9 items-center justify-center -ml-1">
 <MaterialCommunityIcons name="arrow-left" size={22} color={theme.colors.onSurfaceVariant} />
 </Pressable>
 <Text className="font-headline-md text-on-surface" style={{ fontSize: 20, fontWeight: "700" }}>Expenses</Text>
 </View>

 {/* Period chips */}
 <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-5 mb-3" contentContainerStyle={{ gap: 6 }}>
 {PERIODS.map((p) => (
 <Pressable key={p.key} onPress={() => setPeriod(p.key)}
 className={`rounded-xl px-4 py-2.5 ${period === p.key ? "bg-primary" : "bg-surface-container-lowest border border-outline-variant"}`}>
 <Text className={`text-xs font-bold ${period === p.key ? "text-white" : "text-on-surface"}`}>{p.label}</Text>
 </Pressable>
 ))}
 </ScrollView>

 {/* Total bar */}
 <View className="mx-5 mb-4 bg-primary/10 rounded-2xl p-4 flex-row items-center justify-between">
 <Text className="text-sm font-bold text-on-surface">Total {PERIODS.find((p) => p.key === period)?.label}</Text>
 <Text className="text-xl font-bold text-primary">{formatRupee(total)}</Text>
 </View>

 {loading ? (
 <View className="flex-1 items-center justify-center"><ActivityIndicator size="large" color={theme.colors.primary} /></View>
 ) : filtered.length === 0 ? (
 <EmptyState icon="wallet-outline" title="No expenses recorded" description="Nothing recorded for this period yet." />
 ) : (
 <FlatList
 data={filtered}
 keyExtractor={(item) => item.id}
 refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
 contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: bottomInset + 16, gap: 10 }}
 renderItem={({ item }) => (
 <Pressable
 onPress={() => item.attachment && setViewingUri(item.attachment)}
 onLongPress={() => { setEditing(item); setEditAmt(item.amount); setEditCat(item.category); setEditNotes(item.notes || ""); }}
 className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-4 flex-row items-center"
 style={{ gap: 12 }}
 >
 <View className="w-11 h-11 rounded-full bg-primary/10 items-center justify-center">
 <MaterialCommunityIcons name={categoryIcon(item.category)} size={20} color={theme.colors.primary} />
 </View>
 <View className="flex-1">
 <Text className="font-bold text-on-surface capitalize">{item.category}</Text>
 <Text className="text-xs text-on-surface-variant mt-0.5" numberOfLines={1}>
 {new Date(item.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
 {item.notes ? ` · ${item.notes}` : ""}
 </Text>
 </View>
 {item.attachment && <MaterialCommunityIcons name="paperclip" size={16} color="#9CA3AF" style={{ marginRight: 2 }} />}
 <Text className="font-bold text-on-surface">{formatRupee(parseFloat(item.amount))}</Text>
 </Pressable>
 )}
 />
 )}

 {/* Edit modal */}
 <Modal visible={!!editing} animationType="slide" transparent onRequestClose={() => setEditing(null)}>
 <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1 justify-end bg-black/40">
 <ScrollView className="bg-background rounded-t-3xl px-5 pt-5" style={{ paddingBottom: bottomInset + 24 }}>
 <View className="flex-row justify-between items-center mb-4">
 <Text className="font-headline-md text-on-surface" style={{ fontSize: 20, fontWeight: "700" }}>Edit Expense</Text>
 <Pressable onPress={() => setEditing(null)} className="w-9 h-9 items-center justify-center">
 <MaterialCommunityIcons name="close" size={20} color={theme.colors.onSurfaceVariant} />
 </Pressable>
 </View>

 <Text className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">Amount *</Text>
 <TextInput value={editAmt} onChangeText={setEditAmt} keyboardType="numeric"
 className="bg-surface-container text-on-surface border border-outline-variant rounded-xl px-4 py-4 text-base font-medium mb-4" />

 <Text className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">Category</Text>
 <View className="flex-row flex-wrap mb-2" style={{ gap: 6 }}>
 {categories.map((c) => (
 <Pressable key={c} onPress={() => setEditCat(c)}
 className={`rounded-xl px-4 py-2.5 ${editCat.toLowerCase() === c.toLowerCase() ? "bg-primary" : "bg-surface-container-lowest border border-outline-variant"}`}>
 <Text className={`text-xs font-bold ${editCat.toLowerCase() === c.toLowerCase() ? "text-white" : "text-on-surface"}`}>{c}</Text>
 </Pressable>
 ))}
 </View>
 <TextInput value={editCat} onChangeText={setEditCat} placeholder="Or type custom..." placeholderTextColor="#9CA3AF"
 className="bg-surface-container text-on-surface border border-outline-variant rounded-xl px-4 py-3 text-sm font-medium mb-4" />

 <Text className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">Notes</Text>
 <TextInput value={editNotes} onChangeText={setEditNotes} multiline numberOfLines={2}
 className="bg-surface-container text-on-surface border border-outline-variant rounded-xl px-4 py-4 text-base font-medium mb-6" />

 <Pressable onPress={handleEditSave} disabled={editLoading}
 className="bg-primary py-4 rounded-2xl items-center mb-4">
 {editLoading ? <ActivityIndicator color="white" /> : <Text className="text-white font-bold text-base">Save Changes</Text>}
 </Pressable>
 </ScrollView>
 </KeyboardAvoidingView>
 </Modal>

 {/* Image viewer */}
 <Modal visible={viewingUri !== null} transparent animationType="fade" onRequestClose={() => setViewingUri(null)}>
 <Pressable className="flex-1 bg-black/90 items-center justify-center" onPress={() => setViewingUri(null)}>
 {viewingUri && <Image source={{ uri: viewingUri }} style={{ width: "92%", height: "70%" }} resizeMode="contain" />}
 </Pressable>
 </Modal>
 </View>
 );
}
