import React, { useCallback, useEffect, useState } from "react";
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
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { api, ApiError } from "../src/lib/api";
import { useConfirm } from "../src/components/ConfirmDialog";
import { useTopInset } from "../src/lib/useTopInset";
import { useBottomInset } from "../src/lib/useBottomInset";
import { useTheme } from "react-native-paper";

interface PriceList {
  id: string;
  name: string;
  type: string;
  is_default: boolean;
}

interface PLItem {
  id: string;
  product_id: string;
  unit_price: number;
  min_quantity: number;
  product: { id: string; name: string; sku: string | null; price: string; unit: string };
}

interface Product {
  id: string;
  name: string;
  sku: string | null;
  price: string;
  unit: string;
}

const LIST_TYPES = [
  { id: "sale", label: "Sale" },
  { id: "purchase", label: "Purchase" },
];

export default function PriceListsScreen() {
  const topInset = useTopInset();
  const bottomInset = useBottomInset();
  const confirm = useConfirm();
  const router = useRouter();
  const theme = useTheme();

  const [lists, setLists] = useState<PriceList[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadTrigger, setLoadTrigger] = useState(0);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<PriceList | null>(null);
  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState("sale");
  const [formIsDefault, setFormIsDefault] = useState(false);
  const [saving, setSaving] = useState(false);

  // Items state
  const [activeList, setActiveList] = useState<PriceList | null>(null);
  const [items, setItems] = useState<PLItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);

  // Add item state
  const [showAddItem, setShowAddItem] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [itemPrice, setItemPrice] = useState("");
  const [itemMinQty, setItemMinQty] = useState("1");
  const [itemSubmitting, setItemSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: PriceList[] }>("/price-lists");
      setLists(res.data ?? []);
    } catch (e) {
      console.error("Failed to load price lists:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await load(); } finally { setRefreshing(false); }
  }, [load]);

  useEffect(() => { load(); }, [load, loadTrigger]);

  const loadItems = useCallback(async (listId: string) => {
    setItemsLoading(true);
    try {
      const res = await api.get<{ data: PLItem[] }>(`/price-lists/${listId}/items`);
      setItems(res.data ?? []);
    } catch {
      Alert.alert("Error", "Failed to load items.");
    } finally {
      setItemsLoading(false);
    }
  }, []);

  const loadProducts = useCallback(async () => {
    try {
      const res = await api.get<{ data: Product[] }>("/products");
      setProducts(res.data ?? []);
    } catch { Alert.alert("Error", "Could not load products."); }
  }, []);

  const openItems = (list: PriceList) => {
    setActiveList(list);
    loadItems(list.id);
  };

  const handleSaveList = async () => {
    if (!formName.trim()) { Alert.alert("Required", "Name is required."); return; }
    setSaving(true);
    try {
      const body: any = { name: formName.trim(), type: formType };
      if (formIsDefault) body.isDefault = true;
      if (editing) {
        await api.patch(`/price-lists/${editing.id}`, body);
      } else {
        await api.post("/price-lists", body);
      }
      setShowForm(false);
      setEditing(null);
      setLoadTrigger((n) => n + 1);
    } catch (e) {
      Alert.alert("Error", e instanceof ApiError ? e.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteList = async (list: PriceList) => {
    const ok = await confirm({ title: `Delete "${list.name}"?`, message: "This price list will be permanently removed.", confirmLabel: "Delete", destructive: true });
    if (!ok) return;
    try {
      await api.delete(`/price-lists/${list.id}`);
      setLoadTrigger((n) => n + 1);
    } catch (e) {
      Alert.alert("Error", e instanceof ApiError ? e.message : "Failed to delete.");
    }
  };

  const handleAddItem = async () => {
    if (!selectedProductId || !itemPrice) { Alert.alert("Required", "Select a product and enter a price."); return; }
    setItemSubmitting(true);
    try {
      await api.post(`/price-lists/${activeList!.id}/items`, {
        productId: selectedProductId,
        unitPrice: parseFloat(itemPrice),
        minQuantity: parseInt(itemMinQty) || 1,
      });
      setShowAddItem(false);
      setSelectedProductId("");
      setItemPrice("");
      setItemMinQty("1");
      loadItems(activeList!.id);
    } catch (e) {
      Alert.alert("Error", e instanceof ApiError ? e.message : "Failed to add item.");
    } finally {
      setItemSubmitting(false);
    }
  };

  const handleUpdateItemPrice = async (itemId: string, newPrice: string) => {
    const price = parseFloat(newPrice);
    if (isNaN(price)) return;
    try {
      await api.patch(`/price-lists/${activeList!.id}/items/${itemId}`, { unitPrice: price });
      loadItems(activeList!.id);
    } catch {
      Alert.alert("Error", "Failed to update price.");
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    const ok = await confirm({ title: "Remove item?", message: "", confirmLabel: "Remove", destructive: true });
    if (!ok) return;
    try {
      await api.delete(`/price-lists/${activeList!.id}/items/${itemId}`);
      loadItems(activeList!.id);
    } catch (e) {
      Alert.alert("Error", e instanceof ApiError ? e.message : "Failed to remove item.");
    }
  };

  const filteredProducts = products.filter(
    (p) => !productSearch || p.name.toLowerCase().includes(productSearch.toLowerCase())
  );

  const renderList = ({ item }: { item: PriceList }) => (
    <Pressable onPress={() => openItems(item)}
      className="bg-surface-container-lowest dark:bg-surface-dark p-5 rounded-2xl border border-outline-variant dark:border-outline mb-3 shadow-sm active:opacity-80">
      <View className="flex-row items-start justify-between">
        <View className="flex-1 mr-2">
          <View className="flex-row items-center" style={{ gap: 6 }}>
            <Text className="text-base font-bold text-on-surface dark:text-text-primary-dark">{item.name}</Text>
            {item.is_default && (
              <View className="bg-primary/10 px-2 py-0.5 rounded-full"><Text className="text-xs font-bold text-primary">Default</Text></View>
            )}
          </View>
          <Text className="text-xs text-on-surface-variant dark:text-text-secondary-dark mt-0.5 capitalize">{item.type}</Text>
        </View>
        <View className="flex-row" style={{ gap: 4 }}>
          <Pressable onPress={() => { setEditing(item); setFormName(item.name); setFormType(item.type); setFormIsDefault(item.is_default); setShowForm(true); }}
            className="w-9 h-9 rounded-lg bg-surface-container dark:bg-zinc-800 items-center justify-center active:opacity-70">
            <MaterialCommunityIcons name="pencil" size={16} color={theme.colors.onSurfaceVariant} />
          </Pressable>
          <Pressable onPress={() => handleDeleteList(item)}
            className="w-9 h-9 rounded-lg bg-red-50 items-center justify-center active:opacity-70">
            <MaterialCommunityIcons name="delete-outline" size={16} color="#D64545" />
          </Pressable>
        </View>
      </View>
    </Pressable>
  );

  return (
    <View className="flex-1 bg-background dark:bg-bg-dark" style={{ paddingTop: topInset }}>
      <View className="flex-row items-center justify-between px-6 py-4">
        <View className="flex-row items-center" style={{ gap: 8 }}>
          <Pressable onPress={() => router.back()} className="w-9 h-9 items-center justify-center active:opacity-70">
            <MaterialCommunityIcons name="arrow-left" size={22} color={theme.colors.onSurfaceVariant} />
          </Pressable>
          <Text className="text-xl font-bold text-on-surface dark:text-text-primary-dark">Price Lists</Text>
        </View>
        <Pressable onPress={() => { setEditing(null); setFormName(""); setFormType("sale"); setFormIsDefault(false); setShowForm(true); }}
          className="bg-primary px-4 py-2.5 rounded-xl flex-row items-center active:opacity-80" style={{ gap: 4 }}>
          <MaterialCommunityIcons name="plus" size={16} color="white" />
          <Text className="text-white font-bold text-sm">Add</Text>
        </Pressable>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center"><ActivityIndicator size="large" color={theme.colors.primary} /></View>
      ) : lists.length === 0 ? (
        <View className="flex-1 items-center justify-center pb-20 px-6">
          <MaterialCommunityIcons name="tag-outline" size={48} color={theme.colors.outline} />
          <Text className="text-base font-bold text-on-surface-variant dark:text-text-secondary-dark mt-4">No price lists yet</Text>
          <Text className="text-sm text-on-surface-variant dark:text-text-secondary-dark mt-1 text-center">Create price lists to offer different pricing tiers.</Text>
        </View>
      ) : (
        <FlatList data={lists} keyExtractor={(item) => item.id} renderItem={renderList}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: bottomInset + 24 }} showsVerticalScrollIndicator={false} />
      )}

      {/* Add/Edit List Modal */}
      <Modal visible={showForm} animationType="slide" onRequestClose={() => setShowForm(false)}>
        <SafeAreaProvider>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1">
            <ScrollView className="flex-1 bg-background dark:bg-bg-dark px-6 pb-10" style={{ paddingTop: topInset }}>
              <View className="flex-row justify-between items-center mb-6">
                <Text className="text-2xl font-bold text-on-surface dark:text-text-primary-dark">
                  {editing ? "Edit" : "Add"} Price List
                </Text>
                <Pressable onPress={() => setShowForm(false)} className="w-11 h-11 items-center justify-center">
                  <MaterialCommunityIcons name="close" size={20} color={theme.colors.onSurfaceVariant} />
                </Pressable>
              </View>

              <Text className="text-sm font-semibold text-on-surface-variant dark:text-text-secondary-dark uppercase tracking-wider mb-2">Name *</Text>
              <TextInput value={formName} onChangeText={setFormName} placeholder="e.g. Wholesale 2024" placeholderTextColor="#A0A0A0" autoFocus
                className="bg-surface-container-lowest dark:bg-zinc-900 text-on-surface dark:text-text-primary-dark border border-outline-variant dark:border-outline rounded-xl px-4 py-3.5 font-medium mb-5" />

              <Text className="text-sm font-semibold text-on-surface-variant dark:text-text-secondary-dark uppercase tracking-wider mb-2">Type</Text>
              <View className="flex-row" style={{ gap: 8 }}>
                {LIST_TYPES.map((t) => (
                  <Pressable key={t.id} onPress={() => setFormType(t.id)}
                    className={`px-4 py-3 rounded-xl border ${formType === t.id ? "bg-primary border-primary" : "bg-surface-container-lowest dark:bg-zinc-900 border-outline-variant dark:border-outline"}`}>
                    <Text className={`text-sm font-bold ${formType === t.id ? "text-white" : "text-on-surface-variant dark:text-text-secondary-dark"}`}>{t.label}</Text>
                  </Pressable>
                ))}
              </View>

              <Pressable onPress={() => setFormIsDefault(!formIsDefault)}
                className="flex-row items-center mt-5" style={{ gap: 8 }}>
                <View className={`w-5 h-5 rounded border-2 items-center justify-center ${formIsDefault ? "bg-primary border-primary" : "border-gray-300"}`}>
                  {formIsDefault && <MaterialCommunityIcons name="check" size={14} color="white" />}
                </View>
                <Text className="text-sm font-bold text-on-surface dark:text-text-primary-dark">Set as default</Text>
              </Pressable>

              <View className="flex-row justify-between mt-10" style={{ marginBottom: bottomInset }}>
                <Pressable onPress={() => setShowForm(false)}
                  className="border border-outline-variant dark:border-outline py-4 px-6 rounded-xl w-[48%] items-center">
                  <Text className="text-on-surface-variant dark:text-text-secondary-dark font-bold">Cancel</Text>
                </Pressable>
                <Pressable onPress={handleSaveList} disabled={saving}
                  className="bg-primary py-4 px-6 rounded-xl w-[48%] items-center">
                  {saving ? <ActivityIndicator color="white" /> : <Text className="text-white font-bold">{editing ? "Update" : "Create"}</Text>}
                </Pressable>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaProvider>
      </Modal>

      {/* Items Modal */}
      <Modal visible={!!activeList} animationType="slide" onRequestClose={() => setActiveList(null)}>
        <SafeAreaProvider>
          <View className="flex-1 bg-background dark:bg-bg-dark" style={{ paddingTop: topInset }}>
            <View className="flex-row items-center justify-between px-6 py-4">
              <View className="flex-row items-center" style={{ gap: 8 }}>
                <Pressable onPress={() => setActiveList(null)} className="w-9 h-9 items-center justify-center active:opacity-70">
                  <MaterialCommunityIcons name="arrow-left" size={22} color={theme.colors.onSurfaceVariant} />
                </Pressable>
                <Text className="text-xl font-bold text-on-surface dark:text-text-primary-dark">{activeList?.name}</Text>
              </View>
              <Pressable onPress={() => { loadProducts(); setSelectedProductId(""); setItemPrice(""); setItemMinQty("1"); setProductSearch(""); setShowAddItem(true); }}
                className="bg-primary px-4 py-2.5 rounded-xl flex-row items-center active:opacity-80" style={{ gap: 4 }}>
                <MaterialCommunityIcons name="plus" size={16} color="white" />
                <Text className="text-white font-bold text-sm">Item</Text>
              </Pressable>
            </View>

            {itemsLoading ? (
              <View className="flex-1 items-center justify-center"><ActivityIndicator size="large" color={theme.colors.primary} /></View>
            ) : items.length === 0 ? (
              <View className="flex-1 items-center justify-center px-6">
                <Text className="text-sm font-bold text-on-surface-variant dark:text-text-secondary-dark">No items yet. Add products to this price list.</Text>
              </View>
            ) : (
              <FlatList data={items} keyExtractor={(item) => item.id} showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: bottomInset + 24 }}
                renderItem={({ item }) => (
                  <View className="bg-surface-container-lowest dark:bg-surface-dark p-4 rounded-2xl border border-outline-variant dark:border-outline mb-2">
                    <View className="flex-row items-center">
                      <View className="flex-1 mr-2">
                        <Text className="text-sm font-bold text-on-surface dark:text-text-primary-dark">{item.product.name}</Text>
                        <Text className="text-xs text-on-surface-variant dark:text-text-secondary-dark">{item.product.sku || "No SKU"}</Text>
                      </View>
                      <TextInput
                        value={item.unit_price.toString()}
                        onChangeText={(v) => handleUpdateItemPrice(item.id, v)}
                        keyboardType="decimal-pad"
                        className="bg-background dark:bg-zinc-900 text-on-surface dark:text-text-primary-dark border border-outline-variant dark:border-outline rounded-lg px-3 py-2 text-sm font-bold w-24 text-right mr-2" />
                      <Pressable onPress={() => handleRemoveItem(item.id)}
                        className="w-8 h-8 rounded-lg bg-red-50 items-center justify-center">
                        <MaterialCommunityIcons name="delete-outline" size={14} color="#D64545" />
                      </Pressable>
                    </View>
                    <Text className="text-xs text-on-surface-variant dark:text-text-secondary-dark mt-1">Min qty: {item.min_quantity} · Regular: ₹{Number(item.product.price).toLocaleString("en-IN")}</Text>
                  </View>
                )} />
            )}
          </View>
        </SafeAreaProvider>
      </Modal>

      {/* Add Item Modal */}
      <Modal visible={showAddItem} animationType="slide" onRequestClose={() => setShowAddItem(false)}>
        <SafeAreaProvider>
          <ScrollView className="flex-1 bg-background dark:bg-bg-dark" style={{ paddingTop: topInset }}>
            <View className="px-6 pb-8">
              <View className="flex-row justify-between items-center mb-6">
                <Text className="text-2xl font-bold text-on-surface dark:text-text-primary-dark">Add Item</Text>
                <Pressable onPress={() => setShowAddItem(false)} className="w-11 h-11 items-center justify-center">
                  <MaterialCommunityIcons name="close" size={20} color={theme.colors.onSurfaceVariant} />
                </Pressable>
              </View>

              <Text className="text-sm font-semibold text-on-surface-variant dark:text-text-secondary-dark uppercase tracking-wider mb-2">Product</Text>
              <TextInput value={productSearch} onChangeText={setProductSearch} placeholder="Search products..." placeholderTextColor="#A0A0A0"
                className="bg-surface-container-lowest dark:bg-zinc-900 text-on-surface dark:text-text-primary-dark border border-outline-variant dark:border-outline rounded-xl px-4 py-3.5 font-medium mb-3" />
              <View className="flex-row flex-wrap mb-5" style={{ gap: 6 }}>
                {filteredProducts.slice(0, 20).map((p) => (
                  <Pressable key={p.id} onPress={() => setSelectedProductId(p.id)}
                    className={`px-3.5 py-2.5 rounded-xl border ${selectedProductId === p.id ? "bg-primary border-primary" : "bg-surface-container-lowest dark:bg-zinc-900 border-outline-variant dark:border-outline"}`}>
                    <Text className={`text-sm font-bold ${selectedProductId === p.id ? "text-white" : "text-on-surface-variant dark:text-text-secondary-dark"}`}>{p.name}</Text>
                  </Pressable>
                ))}
              </View>

              <Text className="text-sm font-semibold text-on-surface-variant dark:text-text-secondary-dark uppercase tracking-wider mb-2">Unit Price *</Text>
              <TextInput value={itemPrice} onChangeText={setItemPrice} keyboardType="decimal-pad" placeholder="e.g. 250.00" placeholderTextColor="#A0A0A0"
                className="bg-surface-container-lowest dark:bg-zinc-900 text-on-surface dark:text-text-primary-dark border border-outline-variant dark:border-outline rounded-xl px-4 py-3.5 font-medium mb-4" />

              <Text className="text-sm font-semibold text-on-surface-variant dark:text-text-secondary-dark uppercase tracking-wider mb-2">Min Quantity</Text>
              <TextInput value={itemMinQty} onChangeText={setItemMinQty} keyboardType="numeric"
                className="bg-surface-container-lowest dark:bg-zinc-900 text-on-surface dark:text-text-primary-dark border border-outline-variant dark:border-outline rounded-xl px-4 py-3.5 font-medium mb-6" />

              <Pressable onPress={handleAddItem} disabled={itemSubmitting || !selectedProductId || !itemPrice}
                className="bg-primary py-4 rounded-xl items-center opacity-100 disabled:opacity-50">
                {itemSubmitting ? <ActivityIndicator color="white" /> : <Text className="text-white font-bold text-base">Add to Price List</Text>}
              </Pressable>
            </View>
          </ScrollView>
        </SafeAreaProvider>
      </Modal>
    </View>
  );
}
