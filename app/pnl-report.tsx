import React, { useState } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator, Alert, TextInput } from "react-native";
import { api } from "../src/lib/api";
import { useTopInset } from "../src/lib/useTopInset";
import { MaterialCommunityIcons } from "@expo/vector-icons";

// Module scope, not defined inside PnlReportScreen — a component declared
// inside another component's render body is a new function identity every
// render, which makes React remount (not update) its subtree each time.
function Row({ label, amount, positive = true, bold = false }: { label: string; amount: number; positive?: boolean; bold?: boolean }) {
  return (
    <View className="flex-row justify-between items-center py-3 border-b border-gray-50">
      <Text className={`text-sm ${bold ? "font-black" : "font-medium"} text-text-primary`}>{label}</Text>
      <Text className={`text-sm ${bold ? "font-black" : "font-bold"} ${amount >= 0 ? "text-green-600" : "text-red-500"}`}>
        ₹{Number(amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
      </Text>
    </View>
  );
}

export default function PnlReportScreen() {
  const topInset = useTopInset();
  const today = () => new Date().toISOString().slice(0, 10);
  const monthStart = () => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
  };
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: any }>("/reports/pnl", { params: { from, to } });
      setData(res.data);
    } catch (e) {
      Alert.alert("Error", "Could not load P&L statement.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#f8fafc", paddingTop: topInset + 8 }}>
    <ScrollView style={{ flex: 1 }}>
      <View className="px-4 py-3">
        <Text className="text-xl font-black text-text-primary mb-1">P&L Statement</Text>
        <Text className="text-sm text-text-secondary mb-4">Profit & Loss for the selected period</Text>

        <View className="flex-row gap-2 mb-4">
          <View className="flex-1">
            <Text className="text-[10px] font-bold text-text-secondary uppercase mb-1">From</Text>
            <TextInput value={from} onChangeText={setFrom} className="bg-surface border border-gray-200 px-3 py-2 rounded-xl text-sm" />
          </View>
          <View className="flex-1">
            <Text className="text-[10px] font-bold text-text-secondary uppercase mb-1">To</Text>
            <TextInput value={to} onChangeText={setTo} className="bg-surface border border-gray-200 px-3 py-2 rounded-xl text-sm" />
          </View>
        </View>

        <Pressable onPress={load} disabled={loading} className="bg-primary px-6 py-3 rounded-xl items-center mb-4">
          {loading ? <ActivityIndicator color="white" /> : <Text className="text-white font-bold text-sm">Load Report</Text>}
        </Pressable>

        {data && (
          <View className="bg-surface rounded-xl border border-gray-100 p-4">
            <Row label="Revenue" amount={Number(data.revenue)} />
            <Row label="Cost of Goods Sold (COGS)" amount={Number(data.cogs)} positive={false} />
            <View className="border-t border-gray-200 my-1" />
            <Row label="Gross Profit" amount={Number(data.gross_profit)} bold />
            <Row label="Operating Expenses" amount={Number(data.total_expenses)} positive={false} />
            <View className="border-t-2 border-gray-300 my-2" />
            <Row label="NET PROFIT / LOSS" amount={Number(data.net_profit)} bold />
            {data.invoice_count !== undefined && (
              <Text className="text-[10px] text-text-secondary mt-2 text-center">
                {data.invoice_count} invoices · {data.expense_count} expenses
              </Text>
            )}
          </View>
        )}
      </View>
    </ScrollView>
    </View>
  );
}
