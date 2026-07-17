import React, { useState } from "react";
import { Text, View, ScrollView, Pressable, ActivityIndicator, Alert } from "react-native";
import { api } from "../src/lib/api";
import { useTopInset } from "../src/lib/useTopInset";

type Tab = "balance-sheet" | "stock-valuation";

export default function BalanceSheetScreen() {
  const topInset = useTopInset();
  const [tab, setTab] = useState<Tab>("balance-sheet");
  const [loading, setLoading] = useState(false);
  const [balanceSheet, setBalanceSheet] = useState<any | null>(null);
  const [stockValuation, setStockValuation] = useState<any | null>(null);

  const load = async (t: Tab) => {
    setTab(t);
    setLoading(true);
    try {
      if (t === "balance-sheet") {
        const res = await api.get<{ data: any }>("/reports/balance-sheet");
        setBalanceSheet(res.data);
      } else {
        const res = await api.get<{ data: any }>("/reports/stock-valuation");
        setStockValuation(res.data);
      }
    } catch {
      Alert.alert("Error", "Could not load report.");
    } finally {
      setLoading(false);
    }
  };

  const money = (n: number) => `₹${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

  return (
    <View className="flex-1 bg-background dark:bg-bg-dark" style={{ paddingTop: topInset + 8 }}>
    <ScrollView className="flex-1 px-4">
      <Text className="text-xl font-black text-text-primary mb-1">Balance Sheet &amp; Stock Valuation</Text>
      <Text className="text-sm text-text-secondary mb-4">Inventory valued at cost; receivables/payables from party balances.</Text>

      <View className="flex-row mb-4" style={{ gap: 8 }}>
        <Pressable onPress={() => load("balance-sheet")} className={`px-4 py-2 rounded-xl ${tab === "balance-sheet" ? "bg-primary" : "bg-surface border border-gray-200 dark:border-zinc-800"}`}>
          <Text className={tab === "balance-sheet" ? "text-white font-bold" : "text-text-secondary font-bold"}>Balance Sheet</Text>
        </Pressable>
        <Pressable onPress={() => load("stock-valuation")} className={`px-4 py-2 rounded-xl ${tab === "stock-valuation" ? "bg-primary" : "bg-surface border border-gray-200 dark:border-zinc-800"}`}>
          <Text className={tab === "stock-valuation" ? "text-white font-bold" : "text-text-secondary font-bold"}>Stock Valuation</Text>
        </Pressable>
      </View>

      {loading && (
        <View className="py-10 items-center">
          <ActivityIndicator color="#0368FE" />
        </View>
      )}

      {!loading && tab === "balance-sheet" && balanceSheet && (
        <View>
          <Text className="text-xs font-black text-primary uppercase tracking-widest mb-2">Assets</Text>
          <Row label="Inventory (at cost)" value={money(balanceSheet.assets.inventoryValue)} />
          <Row label="Bank Balance" value={money(balanceSheet.assets.bankBalance)} />
          <Row label="Receivables" value={money(balanceSheet.assets.receivables)} />
          <Row label="Total Assets" value={money(balanceSheet.assets.total)} bold />

          <Text className="text-xs font-black text-primary uppercase tracking-widest mb-2 mt-5">Liabilities &amp; Equity</Text>
          <Row label="Payables" value={money(balanceSheet.liabilities.payables)} />
          <Row label="Total Liabilities" value={money(balanceSheet.liabilities.total)} bold />
          <Row label="Equity" value={money(balanceSheet.equity)} bold color={balanceSheet.equity >= 0 ? "#2E9E5B" : "#D64545"} />
        </View>
      )}

      {!loading && tab === "stock-valuation" && stockValuation && (
        <View style={{ paddingBottom: 24 }}>
          <View className="flex-row mb-4" style={{ gap: 10 }}>
            <View className="flex-1 bg-surface dark:bg-surface-dark p-3 rounded-2xl">
              <Text className="text-xs font-bold text-text-secondary uppercase">At Cost</Text>
              <Text className="text-lg font-black text-text-primary dark:text-text-primary-dark">{money(stockValuation.totalValueAtCost)}</Text>
            </View>
            <View className="flex-1 bg-surface dark:bg-surface-dark p-3 rounded-2xl">
              <Text className="text-xs font-bold text-text-secondary uppercase">At Sale Price</Text>
              <Text className="text-lg font-black text-success">{money(stockValuation.totalValueAtSalePrice)}</Text>
            </View>
          </View>
          {stockValuation.rows.map((r: any) => (
            <View key={r.id} className="flex-row justify-between items-center py-2.5 border-b border-gray-100 dark:border-zinc-800">
              <View className="flex-1 mr-2">
                <Text className="font-bold text-text-primary dark:text-text-primary-dark" numberOfLines={1}>{r.name}</Text>
                <Text className="text-xs text-text-secondary">{r.quantity} units</Text>
              </View>
              <Text className="font-bold text-text-primary dark:text-text-primary-dark">{money(r.valueAtCost)}</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
    </View>
  );
}

function Row({ label, value, bold, color }: { label: string; value: string; bold?: boolean; color?: string }) {
  return (
    <View className={`flex-row justify-between items-center py-2 ${bold ? "border-t border-gray-100 dark:border-zinc-800 mt-1" : ""}`}>
      <Text className={`text-sm ${bold ? "font-black" : "font-medium"} text-text-primary dark:text-text-primary-dark`}>{label}</Text>
      <Text className={`text-sm ${bold ? "font-black" : "font-medium"} text-text-primary dark:text-text-primary-dark`} style={color ? { color } : undefined}>{value}</Text>
    </View>
  );
}
