import React, { useCallback, useEffect, useState } from "react";
import {
 View,
 Text,
 FlatList,
 ActivityIndicator,
 Pressable,
 Alert,
 ScrollView,
 KeyboardAvoidingView,
 Platform,
} from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "react-native-paper";
import { api, ApiError } from "../src/lib/api";
import { useConfirm } from "../src/components/ConfirmDialog";
import { useTopInset } from "../src/lib/useTopInset";
import { useBottomInset } from "../src/lib/useBottomInset";
import { GstRatePicker } from "../src/components/GstRatePicker";

interface Category {
 id: string;
 name: string;
}

interface MismatchItem {
 id: string;
 name: string;
 sku: string | null;
 hsn_code: string | null;
 tax_rate: string;
 suggested_rate: number;
}

const GST_SLABS = ["0", "5", "12", "18", "28"];

export default function GstRateToolsScreen() {
 const theme = useTheme();
 const topInset = useTopInset();
 const bottomInset = useBottomInset();
 const confirm = useConfirm();
 const router = useRouter();

 const [categories, setCategories] = useState<Category[]>([]);
 const [catsLoading, setCatsLoading] = useState(true);

 // Bulk update state
 const [bulkCategoryId, setBulkCategoryId] = useState("");
 const [bulkRate, setBulkRate] = useState("18");
 const [bulkSubmitting, setBulkSubmitting] = useState(false);

 // Mismatch review state
 const [mismatches, setMismatches] = useState<MismatchItem[]>([]);
 const [reviewLoading, setReviewLoading] = useState(false);
 const [reviewLoaded, setReviewLoaded] = useState(false);

 useEffect(() => {
 (async () => {
 setCatsLoading(true);
 try {
 const res = await api.get<{ data: Category[] }>("/categories");
 setCategories(res.data ?? []);
 } catch {
 // non-critical
 } finally {
 setCatsLoading(false);
 }
 })();
 }, []);

 const loadMismatches = useCallback(async () => {
 setReviewLoading(true);
 try {
 const res = await api.get<{ data: MismatchItem[] }>("/products/gst-rate-review");
 setMismatches(res.data ?? []);
 setReviewLoaded(true);
 } catch (e) {
 Alert.alert("Error", e instanceof ApiError ? e.message : "Failed to load rate mismatches.");
 } finally {
 setReviewLoading(false);
 }
 }, []);

 const handleBulkUpdate = async () => {
 const rate = parseFloat(bulkRate);
 if (isNaN(rate)) {
 Alert.alert("Invalid Rate", "Enter a valid GST rate.");
 return;
 }
 const label = bulkCategoryId
 ? categories.find((c) => c.id === bulkCategoryId)?.name || "selected category"
 : "ALL products";
 const ok = await confirm({
 title: `Set GST to ${rate}%?`,
 message: `This will update the GST rate to ${rate}% for ${label}. This cannot be undone in bulk.`,
 confirmLabel: "Apply",
 destructive: false,
 });
 if (!ok) return;

 setBulkSubmitting(true);
 try {
 const url = `/products?limit=500${bulkCategoryId ? `&categoryId=${bulkCategoryId}` : ""}`;
 const listRes = await api.get<{ data: { id: string }[] }>(url);
 const ids = (listRes.data ?? []).map((p) => p.id);
 if (ids.length === 0) {
 Alert.alert("No Products", "No products matched the selected category.");
 return;
 }
 const updateRes = await api.post<{ data: { updated: number } }>("/products/bulk-tax-rate-update", {
 updates: ids.map((id) => ({ id, taxRate: rate })),
 });
 Alert.alert("Success", `Updated ${updateRes.data.updated} product(s).`);
 } catch (e) {
 Alert.alert("Error", e instanceof ApiError ? e.message : "Bulk update failed.");
 } finally {
 setBulkSubmitting(false);
 }
 };

 return (
 <View className="flex-1 bg-background " style={{ paddingTop: topInset }}>
 {/* Header */}
 <View className="flex-row items-center px-6 py-4">
 <Pressable onPress={() => router.back()} className="w-9 h-9 items-center justify-center active:opacity-70">
 <MaterialCommunityIcons name="arrow-left" size={22} color={theme.colors.onSurfaceVariant} />
 </Pressable>
 <Text className="text-xl font-bold text-on-surface ml-2">
 GST Rate Tools
 </Text>
 </View>

 <ScrollView
 className="flex-1 px-6"
 contentContainerStyle={{ paddingBottom: bottomInset + 24 }}
 showsVerticalScrollIndicator={false}
 >
 {/* ── Bulk Update by Category ── */}
 <View className="bg-surface-container-lowest p-5 rounded-3xl border border-gray-100 shadow-sm mb-6">
 <Text className="text-lg font-bold text-on-surface mb-4">
 Bulk Update by Category
 </Text>

 <Text className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider mb-2">
 Category
 </Text>
 {catsLoading ? (
 <ActivityIndicator size="small" color={theme.colors.primary} />
 ) : (
 <View className="flex-row flex-wrap" style={{ gap: 8 }}>
 <Pressable
 onPress={() => setBulkCategoryId("")}
 className={`px-4 py-3 rounded-xl border ${
 bulkCategoryId === ""
 ? "bg-primary border-primary"
 : "bg-surface-container-lowest border-gray-200 "
 }`}
 >
 <Text
 className={`text-sm font-bold ${bulkCategoryId === "" ? "text-white" : "text-on-surface-variant "}`}
 >
 All Products
 </Text>
 </Pressable>
 {categories.map((c) => (
 <Pressable
 key={c.id}
 onPress={() => setBulkCategoryId(c.id)}
 className={`px-4 py-3 rounded-xl border ${
 bulkCategoryId === c.id
 ? "bg-primary border-primary"
 : "bg-surface-container-lowest border-gray-200 "
 }`}
 >
 <Text
 className={`text-sm font-bold ${bulkCategoryId === c.id ? "text-white" : "text-on-surface-variant "}`}
 >
 {c.name}
 </Text>
 </Pressable>
 ))}
 </View>
 )}

 <Text className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider mb-2 mt-5">
 GST Rate (%)
 </Text>
 <GstRatePicker value={bulkRate} onChange={setBulkRate} />

 <Pressable
 onPress={handleBulkUpdate}
 disabled={bulkSubmitting}
 className="bg-primary py-4 rounded-xl items-center mt-6"
 >
 {bulkSubmitting ? (
 <ActivityIndicator color="white" />
 ) : (
 <Text className="text-white font-bold text-base">Apply to {bulkCategoryId ? "Category" : "All Products"}</Text>
 )}
 </Pressable>
 </View>

 {/* ── Rate Mismatch Review ── */}
 <View className="bg-surface-container-lowest p-5 rounded-3xl border border-gray-100 shadow-sm mb-6">
 <View className="flex-row items-center justify-between mb-4">
 <Text className="text-lg font-bold text-on-surface flex-1 mr-2">
 Rate Mismatch Review
 </Text>
 <Pressable
 onPress={loadMismatches}
 disabled={reviewLoading}
 className="bg-primary px-4 py-2 rounded-xl active:opacity-80"
 >
 {reviewLoading ? (
 <ActivityIndicator size="small" color="white" />
 ) : (
 <Text className="text-white font-bold text-xs">Check</Text>
 )}
 </Pressable>
 </View>

 {!reviewLoaded ? (
 <Text className="text-sm text-on-surface-variant ">Tap "Check" to find products whose GST rate differs from what their HSN code suggests.</Text>
 ) : reviewLoading ? (
 <ActivityIndicator size="large" color={theme.colors.primary} />
 ) : mismatches.length === 0 ? (
 <View className="py-6 items-center">
 <MaterialCommunityIcons name="check-circle-outline" size={36} color="#22C55E" />
 <Text className="text-sm font-bold text-on-surface-variant mt-2">No mismatches found</Text>
 <Text className="text-xs text-on-surface-variant mt-1">All products with an HSN code match their suggested rate.</Text>
 </View>
 ) : (
 <View>
 <Text className="text-xs font-bold text-on-surface-variant mb-2">
 {mismatches.length} product{mismatches.length !== 1 ? "s" : ""} with rate mismatch
 </Text>
 {mismatches.map((p) => (
 <View
 key={p.id}
 className="flex-row items-center justify-between py-3 border-b border-gray-100 "
 >
 <View className="flex-1 mr-2">
 <Text className="text-sm font-bold text-on-surface " numberOfLines={1}>
 {p.name}
 </Text>
 <Text className="text-xs text-on-surface-variant ">
 HSN {p.hsn_code} · {p.sku || ""}
 </Text>
 </View>
 <Text className="text-sm font-bold">
 <Text className="text-on-surface-variant ">{Number(p.tax_rate)}%</Text>
 {" → "}
 <Text className="text-amber-600">{p.suggested_rate}%</Text>
 </Text>
 </View>
 ))}
 </View>
 )}
 </View>
 </ScrollView>
 </View>
 );
}
