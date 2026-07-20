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
  RefreshControl,
} from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { useTheme } from "react-native-paper";
import { api, ApiError } from "../src/lib/api";
import { useConfirm } from "../src/components/ConfirmDialog";
import { useTopInset, useBottomInset } from "../src/lib/useTopInset";
import { shareDataAsPdf } from "../src/lib/pdfExport";

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
  const theme = useTheme();
  const params = useLocalSearchParams<{ openPurchaseId?: string }>();
  const [purchases, setPurchases] = useState<PurchaseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");

  const [detailPurchase, setDetailPurchase] = useState<PurchaseRecord | null>(null);
  const [returnPurchase, setReturnPurchase] = useState<PurchaseRecord | null>(null);
  const [returnQuantities, setReturnQuantities] = useState<Record<string, string>>({});
  const [returnReason, setReturnReason] = useState("");
  const [submittingReturn, setSubmittingReturn] = useState(false);

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

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await load(); } finally { setRefreshing(false); }
  }, [load]);

  useEffect(() => { load(); }, [load]);

  const filtered = purchases.filter((p) =>
    p.purchase_number.toLowerCase().includes(search.trim().toLowerCase())
  );

  const openDetail = (purchase: PurchaseRecord) => {
    setDetailPurchase(purchase);
  };

  const openReturn = (purchase: PurchaseRecord) => {
    setReturnPurchase(purchase);
    setReturnQuantities({});
    setReturnReason("");
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
      setDetailPurchase(null);
      load();
    } catch (e) {
      Alert.alert("Error", e instanceof ApiError ? e.message : "Failed to create debit note.");
    } finally {
      setSubmittingReturn(false);
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")}/${d.getFullYear()}`;
  };

  return (
    <View className="flex-1 bg-background dark:bg-bg-dark">
      <View className="bg-surface-container-lowest dark:bg-surface-dark border-b border-outline-variant dark:border-outline px-4 pb-3" style={{ paddingTop: topInset, gap: 12 }}>
        <View className="flex-row items-center justify-between">
          <Text className="text-2xl font-bold text-on-surface dark:text-text-primary-dark">Purchase History</Text>
          <Pressable onPress={() => {
            const headers = ["Purchase #", "Supplier", "Date", "Items", "Total"];
            const rows = purchases.map((p) => [p.purchase_number, p.supplier.name, new Date(p.date).toLocaleDateString("en-IN"), String(p.items.length), `₹${parseFloat(p.grand_total).toLocaleString("en-IN")}`]);
            shareDataAsPdf("Purchase History", headers, rows, "purchases.pdf");
          }} className="flex-row items-center gap-1 bg-primary px-3 py-2 rounded-lg">
            <MaterialCommunityIcons name="file-pdf-box" size={16} color="white" />
            <Text className="text-xs font-bold text-white">Export</Text>
          </Pressable>
        </View>
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
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : filtered.length === 0 ? (
        <View className="flex-1 justify-center items-center py-20 px-6">
          <MaterialCommunityIcons name="truck-delivery" size={48} color={theme.colors.outline} />
          <Text className="text-base font-bold text-on-surface dark:text-text-primary-dark mt-4">No Purchases Found</Text>
          <Text className="text-sm text-on-surface-variant dark:text-text-secondary-dark text-center mt-2">Register purchase intakes in Inventory.</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: bottomInset + 24 }}
          renderItem={({ item }) => (
            <Pressable onPress={() => openDetail(item)} className="bg-surface-container-lowest dark:bg-surface-dark rounded-2xl border border-outline-variant dark:border-outline shadow-sm">
              <View className="p-4 flex-row justify-between items-center">
                <View className="flex-1 mr-2">
                  <Text className="font-bold text-base text-on-surface dark:text-text-primary-dark">{item.purchase_number}</Text>
                  <Text className="text-sm text-on-surface-variant dark:text-text-secondary-dark mt-1">{item.supplier.name} · {formatDate(item.date)}</Text>
                </View>
                <Text className="text-base font-black text-on-surface dark:text-text-primary-dark">₹{parseFloat(item.grand_total).toLocaleString("en-IN")}</Text>
              </View>
              <View className="border-t border-outline-variant dark:border-outline py-2.5 items-center">
                <View className="flex-row items-center" style={{ gap: 5 }}>
                  <MaterialCommunityIcons name="chevron-right" size={15} color={theme.colors.onSurfaceVariant} />
                  <Text className="text-xs text-on-surface-variant dark:text-text-secondary-dark">{item.items.length} items</Text>
                </View>
              </View>
            </Pressable>
          )}
        />
      )}

      {/* Detail Modal */}
      <Modal visible={detailPurchase !== null && returnPurchase === null} animationType="slide" onRequestClose={() => setDetailPurchase(null)}>
        <SafeAreaProvider>
          <ScrollView className="flex-1 bg-background dark:bg-bg-dark" style={{ paddingTop: topInset }}>
            <View className="px-6 pb-10">
              <View className="flex-row justify-between items-center mb-6">
                <Text className="text-2xl font-bold text-on-surface dark:text-text-primary-dark">
                  {detailPurchase?.purchase_number || "Purchase"}
                </Text>
                <Pressable onPress={() => setDetailPurchase(null)} className="w-11 h-11 items-center justify-center">
                  <MaterialCommunityIcons name="close" size={20} color={theme.colors.onSurfaceVariant} />
                </Pressable>
              </View>

              {detailPurchase && (
                <>
                  <View className="bg-surface-container-lowest dark:bg-surface-dark p-5 rounded-3xl border border-outline-variant dark:border-outline shadow-sm mb-4">
                    <Text className="text-sm text-on-surface-variant dark:text-text-secondary-dark mb-1">Supplier</Text>
                    <Text className="text-lg font-bold text-on-surface dark:text-text-primary-dark mb-3">{detailPurchase.supplier.name}</Text>
                    <Text className="text-sm text-on-surface-variant dark:text-text-secondary-dark mb-1">Date</Text>
                    <Text className="text-sm font-bold text-on-surface dark:text-text-primary-dark mb-3">{formatDate(detailPurchase.date)}</Text>
                    <Text className="text-sm text-on-surface-variant dark:text-text-secondary-dark mb-1">Grand Total</Text>
                    <Text className="text-2xl font-black text-on-surface dark:text-text-primary-dark">₹{parseFloat(detailPurchase.grand_total).toLocaleString("en-IN")}</Text>
                  </View>

                  <View className="bg-surface-container-lowest dark:bg-surface-dark p-5 rounded-3xl border border-outline-variant dark:border-outline shadow-sm mb-4">
                    <Text className="text-sm font-bold text-on-surface dark:text-text-primary-dark mb-3">Items ({detailPurchase.items.length})</Text>
                    {detailPurchase.items.map((item, idx) => (
                      <View key={item.product.id + idx} className="flex-row items-center py-2.5 border-b border-outline-variant dark:border-outline">
                        <View className="flex-1 mr-2">
                          <Text className="text-sm font-bold text-on-surface dark:text-text-primary-dark" numberOfLines={1}>{item.product.name}</Text>
                          <Text className="text-xs text-on-surface-variant dark:text-text-secondary-dark mt-0.5">
                            Qty: {parseFloat(item.quantity).toFixed(0)} × ₹{parseFloat(item.cost).toLocaleString("en-IN")}
                          </Text>
                        </View>
                        <Text className="text-sm font-bold text-on-surface dark:text-text-primary-dark shrink-0">
                          ₹{(parseFloat(item.quantity) * parseFloat(item.cost)).toLocaleString("en-IN")}
                        </Text>
                      </View>
                    ))}
                  </View>

                  <Pressable
                    onPress={() => { setDetailPurchase(null); openReturn(detailPurchase); }}
                    className="flex-row items-center justify-center bg-error py-4 rounded-xl active:opacity-80"
                    style={{ gap: 8 }}
                  >
                    <MaterialCommunityIcons name="undo-variant" size={18} color="white" />
                    <Text className="text-white font-bold text-base">Create Return / Debit Note</Text>
                  </Pressable>
                </>
              )}
            </View>
          </ScrollView>
        </SafeAreaProvider>
      </Modal>

      {/* Return Modal */}
      <Modal visible={returnPurchase !== null} animationType="slide" onRequestClose={() => setReturnPurchase(null)}>
        <SafeAreaProvider>
        <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView className="flex-1 bg-background dark:bg-bg-dark px-6 pb-10" style={{ paddingTop: topInset }} keyboardShouldPersistTaps="handled">
          <View className="flex-row justify-between items-center mb-6">
            <Text className="text-2xl font-bold text-on-surface dark:text-text-primary-dark">Return / Debit Note</Text>
            <Pressable onPress={() => setReturnPurchase(null)} className="w-11 h-11 items-center justify-center">
              <MaterialCommunityIcons name="close" size={20} color={theme.colors.onSurfaceVariant} />
            </Pressable>
          </View>

          {returnPurchase && (
            <>
              <Text className="text-sm text-on-surface-variant dark:text-text-secondary-dark mb-6">
                Against purchase {returnPurchase.purchase_number} from {returnPurchase.supplier.name}. Enter the quantity being returned for each item.
              </Text>

              {returnPurchase.items.map((item) => (
                <View key={item.product.id} className="flex-row justify-between items-center bg-surface-container-lowest dark:bg-surface-dark p-4 rounded-xl border border-outline-variant dark:border-outline mb-3">
                  <View className="flex-1 mr-3">
                    <Text className="font-bold text-on-surface dark:text-text-primary-dark">{item.product.name}</Text>
                    <Text className="text-sm text-on-surface-variant dark:text-text-secondary-dark">
                      Bought: {parseFloat(item.quantity).toFixed(0)} @ ₹{parseFloat(item.cost).toLocaleString("en-IN")}
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

              <Text className="text-sm font-semibold text-on-surface-variant dark:text-text-secondary-dark uppercase tracking-wider mb-2 mt-2">Reason (optional)</Text>
              <TextInput
                value={returnReason}
                onChangeText={setReturnReason}
                placeholder="e.g. damaged goods, wrong item"
                placeholderTextColor="#A0A0A0"
                className="bg-surface-container-lowest dark:bg-surface-dark text-on-surface dark:text-text-primary-dark border border-outline-variant dark:border-outline rounded-xl px-4 py-4 text-base font-medium mb-8"
              />

              <Pressable
                onPress={handleSubmitReturn}
                disabled={submittingReturn}
                className="bg-error py-4 rounded-xl items-center"
                style={{ marginBottom: bottomInset, opacity: submittingReturn ? 0.5 : 1 }}
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
