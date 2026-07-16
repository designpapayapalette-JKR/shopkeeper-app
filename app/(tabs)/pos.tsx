import React, { useState, useEffect, useMemo } from "react";
import {
  Text,
  View,
  ScrollView,
  Pressable,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
  FlatList,
  useWindowDimensions,
  StyleSheet,
  Image,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import * as Print from "expo-print";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { generateReceiptHtml, ReceiptData, thermalPageWidthPt, estimateThermalPageHeightPt, ThermalPaperWidth } from "../../src/lib/printer";
import { generateTallyInvoiceHtml, TallyInvoiceItem } from "../../src/lib/invoiceTemplate";
import { shareInvoiceFile } from "../../src/lib/sharer";
import { printToSavedPrinter, getDefaultPrinter } from "../../src/lib/thermalPrinter";
import PosDashboardPanel from "../../src/components/PosDashboardPanel";
import { GstRatePicker } from "../../src/components/GstRatePicker";
import { useAuth } from "../../src/lib/auth-context";
import { api, ApiError } from "../../src/lib/api";
import { useConfirm } from "../../src/components/ConfirmDialog";
import { useTopInset } from "../../src/lib/useTopInset";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useBottomInset } from "../../src/lib/useBottomInset";
import { enqueueSale, isNetworkFailure } from "../../src/lib/offlineQueue";
import { useTerminology } from "../../src/lib/terminology-context";
import { useKeepAwake } from "expo-keep-awake";
import { writeCache, readCache, getCacheKey } from "../../src/lib/apiCache";
import { getIsConnected, subscribeToConnectivity } from "../../src/lib/connectivity";

interface Product {
  id: string;
  name: string;
  sku: string;
  barcode: string;
  hsn_code?: string;
  price: string;
  mrp?: string;
  tax_rate: string;
  stock_quantity?: string;
  category?: { name: string } | null;
}

interface Party {
  id: string;
  name: string;
  phone: string;
  type: string;
  state?: string | null;
  gstin?: string | null;
  category?: "b2b" | "b2c";
  current_balance?: string;
  credit_limit?: string | null;
}

interface Warehouse {
  id: string;
  name: string;
}

interface CartItem {
  product: Product;
  quantity: number;
  // Per-sale GST override — lets the cashier correct a rate for this one
  // bill (e.g. the product master has the wrong slab, or a one-off
  // exemption applies) without editing the product's stored default.
  customTaxRate?: string;
  // Per-item discount — a flat discount amount applied to this line item,
  // complementary to the bill-level discountPercent.
  discount?: number;
}

export default function PosScreen() {
  const { user, activeCompany, activeBrand } = useAuth();
  const { t } = useTerminology();
  const router = useRouter();
  const confirm = useConfirm();
  const confirmDelete = useConfirm();
  const { width, height } = useWindowDimensions();
  const isTablet = width >= 768;
  const isLandscape = width > height;
  const isPosDevice = isLandscape && width >= 640;
  const topInset = useTopInset();
  const bottomInset = useBottomInset();

  // POS is a proper module with two modes: "New Sale" (billing/cart, the
  // default) and "Dashboard" (today's sales broken down by retail/GST/
  // estimate, the full invoice list, and reprint/return/void — all inline
  // in this same tab instead of forcing a trip to a different screen).
  const [posView, setPosView] = useState<"sale" | "dashboard">("sale");

  // Data State
  const [products, setProducts] = useState<Product[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [defaultWarehouseId, setDefaultWarehouseId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [gstEditProductId, setGstEditProductId] = useState<string | null>(null);
  const [gstEditValue, setGstEditValue] = useState("");
  const [defaultPaperWidth, setDefaultPaperWidth] = useState<ThermalPaperWidth>("58");
  const [permission, requestPermission] = useCameraPermissions();
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    getDefaultPrinter().then((p) => setDefaultPaperWidth(p?.paperWidth ?? "58"));
  }, []);

  const handleScanBarcode = async () => {
    if (!permission) {
      return;
    }
    if (!permission.granted) {
      const perm = await requestPermission();
      if (!perm.granted) {
        Alert.alert("Permission Required", "Camera access is needed to scan barcodes.");
        return;
      }
    }
    setIsScanning(true);
  };

  const handleBarcodeScanned = ({ data }: { data: string }) => {
    setIsScanning(false);
    setProductSearch(data);
    const match = products.find(
      (p) => p.barcode === data || p.sku === data
    );
    if (match) {
      addToCart(match);
    } else {
      Alert.alert("Not Found", `No product found with barcode: ${data}`);
    }
  };

  // Search & Cart State
  const [productSearch, setProductSearch] = useState("");
  const [partySearch, setPartySearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState("");
  const [discountType, setDiscountType] = useState<"flat" | "percent">("flat");
  const [paymentMode, setPaymentMode] = useState<"cash" | "upi" | "credit">("cash");
  const [isSplitPayment, setIsSplitPayment] = useState(false);
  const [splitPayments, setSplitPayments] = useState<{ method: "cash" | "upi" | "credit"; amount: string }[]>([]);
  const [invoiceType, setInvoiceType] = useState<"gst" | "retail" | "estimate" | "bill_of_supply">("retail");
  const [applyRoundOff, setApplyRoundOff] = useState(true);
  const businessMode: "retail" | "b2b" = activeCompany?.business_mode === "b2b" ? "b2b" : "retail";
  const [cashCustomerId, setCashCustomerId] = useState<string | null>(null);
  // An estimate is normally tax-free (it's a quotation, not a bill yet), but
  // some customers want to see the GST-inclusive number before they commit
  // to the purchase — this opts a single estimate into real tax computation
  // without turning it into an actual GST invoice.
  const [estimateWithGst, setEstimateWithGst] = useState(false);
  // Extra charge added on top of the total — e.g. a credit/commission
  // surcharge when the customer wants to buy on credit terms. Shown whenever
  // Credit is the selected payment mode, but usable for any bill type.
  const [extraCharge, setExtraCharge] = useState("");
  // Due date — when selling on credit, the cashier picks a payment due
  // period (7/15/30/45/60 days) which sets dueDate on the invoice for
  // receivables tracking and aging reports.
  const CREDIT_PERIODS = [7, 15, 30, 45, 60] as const;
  const [creditPeriod, setCreditPeriod] = useState<number | null>(null);

  // Switching company-wide mode changes what a *new* bill defaults to.
  // Guarded by an empty cart so it never yanks the bill type out from under
  // an in-progress sale if the mode happens to change mid-session.
  useEffect(() => {
    if (cart.length > 0) return;
    setInvoiceType(businessMode === "b2b" ? "gst" : "retail");
  }, [businessMode]);

  // Reset the GST-on-estimate toggle whenever the bill type changes away
  // from estimate, so it doesn't silently carry over into a GST/retail bill.
  useEffect(() => {
    if (invoiceType !== "estimate") setEstimateWithGst(false);
  }, [invoiceType]);

  // Party Selector State
  const [selectedParty, setSelectedParty] = useState<Party | null>(null);
  const [isSelectingParty, setIsSelectingParty] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  // Add Customer State
  const [isAddingCustomer, setIsAddingCustomer] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [newCustomerState, setNewCustomerState] = useState("");
  const [addCustomerLoading, setAddCustomerLoading] = useState(false);

  // POS numpad state — tapping a cart item's quantity in landscape mode
  // opens a numeric keypad for quick entry instead of +/- buttons.
  const [qtyEditItemId, setQtyEditItemId] = useState<string | null>(null);
  const [qtyEditValue, setQtyEditValue] = useState("");

  // Keep screen awake during POS so it doesn't lock mid-sale.
  useKeepAwake();

  const [filterCategory, setFilterCategory] = useState("");
  const categories = useMemo(() => {
    const names = products.map(p => p.category?.name).filter(Boolean) as string[];
    return [...new Set(names)].sort();
  }, [products]);

  // Quick Add Product State — lets a cashier add a brand-new SKU mid-bill
  // instead of having to abandon the sale, go to Inventory, add it, and
  // come back to POS to start over.
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [newProductName, setNewProductName] = useState("");
  const [newProductPrice, setNewProductPrice] = useState("");
  const [newProductTax, setNewProductTax] = useState("18.00");
  const [newProductStock, setNewProductStock] = useState("");
  const [addProductLoading, setAddProductLoading] = useState(false);

  // Offline-aware state
  const [isOffline, setIsOffline] = useState(!getIsConnected());

  useEffect(() => {
    const unsub = subscribeToConnectivity(setIsOffline);
    return unsub;
  }, []);

  // Held Bills State
  const [heldBills, setHeldBills] = useState<any[]>([]);
  const [isHeldBillsOpen, setIsHeldBillsOpen] = useState(false);
  const [holdBillLoading, setHoldBillLoading] = useState(false);
  const [heldBillsLoading, setHeldBillsLoading] = useState(false);

  const loadHeldBills = async () => {
    setHeldBillsLoading(true);
    try {
      const res = await api.get<{ data: any[] }>("/pos/held-bills");
      setHeldBills(res.data ?? []);
    } catch (e) {
      console.error("Failed to load held bills:", e);
    } finally {
      setHeldBillsLoading(false);
    }
  };

  const handleHoldBill = async () => {
    if (cart.length === 0) return;
    setHoldBillLoading(true);
    try {
      await api.post("/pos/hold", {
        label: `${selectedParty?.name || "Walk-in"} · ${cart.length} item${cart.length > 1 ? "s" : ""}`,
        note: selectedParty?.name ? undefined : "Walk-in customer",
        party_id: selectedParty?.id,
        cart_data: {
          items: cart.map((c) => ({
            product_id: c.product.id,
            quantity: c.quantity,
            custom_tax_rate: c.customTaxRate,
            discount: c.discount,
          })),
          discount: discount || undefined,
          discount_type: discountType,
          invoice_type: invoiceType,
          payment_mode: paymentMode,
          extra_charge: extraCharge || undefined,
          estimate_with_gst: invoiceType === "estimate" ? estimateWithGst : undefined,
        },
      });
      setCart([]);
      setSelectedParty(null);
      setDiscount("");
      setDiscountType("flat");
      setExtraCharge("");
      setCreditPeriod(null);
      setEstimateWithGst(false);
      setIsSplitPayment(false);
      setSplitPayments([]);
      Alert.alert("Bill Parked", "The sale has been saved. You can resume it anytime from Held Bills.");
    } catch (e) {
      Alert.alert("Error", e instanceof ApiError ? e.message : "Failed to park bill.");
    } finally {
      setHoldBillLoading(false);
    }
  };

  const handleResumeBill = async (bill: any) => {
    const data = bill.cart_data;
    const items = data.items ?? [];
    if (items.length === 0) return;

    // Look up products to restore in cart
    const productIds = items.map((i: any) => i.product_id);
    const productsToAdd = products.filter((p) => productIds.includes(p.id));
    const restoredCart: CartItem[] = [];
    for (const item of items) {
      const product = productsToAdd.find((p) => p.id === item.product_id);
      if (product) {
        restoredCart.push({
          product,
          quantity: item.quantity,
          customTaxRate: item.custom_tax_rate,
          discount: item.discount || 0,
        });
      }
    }

    setCart(restoredCart);
    setDiscount(data.discount || "");
    setDiscountType(data.discount_type || "flat");
    setInvoiceType(data.invoice_type || "retail");
    setPaymentMode(data.payment_mode || "cash");
    setExtraCharge(data.extra_charge || "");
    setEstimateWithGst(data.estimate_with_gst || false);

    // Set customer if linked
    if (bill.party_id) {
      const party = parties.find((p) => p.id === bill.party_id);
      if (party) setSelectedParty(party);
    }

    // Delete the held bill after resuming
    try {
      await api.delete(`/pos/held-bills/${bill.id}`);
    } catch { /* best-effort */ }

    setHeldBills((prev) => prev.filter((b) => b.id !== bill.id));
    Alert.alert("Bill Resumed", `"${bill.label}" has been restored to your cart.`);
  };

  const handleDeleteHeldBill = async (bill: any) => {
    const ok = await confirmDelete({
      title: "Discard parked bill?",
      message: `"${bill.label}" will be permanently removed.`,
      confirmLabel: "Discard",
      destructive: true,
    });
    if (!ok) return;
    try {
      await api.delete(`/pos/held-bills/${bill.id}`);
      setHeldBills((prev) => prev.filter((b) => b.id !== bill.id));
    } catch (e) {
      Alert.alert("Error", e instanceof ApiError ? e.message : "Failed to delete.");
    }
  };

  // ── Numpad handlers — for quick quantity entry on POS touch screens ──
  const openQtyEdit = (itemId: string, currentQty: number) => {
    setQtyEditItemId(itemId);
    setQtyEditValue(String(currentQty));
  };

  const applyQtyEdit = () => {
    if (!qtyEditItemId) return;
    const qty = Math.max(1, parseInt(qtyEditValue, 10) || 1);
    setCart((prev) =>
      prev.map((item) =>
        item.product.id === qtyEditItemId ? { ...item, quantity: qty } : item
      )
    );
    setQtyEditItemId(null);
    setQtyEditValue("");
  };

  const cancelQtyEdit = () => {
    setQtyEditItemId(null);
    setQtyEditValue("");
  };

  const handleNumpadDigit = (digit: string) => {
    setQtyEditValue((prev) => {
      if (digit === "backspace") return prev.slice(0, -1) || "0";
      if (digit === "clear") return "0";
      const next = prev === "0" ? digit : prev + digit;
      return next.slice(0, 6); // max 6 digits
    });
  };

  const renderNumpad = () => {
    if (!qtyEditItemId) return null;
    const editingItem = cart.find((c) => c.product.id === qtyEditItemId);
    const keys = [
      ["7", "8", "9"],
      ["4", "5", "6"],
      ["1", "2", "3"],
      ["clear", "0", "backspace"],
    ];
    return (
      <View className="bg-surface-container-lowest dark:bg-surface-dark rounded-2xl border border-outline-variant dark:border-outline p-4 mt-3">
        <View className="flex-row justify-between items-center mb-3">
          <Text className="text-xs font-bold text-on-surface-variant uppercase tracking-widest flex-1 mr-2" numberOfLines={1}>
            {editingItem?.product.name || "Item"}
          </Text>
          <View className="flex-row items-center" style={{ gap: 8 }}>
            <Text className="text-2xl font-black text-primary dark:text-primary-dark">{qtyEditValue || "0"}</Text>
            <Pressable onPress={cancelQtyEdit} className="w-8 h-8 rounded-full bg-surface-container items-center justify-center">
              <MaterialCommunityIcons name="close" size={14} color="#6B7280" />
            </Pressable>
          </View>
        </View>
        {keys.map((row, ri) => (
          <View key={ri} className="flex-row" style={{ gap: 6, marginBottom: 6 }}>
            {row.map((key) => (
              <Pressable
                key={key}
                onPress={() => key === "backspace" || key === "clear" ? handleNumpadDigit(key) : handleNumpadDigit(key)}
                className="flex-1 h-12 rounded-xl items-center justify-center active:opacity-70"
                style={{ backgroundColor: key === "clear" ? "#FEE2E2" : key === "backspace" ? "#F3F4F6" : "#E5E7EB" }}
              >
                {key === "backspace" ? (
                  <MaterialCommunityIcons name="backspace-outline" size={20} color="#374151" />
                ) : key === "clear" ? (
                  <Text className="text-sm font-bold text-red-600">CLR</Text>
                ) : (
                  <Text className="text-xl font-black text-gray-800">{key}</Text>
                )}
              </Pressable>
            ))}
          </View>
        ))}
        <Pressable
          onPress={applyQtyEdit}
          className="bg-primary dark:bg-primary-dark py-3 rounded-xl items-center mt-1 active:opacity-90"
        >
          <Text className="text-white font-bold text-base">Apply</Text>
        </Pressable>
      </View>
    );
  };

  // ── Landscape product grid — large touchable cards in 3 columns ──
  const renderPosProductGrid = () => {
    if (loading) {
      return (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#0F7A5F" />
        </View>
      );
    }
    const items = filteredProducts;
    if (items.length === 0) {
      return (
        <View className="flex-1 justify-center items-center py-20">
          <Text className="text-on-surface-variant font-bold text-base text-center mb-3">No products found</Text>
        </View>
      );
    }
    // Render in rows of 3
    const rows: Product[][] = [];
    for (let i = 0; i < items.length; i += 3) {
      rows.push(items.slice(i, i + 3));
    }
    return (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }}>
        {rows.map((row, ri) => (
          <View key={ri} className="flex-row" style={{ gap: 8, marginBottom: 8 }}>
            {row.map((item) => {
              const inCart = cart.find((c) => c.product.id === item.id);
              return (
                <Pressable
                  key={item.id}
                  onPress={() => addToCart(item)}
                  className="flex-1 bg-surface-container-lowest dark:bg-surface-dark rounded-2xl border border-outline-variant dark:border-outline overflow-hidden active:opacity-80"
                  style={inCart ? { borderColor: "#0F7A5F", borderWidth: 2 } : undefined}
                >
                  <View className="p-3">
                    <Text numberOfLines={2} className="font-bold text-sm text-on-surface dark:text-text-primary-dark leading-snug min-h-[2.5em]">
                      {item.name}
                    </Text>
                    <View className="flex-row items-baseline mt-2" style={{ gap: 4 }}>
                      {item.mrp && parseFloat(item.mrp) > 0 && (
                        <Text className="text-xs text-on-surface-variant line-through">
                          ₹{parseFloat(item.mrp).toFixed(0)}
                        </Text>
                      )}
                      <Text className="font-black text-base text-primary dark:text-primary-dark">
                        ₹{parseFloat(item.price).toFixed(0)}
                      </Text>
                    </View>
                    {item.stock_quantity !== undefined && (
                      <Text className="text-xs text-on-surface-variant mt-1">Stk: {item.stock_quantity}</Text>
                    )}
                  </View>
                  {inCart && (
                    <View className="bg-primary/10 dark:bg-primary-dark/10 px-2 py-1 flex-row items-center justify-center" style={{ gap: 4 }}>
                      <MaterialCommunityIcons name="check-circle" size={12} color="#0F7A5F" />
                      <Text className="text-xs font-bold text-primary dark:text-primary-dark">{inCart.quantity}</Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
            {/* Fill empty slots with invisible views to maintain alignment */}
            {row.length < 3 && Array.from({ length: 3 - row.length }).map((_, i) => (
              <View key={`fill-${i}`} className="flex-1" />
            ))}
          </View>
        ))}
      </ScrollView>
    );
  };

  const fetchData = async () => {
    if (!user?.company_id) return;
    setLoading(true);
    try {
      // Fetch products
      const pRes = await api.get<{ data: Product[] }>("/products", {
        params: { brandId: activeBrand?.id },
      });
      setProducts(pRes.data ?? []);
      writeCache(getCacheKey("/products", { brandId: activeBrand?.id }), pRes.data ?? []);

      // Fetch parties (customers/clients)
      const ptRes = await api.get<{ data: Party[] }>("/parties", { params: { type: "customer" } });
      setParties(ptRes.data ?? []);
      writeCache(getCacheKey("/parties", { type: "customer" }), ptRes.data ?? []);

      // Resolve (or auto-create) a default warehouse so sales can deduct stock
      // without forcing every shop through a warehouse-setup step first.
      const whRes = await api.get<{ data: Warehouse[] }>("/warehouses");
      const warehouses = whRes.data ?? [];
      if (warehouses.length > 0) {
        setDefaultWarehouseId(warehouses[0].id);
      } else {
        const created = await api.post<{ data: Warehouse }>("/warehouses", { name: "Main Store" });
        setDefaultWarehouseId(created.data.id);
      }
    } catch (error) {
      console.warn("Failed to fetch POS data, trying cache...", error);
      const cachedProducts = await readCache<Product[]>(getCacheKey("/products", { brandId: activeBrand?.id }));
      if (cachedProducts) setProducts(cachedProducts);
      const cachedParties = await readCache<Party[]>(getCacheKey("/parties", { type: "customer" }));
      if (cachedParties) setParties(cachedParties);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user, activeBrand]);

  const handleAddCustomer = async () => {
    if (!newCustomerName) {
      Alert.alert("Required Fields", "Name is required.");
      return;
    }
    if (!user?.company_id) return;

    setAddCustomerLoading(true);
    try {
      const created = await api.post<{ data: Party }>("/parties", {
        name: newCustomerName,
        phone: newCustomerPhone || undefined,
        state: newCustomerState || undefined,
        type: "customer",
        current_balance: 0,
        opening_balance: 0,
      });

      const newCustomer = created.data;
      setParties((prev) => [newCustomer, ...prev]);
      setSelectedParty(newCustomer);
      setIsAddingCustomer(false);
      setIsSelectingParty(false); // Close selection modal

      resetAddCustomerForm();
      Alert.alert("Success", "Customer added and selected.");
    } catch (e) {
      Alert.alert("Error", e instanceof ApiError ? e.message : "Failed to add customer.");
    } finally {
      setAddCustomerLoading(false);
    }
  };

  const resetAddCustomerForm = () => {
    setNewCustomerName("");
    setNewCustomerPhone("");
    setNewCustomerState("");
  };

  const closeAddCustomer = async () => {
    const hasChanges =
      newCustomerName.trim() !== "" || newCustomerPhone.trim() !== "" || newCustomerState.trim() !== "";
    if (hasChanges) {
      const ok = await confirm({
        title: "Discard changes?",
        message: "You have unsaved changes. Are you sure you want to go back?",
        confirmLabel: "Discard",
        destructive: true,
      });
      if (!ok) return;
    }
    setIsAddingCustomer(false);
    resetAddCustomerForm();
  };

  const resetAddProductForm = () => {
    setNewProductName("");
    setNewProductPrice("");
    setNewProductTax("18.00");
    setNewProductStock("");
  };

  const closeAddProduct = async () => {
    const hasChanges =
      newProductName.trim() !== "" ||
      newProductPrice.trim() !== "" ||
      newProductStock.trim() !== "" ||
      newProductTax !== "18.00";
    if (hasChanges) {
      const ok = await confirm({
        title: "Discard changes?",
        message: "You have unsaved changes. Are you sure you want to go back?",
        confirmLabel: "Discard",
        destructive: true,
      });
      if (!ok) return;
    }
    setIsAddingProduct(false);
    resetAddProductForm();
  };

  const handleAddProduct = async () => {
    if (!newProductName.trim() || !newProductPrice) {
      Alert.alert("Required Fields", "Name and price are required.");
      return;
    }
    if (!user?.company_id) return;

    setAddProductLoading(true);
    try {
      const created = await api.post<{ data: Product }>("/products", {
        name: newProductName.trim(),
        brand_id: activeBrand?.id,
        price: parseFloat(newProductPrice),
        tax_rate: parseFloat(newProductTax || "0"),
        stock_quantity: parseFloat(newProductStock || "0"),
        status: "active",
      });

      const newProduct = created.data;
      setProducts((prev) => [newProduct, ...prev]);
      addToCart(newProduct);
      setIsAddingProduct(false);
      setProductSearch("");
      resetAddProductForm();
      Alert.alert("Success", "Product added and placed in the cart.");
    } catch (e) {
      Alert.alert("Error", e instanceof ApiError ? e.message : "Failed to add product.");
    } finally {
      setAddProductLoading(false);
    }
  };

  const addToCart = (product: Product) => {
    if (businessMode === "b2b" && !selectedParty) {
      setIsSelectingParty(true);
      return;
    }
    setCart((prevCart) => {
      const existing = prevCart.find((item) => item.product.id === product.id);
      if (existing) {
        return prevCart.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prevCart, { product, quantity: 1 }];
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart((prevCart) =>
      prevCart
        .map((item) => {
          if (item.product.id === productId) {
            const nextQty = item.quantity + delta;
            return { ...item, quantity: nextQty };
          }
          return item;
        })
        .filter((item) => item.quantity > 0)
    );
  };

  const applyCustomTaxRate = (productId: string, rate: string) => {
    setCart((prevCart) =>
      prevCart.map((item) => (item.product.id === productId ? { ...item, customTaxRate: rate || undefined } : item))
    );
    setGstEditProductId(null);
  };

  // Calculations
  const getSubtotal = () => {
    return cart.reduce((sum, item) => sum + parseFloat(item.product.price) * item.quantity, 0);
  };

  const getDiscountValue = () => {
    const val = parseFloat(discount || "0");
    if (val <= 0) return 0;
    if (discountType === "percent") {
      return Math.round((getSubtotal() * val) / 100);
    }
    return val;
  };

  // Per-sale override wins over the product's stored default — lets a
  // cashier fix the GST slab for this one bill without editing the product.
  const effectiveTaxRate = (item: CartItem): number =>
    parseFloat(item.customTaxRate ?? item.product.tax_rate ?? "18.00");

  // A GST invoice always computes tax; an estimate only does when the
  // customer explicitly wants a GST-inclusive quote; retail never does.
  const shouldApplyTax = invoiceType === "gst" || (invoiceType === "estimate" && estimateWithGst);

  const getTaxTotal = () => {
    if (!shouldApplyTax) return 0;
    return cart.reduce((sum, item) => {
      const price = parseFloat(item.product.price);
      const taxAmount = price * (effectiveTaxRate(item) / 100);
      return sum + taxAmount * item.quantity;
    }, 0);
  };

  const getExtraChargeValue = () => {
    const val = parseFloat(extraCharge || "0");
    return val > 0 ? val : 0;
  };

  const getTotal = () => {
    return Math.max(0, getSubtotal() + getTaxTotal() + getExtraChargeValue() - getDiscountValue());
  };

  // Retail mode allows checkout with no chosen customer — this resolves (or
  // lazily creates, once, then caches) a generic "Cash Customer" party so
  // the invoice still has a valid partyId without forcing the cashier
  // through full name/GSTIN entry for a walk-in sale. B2B mode keeps the
  // existing strict requirement untouched.
  const resolveCheckoutParty = async (): Promise<Party | null> => {
    if (selectedParty) return selectedParty;
    if (businessMode === "b2b") return null;

    const defaultCustomerName = activeCompany?.default_customer_name || "Cash Customer";

    if (cashCustomerId) {
      const cached = parties.find((p) => p.id === cashCustomerId);
      if (cached) return cached;
    }

    try {
      const existing = await api.get<{ data: Party[] }>("/parties", {
        params: { type: "customer", search: defaultCustomerName },
      });
      const found = (existing.data ?? []).find((p) => p.name === defaultCustomerName);
      if (found) {
        setCashCustomerId(found.id);
        return found;
      }
      const created = await api.post<{ data: Party }>("/parties", {
        name: defaultCustomerName,
        type: "customer",
        category: "b2c",
        current_balance: 0,
        opening_balance: 0,
      });
      setCashCustomerId(created.data.id);
      setParties((prev) => [created.data, ...prev]);
      return created.data;
    } catch {
      return null;
    }
  };

  const handleCheckout = async () => {
    if (cart.length === 0) {
      Alert.alert("Empty Cart", "Add items to the cart before checking out.");
      return;
    }
    const checkoutParty = await resolveCheckoutParty();
    if (!checkoutParty) {
      Alert.alert("No Customer", "Please select a customer before checking out.");
      return;
    }
    if (!user?.company_id || !defaultWarehouseId) {
      Alert.alert("Error", "Missing company or warehouse data. Cannot process.");
      return;
    }

    setCheckoutLoading(true);
    try {
      const subtotal = getSubtotal();
      const discountVal = getDiscountValue();
      const extraChargeVal = getExtraChargeValue();
      const total = getTotal();

      if (total < 0) {
        Alert.alert("Invalid Discount", "Discount cannot exceed the bill total.");
        setCheckoutLoading(false);
        return;
      }

      // The entire invoice + items + stock + ledger write happens atomically
      // server-side now — see shopkeeper-api/src/routes/pos.ts checkout.
      const hasCreditSplit = isSplitPayment && splitPayments.some((p) => p.method === "credit");
      const checkoutPayload = {
        party_id: checkoutParty.id,
        brand_id: activeBrand?.id,
        warehouse_id: defaultWarehouseId,
        type: invoiceType,
        payment_mode: isSplitPayment ? undefined : paymentMode,
        payments: isSplitPayment
          ? splitPayments
              .filter((p) => (parseFloat(p.amount) || 0) > 0)
              .map((p) => ({ method: p.method, amount: parseFloat(p.amount) }))
          : undefined,
        due_date: creditPeriod ? new Date(Date.now() + creditPeriod * 86400000).toISOString() : undefined,
        discount_total: discountVal,
        apply_gst: invoiceType === "estimate" ? estimateWithGst : undefined,
        apply_round_off: applyRoundOff,
        extra_charge_total: extraChargeVal,
        extra_charge_label: extraChargeVal > 0 && (hasCreditSplit || paymentMode === "credit") ? "Credit Charge" : undefined,
        items: cart.map((item) => ({
          product_id: item.product.id,
          quantity: item.quantity,
          price: parseFloat(item.product.price),
          tax_rate: shouldApplyTax ? effectiveTaxRate(item) : 0,
          discount: item.discount || 0,
        })),
      };

      let checkoutRes: {
        data: { invoice_number: string; cgst_total: string; sgst_total: string; igst_total: string };
      };
      try {
        checkoutRes = await api.post<{
          data: { invoice_number: string; cgst_total: string; sgst_total: string; igst_total: string };
        }>("/pos/checkout", checkoutPayload);
      } catch (checkoutError) {
        if (isNetworkFailure(checkoutError) && invoiceType !== "estimate") {
          // No invoice number is fabricated — GST requires the real one to
          // come from the server's atomic, gap-free sequence. The sale is
          // just held locally until connectivity returns.
          await enqueueSale(checkoutPayload);
          setCart([]);
          setSelectedParty(null);
          setIsCheckoutOpen(false);
          setDiscount("");
          setDiscountType("flat");
          setExtraCharge("");
          setIsSplitPayment(false);
          setSplitPayments([]);
          setCreditPeriod(null);
          setEstimateWithGst(false);
          Alert.alert(
            "Saved Offline",
            "No internet connection — this sale has been saved on your phone and will sync automatically once you're back online. The receipt can be printed after it syncs."
          );
          return;
        }
        throw checkoutError;
      }

      const invoiceNumber = checkoutRes.data.invoice_number;
      const gstSplit = {
        cgst: parseFloat(checkoutRes.data.cgst_total || "0"),
        sgst: parseFloat(checkoutRes.data.sgst_total || "0"),
        igst: parseFloat(checkoutRes.data.igst_total || "0"),
      };
      const invoiceDate = new Date().toLocaleDateString();
      const partyForInvoice = checkoutParty;

      const finishSale = () => {
        setCart([]);
        setSelectedParty(null);
        setIsCheckoutOpen(false);
        setDiscount("");
        setDiscountType("flat");
        setExtraCharge("");
        setIsSplitPayment(false);
        setSplitPayments([]);
        setCreditPeriod(null);
        setEstimateWithGst(false);
      };

      const buildReceiptData = (): ReceiptData => {
        const printItems = cart.map((item) => {
          const price = parseFloat(item.product.price);
          return {
            name: item.product.name,
            quantity: item.quantity,
            price: price,
            total: price * item.quantity,
          };
        });
        return {
          storeName: activeCompany?.name || "Merchant POS Store",
          storeAddress: activeCompany?.address,
          storePhone: activeCompany?.phone,
          gstNumber: activeCompany?.gstin,
          upiId: activeCompany?.upi_id || undefined,
          paperWidth: defaultPaperWidth,
          invoiceNumber,
          date: invoiceDate,
          invoiceType,
          items: printItems,
          subtotal,
          cgst: gstSplit.cgst,
          sgst: gstSplit.sgst,
          igst: gstSplit.igst,
          total,
          paymentMode,
          extraCharge: extraChargeVal,
          extraChargeLabel: extraChargeVal > 0 && paymentMode === "credit" ? "Credit Charge" : undefined,
        };
      };

      const buildReceiptHtml = () => generateReceiptHtml(buildReceiptData());

      const buildTallyHtml = () => {
        const tallyItems: TallyInvoiceItem[] = cart.map((item) => {
          const price = parseFloat(item.product.price);
          const taxRate = shouldApplyTax ? effectiveTaxRate(item) : 0;
          const lineSubtotal = price * item.quantity;
          return {
            name: item.product.name,
            hsnCode: item.product.hsn_code,
            quantity: item.quantity,
            price,
            taxRate,
            taxAmount: lineSubtotal * (taxRate / 100),
            total: lineSubtotal * (1 + taxRate / 100),
          };
        });
        return generateTallyInvoiceHtml({
          company: {
            name: activeCompany?.name || "Merchant POS Store",
            address: activeCompany?.address,
            phone: activeCompany?.phone,
            gstin: activeCompany?.gstin,
            state: activeCompany?.state,
            bankName: activeCompany?.bank_name,
            bankAccountNumber: activeCompany?.bank_account_number,
            bankIfsc: activeCompany?.bank_ifsc,
            upiId: activeCompany?.upi_id,
          },
          party: {
            name: partyForInvoice?.name || "Walk-in Customer",
            phone: partyForInvoice?.phone || undefined,
            gstin: partyForInvoice?.gstin || undefined,
            state: partyForInvoice?.state || undefined,
            category: partyForInvoice?.category || "b2c",
          },
          invoiceNumber,
          date: invoiceDate,
          invoiceType,
          items: tallyItems,
          subtotal,
          discountTotal: discountVal,
          cgst: gstSplit.cgst,
          sgst: gstSplit.sgst,
          igst: gstSplit.igst,
          total,
          paymentMode,
          extraCharge: extraChargeVal,
          extraChargeLabel: extraChargeVal > 0 && paymentMode === "credit" ? "Credit Charge" : undefined,
        });
      };

      // For the thermal format, prefer a direct raw print to a paired
      // Bluetooth/USB/Wi-Fi printer when one is set up (Printer Settings);
      // only fall back to the OS print dialog if no printer is paired or the
      // direct print fails (e.g. printer powered off, out of range).
      const printThermal = async () => {
        const saved = await getDefaultPrinter();
        if (saved) {
          try {
            await printToSavedPrinter(buildReceiptData(), saved);
            return;
          } catch (e: any) {
            Alert.alert("Printer Unreachable", `Could not reach ${saved.name}. Falling back to the system print dialog.`);
          }
        }
        await Print.printAsync({
          html: buildReceiptHtml(),
          width: thermalPageWidthPt(defaultPaperWidth),
          height: estimateThermalPageHeightPt(cart.length, !!activeCompany?.upi_id),
        });
      };

      const offerPrintOrShare = (formatLabel: string, buildHtml: () => string, isThermal: boolean) => {
        const thermalPageSize = isThermal
          ? { width: thermalPageWidthPt(defaultPaperWidth), height: estimateThermalPageHeightPt(cart.length, !!activeCompany?.upi_id) }
          : undefined;
        Alert.alert(formatLabel, `Invoice ${invoiceNumber} — what would you like to do?`, [
          {
            text: "Print",
            onPress: async () => {
              try {
                if (isThermal) {
                  await printThermal();
                } else {
                  await Print.printAsync({ html: buildHtml() });
                }
              } catch (e: any) {
                Alert.alert("Print Error", e.message || "Could not print invoice.");
              } finally {
                finishSale();
              }
            },
          },
          {
            text: "Share",
            onPress: async () => {
              try {
                await shareInvoiceFile(buildHtml(), `Invoice ${invoiceNumber}`, thermalPageSize);
              } catch (e: any) {
                Alert.alert("Share Error", e.message || "Could not share invoice.");
              } finally {
                finishSale();
              }
            },
          },
          { text: "Cancel", style: "cancel", onPress: finishSale },
        ]);
      };

      // Tally-style is only offered for GST invoices — a retail/estimate
      // bill (the default in Retail Mode) is a quick paper-slip sale and
      // only ever needs the thermal format, per how the two business modes
      // are defined.
      if (invoiceType === "gst") {
        Alert.alert(
          "Checkout Success",
          `Invoice ${invoiceNumber} created successfully! Choose an invoice format.`,
          [
            {
              text: "Tally Style Invoice",
              onPress: () => offerPrintOrShare("Tally Style Invoice", buildTallyHtml, false),
            },
            {
              text: "Thermal Receipt",
              onPress: () => offerPrintOrShare("Thermal Receipt", buildReceiptHtml, true),
            },
            { text: "New Sale", onPress: finishSale },
          ]
        );
      } else {
        offerPrintOrShare("Thermal Receipt", buildReceiptHtml, true);
      }
    } catch (error) {
      Alert.alert("Checkout Error", error instanceof ApiError ? error.message : "Failed to process checkout.");
    } finally {
      setCheckoutLoading(false);
    }
  };

  // Filter products by search bar input and category
  const filteredProducts = products.filter(
    (p) => {
      const matchesSearch = p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
        p.sku.toLowerCase().includes(productSearch.toLowerCase());
      const matchesCategory = !filterCategory || p.category?.name === filterCategory;
      return matchesSearch && matchesCategory;
    }
  );

  // Filter parties by search bar input
  const filteredParties = parties.filter(
    (p) =>
      p.name.toLowerCase().includes(partySearch.toLowerCase()) ||
      p.phone.includes(partySearch)
  );

  const BILL_TYPE_COLORS: Record<string, string> = {
    retail: "#6B21A8",
    gst:    "#0F7A5F",
    estimate: "#B45309",
    bill_of_supply: "#334155",
  };

  const activeBillColor = BILL_TYPE_COLORS[invoiceType];

  // ─────────────────────────────────────────────
  //  Product Card
  // ─────────────────────────────────────────────
  const renderProductCard = ({ item }: { item: Product }) => {
    const inCart = cart.find((c) => c.product.id === item.id);
    return (
      <Pressable
        onPress={() => addToCart(item)}
        className="bg-surface-container-lowest dark:bg-surface-dark rounded-2xl border border-outline-variant dark:border-outline mb-3 overflow-hidden active:opacity-80"
      >
        <View className="p-4">
          <View className="flex-row justify-between items-start">
            <View className="flex-1 mr-3">
              <Text numberOfLines={2} className="font-bold text-base text-on-surface dark:text-text-primary-dark leading-snug">
                {item.name}
              </Text>
              {item.sku ? (
                <Text className="text-xs text-on-surface-variant dark:text-text-secondary-dark font-semibold mt-1 uppercase tracking-wider">
                  SKU: {item.sku}
                </Text>
              ) : null}
            </View>
            <View className="items-end">
              <View className="flex-row items-center" style={{ gap: 4 }}>
                {item.mrp && parseFloat(item.mrp) > 0 && (
                  <Text className="text-xs text-on-surface-variant line-through">
                    ₹{parseFloat(item.mrp).toFixed(0)}
                  </Text>
                )}
                <Text className="font-black text-base text-primary dark:text-primary-dark">
                  ₹{parseFloat(item.price).toFixed(0)}
                </Text>
              </View>
              {item.mrp && parseFloat(item.mrp) > parseFloat(item.price) && (
                <Text className="text-[10px] text-green-600 font-semibold">
                  Save ₹{(parseFloat(item.mrp) - parseFloat(item.price)).toFixed(0)}
                </Text>
              )}
              {item.stock_quantity !== undefined && (
                <Text className="text-xs text-on-surface-variant mt-0.5">
                  Stock: {item.stock_quantity}
                </Text>
              )}
            </View>
          </View>
        </View>
        {inCart && (
          <View className="bg-primary/10 dark:bg-primary-dark/10 px-4 py-1.5 flex-row justify-between items-center">
            <Text className="text-xs font-bold text-primary dark:text-primary-dark">In cart</Text>
            <View className="flex-row items-center gap-3">
              <Pressable onPress={() => updateQuantity(item.id, -1)} className="w-7 h-7 rounded-full bg-primary dark:bg-primary-dark items-center justify-center">
                <MaterialCommunityIcons name="minus" size={14} color="white" />
              </Pressable>
              <Text className="text-primary dark:text-primary-dark font-black text-base min-w-[16px] text-center">{inCart.quantity}</Text>
              <Pressable onPress={() => updateQuantity(item.id, 1)} className="w-7 h-7 rounded-full bg-primary dark:bg-primary-dark items-center justify-center">
                <MaterialCommunityIcons name="plus" size={14} color="white" />
              </Pressable>
            </View>
          </View>
        )}
      </Pressable>
    );
  };

  // ─────────────────────────────────────────────
  //  Checkout Panel content (shared phone+tablet)
  // ─────────────────────────────────────────────
  const CheckoutPanel = (
    <>
      {/* Customer row — every bill is tied to either a named party or the
          configured default walk-in customer (resolveCheckoutParty), never
          left fully anonymous. */}
      <Pressable
        onPress={() => setIsSelectingParty(true)}
        className="bg-surface-container-lowest dark:bg-surface-dark rounded-2xl border border-dashed border-gray-300 dark:border-zinc-700 p-4 mb-5 flex-row justify-between items-center active:opacity-75"
      >
        <View className="flex-row items-center flex-1 mr-3">
          <View className="w-10 h-10 rounded-full bg-primary/10 dark:bg-primary-dark/10 items-center justify-center mr-3">
            <MaterialCommunityIcons name="account" size={20} color="#005f49" />
          </View>
          <View className="flex-1">
            <Text className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Customer</Text>
            <Text numberOfLines={1} className="text-base font-bold text-on-surface dark:text-text-primary-dark mt-0.5">
              {selectedParty ? selectedParty.name : "Tap to select →"}
            </Text>
          </View>
        </View>
        {selectedParty && (
          <View style={{ gap: 4 }}>
            <View className="bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded-lg flex-row items-center" style={{ gap: 3 }}>
              <MaterialCommunityIcons name="check-circle" size={12} color="#15803d" />
              <Text className="text-green-700 dark:text-green-400 text-xs font-bold">Set</Text>
            </View>
            {selectedParty.current_balance && parseFloat(selectedParty.current_balance) !== 0 && (
              <View className={`px-2 py-1 rounded-lg ${parseFloat(selectedParty.current_balance) > 0 ? "bg-red-50 dark:bg-red-950/20" : "bg-green-50 dark:bg-green-950/20"}`}>
                <Text className={`text-[10px] font-bold ${parseFloat(selectedParty.current_balance) > 0 ? "text-red-600" : "text-green-600"}`}>
                  ₹{Math.abs(parseFloat(selectedParty.current_balance)).toFixed(0)} {parseFloat(selectedParty.current_balance) > 0 ? "due" : "credit"}
                </Text>
              </View>
            )}
            {selectedParty.credit_limit != null && (
              <View className="px-2 py-1 rounded-lg bg-yellow-50 dark:bg-yellow-950/20">
                <Text className="text-[10px] font-bold text-yellow-700 dark:text-yellow-400">
                  Limit: ₹{Number(selectedParty.credit_limit).toFixed(0)}
                </Text>
              </View>
            )}
          </View>
        )}
      </Pressable>

      {/* Cart items */}
      {cart.length === 0 ? (
        <View className="items-center py-8">
          <MaterialCommunityIcons name="cart-outline" size={40} color="#6e7a74" style={{ marginBottom: 8 }} />
          <Text className="text-on-surface-variant dark:text-text-secondary-dark font-semibold text-sm">
            Add products from the left panel
          </Text>
        </View>
      ) : (
        <View className="mb-4">
          {cart.map((item) => (
            <View key={item.product.id} className="bg-surface-container-lowest dark:bg-surface-dark rounded-xl border border-outline-variant dark:border-outline px-4 py-3 mb-2">
              <View className="flex-row items-center">
                <View className="flex-1 mr-2">
                  <Text numberOfLines={1} className="font-bold text-sm text-on-surface dark:text-text-primary-dark">{item.product.name}</Text>
                  <View className="flex-row items-center" style={{ gap: 3 }}>
                    {item.product.mrp && parseFloat(item.product.mrp) > 0 && (
                      <Text className="text-[10px] text-on-surface-variant line-through">₹{parseFloat(item.product.mrp).toFixed(0)}</Text>
                    )}
                    <Text className="text-xs text-on-surface-variant">₹{parseFloat(item.product.price).toFixed(2)} each</Text>
                  </View>
                </View>
                <View className="flex-row items-center gap-2 mr-3">
                  <Pressable onPress={() => updateQuantity(item.product.id, -1)} className="w-7 h-7 rounded-full bg-surface-container items-center justify-center">
                    <MaterialCommunityIcons name="minus" size={14} color="#6e7a74" />
                  </Pressable>
                  <Text className="text-base font-black text-on-surface dark:text-text-primary-dark min-w-[20px] text-center">{item.quantity}</Text>
                  <Pressable onPress={() => updateQuantity(item.product.id, 1)} className="w-7 h-7 rounded-full bg-surface-container items-center justify-center">
                    <MaterialCommunityIcons name="plus" size={14} color="#6e7a74" />
                  </Pressable>
                </View>
                <Text className="font-black text-base text-primary dark:text-primary-dark min-w-[60px] text-right">
                  ₹{(parseFloat(item.product.price) * item.quantity).toFixed(0)}
                </Text>
              </View>
              <View className="flex-row items-center mt-2" style={{ gap: 8 }}>
                {shouldApplyTax && (
                  <Pressable
                    onPress={() => {
                      setGstEditProductId(item.product.id);
                      setGstEditValue(item.customTaxRate ?? item.product.tax_rate ?? "18");
                    }}
                    className="flex-row items-center bg-primary/10 px-2.5 py-1 rounded-lg"
                    style={{ gap: 4 }}
                  >
                    <MaterialCommunityIcons name="percent-outline" size={12} color="#0F7A5F" />
                    <Text className="text-xs font-bold text-primary dark:text-primary-dark">
                      GST {effectiveTaxRate(item)}% {item.customTaxRate ? "(custom)" : ""}
                    </Text>
                    <MaterialCommunityIcons name="pencil" size={11} color="#0F7A5F" />
                  </Pressable>
                )}
                <View className="flex-row items-center bg-surface-container rounded-lg" style={{ gap: 2 }}>
                  <TextInput
                    value={item.discount ? String(item.discount) : ""}
                    onChangeText={(val) => {
                      const discount = parseFloat(val) || 0;
                      setCart((prev) => prev.map((c) =>
                        c.product.id === item.product.id ? { ...c, discount } : c
                      ));
                    }}
                    placeholder="Disc"
                    placeholderTextColor="#9E9E9E"
                    keyboardType="numeric"
                    className="text-xs font-bold text-on-surface dark:text-text-primary-dark px-2 py-1 min-w-[40px]"
                  />
                  <Text className="text-[10px] text-on-surface-variant mr-1">off</Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* ── Bill Options ── */}
      <View className="bg-surface-container-lowest dark:bg-surface-dark rounded-2xl border border-outline-variant dark:border-outline p-4 mb-4">
        {/* Bill Type — 2x2 grid rather than 4-across: an icon + label
            ("Bill of Supply") doesn't fit in a quarter-width button on a
            360px-wide phone without clipping or wrapping awkwardly. */}
        <Text className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2">Bill Type</Text>
        <View className="flex-row flex-wrap mb-4" style={{ gap: 8 }}>
          {([
              { key: "retail",   label: "Retail", icon: "storefront-outline" },
              { key: "gst",      label: "GST",     icon: "file-document-outline" },
              { key: "estimate", label: "Estimate", icon: "note-edit-outline" },
              { key: "bill_of_supply", label: "Bill of Supply", icon: "file-outline" },
            ] as const).map((opt) => (
            <Pressable
              key={opt.key}
              onPress={() => setInvoiceType(opt.key as "gst" | "retail" | "estimate" | "bill_of_supply")}
              className={`flex-row items-center justify-center py-2.5 rounded-xl border ${
                invoiceType === opt.key
                  ? "border-transparent"
                  : "border-outline-variant dark:border-outline"
              }`}
              style={[{ width: "48%", gap: 6 }, invoiceType === opt.key ? { backgroundColor: activeBillColor } : undefined]}
            >
              <MaterialCommunityIcons
                name={opt.icon}
                size={16}
                color={invoiceType === opt.key ? "#FFFFFF" : "#6e7a74"}
              />
              <Text
                className={`text-xs font-bold ${invoiceType === opt.key ? "text-white" : "text-on-surface-variant dark:text-text-secondary-dark"}`}
                numberOfLines={1}
                style={{ flexShrink: 1 }}
              >
                {opt.key === "gst" ? t("gstBill") : opt.key === "estimate" ? t("estimate") : opt.key === "bill_of_supply" ? "Bill of Supply" : t("sales").split(" ")[0]}
              </Text>
            </Pressable>
          ))}
        </View>

        <Pressable
          onPress={() => setApplyRoundOff((v) => !v)}
          className={`flex-row items-center justify-between px-3 py-2.5 rounded-xl border mb-1 ${
            applyRoundOff ? "bg-primary/10 border-primary" : "border-outline-variant dark:border-outline"
          }`}
        >
          <Text className="text-xs font-bold text-on-surface dark:text-text-primary-dark">Round off total to nearest ₹1</Text>
          <MaterialCommunityIcons
            name={applyRoundOff ? "toggle-switch" : "toggle-switch-off-outline"}
            size={26}
            color={applyRoundOff ? "#0F7A5F" : "#9E9E9E"}
          />
        </Pressable>

        {/* An estimate is normally tax-free (it's a quotation), but some
            customers want to see the GST-inclusive number before committing. */}
        {invoiceType === "estimate" && (
          <Pressable
            onPress={() => setEstimateWithGst((v) => !v)}
            className={`flex-row items-center justify-between px-3 py-2.5 rounded-xl border mb-4 ${
              estimateWithGst ? "bg-primary/10 border-primary" : "border-outline-variant dark:border-outline"
            }`}
          >
            <View className="flex-row items-center" style={{ gap: 8 }}>
              <MaterialCommunityIcons name="percent-outline" size={16} color={estimateWithGst ? "#0F7A5F" : "#6e7a74"} />
              <Text className={`text-sm font-bold ${estimateWithGst ? "text-primary dark:text-primary-dark" : "text-on-surface-variant dark:text-text-secondary-dark"}`}>
                Include GST in this estimate
              </Text>
            </View>
            <MaterialCommunityIcons
              name={estimateWithGst ? "toggle-switch" : "toggle-switch-off-outline"}
              size={26}
              color={estimateWithGst ? "#0F7A5F" : "#9E9E9E"}
            />
          </Pressable>
        )}

        {/* Payment Mode — single or split */}
        <Text className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2">
          Payment {isSplitPayment ? "(Split)" : ""}
        </Text>
        {isSplitPayment ? (
          <View className="mb-4" style={{ gap: 8 }}>
            {splitPayments.map((sp, idx) => (
              <View key={idx} className="flex-row items-center" style={{ gap: 6 }}>
                <Pressable
                  onPress={() => {
                    const cycle = { cash: "upi" as const, upi: "credit" as const, credit: "cash" as const };
                    const updated = [...splitPayments];
                    updated[idx] = { ...sp, method: cycle[sp.method] };
                    setSplitPayments(updated);
                  }}
                  className="py-2 px-3 rounded-xl border border-outline-variant dark:border-outline flex-row items-center"
                  style={{ gap: 4 }}
                >
                  <MaterialCommunityIcons
                    name={sp.method === "cash" ? "cash" : sp.method === "upi" ? "cellphone" : "book-account-outline"}
                    size={16}
                    color="#0F7A5F"
                  />
                  <Text className="text-xs font-bold text-on-surface-variant capitalize">{sp.method}</Text>
                  <MaterialCommunityIcons name="chevron-down" size={14} color="#6B7280" />
                </Pressable>
                <TextInput
                  value={sp.amount}
                  onChangeText={(val) => {
                    const updated = [...splitPayments];
                    updated[idx] = { ...sp, amount: val };
                    setSplitPayments(updated);
                  }}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor="#A0A0A0"
                  className="flex-1 border border-outline-variant dark:border-outline rounded-xl px-3 py-2 text-right text-base font-bold bg-background dark:bg-bg-dark text-on-surface dark:text-text-primary-dark"
                />
                {splitPayments.length > 1 && (
                  <Pressable
                    onPress={() => setSplitPayments(splitPayments.filter((_, i) => i !== idx))}
                    className="w-8 h-8 rounded-full bg-error/10 items-center justify-center"
                  >
                    <MaterialCommunityIcons name="close" size={14} color="#D64545" />
                  </Pressable>
                )}
              </View>
            ))}
            <Pressable
              onPress={() => setSplitPayments([...splitPayments, { method: "cash", amount: "" }])}
              className="flex-row items-center justify-center py-2 rounded-xl border border-dashed border-outline-variant"
              style={{ gap: 4 }}
            >
              <MaterialCommunityIcons name="plus" size={14} color="#0F7A5F" />
              <Text className="text-xs font-bold text-primary">Add split payment</Text>
            </Pressable>
            <Text className="text-xs text-on-surface-variant text-right">
              Total: ₹{splitPayments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0).toFixed(0)} / ₹{getTotal().toFixed(0)}
            </Text>
          </View>
        ) : (
          <View className="flex-row gap-2 mb-4">
            {([
              { key: "cash",   label: "Cash",  icon: "cash" as const },
              { key: "upi",    label: "UPI",   icon: "cellphone" as const },
              { key: "credit", label: "Credit", icon: "book-account-outline" as const },
            ] as const).map((opt) => (
              <Pressable
                key={opt.key}
                onPress={() => {
                  setPaymentMode(opt.key);
                  if (opt.key !== "credit") setCreditPeriod(null);
                }}
                className={`flex-1 py-2.5 rounded-xl items-center border ${
                  paymentMode === opt.key
                    ? "bg-primary dark:bg-primary-dark border-primary"
                    : "border-outline-variant dark:border-outline"
                }`}
              >
                <MaterialCommunityIcons
                  name={opt.icon}
                  size={18}
                  color={paymentMode === opt.key ? "#FFFFFF" : "#6e7a74"}
                />
                <Text className={`text-xs font-bold mt-0.5 ${paymentMode === opt.key ? "text-white" : "text-on-surface-variant dark:text-text-secondary-dark"}`}>
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
        {paymentMode === "upi" && activeCompany?.upi_id && (
          <View className="mb-4 p-4 rounded-xl items-center bg-surface dark:bg-zinc-800 border border-outline-variant dark:border-zinc-700">
            <Text className="text-xs font-bold mb-2 text-primary">Scan to Pay via UPI</Text>
            {activeCompany?.upi_qr_url ? (
              <Image source={{ uri: activeCompany.upi_qr_url }} style={{ width: 140, height: 140 }} className="rounded-lg" />
            ) : (
              <View style={{ width: 140, height: 140 }} className="items-center justify-center rounded-lg bg-white border border-outline-variant">
                <MaterialCommunityIcons name="qrcode" size={48} color="#0f7a5f" />
                <Text className="text-[9px] text-center mt-1 px-2 text-on-surface-variant">Upload QR in Settings</Text>
              </View>
            )}
            <Text className="text-sm font-mono font-bold mt-2 text-text-primary">{activeCompany.upi_id}</Text>
            {activeCompany?.upi_payee_name && (
              <Text className="text-xs text-text-secondary">{activeCompany.upi_payee_name}</Text>
            )}
          </View>
        )}
        <Pressable
          onPress={() => {
            setIsSplitPayment(!isSplitPayment);
            if (!isSplitPayment) setSplitPayments([{ method: "cash", amount: "" }]);
          }}
          className="flex-row items-center mb-3"
          style={{ gap: 4 }}
        >
          <MaterialCommunityIcons
            name={isSplitPayment ? "toggle-switch" : "toggle-switch-off-outline"}
            size={18}
            color={isSplitPayment ? "#0F7A5F" : "#9E9E9E"}
          />
          <Text className={`text-xs font-semibold ${isSplitPayment ? "text-primary" : "text-on-surface-variant"}`}>
            Split payment
          </Text>
        </Pressable>

        {/* Discount — flat amount or percentage */}
        <View className="flex-row justify-between items-center mb-3">
          <View className="flex-row items-center" style={{ gap: 6 }}>
            <Text className="text-sm font-semibold text-on-surface-variant dark:text-text-secondary-dark">Discount</Text>
            <Pressable
              onPress={() => setDiscountType(discountType === "flat" ? "percent" : "flat")}
              className={`px-2 py-1 rounded-lg border ${discountType === "percent" ? "bg-primary/10 border-primary" : "border-outline-variant dark:border-outline"}`}
            >
              <Text className={`text-xs font-bold ${discountType === "percent" ? "text-primary" : "text-on-surface-variant"}`}>
                {discountType === "flat" ? "₹" : "%"}
              </Text>
            </Pressable>
          </View>
          <TextInput
            value={discount}
            onChangeText={setDiscount}
            keyboardType="numeric"
            placeholder="0"
            placeholderTextColor="#A0A0A0"
            className="border border-outline-variant dark:border-outline rounded-xl px-3 py-2 text-right text-base font-bold w-24 bg-background dark:bg-bg-dark text-on-surface dark:text-text-primary-dark"
          />
        </View>

        {/* A customer buying on credit sometimes gets an extra charge added
            on top (a commission/service charge) to cover the cost of
            offering credit — surfaced only when Credit is selected, but the
            field stays usable for any other one-off addition too. */}
        {paymentMode === "credit" && (
          <>
            {/* Credit Period — sets the due date for this invoice */}
            <View className="mb-3">
              <Text className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2">Payment Due In</Text>
              <View className="flex-row gap-2">
                {CREDIT_PERIODS.map((days) => (
                  <Pressable
                    key={days}
                    onPress={() => setCreditPeriod(creditPeriod === days ? null : days)}
                    className={`py-2 px-3 rounded-xl border ${
                      creditPeriod === days
                        ? "bg-primary dark:bg-primary-dark border-primary"
                        : "border-outline-variant dark:border-outline"
                    }`}
                  >
                    <Text className={`text-xs font-bold ${creditPeriod === days ? "text-white" : "text-on-surface-variant dark:text-text-secondary-dark"}`}>
                      {days} days
                    </Text>
                  </Pressable>
                ))}
              </View>
              {creditPeriod && (
                <Text className="text-xs text-on-surface-variant mt-1">
                  Due by {new Date(Date.now() + creditPeriod * 86400000).toLocaleDateString()}
                </Text>
              )}
            </View>
            <View className="flex-row justify-between items-center mb-3">
              <Text className="text-sm font-semibold text-on-surface-variant dark:text-text-secondary-dark">Credit Charge (₹)</Text>
              <TextInput
                value={extraCharge}
                onChangeText={setExtraCharge}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor="#A0A0A0"
                className="border border-outline-variant dark:border-outline rounded-xl px-3 py-2 text-right text-base font-bold w-24 bg-background dark:bg-bg-dark text-on-surface dark:text-text-primary-dark"
              />
            </View>
          </>
        )}
      </View>

      {/* ── Totals ── */}
      <View className="bg-surface-container-lowest dark:bg-surface-dark rounded-2xl border border-outline-variant dark:border-outline p-4 mb-4">
        <View className="flex-row justify-between mb-2">
          <Text className="text-sm text-on-surface-variant font-medium">Subtotal</Text>
          <Text className="text-sm font-semibold text-on-surface dark:text-text-primary-dark">₹{getSubtotal().toFixed(2)}</Text>
        </View>
        {shouldApplyTax && getTaxTotal() > 0 && (
          <View className="flex-row justify-between mb-2">
            <Text className="text-sm text-on-surface-variant font-medium">GST</Text>
            <Text className="text-sm font-semibold text-on-surface dark:text-text-primary-dark">+₹{getTaxTotal().toFixed(2)}</Text>
          </View>
        )}
        {getExtraChargeValue() > 0 && (
          <View className="flex-row justify-between mb-2">
            <Text className="text-sm text-on-surface-variant font-medium">Credit Charge</Text>
            <Text className="text-sm font-semibold text-on-surface dark:text-text-primary-dark">+₹{getExtraChargeValue().toFixed(2)}</Text>
          </View>
        )}
        {getDiscountValue() > 0 && (
          <View className="flex-row justify-between mb-2">
            <Text className="text-sm text-on-surface-variant font-medium">Discount</Text>
            <Text className="text-sm font-semibold text-red-500">−₹{getDiscountValue().toFixed(2)}</Text>
          </View>
        )}
        <View className="h-px bg-surface-container my-2" />
        <View className="flex-row justify-between items-center">
          <Text className="text-base font-bold text-on-surface dark:text-text-primary-dark">Total</Text>
          <Text className="text-2xl font-black text-primary dark:text-primary-dark">₹{getTotal().toFixed(2)}</Text>
        </View>
      </View>

      {/* Hold Bill button */}
      {cart.length > 0 && (
        <Pressable
          onPress={handleHoldBill}
          disabled={holdBillLoading}
          className="flex-row items-center justify-center py-3 rounded-2xl border border-outline-variant dark:border-outline mb-3 active:opacity-80"
          style={{ gap: 6 }}
        >
          {holdBillLoading ? (
            <ActivityIndicator size="small" color="#6B7280" />
          ) : (
            <>
              <MaterialCommunityIcons name="pause-circle-outline" size={18} color="#6B7280" />
              <Text className="text-sm font-bold text-on-surface-variant dark:text-text-secondary-dark">Park Bill</Text>
            </>
          )}
        </Pressable>
      )}

      {/* Checkout button */}
      <Pressable
        onPress={handleCheckout}
        disabled={checkoutLoading}
        className="rounded-2xl py-4 items-center shadow-sm active:opacity-90"
        style={{ backgroundColor: activeBillColor }}
      >
        {checkoutLoading ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text className="text-white font-black text-lg tracking-wide">
            {invoiceType === "estimate" ? "Save Estimate" : "Confirm Sale"} →
          </Text>
        )}
      </Pressable>
    </>
  );

  if (posView === "dashboard") {
    return (
      <View className="flex-1 bg-background dark:bg-bg-dark" style={{ paddingTop: topInset }}>
        <View className="px-4 pb-2 flex-row items-center justify-between">
          <Text className="text-2xl font-black text-on-surface dark:text-text-primary-dark">POS Dashboard</Text>
          <Pressable
            onPress={() => setPosView("sale")}
            className="flex-row items-center bg-primary dark:bg-primary-dark px-4 py-2 rounded-full"
            style={{ gap: 6 }}
          >
            <MaterialCommunityIcons name="plus" size={16} color="white" />
            <Text className="text-white text-sm font-bold">New Sale</Text>
          </Pressable>
        </View>
        <PosDashboardPanel />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background dark:bg-bg-dark">
      {isOffline && (
        <View className="bg-amber-500 px-4 py-2 flex-row items-center justify-center" style={{ gap: 6, paddingTop: topInset }}>
          <MaterialCommunityIcons name="wifi-off" size={14} color="white" />
          <Text className="text-white text-xs font-bold">You're offline — showing cached data</Text>
        </View>
      )}
      {isTablet ? (
        /* ══════ TABLET: side-by-side layout ══════ */
        <View className="flex-1 flex-row" style={{ paddingTop: topInset }}>
          {/* Left — product catalogue */}
          <View className="w-[58%] px-4">
            <View className="flex-row items-center gap-2 mb-1">
              <View className="w-1.5 h-5 rounded-full bg-primary" />
              <Text className="text-[10px] font-bold tracking-widest uppercase text-primary dark:text-primary-dark">Point of Sale</Text>
              {businessMode === "b2b" && (
                <View className="bg-primary/15 dark:bg-primary-dark/20 px-2 py-0.5 rounded-md">
                  <Text className="text-[9px] font-black text-primary dark:text-primary-dark tracking-widest">B2B</Text>
                </View>
              )}
            </View>
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-2xl font-black text-on-surface dark:text-text-primary-dark">Products</Text>
              <View className="flex-row items-center" style={{ gap: 8 }}>
                <Pressable
                  onPress={() => { loadHeldBills(); setIsHeldBillsOpen(true); }}
                  className="flex-row items-center bg-surface-container-lowest dark:bg-surface-dark border border-outline-variant dark:border-outline px-3 py-1.5 rounded-full"
                  style={{ gap: 5 }}
                >
                  <MaterialCommunityIcons name="pause-circle-outline" size={14} color="#3e4944" />
                  <Text className="text-sm font-bold text-on-surface dark:text-text-primary-dark">Held</Text>
                </Pressable>
                <Pressable
                  onPress={() => setPosView("dashboard")}
                  className="flex-row items-center bg-surface-container-lowest dark:bg-surface-dark border border-outline-variant dark:border-outline px-3 py-1.5 rounded-full"
                  style={{ gap: 5 }}
                >
                  <MaterialCommunityIcons name="chart-box-outline" size={14} color="#3e4944" />
                  <Text className="text-sm font-bold text-on-surface dark:text-text-primary-dark">Dashboard</Text>
                </Pressable>
                {cart.length > 0 && (
                  <View className="bg-primary/10 dark:bg-primary-dark/10 px-3 py-1 rounded-full">
                    <Text className="text-primary dark:text-primary-dark text-sm font-bold">{cart.reduce((s, i) => s + i.quantity, 0)} in cart</Text>
                  </View>
                )}
              </View>
            </View>
            <View className="bg-surface-container-lowest dark:bg-surface-dark border border-outline-variant dark:border-outline rounded-2xl px-4 py-3 mb-3 flex-row items-center">
              <MaterialCommunityIcons name="magnify" size={18} color="#3e4944" style={{ marginRight: 8 }} />
              <TextInput
                placeholder="Search by name or SKU..."
                placeholderTextColor="#A0A0A0"
                value={productSearch}
                onChangeText={setProductSearch}
                className="flex-1 text-base font-medium text-on-surface dark:text-text-primary-dark"
              />
              <Pressable onPress={handleScanBarcode} className="ml-2 w-8 h-8 items-center justify-center">
                <MaterialCommunityIcons name="barcode-scan" size={20} color="#0F7A5F" />
              </Pressable>
            </View>
            {categories.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3" contentContainerStyle={{ gap: 6, paddingHorizontal: 2 }}>
                <Pressable
                  onPress={() => setFilterCategory("")}
                  className={`px-3 py-1.5 rounded-full border ${!filterCategory ? "bg-primary dark:bg-primary-dark border-primary" : "border-outline-variant dark:border-outline bg-surface-container-lowest dark:bg-surface-dark"}`}
                >
                  <Text className={`text-xs font-bold ${!filterCategory ? "text-white" : "text-on-surface dark:text-text-primary-dark"}`}>All ({products.length})</Text>
                </Pressable>
                {categories.map((cat) => (
                  <Pressable
                    key={cat}
                    onPress={() => setFilterCategory(filterCategory === cat ? "" : cat)}
                    className={`px-3 py-1.5 rounded-full border ${filterCategory === cat ? "bg-primary dark:bg-primary-dark border-primary" : "border-outline-variant dark:border-outline bg-surface-container-lowest dark:bg-surface-dark"}`}
                  >
                    <Text className={`text-xs font-bold ${filterCategory === cat ? "text-white" : "text-on-surface dark:text-text-primary-dark"}`}>{cat}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}
            {isPosDevice ? (
              renderPosProductGrid()
            ) : loading ? (
              <View className="flex-1 justify-center items-center">
                <ActivityIndicator size="large" color="#0F7A5F" />
              </View>
            ) : (
              <FlatList
                data={filteredProducts}
                keyExtractor={(item) => item.id}
                renderItem={renderProductCard}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 16 }}
                ListEmptyComponent={
                  <View className="flex-1 justify-center items-center py-20">
                    <Text className="text-on-surface-variant font-bold text-base mb-3">No products found</Text>
                    <Pressable
                      onPress={() => {
                        setNewProductName(productSearch);
                        setIsAddingProduct(true);
                      }}
                      className="bg-primary dark:bg-primary-dark px-5 py-3 rounded-xl"
                    >
                      <Text className="text-white font-bold text-sm">+ Add "{productSearch || "New Product"}"</Text>
                    </Pressable>
                  </View>
                }
              />
            )}
          </View>

          {/* Right — checkout panel */}
          <View className="w-[42%] border-l border-outline-variant dark:border-outline px-4 pt-2">
            <View className="flex-row items-center gap-2 mb-4">
              <Text className="text-2xl font-black text-on-surface dark:text-text-primary-dark">Cart</Text>
              {businessMode === "b2b" && (
                <View className="bg-primary/15 dark:bg-primary-dark/20 px-2 py-0.5 rounded-md">
                  <Text className="text-[9px] font-black text-primary dark:text-primary-dark tracking-widest">B2B</Text>
                </View>
              )}
            </View>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 40 }}>
              {CheckoutPanel}
              {isPosDevice && renderNumpad()}
            </ScrollView>
          </View>
        </View>
      ) : (
        /* ══════ PHONE: product list + floating cart bar ══════ */
        <View className="flex-1" style={{ paddingTop: topInset }}>
          {/* Header */}
          <View className="px-5 mb-4">
            <View className="flex-row items-center gap-2 mb-2">
              <View className="w-1.5 h-6 rounded-full bg-primary" />
              <Text className="text-[10px] font-bold tracking-widest uppercase text-primary dark:text-primary-dark">Point of Sale</Text>
              {businessMode === "b2b" && (
                <View className="bg-primary/15 dark:bg-primary-dark/20 px-2 py-0.5 rounded-md">
                  <Text className="text-[9px] font-black text-primary dark:text-primary-dark tracking-widest">B2B</Text>
                </View>
              )}
            </View>
            <View className="flex-row justify-between items-center">
              <Text className="text-2xl font-black text-on-surface dark:text-text-primary-dark">New Sale</Text>
              <View className="flex-row items-center" style={{ gap: 8 }}>
                <Pressable
                  onPress={() => { loadHeldBills(); setIsHeldBillsOpen(true); }}
                  className="w-9 h-9 rounded-full bg-surface-container-lowest dark:bg-surface-dark border border-outline-variant dark:border-outline items-center justify-center"
                >
                  <MaterialCommunityIcons name="pause-circle-outline" size={16} color="#3e4944" />
                </Pressable>
                <Pressable
                  onPress={() => setPosView("dashboard")}
                  className="w-9 h-9 rounded-full bg-surface-container-lowest dark:bg-surface-dark border border-outline-variant dark:border-outline items-center justify-center"
                >
                  <MaterialCommunityIcons name="chart-box-outline" size={16} color="#3e4944" />
                </Pressable>
                {selectedParty && (
                  <Pressable onPress={() => setIsSelectingParty(true)} className="bg-primary/10 dark:bg-primary-dark/10 px-3 py-1.5 rounded-full flex-row items-center" style={{ gap: 4 }}>
                    <MaterialCommunityIcons name="account" size={14} color="#005f49" />
                    <Text className="text-primary dark:text-primary-dark text-sm font-bold">{selectedParty.name}</Text>
                    {selectedParty.current_balance && parseFloat(selectedParty.current_balance) !== 0 && (
                      <Text className={`text-[10px] font-bold ${parseFloat(selectedParty.current_balance) > 0 ? "text-red-500" : "text-green-600"}`}>
                        ₹{Math.abs(parseFloat(selectedParty.current_balance)).toFixed(0)}
                      </Text>
                    )}
                    {selectedParty.credit_limit != null && (
                      <Text className="text-[10px] font-bold text-yellow-600">
                        L:₹{Number(selectedParty.credit_limit).toFixed(0)}
                      </Text>
                    )}
                  </Pressable>
                )}
              </View>
            </View>
          </View>

          {/* Search */}
          <View className="px-5 mb-3">
            <View className="bg-surface-container-lowest dark:bg-surface-dark border border-outline-variant dark:border-outline rounded-2xl px-4 py-3 flex-row items-center">
              <MaterialCommunityIcons name="magnify" size={18} color="#3e4944" style={{ marginRight: 8 }} />
              <TextInput
                placeholder="Search products..."
                placeholderTextColor="#A0A0A0"
                value={productSearch}
                onChangeText={setProductSearch}
                className="flex-1 text-base font-medium text-on-surface dark:text-text-primary-dark"
              />
              <Pressable onPress={handleScanBarcode} className="ml-2 w-8 h-8 items-center justify-center">
                <MaterialCommunityIcons name="barcode-scan" size={20} color="#0F7A5F" />
              </Pressable>
            </View>
          </View>

          {/* Category chips */}
          {categories.length > 0 && (
            <View className="px-5 mb-3">
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                <Pressable
                  onPress={() => setFilterCategory("")}
                  className={`px-3 py-1.5 rounded-full border ${!filterCategory ? "bg-primary dark:bg-primary-dark border-primary" : "border-outline-variant dark:border-outline bg-surface-container-lowest dark:bg-surface-dark"}`}
                >
                  <Text className={`text-xs font-bold ${!filterCategory ? "text-white" : "text-on-surface dark:text-text-primary-dark"}`}>All ({products.length})</Text>
                </Pressable>
                {categories.map((cat) => (
                  <Pressable
                    key={cat}
                    onPress={() => setFilterCategory(filterCategory === cat ? "" : cat)}
                    className={`px-3 py-1.5 rounded-full border ${filterCategory === cat ? "bg-primary dark:bg-primary-dark border-primary" : "border-outline-variant dark:border-outline bg-surface-container-lowest dark:bg-surface-dark"}`}
                  >
                    <Text className={`text-xs font-bold ${filterCategory === cat ? "text-white" : "text-on-surface dark:text-text-primary-dark"}`}>{cat}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Product list */}
          <View className="flex-1 px-5">
            {loading ? (
              <View className="flex-1 justify-center items-center">
                <ActivityIndicator size="large" color="#0F7A5F" />
              </View>
            ) : (
              <FlatList
                data={filteredProducts}
                keyExtractor={(item) => item.id}
                renderItem={renderProductCard}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 16 }}
                ListEmptyComponent={
                  <View className="flex-1 justify-center items-center py-20">
                    <Text className="text-on-surface-variant font-bold text-base text-center mb-3">No products found</Text>
                    <Pressable
                      onPress={() => {
                        setNewProductName(productSearch);
                        setIsAddingProduct(true);
                      }}
                      className="bg-primary dark:bg-primary-dark px-5 py-3 rounded-xl"
                    >
                      <Text className="text-white font-bold text-sm">+ Add "{productSearch || "New Product"}"</Text>
                    </Pressable>
                  </View>
                }
              />
            )}
          </View>

          {/* Floating cart bar */}
          {cart.length > 0 && (
            <Pressable
              onPress={() => setIsCheckoutOpen(true)}
              className="mx-5 rounded-2xl px-5 py-4 flex-row justify-between items-center shadow-lg active:opacity-90"
              style={{ backgroundColor: activeBillColor, marginBottom: bottomInset }}
            >
              <View>
                <Text className="text-white/70 text-xs font-semibold uppercase tracking-wider">
                  {cart.reduce((s, i) => s + i.quantity, 0)} item{cart.reduce((s, i) => s + i.quantity, 0) !== 1 ? "s" : ""}
                </Text>
                <Text className="text-white font-black text-lg">₹{getTotal().toFixed(2)}</Text>
              </View>
              <View className="flex-row items-center gap-2">
                <Text className="text-white font-bold text-base">View Cart</Text>
                <MaterialCommunityIcons name="arrow-right" size={18} color="white" />
              </View>
            </Pressable>
          )}
        </View>
      )}

      {/* ══════ Checkout Sheet (phone only) ══════ */}
      {!isTablet && (
        <Modal visible={isCheckoutOpen} animationType="slide" onRequestClose={() => setIsCheckoutOpen(false)}>
          <SafeAreaProvider>
          <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View className="flex-1 bg-background dark:bg-bg-dark">
            {/* Sheet header */}
            <View className="px-5 pb-4 border-b border-outline-variant dark:border-outline flex-row justify-between items-center" style={{ paddingTop: topInset }}>
              <View>
                <Text className="text-2xl font-black text-on-surface dark:text-text-primary-dark">Checkout</Text>
                <Text className="text-sm text-on-surface-variant mt-0.5">{cart.reduce((s, i) => s + i.quantity, 0)} items · ₹{getTotal().toFixed(2)}</Text>
              </View>
              <Pressable onPress={() => setIsCheckoutOpen(false)} className="w-10 h-10 rounded-full bg-surface-container dark:bg-surface-dark items-center justify-center">
                <MaterialCommunityIcons name="close" size={18} color="#3e4944" />
              </Pressable>
            </View>
            <ScrollView className="flex-1 px-5 pt-5" showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: bottomInset + 24 }}>
              {CheckoutPanel}
            </ScrollView>
          </View>
          </KeyboardAvoidingView>
          </SafeAreaProvider>
        </Modal>
      )}

      {/* ══════ Select Customer Modal ══════ */}
      <Modal visible={isSelectingParty} animationType="slide" onRequestClose={() => setIsSelectingParty(false)}>
        <SafeAreaProvider>
        <View className="flex-1 bg-background dark:bg-bg-dark">
          <View className="px-5 pb-4 border-b border-outline-variant dark:border-outline flex-row justify-between items-center" style={{ paddingTop: topInset }}>
            <Text className="text-2xl font-black text-on-surface dark:text-text-primary-dark">Select Customer</Text>
            <Pressable onPress={() => setIsSelectingParty(false)} className="w-10 h-10 rounded-full bg-surface-container dark:bg-surface-dark items-center justify-center">
              <MaterialCommunityIcons name="close" size={18} color="#3e4944" />
            </Pressable>
          </View>

          <View className="px-5 pt-4 flex-row gap-2 mb-2">
            <View className="flex-1 bg-surface-container-lowest dark:bg-surface-dark border border-outline-variant dark:border-outline rounded-2xl px-4 py-3 flex-row items-center">
              <MaterialCommunityIcons name="magnify" size={18} color="#3e4944" style={{ marginRight: 8 }} />
              <TextInput
                placeholder="Search by name or phone..."
                placeholderTextColor="#A0A0A0"
                value={partySearch}
                onChangeText={setPartySearch}
                className="flex-1 text-base font-medium text-on-surface dark:text-text-primary-dark"
              />
            </View>
            <Pressable
              onPress={() => setIsAddingCustomer(true)}
              className="bg-primary dark:bg-primary-dark px-4 rounded-2xl items-center justify-center active:opacity-90"
            >
              <Text className="text-white font-black text-lg">+</Text>
            </Pressable>
          </View>

          <FlatList
            data={filteredParties}
            keyExtractor={(item) => item.id}
            className="px-5 pt-2"
            contentContainerStyle={{ paddingBottom: bottomInset }}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  setSelectedParty(item);
                  setIsSelectingParty(false);
                }}
                className="bg-surface-container-lowest dark:bg-surface-dark p-4 rounded-2xl border border-outline-variant dark:border-outline mb-3 flex-row justify-between items-center active:opacity-75"
              >
                <View>
                  <Text className="font-bold text-base text-on-surface dark:text-text-primary-dark">{item.name}</Text>
                  <Text className="text-sm text-on-surface-variant dark:text-text-secondary-dark mt-0.5">{item.phone || "No phone"}</Text>
                </View>
                <View className="bg-primary/10 dark:bg-primary-dark/10 px-3 py-1.5 rounded-full">
                  <Text className="text-primary dark:text-primary-dark text-sm font-bold">Select</Text>
                </View>
              </Pressable>
            )}
            ListEmptyComponent={
              <View className="flex-1 justify-center items-center py-20">
                <Text className="text-on-surface-variant font-bold text-base">No customers found</Text>
              </View>
            }
          />
        </View>
        </SafeAreaProvider>
      </Modal>

      {/* ══════ Add New Customer Modal ══════ */}
      <Modal visible={isAddingCustomer} animationType="slide" onRequestClose={closeAddCustomer}>
        <SafeAreaProvider>
        <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView className="flex-1 bg-background dark:bg-bg-dark px-5" style={{ paddingTop: topInset }} contentContainerStyle={{ paddingBottom: bottomInset + 24 }} keyboardShouldPersistTaps="handled">
          <View className="flex-row justify-between items-center mb-6">
            <Text className="text-2xl font-black text-on-surface dark:text-text-primary-dark">New Customer</Text>
            <Pressable onPress={closeAddCustomer} className="w-10 h-10 rounded-full bg-surface-container dark:bg-surface-dark items-center justify-center">
              <MaterialCommunityIcons name="close" size={18} color="#3e4944" />
            </Pressable>
          </View>

          <View className="space-y-4">
            <View>
              <Text className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2">Name *</Text>
              <TextInput
                value={newCustomerName}
                onChangeText={setNewCustomerName}
                placeholder="Customer Name"
                placeholderTextColor="#A0A0A0"
                className="bg-surface-container-lowest dark:bg-surface-dark text-on-surface dark:text-text-primary-dark border border-outline-variant dark:border-outline rounded-2xl px-4 py-4 text-base font-medium"
              />
            </View>
            <View className="mt-4">
              <Text className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2">Phone</Text>
              <TextInput
                value={newCustomerPhone}
                onChangeText={setNewCustomerPhone}
                placeholder="10-digit number"
                placeholderTextColor="#A0A0A0"
                keyboardType="phone-pad"
                className="bg-surface-container-lowest dark:bg-surface-dark text-on-surface dark:text-text-primary-dark border border-outline-variant dark:border-outline rounded-2xl px-4 py-4 text-base font-medium"
              />
            </View>
            <View className="mt-4">
              <Text className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2">State (for GST)</Text>
              <TextInput
                value={newCustomerState}
                onChangeText={setNewCustomerState}
                placeholder="e.g. Maharashtra"
                placeholderTextColor="#A0A0A0"
                className="bg-surface-container-lowest dark:bg-surface-dark text-on-surface dark:text-text-primary-dark border border-outline-variant dark:border-outline rounded-2xl px-4 py-4 text-base font-medium"
              />
            </View>
          </View>

          <View className="flex-row gap-3 mt-8">
            <Pressable
              onPress={closeAddCustomer}
              className="flex-1 border border-outline-variant dark:border-outline py-4 rounded-2xl items-center"
            >
              <Text className="text-on-surface-variant dark:text-text-secondary-dark font-bold text-base">Cancel</Text>
            </Pressable>
            <Pressable
              onPress={handleAddCustomer}
              disabled={addCustomerLoading}
              className="flex-1 bg-primary dark:bg-primary-dark py-4 rounded-2xl items-center"
            >
              {addCustomerLoading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white font-black text-base">Save & Select</Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
        </KeyboardAvoidingView>
        </SafeAreaProvider>
      </Modal>

      <Modal visible={isAddingProduct} animationType="slide" onRequestClose={closeAddProduct}>
        <SafeAreaProvider>
        <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView className="flex-1 bg-background dark:bg-bg-dark px-5" style={{ paddingTop: topInset }} contentContainerStyle={{ paddingBottom: bottomInset + 24 }} keyboardShouldPersistTaps="handled">
          <View className="flex-row justify-between items-center mb-6">
            <Text className="text-2xl font-black text-on-surface dark:text-text-primary-dark">New Product</Text>
            <Pressable onPress={closeAddProduct} className="w-10 h-10 rounded-full bg-surface-container dark:bg-surface-dark items-center justify-center">
              <MaterialCommunityIcons name="close" size={18} color="#3e4944" />
            </Pressable>
          </View>

          <Text className="text-sm text-on-surface-variant dark:text-text-secondary-dark mb-6">
            Adds this product to Inventory and puts it straight into the current cart. You can fill in SKU, barcode, and HSN code later from the Inventory tab.
          </Text>

          <View className="space-y-4">
            <View>
              <Text className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2">Name *</Text>
              <TextInput
                value={newProductName}
                onChangeText={setNewProductName}
                placeholder="Product Name"
                placeholderTextColor="#A0A0A0"
                className="bg-surface-container-lowest dark:bg-surface-dark text-on-surface dark:text-text-primary-dark border border-outline-variant dark:border-outline rounded-2xl px-4 py-4 text-base font-medium"
              />
            </View>
            <View className="mt-4">
              <Text className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2">Selling Price (INR) *</Text>
              <TextInput
                value={newProductPrice}
                onChangeText={setNewProductPrice}
                placeholder="0.00"
                placeholderTextColor="#A0A0A0"
                keyboardType="numeric"
                className="bg-surface-container-lowest dark:bg-surface-dark text-on-surface dark:text-text-primary-dark border border-outline-variant dark:border-outline rounded-2xl px-4 py-4 text-base font-medium"
              />
            </View>
            <View className="mt-4">
              <Text className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2">GST Tax Rate (%)</Text>
              <TextInput
                value={newProductTax}
                onChangeText={setNewProductTax}
                placeholder="18.00"
                placeholderTextColor="#A0A0A0"
                keyboardType="numeric"
                className="bg-surface-container-lowest dark:bg-surface-dark text-on-surface dark:text-text-primary-dark border border-outline-variant dark:border-outline rounded-2xl px-4 py-4 text-base font-medium"
              />
            </View>
            <View className="mt-4">
              <Text className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2">Opening Stock</Text>
              <TextInput
                value={newProductStock}
                onChangeText={setNewProductStock}
                placeholder="0"
                placeholderTextColor="#A0A0A0"
                keyboardType="numeric"
                className="bg-surface-container-lowest dark:bg-surface-dark text-on-surface dark:text-text-primary-dark border border-outline-variant dark:border-outline rounded-2xl px-4 py-4 text-base font-medium"
              />
            </View>
          </View>

          <View className="flex-row gap-3 mt-8">
            <Pressable
              onPress={closeAddProduct}
              className="flex-1 border border-outline-variant dark:border-outline py-4 rounded-2xl items-center"
            >
              <Text className="text-on-surface-variant dark:text-text-secondary-dark font-bold text-base">Cancel</Text>
            </Pressable>
            <Pressable
              onPress={handleAddProduct}
              disabled={addProductLoading}
              className="flex-1 bg-primary dark:bg-primary-dark py-4 rounded-2xl items-center"
            >
              {addProductLoading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white font-black text-base">Save & Add to Cart</Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
        </KeyboardAvoidingView>
        </SafeAreaProvider>
      </Modal>

      {/* Per-item GST override */}
      <Modal
        visible={gstEditProductId !== null}
        animationType="fade"
        transparent
        onRequestClose={() => setGstEditProductId(null)}
      >
        <Pressable className="flex-1 bg-black/40 justify-end" onPress={() => setGstEditProductId(null)}>
          <Pressable className="bg-background dark:bg-bg-dark rounded-t-3xl px-6 pt-6" style={{ paddingBottom: bottomInset + 24 }}>
            <Text className="text-lg font-bold text-on-surface dark:text-text-primary-dark mb-1">GST Rate for this bill</Text>
            <Text className="text-sm text-on-surface-variant dark:text-text-secondary-dark mb-4">
              Only changes this item on this sale — the product's saved GST rate stays the same.
            </Text>
            <GstRatePicker value={gstEditValue} onChange={setGstEditValue} />
            <Pressable
              onPress={() => gstEditProductId && applyCustomTaxRate(gstEditProductId, gstEditValue)}
              className="bg-primary dark:bg-primary-dark py-4 rounded-xl items-center mt-5"
            >
              <Text className="text-white font-bold text-base">Apply</Text>
            </Pressable>
          </Pressable>
        </Pressable>
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

      {/* Held Bills Modal */}
      <Modal visible={isHeldBillsOpen} animationType="slide" onRequestClose={() => setIsHeldBillsOpen(false)}>
        <SafeAreaProvider>
        <View className="flex-1 bg-background dark:bg-bg-dark px-5" style={{ paddingTop: topInset, paddingBottom: bottomInset }}>
          <View className="flex-row justify-between items-center mb-6">
            <Text className="text-2xl font-black text-on-surface dark:text-text-primary-dark">Parked Bills</Text>
            <Pressable onPress={() => setIsHeldBillsOpen(false)} className="w-10 h-10 rounded-full bg-surface-container dark:bg-surface-dark items-center justify-center">
              <MaterialCommunityIcons name="close" size={18} color="#3e4944" />
            </Pressable>
          </View>

          {heldBillsLoading ? (
            <View className="flex-1 justify-center items-center">
              <ActivityIndicator size="large" color="#0F7A5F" />
            </View>
          ) : heldBills.length === 0 ? (
            <View className="flex-1 justify-center items-center">
              <MaterialCommunityIcons name="pause-circle-outline" size={64} color="#D0D0D0" />
              <Text className="text-on-surface-variant dark:text-text-secondary-dark text-base mt-4">No parked bills</Text>
            </View>
          ) : (
            <FlatList
              data={heldBills}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingBottom: 24 }}
              ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
              renderItem={({ item }) => (
                <View className="bg-surface dark:bg-surface-dark border border-outline-variant dark:border-outline rounded-2xl px-4 py-4">
                  <View className="flex-row justify-between items-start mb-2">
                    <View className="flex-1 mr-3">
                      <Text className="text-base font-bold text-on-surface dark:text-text-primary-dark" numberOfLines={1}>{item.label}</Text>
                      {item.note ? <Text className="text-xs text-on-surface-variant dark:text-text-secondary-dark mt-1">{item.note}</Text> : null}
                    </View>
                    <Text className="text-xs text-on-surface-variant dark:text-text-secondary-dark">
                      {new Date(item.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </Text>
                  </View>
                  <View className="flex-row" style={{ gap: 8 }}>
                    <Pressable
                      onPress={() => { setIsHeldBillsOpen(false); handleResumeBill(item); }}
                      className="flex-1 flex-row items-center justify-center bg-primary dark:bg-primary-dark py-3 rounded-xl active:opacity-90"
                      style={{ gap: 5 }}
                    >
                      <MaterialCommunityIcons name="play-circle-outline" size={16} color="white" />
                      <Text className="text-white font-bold text-sm">Resume</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => handleDeleteHeldBill(item)}
                      className="w-12 h-11 rounded-xl border border-outline-variant dark:border-outline items-center justify-center active:opacity-80"
                    >
                      <MaterialCommunityIcons name="delete-outline" size={18} color="#EF4444" />
                    </Pressable>
                  </View>
                </View>
              )}
            />
          )}
        </View>
        </SafeAreaProvider>
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
