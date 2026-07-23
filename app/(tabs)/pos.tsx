import React, { useState, useEffect, useMemo, useRef } from "react";
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
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "react-native-paper";
import { generateReceiptHtml, ReceiptData, thermalPageWidthPt, estimateThermalPageHeightPt, ThermalPaperWidth } from "../../src/lib/printer";
import { generateTallyInvoiceHtml, TallyInvoiceItem } from "../../src/lib/invoiceTemplate";
import { shareInvoiceFile } from "../../src/lib/sharer";
import { printToSavedPrinter, getDefaultPrinter, openCashDrawer } from "../../src/lib/thermalPrinter";
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
import { verifyPin } from "../../src/lib/pin";

// Indian lakh/crore grouping — shopkeeper-mobile-design-system.md §3.1.
// Money is what this screen is for; formatting it the way a shopkeeper
// actually reads it (₹1,20,000, not ₹120,000) applies everywhere on POS.
// `decimals` defaults to 0 (catalogue/unit prices, which were whole-rupee
// before); checkout totals pass 2 to preserve exact paise owed — rounding
// those to whole rupees would silently disagree with the printed receipt.
function formatRupee(n: number, decimals: 0 | 2 = 0): string {
 const val = Number.isFinite(n) ? n : 0;
 return `₹${val.toLocaleString("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

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
 tracks_serials?: boolean;
 sell_by_weight?: boolean;
 weight_unit?: string;
 price_per_unit?: string;
 has_alternate_pricing?: boolean;
 alternate_price?: string;
 alternate_unit?: string;
 default_billing_mode?: "fixed" | "weight";
 is_returnable_container?: boolean;
 container_deposit?: string;
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
 // Comma/newline-separated serial numbers, only meaningful when
 // product.tracks_serials — mirrors the web POS pattern.
 serialNumbers?: string;
 billingMode?: "fixed" | "weight";
}

export default function PosScreen() {
 const theme = useTheme();
 const { user, activeCompany, activeBrand } = useAuth();
 const pinVerifiedRef = useRef(false);
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
 // Set alongside creditPeriod, in the same event handler — "N days from
 // now" is inherently a function of the current time, so there's no pure
 // way to derive it during render; computing it where the period is
 // actually picked (an event handler, not render) is the correct place
 // for that impure Date read.
 const [creditDueDateLabel, setCreditDueDateLabel] = useState("");

 // Switching company-wide mode changes what a *new* bill defaults to.
 // Guarded by an empty cart so it never yanks the bill type out from under
 // an in-progress sale if the mode happens to change mid-session. Respects
 // Settings > Billing & Printing's "Default Invoice Type" (already honored
 // by the web POS) when it's set and valid for the current business mode —
 // b2b shops always start GST regardless, since retail/estimate defaults
 // wouldn't make sense there.
 useEffect(() => {
 if (cart.length > 0) return;
 const configured = activeCompany?.default_invoice_type as typeof invoiceType | undefined;
 if (businessMode === "b2b") {
 setInvoiceType("gst");
 } else if (configured && ["gst", "retail", "estimate", "bill_of_supply"].includes(configured)) {
 setInvoiceType(configured);
 } else {
 setInvoiceType("retail");
 }
 }, [businessMode, activeCompany?.default_invoice_type]);

 // Reset the GST-on-estimate toggle whenever the bill type changes away
 // from estimate, so it doesn't silently carry over into a GST/retail bill.
 useEffect(() => {
 if (invoiceType !== "estimate") setEstimateWithGst(false);
 }, [invoiceType]);

 // Settings > Billing & Printing's "Default Payment Mode" and "Default
 // Discount Type" — same empty-cart guard as invoiceType above, so a
 // setting change never yanks values out from under an in-progress sale.
 useEffect(() => {
 if (cart.length > 0) return;
 const mode = activeCompany?.default_payment_mode as typeof paymentMode | undefined;
 if (mode && ["cash", "upi", "credit"].includes(mode)) setPaymentMode(mode);
 }, [activeCompany?.default_payment_mode]);

 useEffect(() => {
 if (cart.length > 0) return;
 const dType = activeCompany?.discount_default_type as typeof discountType | undefined;
 if (dType && ["flat", "percent"].includes(dType)) setDiscountType(dType);
 }, [activeCompany?.discount_default_type]);

 useEffect(() => {
 if (cart.length > 0) return;
 if (typeof activeCompany?.apply_round_off_default === "boolean") setApplyRoundOff(activeCompany.apply_round_off_default);
 }, [activeCompany?.apply_round_off_default]);

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

 // PIN-gated checkout — when activeCompany.require_pos_pin is true,
 // the cashier must re-enter their Quick PIN before every sale.
 const [showPinModal, setShowPinModal] = useState(false);
 const [pinInput, setPinInput] = useState("");
 const [pinError, setPinError] = useState("");

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
 billing_mode: c.billingMode,
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
 pinVerifiedRef.current = false;
 setSelectedParty(null);
 setDiscount("");
 setDiscountType("flat");
 setExtraCharge("");
 setCreditPeriod(null);
 setCreditDueDateLabel("");
 setEstimateWithGst(false);
 setIsSplitPayment(false);
 setSplitPayments([]);
 // Leftover search text/inline-edit state from before parking made the
 // screen look "stuck" on the old bill instead of returning to a clean
 // POS screen — same class of gap as handleCheckout's finishSale below.
 setProductSearch("");
 setPartySearch("");
 setQtyEditItemId(null);
 setGstEditProductId(null);
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
 billingMode: item.billing_mode,
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
 setProductSearch("");
 setPartySearch("");
 setQtyEditItemId(null);
 setGstEditProductId(null);

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
 <View className="bg-surface-container-lowest rounded-2xl border border-outline-variant p-4 mt-3">
 <View className="flex-row justify-between items-center mb-3">
 <Text className="text-xs font-bold text-on-surface-variant uppercase tracking-widest flex-1 mr-2" numberOfLines={1}>
 {editingItem?.product.name || "Item"}
 </Text>
 <View className="flex-row items-center" style={{ gap: 8 }}>
 <Text className="text-2xl font-black text-primary">{qtyEditValue || "0"}</Text>
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
 className="bg-primary py-3 rounded-xl items-center mt-1 active:opacity-90"
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
 <ActivityIndicator size="large" color={theme.colors.primary} />
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
 className="flex-1 bg-surface-container-lowest rounded-2xl border border-outline-variant overflow-hidden active:opacity-80"
 style={inCart ? { borderColor: theme.colors.primary, borderWidth: 2 } : undefined}
 >
 <View className="p-3">
 <Text numberOfLines={2} className="font-bold text-sm text-on-surface leading-snug min-h-[2.5em]">
 {item.name}
 </Text>
 <View className="flex-row items-baseline mt-2" style={{ gap: 4 }}>
 {item.mrp && parseFloat(item.mrp) > 0 && (
 <Text className="text-xs text-on-surface-variant line-through">
 {formatRupee(parseFloat(item.mrp))}
 </Text>
 )}
 {item.has_alternate_pricing ? (
 <View className="flex-col items-start">
 <Text className="font-bold text-sm text-primary">
 {formatRupee(parseFloat(item.alternate_price ?? item.price))}/{item.alternate_unit || "pkt"}
 </Text>
 <Text className="text-[10px] font-bold text-on-surface-variant">
 {formatRupee(parseFloat(item.price_per_unit ?? item.price))}/{item.weight_unit || "kg"}
 </Text>
 </View>
 ) : item.mrp && parseFloat(item.mrp) > 0 ? (
 <View className="flex-col items-start">
 <Text className="font-bold text-sm text-primary">
 {formatRupee(parseFloat(item.mrp))}{item.sell_by_weight ? `/${item.weight_unit || "kg"}` : ""}
 </Text>
 {parseFloat(item.price) < parseFloat(item.mrp) && (
 <Text className="text-[10px] text-on-surface-variant line-through">
 {formatRupee(parseFloat(item.price))}
 </Text>
 )}
 </View>
 ) : (
 <Text className="font-black text-base text-primary">
 {formatRupee(parseFloat(item.price))}{item.sell_by_weight ? `/${item.weight_unit || "kg"}` : ""}
 </Text>
 )}
 </View>
 {item.stock_quantity !== undefined && (
 <Text className="text-xs text-on-surface-variant mt-1">Stk: {item.stock_quantity}</Text>
 )}
 {item.is_returnable_container && item.container_deposit && parseFloat(item.container_deposit) > 0 && (
 <Text className="text-[9px] font-bold text-purple-600 mt-1">+{formatRupee(parseFloat(item.container_deposit))} deposit</Text>
 )}
 </View>
 {inCart && (
 <View className="bg-primary/10 px-2 py-1 flex-row items-center justify-center" style={{ gap: 4 }}>
 <MaterialCommunityIcons name="check-circle" size={12} color={theme.colors.primary} />
 <Text className="text-xs font-bold text-primary">
 {inCart.quantity}{inCart.billingMode === "weight" ? ` ${item.weight_unit || "kg"}` : inCart.billingMode === "fixed" ? ` ${item.alternate_unit || "pkt"}` : ""}
 </Text>
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

 const unitPriceFor = (item: CartItem): number => {
 if (item.billingMode === "fixed") return parseFloat(item.product.alternate_price ?? item.product.price);
 if (item.billingMode === "weight") return parseFloat(item.product.price_per_unit ?? item.product.price);
 const mrp = parseFloat(item.product.mrp ?? "0");
 if (mrp > 0) return mrp;
 return parseFloat(item.product.price);
 };

 const lineTotal = (item: CartItem): number => unitPriceFor(item) * item.quantity;

 const addToCart = (product: Product) => {
 if (businessMode === "b2b" && !selectedParty) {
 setIsSelectingParty(true);
 return;
 }
 setCart((prevCart) => {
 const existing = prevCart.find((item) => item.product.id === product.id);
 if (existing) {
 if (product.sell_by_weight && !product.has_alternate_pricing) return prevCart;
 return prevCart.map((item) =>
 item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
 );
 }
 const billingMode = product.has_alternate_pricing ? (product.default_billing_mode || "weight") : product.sell_by_weight ? "weight" : undefined;
 return [...prevCart, { product, quantity: billingMode === "weight" ? 0 : 1, billingMode }];
 });
 };

 const updateQuantity = (productId: string, delta: number) => {
 setCart((prevCart) =>
 prevCart
 .map((item) => {
 if (item.product.id === productId) {
 if (item.billingMode === "weight") return item;
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

 const getDepositTotal = () => {
 return cart.reduce((sum, item) => {
 if (item.product.is_returnable_container && item.product.container_deposit) {
 return sum + parseFloat(item.product.container_deposit) * item.quantity;
 }
 return sum;
 }, 0);
 };

 // Calculations
 const getSubtotal = () => {
 return cart.reduce((sum, item) => sum + lineTotal(item), 0);
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
 const price = unitPriceFor(item);
 const taxAmount = price * (effectiveTaxRate(item) / 100);
 return sum + taxAmount * item.quantity;
 }, 0);
 };

 const getExtraChargeValue = () => {
 const val = parseFloat(extraCharge || "0");
 return val > 0 ? val : 0;
 };

 const getTotal = () => {
 return Math.max(0, getSubtotal() + getTaxTotal() + getDepositTotal() + getExtraChargeValue() - getDiscountValue());
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

 const verifyPinAndProceed = async () => {
 if (!user?.id) return;
 const ok = await verifyPin(user.id, pinInput);
 if (!ok) {
 setPinError("Incorrect PIN. Try again.");
 return;
 }
 setShowPinModal(false);
 setPinInput("");
 setPinError("");
 pinVerifiedRef.current = true;
 handleCheckout();
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

 if (activeCompany?.require_pos_pin && !pinVerifiedRef.current) {
 setPinInput("");
 setPinError("");
 setShowPinModal(true);
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
const dueDate = creditPeriod ? new Date(Date.now() + creditPeriod * 86400000).toISOString() : undefined;
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
due_date: dueDate,
 discount_total: discountVal,
 apply_gst: invoiceType === "estimate" ? estimateWithGst : undefined,
 apply_round_off: applyRoundOff,
 extra_charge_total: extraChargeVal + getDepositTotal(),
 extra_charge_label: getDepositTotal() > 0 ? "Crate Deposit" : (extraChargeVal > 0 && (hasCreditSplit || paymentMode === "credit") ? "Credit Charge" : undefined),
 items: cart.map((item) => ({
 product_id: item.product.id,
 quantity: item.quantity,
 price: unitPriceFor(item),
 tax_rate: shouldApplyTax ? effectiveTaxRate(item) : 0,
 discount: item.discount || 0,
 serial_numbers: item.serialNumbers
 ? item.serialNumbers.split(/[\n,]/).map((s) => s.trim()).filter(Boolean)
 : undefined,
 billing_mode: item.billingMode,
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
 pinVerifiedRef.current = false;
 setSelectedParty(null);
 setIsCheckoutOpen(false);
 setDiscount("");
 setDiscountType("flat");
 setExtraCharge("");
 setIsSplitPayment(false);
 setSplitPayments([]);
 setCreditPeriod(null);
 setCreditDueDateLabel("");
 setEstimateWithGst(false);
 setProductSearch("");
 setPartySearch("");
 setQtyEditItemId(null);
 setGstEditProductId(null);
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
 pinVerifiedRef.current = false;
 setSelectedParty(null);
 setIsCheckoutOpen(false);
 setDiscount("");
 setDiscountType("flat");
 setExtraCharge("");
 setIsSplitPayment(false);
 setSplitPayments([]);
 setCreditPeriod(null);
 setCreditDueDateLabel("");
 setEstimateWithGst(false);
 setProductSearch("");
 setPartySearch("");
 setQtyEditItemId(null);
 setGstEditProductId(null);
 };

 const buildReceiptData = (): ReceiptData => {
 const printItems = cart.map((item) => {
 const price = unitPriceFor(item);
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
 const price = unitPriceFor(item);
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
 gst: "#0368FE",
 estimate: "#B45309",
 bill_of_supply: "#334155",
 };

 const activeBillColor = BILL_TYPE_COLORS[invoiceType];
 // Darkens activeBillColor for a gradient second stop on the checkout CTAs
 // — real gradient, not a flat fill, per feedback_ui_visual_quality.md.
 const activeBillColorDark = (() => {
 const num = parseInt(activeBillColor.replace("#", ""), 16);
 const r = Math.max(0, Math.floor(((num >> 16) & 0xff) * 0.62));
 const g = Math.max(0, Math.floor(((num >> 8) & 0xff) * 0.62));
 const b = Math.max(0, Math.floor((num & 0xff) * 0.62));
 return `rgb(${r}, ${g}, ${b})`;
 })();

 // ─────────────────────────────────────────────
 // Product Card
 // ─────────────────────────────────────────────
 const renderProductCard = ({ item }: { item: Product }) => {
 const inCart = cart.find((c) => c.product.id === item.id);
 return (
 <Pressable
 onPress={() => addToCart(item)}
 className="bg-surface-container-lowest rounded-2xl border border-outline-variant mb-3 overflow-hidden active:opacity-80"
 >
 <View className="p-4">
 <View className="flex-row justify-between items-start">
 <View className="flex-1 mr-3">
 <Text numberOfLines={2} className="font-bold text-base text-on-surface leading-snug">
 {item.name}
 </Text>
 {item.sku ? (
 <Text className="text-xs text-on-surface-variant font-semibold mt-1 uppercase tracking-wider">
 SKU: {item.sku}
 </Text>
 ) : null}
 </View>
 <View className="items-end">
 <View className="flex-row items-center" style={{ gap: 4 }}>
 {item.mrp && parseFloat(item.mrp) > 0 && (
 <Text className="text-xs text-on-surface-variant line-through">
 {formatRupee(parseFloat(item.mrp))}
 </Text>
 )}
 {item.has_alternate_pricing ? (
 <View className="items-end">
 <Text className="text-sm font-black text-primary">
 {formatRupee(parseFloat(item.alternate_price ?? item.price))}/{item.alternate_unit || "pkt"}
 </Text>
 <Text className="text-xs font-bold text-on-surface-variant">
 {formatRupee(parseFloat(item.price_per_unit ?? item.price))}/{item.weight_unit || "kg"}
 </Text>
 </View>
 ) : item.mrp && parseFloat(item.mrp) > 0 ? (
 <View className="items-end">
 <Text className="font-black text-base text-primary">
 {formatRupee(parseFloat(item.mrp))}{item.sell_by_weight ? `/${item.weight_unit || "kg"}` : ""}
 </Text>
 {parseFloat(item.price) < parseFloat(item.mrp) && (
 <Text className="text-[10px] text-on-surface-variant line-through">
 {formatRupee(parseFloat(item.price))}
 </Text>
 )}
 </View>
 ) : (
 <Text className="font-black text-base text-primary">
 {formatRupee(parseFloat(item.price))}{item.sell_by_weight ? `/${item.weight_unit || "kg"}` : ""}
 </Text>
 )}
 </View>
 {item.mrp && parseFloat(item.mrp) > parseFloat(item.price) && (
 <Text className="text-[10px] text-green-600 font-semibold">
 Save {formatRupee((parseFloat(item.mrp) - parseFloat(item.price)))}
 </Text>
 )}
 {item.stock_quantity !== undefined && (
 <Text className="text-xs text-on-surface-variant mt-0.5">
 Stock: {item.stock_quantity}
 </Text>
 )}
 {item.is_returnable_container && item.container_deposit && parseFloat(item.container_deposit) > 0 && (
 <View className="bg-purple-100 px-2 py-0.5 rounded mt-1">
 <Text className="text-[9px] font-bold text-purple-700">
 +{formatRupee(parseFloat(item.container_deposit))} deposit
 </Text>
 </View>
 )}
 </View>
 </View>
 </View>
 {inCart && (
 <View className="bg-primary/10 px-4 py-1.5 flex-row justify-between items-center">
 <Text className="text-xs font-bold text-primary">In cart</Text>
 {inCart.billingMode === "weight" ? (
 <View className="flex-row items-center gap-1">
 <TextInput
 value={String(inCart.quantity || "")}
 onChangeText={(val) => {
 const qty = parseFloat(val) || 0;
 setCart((prev) => prev.map((c) =>
 c.product.id === item.id ? { ...c, quantity: qty } : c
 ));
 }}
 keyboardType="numeric"
 placeholder="0.000"
 placeholderTextColor="#9E9E9E"
 className="text-primary font-black text-base min-w-[40px] text-center bg-white/30 rounded-lg px-2 py-0.5"
 />
 <Text className="text-xs font-bold text-primary">{item.weight_unit || "kg"}</Text>
 </View>
 ) : (
 <View className="flex-row items-center gap-3">
 <Text className="text-xs font-bold text-primary shrink-0">{inCart.billingMode === "fixed" ? `${item.alternate_unit || "pkt"}` : ""}</Text>
 <Pressable onPress={() => updateQuantity(item.id, -1)} className="w-7 h-7 rounded-full bg-primary items-center justify-center">
 <MaterialCommunityIcons name="minus" size={14} color="white" />
 </Pressable>
 <Text className="text-primary font-black text-base min-w-[16px] text-center">{inCart.quantity}</Text>
 <Pressable onPress={() => updateQuantity(item.id, 1)} className="w-7 h-7 rounded-full bg-primary items-center justify-center">
 <MaterialCommunityIcons name="plus" size={14} color="white" />
 </Pressable>
 </View>
 )}
 </View>
 )}
 </Pressable>
 );
 };

 // ─────────────────────────────────────────────
 // Checkout Panel content (shared phone+tablet)
 // ─────────────────────────────────────────────
 const CheckoutPanel = (
 <>
 {/* Customer row — every bill is tied to either a named party or the
 configured default walk-in customer (resolveCheckoutParty), never
 left fully anonymous. */}
 <Pressable
 onPress={() => setIsSelectingParty(true)}
 className="bg-surface-container-lowest rounded-2xl border border-dashed border-gray-300 p-4 mb-5 flex-row justify-between items-center active:opacity-75"
 >
 <View className="flex-row items-center flex-1 mr-3">
 <View className="w-10 h-10 rounded-full bg-primary/10 items-center justify-center mr-3">
 <MaterialCommunityIcons name="account" size={20} color={theme.colors.primary} />
 </View>
 <View className="flex-1">
 <Text className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Customer</Text>
 <Text numberOfLines={1} className="text-base font-bold text-on-surface mt-0.5">
 {selectedParty ? selectedParty.name : "Tap to select →"}
 </Text>
 </View>
 </View>
 {selectedParty && (
 <View style={{ gap: 4 }}>
 <View className="bg-green-100 px-2 py-1 rounded-lg flex-row items-center" style={{ gap: 3 }}>
 <MaterialCommunityIcons name="check-circle" size={12} color="#15803d" />
 <Text className="text-green-700 text-xs font-bold">Set</Text>
 </View>
 {selectedParty.current_balance && parseFloat(selectedParty.current_balance) !== 0 && (
 <View className={`px-2 py-1 rounded-lg ${parseFloat(selectedParty.current_balance) > 0 ? "bg-red-50" : "bg-green-50"}`}>
 <Text className={`text-[10px] font-bold ${parseFloat(selectedParty.current_balance) > 0 ? "text-red-600" : "text-green-600"}`}>
 {formatRupee(Math.abs(parseFloat(selectedParty.current_balance)))} {parseFloat(selectedParty.current_balance) > 0 ? "due" : "credit"}
 </Text>
 </View>
 )}
 {selectedParty.credit_limit != null && (
 <View className="px-2 py-1 rounded-lg bg-yellow-50">
 <Text className="text-[10px] font-bold text-yellow-700">
 Limit: {formatRupee(Number(selectedParty.credit_limit))}
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
 <Text className="text-on-surface-variant font-semibold text-sm">
 Add products from the left panel
 </Text>
 </View>
 ) : (
 <View className="mb-4">
 {cart.map((item) => (
 <View key={item.product.id} className="bg-surface-container-lowest rounded-xl border border-outline-variant px-4 py-3 mb-2">
 <View className="flex-row items-center">
 <View className="flex-1 mr-2">
 <Text numberOfLines={1} className="font-bold text-sm text-on-surface">{item.product.name}</Text>
 <View className="flex-row items-center" style={{ gap: 3 }}>
 {item.product.mrp && parseFloat(item.product.mrp) > 0 && (
 <Text className="text-[10px] text-on-surface-variant line-through">{formatRupee(parseFloat(item.product.mrp))}</Text>
 )}
 <Text className="text-xs text-on-surface-variant">{formatRupee(unitPriceFor(item), 2)}{item.billingMode === "weight" ? `/${item.product.weight_unit || "kg"}` : item.billingMode === "fixed" ? `/${item.product.alternate_unit || "unit"}` : " each"}</Text>
 </View>
 </View>
 {item.billingMode === "weight" ? (
 <View className="flex-row items-center gap-1 mr-3">
 <TextInput
 value={String(item.quantity || "")}
 onChangeText={(val) => {
 const qty = parseFloat(val) || 0;
 setCart((prev) => prev.map((c) =>
 c.product.id === item.product.id ? { ...c, quantity: qty } : c
 ));
 }}
 keyboardType="numeric"
 placeholder="0.000"
 placeholderTextColor="#9E9E9E"
 className="text-base font-black text-on-surface min-w-[60px] text-center bg-surface-container rounded-lg px-2 py-1"
 />
 <Text className="text-xs font-bold text-on-surface-variant">{item.product.weight_unit || "kg"}</Text>
 </View>
 ) : (
 <View className="flex-row items-center gap-2 mr-3">
 <Text className="text-xs font-bold text-on-surface-variant shrink-0">{item.billingMode === "fixed" ? `${item.product.alternate_unit || "pkt"}` : ""}</Text>
 <Pressable onPress={() => updateQuantity(item.product.id, -1)} className="w-7 h-7 rounded-full bg-surface-container items-center justify-center">
 <MaterialCommunityIcons name="minus" size={14} color="#6e7a74" />
 </Pressable>
 <Text className="text-base font-black text-on-surface min-w-[20px] text-center">{item.quantity}</Text>
 <Pressable onPress={() => updateQuantity(item.product.id, 1)} className="w-7 h-7 rounded-full bg-surface-container items-center justify-center">
 <MaterialCommunityIcons name="plus" size={14} color="#6e7a74" />
 </Pressable>
 </View>
 )}
 <Text className="font-black text-base text-primary min-w-[60px] text-right">
 {formatRupee(lineTotal(item))}
 </Text>
 </View>
 {item.product.is_returnable_container && item.product.container_deposit && parseFloat(item.product.container_deposit) > 0 && (
 <View className="bg-purple-100 self-start px-2 py-0.5 rounded mt-1">
 <Text className="text-[9px] font-bold text-purple-700">
 +{formatRupee(parseFloat(item.product.container_deposit))}/unit crate deposit
 </Text>
 </View>
 )}
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
 <MaterialCommunityIcons name="percent-outline" size={12} color={theme.colors.primary} />
 <Text className="text-xs font-bold text-primary">
 GST {effectiveTaxRate(item)}% {item.customTaxRate ? "(custom)" : ""}
 </Text>
 <MaterialCommunityIcons name="pencil" size={11} color={theme.colors.primary} />
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
 className="text-xs font-bold text-on-surface px-2 py-1 min-w-[40px]"
 />
 <Text className="text-[10px] text-on-surface-variant mr-1">off</Text>
 </View>
 </View>
 {item.product.has_alternate_pricing && (
 <View className="flex-row items-center mt-2" style={{ gap: 6 }}>
 <Pressable
 onPress={() => setCart((prev) => prev.map((c) =>
 c.product.id === item.product.id
 ? { ...c, billingMode: "fixed", quantity: c.billingMode === "weight" && c.quantity === 0 ? 1 : (c.billingMode === "weight" ? Math.max(1, Math.round(c.quantity)) : c.quantity) }
 : c
 ))}
 className={`px-3 py-1.5 rounded-full border ${item.billingMode === "fixed" ? "bg-primary border-primary" : "bg-surface-container border-outline-variant"}`}
 >
 <Text className={`text-[10px] font-bold ${item.billingMode === "fixed" ? "text-white" : "text-on-surface-variant"}`}>
 Per {item.product.alternate_unit || "Packet"} {formatRupee(parseFloat(item.product.alternate_price ?? item.product.price))}
 </Text>
 </Pressable>
 <Pressable
 onPress={() => setCart((prev) => prev.map((c) =>
 c.product.id === item.product.id
 ? { ...c, billingMode: "weight", quantity: c.billingMode === "fixed" ? 0 : c.quantity }
 : c
 ))}
 className={`px-3 py-1.5 rounded-full border ${item.billingMode === "weight" ? "bg-primary border-primary" : "bg-surface-container border-outline-variant"}`}
 >
 <Text className={`text-[10px] font-bold ${item.billingMode === "weight" ? "text-white" : "text-on-surface-variant"}`}>
 Per {item.product.weight_unit || "Kg"} {formatRupee(parseFloat(item.product.price_per_unit ?? item.product.price))}
 </Text>
 </Pressable>
 </View>
 )}
 {item.product.tracks_serials && (
 <TextInput
 value={item.serialNumbers || ""}
 onChangeText={(val) => {
 setCart((prev) => prev.map((c) =>
 c.product.id === item.product.id ? { ...c, serialNumbers: val } : c
 ));
 }}
 placeholder={`Serial number(s) for ${item.quantity} unit(s), comma-separated`}
 placeholderTextColor="#9E9E9E"
 className="text-xs text-on-surface bg-surface-container rounded-lg px-2.5 py-2 mt-2"
 />
 )}
 </View>
 ))}
 </View>
 )}

 {/* ── Bill Options ── */}
 <View className="bg-surface-container-lowest rounded-2xl border border-outline-variant p-4 mb-4">
 {/* Bill Type — 2x2 grid rather than 4-across: an icon + label
 ("Bill of Supply") doesn't fit in a quarter-width button on a
 360px-wide phone without clipping or wrapping awkwardly. */}
 <Text className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2">Bill Type</Text>
 <View className="flex-row flex-wrap mb-4" style={{ gap: 8 }}>
 {([
 { key: "retail", label: "Retail", icon: "storefront-outline" },
 { key: "gst", label: "GST", icon: "file-document-outline" },
 { key: "estimate", label: "Estimate", icon: "note-edit-outline" },
 { key: "bill_of_supply", label: "Bill of Supply", icon: "file-outline" },
 ] as const).map((opt) => (
 <Pressable
 key={opt.key}
 onPress={() => setInvoiceType(opt.key as "gst" | "retail" | "estimate" | "bill_of_supply")}
 className={`flex-row items-center justify-center py-2.5 rounded-xl border ${
 invoiceType === opt.key
 ? "border-transparent"
 : "border-outline-variant"
 }`}
 style={[{ width: "48%", gap: 6 }, invoiceType === opt.key ? { backgroundColor: activeBillColor } : undefined]}
 >
 <MaterialCommunityIcons
 name={opt.icon}
 size={16}
 color={invoiceType === opt.key ? "#FFFFFF" : "#6e7a74"}
 />
 <Text
 className={`text-xs font-bold ${invoiceType === opt.key ? "text-white" : "text-on-surface-variant"}`}
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
 applyRoundOff ? "bg-primary/10 border-primary" : "border-outline-variant"
 }`}
 >
 <Text className="text-xs font-bold text-on-surface">Round off total to nearest ₹1</Text>
 <MaterialCommunityIcons
 name={applyRoundOff ? "toggle-switch" : "toggle-switch-off-outline"}
 size={26}
 color={applyRoundOff ? theme.colors.primary : theme.colors.outline}
 />
 </Pressable>

 {/* An estimate is normally tax-free (it's a quotation), but some
 customers want to see the GST-inclusive number before committing. */}
 {invoiceType === "estimate" && (
 <Pressable
 onPress={() => setEstimateWithGst((v) => !v)}
 className={`flex-row items-center justify-between px-3 py-2.5 rounded-xl border mb-4 ${
 estimateWithGst ? "bg-primary/10 border-primary" : "border-outline-variant"
 }`}
 >
 <View className="flex-row items-center" style={{ gap: 8 }}>
 <MaterialCommunityIcons name="percent-outline" size={16} color={estimateWithGst ? theme.colors.primary : theme.colors.outline} />
 <Text className={`text-sm font-bold ${estimateWithGst ? "text-primary" : "text-on-surface-variant"}`}>
 Include GST in this estimate
 </Text>
 </View>
 <MaterialCommunityIcons
 name={estimateWithGst ? "toggle-switch" : "toggle-switch-off-outline"}
 size={26}
 color={estimateWithGst ? theme.colors.primary : theme.colors.outline}
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
 className="py-2 px-3 rounded-xl border border-outline-variant flex-row items-center"
 style={{ gap: 4 }}
 >
 <MaterialCommunityIcons
 name={sp.method === "cash" ? "cash" : sp.method === "upi" ? "cellphone" : "book-account-outline"}
 size={16}
 color={theme.colors.primary}
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
 className="flex-1 border border-outline-variant rounded-xl px-3 py-2 text-right text-base font-bold bg-background text-on-surface"
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
 <MaterialCommunityIcons name="plus" size={14} color={theme.colors.primary} />
 <Text className="text-xs font-bold text-primary">Add split payment</Text>
 </Pressable>
 <Text className="text-xs text-on-surface-variant text-right">
 Total: {formatRupee(splitPayments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0))} / {formatRupee(getTotal())}
 </Text>
 </View>
 ) : (
 <View className="flex-row gap-2 mb-4">
 {([
 { key: "cash", label: "Cash", icon: "cash" as const },
 { key: "upi", label: "UPI", icon: "cellphone" as const },
 { key: "credit", label: "Credit", icon: "book-account-outline" as const },
 ] as const).filter((opt) => {
 const enabled = activeCompany?.enabled_payment_methods;
 return !enabled?.length || enabled.includes(opt.key);
 }).map((opt) => (
 <Pressable
 key={opt.key}
 onPress={() => {
 setPaymentMode(opt.key);
 if (opt.key !== "credit") {
 setCreditPeriod(null);
 setCreditDueDateLabel("");
 }
 }}
 className={`flex-1 items-center justify-center rounded-xl border ${
 paymentMode === opt.key
 ? "bg-primary border-primary"
 : "border-outline-variant"
 }`}
 style={{ minHeight: 52 }}
 >
 <MaterialCommunityIcons
 name={opt.icon}
 size={20}
 color={paymentMode === opt.key ? "#FFFFFF" : "#6e7a74"}
 />
 <Text className={`text-xs font-bold mt-1 ${paymentMode === opt.key ? "text-white" : "text-on-surface-variant"}`}>
 {opt.label}
 </Text>
 </Pressable>
 ))}
 </View>
 )}
 {paymentMode === "upi" && activeCompany?.upi_id && (
 <View className="mb-4 p-4 rounded-xl items-center bg-surface border border-outline-variant">
 <Text className="text-xs font-bold mb-2 text-primary">Scan to Pay via UPI</Text>
 {activeCompany?.upi_qr_url ? (
 <Image source={{ uri: activeCompany.upi_qr_url }} style={{ width: 140, height: 140 }} className="rounded-lg" />
 ) : (
 <View style={{ width: 140, height: 140 }} className="items-center justify-center rounded-lg bg-white border border-outline-variant">
 <MaterialCommunityIcons name="qrcode" size={48} color={theme.colors.primary} />
 <Text className="text-[9px] text-center mt-1 px-2 text-on-surface-variant">Upload QR in Settings</Text>
 </View>
 )}
 <Text className="text-sm font-mono font-bold mt-2 text-on-surface">{activeCompany.upi_id}</Text>
 {activeCompany?.upi_payee_name && (
 <Text className="text-xs text-on-surface-variant">{activeCompany.upi_payee_name}</Text>
 )}
 </View>
 )}
 {paymentMode === "cash" && (
 <Pressable
 onPress={async () => {
 try {
 await openCashDrawer();
 Alert.alert("Drawer Open", "Cash drawer has been triggered.");
 } catch (e: any) {
 Alert.alert("Drawer Error", e.message || "Could not open cash drawer. Is a printer paired?");
 }
 }}
 className="flex-row items-center justify-center mb-3 py-2.5 rounded-xl border border-outline-variant active:opacity-80"
 style={{ gap: 6 }}
 >
 <MaterialCommunityIcons name="cash-register" size={16} color="#6e7a74" />
 <Text className="text-xs font-bold text-on-surface-variant">Open Cash Drawer</Text>
 </Pressable>
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
 color={isSplitPayment ? theme.colors.primary : theme.colors.outline}
 />
 <Text className={`text-xs font-semibold ${isSplitPayment ? "text-primary" : "text-on-surface-variant"}`}>
 Split payment
 </Text>
 </Pressable>

 {/* Discount — flat amount or percentage */}
 <View className="flex-row justify-between items-center mb-3">
 <View className="flex-row items-center" style={{ gap: 6 }}>
 <Text className="text-sm font-semibold text-on-surface-variant">Discount</Text>
 <Pressable
 onPress={() => setDiscountType(discountType === "flat" ? "percent" : "flat")}
 className={`px-2 py-1 rounded-lg border ${discountType === "percent" ? "bg-primary/10 border-primary" : "border-outline-variant"}`}
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
 className="border border-outline-variant rounded-xl px-3 py-2 text-right text-base font-bold w-24 bg-background text-on-surface"
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
 onPress={() => {
 const next = creditPeriod === days ? null : days;
 setCreditPeriod(next);
 setCreditDueDateLabel(next ? new Date(Date.now() + next * 86400000).toLocaleDateString() : "");
 }}
 className={`py-2 px-3 rounded-xl border ${
 creditPeriod === days
 ? "bg-primary border-primary"
 : "border-outline-variant"
 }`}
 >
 <Text className={`text-xs font-bold ${creditPeriod === days ? "text-white" : "text-on-surface-variant"}`}>
 {days} days
 </Text>
 </Pressable>
 ))}
 </View>
 {creditPeriod && (
 <Text className="text-xs text-on-surface-variant mt-1">
 Due by {creditDueDateLabel}
 </Text>
 )}
 </View>
 <View className="flex-row justify-between items-center mb-3">
 <Text className="text-sm font-semibold text-on-surface-variant">Credit Charge (₹)</Text>
 <TextInput
 value={extraCharge}
 onChangeText={setExtraCharge}
 keyboardType="numeric"
 placeholder="0"
 placeholderTextColor="#A0A0A0"
 className="border border-outline-variant rounded-xl px-3 py-2 text-right text-base font-bold w-24 bg-background text-on-surface"
 />
 </View>
 </>
 )}
 </View>

 {/* ── Totals ── */}
 <View className="bg-surface-container-lowest rounded-2xl border border-outline-variant p-4 mb-4">
 <View className="flex-row justify-between mb-2">
 <Text className="text-sm text-on-surface-variant font-medium">Subtotal</Text>
 <Text className="text-sm font-semibold text-on-surface">{formatRupee(getSubtotal(), 2)}</Text>
 </View>
 {shouldApplyTax && getTaxTotal() > 0 && (
 <View className="flex-row justify-between mb-2">
 <Text className="text-sm text-on-surface-variant font-medium">GST</Text>
 <Text className="text-sm font-semibold text-on-surface">+{formatRupee(getTaxTotal(), 2)}</Text>
 </View>
 )}
 {getDepositTotal() > 0 && (
 <View className="flex-row justify-between mb-2">
 <Text className="text-sm text-on-surface-variant font-medium">Crate Deposit</Text>
 <Text className="text-sm font-semibold text-on-surface">+{formatRupee(getDepositTotal(), 2)}</Text>
 </View>
 )}
 {getExtraChargeValue() > 0 && (
 <View className="flex-row justify-between mb-2">
 <Text className="text-sm text-on-surface-variant font-medium">Credit Charge</Text>
 <Text className="text-sm font-semibold text-on-surface">+{formatRupee(getExtraChargeValue(), 2)}</Text>
 </View>
 )}
 {getDiscountValue() > 0 && (
 <View className="flex-row justify-between mb-2">
 <Text className="text-sm text-on-surface-variant font-medium">Discount</Text>
 <Text className="text-sm font-semibold text-red-500">−{formatRupee(getDiscountValue(), 2)}</Text>
 </View>
 )}
 <View className="h-px bg-surface-container my-2" />
 <View className="flex-row justify-between items-center">
 <Text className="text-base font-bold text-on-surface">Total</Text>
 <Text className="text-2xl font-black text-primary">{formatRupee(getTotal(), 2)}</Text>
 </View>
 </View>

 {/* Hold Bill button */}
 {cart.length > 0 && (
 <Pressable
 onPress={handleHoldBill}
 disabled={holdBillLoading}
 className="flex-row items-center justify-center py-3 rounded-2xl border border-outline-variant mb-3 active:opacity-80"
 style={{ gap: 6 }}
 >
 {holdBillLoading ? (
 <ActivityIndicator size="small" color="#6B7280" />
 ) : (
 <>
 <MaterialCommunityIcons name="pause-circle-outline" size={18} color="#6B7280" />
 <Text className="text-sm font-bold text-on-surface-variant">Park Bill</Text>
 </>
 )}
 </Pressable>
 )}

 {/* Checkout button */}
 <Pressable onPress={handleCheckout} disabled={checkoutLoading} className="active:opacity-90">
 <LinearGradient
 colors={[activeBillColor, activeBillColorDark]}
 start={{ x: 0, y: 0 }}
 end={{ x: 1, y: 0 }}
 style={{
 borderRadius: 18,
 paddingVertical: 16,
 alignItems: "center",
 shadowColor: activeBillColor,
 shadowOffset: { width: 0, height: 6 },
 shadowOpacity: 0.3,
 shadowRadius: 10,
 elevation: 5,
 }}
 >
 {checkoutLoading ? (
 <ActivityIndicator color="white" />
 ) : (
 <Text className="text-white font-black text-lg tracking-wide">
 {invoiceType === "estimate" ? "Save Estimate" : "Confirm Sale"} →
 </Text>
 )}
 </LinearGradient>
 </Pressable>
 </>
 );

 if (posView === "dashboard") {
 return (
 <View className="flex-1 bg-background" style={{ paddingTop: topInset }}>
 <View className="px-4 pb-2 flex-row items-center justify-between">
 <Text className="text-2xl font-black text-on-surface">POS Dashboard</Text>
 <Pressable
 onPress={() => setPosView("sale")}
 className="flex-row items-center bg-primary px-4 py-2 rounded-full"
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
 <View className="flex-1 bg-background">
 {/* Offline state is now shown by the app-wide OfflineBanner (app/_layout.tsx)
 — one calm, consistent banner instead of a screen-local amber one,
 per shopkeeper-mobile-design-system.md §6.13 ("patchy network is
 normal here, not an error — never alarming red/amber"). */}
 {isTablet ? (
 /* ══════ TABLET: side-by-side layout ══════ */
 <View className="flex-1 flex-row" style={{ paddingTop: topInset }}>
 {/* Left — product catalogue */}
 <View className="w-[58%] px-4">
 <View className="flex-row items-center justify-between mb-4">
 <View className="flex-row items-center" style={{ gap: 8 }}>
 <Text className="font-headline-md text-on-surface" style={{ fontSize: 20, fontWeight: "700" }}>Products</Text>
 {businessMode === "b2b" && (
 <View className="bg-primary/15 px-2 py-0.5 rounded-md">
 <Text className="text-[9px] font-black text-primary tracking-widest">B2B</Text>
 </View>
 )}
 </View>
 <View className="flex-row" style={{ gap: 6 }}>
 <Pressable onPress={() => { loadHeldBills(); setIsHeldBillsOpen(true); }} className="flex-row items-center bg-surface-container rounded-xl px-3 py-2" style={{ gap: 5 }}>
 <MaterialCommunityIcons name="pause-circle-outline" size={16} color="#374151" />
 <Text className="text-sm font-bold text-on-surface">Held</Text>
 </Pressable>
 <Pressable onPress={() => setPosView("dashboard")} className="flex-row items-center bg-surface-container rounded-xl px-3 py-2" style={{ gap: 5 }}>
 <MaterialCommunityIcons name="chart-box-outline" size={16} color="#374151" />
 <Text className="text-sm font-bold text-on-surface">Dashboard</Text>
 </Pressable>
 {cart.length > 0 && (
 <View className="bg-primary/10 rounded-xl px-3 py-2">
 <Text className="text-primary text-sm font-bold">{cart.reduce((s, i) => s + i.quantity, 0)} in cart</Text>
 </View>
 )}
 </View>
 </View>
 <View className="flex-row items-center bg-surface-container-lowest rounded-2xl px-4 py-3 mb-3 border border-outline-variant">
 <MaterialCommunityIcons name="magnify" size={18} color="#6B7280" />
 <TextInput
 placeholder="Search by name or SKU..."
 placeholderTextColor="#9CA3AF"
 value={productSearch}
 onChangeText={setProductSearch}
 className="flex-1 ml-2 text-base font-medium text-on-surface"
 />
 <Pressable onPress={handleScanBarcode} className="ml-2 w-8 h-8 items-center justify-center">
 <MaterialCommunityIcons name="barcode-scan" size={20} color={theme.colors.primary} />
 </Pressable>
 </View>
 {categories.length > 0 && (
 <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3" contentContainerStyle={{ gap: 6 }}>
 <Chip label="All" count={products.length} active={!filterCategory} onPress={() => setFilterCategory("")} />
 {categories.map((cat) => (
 <Chip key={cat} label={cat} active={filterCategory === cat} onPress={() => setFilterCategory(filterCategory === cat ? "" : cat)} />
 ))}
 </ScrollView>
 )}
 {isPosDevice ? (
 renderPosProductGrid()
 ) : loading ? (
 <View className="flex-1 justify-center items-center">
 <ActivityIndicator size="large" color={theme.colors.primary} />
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
 className="bg-primary px-5 py-3 rounded-xl"
 >
 <Text className="text-white font-bold text-sm">+ Add &quot;{productSearch || "New Product"}&quot;</Text>
 </Pressable>
 </View>
 }
 />
 )}
 </View>

 {/* Right — checkout panel */}
 <View className="w-[42%] border-l border-outline-variant px-4 pt-2">
 <View className="flex-row items-center justify-between mb-4">
 <View className="flex-row items-center" style={{ gap: 6 }}>
 <Text className="font-headline-md text-on-surface" style={{ fontSize: 20, fontWeight: "700" }}>Cart</Text>
 {businessMode === "b2b" && (
 <View className="bg-primary/15 px-2 py-0.5 rounded-md">
 <Text className="text-[9px] font-black text-primary tracking-widest">B2B</Text>
 </View>
 )}
 </View>
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
 <View className="px-5 mb-3">
 <View className="flex-row items-center justify-between mb-1">
 <Text className="font-headline-md text-on-surface" style={{ fontSize: 20, fontWeight: "700" }}>New Sale</Text>
 <View className="flex-row" style={{ gap: 6 }}>
 <Pressable onPress={() => { loadHeldBills(); setIsHeldBillsOpen(true); }} className="w-9 h-9 rounded-xl bg-surface-container items-center justify-center">
 <MaterialCommunityIcons name="pause-circle-outline" size={18} color="#374151" />
 </Pressable>
 <Pressable onPress={() => setPosView("dashboard")} className="w-9 h-9 rounded-xl bg-surface-container items-center justify-center">
 <MaterialCommunityIcons name="chart-box-outline" size={18} color="#374151" />
 </Pressable>
 {selectedParty && (
 <Pressable onPress={() => setIsSelectingParty(true)} className="bg-primary/10 rounded-xl px-3 flex-row items-center" style={{ gap: 4 }}>
 <MaterialCommunityIcons name="account" size={16} color={theme.colors.primary} />
 <Text className="text-primary font-bold text-sm">{selectedParty.name}</Text>
 </Pressable>
 )}
 </View>
 </View>
 {businessMode === "b2b" && (
 <View className="bg-primary/15 px-2 py-0.5 self-start rounded-md">
 <Text className="text-[9px] font-black text-primary tracking-widest">B2B MODE</Text>
 </View>
 )}
 </View>

 {/* Search */}
 <View className="px-5 mb-3">
 <View className="flex-row items-center bg-surface-container-lowest rounded-2xl px-4 py-3 border border-outline-variant">
 <MaterialCommunityIcons name="magnify" size={18} color="#6B7280" />
 <TextInput
 placeholder="Search products..."
 placeholderTextColor="#9CA3AF"
 value={productSearch}
 onChangeText={setProductSearch}
 className="flex-1 ml-2 text-base font-medium text-on-surface"
 />
 <Pressable onPress={handleScanBarcode} className="ml-2 w-8 h-8 items-center justify-center">
 <MaterialCommunityIcons name="barcode-scan" size={20} color={theme.colors.primary} />
 </Pressable>
 </View>
 </View>

 {/* Category chips */}
 {categories.length > 0 && (
 <View className="px-5 mb-3">
 <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
 <Chip label="All" count={products.length} active={!filterCategory} onPress={() => setFilterCategory("")} />
 {categories.map((cat) => (
 <Chip key={cat} label={cat} active={filterCategory === cat} onPress={() => setFilterCategory(filterCategory === cat ? "" : cat)} />
 ))}
 </ScrollView>
 </View>
 )}

 {/* Product list */}
 <View className="flex-1 px-5">
 {loading ? (
 <View className="flex-1 justify-center items-center">
 <ActivityIndicator size="large" color={theme.colors.primary} />
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
 className="bg-primary px-5 py-3 rounded-xl"
 >
 <Text className="text-white font-bold text-sm">+ Add &quot;{productSearch || "New Product"}&quot;</Text>
 </Pressable>
 </View>
 }
 />
 )}
 </View>

 {/* Floating cart bar */}
 {cart.length > 0 && (
 <Pressable onPress={() => setIsCheckoutOpen(true)} className="mx-5 active:opacity-90" style={{ marginBottom: bottomInset }}>
 <LinearGradient
 colors={[activeBillColor, activeBillColorDark]}
 start={{ x: 0, y: 0 }}
 end={{ x: 1, y: 0 }}
 style={{
 borderRadius: 18,
 paddingHorizontal: 20,
 paddingVertical: 16,
 flexDirection: "row",
 justifyContent: "space-between",
 alignItems: "center",
 shadowColor: activeBillColor,
 shadowOffset: { width: 0, height: 4 },
 shadowOpacity: 0.3,
 shadowRadius: 12,
 elevation: 8,
 }}
 >
 <View className="flex-row items-center" style={{ gap: 10 }}>
 <View className="w-10 h-10 rounded-xl bg-white/20 items-center justify-center">
 <MaterialCommunityIcons name="cart-outline" size={20} color="white" />
 </View>
 <View>
 <Text className="text-white/80 text-xs font-semibold">
 {cart.reduce((s, i) => s + i.quantity, 0)} item{cart.reduce((s, i) => s + i.quantity, 0) !== 1 ? "s" : ""}
 </Text>
 <Text className="text-white font-bold text-xl">{formatRupee(getTotal(), 2)}</Text>
 </View>
 </View>
 <View className="flex-row items-center bg-white/20 rounded-xl px-4 py-2" style={{ gap: 4 }}>
 <Text className="text-white font-bold text-sm">View Cart</Text>
 <MaterialCommunityIcons name="arrow-right" size={16} color="white" />
 </View>
 </LinearGradient>
 </Pressable>
 )}
 </View>
 )}

 {/* ══════ Checkout Sheet (phone only) ══════ */}
 {!isTablet && (
 <Modal visible={isCheckoutOpen} animationType="slide" onRequestClose={() => setIsCheckoutOpen(false)}>
 <SafeAreaProvider>
 <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : undefined}>
 <View className="flex-1 bg-background">
 {/* Sheet header */}
 <View className="px-5 pb-4 border-b border-outline-variant flex-row justify-between items-center" style={{ paddingTop: topInset }}>
 <View>
 <Text className="font-headline-md text-on-surface" style={{ fontSize: 20, fontWeight: "700" }}>Checkout</Text>
 <Text className="text-sm text-on-surface-variant mt-0.5">{cart.reduce((s, i) => s + i.quantity, 0)} items · {formatRupee(getTotal(), 2)}</Text>
 </View>
 <Pressable onPress={() => setIsCheckoutOpen(false)} className="w-9 h-9 rounded-xl bg-surface-container items-center justify-center">
 <MaterialCommunityIcons name="close" size={18} color="#374151" />
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
 <View className="flex-1 bg-background">
 <View className="px-5 pb-4 border-b border-outline-variant flex-row justify-between items-center" style={{ paddingTop: topInset }}>
 <Text className="text-2xl font-black text-on-surface">Select Customer</Text>
 <Pressable onPress={() => setIsSelectingParty(false)} className="w-10 h-10 rounded-full bg-surface-container items-center justify-center">
 <MaterialCommunityIcons name="close" size={18} color="#3e4944" />
 </Pressable>
 </View>

 <View className="px-5 pt-4 flex-row gap-2 mb-2">
 <View className="flex-1 bg-surface-container-lowest border border-outline-variant rounded-2xl px-4 py-3 flex-row items-center">
 <MaterialCommunityIcons name="magnify" size={18} color="#3e4944" style={{ marginRight: 8 }} />
 <TextInput
 placeholder="Search by name or phone..."
 placeholderTextColor="#A0A0A0"
 value={partySearch}
 onChangeText={setPartySearch}
 className="flex-1 text-base font-medium text-on-surface"
 />
 </View>
 <Pressable
 onPress={() => setIsAddingCustomer(true)}
 className="bg-primary px-4 rounded-2xl items-center justify-center active:opacity-90"
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
 className="bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant mb-3 flex-row justify-between items-center active:opacity-75"
 >
 <View>
 <Text className="font-bold text-base text-on-surface">{item.name}</Text>
 <Text className="text-sm text-on-surface-variant mt-0.5">{item.phone || "No phone"}</Text>
 </View>
 <View className="bg-primary/10 px-3 py-1.5 rounded-full">
 <Text className="text-primary text-sm font-bold">Select</Text>
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
 <ScrollView className="flex-1 bg-background px-5" style={{ paddingTop: topInset }} contentContainerStyle={{ paddingBottom: bottomInset + 24 }} keyboardShouldPersistTaps="handled">
 <View className="flex-row justify-between items-center mb-6">
 <Text className="text-2xl font-black text-on-surface">New Customer</Text>
 <Pressable onPress={closeAddCustomer} className="w-10 h-10 rounded-full bg-surface-container items-center justify-center">
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
 className="bg-surface-container-lowest text-on-surface border border-outline-variant rounded-2xl px-4 py-4 text-base font-medium"
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
 className="bg-surface-container-lowest text-on-surface border border-outline-variant rounded-2xl px-4 py-4 text-base font-medium"
 />
 </View>
 <View className="mt-4">
 <Text className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2">State (for GST)</Text>
 <TextInput
 value={newCustomerState}
 onChangeText={setNewCustomerState}
 placeholder="e.g. Maharashtra"
 placeholderTextColor="#A0A0A0"
 className="bg-surface-container-lowest text-on-surface border border-outline-variant rounded-2xl px-4 py-4 text-base font-medium"
 />
 </View>
 </View>

 <View className="flex-row gap-3 mt-8">
 <Pressable
 onPress={closeAddCustomer}
 className="flex-1 border border-outline-variant py-4 rounded-2xl items-center"
 >
 <Text className="text-on-surface-variant font-bold text-base">Cancel</Text>
 </Pressable>
 <Pressable
 onPress={handleAddCustomer}
 disabled={addCustomerLoading}
 className="flex-1 bg-primary py-4 rounded-2xl items-center"
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
 <ScrollView className="flex-1 bg-background px-5" style={{ paddingTop: topInset }} contentContainerStyle={{ paddingBottom: bottomInset + 24 }} keyboardShouldPersistTaps="handled">
 <View className="flex-row justify-between items-center mb-6">
 <Text className="text-2xl font-black text-on-surface">New Product</Text>
 <Pressable onPress={closeAddProduct} className="w-10 h-10 rounded-full bg-surface-container items-center justify-center">
 <MaterialCommunityIcons name="close" size={18} color="#3e4944" />
 </Pressable>
 </View>

 <Text className="text-sm text-on-surface-variant mb-6">
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
 className="bg-surface-container-lowest text-on-surface border border-outline-variant rounded-2xl px-4 py-4 text-base font-medium"
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
 className="bg-surface-container-lowest text-on-surface border border-outline-variant rounded-2xl px-4 py-4 text-base font-medium"
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
 className="bg-surface-container-lowest text-on-surface border border-outline-variant rounded-2xl px-4 py-4 text-base font-medium"
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
 className="bg-surface-container-lowest text-on-surface border border-outline-variant rounded-2xl px-4 py-4 text-base font-medium"
 />
 </View>
 </View>

 <View className="flex-row gap-3 mt-8">
 <Pressable
 onPress={closeAddProduct}
 className="flex-1 border border-outline-variant py-4 rounded-2xl items-center"
 >
 <Text className="text-on-surface-variant font-bold text-base">Cancel</Text>
 </Pressable>
 <Pressable
 onPress={handleAddProduct}
 disabled={addProductLoading}
 className="flex-1 bg-primary py-4 rounded-2xl items-center"
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
 <Pressable className="bg-background rounded-t-3xl px-6 pt-6" style={{ paddingBottom: bottomInset + 24 }}>
 <Text className="text-lg font-bold text-on-surface mb-1">GST Rate for this bill</Text>
 <Text className="text-sm text-on-surface-variant mb-4">
 Only changes this item on this sale — the product&apos;s saved GST rate stays the same.
 </Text>
 <GstRatePicker value={gstEditValue} onChange={setGstEditValue} />
 <Pressable
 onPress={() => gstEditProductId && applyCustomTaxRate(gstEditProductId, gstEditValue)}
 className="bg-primary py-4 rounded-xl items-center mt-5"
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
 <View className="flex-1 bg-background px-5" style={{ paddingTop: topInset, paddingBottom: bottomInset }}>
 <View className="flex-row justify-between items-center mb-6">
 <Text className="text-2xl font-black text-on-surface">Parked Bills</Text>
 <Pressable onPress={() => setIsHeldBillsOpen(false)} className="w-10 h-10 rounded-full bg-surface-container items-center justify-center">
 <MaterialCommunityIcons name="close" size={18} color="#3e4944" />
 </Pressable>
 </View>

 {heldBillsLoading ? (
 <View className="flex-1 justify-center items-center">
 <ActivityIndicator size="large" color={theme.colors.primary} />
 </View>
 ) : heldBills.length === 0 ? (
 <View className="flex-1 justify-center items-center">
 <MaterialCommunityIcons name="pause-circle-outline" size={64} color="#D0D0D0" />
 <Text className="text-on-surface-variant text-base mt-4">No parked bills</Text>
 </View>
 ) : (
 <FlatList
 data={heldBills}
 keyExtractor={(item) => item.id}
 contentContainerStyle={{ paddingBottom: 24 }}
 ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
 renderItem={({ item }) => (
 <View className="bg-surface border border-outline-variant rounded-2xl px-4 py-4">
 <View className="flex-row justify-between items-start mb-2">
 <View className="flex-1 mr-3">
 <Text className="text-base font-bold text-on-surface" numberOfLines={1}>{item.label}</Text>
 {item.note ? <Text className="text-xs text-on-surface-variant mt-1">{item.note}</Text> : null}
 </View>
 <Text className="text-xs text-on-surface-variant">
 {new Date(item.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
 </Text>
 </View>
 <View className="flex-row" style={{ gap: 8 }}>
 <Pressable
 onPress={() => { setIsHeldBillsOpen(false); handleResumeBill(item); }}
 className="flex-1 flex-row items-center justify-center bg-primary py-3 rounded-xl active:opacity-90"
 style={{ gap: 5 }}
 >
 <MaterialCommunityIcons name="play-circle-outline" size={16} color="white" />
 <Text className="text-white font-bold text-sm">Resume</Text>
 </Pressable>
 <Pressable
 onPress={() => handleDeleteHeldBill(item)}
 className="w-12 h-11 rounded-xl border border-outline-variant items-center justify-center active:opacity-80"
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

 {/* PIN-gated checkout overlay */}
 <Modal visible={showPinModal} animationType="fade" transparent onRequestClose={() => setShowPinModal(false)}>
 <View className="flex-1 bg-black/40 justify-center items-center px-8">
 <View className="w-full max-w-sm bg-surface-container-lowest rounded-3xl p-8 border border-outline-variant shadow-xl">
 <Text className="text-xl font-bold text-on-surface text-center mb-1">Enter PIN</Text>
 <Text className="text-sm text-on-surface-variant text-center mb-6">Enter your Quick PIN to authorize this sale.</Text>
 <TextInput
 value={pinInput}
 onChangeText={(t) => { setPinInput(t.replace(/[^0-9]/g, "").slice(0, 4)); setPinError(""); }}
 keyboardType="number-pad"
 secureTextEntry
 maxLength={4}
 placeholder="• • • •"
 placeholderTextColor={theme.colors.onSurfaceVariant}
 autoFocus
 className="bg-background text-on-surface border border-outline-variant rounded-xl px-4 py-4 text-center text-2xl font-bold tracking-[12px] mb-2"
 />
 {pinError !== "" && <Text className="text-sm font-bold text-error text-center mb-2">{pinError}</Text>}
 <View className="flex-row mt-4" style={{ gap: 10 }}>
 <Pressable onPress={() => { setShowPinModal(false); setPinInput(""); setPinError(""); }}
 className="flex-1 border border-outline-variant py-3.5 rounded-xl items-center">
 <Text className="text-on-surface-variant font-bold">Cancel</Text>
 </Pressable>
 <Pressable onPress={verifyPinAndProceed} disabled={pinInput.length < 4}
 className={`flex-1 py-3.5 rounded-xl items-center ${pinInput.length < 4 ? "bg-primary/50" : "bg-primary"}`}>
 <Text className="text-white font-bold">Confirm</Text>
 </Pressable>
 </View>
 </View>
 </View>
 </Modal>
 </View>
 );
}

/* ── Helpers ── */
function Chip({ label, count, active, onPress }: { label: string; count?: number; active: boolean; onPress: () => void }) {
 return (
 <Pressable
 onPress={onPress}
 className={`rounded-full px-3.5 py-1.5 ${active ? "bg-primary" : "bg-surface-container-lowest border border-outline-variant"}`}
 >
 <Text className={`text-xs font-bold ${active ? "text-white" : "text-on-surface"}`}>
 {label}{count !== undefined ? ` (${count})` : ""}
 </Text>
 </Pressable>
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
 borderColor: "#03A8FE",
 backgroundColor: "transparent",
 borderRadius: 16,
 },
});
