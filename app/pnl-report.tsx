import React, { useState } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator, Alert, TextInput } from "react-native";
import { useTheme } from "react-native-paper";
import { api } from "../src/lib/api";
import { useTopInset, useBottomInset } from "../src/lib/useTopInset";

interface PnlData {
  revenue: number;
  cogs: number;
  gross_profit: number;
  total_expenses: number;
  net_profit: number;
  invoice_count?: number;
  expense_count?: number;
}

// Module scope, not defined inside PnlReportScreen — a component declared
// inside another component's render body is a new function identity every
// render, which makes React remount (not update) its subtree each time.
function Row({ label, amount, positive = true, bold = false }: { label: string; amount: number; positive?: boolean; bold?: boolean }) {
  return (
    <View className="flex-row justify-between items-center py-3 border-b border-outline-variant dark:border-outline">
      <Text className={`text-sm ${bold ? "font-black" : "font-medium"} text-on-surface dark:text-text-primary-dark`}>{label}</Text>
      <Text className={`text-sm ${bold ? "font-black" : "font-bold"} ${amount >= 0 ? "text-success" : "text-error"}`}>
        ₹{Number(amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
      </Text>
    </View>
  );
}

export default function PnlReportScreen() {
  const theme = useTheme();
  const topInset = useTopInset();
  const bottomInset = useBottomInset();
  const today = () => new Date().toISOString().slice(0, 10);
  const monthStart = () => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
  };
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());
  const [data, setData] = useState<PnlData | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: PnlData }>("/reports/pnl", { params: { from, to } });
      setData(res.data);
    } catch (e) {
      Alert.alert("Error", "Could not load P&L statement.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-background dark:bg-bg-dark" style={{ paddingTop: topInset + 8 }}>
        <ScrollView contentContainerStyle={{ paddingBottom: bottomInset + 24 }}>
      <View className="px-4 py-3">
        <Text className="text-xl font-black text-on-surface dark:text-text-primary-dark mb-1">P&L Statement</Text>
        <Text className="text-sm text-on-surface-variant dark:text-text-secondary-dark mb-4">Profit & Loss for the selected period</Text>

        <View className="flex-row gap-2 mb-4">
          <View className="flex-1">
            <Text className="text-[10px] font-bold text-on-surface-variant dark:text-text-secondary-dark uppercase mb-1">From</Text>
            <TextInput
              value={from}
              onChangeText={setFrom}
              placeholderTextColor={theme.colors.onSurfaceVariant}
              className="bg-surface-container-lowest dark:bg-surface-dark border border-outline-variant dark:border-outline px-3 py-2 rounded-xl text-sm text-on-surface dark:text-text-primary-dark"
            />
          </View>
          <View className="flex-1">
            <Text className="text-[10px] font-bold text-on-surface-variant dark:text-text-secondary-dark uppercase mb-1">To</Text>
            <TextInput
              value={to}
              onChangeText={setTo}
              placeholderTextColor={theme.colors.onSurfaceVariant}
              className="bg-surface-container-lowest dark:bg-surface-dark border border-outline-variant dark:border-outline px-3 py-2 rounded-xl text-sm text-on-surface dark:text-text-primary-dark"
            />
          </View>
        </View>

        <Pressable onPress={load} disabled={loading} className="bg-primary dark:bg-primary-dark px-6 py-3 rounded-xl items-center mb-4">
          {loading ? <ActivityIndicator color="white" /> : <Text className="text-white font-bold text-sm">Load Report</Text>}
        </Pressable>

        {data && (
          <View className="bg-surface-container-lowest dark:bg-surface-dark rounded-xl border border-outline-variant dark:border-outline p-4">
            <Row label="Revenue" amount={Number(data.revenue)} />
            <Row label="Cost of Goods Sold (COGS)" amount={Number(data.cogs)} positive={false} />
            <View className="border-t border-outline-variant dark:border-outline my-1" />
            <Row label="Gross Profit" amount={Number(data.gross_profit)} bold />
            <Row label="Operating Expenses" amount={Number(data.total_expenses)} positive={false} />
            <View className="border-t-2 border-outline dark:border-outline-variant my-2" />
            <Row label="NET PROFIT / LOSS" amount={Number(data.net_profit)} bold />
            {data.invoice_count !== undefined && (
              <Text className="text-[10px] text-on-surface-variant dark:text-text-secondary-dark mt-2 text-center">
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
