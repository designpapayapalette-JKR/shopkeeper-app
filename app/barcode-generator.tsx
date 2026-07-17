import React, { useState, useEffect, useCallback } from "react";
import { Text, View, ScrollView, Pressable, TextInput, Alert, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import Svg, { Rect } from "react-native-svg";
import { useAuth } from "../src/lib/auth-context";
import { api, ApiError } from "../src/lib/api";
import { useTopInset } from "../src/lib/useTopInset";
import { ean13Bars } from "../src/lib/barcodeEncoder";

interface Product {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  price: number;
  brand?: { name: string } | null;
  category?: { name: string } | null;
}

function BarcodeSvg({ code, width = 280, height = 80 }: { code: string; width?: number; height?: number }) {
  const bars = ean13Bars(code);
  const moduleWidth = width / bars.length;
  return (
    <Svg width={width} height={height}>
      {bars.map((bar, i) =>
        bar === 1 ? (
          <Rect key={i} x={i * moduleWidth} y={0} width={moduleWidth} height={height} fill="#000" />
        ) : null
      )}
    </Svg>
  );
}

export default function BarcodeGeneratorScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const topInset = useTopInset();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [generatedIds, setGeneratedIds] = useState<Set<string>>(new Set());
  const [viewBarcodeId, setViewBarcodeId] = useState<string | null>(null);

  const fetchProducts = useCallback(async () => {
    if (!user?.company_id) return;
    setLoading(true);
    try {
      const res = await api.get<{ data: Product[] }>("/products", {
        params: { search: search.trim() || undefined },
      });
      setProducts(res.data ?? []);
    } catch {
      Alert.alert("Error", "Failed to load products");
    } finally {
      setLoading(false);
    }
  }, [user, search]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleGenerate = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) {
      Alert.alert("No Selection", "Select at least one product to generate barcodes for.");
      return;
    }
    setGenerating(true);
    try {
      const res = await api.post<{ data: { generated: number; products: Product[] } }>("/products/barcodes/assign", {
        productIds: ids,
      });
      const generated = res.data?.products ?? [];
      setGeneratedIds((prev) => {
        const next = new Set(prev);
        generated.forEach((p) => next.add(p.id));
        return next;
      });
      setSelectedIds(new Set());
      await fetchProducts();
      Alert.alert("Success", `${generated.length} barcode(s) generated.`);
    } catch (e) {
      Alert.alert("Error", e instanceof ApiError ? e.message : "Failed to generate barcodes.");
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateAll = async () => {
    setGenerating(true);
    try {
      const res = await api.post<{ data: { generated: number; products: Product[] } }>("/products/barcodes/assign", {});
      const generated = res.data?.products ?? [];
      setGeneratedIds((prev) => {
        const next = new Set(prev);
        generated.forEach((p) => next.add(p.id));
        return next;
      });
      setSelectedIds(new Set());
      await fetchProducts();
      Alert.alert("Success", `${generated.length} barcode(s) generated for products that had none.`);
    } catch (e) {
      Alert.alert("Error", e instanceof ApiError ? e.message : "Failed to generate barcodes.");
    } finally {
      setGenerating(false);
    }
  };

  const filtered = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.sku && p.sku.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <View className="flex-1 bg-background dark:bg-bg-dark" style={{ paddingTop: topInset }}>
    <ScrollView className="flex-1">
      <View className="px-6 pb-4 flex-row items-center" style={{ gap: 12 }}>
        <Pressable onPress={() => router.back()} className="w-10 h-10 items-center justify-center -ml-2">
          <MaterialCommunityIcons name="arrow-left" size={22} color="#0368FE" />
        </Pressable>
        <View>
          <Text className="text-2xl font-black text-on-surface dark:text-text-primary-dark">
            Barcode Generator
          </Text>
          <Text className="text-sm text-on-surface-variant dark:text-text-secondary-dark mt-0.5">
            Generate EAN-13 barcode labels for your products
          </Text>
        </View>
      </View>

      <View className="px-6 mb-4 flex-row items-center bg-surface-container-lowest dark:bg-surface-dark mx-6 rounded-2xl border border-outline-variant dark:border-outline h-12">
        <MaterialCommunityIcons name="magnify" size={20} color="#9CA3AF" style={{ marginRight: 8 }} />
        <TextInput
          className="flex-1 text-on-surface dark:text-text-primary-dark text-base"
          placeholder="Search products…"
          placeholderTextColor="#9CA3AF"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <View className="px-6 mb-6 flex-row" style={{ gap: 8 }}>
        <Pressable
          onPress={handleGenerate}
          disabled={selectedIds.size === 0 || generating}
          className={`flex-1 flex-row items-center justify-center py-3.5 rounded-2xl ${
            selectedIds.size === 0 || generating
              ? "bg-surface-container dark:bg-surface-dark opacity-50"
              : "bg-primary"
          }`}
        >
          {generating ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <MaterialCommunityIcons name="barcode-scan" size={18} color={selectedIds.size === 0 ? "#9CA3AF" : "#fff"} />
              <Text className={`ml-2 font-bold text-sm ${selectedIds.size === 0 ? "text-on-surface-variant" : "text-white"}`}>
                Generate ({selectedIds.size})
              </Text>
            </>
          )}
        </Pressable>
        <Pressable
          onPress={handleGenerateAll}
          disabled={generating}
          className="px-4 py-3.5 rounded-2xl bg-surface-container-lowest dark:bg-surface-dark border border-outline-variant dark:border-outline flex-row items-center active:opacity-80"
        >
          <MaterialCommunityIcons name="auto-fix" size={18} color="#0368FE" />
          <Text className="ml-1.5 font-bold text-sm text-primary">All Missing</Text>
        </Pressable>
      </View>

      {loading ? (
        <View className="py-20 items-center">
          <ActivityIndicator size="large" color="#0368FE" />
        </View>
      ) : (
        <View className="px-6 mb-8" style={{ gap: 10 }}>
          {filtered.map((product) => {
            const hasBarcode = !!product.barcode;
            const isSelected = selectedIds.has(product.id);
            const isGenerated = generatedIds.has(product.id);
            return (
              <View
                key={product.id}
                className={`rounded-2xl border overflow-hidden ${
                  isSelected
                    ? "border-primary bg-primary/5"
                    : hasBarcode
                    ? "border-outline-variant dark:border-outline bg-surface-container-lowest dark:bg-surface-dark"
                    : "border-dashed border-outline-variant dark:border-outline bg-surface-container-lowest dark:bg-surface-dark"
                }`}
              >
                <Pressable
                  onPress={() => toggleSelect(product.id)}
                  className="p-4 flex-row items-center"
                >
                  <View
                    className={`w-6 h-6 rounded-md border-2 mr-3 items-center justify-center ${
                      isSelected
                        ? "bg-primary border-primary"
                        : "border-outline-variant dark:border-outline"
                    }`}
                  >
                    {isSelected && (
                      <MaterialCommunityIcons name="check" size={16} color="#fff" />
                    )}
                  </View>
                  <View className="flex-1">
                    <Text className="font-bold text-on-surface dark:text-text-primary-dark text-base">
                      {product.name}
                    </Text>
                    <Text className="text-sm text-on-surface-variant dark:text-text-secondary-dark mt-0.5">
                      {product.sku ?? "No SKU"} · ₹{product.price}
                    </Text>
                  </View>
                  {hasBarcode ? (
                    <View className="bg-green-500/10 px-3 py-1.5 rounded-lg">
                      <Text className="text-green-700 dark:text-green-400 text-xs font-bold">✓ {product.barcode}</Text>
                    </View>
                  ) : (
                    <View className="bg-amber-400/10 px-3 py-1.5 rounded-lg">
                      <Text className="text-amber-600 text-xs font-bold">No Barcode</Text>
                    </View>
                  )}
                </Pressable>

                {hasBarcode && (
                  <>
                    <Pressable
                      onPress={() => setViewBarcodeId(viewBarcodeId === product.id ? null : product.id)}
                      className="px-4 pb-3 flex-row items-center"
                    >
                      <MaterialCommunityIcons
                        name={viewBarcodeId === product.id ? "chevron-up" : "chevron-down"}
                        size={18}
                        color="#0368FE"
                      />
                      <Text className="ml-1 text-primary text-sm font-semibold">
                        {viewBarcodeId === product.id ? "Hide Barcode" : "View Barcode Label"}
                      </Text>
                    </Pressable>
                    {viewBarcodeId === product.id && (
                      <View className="px-4 pb-5 items-center bg-white dark:bg-zinc-900 mx-4 mb-4 rounded-xl py-4" style={{ gap: 2 }}>
                        <BarcodeSvg code={product.barcode!} />
                        <Text className="text-xs text-gray-400 font-mono font-bold tracking-widest">
                          {product.barcode!.replace(/\D/g, "").slice(0, 13)}
                        </Text>
                      </View>
                    )}
                  </>
                )}

                {isGenerated && !hasBarcode && (
                  <Text className="px-4 pb-4 text-xs text-green-600 font-semibold">Barcode generated — pull to refresh</Text>
                )}
              </View>
            );
          })}
          {filtered.length === 0 && (
            <View className="py-16 items-center">
              <MaterialCommunityIcons name="barcode-off" size={48} color="#D1D5DB" />
              <Text className="text-on-surface-variant dark:text-text-secondary-dark text-base mt-3 font-medium">
                {search ? "No products match your search" : "No products found"}
              </Text>
            </View>
          )}
        </View>
      )}
    </ScrollView>
    </View>
  );
}
