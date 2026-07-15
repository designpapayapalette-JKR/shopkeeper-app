import React, { useState, useEffect } from "react";
import {
  Text,
  View,
  ScrollView,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { api, ApiError } from "../src/lib/api";
import { useTopInset } from "../src/lib/useTopInset";
import { useBottomInset } from "../src/lib/useBottomInset";

interface Party {
  id: string;
  name: string;
  type: string;
}

interface Product {
  id: string;
  name: string;
  sku: string;
  tax_rate?: string;
}

interface Warehouse {
  id: string;
  name: string;
}

interface CartLine {
  product: Product;
  quantity: string;
  cost: string;
}

export default function PurchaseEntryScreen() {
  const topInset = useTopInset();
  const bottomInset = useBottomInset();

  const [suppliers, setSuppliers] = useState<Party[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [warehouseId, setWarehouseId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [result, setResult] = useState<any | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [par, pr, wh] = await Promise.all([
          api.get<{ data: Party[] }>("/parties", { params: { type: "supplier" } }),
          api.get<{ data: Product[] }>("/products"),
          api.get<{ data: Warehouse[] }>("/warehouses"),
        ]);
        setSuppliers(par.data.filter((p) => p.type === "supplier"));
        setProducts(pr.data);
        setWarehouses(wh.data);
        if (wh.data.length > 0) setWarehouseId(wh.data[0].id);
      } catch {
        Alert.alert("Error", "Could not load suppliers/products.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filteredProducts = products.filter(
    (p) => !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.sku?.toLowerCase().includes(search.toLowerCase())
  );

  const addToCart = (product: Product) => {
    setCart((prev) => {
      if (prev.some((c) => c.product.id === product.id)) return prev;
      return [...prev, { product, quantity: "1", cost: "" }];
    });
  };

  const updateLine = (productId: string, field: "quantity" | "cost", value: string) => {
    setCart((prev) => prev.map((c) => (c.product.id === productId ? { ...c, [field]: value } : c)));
  };

  const removeLine = (productId: string) => {
    setCart((prev) => prev.filter((c) => c.product.id !== productId));
  };

  const subtotal = cart.reduce((s, c) => s + (parseFloat(c.cost) || 0) * (parseFloat(c.quantity) || 0), 0);

  const handleSubmit = async () => {
    if (!supplierId || !warehouseId || cart.length === 0) {
      Alert.alert("Required Fields", "Select a supplier, warehouse, and at least one product.");
      return;
    }
    if (cart.some((c) => !c.cost || parseFloat(c.cost) <= 0)) {
      Alert.alert("Missing Cost", "Enter a cost price for every item.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.post<{ data: any }>("/purchases", {
        supplierId,
        warehouseId,
        items: cart.map((c) => ({
          productId: c.product.id,
          quantity: parseFloat(c.quantity) || 0,
          cost: parseFloat(c.cost) || 0,
          taxRate: c.product.tax_rate ? parseFloat(c.product.tax_rate) : 0,
        })),
      });
      setResult(res.data);
      setCart([]);
      setSupplierId(null);
    } catch (e) {
      Alert.alert("Error", e instanceof ApiError ? e.message : "Failed to record purchase.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background dark:bg-bg-dark">
        <ActivityIndicator color="#0F7A5F" />
      </View>
    );
  }

  if (result) {
    return (
      <View className="flex-1 items-center justify-center bg-background dark:bg-bg-dark px-8" style={{ paddingTop: topInset }}>
        <MaterialCommunityIcons name="check-circle" size={48} color="#2E9E5B" />
        <Text className="text-xl font-black text-text-primary dark:text-text-primary-dark mt-3">Purchase Recorded</Text>
        <Text className="text-base text-text-secondary mt-1">#{result.purchaseNumber}</Text>
        <Text className="text-sm text-text-secondary mt-1">₹{Number(result.grandTotal).toLocaleString("en-IN")} — stock updated</Text>
        <View className="flex-row mt-6" style={{ gap: 10 }}>
          <Pressable onPress={() => setResult(null)} className="bg-primary px-5 py-3 rounded-xl">
            <Text className="text-white font-bold">New Purchase</Text>
          </Pressable>
          <Pressable onPress={() => router.back()} className="border border-primary px-5 py-3 rounded-xl">
            <Text className="text-primary font-bold">Done</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView className="flex-1 bg-background dark:bg-bg-dark px-6" style={{ paddingTop: topInset }} keyboardShouldPersistTaps="handled">
        <Text className="text-2xl font-black text-text-primary dark:text-text-primary-dark mb-1">Record Purchase</Text>
        <Text className="text-sm text-text-secondary mb-4">Log stock received from a supplier.</Text>

        <Text className="text-sm font-semibold text-on-surface-variant dark:text-text-secondary-dark uppercase tracking-wider mb-2">Supplier</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row mb-4">
          {suppliers.map((s) => (
            <Pressable
              key={s.id}
              onPress={() => setSupplierId(s.id)}
              className={`mr-2 px-4 py-3 rounded-lg border ${supplierId === s.id ? "bg-primary border-primary" : "bg-surface border-gray-200 dark:border-zinc-800"}`}
            >
              <Text className={`text-sm font-semibold ${supplierId === s.id ? "text-white" : "text-text-secondary"}`}>{s.name}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {warehouses.length > 1 && (
          <>
            <Text className="text-sm font-semibold text-on-surface-variant dark:text-text-secondary-dark uppercase tracking-wider mb-2">Warehouse</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row mb-4">
              {warehouses.map((w) => (
                <Pressable
                  key={w.id}
                  onPress={() => setWarehouseId(w.id)}
                  className={`mr-2 px-4 py-3 rounded-lg border ${warehouseId === w.id ? "bg-primary border-primary" : "bg-surface border-gray-200 dark:border-zinc-800"}`}
                >
                  <Text className={`text-sm font-semibold ${warehouseId === w.id ? "text-white" : "text-text-secondary"}`}>{w.name}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </>
        )}

        <Text className="text-sm font-semibold text-on-surface-variant dark:text-text-secondary-dark uppercase tracking-wider mb-2">Add Products</Text>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search products..."
          placeholderTextColor="#A0A0A0"
          className="bg-surface dark:bg-surface-dark border border-gray-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-base font-medium text-text-primary mb-2"
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row mb-4">
          {filteredProducts.slice(0, 30).map((p) => (
            <Pressable
              key={p.id}
              onPress={() => addToCart(p)}
              className="mr-2 px-4 py-3 rounded-lg border border-dashed border-primary"
            >
              <Text className="text-sm font-bold text-primary">+ {p.name}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {cart.map((c) => (
          <View key={c.product.id} className="bg-surface dark:bg-surface-dark p-4 rounded-xl border border-gray-100 dark:border-zinc-800 mb-3">
            <View className="flex-row justify-between items-center mb-2">
              <Text className="font-bold text-on-surface dark:text-text-primary-dark flex-1 mr-2">{c.product.name}</Text>
              <Pressable onPress={() => removeLine(c.product.id)}>
                <MaterialCommunityIcons name="trash-can-outline" size={18} color="#D64545" />
              </Pressable>
            </View>
            <View className="flex-row" style={{ gap: 8 }}>
              <View className="flex-1">
                <Text className="text-xs text-text-secondary mb-1">Quantity</Text>
                <TextInput
                  value={c.quantity}
                  onChangeText={(v) => updateLine(c.product.id, "quantity", v)}
                  keyboardType="numeric"
                  className="bg-background dark:bg-bg-dark border border-gray-200 dark:border-zinc-800 rounded-xl px-3 py-2.5 text-base font-bold text-center"
                />
              </View>
              <View className="flex-1">
                <Text className="text-xs text-text-secondary mb-1">Cost / Unit (₹)</Text>
                <TextInput
                  value={c.cost}
                  onChangeText={(v) => updateLine(c.product.id, "cost", v)}
                  keyboardType="numeric"
                  placeholder="0.00"
                  className="bg-background dark:bg-bg-dark border border-gray-200 dark:border-zinc-800 rounded-xl px-3 py-2.5 text-base font-bold text-center"
                />
              </View>
            </View>
          </View>
        ))}

        {cart.length > 0 && (
          <View className="flex-row justify-between items-center py-3 border-t border-gray-100 dark:border-zinc-800 mb-4">
            <Text className="text-base font-bold text-text-primary dark:text-text-primary-dark">Subtotal</Text>
            <Text className="text-lg font-black text-text-primary dark:text-text-primary-dark">₹{subtotal.toLocaleString("en-IN")}</Text>
          </View>
        )}

        <Pressable
          onPress={handleSubmit}
          disabled={submitting || !supplierId || !warehouseId || cart.length === 0}
          className="bg-primary py-4 rounded-xl items-center"
          style={{ marginBottom: bottomInset + 16, opacity: submitting || !supplierId || !warehouseId || cart.length === 0 ? 0.5 : 1 }}
        >
          {submitting ? <ActivityIndicator color="white" /> : <Text className="text-white font-bold text-base">Record Purchase</Text>}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
