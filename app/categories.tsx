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
import { useTheme } from "react-native-paper";
import { api, ApiError } from "../src/lib/api";
import { useConfirm } from "../src/components/ConfirmDialog";
import { useTopInset, useBottomInset } from "../src/lib/useTopInset";
import EmptyState from "../src/components/EmptyState";

interface CListItem {
 id: string;
 name: string;
 _count?: { products?: number };
}

export default function CategoriesScreen() {
 const topInset = useTopInset();
 const bottomInset = useBottomInset();
 const confirm = useConfirm();
 const router = useRouter();
 const theme = useTheme();

 const [tab, setTab] = useState<"categories" | "brands">("categories");
 const [items, setItems] = useState<CListItem[]>([]);
 const [loading, setLoading] = useState(true);
 const [refreshing, setRefreshing] = useState(false);

 // Add/Edit Modal
 const [showForm, setShowForm] = useState(false);
 const [editing, setEditing] = useState<CListItem | null>(null);
 const [formName, setFormName] = useState("");
 const [saving, setSaving] = useState(false);
 const [loadTrigger, setLoadTrigger] = useState(0);

 const load = useCallback(async () => {
 setLoading(true);
 try {
 const endpoint = tab === "categories" ? "/categories" : "/brands";
 const res = await api.get<{ data: CListItem[] }>(endpoint);
 setItems(res.data ?? []);
 } catch (e) {
 console.error(`Failed to load ${tab}:`, e);
 Alert.alert("Error", `Could not load ${tab}. Check your connection.`);
 } finally {
 setLoading(false);
 }
 }, [tab]);

 const onRefresh = useCallback(async () => {
 setRefreshing(true);
 try { await load(); } finally { setRefreshing(false); }
 }, [load]);

 useEffect(() => {
 load();
 }, [load, loadTrigger]);

 const openAdd = () => {
 setEditing(null);
 setFormName("");
 setShowForm(true);
 };

 const openEdit = (item: CListItem) => {
 setEditing(item);
 setFormName(item.name);
 setShowForm(true);
 };

 const handleSave = async () => {
 if (!formName.trim()) {
 Alert.alert("Required", "Name is required.");
 return;
 }
 setSaving(true);
 try {
 const endpoint = tab === "categories" ? "/categories" : "/brands";
 if (editing) {
 await api.patch(`${endpoint}/${editing.id}`, { name: formName.trim() });
 } else {
 await api.post(endpoint, { name: formName.trim() });
 }
 setShowForm(false);
 setEditing(null);
 setLoadTrigger((n) => n + 1);
 } catch (e) {
 Alert.alert("Error", e instanceof ApiError ? e.message : `Failed to save ${tab.slice(0, -1)}.`);
 } finally {
 setSaving(false);
 }
 };

 const handleDelete = async (item: CListItem) => {
 const label = tab === "categories" ? "category" : "brand";
 const ok = await confirm({
 title: `Delete "${item.name}"?`,
 message: `This ${label} will be permanently removed. Products assigned to it won't be deleted.`,
 confirmLabel: "Delete",
 destructive: true,
 });
 if (!ok) return;
 try {
 const endpoint = tab === "categories" ? "/categories" : "/brands";
 await api.delete(`${endpoint}/${item.id}`);
 setLoadTrigger((n) => n + 1);
 } catch (e) {
 Alert.alert("Error", e instanceof ApiError ? e.message : `Failed to delete ${label}.`);
 }
 };

 const renderItem = ({ item }: { item: CListItem }) => (
 <View className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant mb-3 shadow-sm">
 <View className="flex-row items-start justify-between">
 <View className="flex-1 mr-3">
 <Text className="text-base font-bold text-on-surface ">
 {item.name}
 </Text>
 {item._count?.products !== undefined && (
 <Text className="text-sm text-on-surface-variant mt-1">
 {item._count.products} product{item._count.products !== 1 ? "s" : ""}
 </Text>
 )}
 </View>
 <View className="flex-row" style={{ gap: 4 }}>
 <Pressable
 onPress={() => openEdit(item)}
 className="w-9 h-9 rounded-lg bg-surface-container items-center justify-center active:opacity-70"
 >
 <MaterialCommunityIcons name="pencil" size={16} color={theme.colors.onSurfaceVariant} />
 </Pressable>
 <Pressable
 onPress={() => handleDelete(item)}
 className="w-9 h-9 rounded-lg bg-red-50 items-center justify-center active:opacity-70"
 >
 <MaterialCommunityIcons name="delete-outline" size={16} color={theme.colors.error} />
 </Pressable>
 </View>
 </View>
 </View>
 );

 return (
 <View className="flex-1 bg-background " style={{ paddingTop: topInset }}>
 {/* Header */}
 <View className="flex-row items-center justify-between px-6 py-4">
 <View className="flex-row items-center" style={{ gap: 8 }}>
 <Pressable onPress={() => router.back()} className="w-9 h-9 items-center justify-center active:opacity-70">
 <MaterialCommunityIcons name="arrow-left" size={22} color={theme.colors.onSurfaceVariant} />
 </Pressable>
 <Text className="text-xl font-bold text-on-surface ">
 Categories & Brands
 </Text>
 </View>
 <Pressable
 onPress={openAdd}
 className="bg-primary px-4 py-2.5 rounded-xl flex-row items-center active:opacity-80"
 style={{ gap: 4 }}
 >
 <MaterialCommunityIcons name="plus" size={16} color="white" />
 <Text className="text-white font-bold text-sm">Add</Text>
 </Pressable>
 </View>

 {/* Tab Switcher */}
 <View className="px-6 mb-4 flex-row" style={{ gap: 8 }}>
 <Pressable
 onPress={() => setTab("categories")}
 className={`flex-1 py-2.5 rounded-xl items-center border ${
 tab === "categories"
 ? "bg-primary border-primary "
 : "bg-surface-container-lowest border-outline-variant "
 }`}
 >
 <Text
 className={`text-xs font-bold uppercase tracking-wider ${
 tab === "categories" ? "text-white" : "text-on-surface-variant "
 }`}
 >
 Categories
 </Text>
 </Pressable>
 <Pressable
 onPress={() => setTab("brands")}
 className={`flex-1 py-2.5 rounded-xl items-center border ${
 tab === "brands"
 ? "bg-primary border-primary "
 : "bg-surface-container-lowest border-outline-variant "
 }`}
 >
 <Text
 className={`text-xs font-bold uppercase tracking-wider ${
 tab === "brands" ? "text-white" : "text-on-surface-variant "
 }`}
 >
 Brands
 </Text>
 </Pressable>
 </View>

 {loading ? (
 <View className="flex-1 items-center justify-center pb-20">
 <ActivityIndicator size="large" color={theme.colors.primary} />
 </View>
 ) : items.length === 0 ? (
 <EmptyState
 icon={tab === "categories" ? "shape-outline" : "trademark"}
 title={`No ${tab} yet`}
 description={`Tap the Add button above to create your first ${tab.slice(0, -1)}.`}
 />
 ) : (
 <FlatList
 data={items}
 keyExtractor={(item) => item.id}
 renderItem={renderItem}
 refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
 contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: bottomInset + 24 }}
 showsVerticalScrollIndicator={false}
 />
 )}

 {/* Add/Edit Modal */}
 <Modal visible={showForm} animationType="slide" onRequestClose={() => setShowForm(false)}>
 <SafeAreaProvider>
 <KeyboardAvoidingView
 behavior={Platform.OS === "ios" ? "padding" : undefined}
 className="flex-1"
 >
 <ScrollView
 className="flex-1 bg-background px-6 pb-10"
 style={{ paddingTop: topInset }}
 >
 <View className="flex-row justify-between items-center mb-6">
 <Text className="text-2xl font-bold text-on-surface ">
 {editing ? "Edit" : "Add"} {tab === "categories" ? "Category" : "Brand"}
 </Text>
 <Pressable onPress={() => setShowForm(false)} className="w-11 h-11 items-center justify-center">
 <MaterialCommunityIcons name="close" size={20} color={theme.colors.onSurfaceVariant} />
 </Pressable>
 </View>

 <View>
 <Text className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider mb-2">
 Name *
 </Text>
 <TextInput
 value={formName}
 onChangeText={setFormName}
 placeholder={tab === "categories" ? "e.g. Groceries, Beverages" : "e.g. Tata, ITC"}
 placeholderTextColor="#A0A0A0"
 autoFocus
 className="bg-surface-container text-on-surface border border-outline-variant rounded-xl px-4 py-3.5 font-medium"
 />
 </View>

 <View className="flex-row justify-between mt-10" style={{ marginBottom: bottomInset }}>
 <Pressable
 onPress={() => setShowForm(false)}
 className="border border-outline-variant py-4 px-6 rounded-xl w-[48%] items-center"
 >
 <Text className="text-on-surface-variant font-bold">Cancel</Text>
 </Pressable>
 <Pressable
 onPress={handleSave}
 disabled={saving}
 className="bg-primary py-4 px-6 rounded-xl w-[48%] items-center"
 >
 {saving ? (
 <ActivityIndicator color="white" />
 ) : (
 <Text className="text-white font-bold">
 {editing ? "Update" : "Create"}
 </Text>
 )}
 </Pressable>
 </View>
 </ScrollView>
 </KeyboardAvoidingView>
 </SafeAreaProvider>
 </Modal>
 </View>
 );
}
