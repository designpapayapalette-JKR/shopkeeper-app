import React, { useState, useEffect } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator, Alert, TextInput } from "react-native";
import { api } from "../src/lib/api";
import { useTopInset } from "../src/lib/useTopInset";
import { MaterialCommunityIcons } from "@expo/vector-icons";

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
  const topInset = useTopInset();
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
    <ScrollView style={{ flex: 1, backgroundColor: "#f8fafc", paddingTop: topInset + 8 }}>
      <View className="px-4 py-3">
        <Text className="text-xl font-black text-text-primary mb-1">Payment History</Text>
        <Text className="text-sm text-text-secondary mb-4">Browse all payments received and made</Text>

        <View className="flex-row gap-2 mb-3">
          <View className="flex-1">
            <Text className="text-[10px] font-bold text-text-secondary uppercase mb-1">From</Text>
            <TextInput value={from} onChangeText={setFrom} className="bg-surface border border-gray-200 px-3 py-2 rounded-xl text-sm" />
          </View>
          <View className="flex-1">
            <Text className="text-[10px] font-bold text-text-secondary uppercase mb-1">To</Text>
            <TextInput value={to} onChangeText={setTo} className="bg-surface border border-gray-200 px-3 py-2 rounded-xl text-sm" />
          </View>
        </View>

        <View className="flex-row gap-2 mb-3">
          {["", "in", "out"].map((d) => (
            <Pressable
              key={d}
              onPress={() => setDirection(d)}
              className={`px-3 py-2 rounded-xl ${direction === d ? "bg-primary" : "bg-surface border border-gray-200"}`}
            >
              <Text className={`text-xs font-bold ${direction === d ? "text-white" : "text-text-primary"}`}>
                {d === "" ? "All" : d === "in" ? "Received" : "Sent"}
              </Text>
            </Pressable>
          ))}
          <Pressable onPress={load} className="bg-primary px-4 py-2 rounded-xl items-center justify-center">
            <MaterialCommunityIcons name="magnify" size={18} color="white" />
          </Pressable>
        </View>

        {loaded && payments.length > 0 && (
          <View className="flex-row gap-2 mb-4">
            <View className="flex-1 bg-surface rounded-xl px-4 py-3 border border-gray-100">
              <Text className="text-[10px] font-bold text-text-secondary uppercase">Received</Text>
              <Text className="text-base font-black text-green-600">₹{totalIn.toLocaleString("en-IN")}</Text>
            </View>
            <View className="flex-1 bg-surface rounded-xl px-4 py-3 border border-gray-100">
              <Text className="text-[10px] font-bold text-text-secondary uppercase">Sent</Text>
              <Text className="text-base font-black text-red-500">₹{totalOut.toLocaleString("en-IN")}</Text>
            </View>
          </View>
        )}

        <View className="bg-surface rounded-xl border border-gray-100 overflow-hidden">
          {loading ? (
            <View className="py-12 items-center"><ActivityIndicator /></View>
          ) : payments.length === 0 ? (
            <View className="py-12 items-center">
              <MaterialCommunityIcons name="credit-card-outline" size={32} color="#999" />
              <Text className="text-sm text-text-secondary mt-2">No payments found</Text>
            </View>
          ) : (
            payments.map((p) => (
              <View key={p.id} className="px-4 py-3 border-b border-gray-50 flex-row justify-between items-center">
                <View className="flex-1">
                  <Text className="text-sm font-bold text-text-primary">{p.party_name}</Text>
                  <Text className="text-xs text-text-secondary">
                    {new Date(p.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                    {p.mode ? ` · ${p.mode}` : ""}
                    {p.invoice_number ? ` · ${p.invoice_number}` : ""}
                  </Text>
                </View>
                <View className="items-end">
                  <Text className={`text-sm font-black ${p.direction === "in" ? "text-green-600" : "text-red-500"}`}>
                    {p.direction === "in" ? "+" : "-"}₹{p.amount.toLocaleString("en-IN")}
                  </Text>
                  <Text className="text-[10px] text-text-secondary">{p.direction === "in" ? "Received" : "Sent"}</Text>
                </View>
              </View>
            ))
          )}
        </View>
      </View>
    </ScrollView>
  );
}
