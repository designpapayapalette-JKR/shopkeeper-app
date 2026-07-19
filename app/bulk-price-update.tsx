import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  Pressable,
  Alert,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { api, ApiError } from "../src/lib/api";
import { useTopInset } from "../src/lib/useTopInset";
import { useBottomInset } from "../src/lib/useBottomInset";

interface PriceItem {
  id: string;
  name: string;
  price: number;
}

export default function BulkPriceUpdateScreen() {
  const topInset = useTopInset();
  const bottomInset = useBottomInset();
  const router = useRouter();

  const [items, setItems] = useState<PriceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [percent, setPercent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: { id: string; name: string; price: string }[] }>("/products");
      const list = (res.data ?? []).map((p) => ({
        id: p.id,
        name: p.name,
        price: parseFloat(p.price || "0"),
      }));
      setItems(list);
    } catch (e) {
      Alert.alert("Error", "Failed to load products.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const applyPercent = (pctStr: string) => {
    setPercent(pctStr);
    const pct = parseFloat(pctStr);
    if (isNaN(pct)) return;
    setItems((prev) =>
      prev.map((p) => {
        const product = prev.find((x) => x.id === p.id);
        if (!product) return p;
        const orig = parseFloat(product.price.toFixed(2));
        return { ...p, price: Math.round(orig * (1 + pct / 100) * 100) / 100 };
      })
    );
  };

  const updatePrice = (id: string, val: string) => {
    const num = parseFloat(val);
    if (isNaN(num)) return;
    setItems((prev) => prev.map((p) => (p.id === id ? { ...p, price: num } : p)));
  };

  const handleSave = async () => {
    const validItems = items.filter((p) => p.price >= 0);
    if (validItems.length === 0) {
      Alert.alert("Nothing to Update", "No products with valid prices.");
      return;
    }
    setSubmitting(true);
    try {
      const updates = validItems.map((p) => ({ id: p.id, price: p.price }));
      const res = await api.post<{ data: { updated: number } }>("/products/bulk-price-update", { updates });
      Alert.alert("Success", `Updated ${res.data.updated} product(s).`);
      router.back();
    } catch (e) {
      Alert.alert("Error", e instanceof ApiError ? e.message : "Bulk price update failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const renderItem = ({ item }: { item: PriceItem }) => (
    <View className="flex-row items-center bg-surface dark:bg-surface-dark px-4 py-3.5 rounded-2xl border border-gray-100 dark:border-zinc-800 mb-2">
      <Text className="flex-1 text-sm font-bold text-text-primary dark:text-text-primary-dark mr-2" numberOfLines={1}>
        {item.name}
      </Text>
      <TextInput
        value={item.price.toString()}
        onChangeText={(v) => updatePrice(item.id, v)}
        keyboardType="decimal-pad"
        className="bg-background dark:bg-zinc-900 text-text-primary dark:text-text-primary-dark border border-gray-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-sm font-bold w-24 text-right"
      />
    </View>
  );

  return (
    <View className="flex-1 bg-background dark:bg-background-dark" style={{ paddingTop: topInset }}>
      <View className="flex-row items-center justify-between px-6 py-4">
        <View className="flex-row items-center" style={{ gap: 8 }}>
          <Pressable onPress={() => router.back()} className="w-9 h-9 items-center justify-center active:opacity-70">
            <MaterialCommunityIcons name="arrow-left" size={22} color="#6B7280" />
          </Pressable>
          <Text className="text-xl font-bold text-text-primary dark:text-text-primary-dark">
            Bulk Price Update
          </Text>
        </View>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#0368FE" />
        </View>
      ) : (
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          className="flex-1"
        >
          <ScrollView
            className="flex-1 px-6"
            contentContainerStyle={{ paddingBottom: bottomInset + 24 }}
            showsVerticalScrollIndicator={false}
          >
            {/* % Change Input */}
            <View className="bg-surface dark:bg-surface-dark p-5 rounded-3xl border border-gray-100 dark:border-zinc-800 shadow-sm mb-6">
              <Text className="text-lg font-bold text-text-primary dark:text-text-primary-dark mb-4">
                Apply % Change
              </Text>
              <View className="flex-row items-center" style={{ gap: 8 }}>
                <TextInput
                  value={percent}
                  onChangeText={applyPercent}
                  placeholder="e.g. 10 or -5"
                  placeholderTextColor="#A0A0A0"
                  keyboardType="numeric"
                  className="flex-1 bg-background dark:bg-zinc-900 text-text-primary dark:text-text-primary-dark border border-gray-200 dark:border-zinc-800 rounded-xl px-4 py-3.5 font-medium"
                />
                <Text className="text-sm font-bold text-text-secondary">%</Text>
              </View>
              <Text className="text-xs text-text-secondary mt-2">Positive = increase, negative = decrease</Text>
            </View>

            {/* Product List */}
            <View className="bg-surface dark:bg-surface-dark p-5 rounded-3xl border border-gray-100 dark:border-zinc-800 shadow-sm mb-6">
              <Text className="text-lg font-bold text-text-primary dark:text-text-primary-dark mb-3">
                {items.length} Product{items.length !== 1 ? "s" : ""}
              </Text>

              {items.map((item) => (
                <View key={item.id}>
                  {renderItem({ item })}
                </View>
              ))}
            </View>

            <Pressable
              onPress={handleSave}
              disabled={submitting}
              className="bg-primary py-4 rounded-xl items-center mb-6"
            >
              {submitting ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white font-bold text-base">Update {items.length} Prices</Text>
              )}
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}
