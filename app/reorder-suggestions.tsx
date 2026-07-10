import React, { useState, useEffect } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator, Alert } from "react-native";
import { api } from "../src/lib/api";
import { useTopInset } from "../src/lib/useTopInset";
import { MaterialCommunityIcons } from "@expo/vector-icons";

interface Suggestion {
  product_id: string;
  product_name: string;
  sku?: string;
  current_stock: number;
  reorder_level: number;
  suggested_quantity: number;
  unit: string;
}

export default function ReorderSuggestionsScreen() {
  const topInset = useTopInset();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [selection, setSelection] = useState<Set<string>>(new Set());

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: Suggestion[] }>("/purchases/reorder-suggestions");
      setSuggestions(res.data ?? []);
    } catch (e) {
      Alert.alert("Error", "Could not load reorder suggestions.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const toggle = (id: string) => {
    setSelection((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selection.size === suggestions.length) setSelection(new Set());
    else setSelection(new Set(suggestions.map((s) => s.product_id)));
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "#f8fafc", paddingTop: topInset + 8 }}>
      <View className="px-4 py-3">
        <View className="flex-row justify-between items-center mb-2">
          <Text className="text-xl font-black text-text-primary">Reorder Suggestions</Text>
          {!loading && (
            <Pressable onPress={load}><MaterialCommunityIcons name="refresh" size={22} color="#0F7A5F" /></Pressable>
          )}
        </View>
        <Text className="text-sm text-text-secondary mb-4">
          Products below reorder level — suggested purchase quantities calculated automatically.
        </Text>

        {loading ? (
          <View className="py-12 items-center"><ActivityIndicator /></View>
        ) : suggestions.length === 0 ? (
          <View className="py-12 items-center">
            <MaterialCommunityIcons name="check-circle-outline" size={40} color="#22c55e" />
            <Text className="text-sm text-text-secondary mt-2">All products are above reorder level.</Text>
          </View>
        ) : (
          <>
            <View className="flex-row gap-2 mb-4">
              <Pressable onPress={selectAll} className="bg-surface border border-gray-200 px-4 py-2 rounded-xl">
                <Text className="text-sm font-bold text-text-primary">
                  {selection.size === suggestions.length ? "Deselect All" : "Select All"}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => Alert.alert("Coming Soon", "One-click purchase order generation from selected items will be available soon. For now, go to Operations > Record Purchase Bill to create the purchase.")}
                className="bg-primary px-4 py-2 rounded-xl"
              >
                <Text className="text-sm font-bold text-white">Generate PO ({selection.size})</Text>
              </Pressable>
            </View>

            {suggestions.map((s) => (
              <Pressable
                key={s.product_id}
                onPress={() => toggle(s.product_id)}
                className="bg-surface rounded-xl border border-gray-100 p-4 mb-2 flex-row items-center"
              >
                <View className="w-6 h-6 rounded-md border-2 mr-3 items-center justify-center"
                  style={{ borderColor: selection.has(s.product_id) ? "#0F7A5F" : "#ccc", backgroundColor: selection.has(s.product_id) ? "#0F7A5F" : "transparent" }}
                >
                  {selection.has(s.product_id) && <MaterialCommunityIcons name="check" size={14} color="white" />}
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-bold text-text-primary">{s.product_name}</Text>
                  <Text className="text-xs text-text-secondary">
                    Stock: {s.current_stock} {s.unit} · Reorder at: {s.reorder_level}
                  </Text>
                  <Text className="text-xs font-bold text-primary">
                    Suggested order: {s.suggested_quantity} {s.unit}
                  </Text>
                </View>
              </Pressable>
            ))}
          </>
        )}
      </View>
    </ScrollView>
  );
}
