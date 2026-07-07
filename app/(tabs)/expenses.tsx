import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, FlatList, Pressable, ActivityIndicator, Image, Modal } from "react-native";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTopInset } from "../../src/lib/useTopInset";
import { useBottomInset } from "../../src/lib/useBottomInset";
import { api } from "../../src/lib/api";

interface ExpenseRecord {
  id: string;
  amount: string;
  category: "travel" | "fuel" | "food" | "other";
  date: string;
  notes: string | null;
  status: "submitted" | "approved" | "rejected" | "reimbursed";
  attachment: string | null;
}

type PeriodKey = "day" | "week" | "month" | "year";
const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "day", label: "Today" },
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "year", label: "This Year" },
];

const CATEGORY_ICON: Record<ExpenseRecord["category"], keyof typeof MaterialCommunityIcons.glyphMap> = {
  travel: "car-outline",
  fuel: "gas-station-outline",
  food: "food-outline",
  other: "receipt",
};

function startOfPeriod(period: PeriodKey): Date {
  const now = new Date();
  if (period === "day") return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === "week") {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    d.setDate(d.getDate() - d.getDay());
    return d;
  }
  if (period === "month") return new Date(now.getFullYear(), now.getMonth(), 1);
  return new Date(now.getFullYear(), 0, 1);
}

// Every expense claim ever made, previously only reachable one-at-a-time
// via the dashboard's rolling "Cash Out" total — there was no screen that
// actually listed past expenses at all. Grouped by Day/Week/Month/Year
// since that's how a shopkeeper naturally thinks about spend ("what did I
// spend this month"), not a raw chronological dump.
export default function ExpensesScreen() {
  const router = useRouter();
  const topInset = useTopInset();
  const bottomInset = useBottomInset();
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<PeriodKey>("month");
  const [viewingUri, setViewingUri] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: ExpenseRecord[] }>("/expenses");
      setExpenses(res.data ?? []);
    } catch (e) {
      console.error("Failed to load expenses:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const from = startOfPeriod(period).getTime();
    return expenses
      .filter((e) => new Date(e.date).getTime() >= from)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [expenses, period]);

  const total = filtered.reduce((sum, e) => sum + parseFloat(e.amount || "0"), 0);

  return (
    <View className="flex-1 bg-background dark:bg-bg-dark" style={{ paddingTop: topInset }}>
      <View className="px-6 pb-4 flex-row items-center" style={{ gap: 12 }}>
        <Pressable onPress={() => router.back()} className="w-10 h-10 items-center justify-center -ml-2">
          <MaterialCommunityIcons name="arrow-left" size={22} color="#0F7A5F" />
        </Pressable>
        <Text className="text-2xl font-black text-on-surface dark:text-text-primary-dark">Expenses</Text>
      </View>

      <View className="px-6 mb-4 flex-row" style={{ gap: 8 }}>
        {PERIODS.map((p) => (
          <Pressable
            key={p.key}
            onPress={() => setPeriod(p.key)}
            className={`flex-1 py-2.5 rounded-xl items-center border ${
              period === p.key
                ? "bg-primary dark:bg-primary-dark border-primary"
                : "bg-surface-container-lowest dark:bg-surface-dark border-outline-variant dark:border-outline"
            }`}
          >
            <Text className={`text-xs font-bold ${period === p.key ? "text-white" : "text-on-surface dark:text-text-primary-dark"}`}>
              {p.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <View className="mx-6 mb-4 bg-primary/10 dark:bg-primary-dark/10 rounded-2xl p-4 flex-row items-center justify-between">
        <Text className="text-sm font-bold text-on-surface dark:text-text-primary-dark">
          Total {PERIODS.find((p) => p.key === period)?.label}
        </Text>
        <Text className="text-xl font-black text-primary dark:text-primary-dark">₹{total.toFixed(2)}</Text>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#0F7A5F" />
        </View>
      ) : filtered.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-on-surface-variant dark:text-text-secondary-dark font-bold text-center">
            No expenses recorded for this period.
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: bottomInset + 16, gap: 10 }}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => item.attachment && setViewingUri(item.attachment)}
              className="bg-surface-container-lowest dark:bg-surface-dark border border-outline-variant dark:border-outline rounded-2xl p-4 flex-row items-center"
              style={{ gap: 12 }}
            >
              <View className="w-11 h-11 rounded-full bg-primary/10 items-center justify-center">
                <MaterialCommunityIcons name={CATEGORY_ICON[item.category]} size={20} color="#0F7A5F" />
              </View>
              <View className="flex-1">
                <Text className="font-bold text-on-surface dark:text-text-primary-dark capitalize">{item.category}</Text>
                <Text className="text-xs text-on-surface-variant dark:text-text-secondary-dark mt-0.5" numberOfLines={1}>
                  {new Date(item.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                  {item.notes ? ` · ${item.notes}` : ""}
                </Text>
              </View>
              {item.attachment && (
                <MaterialCommunityIcons name="paperclip" size={16} color="#9E9E9E" style={{ marginRight: 2 }} />
              )}
              <Text className="font-bold text-on-surface dark:text-text-primary-dark">₹{parseFloat(item.amount).toFixed(2)}</Text>
            </Pressable>
          )}
        />
      )}

      <Modal visible={viewingUri !== null} transparent animationType="fade" onRequestClose={() => setViewingUri(null)}>
        <Pressable className="flex-1 bg-black/90 items-center justify-center" onPress={() => setViewingUri(null)}>
          {viewingUri && <Image source={{ uri: viewingUri }} style={{ width: "92%", height: "70%" }} resizeMode="contain" />}
        </Pressable>
      </Modal>
    </View>
  );
}
