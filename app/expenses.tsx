import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, FlatList, Pressable, ActivityIndicator, Image, Modal, Alert, TextInput, ScrollView, KeyboardAvoidingView, Platform, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "react-native-paper";
import { useTopInset } from "../src/lib/useTopInset";
import { useBottomInset } from "../src/lib/useBottomInset";
import { api, ApiError } from "../src/lib/api";
import EmptyState from "../src/components/EmptyState";

interface ExpenseRecord {
  id: string;
  amount: string;
  // Free-form — real expense taxonomies vary by trade (KNOWLEDGE-BASE.md
  // §7), not a fixed set.
  category: string;
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

const CATEGORY_ICON: Record<string, keyof typeof MaterialCommunityIcons.glyphMap> = {
  travel: "car-outline",
  fuel: "gas-station-outline",
  food: "food-outline",
  rent: "home-outline",
  utilities: "flash-outline",
  salaries: "account-cash-outline",
  marketing: "bullhorn-outline",
  maintenance: "wrench-outline",
  packaging: "package-variant-closed",
  other: "receipt",
};
function categoryIcon(category: string): keyof typeof MaterialCommunityIcons.glyphMap {
  return CATEGORY_ICON[category.toLowerCase()] ?? "receipt";
}

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
  const theme = useTheme();
  const topInset = useTopInset();
  const bottomInset = useBottomInset();
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<string[]>(["Travel", "Fuel", "Food", "Other"]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState<PeriodKey>("month");
  const [viewingUri, setViewingUri] = useState<string | null>(null);
  const [editingExpense, setEditingExpense] = useState<ExpenseRecord | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editCategory, setEditCategory] = useState<ExpenseRecord["category"]>("other");
  const [editNotes, setEditNotes] = useState("");
  const [editLoading, setEditLoading] = useState(false);

  const handleEditExpense = async () => {
    if (!editingExpense) return;
    const amountNum = parseFloat(editAmount);
    if (!amountNum || amountNum <= 0) {
      Alert.alert("Error", "Enter a valid amount");
      return;
    }
    setEditLoading(true);
    try {
      await api.patch(`/expenses/${editingExpense.id}`, {
        amount: amountNum,
        category: editCategory,
        notes: editNotes.trim() || undefined,
      });
      Alert.alert("Success", "Expense updated");
      setEditingExpense(null);
      load();
    } catch (e: any) {
      Alert.alert("Error", e instanceof ApiError ? e.message : "Failed to update expense");
    } finally {
      setEditLoading(false);
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: ExpenseRecord[] }>("/expenses");
      setExpenses(res.data ?? []);
    } catch (e) {
      console.error("Failed to load expenses:", e);
      Alert.alert("Error", "Could not load expenses. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await load(); } finally { setRefreshing(false); }
  }, [load]);

  useEffect(() => {
    load();
    api.get<{ data: string[] }>("/expenses/categories")
      .then((res) => { if (res.data) setCategoryOptions(res.data); })
      .catch(() => {});
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
          <MaterialCommunityIcons name="arrow-left" size={22} color={theme.colors.primary} />
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
        <Text className="text-xl font-black text-primary dark:text-primary-dark">₹{total.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="wallet-outline"
          title="No expenses recorded"
          description="Nothing recorded for this period yet."
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: bottomInset + 16, gap: 10 }}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => item.attachment && setViewingUri(item.attachment)}
              onLongPress={() => {
                setEditingExpense(item);
                setEditAmount(item.amount);
                setEditCategory(item.category);
                setEditNotes(item.notes || "");
              }}
              className="bg-surface-container-lowest dark:bg-surface-dark border border-outline-variant dark:border-outline rounded-2xl p-4 flex-row items-center"
              style={{ gap: 12 }}
            >
              <View className="w-11 h-11 rounded-full bg-primary/10 items-center justify-center">
                <MaterialCommunityIcons name={categoryIcon(item.category)} size={20} color={theme.colors.primary} />
              </View>
              <View className="flex-1">
                <Text className="font-bold text-on-surface dark:text-text-primary-dark capitalize">{item.category}</Text>
                <Text className="text-xs text-on-surface-variant dark:text-text-secondary-dark mt-0.5" numberOfLines={1}>
                  {new Date(item.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                  {item.notes ? ` · ${item.notes}` : ""}
                </Text>
              </View>
              {item.attachment && (
                <MaterialCommunityIcons name="paperclip" size={16} color={theme.colors.onSurfaceVariant} style={{ marginRight: 2 }} />
              )}
              <Text className="font-bold text-on-surface dark:text-text-primary-dark">₹{parseFloat(item.amount).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
            </Pressable>
          )}
        />
      )}

      {/* Edit Expense Modal */}
      <Modal visible={!!editingExpense} animationType="slide" transparent onRequestClose={() => setEditingExpense(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1 justify-end bg-black/40">
          <ScrollView className="bg-background dark:bg-bg-dark rounded-t-3xl px-6 pt-6" style={{ paddingBottom: bottomInset + 24 }}>
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-xl font-bold text-on-surface dark:text-text-primary-dark">Edit Expense</Text>
              <Pressable onPress={() => setEditingExpense(null)} className="w-10 h-10 items-center justify-center">
                <MaterialCommunityIcons name="close" size={20} color={theme.colors.onSurfaceVariant} />
              </Pressable>
            </View>

            <Text className="text-sm font-semibold text-on-surface-variant dark:text-text-secondary-dark uppercase tracking-wider mb-2">Amount *</Text>
            <TextInput
              value={editAmount} onChangeText={setEditAmount}
              keyboardType="numeric"
              className="bg-surface-container-lowest dark:bg-surface-dark text-on-surface dark:text-text-primary-dark border border-outline-variant dark:border-outline rounded-xl px-4 py-4 text-base font-medium mb-4"
            />

            <Text className="text-sm font-semibold text-on-surface-variant dark:text-text-secondary-dark uppercase tracking-wider mb-2">Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-2">
              <View className="flex-row gap-2">
                {categoryOptions.map((c) => (
                  <Pressable
                    key={c} onPress={() => setEditCategory(c)}
                    className={`px-4 py-2.5 rounded-xl border-2 ${
                      editCategory.toLowerCase() === c.toLowerCase() ? "border-primary bg-primary/10" : "border-outline-variant dark:border-outline"
                    }`}
                  >
                    <Text className={`text-sm font-bold ${editCategory.toLowerCase() === c.toLowerCase() ? "text-primary" : "text-on-surface dark:text-text-primary-dark"}`}>{c}</Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
            <TextInput
              value={editCategory} onChangeText={setEditCategory}
              placeholder="Or type a custom category..."
              className="bg-surface-container-lowest dark:bg-surface-dark text-on-surface dark:text-text-primary-dark border border-outline-variant dark:border-outline rounded-xl px-4 py-3 text-sm font-medium mb-4"
            />

            <Text className="text-sm font-semibold text-on-surface-variant dark:text-text-secondary-dark uppercase tracking-wider mb-2">Notes</Text>
            <TextInput
              value={editNotes} onChangeText={setEditNotes}
              multiline numberOfLines={2}
              className="bg-surface-container-lowest dark:bg-surface-dark text-on-surface dark:text-text-primary-dark border border-outline-variant dark:border-outline rounded-xl px-4 py-4 text-base font-medium mb-6"
            />

            <Pressable onPress={handleEditExpense} disabled={editLoading} className="bg-primary dark:bg-primary-dark py-4 rounded-xl items-center mb-4">
              {editLoading ? <ActivityIndicator color="white" /> : <Text className="text-white font-bold text-base">Save Changes</Text>}
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={viewingUri !== null} transparent animationType="fade" onRequestClose={() => setViewingUri(null)}>
        <Pressable className="flex-1 bg-black/90 items-center justify-center" onPress={() => setViewingUri(null)}>
          {viewingUri && <Image source={{ uri: viewingUri }} style={{ width: "92%", height: "70%" }} resizeMode="contain" />}
        </Pressable>
      </Modal>
    </View>
  );
}

