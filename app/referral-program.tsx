import React, { useCallback, useEffect, useState } from "react";
import { View, Text, FlatList, ActivityIndicator, Pressable, Alert, TextInput, Modal, ScrollView, Platform, KeyboardAvoidingView } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTheme } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { api, ApiError } from "../src/lib/api";
import { useConfirm } from "../src/components/ConfirmDialog";
import ToggleSwitch from "../src/components/ToggleSwitch";
import { useTopInset } from "../src/lib/useTopInset";
import { useBottomInset } from "../src/lib/useBottomInset";
import EmptyState from "../src/components/EmptyState";

interface Program {
 id: string;
 name: string;
 reward_type: string;
 reward_value: string;
 min_invoice_amount: string | null;
 max_rewards_per_referrer: number | null;
 is_active: boolean;
 _count?: { referral_codes?: number; referral_rewards?: number };
}

export default function ReferralProgramScreen() {
 const theme = useTheme();
 const topInset = useTopInset(); const bottomInset = useBottomInset();
 const confirm = useConfirm(); const router = useRouter();

 const [programs, setPrograms] = useState<Program[]>([]);
 const [loading, setLoading] = useState(true);
 const [loadTrigger, setLoadTrigger] = useState(0);
 const [showForm, setShowForm] = useState(false);
 const [editing, setEditing] = useState<Program | null>(null);
 const [formName, setFormName] = useState("");
 const [formRewardType, setFormRewardType] = useState("percentage");
 const [formRewardValue, setFormRewardValue] = useState("5");
 const [formMinAmount, setFormMinAmount] = useState("");
 const [formMaxRewards, setFormMaxRewards] = useState("");
 const [formIsActive, setFormIsActive] = useState(true);
 const [saving, setSaving] = useState(false);

 const load = useCallback(async () => {
 setLoading(true);
 try {
 const res = await api.get<{ data: Program[] }>("/referral-programs");
 setPrograms(res.data ?? []);
 } catch { Alert.alert("Error", "Could not load programs."); } finally { setLoading(false); }
 }, []);

 useEffect(() => { load(); }, [load, loadTrigger]);

 const handleSave = async () => {
 if (!formName.trim() || !formRewardValue) { Alert.alert("Required", "Name and reward value are required."); return; }
 setSaving(true);
 try {
 const body: any = { name: formName.trim(), rewardType: formRewardType, rewardValue: parseFloat(formRewardValue), isActive: formIsActive };
 if (formMinAmount) body.minInvoiceAmount = parseFloat(formMinAmount);
 if (formMaxRewards) body.maxRewardsPerReferrer = parseInt(formMaxRewards);
 if (editing) { await api.put(`/referral-programs/${editing.id}`, body); }
 else { await api.post("/referral-programs", body); }
 setShowForm(false); setEditing(null); setLoadTrigger((n) => n + 1);
 } catch (e) { Alert.alert("Error", e instanceof ApiError ? e.message : "Failed to save."); }
 finally { setSaving(false); }
 };

 const toggleActive = async (program: Program) => {
 try {
 await api.put(`/referral-programs/${program.id}`, { isActive: !program.is_active });
 setLoadTrigger((n) => n + 1);
 } catch { Alert.alert("Error", "Failed to toggle."); }
 };

 const renderItem = ({ item }: { item: Program }) => (
 <View className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant mb-3 shadow-sm">
 <View className="flex-row items-start justify-between">
 <View className="flex-1 mr-2">
 <View className="flex-row items-center" style={{ gap: 6 }}>
 <Text className="text-base font-bold text-on-surface ">{item.name}</Text>
 <View className={`px-2 py-0.5 rounded-full ${item.is_active ? "bg-green-100" : "bg-gray-100"}`}>
 <Text className={`text-xs font-bold ${item.is_active ? "text-success" : "text-on-surface-variant "}`}>{item.is_active ? "Active" : "Inactive"}</Text>
 </View>
 </View>
 <Text className="text-sm text-on-surface-variant mt-1">
 {item.reward_type === "percentage" ? `${item.reward_value}% off` : `₹${item.reward_value} off`} per referral
 </Text>
 </View>
 <View className="flex-row" style={{ gap: 4 }}>
 <Pressable onPress={() => toggleActive(item)} className="w-9 h-9 rounded-lg bg-surface-container items-center justify-center active:opacity-70">
 <MaterialCommunityIcons name={item.is_active ? "pause" : "play"} size={16} color={theme.colors.onSurfaceVariant} />
 </Pressable>
 <Pressable onPress={() => { setEditing(item); setFormName(item.name); setFormRewardType(item.reward_type); setFormRewardValue(item.reward_value); setFormMinAmount(item.min_invoice_amount || ""); setFormMaxRewards(item.max_rewards_per_referrer?.toString() || ""); setFormIsActive(item.is_active); setShowForm(true); }}
 className="w-9 h-9 rounded-lg bg-surface-container items-center justify-center active:opacity-70">
 <MaterialCommunityIcons name="pencil" size={16} color={theme.colors.onSurfaceVariant} />
 </Pressable>
 </View>
 </View>
 </View>
 );

 return (
 <View className="flex-1 bg-background " style={{ paddingTop: topInset }}>
 <View className="flex-row items-center justify-between px-6 py-4">
 <View className="flex-row items-center" style={{ gap: 8 }}>
 <Pressable onPress={() => router.back()} className="w-9 h-9 items-center justify-center active:opacity-70">
 <MaterialCommunityIcons name="arrow-left" size={22} color={theme.colors.onSurfaceVariant} />
 </Pressable>
 <Text className="text-xl font-bold text-on-surface ">Referral Program</Text>
 </View>
 <Pressable onPress={() => { setEditing(null); setFormName(""); setFormRewardType("percentage"); setFormRewardValue("5"); setFormMinAmount(""); setFormMaxRewards(""); setFormIsActive(true); setShowForm(true); }}
 className="bg-primary px-4 py-2.5 rounded-xl flex-row items-center active:opacity-80" style={{ gap: 4 }}>
 <MaterialCommunityIcons name="plus" size={16} color="white" /><Text className="text-white font-bold text-sm">Add</Text>
 </Pressable>
 </View>

 {loading ? <View className="flex-1 items-center justify-center"><ActivityIndicator size="large" color={theme.colors.primary} /></View>
 : programs.length === 0 ? (
 <EmptyState icon="gift-outline" title="No referral programs yet" description="Create a program to reward customers who refer others." />
 ) : (
 <FlatList data={programs} keyExtractor={(item) => item.id} renderItem={renderItem}
 contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: bottomInset + 24 }} showsVerticalScrollIndicator={false} />
 )}

 <Modal visible={showForm} animationType="slide" onRequestClose={() => setShowForm(false)}>
 <SafeAreaProvider>
 <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1">
 <ScrollView className="flex-1 bg-background px-6 pb-10" style={{ paddingTop: topInset }}>
 <View className="flex-row justify-between items-center mb-6">
 <Text className="text-2xl font-bold text-on-surface ">{editing ? "Edit" : "Add"} Program</Text>
 <Pressable onPress={() => setShowForm(false)} className="w-11 h-11 items-center justify-center">
 <MaterialCommunityIcons name="close" size={20} color={theme.colors.onSurfaceVariant} />
 </Pressable>
 </View>

 <View className="bg-surface-container-lowest p-5 rounded-3xl border border-outline-variant shadow-sm mb-4">
 <Text className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider mb-2">Name *</Text>
 <TextInput value={formName} onChangeText={setFormName} placeholder="e.g. Refer & Earn" autoFocus
 className="bg-background text-on-surface border border-outline-variant rounded-xl px-4 py-3.5 font-medium" />
 </View>

 <View className="bg-surface-container-lowest p-5 rounded-3xl border border-outline-variant shadow-sm mb-4">
 <Text className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider mb-3">Reward Type</Text>
 <View className="flex-row" style={{ gap: 8 }}>
 {["percentage", "fixed"].map((t) => (
 <Pressable key={t} onPress={() => setFormRewardType(t)}
 className={`flex-1 py-3 rounded-xl border items-center ${formRewardType === t ? "bg-primary border-primary " : "bg-surface-container-lowest border-outline-variant "}`}>
 <Text className={`text-sm font-bold ${formRewardType === t ? "text-white" : "text-on-surface-variant capitalize"}`}>{t}</Text>
 </Pressable>
 ))}
 </View>

 <Text className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider mb-2 mt-4">Reward Value *</Text>
 <TextInput value={formRewardValue} onChangeText={setFormRewardValue} keyboardType="decimal-pad"
 placeholder={formRewardType === "percentage" ? "e.g. 5" : "e.g. 100"}
 placeholderTextColor="#A0A0A0"
 className="bg-background text-on-surface border border-outline-variant rounded-xl px-4 py-3.5 font-medium" />
 </View>

 <View className="bg-surface-container-lowest p-5 rounded-3xl border border-outline-variant shadow-sm mb-4">
 <Text className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider mb-3">Limits (Optional)</Text>

 <Text className="text-sm font-medium text-on-surface-variant mb-2">Min Invoice Amount</Text>
 <TextInput value={formMinAmount} onChangeText={setFormMinAmount} keyboardType="decimal-pad" placeholder="e.g. 500"
 placeholderTextColor="#A0A0A0"
 className="bg-background text-on-surface border border-outline-variant rounded-xl px-4 py-3.5 font-medium mb-3" />

 <Text className="text-sm font-medium text-on-surface-variant mb-2">Max Rewards per Referrer</Text>
 <TextInput value={formMaxRewards} onChangeText={setFormMaxRewards} keyboardType="numeric" placeholder="e.g. 10 (leave empty for unlimited)"
 placeholderTextColor="#A0A0A0"
 className="bg-background text-on-surface border border-outline-variant rounded-xl px-4 py-3.5 font-medium" />
 </View>

 <View className="bg-surface-container-lowest p-5 rounded-3xl border border-outline-variant shadow-sm mb-4">
 <View className="flex-row items-center justify-between">
 <Text className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider">Active</Text>
 <ToggleSwitch value={formIsActive} onValueChange={setFormIsActive} />
 </View>
 </View>

 <Pressable onPress={handleSave} disabled={saving}
 className="bg-primary py-4 rounded-xl items-center mt-2" style={{ marginBottom: bottomInset }}>
 {saving ? <ActivityIndicator color="white" /> : <Text className="text-white font-bold">{editing ? "Update" : "Create Program"}</Text>}
 </Pressable>
 </ScrollView>
 </KeyboardAvoidingView>
 </SafeAreaProvider>
 </Modal>
 </View>
 );
}
