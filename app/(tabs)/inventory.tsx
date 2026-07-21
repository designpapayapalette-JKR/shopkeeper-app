import React, { useState, useEffect, useMemo } from "react";
import { Text, View, ScrollView, FlatList, Pressable, TextInput, Modal, ActivityIndicator, StyleSheet, Alert, Image, KeyboardAvoidingView, Platform, useWindowDimensions } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useLocalSearchParams, useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "react-native-paper";
import { api, ApiError } from "../../src/lib/api";
import { useAuth } from "../../src/lib/auth-context";
import { useModuleVisibility } from "../../src/lib/useModuleVisibility";
import { useConfirm } from "../../src/components/ConfirmDialog";
import { useTopInset } from "../../src/lib/useTopInset";
import { useBottomInset } from "../../src/lib/useBottomInset";
import { getAvatarColor, getInitial } from "../../src/lib/avatarColor";
import BulkUploadCard from "../../src/components/BulkUploadCard";
import EmptyState from "../../src/components/EmptyState";
import { GstRatePicker } from "../../src/components/GstRatePicker";
import { useTerminology } from "../../src/lib/terminology-context";
import { useProductAttributeDefs, ProductCustomFieldsFormSection, loadProductCustomFieldValues, saveProductCustomFieldValues, CustomFieldValue } from "../../src/components/ProductCustomFields";

function formatRupee(n: number): string {
 return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

interface Product {
 id: string;
 name: string;
 sku: string;
 barcode: string;
 hsn_code: string;
 tax_rate: string;
 price: string;
 mrp?: string;
 cost: string;
 status: string;
 stock_quantity: string;
 reorder_level: string | null;
 parent_product_id?: string | null;
 variant_label?: string | null;
 unit?: string;
 pack_unit?: string | null;
 pack_size?: string | null;
 is_pinned?: boolean;
 rack_number?: string;
 shelf_number?: string;
}

interface Warehouse {
 id: string;
 name: string;
 location?: string | null;
}

export default function InventoryScreen() {
 const theme = useTheme();
 const { user, activeBrand, activeCompany, userRole } = useAuth();
 const { isModuleEnabled } = useModuleVisibility(userRole);
 const { t } = useTerminology();

 const { defs: customFieldDefs, loading: customFieldDefsLoading } = useProductAttributeDefs();

 const canManageWarehouses = isModuleEnabled("warehouse");
 const router = useRouter();
 const confirm = useConfirm();
 const topInset = useTopInset();
 const bottomInset = useBottomInset();
 const { width: screenWidth } = useWindowDimensions();
 const isTablet = screenWidth >= 768;
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
 // Warehouse selector & stock-in-warehouse view should only be available
 // to users who can manage warehouses; otherwise we keep the UI read-only.
 if (!user?.company_id || !canManageWarehouses) return;

 api
 .get<{ data: Warehouse[] }>("/warehouses")
 .then((res) => setWarehouses(res.data ?? []))
 .catch((e) => {
 console.error("[Inventory] Failed to load warehouses:", e);
 });
 };

 useEffect(fetchWarehouses, [user, canManageWarehouses]);

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
 if (!canManageWarehouses) {
 Alert.alert("Not allowed", "You don't have access to manage warehouses.");
 return;
 }
 setEditingWarehouseId(null);
 setNewWarehouseName("");
 setNewWarehouseLocation("");
 setIsAddingWarehouse(true);
 };

 const openEditWarehouse = (w: Warehouse) => {
 if (!canManageWarehouses) {
 Alert.alert("Not allowed", "You don't have access to manage warehouses.");
 return;
 }
 setEditingWarehouseId(w.id);
 setNewWarehouseName(w.name);
 setNewWarehouseLocation(w.location ?? "");
 setIsAddingWarehouse(true);
 };

 const handleAddWarehouse = async () => {
 if (!canManageWarehouses) {
 Alert.alert("Not allowed", "You don't have access to manage warehouses.");
 return;
 }
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
 if (!canManageWarehouses) {
 Alert.alert("Not allowed", "You don't have access to manage warehouses.");
 return;
 }
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
 .catch((e) => {
 console.error("[Inventory] Failed to load warehouse stock:", e);
 setWarehouseStock({});
 })
 .finally(() => setWarehouseStockLoading(false));
 }, [activeWarehouseId]);

 // Barcode Scanner Modal State
 const params = useLocalSearchParams<{ openScanner?: string; openProductId?: string; openAddProduct?: string; photoUri?: string }>();
 const [productPhotoUri, setProductPhotoUri] = useState<string | null>(null);
 const [autoOpenedProductId, setAutoOpenedProductId] = useState<string | null>(null);
 const [permission, requestPermission] = useCameraPermissions();
 const [isScanning, setIsScanning] = useState(false);
 // Which field a scan result should go into — "search" (default, filters
 // the catalog like before) or "newProductBarcode" (Add Product form's
 // own Scan button).
 const [scanTarget, setScanTarget] = useState<"search" | "newProductBarcode">("search");
 const [generatingBarcode, setGeneratingBarcode] = useState(false);

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
 const [newProductTax, setNewProductTax] = useState(activeCompany?.default_product_gst_rate?.toString() || "18.00");
 const [newProductPrice, setNewProductPrice] = useState("");
 const [newProductMrp, setNewProductMrp] = useState("");
 const [newProductCost, setNewProductCost] = useState("");
 const [newProductStock, setNewProductStock] = useState("");
 const [newProductReorderLevel, setNewProductReorderLevel] = useState("");
 const [newProductUnit, setNewProductUnit] = useState(activeCompany?.default_unit_of_measure || "pcs");
 const [newProductPackUnit, setNewProductPackUnit] = useState("");
 const [newProductPackSize, setNewProductPackSize] = useState("");
 const [newProductTracksSerials, setNewProductTracksSerials] = useState(false);
 const [newProductRackNumber, setNewProductRackNumber] = useState("");
 const [newProductShelfNumber, setNewProductShelfNumber] = useState("");
 const [newProductParentId, setNewProductParentId] = useState<string | null>(null);
 const [newProductVariantLabel, setNewProductVariantLabel] = useState("");
 const [parentPickerSearch, setParentPickerSearch] = useState("");
 const [addLoading, setAddLoading] = useState(false);
 const [newProductCustomFields, setNewProductCustomFields] = useState<CustomFieldValue[]>([]);
 const [editCustomFieldsLoading, setEditCustomFieldsLoading] = useState(false);

 // Edit Product Modal State
 const [editingProduct, setEditingProduct] = useState<Product | null>(null);
 const [editProductName, setEditProductName] = useState("");
 const [editProductPrice, setEditProductPrice] = useState("");
 const [editProductMrp, setEditProductMrp] = useState("");
 const [editProductCost, setEditProductCost] = useState("");
 const [editProductTax, setEditProductTax] = useState("");
 const [editProductIsPinned, setEditProductIsPinned] = useState(false);
 const [editProductRackNumber, setEditProductRackNumber] = useState("");
 const [editProductShelfNumber, setEditProductShelfNumber] = useState("");
 const [editLoading, setEditLoading] = useState(false);
 const [editProductCustomFields, setEditProductCustomFields] = useState<CustomFieldValue[]>([]);

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

 const handleScanBarcode = async (target: "search" | "newProductBarcode" = "search") => {
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
 setScanTarget(target);
 setIsScanning(true);
 };

 // Auto-generate the next barcode from the company's configured standard
 // (Settings > Barcode & Labels) — same generator the "Assign Barcodes"
 // bulk tool uses, just for a single product being added right now.
 const handleGenerateBarcode = async () => {
 setGeneratingBarcode(true);
 try {
 const res = await api.get<{ data: { barcode: string } }>("/products/next-barcode");
 if (res?.data?.barcode) setNewProductBarcode(res.data.barcode);
 } catch (e) {
 Alert.alert("Error", e instanceof ApiError ? e.message : "Failed to generate a barcode.");
 } finally {
 setGeneratingBarcode(false);
 }
 };

 const handleBarcodeScanned = ({ data }: { data: string }) => {
 setIsScanning(false);
 if (scanTarget === "newProductBarcode") {
 setNewProductBarcode(data);
 return;
 }
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
 mrp: newProductMrp ? parseFloat(newProductMrp) : undefined,
 cost: parseFloat(newProductCost) || 0.0,
 stock_quantity: parseFloat(newProductStock) || 0,
 reorder_level: newProductReorderLevel ? parseFloat(newProductReorderLevel) : null,
 status: "active",
 unit: newProductUnit.trim() || "pcs",
 pack_unit: newProductPackUnit.trim() || undefined,
 pack_size: newProductPackSize ? parseFloat(newProductPackSize) : undefined,
 tracks_serials: newProductTracksSerials,
 rack_number: newProductRackNumber.trim() || undefined,
 shelf_number: newProductShelfNumber.trim() || undefined,
 parent_product_id: newProductParentId || undefined,
 variant_label: newProductParentId ? newProductVariantLabel.trim() || undefined : undefined,
 };

 if (activeBrand?.id) {
 payload.brand_id = activeBrand.id;
 }

 const res = await api.post<{ data: { id: string } }>("/products", payload);
 const newProductId = res?.data?.id;
 if (newProductId && newProductCustomFields.length > 0) {
 try {
 await saveProductCustomFieldValues(newProductId, newProductCustomFields);
 } catch (e) {
 console.error("[Inventory] Failed to save custom fields for new product:", e);
 }
 }
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
 setNewProductTax(activeCompany?.default_product_gst_rate?.toString() || "18.00");
 setNewProductPrice("");
 setNewProductMrp("");
 setNewProductCost("");
 setNewProductStock("");
 setNewProductReorderLevel("");
 setNewProductUnit(activeCompany?.default_unit_of_measure || "pcs");
 setNewProductPackUnit("");
 setNewProductPackSize("");
 setNewProductTracksSerials(false);
 setNewProductRackNumber("");
 setNewProductShelfNumber("");
 setNewProductParentId(null);
 setNewProductVariantLabel("");
 setParentPickerSearch("");
 setNewProductCustomFields([]);
 };

 const closeAddProduct = async () => {
 const hasChanges =
 newProductName.trim() !== "" ||
 newProductSku.trim() !== "" ||
 newProductBarcode.trim() !== "" ||
 newProductHsn.trim() !== "" ||
 newProductPrice.trim() !== "" ||
 newProductMrp.trim() !== "" ||
 newProductCost.trim() !== "" ||
 newProductStock.trim() !== "" ||
 newProductReorderLevel.trim() !== "" ||
 newProductPackUnit.trim() !== "" ||
 newProductPackSize.trim() !== "" ||
 newProductRackNumber.trim() !== "" ||
 newProductShelfNumber.trim() !== "" ||
 newProductParentId !== null ||
 newProductVariantLabel.trim() !== "" ||
 newProductTax !== "18.00" ||
 newProductUnit !== "pcs" ||
 newProductCustomFields.length > 0;
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
 setEditProductMrp(p.mrp || "");
 setEditProductCost(p.cost || "");
 setEditProductTax(p.tax_rate || "18.00");
 setEditProductIsPinned(Boolean(p.is_pinned));
 setEditProductRackNumber(p.rack_number || "");
 setEditProductShelfNumber(p.shelf_number || "");
 setEditCustomFieldsLoading(true);
 loadProductCustomFieldValues(p.id).then((vals) => {
 setEditProductCustomFields(vals);
 setEditCustomFieldsLoading(false);
 });
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
 mrp: editProductMrp ? parseFloat(editProductMrp) : null,
 cost: editProductCost || undefined,
 tax_rate: editProductTax || undefined,
 is_pinned: editProductIsPinned,
 rack_number: editProductRackNumber.trim() || null,
 shelf_number: editProductShelfNumber.trim() || null,
 });
 try {
 await saveProductCustomFieldValues(editingProduct.id, editProductCustomFields);
 } catch (e) {
 console.error("[Inventory] Failed to save custom fields for edit:", e);
 }
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
 setEditProductMrp("");
 setEditProductCost("");
 setEditProductTax("");
 setEditProductRackNumber("");
 setEditProductShelfNumber("");
 setEditProductCustomFields([]);
 };

 const closeEditProduct = async () => {
 if (editingProduct) {
 const hasChanges =
 editProductName !== editingProduct.name ||
 editProductPrice !== editingProduct.price ||
 editProductMrp !== (editingProduct.mrp || "") ||
 editProductCost !== (editingProduct.cost || "") ||
 editProductTax !== (editingProduct.tax_rate || "18.00") ||
 editProductRackNumber !== (editingProduct.rack_number || "") ||
 editProductShelfNumber !== (editingProduct.shelf_number || "") ||
 editProductCustomFields.some((v) => v.value_text != null || v.value_number != null || v.value_json != null);
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

 // Stock Adjustment Modal State
 const [adjustTarget, setAdjustTarget] = useState<Product | null>(null);
 const [adjustQuantity, setAdjustQuantity] = useState("");
 const [adjustReason, setAdjustReason] = useState("");
 const [adjustType, setAdjustType] = useState<"add" | "remove">("add");
 const [adjustLoading, setAdjustLoading] = useState(false);

 const handleStockAdjust = async () => {
 if (!canManageWarehouses) {
 Alert.alert("Not allowed", "You don't have access to adjust stock.");
 return;
 }
 if (!adjustTarget || !adjustQuantity || !adjustReason.trim()) {
 Alert.alert("Error", "Please fill in all fields");
 return;
 }
 const qty = parseFloat(adjustQuantity);
 if (isNaN(qty) || qty <= 0) {
 Alert.alert("Error", "Quantity must be a positive number");
 return;
 }

 setAdjustLoading(true);
 try {
 const quantity = adjustType === "add" ? qty : -qty;
 const warehouseId = activeWarehouseId || (warehouses[0]?.id);
 if (!warehouseId) {
 Alert.alert("Error", "No warehouse found. Please create a warehouse first.");
 setAdjustLoading(false);
 return;
 }
 await api.post("/stock-movements/adjust", {
 productId: adjustTarget.id,
 warehouseId,
 quantity,
 reason: adjustReason.trim(),
 });
 Alert.alert("Success", `Stock ${adjustType === "add" ? "added" : "removed"} successfully`);
 setAdjustTarget(null);
 setAdjustQuantity("");
 setAdjustReason("");
 fetchProducts();
 } catch (e: any) {
 Alert.alert("Error", e instanceof ApiError ? e.message : "Failed to adjust stock");
 } finally {
 setAdjustLoading(false);
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
 <View className="flex-1 bg-background px-5" style={{ paddingTop: topInset }}>
 {/* Header */}
 <View className="flex-row items-center justify-between mb-4 pt-2">
 <View className="flex-1 mr-3">
 <Text className="font-headline-md text-on-surface" style={{ fontSize: 20, fontWeight: "700" }}>
 Products
 </Text>
 <Text className="text-sm text-on-surface-variant font-medium mt-0.5">
 {activeBrand ? `Brand: ${activeBrand.name}` : "All brands"}
 </Text>
 </View>
 <View className="flex-row" style={{ gap: 6 }}>
 <IconButton icon="swap-horizontal" color={theme.colors.primary} onPress={() => router.push("/stock-transfer-requests" as any)} />
 <IconButton icon="barcode-scan" color="#fff" bg={theme.colors.primary} onPress={() => handleScanBarcode("search")} />
 <IconButton icon="tray-arrow-up" color={theme.colors.primary} onPress={() => setIsBulkImportOpen(true)} />
 <IconButton icon="plus" color="#fff" bg={theme.colors.primary} onPress={() => setIsAdding(true)} />
 </View>
 </View>

 {/* Search */}
 <View className="flex-row items-center mb-3 bg-surface-container-lowest rounded-2xl px-4 py-3 border border-outline-variant">
 <MaterialCommunityIcons name="magnify" size={18} color="#6B7280" />
 <TextInput
 placeholder="Search by name, SKU, or barcode..."
 placeholderTextColor="#9CA3AF"
 value={search}
 onChangeText={setSearch}
 className="flex-1 ml-2 text-base font-medium text-on-surface"
 />
 {search !== "" && (
 <Pressable onPress={() => setSearch("")} className="ml-2">
 <MaterialCommunityIcons name="close-circle" size={16} color="#9CA3AF" />
 </Pressable>
 )}
 </View>

 {/* Toolbar */}
 <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3" contentContainerStyle={{ gap: 6 }}>
 <ToolbarChip icon="sort" label={SORT_OPTIONS.find((o) => o.key === sortKey)?.label || "Sort"} colorActive="#6B7280" onPress={() => setIsSortMenuOpen(true)} />
 <ToolbarChip icon="alert-circle-outline" label="Low Stock" active={lowStockOnly} colorActive="#D64545" onPress={() => setLowStockOnly((v) => !v)} />
 <ToolbarChip icon="cart-outline" label="Reorder" onPress={() => router.push("/reorder-suggestions" as any)} />
 <ToolbarChip icon="tag-outline" label="GST" colorActive="#B45309" onPress={() => router.push("/gst-rate-tools" as any)} />
 <ToolbarChip icon="currency-inr" label="Price" colorActive="#7C3AED" onPress={() => router.push("/bulk-price-update" as any)} />
 </ScrollView>

 {/* Sort Menu */}
 <Modal visible={isSortMenuOpen} animationType="fade" transparent onRequestClose={() => setIsSortMenuOpen(false)}>
 <Pressable className="flex-1 bg-black/40 justify-end" onPress={() => setIsSortMenuOpen(false)}>
 <Pressable className="bg-background rounded-t-3xl px-6 pt-6" style={{ paddingBottom: bottomInset + 24 }}>
 <Text className="text-lg font-bold text-on-surface mb-4">Sort By</Text>
 {SORT_OPTIONS.map((opt) => (
 <Pressable
 key={opt.key}
 onPress={() => {
 setSortKey(opt.key);
 setIsSortMenuOpen(false);
 }}
 className="flex-row items-center justify-between py-3.5 border-b border-outline-variant"
 >
 <Text
 className={`text-base ${sortKey === opt.key ? "font-bold text-primary" : "font-medium text-on-surface"}`}
 >
 {opt.label}
 </Text>
 {sortKey === opt.key && <MaterialCommunityIcons name="check" size={18} color={theme.colors.primary} />}
 </Pressable>
 ))}
 </Pressable>
 </Pressable>
 </Modal>

 {/* Warehouse Selector */}
 {warehouses.length > 0 && (
 <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3" contentContainerStyle={{ gap: 6 }}>
 <WarehouseChip label="All Warehouses" active={activeWarehouseId === null} onPress={() => setActiveWarehouseId(null)} />
 {warehouses.map((w) => (
 <WarehouseChip key={w.id} label={w.name} active={activeWarehouseId === w.id} onPress={() => setActiveWarehouseId(w.id)} />
 ))}
 {canManageWarehouses && (
 <>
 <WarehouseChip label="+ Add" dashed onPress={openAddWarehouse} />
 <WarehouseChip label="" icon="cog-outline" onPress={() => setIsManagingWarehouses(true)} />
 </>
 )}
 </ScrollView>
 )}

 {/* Catalog List */}
 {loading ? (
 <View className="flex-1 justify-center items-center">
 <ActivityIndicator size="large" color={theme.colors.primary} />
 </View>
 ) : products.length === 0 ? (
 <EmptyState
 icon="package-variant-closed"
 title="No products yet"
 description="Add your first product to start tracking stock and billing it at the counter."
 actionLabel="Add Product"
 onAction={() => setIsAdding(true)}
 />
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
 className="bg-surface-container-lowest rounded-2xl border border-outline-variant mb-3 overflow-hidden"
 style={isVariant ? { marginLeft: 24, borderLeftWidth: 3, borderLeftColor: theme.colors.primary } : undefined}
 >
 <Pressable onPress={() => openEditModal(item)} className="p-3.5 active:opacity-80">
 <View className="flex-row items-center">
 <View className="w-9 h-9 rounded-xl items-center justify-center mr-3" style={{ backgroundColor: avatarColor.bg }}>
 {isVariant ? (
 <MaterialCommunityIcons name="subdirectory-arrow-right" size={15} color={avatarColor.text} />
 ) : (
 <Text className="font-black text-sm" style={{ color: avatarColor.text }}>{getInitial(item.name)}</Text>
 )}
 </View>
 <View className="flex-1 mr-2">
 <Text className="text-base font-bold text-on-surface" numberOfLines={1}>
 {item.name}{item.variant_label ? ` — ${item.variant_label}` : ""}
 </Text>
 <View className="flex-row items-center mt-0.5" style={{ gap: 4 }}>
 {isLow && <MaterialCommunityIcons name="alert-circle" size={14} color="#D64545" />}
 <Text className={`text-sm font-semibold ${isLow ? "text-error" : "text-on-surface-variant"}`}>
 {activeWarehouseId && warehouseStockLoading ? "Loading…" : `${qty}${activeWarehouseId ? " here" : ""}`}
 {isLow && reorderLevel !== null ? ` (min ${reorderLevel})` : ""}
 {activeWarehouseId ? ` · ${totalQty} total` : ""}
 </Text>
 </View>
 </View>
 <View className="items-end">
 <Text className="text-base font-bold text-primary">{formatRupee(parseFloat(item.price))}</Text>
 <Text className="text-xs text-on-surface-variant mt-0.5">GST {item.tax_rate}%</Text>
 </View>
 </View>
 </Pressable>

 <View className="flex-row items-center px-3.5 pb-3" style={{ gap: 6 }}>
 {!activeWarehouseId && canManageWarehouses && (
 <ActionChip icon="clipboard-edit-outline" label="Adjust" onPress={() => { setAdjustTarget(item); setAdjustType("add"); setAdjustQuantity(""); setAdjustReason(""); }} />
 )}
 {variantCount > 0 && (
 <ActionChip icon={isGroupExpanded ? "chevron-up" : "chevron-down"} label={`${variantCount} variant${variantCount !== 1 ? "s" : ""}`} onPress={() => toggleGroup(item.id)} />
 )}
 {hasDetails && (
 <ActionChip icon={isDetailsExpanded ? "chevron-up" : "chevron-down"} label="Details" onPress={() => toggleDetails(item.id)} />
 )}
 <View className="flex-1" />
 <Pressable onPress={() => openEditModal(item)} className="px-3 py-1.5 bg-primary/10 rounded-lg">
 <Text className="text-primary font-bold text-xs">Edit</Text>
 </Pressable>
 <Pressable onPress={() => handleDeleteProduct(item)} disabled={deletingId === item.id} className="w-8 h-8 rounded-full bg-error/10 items-center justify-center">
 {deletingId === item.id ? <ActivityIndicator size="small" color="#D64545" /> : <MaterialCommunityIcons name="trash-can-outline" size={15} color="#D64545" />}
 </Pressable>
 </View>

 {isDetailsExpanded && (
 <View className="px-3.5 pb-3" style={{ gap: 2 }}>
 {item.sku && <DetailLine label={t("sku")} value={item.sku} />}
 {item.barcode && <DetailLine label="Barcode" value={item.barcode} />}
 {item.hsn_code && <DetailLine label="HSN" value={item.hsn_code} />}
 {item.pack_unit && item.pack_size && <DetailLine label="Pack" value={`1 ${item.pack_unit} = ${item.pack_size} ${item.unit || "pcs"}`} />}
 </View>
 )}
 </View>
 );
 }}
 />
 )}

 {/* Bulk Import Modal */}
 <Modal visible={isBulkImportOpen} animationType="slide" onRequestClose={() => setIsBulkImportOpen(false)}>
 <SafeAreaProvider>
 <View className="flex-1 bg-background px-6" style={{ paddingTop: topInset }}>
 <View className="flex-row justify-between items-center mb-6">
 <Text className="text-2xl font-bold text-on-surface">
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
 { header: "mrp", example: "299.00", required: false },
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
 mrp: row.mrp ? parseFloat(row.mrp) : undefined,
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
 </SafeAreaProvider>
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
 <SafeAreaProvider>
 <ScrollView className="flex-1 bg-background px-6 pb-10" keyboardShouldPersistTaps="handled" style={{ paddingTop: topInset }}>
 <Text className="text-2xl font-bold text-on-surface mb-6">
 Add New Product
 </Text>

 {productPhotoUri && (
 <View className="mb-6">
 <Text className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider mb-2">
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
 <Text className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider mb-2">
 Product Name *
 </Text>
 <TextInput
 value={newProductName}
 onChangeText={setNewProductName}
 placeholder="Enter product name"
 placeholderTextColor="#A0A0A0"
 className="bg-surface-container-lowest text-on-surface border border-outline-variant rounded-xl px-4 py-4 text-base font-medium"
 />
 </View>

 <View className="mt-4">
 <Text className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider mb-2">
 {t("sku")}
 </Text>
 <TextInput
 value={newProductSku}
 onChangeText={setNewProductSku}
 placeholder={"Enter " + t("sku") + " reference"}
 placeholderTextColor="#A0A0A0"
 className="bg-surface-container-lowest text-on-surface border border-outline-variant rounded-xl px-4 py-4 text-base font-medium"
 />
 </View>

 <View className="mt-4">
 <Text className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider mb-2">
 Barcode
 </Text>
 <View className="flex-row" style={{ gap: 8 }}>
 <TextInput
 value={newProductBarcode}
 onChangeText={setNewProductBarcode}
 placeholder="Scan, generate, or type a barcode"
 placeholderTextColor="#A0A0A0"
 className="flex-1 bg-surface-container-lowest text-on-surface border border-outline-variant rounded-xl px-4 py-4 text-base font-medium"
 />
 <Pressable
 onPress={() => handleScanBarcode("newProductBarcode")}
 className="w-14 items-center justify-center rounded-xl bg-primary/10 border border-primary/30"
 >
 <MaterialCommunityIcons name="barcode-scan" size={22} color={theme.colors.primary} />
 </Pressable>
 <Pressable
 onPress={handleGenerateBarcode}
 disabled={generatingBarcode}
 className="w-14 items-center justify-center rounded-xl bg-primary/10 border border-primary/30"
 >
 {generatingBarcode ? (
 <ActivityIndicator size="small" color={theme.colors.primary} />
 ) : (
 <MaterialCommunityIcons name="auto-fix" size={22} color={theme.colors.primary} />
 )}
 </Pressable>
 </View>
 <Text className="text-xs text-on-surface-variant mt-1.5">
 Scan an existing barcode off the product, or tap the wand to generate one using your shop&apos;s configured standard.
 </Text>
 </View>

 <View className="mt-4">
 <Text className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider mb-2">
 HSN Code
 </Text>
 <TextInput
 value={newProductHsn}
 onChangeText={setNewProductHsn}
 placeholder="Enter GST HSN Code"
 placeholderTextColor="#A0A0A0"
 className="bg-surface-container-lowest text-on-surface border border-outline-variant rounded-xl px-4 py-4 text-base font-medium"
 />
 </View>

 <View className="mt-4">
 <Text className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider mb-2">
 GST Rate (%)
 </Text>
 <GstRatePicker value={newProductTax} onChange={setNewProductTax} />
 </View>

 <View className="mt-4">
 <Text className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider mb-2">
 MRP (INR)
 </Text>
 <Text className="text-xs text-on-surface-variant mb-1">
 Maximum Retail Price — printed on the product package
 </Text>
 <TextInput
 value={newProductMrp}
 onChangeText={setNewProductMrp}
 placeholder="0.00"
 placeholderTextColor="#A0A0A0"
 keyboardType="numeric"
 className="bg-surface-container-lowest text-on-surface border border-outline-variant rounded-xl px-4 py-4 text-base font-medium"
 />
 </View>

 <View className="mt-4">
 <Text className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider mb-2">
 Selling Price (INR) *
 </Text>
 <TextInput
 value={newProductPrice}
 onChangeText={setNewProductPrice}
 placeholder="0.00"
 placeholderTextColor="#A0A0A0"
 keyboardType="numeric"
 className="bg-surface-container-lowest text-on-surface border border-outline-variant rounded-xl px-4 py-4 text-lg font-bold"
 />
 </View>

 <View className="mt-4">
 <Text className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider mb-2">
 Cost Price (INR)
 </Text>
 <TextInput
 value={newProductCost}
 onChangeText={setNewProductCost}
 placeholder="0.00"
 placeholderTextColor="#A0A0A0"
 keyboardType="numeric"
 className="bg-surface-container-lowest text-on-surface border border-outline-variant rounded-xl px-4 py-4 text-base font-medium"
 />
 </View>

 <View className="mt-4">
 <Text className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider mb-2">
 Opening Stock Quantity
 </Text>
 <TextInput
 value={newProductStock}
 onChangeText={setNewProductStock}
 placeholder="0"
 placeholderTextColor="#A0A0A0"
 keyboardType="numeric"
 className="bg-surface-container-lowest text-on-surface border border-outline-variant rounded-xl px-4 py-4 text-base font-medium"
 />
 </View>

 <View className="mt-4">
 <Text className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider mb-2">
 Low-Stock Alert Level
 </Text>
 <TextInput
 value={newProductReorderLevel}
 onChangeText={setNewProductReorderLevel}
 placeholder="e.g. 10 (leave blank to disable alert)"
 placeholderTextColor="#A0A0A0"
 keyboardType="numeric"
 className="bg-surface-container-lowest text-on-surface border border-outline-variant rounded-xl px-4 py-4 text-base font-medium"
 />
 </View>

 <View className="mt-6 pt-4 border-t border-outline-variant">
 <Text className="text-base font-bold text-on-surface mb-1">
 Packaging (optional)
 </Text>
 <Text className="text-sm text-on-surface-variant mb-3">
 Stock is always tracked in the base unit. Set a pack unit so purchases can be entered by the box/carton and converted automatically.
 </Text>
 <View className="flex-row" style={{ gap: 8 }}>
 <View className="flex-1">
 <Text className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider mb-2">
 Base Unit
 </Text>
 <TextInput
 value={newProductUnit}
 onChangeText={setNewProductUnit}
 placeholder="pcs"
 placeholderTextColor="#A0A0A0"
 className="bg-surface-container-lowest text-on-surface border border-outline-variant rounded-xl px-4 py-4 text-base font-medium"
 />
 </View>
 <View className="flex-1">
 <Text className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider mb-2">
 Pack Unit
 </Text>
 <TextInput
 value={newProductPackUnit}
 onChangeText={setNewProductPackUnit}
 placeholder="e.g. Box"
 placeholderTextColor="#A0A0A0"
 className="bg-surface-container-lowest text-on-surface border border-outline-variant rounded-xl px-4 py-4 text-base font-medium"
 />
 </View>
 </View>
 {newProductPackUnit.trim() !== "" && (
 <View className="mt-4">
 <Text className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider mb-2">
 {newProductUnit || "pcs"} per {newProductPackUnit}
 </Text>
 <TextInput
 value={newProductPackSize}
 onChangeText={setNewProductPackSize}
 placeholder="e.g. 24"
 placeholderTextColor="#A0A0A0"
 keyboardType="numeric"
 className="bg-surface-container-lowest text-on-surface border border-outline-variant rounded-xl px-4 py-4 text-base font-medium"
 />
 </View>
 )}
 <Pressable
 onPress={() => setNewProductTracksSerials((v) => !v)}
 className={`flex-row items-center justify-between px-3 py-3 rounded-xl border mt-4 ${
 newProductTracksSerials ? "bg-primary/10 border-primary" : "border-outline-variant"
 }`}
 >
 <View className="flex-1 pr-2">
 <Text className="text-sm font-bold text-on-surface">Track individual serial numbers</Text>
 <Text className="text-xs text-on-surface-variant mt-0.5">For warranty-bearing or high-value items sold as single units</Text>
 </View>
 <MaterialCommunityIcons
 name={newProductTracksSerials ? "toggle-switch" : "toggle-switch-off-outline"}
 size={26}
 color={newProductTracksSerials ? theme.colors.primary : theme.colors.outline}
 />
 </Pressable>

 <View className="mt-4">
 <Text className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider mb-2">Rack Number</Text>
 <TextInput
 value={newProductRackNumber}
 onChangeText={setNewProductRackNumber}
 placeholder="e.g. A-01"
 placeholderTextColor="#A0A0A0"
 className="bg-surface-container-lowest text-on-surface border border-outline-variant rounded-xl px-4 py-4 text-base font-medium"
 />
 </View>

 <View className="mt-4">
 <Text className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider mb-2">Shelf Number</Text>
 <TextInput
 value={newProductShelfNumber}
 onChangeText={setNewProductShelfNumber}
 placeholder="e.g. Shelf B"
 placeholderTextColor="#A0A0A0"
 className="bg-surface-container-lowest text-on-surface border border-outline-variant rounded-xl px-4 py-4 text-base font-medium"
 />
 </View>
 </View>

 <View className="mt-6 pt-4 border-t border-outline-variant">
 <Text className="text-base font-bold text-on-surface mb-1">
 Variant Of (optional)
 </Text>
 <Text className="text-sm text-on-surface-variant mb-3">
 Link this as a size/flavor/color variant of an existing product — it stays fully independent (own price, stock, barcode) but groups together in the list.
 </Text>
 <View className="bg-surface-container-lowest border border-outline-variant rounded-xl px-2 py-1">
 <TextInput
 placeholder="Search products to link as parent..."
 placeholderTextColor="#A0A0A0"
 value={parentPickerSearch}
 onChangeText={setParentPickerSearch}
 className="text-sm font-medium px-2 py-3 text-on-surface"
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
 ? "bg-primary border-primary"
 : "bg-background border-outline-variant"
 }`}
 >
 <Text className={`text-sm font-semibold ${newProductParentId === p.id ? "text-white" : "text-on-surface-variant"}`}>
 {p.name}
 </Text>
 </Pressable>
 ))}
 </ScrollView>
 </View>
 {newProductParentId && (
 <View className="mt-4">
 <Text className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider mb-2">
 Variant Label
 </Text>
 <TextInput
 value={newProductVariantLabel}
 onChangeText={setNewProductVariantLabel}
 placeholder="e.g. 500ml, Red - XL, Mango Flavor"
 placeholderTextColor="#A0A0A0"
 className="bg-surface-container-lowest text-on-surface border border-outline-variant rounded-xl px-4 py-4 text-base font-medium"
 />
 </View>
 )}
 </View>
 </View>

 {!customFieldDefsLoading && customFieldDefs.length > 0 && (
 <ProductCustomFieldsFormSection
 defs={customFieldDefs}
 values={newProductCustomFields}
 onChange={setNewProductCustomFields}
 />
 )}

 {/* Form Actions */}
 <View className="flex-row justify-between mt-8" style={{ marginBottom: bottomInset }}>
 <Pressable
 onPress={closeAddProduct}
 className="border border-outline-variant py-4 px-6 rounded-xl w-[48%] items-center"
 >
 <Text className="text-on-surface-variant font-bold text-base">Cancel</Text>
 </Pressable>
 <Pressable
 onPress={handleAddProduct}
 disabled={addLoading}
 className="bg-primary py-4 px-6 rounded-xl w-[48%] items-center"
 >
 {addLoading ? (
 <ActivityIndicator color="white" />
 ) : (
 <Text className="text-white font-bold text-base">Add Product</Text>
 )}
 </Pressable>
 </View>
 </ScrollView>
 </SafeAreaProvider>
 </Modal>

 {/* Edit Product Modal */}
 <Modal visible={!!editingProduct} animationType="slide" onRequestClose={closeEditProduct}>
 <SafeAreaProvider>
 <ScrollView className="flex-1 bg-background px-6 pb-10" keyboardShouldPersistTaps="handled" style={{ paddingTop: topInset }}>
 <Text className="text-2xl font-bold text-on-surface mb-6">
 Edit Product
 </Text>
 <View className="space-y-4">
 <View>
 <Text className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider mb-2">Name *</Text>
 <TextInput
 value={editProductName}
 onChangeText={setEditProductName}
 className="bg-surface-container-lowest text-on-surface border border-outline-variant rounded-xl px-4 py-4 text-base font-medium"
 />
 </View>
 <View className="mt-4">
 <Text className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider mb-2">MRP (₹)</Text>
 <TextInput
 value={editProductMrp}
 onChangeText={setEditProductMrp}
 keyboardType="numeric"
 placeholder="Leave blank for none"
 placeholderTextColor="#A0A0A0"
 className="bg-surface-container-lowest text-on-surface border border-outline-variant rounded-xl px-4 py-4 text-base font-medium"
 />
 </View>
 <View className="mt-4">
 <Text className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider mb-2">Selling Price (₹) *</Text>
 <TextInput
 value={editProductPrice}
 onChangeText={setEditProductPrice}
 keyboardType="numeric"
 className="bg-surface-container-lowest text-on-surface border border-outline-variant rounded-xl px-4 py-4 text-base font-medium"
 />
 </View>
 <View className="mt-4">
 <Text className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider mb-2">Cost Price (₹)</Text>
 <TextInput
 value={editProductCost}
 onChangeText={setEditProductCost}
 keyboardType="numeric"
 className="bg-surface-container-lowest text-on-surface border border-outline-variant rounded-xl px-4 py-4 text-base font-medium"
 />
 </View>
 <View className="mt-4">
 <Text className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider mb-2">GST Rate (%)</Text>
 <GstRatePicker value={editProductTax} onChange={setEditProductTax} />
 </View>
 <View className="mt-4">
 <Text className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider mb-2">Rack Number</Text>
 <TextInput
 value={editProductRackNumber}
 onChangeText={setEditProductRackNumber}
 placeholder="e.g. A-01"
 placeholderTextColor="#A0A0A0"
 className="bg-surface-container-lowest text-on-surface border border-outline-variant rounded-xl px-4 py-4 text-base font-medium"
 />
 </View>
 <View className="mt-4">
 <Text className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider mb-2">Shelf Number</Text>
 <TextInput
 value={editProductShelfNumber}
 onChangeText={setEditProductShelfNumber}
 placeholder="e.g. Shelf B"
 placeholderTextColor="#A0A0A0"
 className="bg-surface-container-lowest text-on-surface border border-outline-variant rounded-xl px-4 py-4 text-base font-medium"
 />
 </View>
 </View>

 {editCustomFieldsLoading ? (
 <View className="mt-6 pt-4 border-t border-outline-variant items-center py-4">
 <ActivityIndicator size="small" color={theme.colors.primary} />
 </View>
 ) : !customFieldDefsLoading && customFieldDefs.length > 0 && (
 <ProductCustomFieldsFormSection
 defs={customFieldDefs}
 values={editProductCustomFields}
 onChange={setEditProductCustomFields}
 />
 )}
 
 <View className="flex-row justify-between mt-8" style={{ marginBottom: bottomInset }}>
 <Pressable
 onPress={closeEditProduct}
 className="border border-outline-variant py-4 px-6 rounded-xl w-[48%] items-center"
 >
 <Text className="text-on-surface-variant font-bold text-base">Cancel</Text>
 </Pressable>
 <Pressable
 onPress={handleEditProduct}
 disabled={editLoading}
 className="bg-primary py-4 px-6 rounded-xl w-[48%] items-center"
 >
 {editLoading ? <ActivityIndicator color="white" /> : <Text className="text-white font-bold text-base">Save Changes</Text>}
 </Pressable>
 </View>
 </ScrollView>
 </SafeAreaProvider>
 </Modal>

 {/* Add/Edit Warehouse Location Modal */}
 <Modal visible={isAddingWarehouse} animationType="slide" transparent onRequestClose={closeAddWarehouse}>
 <KeyboardAvoidingView
 behavior={Platform.OS === "ios" ? "padding" : undefined}
 className="flex-1 justify-end bg-black/40"
 >
 <View className="bg-background rounded-t-3xl px-6 pt-6" style={{ paddingBottom: bottomInset + 24 }}>
 <View className="flex-row justify-between items-center mb-6">
 <Text className="text-xl font-bold text-on-surface">
 {editingWarehouseId ? "Edit Location" : "Add Location"}
 </Text>
 <Pressable onPress={closeAddWarehouse} className="w-10 h-10 items-center justify-center">
 <MaterialCommunityIcons name="close" size={20} color="#6B7280" />
 </Pressable>
 </View>
 <Text className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider mb-2">
 Name *
 </Text>
 <TextInput
 value={newWarehouseName}
 onChangeText={setNewWarehouseName}
 placeholder="e.g. Godown, Warehouse 2, Shop Floor"
 placeholderTextColor="#A0A0A0"
 className="bg-surface-container-lowest text-on-surface border border-outline-variant rounded-xl px-4 py-4 text-base font-medium mb-4"
 />
 <Text className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider mb-2">
 Location (optional)
 </Text>
 <TextInput
 value={newWarehouseLocation}
 onChangeText={setNewWarehouseLocation}
 placeholder="e.g. Behind the shop, Sector 5"
 placeholderTextColor="#A0A0A0"
 className="bg-surface-container-lowest text-on-surface border border-outline-variant rounded-xl px-4 py-4 text-base font-medium mb-6"
 />
 <Pressable
 onPress={handleAddWarehouse}
 disabled={addWarehouseLoading}
 className="bg-primary py-4 rounded-xl items-center"
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

 {/* Stock Adjustment Modal */}
 <Modal visible={!!adjustTarget} animationType="slide" transparent onRequestClose={() => setAdjustTarget(null)}>
 <KeyboardAvoidingView
 behavior={Platform.OS === "ios" ? "padding" : undefined}
 className="flex-1 justify-end bg-black/40"
 >
 <View className="bg-background rounded-t-3xl px-6 pt-6" style={{ paddingBottom: bottomInset + 24 }}>
 <View className="flex-row justify-between items-center mb-4">
 <Text className="text-xl font-bold text-on-surface">
 Stock Adjustment
 </Text>
 <Pressable onPress={() => setAdjustTarget(null)} className="w-10 h-10 items-center justify-center">
 <MaterialCommunityIcons name="close" size={20} color="#6B7280" />
 </Pressable>
 </View>

 {adjustTarget && (
 <>
 <Text className="text-base font-bold text-on-surface mb-4">
 {adjustTarget.name}
 </Text>

 <View className="flex-row gap-3 mb-4">
 <Pressable
 onPress={() => setAdjustType("add")}
 className={`flex-1 py-3 rounded-xl items-center border-2 ${
 adjustType === "add" ? "border-green-500 bg-green-50" : "border-outline-variant"
 }`}
 >
 <MaterialCommunityIcons name="plus" size={20} color={adjustType === "add" ? "#16a34a" : theme.colors.onSurfaceVariant} />
 <Text className={`text-sm font-bold mt-1 ${adjustType === "add" ? "text-success" : "text-on-surface-variant"}`}>Add Stock</Text>
 </Pressable>
 <Pressable
 onPress={() => setAdjustType("remove")}
 className={`flex-1 py-3 rounded-xl items-center border-2 ${
 adjustType === "remove" ? "border-red-500 bg-red-50" : "border-outline-variant"
 }`}
 >
 <MaterialCommunityIcons name="minus" size={20} color={adjustType === "remove" ? "#dc2626" : theme.colors.onSurfaceVariant} />
 <Text className={`text-sm font-bold mt-1 ${adjustType === "remove" ? "text-error" : "text-on-surface-variant"}`}>Remove Stock</Text>
 </Pressable>
 </View>

 <Text className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider mb-2">
 Quantity *
 </Text>
 <TextInput
 value={adjustQuantity}
 onChangeText={setAdjustQuantity}
 placeholder="Enter quantity"
 placeholderTextColor="#A0A0A0"
 keyboardType="numeric"
 className="bg-surface-container-lowest text-on-surface border border-outline-variant rounded-xl px-4 py-4 text-base font-medium mb-4"
 />

 <Text className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider mb-2">
 Reason *
 </Text>
 <TextInput
 value={adjustReason}
 onChangeText={setAdjustReason}
 placeholder="e.g. Damaged goods, expired stock, inventory correction..."
 placeholderTextColor="#A0A0A0"
 multiline
 numberOfLines={3}
 className="bg-surface-container-lowest text-on-surface border border-outline-variant rounded-xl px-4 py-4 text-base font-medium mb-6 min-h-[80px]"
 />

 <Pressable
 onPress={handleStockAdjust}
 disabled={adjustLoading}
 className={`py-4 rounded-xl items-center ${adjustType === "add" ? "bg-green-600" : "bg-red-600"}`}
 >
 {adjustLoading ? (
 <ActivityIndicator color="white" />
 ) : (
 <Text className="text-white font-bold text-base">
 {adjustType === "add" ? "Add Stock" : "Remove Stock"}
 </Text>
 )}
 </Pressable>
 </>
 )}
 </View>
 </KeyboardAvoidingView>
 </Modal>

 {/* Manage Locations Modal — edit/delete existing warehouses */}
 <Modal
 visible={isManagingWarehouses && canManageWarehouses}
 animationType="slide"
 transparent
 onRequestClose={() => setIsManagingWarehouses(false)}
 >
 <View className="flex-1 justify-end bg-black/40">
 <View
 className="bg-background rounded-t-3xl px-6 pt-6"
 style={{ paddingBottom: bottomInset + 24, maxHeight: "75%" }}
 >
 <View className="flex-row justify-between items-center mb-4">
 <Text className="text-xl font-bold text-on-surface">Manage Locations</Text>
 <Pressable onPress={() => setIsManagingWarehouses(false)} className="w-10 h-10 items-center justify-center">
 <MaterialCommunityIcons name="close" size={20} color="#6B7280" />
 </Pressable>
 </View>
 <ScrollView contentContainerStyle={{ gap: 8, paddingBottom: 8 }}>
 {warehouses.map((w) => (
 <View
 key={w.id}
 className="flex-row items-center justify-between bg-surface-container-lowest border border-outline-variant rounded-xl px-4 py-3"
 >
 <View className="flex-1 mr-2">
 <Text className="text-base font-bold text-on-surface">{w.name}</Text>
 {!!w.location && (
 <Text className="text-sm text-on-surface-variant mt-0.5">
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
 <MaterialCommunityIcons name="pencil-outline" size={20} color={theme.colors.primary} />
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

/* ── Helpers (no theme dependency — Tailwind classes only) ── */
function IconButton({ icon, color, bg, onPress }: { icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"]; color: string; bg?: string; onPress: () => void }) {
 return (
 <Pressable onPress={onPress} className="w-10 h-10 rounded-xl items-center justify-center" style={{ backgroundColor: bg || "#F3F4F6" }}>
 <MaterialCommunityIcons name={icon} size={18} color={color} />
 </Pressable>
 );
}

function ToolbarChip({ icon, label, active, colorActive, onPress }: {
 icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
 label: string;
 active?: boolean;
 colorActive?: string;
 onPress: () => void;
}) {
 if (active) {
 return (
 <Pressable onPress={onPress} className="flex-row items-center rounded-xl px-3 py-2.5" style={[{ gap: 4 }, { backgroundColor: colorActive || "#D64545" }]}>
 <MaterialCommunityIcons name={icon} size={14} color="#fff" />
 <Text className="text-xs font-bold text-white">{label}</Text>
 </Pressable>
 );
 }
 if (colorActive) {
 return (
 <Pressable onPress={onPress} className="flex-row items-center rounded-xl px-3 py-2.5 bg-surface-container" style={{ gap: 4 }}>
 <MaterialCommunityIcons name={icon} size={14} color={colorActive} />
 <Text className="text-xs font-bold" style={{ color: colorActive }}>{label}</Text>
 </Pressable>
 );
 }
 return (
 <Pressable onPress={onPress} className="flex-row items-center rounded-xl px-3 py-2.5 bg-primary" style={{ gap: 4 }}>
 <MaterialCommunityIcons name={icon} size={14} color="#fff" />
 <Text className="text-xs font-bold text-white">{label}</Text>
 </Pressable>
 );
}

function WarehouseChip({ label, active, dashed, icon, onPress }: {
 label: string;
 active?: boolean;
 dashed?: boolean;
 icon?: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
 onPress: () => void;
}) {
 if (icon) return <IconButton icon={icon} color="#6B7280" onPress={onPress} />;
 return (
 <Pressable
 onPress={onPress}
 className="flex-row items-center rounded-xl px-3.5 py-2.5"
 style={[{
 gap: 5,
 backgroundColor: active ? "#1E8E85" : "#F3F4F6",
 borderWidth: dashed ? 1 : 0,
 borderColor: dashed ? "#D1D5DB" : undefined,
 borderStyle: dashed ? "dashed" : undefined,
 }]}
 >
 {!dashed && <MaterialCommunityIcons name="warehouse" size={14} color={active ? "#fff" : "#6B7280"} />}
 <Text className="text-xs font-bold" style={{ color: active ? "#fff" : dashed ? "#1E8E85" : "#6B7280" }}>{label}</Text>
 </Pressable>
 );
}

function ActionChip({ icon, label, onPress }: { icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"]; label: string; onPress: () => void }) {
 return (
 <Pressable onPress={onPress} className="flex-row items-center bg-primary/10 px-2.5 py-1.5 rounded-lg" style={{ gap: 3 }}>
 <MaterialCommunityIcons name={icon} size={13} color="#1E8E85" />
 <Text className="text-xs font-bold text-primary">{label}</Text>
 </Pressable>
 );
}

function DetailLine({ label, value }: { label: string; value: string }) {
 return <Text className="text-sm text-on-surface-variant"><Text className="font-semibold">{label}:</Text> {value}</Text>;
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
 borderColor: "#03A8FE",
 backgroundColor: "transparent",
 borderRadius: 16,
 },
});
