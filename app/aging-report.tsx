import React, { useState } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator, Alert } from "react-native";
import { api } from "../src/lib/api";
import { useTopInset } from "../src/lib/useTopInset";
import { MaterialCommunityIcons } from "@expo/vector-icons";

export default function AgingReportScreen() {
  const topInset = useTopInset();
  const [type, setType] = useState<"receivable" | "payable">("receivable");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: any }>("/reports/aging-report", { params: { type } });
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
    <ScrollView style={{ flex: 1, backgroundColor: "#f8fafc", paddingTop: topInset + 8 }}>
      <View className="px-4 py-3">
        <Text className="text-xl font-black text-text-primary mb-1">Aging Report</Text>
        <Text className="text-sm text-text-secondary mb-4">{type === "receivable" ? "Receivables (Customers)" : "Payables (Suppliers)"}</Text>

        <View className="flex-row gap-2 mb-4">
          <Pressable
            onPress={() => setType("receivable")}
            className={`px-4 py-2 rounded-xl ${type === "receivable" ? "bg-primary" : "bg-surface border border-gray-200"}`}
          >
            <Text className={`text-sm font-bold ${type === "receivable" ? "text-white" : "text-text-primary"}`}>Receivables</Text>
          </Pressable>
          <Pressable
            onPress={() => setType("payable")}
            className={`px-4 py-2 rounded-xl ${type === "payable" ? "bg-primary" : "bg-surface border border-gray-200"}`}
          >
            <Text className={`text-sm font-bold ${type === "payable" ? "text-white" : "text-text-primary"}`}>Payables</Text>
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
              {Object.entries(data.bucket_totals || {}).map(([key, val]: any) => (
                <View key={key} className="bg-surface rounded-xl px-4 py-3 flex-1 min-w-[80px] border border-gray-100" style={{ borderLeftColor: bucketColors[key] || "#999", borderLeftWidth: 3 }}>
                  <Text className="text-[10px] font-bold text-text-secondary uppercase">{key}d</Text>
                  <Text className="text-base font-black text-text-primary">₹{Number(val.total).toLocaleString("en-IN")}</Text>
                  <Text className="text-[10px] text-text-secondary">{val.count} items</Text>
                </View>
              ))}
            </View>

            <View className="bg-surface rounded-xl px-4 py-3 mb-4 border border-gray-100">
              <Text className="text-xs text-text-secondary">Total Outstanding</Text>
              <Text className="text-lg font-black text-text-primary">₹{Number(data.total_outstanding).toLocaleString("en-IN")}</Text>
            </View>

            {["0-30", "31-60", "61-90", "90+"].map((bucket) => {
              const entries = data.buckets?.[bucket] || [];
              if (entries.length === 0) return null;
              return (
                <View key={bucket} className="mb-4 bg-surface rounded-xl border border-gray-100 overflow-hidden">
                  <View className="px-4 py-3 border-b border-gray-100" style={{ backgroundColor: bucketColors[bucket] + "15" }}>
                    <Text className="text-sm font-bold text-text-primary">{bucket} Days ({entries.length})</Text>
                  </View>
                  {entries.map((e: any, i: number) => (
                    <View key={i} className="px-4 py-3 border-b border-gray-50 flex-row justify-between items-center">
                      <View className="flex-1">
                        <Text className="text-sm font-bold text-text-primary">{e.party_name}</Text>
                        <Text className="text-xs text-text-secondary">{e.invoice_number} • {new Date(e.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</Text>
                      </View>
                      <Text className="text-sm font-black text-red-500">₹{Number(e.due_amount).toLocaleString("en-IN")}</Text>
                    </View>
                  ))}
                </View>
              );
            })}
          </>
        )}
      </View>
    </ScrollView>
  );
}
