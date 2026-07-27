import React, { useState, useEffect, useCallback } from "react";
import { View, Text, FlatList, ActivityIndicator, Pressable, Alert, RefreshControl, Linking, TextInput } from "react-native";
import { useTheme } from "react-native-paper";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { api } from "../src/lib/api";
import { useTopInset, useBottomInset } from "../src/lib/useTopInset";

interface OverdueParty {
 id: string;
 name: string;
 phone?: string | null;
 currentBalance: number;
 daysOverdue: number | null;
 tone: "friendly" | "firm" | "urgent";
 suggestedMessage?: { en: string; hi: string };
}

type Severity = "urgent" | "warning" | "notice";

const SEVERITY_CONFIG: Record<Severity, { color: string; bg: string; label: string }> = {
 urgent: { color: "#ef4444", bg: "#fef2f2", label: "Urgent" },
 warning: { color: "#f97316", bg: "#fff7ed", label: "Overdue" },
 notice: { color: "#eab308", bg: "#fefce8", label: "Due Soon" },
};

// tone comes pre-computed from the server (based on the oldest unpaid
// invoice's due date) — this just maps it onto the existing 3-tier UI.
function severityForTone(tone: OverdueParty["tone"]): Severity {
 if (tone === "urgent") return "urgent";
 if (tone === "firm") return "warning";
 return "notice";
}

function formatCurrency(amount: number): string {
 return "₹" + Number(amount).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export default function RemindersScreen() {
 const theme = useTheme();
 const router = useRouter();
 const topInset = useTopInset();
 const bottomInset = useBottomInset();

 const [loading, setLoading] = useState(true);
 const [refreshing, setRefreshing] = useState(false);
 const [data, setData] = useState<OverdueParty[]>([]);
 const [search, setSearch] = useState("");
 const [sendingId, setSendingId] = useState<string | null>(null);
 const [lang, setLang] = useState<"en" | "hi">("en");

 const fetchData = useCallback(async () => {
 try {
 const res = await api.get<{ data: OverdueParty[] }>("/reminders/overdue");
 setData(res.data || []);
 } catch {
 setData([]);
 } finally {
 setLoading(false);
 setRefreshing(false);
 }
 }, []);

 useEffect(() => { fetchData(); }, [fetchData]);

 const filtered = search.trim()
 ? data.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
 : data;

 const grouped = filtered.reduce((acc, item) => {
 const sev = severityForTone(item.tone);
 if (!acc[sev]) acc[sev] = [];
 acc[sev].push(item);
 return acc;
 }, {} as Record<Severity, OverdueParty[]>);

 const totalDue = data.reduce((sum, p) => sum + p.currentBalance, 0);

 const handleSendReminder = async (party: OverdueParty) => {
 setSendingId(party.id);
 try {
 await api.post(`/reminders/${party.id}/mark-sent`);
 if (party.phone) {
 const message =
 party.suggestedMessage?.[lang] ??
 `Dear ${party.name}, this is a reminder that ${formatCurrency(party.currentBalance)} is overdue. Please clear the outstanding at your earliest.`;
 const text = encodeURIComponent(message);
 Linking.openURL(`whatsapp://send?text=${text}&phone=${party.phone}`).catch(() => {
 Alert.alert("WhatsApp Not Found", "Please install WhatsApp to send messages.");
 });
 } else {
 Alert.alert("", `Reminder marked as sent for ${party.name}`);
 }
 setData((prev) => prev.filter((p) => p.id !== party.id));
 } catch {
 Alert.alert("Error", "Failed to send reminder. Please try again.");
 } finally {
 setSendingId(null);
 }
 };

 const sections: { severity: Severity; items: OverdueParty[] }[] = (
 ["urgent", "warning", "notice"] as Severity[]
 ).filter((s) => (grouped[s]?.length || 0) > 0).map((s) => ({
 severity: s,
 items: grouped[s] || [],
 }));

 if (loading) {
 return (
 <View className="flex-1 items-center justify-center bg-background ">
 <ActivityIndicator size="large" color={theme.colors.primary} />
 </View>
 );
 }

 return (
 <View className="flex-1 bg-background ">
 <FlatList
 data={sections}
 keyExtractor={(s) => s.severity}
 refreshControl={
 <RefreshControl
 refreshing={refreshing}
 onRefresh={() => { setRefreshing(true); fetchData(); }}
 tintColor={theme.colors.primary}
 />
 }
 contentContainerStyle={{ paddingTop: topInset + 16, paddingBottom: bottomInset + 24, paddingHorizontal: 16 }}
 ListHeaderComponent={
 <>
 <View className="flex-row items-center justify-between mb-4">
<View className="flex-row items-center" style={{ gap: 8 }}>
  <Pressable onPress={() => router.back()} className="w-9 h-9 items-center justify-center -ml-1">
  <MaterialCommunityIcons name="arrow-left" size={24} color={theme.colors.onSurfaceVariant} />
  </Pressable>
  <MaterialCommunityIcons name="bell-ring-outline" size={24} color={theme.colors.primary} />
  <Text className="text-2xl font-bold text-on-surface ">Reminders</Text>
 </View>
 <View className="flex-row rounded-full overflow-hidden border border-outline-variant">
 <Pressable onPress={() => setLang("en")} className="px-3 py-1.5" style={{ backgroundColor: lang === "en" ? theme.colors.primary : "transparent" }}>
 <Text className="text-xs font-bold" style={{ color: lang === "en" ? "white" : theme.colors.onSurfaceVariant }}>EN</Text>
 </Pressable>
 <Pressable onPress={() => setLang("hi")} className="px-3 py-1.5" style={{ backgroundColor: lang === "hi" ? theme.colors.primary : "transparent" }}>
 <Text className="text-xs font-bold" style={{ color: lang === "hi" ? "white" : theme.colors.onSurfaceVariant }}>हिं</Text>
 </Pressable>
 </View>
 </View>

 <View className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-4 mb-4">
 <View className="flex-row items-center justify-between">
 <View>
 <Text className="text-xs text-on-surface-variant uppercase tracking-wide">
 Total Overdue
 </Text>
 <Text className="text-2xl font-black text-on-surface mt-1">
 {formatCurrency(totalDue)}
 </Text>
 <Text className="text-xs text-on-surface-variant mt-0.5">
 {data.length} {data.length === 1 ? "party" : "parties"}
 </Text>
 </View>
 <View className="w-14 h-14 rounded-full bg-error/10 items-center justify-center">
 <MaterialCommunityIcons name="alert-circle" size={28} color="#ef4444" />
 </View>
 </View>
 </View>

 <View className="mb-3">
 <View className="flex-row items-center bg-surface-container-lowest rounded-2xl px-4 py-3 border border-outline-variant">
 <MaterialCommunityIcons name="magnify" size={18} color="#6B7280" />
 <TextInput
 placeholder="Search parties..."
 value={search}
 onChangeText={setSearch}
 className="flex-1 ml-2 text-base font-medium text-on-surface"
 placeholderTextColor="#9CA3AF"
 />
 {search ? (
 <Pressable onPress={() => setSearch("")} className="p-1">
 <MaterialCommunityIcons name="close" size={16} color="#9CA3AF" />
 </Pressable>
 ) : null}
 </View>
 </View>

 {data.length === 0 && (
 <View className="items-center py-20">
 <View className="w-20 h-20 rounded-full bg-primary/10 items-center justify-center mb-4">
 <MaterialCommunityIcons name="check-circle-outline" size={40} color={theme.colors.primary} />
 </View>
 <Text className="text-lg font-bold text-on-surface text-center">
 No overdue payments!
 </Text>
 <Text className="text-sm text-on-surface-variant text-center mt-1">
 All caught up!
 </Text>
 </View>
 )}
 </>
 }
 renderItem={({ item: section }) => (
 <View className="mb-4">
 <View className="flex-row items-center mb-2 px-1" style={{ gap: 6 }}>
 <View
 className="w-3 h-3 rounded-full"
 style={{ backgroundColor: SEVERITY_CONFIG[section.severity].color }}
 />
 <Text
 className="text-sm font-bold"
 style={{ color: SEVERITY_CONFIG[section.severity].color }}
 >
 {SEVERITY_CONFIG[section.severity].label}
 </Text>
 <Text className="text-xs text-on-surface-variant ">
 ({section.items.length})
 </Text>
 </View>

 {section.items.map((party) => {
 const cfg = SEVERITY_CONFIG[section.severity];
 const isSending = sendingId === party.id;

 return (
 <View key={party.id} className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-4 mb-2" style={{ borderLeftWidth: 3, borderLeftColor: cfg.color }}>
 <View className="flex-row items-start justify-between">
 <View className="flex-1 mr-3">
 <View className="flex-row items-center" style={{ gap: 6 }}>
 <MaterialCommunityIcons name="account" size={16} color={theme.colors.primary} />
 <Text className="text-base font-bold text-on-surface flex-1" numberOfLines={1}>
 {party.name}
 </Text>
 </View>

 <Text className="text-xl font-black text-on-surface mt-1">
 {formatCurrency(party.currentBalance)}
 </Text>

 <View className="flex-row items-center mt-1.5" style={{ gap: 8 }}>
 <View className="rounded-full px-3 py-1" style={{ backgroundColor: cfg.bg }}>
 <Text className="text-xs font-bold" style={{ color: cfg.color, fontSize: 10 }}>
 {party.daysOverdue != null ? `${party.daysOverdue} days` : "No due date"}
 </Text>
 </View>
 </View>
 </View>

 <Pressable
 onPress={() => handleSendReminder(party)}
 disabled={isSending}
 className="py-3.5 rounded-xl items-center"
 style={{ backgroundColor: cfg.color, height: 36 }}
 >
 {isSending ? (
 <ActivityIndicator color="white" size="small" />
 ) : (
 <Text className="text-white font-bold text-xs">Send Reminder</Text>
 )}
 </Pressable>
 </View>
 </View>
 );
 })}
 </View>
 )}
 />
 </View>
 );
}
