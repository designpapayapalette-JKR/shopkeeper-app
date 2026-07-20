import React, { useState } from "react";
import { Text, View, ScrollView, Pressable, ActivityIndicator, Alert } from "react-native";
import { useTheme } from "react-native-paper";
import { api } from "../src/lib/api";
import { useTopInset, useBottomInset } from "../src/lib/useTopInset";

type Tab = "balance-sheet" | "stock-valuation" | "trial-balance";

interface BalanceSheetData {
  assets: { inventoryValue: number; bankBalance: number; receivables: number; total: number };
  liabilities: { payables: number; total: number };
  equity: number;
}

interface StockValuationRow {
  id: string;
  name: string;
  quantity: number;
  valueAtCost: number;
}

interface StockValuationData {
  totalValueAtCost: number;
  totalValueAtSalePrice: number;
  rows: StockValuationRow[];
}

interface TrialBalanceAccount {
  id?: string;
  name: string;
  type: "debit" | "credit";
  amount: number;
}

interface TrialBalanceGroup {
  type: string;
  accounts: TrialBalanceAccount[];
  total: number;
}

interface TrialBalanceData {
  groups: TrialBalanceGroup[];
  totalDebit?: number;
  totalCredit?: number;
}

export default function BalanceSheetScreen() {
  const theme = useTheme();
  const topInset = useTopInset();
  const bottomInset = useBottomInset();
  const [tab, setTab] = useState<Tab>("balance-sheet");
  const [loading, setLoading] = useState(false);
  const [balanceSheet, setBalanceSheet] = useState<BalanceSheetData | null>(null);
  const [stockValuation, setStockValuation] = useState<StockValuationData | null>(null);
  const [trialBalance, setTrialBalance] = useState<TrialBalanceData | null>(null);

  const load = async (t: Tab) => {
    setTab(t);
    setLoading(true);
    try {
      if (t === "balance-sheet") {
        const res = await api.get<{ data: BalanceSheetData }>("/reports/balance-sheet");
        setBalanceSheet(res.data);
      } else if (t === "stock-valuation") {
        const res = await api.get<{ data: StockValuationData }>("/reports/stock-valuation");
        setStockValuation(res.data);
      } else {
        const res = await api.get<{ data: TrialBalanceData }>("/reports/trial-balance");
        setTrialBalance(res.data);
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
    <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingBottom: bottomInset + 24 }}>
      <Text className="text-xl font-black text-on-surface dark:text-text-primary-dark mb-1">Balance Sheet &amp; Stock Valuation</Text>
      <Text className="text-sm text-on-surface-variant dark:text-text-secondary-dark mb-4">Inventory valued at cost; receivables/payables from party balances.</Text>

      <View className="flex-row mb-4" style={{ gap: 8 }}>
        <Pressable onPress={() => load("balance-sheet")} className={`px-4 py-2 rounded-xl ${tab === "balance-sheet" ? "bg-primary dark:bg-primary-dark" : "bg-surface-container-lowest dark:bg-surface-dark border border-outline-variant dark:border-outline"}`}>
          <Text className={tab === "balance-sheet" ? "text-white font-bold" : "text-on-surface-variant dark:text-text-secondary-dark font-bold"}>Balance Sheet</Text>
        </Pressable>
        <Pressable onPress={() => load("stock-valuation")} className={`px-4 py-2 rounded-xl ${tab === "stock-valuation" ? "bg-primary dark:bg-primary-dark" : "bg-surface-container-lowest dark:bg-surface-dark border border-outline-variant dark:border-outline"}`}>
          <Text className={tab === "stock-valuation" ? "text-white font-bold" : "text-on-surface-variant dark:text-text-secondary-dark font-bold"}>Stock Valuation</Text>
        </Pressable>
        <Pressable onPress={() => load("trial-balance")} className={`px-4 py-2 rounded-xl ${tab === "trial-balance" ? "bg-primary dark:bg-primary-dark" : "bg-surface-container-lowest dark:bg-surface-dark border border-outline-variant dark:border-outline"}`}>
          <Text className={tab === "trial-balance" ? "text-white font-bold" : "text-on-surface-variant dark:text-text-secondary-dark font-bold"}>Trial Balance</Text>
        </Pressable>
      </View>

      {loading && (
        <View className="py-10 items-center">
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      )}

      {!loading && tab === "balance-sheet" && balanceSheet && (
        <View>
          <Text className="text-xs font-black text-primary dark:text-primary-dark uppercase tracking-widest mb-2">Assets</Text>
          <Row label="Inventory (at cost)" value={money(balanceSheet.assets.inventoryValue)} />
          <Row label="Bank Balance" value={money(balanceSheet.assets.bankBalance)} />
          <Row label="Receivables" value={money(balanceSheet.assets.receivables)} />
          <Row label="Total Assets" value={money(balanceSheet.assets.total)} bold />

          <Text className="text-xs font-black text-primary dark:text-primary-dark uppercase tracking-widest mb-2 mt-5">Liabilities &amp; Equity</Text>
          <Row label="Payables" value={money(balanceSheet.liabilities.payables)} />
          <Row label="Total Liabilities" value={money(balanceSheet.liabilities.total)} bold />
          <Row label="Equity" value={money(balanceSheet.equity)} bold colorClassName={balanceSheet.equity >= 0 ? "text-success" : "text-error"} />
        </View>
      )}

      {!loading && tab === "stock-valuation" && stockValuation && (
        <View style={{ paddingBottom: 24 }}>
          <View className="flex-row mb-4" style={{ gap: 10 }}>
            <View className="flex-1 bg-surface-container-lowest dark:bg-surface-dark p-3 rounded-2xl">
              <Text className="text-xs font-bold text-on-surface-variant dark:text-text-secondary-dark uppercase">At Cost</Text>
              <Text className="text-lg font-black text-on-surface dark:text-text-primary-dark">{money(stockValuation.totalValueAtCost)}</Text>
            </View>
            <View className="flex-1 bg-surface-container-lowest dark:bg-surface-dark p-3 rounded-2xl">
              <Text className="text-xs font-bold text-on-surface-variant dark:text-text-secondary-dark uppercase">At Sale Price</Text>
              <Text className="text-lg font-black text-success">{money(stockValuation.totalValueAtSalePrice)}</Text>
            </View>
          </View>
          {stockValuation.rows.map((r) => (
            <View key={r.id} className="flex-row justify-between items-center py-2.5 border-b border-outline-variant dark:border-outline">
              <View className="flex-1 mr-2">
                <Text className="font-bold text-on-surface dark:text-text-primary-dark" numberOfLines={1}>{r.name}</Text>
                <Text className="text-xs text-on-surface-variant dark:text-text-secondary-dark">{r.quantity} units</Text>
              </View>
              <Text className="font-bold text-on-surface dark:text-text-primary-dark">{money(r.valueAtCost)}</Text>
            </View>
          ))}
        </View>
      )}

      {!loading && tab === "trial-balance" && trialBalance && (
        <View style={{ paddingBottom: 24 }}>
          {trialBalance.groups?.map((group) => (
            <View key={group.type} className="mb-5">
              <Text className="text-xs font-black text-primary dark:text-primary-dark uppercase tracking-widest mb-2">{group.type}</Text>
              {group.accounts?.map((account) => (
                <View key={account.id || account.name} className="flex-row justify-between items-center py-2 border-b border-outline-variant dark:border-outline">
                  <Text className="text-sm font-medium text-on-surface dark:text-text-primary-dark flex-1">{account.name}</Text>
                  <Text className={`text-sm font-bold ${account.type === "credit" ? "text-success" : "text-on-surface dark:text-text-primary-dark"}`}>
                    {money(account.amount)}
                  </Text>
                </View>
              ))}
              <View className="flex-row justify-between items-center py-2 mt-1 border-t-2 border-outline-variant dark:border-outline">
                <Text className="text-sm font-black text-on-surface dark:text-text-primary-dark">Total {group.type}</Text>
                <Text className="text-sm font-black text-on-surface dark:text-text-primary-dark">{money(group.total)}</Text>
              </View>
            </View>
          ))}
          {trialBalance.totalDebit != null && trialBalance.totalCredit != null && (
            <View className="flex-row justify-between border-t-2 border-primary dark:border-primary-dark py-3 mt-2">
              <Text className="text-base font-black text-on-surface dark:text-text-primary-dark">Grand Total</Text>
              <View className="items-end">
                <Text className="text-sm font-bold text-on-surface dark:text-text-primary-dark">Dr: {money(trialBalance.totalDebit)}</Text>
                <Text className="text-sm font-bold text-success">Cr: {money(trialBalance.totalCredit)}</Text>
              </View>
            </View>
          )}
        </View>
      )}
    </ScrollView>
    </View>
  );
}

function Row({ label, value, bold, colorClassName }: { label: string; value: string; bold?: boolean; colorClassName?: string }) {
  return (
    <View className={`flex-row justify-between items-center py-2 ${bold ? "border-t border-outline-variant dark:border-outline mt-1" : ""}`}>
      <Text className={`text-sm ${bold ? "font-black" : "font-medium"} text-on-surface dark:text-text-primary-dark`}>{label}</Text>
      <Text className={`text-sm ${bold ? "font-black" : "font-medium"} ${colorClassName || "text-on-surface dark:text-text-primary-dark"}`}>{value}</Text>
    </View>
  );
}
