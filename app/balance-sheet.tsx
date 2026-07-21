import React, { useState } from "react";
import { Text, View, ScrollView, Pressable, ActivityIndicator, Alert } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
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

const TABS: { key: Tab; label: string }[] = [
  { key: "balance-sheet", label: "Balance Sheet" },
  { key: "stock-valuation", label: "Stock" },
  { key: "trial-balance", label: "Trial" },
];

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

  const money = (n: number) => `\u20B9${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: topInset + 8 }}>
      <View className="px-5 pb-2 flex-row items-center" style={{ gap: 10 }}>
        <View className="w-1.5 h-7 rounded-full bg-primary" />
        <Text className="text-xl font-black text-on-surface">Reports</Text>
      </View>

      <View className="flex-row mx-5 mb-4 bg-surface-container rounded-xl p-1" style={{ gap: 2 }}>
        {TABS.map((t) => (
          <Pressable
            key={t.key}
            onPress={() => load(t.key)}
            className={`flex-1 py-2 rounded-lg items-center ${tab === t.key ? "bg-surface-container-lowest shadow-sm" : ""}`}
          >
            <Text className={`text-xs font-bold ${tab === t.key ? "text-primary" : "text-on-surface-variant"}`}>
              {t.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingBottom: bottomInset + 24 }}>
        {loading && (
          <View className="py-16 items-center">
            <ActivityIndicator color={theme.colors.primary} />
          </View>
        )}

        {!loading && tab === "balance-sheet" && balanceSheet && (
          <View className="bg-surface-container-lowest rounded-2xl border border-outline-variant p-5">
            <Text className="text-xs font-black text-primary uppercase tracking-widest mb-3">Assets</Text>
            <BSheetRow label="Inventory (at cost)" value={money(balanceSheet.assets.inventoryValue)} />
            <BSheetRow label="Bank Balance" value={money(balanceSheet.assets.bankBalance)} />
            <BSheetRow label="Receivables" value={money(balanceSheet.assets.receivables)} />
            <BSheetRow label="Total Assets" value={money(balanceSheet.assets.total)} bold />
            <View className="h-px bg-outline-variant my-4" />
            <Text className="text-xs font-black text-primary uppercase tracking-widest mb-3">Liabilities &amp; Equity</Text>
            <BSheetRow label="Payables" value={money(balanceSheet.liabilities.payables)} />
            <BSheetRow label="Total Liabilities" value={money(balanceSheet.liabilities.total)} bold />
            <BSheetRow label="Equity" value={money(balanceSheet.equity)} bold color={balanceSheet.equity >= 0 ? theme.colors.primary : theme.colors.error} />
          </View>
        )}

        {!loading && tab === "stock-valuation" && stockValuation && (
          <View>
            <View className="flex-row mb-4" style={{ gap: 10 }}>
              <View className="flex-1 bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant">
                <Text className="text-xs font-bold text-on-surface-variant uppercase">At Cost</Text>
                <Text className="text-lg font-black text-on-surface mt-0.5">{money(stockValuation.totalValueAtCost)}</Text>
              </View>
              <View className="flex-1 bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant">
                <Text className="text-xs font-bold text-on-surface-variant uppercase">At Sale Price</Text>
                <Text className="text-lg font-black text-success mt-0.5">{money(stockValuation.totalValueAtSalePrice)}</Text>
              </View>
            </View>
            <View className="bg-surface-container-lowest rounded-2xl border border-outline-variant overflow-hidden">
              {stockValuation.rows.map((r, i) => (
                <View
                  key={r.id}
                  className={`flex-row items-center px-5 py-3.5 ${i < stockValuation.rows.length - 1 ? "border-b border-outline-variant" : ""}`}
                >
                  <View className="flex-1 mr-2">
                    <Text className="font-bold text-on-surface" numberOfLines={1}>{r.name}</Text>
                    <Text className="text-xs text-on-surface-variant mt-0.5">{r.quantity} units</Text>
                  </View>
                  <Text className="font-bold text-on-surface">{money(r.valueAtCost)}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {!loading && tab === "trial-balance" && trialBalance && (
          <View style={{ gap: 16 }}>
            {trialBalance.groups?.map((group) => (
              <View key={group.type} className="bg-surface-container-lowest rounded-2xl border border-outline-variant p-5">
                <Text className="text-xs font-black text-primary uppercase tracking-widest mb-3">{group.type}</Text>
                {group.accounts?.map((account) => (
                  <View key={account.id || account.name} className="flex-row justify-between items-center py-2">
                    <Text className="text-sm font-medium text-on-surface flex-1 mr-2">{account.name}</Text>
                    <Text className={`text-sm font-bold ${account.type === "credit" ? "text-success" : "text-on-surface"}`}>
                      {money(account.amount)}
                    </Text>
                  </View>
                ))}
                <View className="flex-row justify-between items-center pt-3 mt-2 border-t-2 border-outline-variant">
                  <Text className="text-sm font-black text-on-surface">Total {group.type}</Text>
                  <Text className="text-sm font-black text-on-surface">{money(group.total)}</Text>
                </View>
              </View>
            ))}
            {trialBalance.totalDebit != null && trialBalance.totalCredit != null && (
              <View className="bg-surface-container-lowest rounded-2xl border border-primary p-5">
                <View className="flex-row justify-between items-center">
                  <Text className="text-base font-black text-on-surface">Grand Total</Text>
                  <View className="items-end">
                    <Text className="text-sm font-bold text-on-surface">Dr: {money(trialBalance.totalDebit)}</Text>
                    <Text className="text-sm font-bold text-success">Cr: {money(trialBalance.totalCredit)}</Text>
                  </View>
                </View>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function BSheetRow({ label, value, bold, color }: { label: string; value: string; bold?: boolean; color?: string }) {
  return (
    <View className="flex-row justify-between items-center py-2">
      <Text className={`text-sm flex-1 mr-2 ${bold ? "font-black text-on-surface" : "font-medium text-on-surface-variant"}`}>
        {label}
      </Text>
      <Text className={`text-sm ${bold ? "font-black" : "font-medium"}`} style={{ color: color || undefined }}>
        {value}
      </Text>
    </View>
  );
}
