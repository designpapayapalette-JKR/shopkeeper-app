import React, { useState } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator, Alert } from "react-native";
import { useTheme } from "react-native-paper";
import { api } from "../src/lib/api";
import { useTopInset, useBottomInset } from "../src/lib/useTopInset";

interface AgingEntry {
 party_name: string;
 invoice_number: string;
 date: string;
 due_amount: number;
}

interface AgingData {
 bucket_totals: Record<string, { total: number; count: number }>;
 buckets: Record<string, AgingEntry[]>;
 total_outstanding: number;
}

export default function AgingReportScreen() {
 const theme = useTheme();
 const topInset = useTopInset();
 const bottomInset = useBottomInset();
 const [type, setType] = useState<"receivable" | "payable">("receivable");
 const [data, setData] = useState<AgingData | null>(null);
 const [loading, setLoading] = useState(false);

 const load = async () => {
 setLoading(true);
 try {
 const res = await api.get<{ data: AgingData }>("/reports/aging-report", { params: { type } });
 setData(res.data);
 } catch (e) {
 Alert.alert("Error", "Could not load aging report.");
 } finally {
 setLoading(false);
 }
 };

 const bucketColors: Record<string, string> = {
 "0-30": "#22c55e",
 "31-60": "#eab308",
 "61-90": "#f97316",
 "90+": "#ef4444",
 };

 return (
 <View className="flex-1 bg-background " style={{ paddingTop: topInset + 8 }}>
 <ScrollView contentContainerStyle={{ paddingBottom: bottomInset + 24 }}>
 <View className="px-4 py-3">
 <Text className="text-xl font-black text-on-surface mb-1">Aging Report</Text>
 <Text className="text-sm text-on-surface-variant mb-4">{type === "receivable" ? "Receivables (Customers)" : "Payables (Suppliers)"}</Text>

 <View className="flex-row gap-2 mb-4">
 <Pressable
 onPress={() => setType("receivable")}
 className={`px-4 py-2 rounded-xl ${type === "receivable" ? "bg-primary " : "bg-surface-container-lowest border border-outline-variant "}`}
 >
 <Text className={`text-sm font-bold ${type === "receivable" ? "text-white" : "text-on-surface "}`}>Receivables</Text>
 </Pressable>
 <Pressable
 onPress={() => setType("payable")}
 className={`px-4 py-2 rounded-xl ${type === "payable" ? "bg-primary " : "bg-surface-container-lowest border border-outline-variant "}`}
 >
 <Text className={`text-sm font-bold ${type === "payable" ? "text-white" : "text-on-surface "}`}>Payables</Text>
 </Pressable>
 </View>

 <Pressable onPress={load} disabled={loading} className="bg-primary px-6 py-3 rounded-xl items-center mb-4">
 {loading ? (
 <ActivityIndicator color="white" />
 ) : (
 <Text className="text-white font-bold text-sm">Load Report</Text>
 )}
 </Pressable>

 {data && (
 <>
 <View className="flex-row flex-wrap gap-2 mb-4">
 {Object.entries(data.bucket_totals || {}).map(([key, val]) => (
 <View key={key} className="bg-surface-container-lowest rounded-xl px-4 py-3 flex-1 min-w-[80px] border border-outline-variant " style={{ borderLeftColor: bucketColors[key] || theme.colors.onSurfaceVariant, borderLeftWidth: 3 }}>
 <Text className="text-[10px] font-bold text-on-surface-variant uppercase">{key}d</Text>
 <Text className="text-base font-black text-on-surface ">₹{Number(val.total).toLocaleString("en-IN")}</Text>
 <Text className="text-[10px] text-on-surface-variant ">{val.count} items</Text>
 </View>
 ))}
 </View>

 <View className="bg-surface-container-lowest rounded-xl px-4 py-3 mb-4 border border-outline-variant ">
 <Text className="text-xs text-on-surface-variant ">Total Outstanding</Text>
 <Text className="text-lg font-black text-on-surface ">₹{Number(data.total_outstanding).toLocaleString("en-IN")}</Text>
 </View>

 {["0-30", "31-60", "61-90", "90+"].map((bucket) => {
 const entries = data.buckets?.[bucket] || [];
 if (entries.length === 0) return null;
 return (
 <View key={bucket} className="mb-4 bg-surface-container-lowest rounded-xl border border-outline-variant overflow-hidden">
 <View className="px-4 py-3 border-b border-outline-variant " style={{ backgroundColor: bucketColors[bucket] + "15" }}>
 <Text className="text-sm font-bold text-on-surface ">{bucket} Days ({entries.length})</Text>
 </View>
 {entries.map((e, i) => (
 <View key={i} className="px-4 py-3 border-b border-outline-variant flex-row justify-between items-center">
 <View className="flex-1">
 <Text className="text-sm font-bold text-on-surface ">{e.party_name}</Text>
 <Text className="text-xs text-on-surface-variant ">{e.invoice_number} • {new Date(e.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</Text>
 </View>
 <Text className="text-sm font-black text-error">₹{Number(e.due_amount).toLocaleString("en-IN")}</Text>
 </View>
 ))}
 </View>
 );
 })}
 </>
 )}
 </View>
 </ScrollView>
 </View>
 );
}
