import React, { useState, useEffect } from "react";
import {
  Text,
  View,
  ScrollView,
  FlatList,
  Pressable,
  TextInput,
  Modal,
  ActivityIndicator,
  StyleSheet,
  Alert,
  Image,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useLocalSearchParams, useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { api, ApiError } from "../../src/lib/api";
import { useAuth } from "../../src/lib/auth-context";
import { useConfirm } from "../../src/components/ConfirmDialog";
import { useTopInset } from "../../src/lib/useTopInset";
import { useBottomInset } from "../../src/lib/useBottomInset";
import { getAvatarColor, getInitial } from "../../src/lib/avatarColor";
import BulkUploadCard from "../../src/components/BulkUploadCard";

interface Product {
  id: string;
  name: string;
  sku: string;
  barcode: string;
  hsn_code: string;
  tax_rate: string;
  price: string;
  cost: string;
  status: string;
  stock_quantity: string;
  reorder_level: string | null;
  parent_product_id?: string | null;
  variant_label?: string | null;
  unit?: string;
  pack_unit?: string | null;
  pack_size?: string | null;
}

interface Warehouse {
  id: string;
  name: string;
  location?: string | null;
}

export default function InventoryScreen() {
  const { user, activeBrand } = useAuth();
  const router = useRouter();
  const confirm = useConfirm();
  const topInset = useTopInset();
  const bottomInset = useBottomInset();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);

  // Warehouse filter — Product.stock_quantity is a company-wide total, so
  // selecting a specific warehouse (Shop / Godown / any custom one) swaps
  // the displayed quantity per row for that warehouse's actual stock,
  // fetched from the per-warehouse aggregation endpoint below.
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [activeWarehouseId, setActiveWarehouseId] = useState<string | null>(null);
  const [warehouseStock, setWarehouseStock] = useState<Record<string, number>>({});
  const [warehouseStockLoading, setWarehouseStockLoading] = useState(false);
  const [isAddingWarehouse, setIsAddingWarehouse] = useState(false);
  const [newWarehouseName, setNewWarehouseName] = useState("");
  const [newWarehouseLocation, setNewWarehouseLocation] = useState("");
  const [addWarehouseLoading, setAddWarehouseLoading] = useState(false);

  const fetchWarehouses = () => {
    if (!user?.company_id) return;
    api
      .get<{ data: Warehouse[] }>("/warehouses")
      .then((res) => setWarehouses(res.data ?? []))
      .catch(() => {});
  };

  useEffect(fetchWarehouses, [user]);

  const handleAddWarehouse = async () => {
    if (!newWarehouseName.trim()) {
      Alert.alert("Required Field", "Give this location a name (e.g. Godown, Warehouse 2).");
      return;
    }
    setAddWarehouseLoading(true);
    try {
      await api.post("/warehouses", {
        name: newWarehouseName.trim(),
        location: newWarehouseLocation.trim() || undefined,
      });
      setIsAddingWarehouse(false);
      setNewWarehouseName("");
      setNewWarehouseLocation("");
      fetchWarehouses();
    } catch (e) {
      Alert.alert("Error", e instanceof ApiError ? e.message : "Failed to add location.");
    } finally {
      setAddWarehouseLoading(false);
    }
  };

  useEffect(() => {
    if (!activeWarehouseId) {
      setWarehouseStock({});
      return;
    }
    setWarehouseStockLoading(true);
    api
      .get<{ data: { product_id: string; quantity: number }[] }>(`/warehouses/${activeWarehouseId}/stock`)
      .then((res) => {
        const map: Record<string, number> = {};
        for (const row of res.data ?? []) map[row.product_id] = row.quantity;
        setWarehouseStock(map);
      })
      .catch(() => setWarehouseStock({}))
      .finally(() => setWarehouseStockLoading(false));
  }, [activeWarehouseId]);

  // Barcode Scanner Modal State
  const params = useLocalSearchParams<{ openScanner?: string; openProductId?: string; openAddProduct?: string; photoUri?: string }>();
  const [productPhotoUri, setProductPhotoUri] = useState<string | null>(null);
  const [autoOpenedProductId, setAutoOpenedProductId] = useState<string | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [isScanning, setIsScanning] = useState(false);

  // Deep-link support: the dashboard's "Scan" quick action navigates here
  // with a query param so it jumps straight into the scanner instead of
  // landing on the plain product list.
  useEffect(() => {
    if (params.openScanner !== "1") return;
    (async () => {
      const perm = permission?.granted ? permission : await requestPermission();
      if (perm?.granted) setIsScanning(true);
    })();
  }, [params.openScanner]);

  // Deep-link support: the Dashboard's Scan & Record hub can also jump
  // straight into the Add Product form, optionally with a just-captured
  // reference photo (shown as a thumbnail — not used for any auto-fill).
  useEffect(() => {
    if (params.openAddProduct === "1") {
      setIsAdding(true);
      if (params.photoUri) setProductPhotoUri(decodeURIComponent(params.photoUri));
    }
  }, [params.openAddProduct, params.photoUri]);

  // Add Product Modal State
  const [isAdding, setIsAdding] = useState(false);
  const [newProductName, setNewProductName] = useState("");
  const [newProductSku, setNewProductSku] = useState("");
  const [newProductBarcode, setNewProductBarcode] = useState("");
  const [newProductHsn, setNewProductHsn] = useState("");
  const [newProductTax, setNewProductTax] = useState("18.00");
  const [newProductPrice, setNewProductPrice] = useState("");
  const [newProductCost, setNewProductCost] = useState("");
  const [newProductStock, setNewProductStock] = useState("");
  const [newProductReorderLevel, setNewProductReorderLevel] = useState("");
  const [newProductUnit, setNewProductUnit] = useState("pcs");
  const [newProductPackUnit, setNewProductPackUnit] = useState("");
  const [newProductPackSize, setNewProductPackSize] = useState("");
  const [newProductParentId, setNewProductParentId] = useState<string | null>(null);
  const [newProductVariantLabel, setNewProductVariantLabel] = useState("");
  const [parentPickerSearch, setParentPickerSearch] = useState("");
  const [addLoading, setAddLoading] = useState(false);

  // Edit Product Modal State
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editProductName, setEditProductName] = useState("");
  const [editProductPrice, setEditProductPrice] = useState("");
  const [editProductCost, setEditProductCost] = useState("");
  const [editProductTax, setEditProductTax] = useState("");
  const [editLoading, setEditLoading] = useState(false);

  const fetchProducts = async () => {
    if (!user?.company_id) return;
    setLoading(true);
    try {
      const res = await api.get<{ data: Product[] }>("/products", {
        params: {
          brandId: activeBrand?.id,
          search: search.trim() || undefined,
        },
      });
      setProducts(res.data ?? []);
    } catch (error) {
      console.error("Failed to fetch products:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [user, activeBrand, search]);

  // Deep-link support: Recent Activity / Activity Log rows navigate here
  // with the specific product id so tapping a product-related entry opens
  // that product's edit form directly instead of landing on the plain list.
  useEffect(() => {
    if (!params.openProductId || params.openProductId === autoOpenedProductId || products.length === 0) return;
    const match = products.find((p) => p.id === params.openProductId);
    if (match) {
      setAutoOpenedProductId(params.openProductId);
      openEditModal(match);
    }
  }, [params.openProductId, products]);

  const handleScanBarcode = async () => {
    if (!permission) {
      // Camera permissions are still loading.
      return;
    }
    if (!permission.granted) {
      const res = await requestPermission();
      if (!res.granted) {
        Alert.alert("Permission Required", "Camera access is needed to scan barcodes.");
        return;
      }
    }
    setIsScanning(true);
  };

  const handleBarcodeScanned = ({ data }: { data: string }) => {
    setIsScanning(false);
    setSearch(data);
    Alert.alert("Barcode Scanned", `Filtered catalog by barcode: ${data}`);
  };

  const handleAddProduct = async () => {
    if (!newProductName || !newProductPrice) {
      Alert.alert("Required Fields", "Product Name and Selling Price are required.");
      return;
    }
    if (!user?.company_id) return;

    setAddLoading(true);
    try {
      const payload: any = {
        name: newProductName,
        sku: newProductSku || undefined,
        barcode: newProductBarcode || undefined,
        hsn_code: newProductHsn || undefined,
        tax_rate: parseFloat(newProductTax) || 0.0,
        price: parseFloat(newProductPrice) || 0.0,
        cost: parseFloat(newProductCost) || 0.0,
        stock_quantity: parseFloat(newProductStock) || 0,
        reorder_level: newProductReorderLevel ? parseFloat(newProductReorderLevel) : null,
        status: "active",
        unit: newProductUnit.trim() || "pcs",
        pack_unit: newProductPackUnit.trim() || undefined,
        pack_size: newProductPackSize ? parseFloat(newProductPackSize) : undefined,
        parent_product_id: newProductParentId || undefined,
        variant_label: newProductParentId ? newProductVariantLabel.trim() || undefined : undefined,
      };

      if (activeBrand?.id) {
        payload.brand_id = activeBrand.id;
      }

      await api.post("/products", payload);
      Alert.alert("Success", "Product added successfully.");

      // Reset form
      setNewProductName("");
      setNewProductSku("");
      setNewProductBarcode("");
      setNewProductHsn("");
      setNewProductTax("18.00");
      setNewProductPrice("");
      setNewProductCost("");
      setNewProductStock("");
      setNewProductReorderLevel("");
      setNewProductUnit("pcs");
      setNewProductPackUnit("");
      setNewProductPackSize("");
      setNewProductParentId(null);
      setNewProductVariantLabel("");
      setParentPickerSearch("");
      setIsAdding(false);
      setProductPhotoUri(null);

      fetchProducts();
    } catch (error: any) {
      Alert.alert("Error", error instanceof ApiError ? error.message : "Failed to add product.");
    } finally {
      setAddLoading(false);
    }
  };

  const openEditModal = (p: Product) => {
    setEditingProduct(p);
    setEditProductName(p.name);
    setEditProductPrice(p.price);
    setEditProductCost(p.cost || "");
    setEditProductTax(p.tax_rate || "18.00");
  };

  const handleEditProduct = async () => {
    if (!editingProduct || !editProductName || !editProductPrice) {
      Alert.alert("Required Fields", "Name and Selling Price are required.");
      return;
    }
    setEditLoading(true);
    try {
      await api.patch(`/products/${editingProduct.id}`, {
        name: editProductName,
        price: editProductPrice,
        cost: editProductCost || undefined,
        tax_rate: editProductTax || undefined,
      });
      Alert.alert("Success", "Product updated successfully.");
      setEditingProduct(null);
      fetchProducts();
    } catch (e: any) {
      Alert.alert("Error", e instanceof ApiError ? e.message : "Failed to update product.");
    } finally {
      setEditLoading(false);
    }
  };

  const handleQuickStockAdjustment = async (product: Product, delta: number) => {
    try {
      const currentQty = parseFloat(product.stock_quantity || "0");
      const newQty = Math.max(0, currentQty + delta);
      await api.patch(`/products/${product.id}`, { stock_quantity: newQty });
      setProducts(products.map(p => p.id === product.id ? { ...p, stock_quantity: String(newQty) } : p));
    } catch (e: any) {
      Alert.alert("Error", "Failed to update stock");
    }
  };

  const handleDeleteProduct = async (product: Product) => {
    if (!user?.company_id) return;
    const ok = await confirm({
      title: "Delete this product?",
      message: `"${product.name}" will be moved to the Recycle Bin and hidden from the catalog. You can restore it later from More > Recycle Bin.`,
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;

    setDeletingId(product.id);
    try {
      await api.delete(`/products/${product.id}`);
      setProducts((prev) => prev.filter((p) => p.id !== product.id));
    } catch (e: any) {
      Alert.alert("Error", e instanceof ApiError ? e.message : "Failed to delete product.");
    } finally {
      setDeletingId(null);
    }
  };

  // Groups each root product with its variant children immediately
  // following it, so the flat FlatList visually reads as a simple tree
  // without needing expand/collapse state. A variant whose parent got
  // filtered out by search (an edge case) just falls back to showing as
  // its own root-level row instead of vanishing.
  const byName = (a: Product, b: Product) => a.name.localeCompare(b.name);
  const rootProducts = products.filter((p) => !p.parent_product_id).sort(byName);
  const orphanVariants = products
    .filter((p) => p.parent_product_id && !products.some((root) => root.id === p.parent_product_id))
    .sort(byName);
  const groupedProducts: Product[] = [];
  for (const root of [...rootProducts, ...orphanVariants]) {
    groupedProducts.push(root);
    for (const variant of products.filter((p) => p.parent_product_id === root.id).sort(byName)) {
      groupedProducts.push(variant);
    }
  }

  return (
    <View className="flex-1 bg-background dark:bg-bg-dark px-6" style={{ paddingTop: topInset }}>
      {/* Title + Actions */}
      <View className="mb-6 flex-row items-center justify-between">
        <View className="flex-1 mr-3">
          <Text className="text-2xl font-bold text-on-surface dark:text-text-primary-dark">
            Product Catalog
          </Text>
          <Text className="text-sm text-on-surface-variant dark:text-text-secondary-dark font-medium mt-0.5">
            {activeBrand ? `Filtering: ${activeBrand.name}` : "Showing all brands"}
          </Text>
        </View>
        <View className="flex-row items-center" style={{ gap: 8 }}>
          <Pressable
            onPress={() => router.push("/more?openTransfer=1" as any)}
            className="w-11 h-11 rounded-xl bg-surface-container-lowest dark:bg-surface-dark border border-outline-variant dark:border-outline items-center justify-center"
          >
            <MaterialCommunityIcons name="swap-horizontal" size={19} color="#0F7A5F" />
          </Pressable>
          <Pressable
            onPress={handleScanBarcode}
            className="w-11 h-11 rounded-xl bg-secondary dark:bg-secondary-dark items-center justify-center shadow-sm active:opacity-90"
          >
            <MaterialCommunityIcons name="barcode-scan" size={19} color="white" />
          </Pressable>
          <Pressable
            onPress={() => setIsBulkImportOpen(true)}
            className="w-11 h-11 rounded-xl bg-surface-container-lowest dark:bg-surface-dark border border-outline-variant dark:border-outline items-center justify-center"
          >
            <MaterialCommunityIcons name="tray-arrow-up" size={19} color="#0F7A5F" />
          </Pressable>
          <Pressable
            onPress={() => setIsAdding(true)}
            className="w-11 h-11 rounded-xl bg-primary dark:bg-primary-dark items-center justify-center shadow-sm active:opacity-90"
          >
            <MaterialCommunityIcons name="plus" size={22} color="white" />
          </Pressable>
        </View>
      </View>

      {/* Search & Scan Row */}
      <View className="flex-row items-center mb-6">
        <View className="flex-1 mr-2 bg-surface-container-lowest dark:bg-surface-dark border border-outline-variant dark:border-outline rounded-xl px-4 py-3.5 flex-row items-center">
          <TextInput
            placeholder="Search by name, SKU, or barcode..."
            placeholderTextColor="#A0A0A0"
            value={search}
            onChangeText={setSearch}
            className="flex-1 text-base font-medium text-on-surface dark:text-text-primary-dark"
          />
          {search !== "" && (
            <Pressable onPress={() => setSearch("")} className="w-11 h-11 items-center justify-center -mr-2">
              <MaterialCommunityIcons name="close" size={18} color="#3e4944" />
            </Pressable>
          )}
        </View>
      </View>

      {/* Warehouse Selector */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="mb-6"
        contentContainerStyle={{ gap: 8 }}
      >
        {warehouses.length > 0 && (
          <Pressable
            onPress={() => setActiveWarehouseId(null)}
            className={`px-4 py-2.5 rounded-xl border flex-row items-center ${
              activeWarehouseId === null
                ? "bg-primary border-primary dark:bg-primary-dark"
                : "bg-surface-container-lowest dark:bg-surface-dark border-outline-variant dark:border-outline"
            }`}
          >
            <MaterialCommunityIcons
              name="warehouse"
              size={14}
              color={activeWarehouseId === null ? "#fff" : "#6B7280"}
              style={{ marginRight: 5 }}
            />
            <Text className={`text-sm font-bold ${activeWarehouseId === null ? "text-white" : "text-on-surface-variant dark:text-text-secondary-dark"}`}>
              All Warehouses
            </Text>
          </Pressable>
        )}
        {warehouses.map((w) => (
          <Pressable
            key={w.id}
            onPress={() => setActiveWarehouseId(w.id)}
            className={`px-4 py-2.5 rounded-xl border flex-row items-center ${
              activeWarehouseId === w.id
                ? "bg-primary border-primary dark:bg-primary-dark"
                : "bg-surface-container-lowest dark:bg-surface-dark border-outline-variant dark:border-outline"
            }`}
          >
            <MaterialCommunityIcons
              name="warehouse"
              size={14}
              color={activeWarehouseId === w.id ? "#fff" : "#6B7280"}
              style={{ marginRight: 5 }}
            />
            <Text className={`text-sm font-bold ${activeWarehouseId === w.id ? "text-white" : "text-on-surface-variant dark:text-text-secondary-dark"}`}>
              {w.name}
            </Text>
          </Pressable>
        ))}
        <Pressable
          onPress={() => setIsAddingWarehouse(true)}
          className="px-4 py-2.5 rounded-xl border border-dashed border-outline-variant dark:border-outline flex-row items-center"
        >
          <MaterialCommunityIcons name="plus" size={14} color="#0F7A5F" style={{ marginRight: 5 }} />
          <Text className="text-sm font-bold text-primary dark:text-primary-dark">Add Location</Text>
        </Pressable>
      </ScrollView>

      {/* Catalog List */}
      {loading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#0F7A5F" />
        </View>
      ) : products.length === 0 ? (
        <View className="flex-1 justify-center items-center py-20">
          <Text className="text-on-surface-variant dark:text-text-secondary-dark text-base font-semibold text-center">
            No products found
          </Text>
          <Text className="text-on-surface-variant dark:text-text-secondary-dark text-sm text-center mt-1">
            Try adjusting your search query or add a new product.
          </Text>
        </View>
      ) : (
        <FlatList
          data={groupedProducts}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 24 + bottomInset }}
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={7}
          removeClippedSubviews
          renderItem={({ item }) => {
            const totalQty = parseFloat(item.stock_quantity ?? "0");
            const qty = activeWarehouseId ? (warehouseStock[item.id] ?? 0) : totalQty;
            const reorderLevel = item.reorder_level !== null ? parseFloat(item.reorder_level) : null;
            const isLow = !activeWarehouseId && reorderLevel !== null && qty <= reorderLevel;
            const avatarColor = getAvatarColor(item.name);
            const isVariant = !!item.parent_product_id;
            const variantCount = products.filter((p) => p.parent_product_id === item.id).length;
            return (
              <View
                className="bg-surface-container-lowest dark:bg-surface-dark p-4 rounded-2xl border border-outline-variant dark:border-outline shadow-sm mb-4"
                style={isVariant ? { marginLeft: 24, borderLeftWidth: 3, borderLeftColor: "#0F7A5F" } : undefined}
              >
                <View className="flex-row justify-between items-start">
                  <View
                    className="w-10 h-10 rounded-xl items-center justify-center mr-3"
                    style={{ backgroundColor: avatarColor.bg }}
                  >
                    {isVariant ? (
                      <MaterialCommunityIcons name="subdirectory-arrow-right" size={16} color={avatarColor.text} />
                    ) : (
                      <Text className="font-black text-sm" style={{ color: avatarColor.text }}>
                        {getInitial(item.name)}
                      </Text>
                    )}
                  </View>
                  <View className="flex-1 mr-2">
                    <Text className="text-base font-bold text-on-surface dark:text-text-primary-dark">
                      {item.name}
                      {item.variant_label ? ` — ${item.variant_label}` : ""}
                    </Text>
                    <View className="flex-row flex-wrap items-center mt-1">
                      {variantCount > 0 && (
                        <Text className="text-sm font-semibold bg-primary/10 text-primary px-2 py-1 rounded-md mr-1.5 mt-1">
                          {variantCount} variant{variantCount !== 1 ? "s" : ""}
                        </Text>
                      )}
                      {item.pack_unit && item.pack_size && (
                        <Text className="text-sm font-semibold bg-surface-container dark:bg-surface-dark text-on-surface-variant dark:text-text-secondary-dark px-2 py-1 rounded-md mr-1.5 mt-1">
                          1 {item.pack_unit} = {item.pack_size} {item.unit || "pcs"}
                        </Text>
                      )}
                      {item.sku && (
                        <Text className="text-sm font-semibold bg-surface-container dark:bg-surface-dark text-on-surface-variant dark:text-text-secondary-dark px-2 py-1 rounded-md mr-1.5 mt-1">
                          SKU: {item.sku}
                        </Text>
                      )}
                      {item.barcode && (
                        <Text className="text-sm font-semibold bg-surface-container dark:bg-surface-dark text-on-surface-variant dark:text-text-secondary-dark px-2 py-1 rounded-md mr-1.5 mt-1">
                          Barcode: {item.barcode}
                        </Text>
                      )}
                      {item.hsn_code && (
                        <Text className="text-sm font-semibold bg-surface-container dark:bg-surface-dark text-on-surface-variant dark:text-text-secondary-dark px-2 py-1 rounded-md mt-1">
                          HSN: {item.hsn_code}
                        </Text>
                      )}
                    </View>
                  </View>
                  <View className="items-end">
                    <Text className="text-lg font-bold text-primary dark:text-primary-dark">
                      ₹{parseFloat(item.price).toFixed(2)}
                    </Text>
                    <Text className="text-sm text-on-surface-variant dark:text-text-secondary-dark font-medium mt-1">
                      GST: {item.tax_rate}%
                    </Text>
                  </View>
                </View>
                <View className="mt-3 flex-row justify-between items-center border-t border-outline-variant dark:border-outline pt-3">
                  <View
                    className={`px-3 py-1.5 rounded-full flex-row items-center ${
                      isLow ? "bg-error/10" : "bg-surface-container dark:bg-surface-dark"
                    }`}
                    style={{ gap: 4 }}
                  >
                    {isLow && (
                      <MaterialCommunityIcons name="alert-circle" size={14} color="#D64545" />
                    )}
                    <Text
                      className={`text-sm font-bold ${
                        isLow ? "text-error" : "text-on-surface-variant dark:text-text-secondary-dark"
                      }`}
                    >
                      {isLow ? "Low Stock: " : activeWarehouseId ? "At this warehouse: " : "Stock: "}
                      {warehouseStockLoading && activeWarehouseId ? "…" : `${qty} units`}
                      {activeWarehouseId ? ` (${totalQty} total)` : ""}
                    </Text>
                  </View>

                  <View className="flex-row items-center">
                    {!activeWarehouseId && (
                      <>
                        <Pressable onPress={() => handleQuickStockAdjustment(item, -1)} className="w-8 h-8 rounded-full bg-surface-container dark:bg-surface-dark items-center justify-center mr-2">
                          <MaterialCommunityIcons name="minus" size={16} color="#6e7a74" />
                        </Pressable>
                        <Pressable onPress={() => handleQuickStockAdjustment(item, 1)} className="w-8 h-8 rounded-full bg-surface-container dark:bg-surface-dark items-center justify-center">
                          <MaterialCommunityIcons name="plus" size={16} color="#6e7a74" />
                        </Pressable>
                      </>
                    )}
                    <Pressable onPress={() => openEditModal(item)} className="px-3 py-1.5 ml-4 bg-primary/10 rounded-lg">
                      <Text className="text-primary font-bold text-xs uppercase tracking-wider">Edit</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => handleDeleteProduct(item)}
                      disabled={deletingId === item.id}
                      className="w-8 h-8 rounded-full bg-error/10 items-center justify-center ml-2"
                    >
                      {deletingId === item.id ? (
                        <ActivityIndicator size="small" color="#D64545" />
                      ) : (
                        <MaterialCommunityIcons name="trash-can-outline" size={16} color="#D64545" />
                      )}
                    </Pressable>
                  </View>
                </View>
              </View>
            );
          }}
        />
      )}

      {/* Bulk Import Modal */}
      <Modal visible={isBulkImportOpen} animationType="slide">
        <View className="flex-1 bg-background dark:bg-bg-dark px-6" style={{ paddingTop: topInset }}>
          <View className="flex-row justify-between items-center mb-6">
            <Text className="text-2xl font-bold text-on-surface dark:text-text-primary-dark">
              Bulk Import Products
            </Text>
            <Pressable onPress={() => setIsBulkImportOpen(false)} className="w-11 h-11 items-center justify-center">
              <MaterialCommunityIcons name="close" size={20} color="#6B7280" />
            </Pressable>
          </View>
          <BulkUploadCard
            entityLabel="Products"
            columns={[
              { header: "name", example: "Aashirvaad Atta 5kg", required: true },
              { header: "sku", example: "AAT-5KG", required: false },
              { header: "barcode", example: "8901058851716", required: false },
              { header: "hsn_code", example: "1101", required: false },
              { header: "price", example: "285.00", required: true },
              { header: "cost", example: "260.00", required: false },
              { header: "tax_rate", example: "5", required: false },
              { header: "stock_quantity", example: "50", required: false },
              { header: "reorder_level", example: "10", required: false },
            ]}
            mapRowToPayload={(row) => {
              if (!row.name?.trim() || !row.price?.trim()) return null;
              return {
                name: row.name.trim(),
                sku: row.sku?.trim() || undefined,
                barcode: row.barcode?.trim() || undefined,
                hsn_code: row.hsn_code?.trim() || undefined,
                price: parseFloat(row.price),
                cost: row.cost ? parseFloat(row.cost) : undefined,
                tax_rate: row.tax_rate ? parseFloat(row.tax_rate) : undefined,
                stock_quantity: row.stock_quantity ? parseFloat(row.stock_quantity) : undefined,
                reorder_level: row.reorder_level ? parseFloat(row.reorder_level) : undefined,
                status: "active",
              };
            }}
            createOne={async (payload) => {
              await api.post("/products", payload);
            }}
            onComplete={fetchProducts}
          />
        </View>
      </Modal>

      {/* Barcode Scanner Modal */}
      <Modal visible={isScanning} animationType="slide">
        <View style={styles.scannerContainer}>
          <CameraView
            onBarcodeScanned={handleBarcodeScanned}
            barcodeScannerSettings={{
              barcodeTypes: ["qr", "ean13", "ean8", "upc_a", "upc_e", "code128", "code39"],
            }}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.scannerOverlay}>
            <Text className="text-white text-lg font-bold mb-4 text-center">
              Position Barcode Inside Guide
            </Text>
            <View style={styles.scannerBox} />
            <Pressable
              onPress={() => setIsScanning(false)}
              className="bg-red-500 px-8 py-4 rounded-full mt-10"
            >
              <Text className="text-white font-bold text-base">Cancel Scan</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Add Product Modal Form */}
      <Modal visible={isAdding} animationType="slide">
        <ScrollView className="flex-1 bg-background dark:bg-bg-dark px-6 pb-10" style={{ paddingTop: topInset }}>
          <Text className="text-2xl font-bold text-on-surface dark:text-text-primary-dark mb-6">
            Add New Product
          </Text>

          {productPhotoUri && (
            <View className="mb-6">
              <Text className="text-sm font-semibold text-on-surface-variant dark:text-text-secondary-dark uppercase tracking-wider mb-2">
                Photographed Product
              </Text>
              <Image
                source={{ uri: productPhotoUri }}
                style={{ width: "100%", height: 180, borderRadius: 16 }}
                resizeMode="contain"
              />
            </View>
          )}

          {/* Form fields */}
          <View className="space-y-4">
            <View>
              <Text className="text-sm font-semibold text-on-surface-variant dark:text-text-secondary-dark uppercase tracking-wider mb-2">
                Product Name *
              </Text>
              <TextInput
                value={newProductName}
                onChangeText={setNewProductName}
                placeholder="Enter product name"
                placeholderTextColor="#A0A0A0"
                className="bg-surface-container-lowest dark:bg-surface-dark text-on-surface dark:text-text-primary-dark border border-outline-variant dark:border-outline rounded-xl px-4 py-4 text-base font-medium"
              />
            </View>

            <View className="mt-4">
              <Text className="text-sm font-semibold text-on-surface-variant dark:text-text-secondary-dark uppercase tracking-wider mb-2">
                SKU
              </Text>
              <TextInput
                value={newProductSku}
                onChangeText={setNewProductSku}
                placeholder="Enter SKU reference"
                placeholderTextColor="#A0A0A0"
                className="bg-surface-container-lowest dark:bg-surface-dark text-on-surface dark:text-text-primary-dark border border-outline-variant dark:border-outline rounded-xl px-4 py-4 text-base font-medium"
              />
            </View>

            <View className="mt-4">
              <Text className="text-sm font-semibold text-on-surface-variant dark:text-text-secondary-dark uppercase tracking-wider mb-2">
                Barcode
              </Text>
              <TextInput
                value={newProductBarcode}
                onChangeText={setNewProductBarcode}
                placeholder="Enter barcode string"
                placeholderTextColor="#A0A0A0"
                className="bg-surface-container-lowest dark:bg-surface-dark text-on-surface dark:text-text-primary-dark border border-outline-variant dark:border-outline rounded-xl px-4 py-4 text-base font-medium"
              />
            </View>

            <View className="mt-4">
              <Text className="text-sm font-semibold text-on-surface-variant dark:text-text-secondary-dark uppercase tracking-wider mb-2">
                HSN Code
              </Text>
              <TextInput
                value={newProductHsn}
                onChangeText={setNewProductHsn}
                placeholder="Enter GST HSN Code"
                placeholderTextColor="#A0A0A0"
                className="bg-surface-container-lowest dark:bg-surface-dark text-on-surface dark:text-text-primary-dark border border-outline-variant dark:border-outline rounded-xl px-4 py-4 text-base font-medium"
              />
            </View>

            <View className="mt-4">
              <Text className="text-sm font-semibold text-on-surface-variant dark:text-text-secondary-dark uppercase tracking-wider mb-2">
                GST Rate (%)
              </Text>
              <TextInput
                value={newProductTax}
                onChangeText={setNewProductTax}
                keyboardType="numeric"
                className="bg-surface-container-lowest dark:bg-surface-dark text-on-surface dark:text-text-primary-dark border border-outline-variant dark:border-outline rounded-xl px-4 py-4 text-base font-medium"
              />
            </View>

            <View className="mt-4">
              <Text className="text-sm font-semibold text-on-surface-variant dark:text-text-secondary-dark uppercase tracking-wider mb-2">
                Selling Price (INR) *
              </Text>
              <TextInput
                value={newProductPrice}
                onChangeText={setNewProductPrice}
                placeholder="0.00"
                placeholderTextColor="#A0A0A0"
                keyboardType="numeric"
                className="bg-surface-container-lowest dark:bg-surface-dark text-on-surface dark:text-text-primary-dark border border-outline-variant dark:border-outline rounded-xl px-4 py-4 text-lg font-bold"
              />
            </View>

            <View className="mt-4">
              <Text className="text-sm font-semibold text-on-surface-variant dark:text-text-secondary-dark uppercase tracking-wider mb-2">
                Cost Price (INR)
              </Text>
              <TextInput
                value={newProductCost}
                onChangeText={setNewProductCost}
                placeholder="0.00"
                placeholderTextColor="#A0A0A0"
                keyboardType="numeric"
                className="bg-surface-container-lowest dark:bg-surface-dark text-on-surface dark:text-text-primary-dark border border-outline-variant dark:border-outline rounded-xl px-4 py-4 text-base font-medium"
              />
            </View>

            <View className="mt-4">
              <Text className="text-sm font-semibold text-on-surface-variant dark:text-text-secondary-dark uppercase tracking-wider mb-2">
                Opening Stock Quantity
              </Text>
              <TextInput
                value={newProductStock}
                onChangeText={setNewProductStock}
                placeholder="0"
                placeholderTextColor="#A0A0A0"
                keyboardType="numeric"
                className="bg-surface-container-lowest dark:bg-surface-dark text-on-surface dark:text-text-primary-dark border border-outline-variant dark:border-outline rounded-xl px-4 py-4 text-base font-medium"
              />
            </View>

            <View className="mt-4">
              <Text className="text-sm font-semibold text-on-surface-variant dark:text-text-secondary-dark uppercase tracking-wider mb-2">
                Low-Stock Alert Level
              </Text>
              <TextInput
                value={newProductReorderLevel}
                onChangeText={setNewProductReorderLevel}
                placeholder="e.g. 10 (leave blank to disable alert)"
                placeholderTextColor="#A0A0A0"
                keyboardType="numeric"
                className="bg-surface-container-lowest dark:bg-surface-dark text-on-surface dark:text-text-primary-dark border border-outline-variant dark:border-outline rounded-xl px-4 py-4 text-base font-medium"
              />
            </View>

            <View className="mt-6 pt-4 border-t border-outline-variant dark:border-outline">
              <Text className="text-base font-bold text-on-surface dark:text-text-primary-dark mb-1">
                Packaging (optional)
              </Text>
              <Text className="text-sm text-on-surface-variant dark:text-text-secondary-dark mb-3">
                Stock is always tracked in the base unit. Set a pack unit so purchases can be entered by the box/carton and converted automatically.
              </Text>
              <View className="flex-row" style={{ gap: 8 }}>
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-on-surface-variant dark:text-text-secondary-dark uppercase tracking-wider mb-2">
                    Base Unit
                  </Text>
                  <TextInput
                    value={newProductUnit}
                    onChangeText={setNewProductUnit}
                    placeholder="pcs"
                    placeholderTextColor="#A0A0A0"
                    className="bg-surface-container-lowest dark:bg-surface-dark text-on-surface dark:text-text-primary-dark border border-outline-variant dark:border-outline rounded-xl px-4 py-4 text-base font-medium"
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-on-surface-variant dark:text-text-secondary-dark uppercase tracking-wider mb-2">
                    Pack Unit
                  </Text>
                  <TextInput
                    value={newProductPackUnit}
                    onChangeText={setNewProductPackUnit}
                    placeholder="e.g. Box"
                    placeholderTextColor="#A0A0A0"
                    className="bg-surface-container-lowest dark:bg-surface-dark text-on-surface dark:text-text-primary-dark border border-outline-variant dark:border-outline rounded-xl px-4 py-4 text-base font-medium"
                  />
                </View>
              </View>
              {newProductPackUnit.trim() !== "" && (
                <View className="mt-4">
                  <Text className="text-sm font-semibold text-on-surface-variant dark:text-text-secondary-dark uppercase tracking-wider mb-2">
                    {newProductUnit || "pcs"} per {newProductPackUnit}
                  </Text>
                  <TextInput
                    value={newProductPackSize}
                    onChangeText={setNewProductPackSize}
                    placeholder="e.g. 24"
                    placeholderTextColor="#A0A0A0"
                    keyboardType="numeric"
                    className="bg-surface-container-lowest dark:bg-surface-dark text-on-surface dark:text-text-primary-dark border border-outline-variant dark:border-outline rounded-xl px-4 py-4 text-base font-medium"
                  />
                </View>
              )}
            </View>

            <View className="mt-6 pt-4 border-t border-outline-variant dark:border-outline">
              <Text className="text-base font-bold text-on-surface dark:text-text-primary-dark mb-1">
                Variant Of (optional)
              </Text>
              <Text className="text-sm text-on-surface-variant dark:text-text-secondary-dark mb-3">
                Link this as a size/flavor/color variant of an existing product — it stays fully independent (own price, stock, barcode) but groups together in the list.
              </Text>
              <View className="bg-surface-container-lowest dark:bg-surface-dark border border-outline-variant dark:border-outline rounded-xl px-2 py-1">
                <TextInput
                  placeholder="Search products to link as parent..."
                  placeholderTextColor="#A0A0A0"
                  value={parentPickerSearch}
                  onChangeText={setParentPickerSearch}
                  className="text-sm font-medium px-2 py-3 text-on-surface dark:text-text-primary-dark"
                />
                <ScrollView horizontal className="flex-row px-2 pb-2">
                  {products
                    .filter((p) => !p.parent_product_id && p.name.toLowerCase().includes(parentPickerSearch.toLowerCase()))
                    .slice(0, 20)
                    .map((p) => (
                      <Pressable
                        key={p.id}
                        onPress={() => setNewProductParentId(newProductParentId === p.id ? null : p.id)}
                        className={`mr-2 px-4 py-3 rounded-lg border ${
                          newProductParentId === p.id
                            ? "bg-primary border-primary dark:bg-primary-dark"
                            : "bg-background dark:bg-bg-dark border-outline-variant dark:border-outline"
                        }`}
                      >
                        <Text className={`text-sm font-semibold ${newProductParentId === p.id ? "text-white" : "text-on-surface-variant dark:text-text-secondary-dark"}`}>
                          {p.name}
                        </Text>
                      </Pressable>
                    ))}
                </ScrollView>
              </View>
              {newProductParentId && (
                <View className="mt-4">
                  <Text className="text-sm font-semibold text-on-surface-variant dark:text-text-secondary-dark uppercase tracking-wider mb-2">
                    Variant Label
                  </Text>
                  <TextInput
                    value={newProductVariantLabel}
                    onChangeText={setNewProductVariantLabel}
                    placeholder="e.g. 500ml, Red - XL, Mango Flavor"
                    placeholderTextColor="#A0A0A0"
                    className="bg-surface-container-lowest dark:bg-surface-dark text-on-surface dark:text-text-primary-dark border border-outline-variant dark:border-outline rounded-xl px-4 py-4 text-base font-medium"
                  />
                </View>
              )}
            </View>
          </View>

          {/* Form Actions */}
          <View className="flex-row justify-between mt-8" style={{ marginBottom: bottomInset }}>
            <Pressable
              onPress={() => {
                setIsAdding(false);
                setProductPhotoUri(null);
              }}
              className="border border-outline-variant dark:border-outline py-4 px-6 rounded-xl w-[48%] items-center"
            >
              <Text className="text-on-surface-variant dark:text-text-secondary-dark font-bold text-base">Cancel</Text>
            </Pressable>
            <Pressable
              onPress={handleAddProduct}
              disabled={addLoading}
              className="bg-primary dark:bg-primary-dark py-4 px-6 rounded-xl w-[48%] items-center"
            >
              {addLoading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white font-bold text-base">Add Product</Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </Modal>

      {/* Edit Product Modal */}
      <Modal visible={!!editingProduct} animationType="slide">
        <ScrollView className="flex-1 bg-background dark:bg-bg-dark px-6 pb-10" style={{ paddingTop: topInset }}>
          <Text className="text-2xl font-bold text-on-surface dark:text-text-primary-dark mb-6">
            Edit Product
          </Text>
          <View className="space-y-4">
            <View>
              <Text className="text-sm font-semibold text-on-surface-variant dark:text-text-secondary-dark uppercase tracking-wider mb-2">Name *</Text>
              <TextInput
                value={editProductName}
                onChangeText={setEditProductName}
                className="bg-surface-container-lowest dark:bg-surface-dark text-on-surface dark:text-text-primary-dark border border-outline-variant dark:border-outline rounded-xl px-4 py-4 text-base font-medium"
              />
            </View>
            <View className="mt-4">
              <Text className="text-sm font-semibold text-on-surface-variant dark:text-text-secondary-dark uppercase tracking-wider mb-2">Selling Price (₹) *</Text>
              <TextInput
                value={editProductPrice}
                onChangeText={setEditProductPrice}
                keyboardType="numeric"
                className="bg-surface-container-lowest dark:bg-surface-dark text-on-surface dark:text-text-primary-dark border border-outline-variant dark:border-outline rounded-xl px-4 py-4 text-base font-medium"
              />
            </View>
            <View className="mt-4 flex-row justify-between">
              <View className="w-[48%]">
                <Text className="text-sm font-semibold text-on-surface-variant dark:text-text-secondary-dark uppercase tracking-wider mb-2">Cost Price (₹)</Text>
                <TextInput
                  value={editProductCost}
                  onChangeText={setEditProductCost}
                  keyboardType="numeric"
                  className="bg-surface-container-lowest dark:bg-surface-dark text-on-surface dark:text-text-primary-dark border border-outline-variant dark:border-outline rounded-xl px-4 py-4 text-base font-medium"
                />
              </View>
              <View className="w-[48%]">
                <Text className="text-sm font-semibold text-on-surface-variant dark:text-text-secondary-dark uppercase tracking-wider mb-2">GST Rate (%)</Text>
                <TextInput
                  value={editProductTax}
                  onChangeText={setEditProductTax}
                  keyboardType="numeric"
                  className="bg-surface-container-lowest dark:bg-surface-dark text-on-surface dark:text-text-primary-dark border border-outline-variant dark:border-outline rounded-xl px-4 py-4 text-base font-medium"
                />
              </View>
            </View>
          </View>
          
          <View className="flex-row justify-between mt-8" style={{ marginBottom: bottomInset }}>
            <Pressable
              onPress={() => setEditingProduct(null)}
              className="border border-outline-variant dark:border-outline py-4 px-6 rounded-xl w-[48%] items-center"
            >
              <Text className="text-on-surface-variant dark:text-text-secondary-dark font-bold text-base">Cancel</Text>
            </Pressable>
            <Pressable
              onPress={handleEditProduct}
              disabled={editLoading}
              className="bg-primary dark:bg-primary-dark py-4 px-6 rounded-xl w-[48%] items-center"
            >
              {editLoading ? <ActivityIndicator color="white" /> : <Text className="text-white font-bold text-base">Save Changes</Text>}
            </Pressable>
          </View>
        </ScrollView>
      </Modal>

      {/* Add Warehouse/Location Modal */}
      <Modal visible={isAddingWarehouse} animationType="slide" transparent>
        <View className="flex-1 justify-end bg-black/40">
          <View className="bg-background dark:bg-bg-dark rounded-t-3xl px-6 pt-6" style={{ paddingBottom: bottomInset + 24 }}>
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-xl font-bold text-on-surface dark:text-text-primary-dark">Add Location</Text>
              <Pressable onPress={() => setIsAddingWarehouse(false)} className="w-10 h-10 items-center justify-center">
                <MaterialCommunityIcons name="close" size={20} color="#6B7280" />
              </Pressable>
            </View>
            <Text className="text-sm font-semibold text-on-surface-variant dark:text-text-secondary-dark uppercase tracking-wider mb-2">
              Name *
            </Text>
            <TextInput
              value={newWarehouseName}
              onChangeText={setNewWarehouseName}
              placeholder="e.g. Godown, Warehouse 2, Shop Floor"
              placeholderTextColor="#A0A0A0"
              className="bg-surface-container-lowest dark:bg-surface-dark text-on-surface dark:text-text-primary-dark border border-outline-variant dark:border-outline rounded-xl px-4 py-4 text-base font-medium mb-4"
            />
            <Text className="text-sm font-semibold text-on-surface-variant dark:text-text-secondary-dark uppercase tracking-wider mb-2">
              Location (optional)
            </Text>
            <TextInput
              value={newWarehouseLocation}
              onChangeText={setNewWarehouseLocation}
              placeholder="e.g. Behind the shop, Sector 5"
              placeholderTextColor="#A0A0A0"
              className="bg-surface-container-lowest dark:bg-surface-dark text-on-surface dark:text-text-primary-dark border border-outline-variant dark:border-outline rounded-xl px-4 py-4 text-base font-medium mb-6"
            />
            <Pressable
              onPress={handleAddWarehouse}
              disabled={addWarehouseLoading}
              className="bg-primary dark:bg-primary-dark py-4 rounded-xl items-center"
            >
              {addWarehouseLoading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white font-bold text-base">Add Location</Text>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  scannerContainer: {
    flex: 1,
    flexDirection: "column",
    justifyContent: "flex-end",
  },
  scannerOverlay: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  scannerBox: {
    width: 250,
    height: 180,
    borderWidth: 2,
    borderColor: "#22B58A",
    backgroundColor: "transparent",
    borderRadius: 16,
  },
});
