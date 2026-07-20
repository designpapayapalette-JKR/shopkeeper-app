import React, { useState, useEffect } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator, Alert, TextInput } from "react-native";
import { useTheme } from "react-native-paper";
import { api } from "../src/lib/api";
import { useTopInset, useBottomInset } from "../src/lib/useTopInset";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import EmptyState from "../src/components/EmptyState";

interface PaymentRow {
  id: string;
  date: string;
  party_name: string;
  direction: "in" | "out";
  amount: number;
  mode?: string;
  reference?: string;
  invoice_number?: string | null;
}

export default function PaymentHistoryScreen() {
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
  const [direction, setDirection] = useState<string>("");
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const params: any = { from, to };
      if (direction) params.direction = direction;
      const res = await api.get<{ data: PaymentRow[] }>("/reports/payments", { params });
      setPayments(res.data ?? []);
      setLoaded(true);
    } catch (e) {
      Alert.alert("Error", "Could not load payments.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const totalIn = payments.filter((p) => p.direction === "in").reduce((s, p) => s + p.amount, 0);
  const totalOut = payments.filter((p) => p.direction === "out").reduce((s, p) => s + p.amount, 0);

  return (
    <View className="flex-1 bg-background dark:bg-bg-dark" style={{ paddingTop: topInset + 8 }}>
    <ScrollView contentContainerStyle={{ paddingBottom: bottomInset + 24 }}>
      <View className="px-4 py-3">
        <Text className="text-xl font-black text-on-surface dark:text-text-primary-dark mb-1">Payment History</Text>
        <Text className="text-sm text-on-surface-variant dark:text-text-secondary-dark mb-4">Browse all payments received and made</Text>

        <View className="flex-row gap-2 mb-3">
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

        <View className="flex-row gap-2 mb-3">
          {["", "in", "out"].map((d) => (
            <Pressable
              key={d}
              onPress={() => setDirection(d)}
              className={`px-3 py-2 rounded-xl ${direction === d ? "bg-primary dark:bg-primary-dark" : "bg-surface-container-lowest dark:bg-surface-dark border border-outline-variant dark:border-outline"}`}
            >
              <Text className={`text-xs font-bold ${direction === d ? "text-white" : "text-on-surface dark:text-text-primary-dark"}`}>
                {d === "" ? "All" : d === "in" ? "Received" : "Sent"}
              </Text>
            </Pressable>
          ))}
          <Pressable onPress={load} className="bg-primary dark:bg-primary-dark px-4 py-2 rounded-xl items-center justify-center">
            <MaterialCommunityIcons name="magnify" size={18} color="white" />
          </Pressable>
        </View>

        {loaded && payments.length > 0 && (
          <View className="flex-row gap-2 mb-4">
            <View className="flex-1 bg-surface-container-lowest dark:bg-surface-dark rounded-xl px-4 py-3 border border-outline-variant dark:border-outline">
              <Text className="text-[10px] font-bold text-on-surface-variant dark:text-text-secondary-dark uppercase">Received</Text>
              <Text className="text-base font-black text-success">₹{totalIn.toLocaleString("en-IN")}</Text>
            </View>
            <View className="flex-1 bg-surface-container-lowest dark:bg-surface-dark rounded-xl px-4 py-3 border border-outline-variant dark:border-outline">
              <Text className="text-[10px] font-bold text-on-surface-variant dark:text-text-secondary-dark uppercase">Sent</Text>
              <Text className="text-base font-black text-error">₹{totalOut.toLocaleString("en-IN")}</Text>
            </View>
          </View>
        )}

        <View className="bg-surface-container-lowest dark:bg-surface-dark rounded-xl border border-outline-variant dark:border-outline overflow-hidden">
          {loading ? (
            <View className="py-12 items-center"><ActivityIndicator color={theme.colors.primary} /></View>
          ) : payments.length === 0 ? (
            <EmptyState icon="credit-card-outline" title="No payments found" />
          ) : (
            payments.map((p) => (
              <View key={p.id} className="px-4 py-3 border-b border-outline-variant dark:border-outline flex-row justify-between items-center">
                <View className="flex-1">
                  <Text className="text-sm font-bold text-on-surface dark:text-text-primary-dark">{p.party_name}</Text>
                  <Text className="text-xs text-on-surface-variant dark:text-text-secondary-dark">
                    {new Date(p.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                    {p.mode ? ` · ${p.mode}` : ""}
                    {p.invoice_number ? ` · ${p.invoice_number}` : ""}
                  </Text>
                </View>
                <View className="items-end">
                  <Text className={`text-sm font-black ${p.direction === "in" ? "text-success" : "text-error"}`}>
                    {p.direction === "in" ? "+" : "-"}₹{p.amount.toLocaleString("en-IN")}
                  </Text>
                  <Text className="text-[10px] text-on-surface-variant dark:text-text-secondary-dark">{p.direction === "in" ? "Received" : "Sent"}</Text>
                </View>
              </View>
            ))
          )}
        </View>
      </View>
    </ScrollView>
    </View>
  );
}
