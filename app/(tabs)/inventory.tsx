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
  KeyboardAvoidingView,
  Platform,
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
import { GstRatePicker } from "../../src/components/GstRatePicker";
import { useTerminology } from "../../src/lib/terminology-context";

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
  const { t } = useTerminology();
  const router = useRouter();
  const confirm = useConfirm();
  const topInset = useTopInset();
  const bottomInset = useBottomInset();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);

  // Sort + quick filter — client-side, since the full catalog is already
  // fetched. "Low Stock Only" reuses the same isLow calculation each row
  // already does, just as a filter instead of a per-row badge.
  type SortKey = "name-asc" | "name-desc" | "price-asc" | "price-desc" | "stock-asc" | "stock-desc";
  const [sortKey, setSortKey] = useState<SortKey>("name-asc");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);

  // Two independent disclosure states, both collapsed by default, so a
  // product list with many SKUs/variants reads as a clean single line per
  // product instead of every detail being visible at once:
  // - expandedGroups: which root products currently show their variants.
  // - expandedDetails: which cards currently show SKU/Barcode/HSN.
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [expandedDetails, setExpandedDetails] = useState<Set<string>>(new Set());
  const toggleGroup = (id: string) =>
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const toggleDetails = (id: string) =>
    setExpandedDetails((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  // Warehouse filter — Product.stock_quantity is a company-wide total, so
  // selecting a specific warehouse (Shop / Godown / any custom one) swaps
  // the displayed quantity per row for that warehouse's actual stock,
  // fetched from the per-warehouse aggregation endpoint below.
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [activeWarehouseId, setActiveWarehouseId] = useState<string | null>(null);
  const [warehouseStock, setWarehouseStock] = useState<Record<string, number>>({});
  const [warehouseStockLoading, setWarehouseStockLoading] = useState(false);
  const [isAddingWarehouse, setIsAddingWarehouse] = useState(false);
  const [editingWarehouseId, setEditingWarehouseId] = useState<string | null>(null);
  const [newWarehouseName, setNewWarehouseName] = useState("");
  const [newWarehouseLocation, setNewWarehouseLocation] = useState("");
  const [addWarehouseLoading, setAddWarehouseLoading] = useState(false);
  const [isManagingWarehouses, setIsManagingWarehouses] = useState(false);

  const fetchWarehouses = () => {
    if (!user?.company_id) return;
    api
      .get<{ data: Warehouse[] }>("/warehouses")
      .then((res) => setWarehouses(res.data ?? []))
      .catch(() => {});
  };

  useEffect(fetchWarehouses, [user]);

  const resetWarehouseForm = () => {
    setEditingWarehouseId(null);
    setNewWarehouseName("");
    setNewWarehouseLocation("");
  };

  const closeAddWarehouse = async () => {
    const original = editingWarehouseId ? warehouses.find((w) => w.id === editingWarehouseId) : null;
    const hasChanges = editingWarehouseId
      ? newWarehouseName.trim() !== (original?.name ?? "") || newWarehouseLocation.trim() !== (original?.location ?? "")
      : newWarehouseName.trim() !== "" || newWarehouseLocation.trim() !== "";
    if (hasChanges) {
      const ok = await confirm({
        title: "Discard changes?",
        message: "You have unsaved changes. Are you sure you want to go back?",
        confirmLabel: "Discard",
        destructive: true,
      });
      if (!ok) return;
    }
    setIsAddingWarehouse(false);
    resetWarehouseForm();
  };

  const openAddWarehouse = () => {
    setEditingWarehouseId(null);
    setNewWarehouseName("");
    setNewWarehouseLocation("");
    setIsAddingWarehouse(true);
  };

  const openEditWarehouse = (w: Warehouse) => {
    setEditingWarehouseId(w.id);
    setNewWarehouseName(w.name);
    setNewWarehouseLocation(w.location ?? "");
    setIsAddingWarehouse(true);
  };

  const handleAddWarehouse = async () => {
    if (!newWarehouseName.trim()) {
      Alert.alert("Required Field", "Give this location a name (e.g. Godown, Warehouse 2).");
      return;
    }
    setAddWarehouseLoading(true);
    try {
      const payload = {
        name: newWarehouseName.trim(),
        location: newWarehouseLocation.trim() || undefined,
      };
      if (editingWarehouseId) {
        await api.patch(`/warehouses/${editingWarehouseId}`, payload);
      } else {
        await api.post("/warehouses", payload);
      }
      setIsAddingWarehouse(false);
      resetWarehouseForm();
      fetchWarehouses();
    } catch (e) {
      Alert.alert("Error", e instanceof ApiError ? e.message : "Failed to save location.");
    } finally {
      setAddWarehouseLoading(false);
    }
  };

  const handleDeleteWarehouse = async (w: Warehouse) => {
    const ok = await confirm({
      title: `Delete "${w.name}"?`,
      message:
        "This permanently removes the location. It can't be undone — an entry will be kept in the Activity Log with the full details. Locations with existing stock movements can't be deleted.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    try {
      await api.delete(`/warehouses/${w.id}`);
      if (activeWarehouseId === w.id) setActiveWarehouseId(null);
      fetchWarehouses();
    } catch (e) {
      Alert.alert(
        "Can't Delete",
        e instanceof ApiError ? e.message : "This location still has stock movements recorded against it."
      );
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

      resetAddProductForm();
      setIsAdding(false);
      setProductPhotoUri(null);

      fetchProducts();
    } catch (error: any) {
      Alert.alert("Error", error instanceof ApiError ? error.message : "Failed to add product.");
    } finally {
      setAddLoading(false);
    }
  };

  const resetAddProductForm = () => {
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
  };

  const closeAddProduct = async () => {
    const hasChanges =
      newProductName.trim() !== "" ||
      newProductSku.trim() !== "" ||
      newProductBarcode.trim() !== "" ||
      newProductHsn.trim() !== "" ||
      newProductPrice.trim() !== "" ||
      newProductCost.trim() !== "" ||
      newProductStock.trim() !== "" ||
      newProductReorderLevel.trim() !== "" ||
      newProductPackUnit.trim() !== "" ||
      newProductPackSize.trim() !== "" ||
      newProductParentId !== null ||
      newProductVariantLabel.trim() !== "" ||
      newProductTax !== "18.00" ||
      newProductUnit !== "pcs";
    if (hasChanges) {
      const ok = await confirm({
        title: "Discard changes?",
        message: "You have unsaved changes. Are you sure you want to go back?",
        confirmLabel: "Discard",
        destructive: true,
      });
      if (!ok) return;
    }
    setIsAdding(false);
    setProductPhotoUri(null);
    resetAddProductForm();
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
      resetEditProductForm();
      fetchProducts();
    } catch (e: any) {
      Alert.alert("Error", e instanceof ApiError ? e.message : "Failed to update product.");
    } finally {
      setEditLoading(false);
    }
  };

  const resetEditProductForm = () => {
    setEditingProduct(null);
    setEditProductName("");
    setEditProductPrice("");
    setEditProductCost("");
    setEditProductTax("");
  };

  const closeEditProduct = async () => {
    if (editingProduct) {
      const hasChanges =
        editProductName !== editingProduct.name ||
        editProductPrice !== editingProduct.price ||
        editProductCost !== (editingProduct.cost || "") ||
        editProductTax !== (editingProduct.tax_rate || "18.00");
      if (hasChanges) {
        const ok = await confirm({
          title: "Discard changes?",
          message: "You have unsaved changes. Are you sure you want to go back?",
          confirmLabel: "Discard",
          destructive: true,
        });
        if (!ok) return;
      }
    }
    resetEditProductForm();
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
  // following it — but variants only render when their root is expanded
  // (tap "N variants" to reveal them), so a catalog with lots of
  // size/flavor variants reads as one clean line per product by default
  // instead of every variant always being visible. A variant whose parent
  // got filtered out by search (an edge case) falls back to showing as its
  // own root-level row instead of vanishing.
  const isProductLow = (p: Product) => {
    if (p.reorder_level === null) return false;
    return parseFloat(p.stock_quantity ?? "0") <= parseFloat(p.reorder_level);
  };

  const sortFn = (a: Product, b: Product): number => {
    switch (sortKey) {
      case "name-desc":
        return b.name.localeCompare(a.name);
      case "price-asc":
        return parseFloat(a.price) - parseFloat(b.price);
      case "price-desc":
        return parseFloat(b.price) - parseFloat(a.price);
      case "stock-asc":
        return parseFloat(a.stock_quantity ?? "0") - parseFloat(b.stock_quantity ?? "0");
      case "stock-desc":
        return parseFloat(b.stock_quantity ?? "0") - parseFloat(a.stock_quantity ?? "0");
      case "name-asc":
      default:
        return a.name.localeCompare(b.name);
    }
  };

  const SORT_OPTIONS: { key: SortKey; label: string }[] = [
    { key: "name-asc", label: "Name (A–Z)" },
    { key: "name-desc", label: "Name (Z–A)" },
    { key: "price-asc", label: "Price (Low–High)" },
    { key: "price-desc", label: "Price (High–Low)" },
    { key: "stock-asc", label: "Stock (Low–High)" },
    { key: "stock-desc", label: "Stock (High–Low)" },
  ];

  // Groups each root product with its variant children immediately
  // following it — but variants only render when their root is expanded
  // (tap "N variants" to reveal them), so a catalog with lots of
  // size/flavor variants reads as one clean line per product by default
  // instead of every variant always being visible. A variant whose parent
  // got filtered out by search (an edge case) falls back to showing as its
  // own root-level row instead of vanishing.
  const visibleProducts = lowStockOnly ? products.filter(isProductLow) : products;
  const rootProducts = visibleProducts.filter((p) => !p.parent_product_id).sort(sortFn);
  const orphanVariants = visibleProducts
    .filter((p) => p.parent_product_id && !visibleProducts.some((root) => root.id === p.parent_product_id))
    .sort(sortFn);
  const groupedProducts: Product[] = [];
  for (const root of [...rootProducts, ...orphanVariants]) {
    groupedProducts.push(root);
    if (!expandedGroups.has(root.id)) continue;
    for (const variant of visibleProducts.filter((p) => p.parent_product_id === root.id).sort(sortFn)) {
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

      {/* Sort + Low Stock Filter */}
      <View className="flex-row items-center mb-6" style={{ gap: 8 }}>
        <Pressable
          onPress={() => setIsSortMenuOpen(true)}
          className="flex-row items-center bg-surface-container-lowest dark:bg-surface-dark border border-outline-variant dark:border-outline px-3.5 py-2.5 rounded-xl"
          style={{ gap: 5 }}
        >
          <MaterialCommunityIcons name="sort" size={15} color="#3e4944" />
          <Text className="text-sm font-bold text-on-surface dark:text-text-primary-dark">
            {SORT_OPTIONS.find((o) => o.key === sortKey)?.label}
          </Text>
          <MaterialCommunityIcons name="chevron-down" size={15} color="#3e4944" />
        </Pressable>
        <Pressable
          onPress={() => setLowStockOnly((v) => !v)}
          className={`flex-row items-center px-3.5 py-2.5 rounded-xl border ${
            lowStockOnly ? "bg-error border-error" : "bg-surface-container-lowest dark:bg-surface-dark border-outline-variant dark:border-outline"
          }`}
          style={{ gap: 5 }}
        >
          <MaterialCommunityIcons name="alert-circle-outline" size={15} color={lowStockOnly ? "#fff" : "#D64545"} />
          <Text className={`text-sm font-bold ${lowStockOnly ? "text-white" : "text-error"}`}>Low Stock</Text>
        </Pressable>
      </View>

      {/* Sort Menu */}
      <Modal visible={isSortMenuOpen} animationType="fade" transparent onRequestClose={() => setIsSortMenuOpen(false)}>
        <Pressable className="flex-1 bg-black/40 justify-end" onPress={() => setIsSortMenuOpen(false)}>
          <Pressable className="bg-background dark:bg-bg-dark rounded-t-3xl px-6 pt-6" style={{ paddingBottom: bottomInset + 24 }}>
            <Text className="text-lg font-bold text-on-surface dark:text-text-primary-dark mb-4">Sort By</Text>
            {SORT_OPTIONS.map((opt) => (
              <Pressable
                key={opt.key}
                onPress={() => {
                  setSortKey(opt.key);
                  setIsSortMenuOpen(false);
                }}
                className="flex-row items-center justify-between py-3.5 border-b border-outline-variant dark:border-outline"
              >
                <Text
                  className={`text-base ${sortKey === opt.key ? "font-bold text-primary dark:text-primary-dark" : "font-medium text-on-surface dark:text-text-primary-dark"}`}
                >
                  {opt.label}
                </Text>
                {sortKey === opt.key && <MaterialCommunityIcons name="check" size={18} color="#0F7A5F" />}
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

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
          onPress={openAddWarehouse}
          className="px-4 py-2.5 rounded-xl border border-dashed border-outline-variant dark:border-outline flex-row items-center"
        >
          <MaterialCommunityIcons name="plus" size={14} color="#0F7A5F" style={{ marginRight: 5 }} />
          <Text className="text-sm font-bold text-primary dark:text-primary-dark">Add Location</Text>
        </Pressable>
        {warehouses.length > 0 && (
          <Pressable
            onPress={() => setIsManagingWarehouses(true)}
            className="px-3 py-2.5 rounded-xl border border-outline-variant dark:border-outline flex-row items-center"
          >
            <MaterialCommunityIcons name="cog-outline" size={14} color="#6B7280" />
          </Pressable>
        )}
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
            const isGroupExpanded = expandedGroups.has(item.id);
            const isDetailsExpanded = expandedDetails.has(item.id);
            const hasDetails = !!(item.sku || item.barcode || item.hsn_code);
            return (
              <View
                className="bg-surface-container-lowest dark:bg-surface-dark p-3.5 rounded-2xl border border-outline-variant dark:border-outline shadow-sm mb-3"
                style={isVariant ? { marginLeft: 24, borderLeftWidth: 3, borderLeftColor: "#0F7A5F" } : undefined}
              >
                {/* Single compact row: avatar, name, price, stock, quick actions */}
                <View className="flex-row items-center">
                  <View
                    className="w-9 h-9 rounded-xl items-center justify-center mr-3"
                    style={{ backgroundColor: avatarColor.bg }}
                  >
                    {isVariant ? (
                      <MaterialCommunityIcons name="subdirectory-arrow-right" size={15} color={avatarColor.text} />
                    ) : (
                      <Text className="font-black text-sm" style={{ color: avatarColor.text }}>
                        {getInitial(item.name)}
                      </Text>
                    )}
                  </View>
                  <Pressable className="flex-1 mr-2" onPress={() => openEditModal(item)}>
                    <Text className="text-base font-bold text-on-surface dark:text-text-primary-dark" numberOfLines={1}>
                      {item.name}
                      {item.variant_label ? ` — ${item.variant_label}` : ""}
                    </Text>
                    <View className="flex-row items-center mt-0.5" style={{ gap: 3 }}>
                      {isLow && <MaterialCommunityIcons name="alert-circle" size={12} color="#D64545" />}
                      <Text className={`text-sm font-semibold ${isLow ? "text-error" : "text-on-surface-variant dark:text-text-secondary-dark"}`}>
                        {activeWarehouseId && warehouseStockLoading
                          ? "Loading stock…"
                          : `${activeWarehouseId ? `${qty} units here` : `${qty} units`}${activeWarehouseId ? ` · ${totalQty} total` : ""}`}
                      </Text>
                    </View>
                  </Pressable>
                  <View className="items-end mr-2">
                    <Text className="text-base font-bold text-primary dark:text-primary-dark">
                      ₹{parseFloat(item.price).toFixed(0)}
                    </Text>
                    <Text className="text-xs text-on-surface-variant dark:text-text-secondary-dark mt-0.5">
                      GST {item.tax_rate}%
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => handleDeleteProduct(item)}
                    disabled={deletingId === item.id}
                    className="w-8 h-8 rounded-full bg-error/10 items-center justify-center"
                  >
                    {deletingId === item.id ? (
                      <ActivityIndicator size="small" color="#D64545" />
                    ) : (
                      <MaterialCommunityIcons name="trash-can-outline" size={15} color="#D64545" />
                    )}
                  </Pressable>
                </View>

                {/* Second row: quick stock +/-, variant toggle, details toggle — only what's actionable, nothing decorative */}
                <View className="flex-row items-center mt-2.5 pt-2.5 border-t border-outline-variant dark:border-outline" style={{ gap: 8 }}>
                  {!activeWarehouseId && (
                    <View className="flex-row items-center bg-surface-container dark:bg-surface-dark rounded-lg">
                      <Pressable onPress={() => handleQuickStockAdjustment(item, -1)} className="w-7 h-7 items-center justify-center">
                        <MaterialCommunityIcons name="minus" size={14} color="#6e7a74" />
                      </Pressable>
                      <View className="w-px h-4 bg-outline-variant dark:bg-outline" />
                      <Pressable onPress={() => handleQuickStockAdjustment(item, 1)} className="w-7 h-7 items-center justify-center">
                        <MaterialCommunityIcons name="plus" size={14} color="#6e7a74" />
                      </Pressable>
                    </View>
                  )}
                  {variantCount > 0 && (
                    <Pressable
                      onPress={() => toggleGroup(item.id)}
                      className="flex-row items-center bg-primary/10 px-2.5 py-1.5 rounded-lg"
                      style={{ gap: 3 }}
                    >
                      <Text className="text-sm font-bold text-primary">
                        {variantCount} variant{variantCount !== 1 ? "s" : ""}
                      </Text>
                      <MaterialCommunityIcons name={isGroupExpanded ? "chevron-up" : "chevron-down"} size={14} color="#0F7A5F" />
                    </Pressable>
                  )}
                  {hasDetails && (
                    <Pressable
                      onPress={() => toggleDetails(item.id)}
                      className="flex-row items-center bg-surface-container dark:bg-surface-dark px-2.5 py-1.5 rounded-lg"
                      style={{ gap: 3 }}
                    >
                      <Text className="text-sm font-semibold text-on-surface-variant dark:text-text-secondary-dark">Details</Text>
                      <MaterialCommunityIcons name={isDetailsExpanded ? "chevron-up" : "chevron-down"} size={14} color="#6B7280" />
                    </Pressable>
                  )}
                  {item.pack_unit && item.pack_size && (
                    <Text className="text-sm font-semibold text-on-surface-variant dark:text-text-secondary-dark">
                      1 {item.pack_unit} = {item.pack_size} {item.unit || "pcs"}
                    </Text>
                  )}
                  <View className="flex-1" />
                  <Pressable onPress={() => openEditModal(item)} className="px-2.5 py-1.5 bg-primary/10 rounded-lg">
                    <Text className="text-primary font-bold text-xs uppercase tracking-wider">Edit</Text>
                  </Pressable>
                </View>

                {isDetailsExpanded && (
                  <View className="mt-2.5 pt-2.5 border-t border-outline-variant dark:border-outline" style={{ gap: 3 }}>
                    {item.sku && (
                      <Text className="text-sm text-on-surface-variant dark:text-text-secondary-dark">{t("sku")}: {item.sku}</Text>
                    )}
                    {item.barcode && (
                      <Text className="text-sm text-on-surface-variant dark:text-text-secondary-dark">Barcode: {item.barcode}</Text>
                    )}
                    {item.hsn_code && (
                      <Text className="text-sm text-on-surface-variant dark:text-text-secondary-dark">HSN: {item.hsn_code}</Text>
                    )}
                  </View>
                )}
              </View>
            );
          }}
        />
      )}

      {/* Bulk Import Modal */}
      <Modal visible={isBulkImportOpen} animationType="slide" onRequestClose={() => setIsBulkImportOpen(false)}>
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
      <Modal visible={isScanning} animationType="slide" onRequestClose={() => setIsScanning(false)}>
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
      <Modal visible={isAdding} animationType="slide" onRequestClose={closeAddProduct}>
        <ScrollView className="flex-1 bg-background dark:bg-bg-dark px-6 pb-10" keyboardShouldPersistTaps="handled" style={{ paddingTop: topInset }}>
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
                {t("sku")}
              </Text>
              <TextInput
                value={newProductSku}
                onChangeText={setNewProductSku}
                placeholder={"Enter " + t("sku") + " reference"}
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
              <GstRatePicker value={newProductTax} onChange={setNewProductTax} />
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
              onPress={closeAddProduct}
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
      <Modal visible={!!editingProduct} animationType="slide" onRequestClose={closeEditProduct}>
        <ScrollView className="flex-1 bg-background dark:bg-bg-dark px-6 pb-10" keyboardShouldPersistTaps="handled" style={{ paddingTop: topInset }}>
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
            <View className="mt-4">
              <Text className="text-sm font-semibold text-on-surface-variant dark:text-text-secondary-dark uppercase tracking-wider mb-2">Cost Price (₹)</Text>
              <TextInput
                value={editProductCost}
                onChangeText={setEditProductCost}
                keyboardType="numeric"
                className="bg-surface-container-lowest dark:bg-surface-dark text-on-surface dark:text-text-primary-dark border border-outline-variant dark:border-outline rounded-xl px-4 py-4 text-base font-medium"
              />
            </View>
            <View className="mt-4">
              <Text className="text-sm font-semibold text-on-surface-variant dark:text-text-secondary-dark uppercase tracking-wider mb-2">GST Rate (%)</Text>
              <GstRatePicker value={editProductTax} onChange={setEditProductTax} />
            </View>
          </View>
          
          <View className="flex-row justify-between mt-8" style={{ marginBottom: bottomInset }}>
            <Pressable
              onPress={closeEditProduct}
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

      {/* Add/Edit Warehouse Location Modal */}
      <Modal visible={isAddingWarehouse} animationType="slide" transparent onRequestClose={closeAddWarehouse}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          className="flex-1 justify-end bg-black/40"
        >
          <View className="bg-background dark:bg-bg-dark rounded-t-3xl px-6 pt-6" style={{ paddingBottom: bottomInset + 24 }}>
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-xl font-bold text-on-surface dark:text-text-primary-dark">
                {editingWarehouseId ? "Edit Location" : "Add Location"}
              </Text>
              <Pressable onPress={closeAddWarehouse} className="w-10 h-10 items-center justify-center">
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
                <Text className="text-white font-bold text-base">
                  {editingWarehouseId ? "Save Changes" : "Add Location"}
                </Text>
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Manage Locations Modal — edit/delete existing warehouses */}
      <Modal
        visible={isManagingWarehouses}
        animationType="slide"
        transparent
        onRequestClose={() => setIsManagingWarehouses(false)}
      >
        <View className="flex-1 justify-end bg-black/40">
          <View
            className="bg-background dark:bg-bg-dark rounded-t-3xl px-6 pt-6"
            style={{ paddingBottom: bottomInset + 24, maxHeight: "75%" }}
          >
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-xl font-bold text-on-surface dark:text-text-primary-dark">Manage Locations</Text>
              <Pressable onPress={() => setIsManagingWarehouses(false)} className="w-10 h-10 items-center justify-center">
                <MaterialCommunityIcons name="close" size={20} color="#6B7280" />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={{ gap: 8, paddingBottom: 8 }}>
              {warehouses.map((w) => (
                <View
                  key={w.id}
                  className="flex-row items-center justify-between bg-surface-container-lowest dark:bg-surface-dark border border-outline-variant dark:border-outline rounded-xl px-4 py-3"
                >
                  <View className="flex-1 mr-2">
                    <Text className="text-base font-bold text-on-surface dark:text-text-primary-dark">{w.name}</Text>
                    {!!w.location && (
                      <Text className="text-sm text-on-surface-variant dark:text-text-secondary-dark mt-0.5">
                        {w.location}
                      </Text>
                    )}
                  </View>
                  <Pressable
                    onPress={() => {
                      setIsManagingWarehouses(false);
                      openEditWarehouse(w);
                    }}
                    className="w-10 h-10 items-center justify-center"
                  >
                    <MaterialCommunityIcons name="pencil-outline" size={20} color="#3B7DD8" />
                  </Pressable>
                  <Pressable onPress={() => handleDeleteWarehouse(w)} className="w-10 h-10 items-center justify-center">
                    <MaterialCommunityIcons name="trash-can-outline" size={20} color="#D64545" />
                  </Pressable>
                </View>
              ))}
            </ScrollView>
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
