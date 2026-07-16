import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  Pressable,
  Alert,
  TextInput,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { api, ApiError } from "../src/lib/api";
import { useConfirm } from "../src/components/ConfirmDialog";
import { useTopInset } from "../src/lib/useTopInset";
import { useBottomInset } from "../src/lib/useBottomInset";

interface PurchaseItem {
  quantity: string;
  cost: string;
  tax_rate: string;
  product: { id: string; name: string };
}

interface PurchaseRecord {
  id: string;
  purchase_number: string;
  date: string;
  grand_total: string;
  supplier: { name: string };
  items: PurchaseItem[];
}

export default function PurchaseHistoryScreen() {
  const topInset = useTopInset();
  const bottomInset = useBottomInset();
  const confirm = useConfirm();
  const params = useLocalSearchParams<{ openPurchaseId?: string }>();
  const [purchases, setPurchases] = useState<PurchaseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [returnPurchase, setReturnPurchase] = useState<PurchaseRecord | null>(null);
  const [returnQuantities, setReturnQuantities] = useState<Record<string, string>>({});
  const [returnReason, setReturnReason] = useState("");
  const [submittingReturn, setSubmittingReturn] = useState(false);
  const handledOpenPurchaseId = useRef<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: PurchaseRecord[] }>("/purchases");
      setPurchases(res.data ?? []);
    } catch (e) {
      console.error("Failed to load purchase history:", e);
      Alert.alert("Error", "Could not load purchases. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!params.openPurchaseId) return;
    if (handledOpenPurchaseId.current === params.openPurchaseId) return;
    const match = purchases.find((p) => p.id === params.openPurchaseId);
    if (!match) return;
    handledOpenPurchaseId.current = params.openPurchaseId;
    openReturn(match);
  }, [params.openPurchaseId, purchases]);

  const filtered = purchases.filter((p) =>
    p.purchase_number.toLowerCase().includes(search.trim().toLowerCase())
  );

  const openReturn = (purchase: PurchaseRecord) => {
    setReturnPurchase(purchase);
    setReturnQuantities({});
    setReturnReason("");
  };

  const closeReturn = async () => {
    const hasChanges =
      returnReason.trim().length > 0 ||
      Object.values(returnQuantities).some((v) => v.trim().length > 0);
    if (hasChanges) {
      const ok = await confirm({
        title: "Discard changes?",
        message: "You have unsaved changes. Are you sure you want to go back?",
        confirmLabel: "Discard",
        destructive: true,
      });
      if (!ok) return;
    }
    setReturnPurchase(null);
  };

  const handleSubmitReturn = async () => {
    if (!returnPurchase) return;
    const items = returnPurchase.items
      .map((i) => ({
        productId: i.product.id,
        quantity: parseFloat(returnQuantities[i.product.id] || "0"),
        cost: parseFloat(i.cost),
        taxRate: parseFloat(i.tax_rate),
      }))
      .filter((i) => i.quantity > 0);

    if (items.length === 0) {
      Alert.alert("Nothing to Return", "Enter a quantity greater than 0 for at least one item.");
      return;
    }

    setSubmittingReturn(true);
    try {
      await api.post("/debit-notes", {
        purchaseId: returnPurchase.id,
        reason: returnReason || undefined,
        items,
      });
      Alert.alert("Debit Note Created", "Stock and the supplier's payable balance have been updated.");
      setReturnPurchase(null);
      load();
    } catch (e) {
      Alert.alert("Error", e instanceof ApiError ? e.message : "Failed to create debit note.");
    } finally {
      setSubmittingReturn(false);
    }
  };

  return (
    <View className="flex-1 bg-background dark:bg-bg-dark">
      <View
        className="bg-surface-container-lowest dark:bg-surface-dark border-b border-outline-variant dark:border-outline px-margin-mobile pb-3"
        style={{ paddingTop: topInset, gap: 12 }}
      >
        <Text className="text-2xl font-bold text-on-surface dark:text-text-primary-dark">
          Purchase History
        </Text>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search by purchase number"
          placeholderTextColor="#A0A0A0"
          className="bg-background dark:bg-bg-dark text-on-surface dark:text-text-primary-dark border border-outline-variant dark:border-outline rounded-xl px-4 py-3 text-base"
        />
      </View>

      {loading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#0F7A5F" />
        </View>
      ) : filtered.length === 0 ? (
        <View className="flex-1 justify-center items-center py-20">
          <Text className="text-on-surface-variant dark:text-text-secondary-dark font-bold text-base">
            No purchases found
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          renderItem={({ item }) => (
            <View className="bg-surface dark:bg-surface-dark rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm">
              <View className="p-4 flex-row justify-between items-center">
                <View className="flex-1 mr-2">
                  <Text className="font-bold text-base text-text-primary dark:text-text-primary-dark">
                    {item.purchase_number}
                  </Text>
                  <Text className="text-sm text-text-secondary mt-1">
                    {item.supplier.name} · {new Date(item.date).toLocaleDateString()}
                  </Text>
                </View>
                <Text className="text-base font-black text-text-primary dark:text-text-primary-dark">
                  ₹{parseFloat(item.grand_total).toFixed(2)}
                </Text>
              </View>
              <Pressable
                onPress={() => openReturn(item)}
                className="border-t border-gray-100 dark:border-zinc-800 py-2.5 items-center"
              >
                <View className="flex-row items-center" style={{ gap: 5 }}>
                  <MaterialCommunityIcons name="undo-variant" size={15} color="#D64545" />
                  <Text className="text-sm font-bold text-error">Return / Debit Note</Text>
                </View>
              </Pressable>
            </View>
          )}
        />
      )}

      <Modal visible={returnPurchase !== null} animationType="slide" onRequestClose={closeReturn}>
        <SafeAreaProvider>
        <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView className="flex-1 bg-background dark:bg-bg-dark px-6 pb-10" style={{ paddingTop: topInset }} keyboardShouldPersistTaps="handled">
          <View className="flex-row justify-between items-center mb-6">
            <Text className="text-2xl font-bold text-on-surface dark:text-text-primary-dark">
              Return / Debit Note
            </Text>
            <Pressable onPress={closeReturn} className="w-11 h-11 items-center justify-center">
              <MaterialCommunityIcons name="close" size={20} color="#6B7280" />
            </Pressable>
          </View>

          {returnPurchase && (
            <>
              <Text className="text-sm text-on-surface-variant dark:text-text-secondary-dark mb-6">
                Against purchase {returnPurchase.purchase_number} from {returnPurchase.supplier.name}. Enter the quantity being returned for each item.
              </Text>

              {returnPurchase.items.map((item) => (
                <View
                  key={item.product.id}
                  className="flex-row justify-between items-center bg-surface dark:bg-surface-dark p-4 rounded-xl border border-gray-100 dark:border-zinc-800 mb-3"
                >
                  <View className="flex-1 mr-3">
                    <Text className="font-bold text-on-surface dark:text-text-primary-dark">{item.product.name}</Text>
                    <Text className="text-sm text-on-surface-variant dark:text-text-secondary-dark">
                      Bought: {parseFloat(item.quantity).toFixed(0)} @ ₹{parseFloat(item.cost).toFixed(2)}
                    </Text>
                  </View>
                  <TextInput
                    value={returnQuantities[item.product.id] || ""}
                    onChangeText={(v) => setReturnQuantities((prev) => ({ ...prev, [item.product.id]: v }))}
                    placeholder="0"
                    keyboardType="numeric"
                    className="bg-background dark:bg-bg-dark text-on-surface dark:text-text-primary-dark border border-outline-variant dark:border-outline rounded-xl px-4 py-3 text-base font-bold w-20 text-center"
                  />
                </View>
              ))}

              <Text className="text-sm font-semibold text-on-surface-variant dark:text-text-secondary-dark uppercase tracking-wider mb-2 mt-2">
                Reason (optional)
              </Text>
              <TextInput
                value={returnReason}
                onChangeText={setReturnReason}
                placeholder="e.g. damaged goods, wrong item"
                placeholderTextColor="#A0A0A0"
                className="bg-surface dark:bg-surface-dark text-on-surface dark:text-text-primary-dark border border-outline-variant dark:border-outline rounded-xl px-4 py-4 text-base font-medium mb-8"
              />

              <Pressable
                onPress={handleSubmitReturn}
                disabled={submittingReturn}
                className="bg-error py-4 rounded-xl items-center"
                style={{ marginBottom: bottomInset }}
              >
                {submittingReturn ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-white font-bold text-base">Create Debit Note</Text>
                )}
              </Pressable>
            </>
          )}
        </ScrollView>
        </KeyboardAvoidingView>
        </SafeAreaProvider>
      </Modal>
    </View>
  );
}

