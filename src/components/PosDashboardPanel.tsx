import React, { useCallback, useEffect, useState } from "react";
import { View, Text, FlatList, ActivityIndicator, Pressable, Alert, TextInput, Modal, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "react-native-paper";
import * as Print from "expo-print";
import { useAuth } from "../lib/auth-context";
import { api, ApiError } from "../lib/api";
import { useConfirm } from "./ConfirmDialog";
import { generateReceiptHtml, ReceiptData, thermalPageWidthPt, estimateThermalPageHeightPt, ThermalPaperWidth } from "../lib/printer";
import { generateTallyInvoiceHtml, TallyInvoiceItem } from "../lib/invoiceTemplate";
import { shareInvoiceFile } from "../lib/sharer";
import { printToSavedPrinter, getDefaultPrinter } from "../lib/thermalPrinter";
import { useBottomInset } from "../lib/useBottomInset";
import { useTopInset } from "../lib/useTopInset";

interface InvoiceSummary {
 id: string;
 invoice_number: string;
 date: string;
 type: "gst" | "retail" | "estimate";
 grand_total: string;
 payment_status: string;
}

interface InvoiceDetailItem {
 quantity: string;
 price: string;
 tax_rate: string;
 tax_amount: string;
 total: string;
 product: { id: string; name: string; hsn_code?: string };
}

interface InvoiceDetail {
 id: string;
 invoice_number: string;
 date: string;
 type: "gst" | "retail" | "estimate";
 subtotal: string;
 discount_total: string;
 cgst_total: string;
 sgst_total: string;
 igst_total: string;
 grand_total: string;
 payment_mode?: "cash" | "upi" | "credit" | null;
 extra_charge_total?: string | null;
 extra_charge_label?: string | null;
 items: InvoiceDetailItem[];
 party: {
 id: string;
 name: string;
 phone?: string;
 gstin?: string;
 state?: string;
 category?: "b2b" | "b2c";
 };
}

interface TypeBreakdown {
 count: number;
 total: number;
}

interface PosSummary {
 today_sales_total: number;
 today_txn_count: number;
 average_bill: number;
 today_by_type: { gst: TypeBreakdown; retail: TypeBreakdown; estimate: TypeBreakdown };
}

type TypeFilter = "all" | "gst" | "retail" | "estimate";

const TYPE_LABEL: Record<TypeFilter, string> = {
 all: "All",
 gst: "GST",
 retail: "Retail",
 estimate: "Estimate",
};

// The real, working POS dashboard — retail bills, GST/B2B invoices, and
// estimates all in one place, with a live today's-sales breakdown by type
// and every action (reprint in either format, partial return with an
// optional immediate cash/UPI refund, or a full void that reverses stock +
// ledger) reachable in one or two taps. Rendered both embedded inside the
// POS tab itself (as its "Dashboard" mode) and as the standalone Invoice
// History screen reached from Recent Activity deep-links.
export default function PosDashboardPanel({ autoOpenInvoiceId }: { autoOpenInvoiceId?: string }) {
 const theme = useTheme();
 const { activeCompany } = useAuth();
 const confirm = useConfirm();
 const bottomInset = useBottomInset();
 const topInset = useTopInset();
 const [invoices, setInvoices] = useState<InvoiceSummary[]>([]);
 const [loading, setLoading] = useState(true);
 const [search, setSearch] = useState("");
 const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
 const [openingId, setOpeningId] = useState<string | null>(null);
 const [voidingId, setVoidingId] = useState<string | null>(null);
 const [autoOpenedId, setAutoOpenedId] = useState<string | null>(null);

 // Invoice Preview modal — tapping an invoice now shows a real read-only
 // preview first; Print/Share are actions taken from inside the preview,
 // instead of firing an Alert chooser the instant you tap the row.
 const [previewDetail, setPreviewDetail] = useState<InvoiceDetail | null>(null);
 const [previewFormat, setPreviewFormat] = useState<"tally" | "thermal">("thermal");
 const [previewBusy, setPreviewBusy] = useState<"print" | "share" | null>(null);

 // Return / Credit Note modal state
 const [returnDetail, setReturnDetail] = useState<InvoiceDetail | null>(null);
 const [returnQuantities, setReturnQuantities] = useState<Record<string, string>>({});
 const [returnReason, setReturnReason] = useState("");
 const [submittingReturn, setSubmittingReturn] = useState(false);
 const [refundNow, setRefundNow] = useState(false);
 const [refundMode, setRefundMode] = useState<"cash" | "upi">("cash");

 const [summary, setSummary] = useState<PosSummary | null>(null);
 const [defaultPaperWidth, setDefaultPaperWidth] = useState<ThermalPaperWidth>("58");

 // GSTR reports
 const [isGstrOpen, setIsGstrOpen] = useState(false);
 const [gstrLoading, setGstrLoading] = useState(false);
 const [gstrData, setGstrData] = useState<{ gstr1?: any; gstr3b?: any }>({});
 const [gstrMonth, setGstrMonth] = useState(() => {
 const d = new Date();
 return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
 });

 const fetchGstrReports = useCallback(async () => {
 setGstrLoading(true);
 try {
 const [y, m] = gstrMonth.split("-");
 const from = new Date(parseInt(y), parseInt(m) - 1, 1);
 const to = new Date(parseInt(y), parseInt(m), 0, 23, 59, 59, 999);
 const params = { from: from.toISOString(), to: to.toISOString() };
 const [gstr1Res, gstr3bRes] = await Promise.all([
 api.get<{ data: any }>("/reports/gstr-1", { params }),
 api.get<{ data: any }>("/reports/gstr-3b", { params }),
 ]);
 setGstrData({ gstr1: gstr1Res.data, gstr3b: gstr3bRes.data });
 } catch (e) {
 console.error("Failed to load GSTR reports:", e);
 Alert.alert("Error", "Could not load GST returns for this period.");
 } finally {
 setGstrLoading(false);
 }
 }, [gstrMonth]);

 const handleExportGstr1 = async () => {
 if (!gstrData.gstr1) return;
 try {
 const Sharing = await import("expo-sharing");
 const { File, Paths } = await import("expo-file-system");
 const json = JSON.stringify(gstrData.gstr1, null, 2);
 const filename = `gstr1_${gstrMonth}.json`;
 const file = new File(Paths.cache, filename);
 if (file.exists) file.delete();
 file.create();
 file.write(json);
 await Sharing.shareAsync(file.uri, { mimeType: "application/json", dialogTitle: `GSTR-1 ${gstrMonth}` });
 } catch (e) {
 Alert.alert("Error", "Failed to export GSTR-1 JSON.");
 }
 };

 useEffect(() => {
 getDefaultPrinter().then((p) => setDefaultPaperWidth(p?.paperWidth ?? "58"));
 }, []);

 const load = useCallback(async () => {
 setLoading(true);
 try {
 // Recent Transactions is always today-only and scoped to this tab's
 // channel at the data layer — historical bills live in Reports/
 // Daybook instead, per the hard UX rule.
 const startOfDay = new Date();
 startOfDay.setHours(0, 0, 0, 0);
 const [invRes, summaryRes] = await Promise.all([
 api.get<{ data: InvoiceSummary[] }>("/invoices", { params: { channel: "pos", startDate: startOfDay.toISOString() } }),
 api.get<{ data: PosSummary }>("/invoices/pos/summary"),
 ]);
 setInvoices(invRes.data ?? []);
 setSummary(summaryRes.data);
 } catch (e) {
 console.error("Failed to load POS dashboard:", e);
 } finally {
 setLoading(false);
 }
 }, []);

 useEffect(() => {
 load();
 }, [load]);

 const filtered = invoices.filter((inv) => {
 if (typeFilter !== "all" && inv.type !== typeFilter) return false;
 return inv.invoice_number.toLowerCase().includes(search.trim().toLowerCase());
 });

 const buildReceiptDataFromDetail = (detail: InvoiceDetail): ReceiptData => ({
 storeName: activeCompany?.name || "Merchant POS Store",
 storeAddress: activeCompany?.address,
 storePhone: activeCompany?.phone,
 gstNumber: activeCompany?.gstin,
 upiId: activeCompany?.upi_id || undefined,
 paperWidth: defaultPaperWidth,
 invoiceNumber: detail.invoice_number,
 date: new Date(detail.date).toLocaleDateString(),
 invoiceType: detail.type,
 items: detail.items.map((i) => ({
 name: i.product.name,
 quantity: parseFloat(i.quantity),
 price: parseFloat(i.price),
 total: parseFloat(i.total),
 })),
 subtotal: parseFloat(detail.subtotal),
 cgst: parseFloat(detail.cgst_total || "0"),
 sgst: parseFloat(detail.sgst_total || "0"),
 igst: parseFloat(detail.igst_total || "0"),
 total: parseFloat(detail.grand_total),
 paymentMode: detail.payment_mode ?? undefined,
 extraCharge: parseFloat(detail.extra_charge_total || "0"),
 extraChargeLabel: detail.extra_charge_label ?? undefined,
 });

 const buildHtmlFromDetail = (detail: InvoiceDetail, format: "tally" | "thermal") => {
 const subtotal = parseFloat(detail.subtotal);
 const total = parseFloat(detail.grand_total);
 const gstSplit = {
 cgst: parseFloat(detail.cgst_total || "0"),
 sgst: parseFloat(detail.sgst_total || "0"),
 igst: parseFloat(detail.igst_total || "0"),
 };

 if (format === "thermal") {
 return generateReceiptHtml(buildReceiptDataFromDetail(detail));
 }

 const tallyItems: TallyInvoiceItem[] = detail.items.map((i) => ({
 name: i.product.name,
 hsnCode: i.product.hsn_code,
 quantity: parseFloat(i.quantity),
 price: parseFloat(i.price),
 taxRate: parseFloat(i.tax_rate),
 taxAmount: parseFloat(i.tax_amount),
 total: parseFloat(i.total),
 }));

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
 name: detail.party.name,
 phone: detail.party.phone,
 gstin: detail.party.gstin,
 state: detail.party.state,
 category: detail.party.category || "b2c",
 },
 invoiceNumber: detail.invoice_number,
 date: new Date(detail.date).toLocaleDateString(),
 invoiceType: detail.type,
 items: tallyItems,
 subtotal,
 discountTotal: parseFloat(detail.discount_total || "0"),
 cgst: gstSplit.cgst,
 sgst: gstSplit.sgst,
 igst: gstSplit.igst,
 total,
 paymentMode: detail.payment_mode ?? undefined,
 extraCharge: parseFloat(detail.extra_charge_total || "0"),
 extraChargeLabel: detail.extra_charge_label ?? undefined,
 });
 };

 const handleOpenInvoice = useCallback(
 async (invoice: InvoiceSummary) => {
 setOpeningId(invoice.id);
 try {
 const res = await api.get<{ data: InvoiceDetail }>(`/invoices/${invoice.id}/detail`);
 setPreviewFormat("thermal");
 setPreviewDetail(res.data);
 } catch (e) {
 Alert.alert("Error", "Could not load this invoice's details.");
 } finally {
 setOpeningId(null);
 }
 },
 []
 );

 const closePreview = () => setPreviewDetail(null);

 const handlePrintPreview = async () => {
 if (!previewDetail) return;
 setPreviewBusy("print");
 try {
 if (previewFormat === "thermal") {
 const saved = await getDefaultPrinter();
 if (saved) {
 try {
 await printToSavedPrinter(buildReceiptDataFromDetail(previewDetail), saved);
 return;
 } catch {
 Alert.alert("Printer Unreachable", `Could not reach ${saved.name}. Falling back to the system print dialog.`);
 }
 }
 }
 const thermalPageSize =
 previewFormat === "thermal"
 ? { width: thermalPageWidthPt(defaultPaperWidth), height: estimateThermalPageHeightPt(previewDetail.items.length, !!activeCompany?.upi_id) }
 : undefined;
 await Print.printAsync({ html: buildHtmlFromDetail(previewDetail, previewFormat), ...thermalPageSize });
 } catch (e: any) {
 Alert.alert("Print Error", e.message || "Could not print invoice.");
 } finally {
 setPreviewBusy(null);
 }
 };

 const handleSharePreview = async () => {
 if (!previewDetail) return;
 setPreviewBusy("share");
 try {
 const thermalPageSize =
 previewFormat === "thermal"
 ? { width: thermalPageWidthPt(defaultPaperWidth), height: estimateThermalPageHeightPt(previewDetail.items.length, !!activeCompany?.upi_id) }
 : undefined;
 await shareInvoiceFile(buildHtmlFromDetail(previewDetail, previewFormat), `Invoice ${previewDetail.invoice_number}`, thermalPageSize);
 } catch (e: any) {
 Alert.alert("Share Error", e.message || "Could not share invoice.");
 } finally {
 setPreviewBusy(null);
 }
 };

 const [settingStatusId, setSettingStatusId] = useState<string | null>(null);
 const [partialModalInvoice, setPartialModalInvoice] = useState<InvoiceSummary | null>(null);
 const [partialAmount, setPartialAmount] = useState("");

 const handleSetPaymentStatus = async (invoice: InvoiceSummary, status: "paid" | "partial" | "hold", amountPaid?: number) => {
 setSettingStatusId(invoice.id);
 try {
 await api.patch(`/invoices/${invoice.id}/payment-status`, { status, ...(amountPaid !== undefined ? { amount_paid: amountPaid } : {}) });
 setPartialModalInvoice(null);
 setPartialAmount("");
 load();
 } catch (e) {
 Alert.alert("Error", e instanceof ApiError ? e.message : "Failed to update payment status.");
 } finally {
 setSettingStatusId(null);
 }
 };

 const handleVoidInvoice = async (invoice: InvoiceSummary) => {
 const ok = await confirm({
 title: "Void this invoice?",
 message: `Invoice ${invoice.invoice_number} will be cancelled — its stock is put back and, if it was a credit sale, the customer's balance is reversed. This can't be undone from here.`,
 confirmLabel: "Void Invoice",
 destructive: true,
 });
 if (!ok) return;

 setVoidingId(invoice.id);
 try {
 await api.post(`/invoices/${invoice.id}/void`);
 Alert.alert("Invoice Voided", "Stock and ledger balances have been reversed.");
 load();
 } catch (e) {
 Alert.alert("Error", e instanceof ApiError ? e.message : "Failed to void invoice.");
 } finally {
 setVoidingId(null);
 }
 };

 const handleOpenReturn = async (invoice: InvoiceSummary) => {
 setOpeningId(invoice.id);
 try {
 const res = await api.get<{ data: InvoiceDetail }>(`/invoices/${invoice.id}/detail`);
 setReturnDetail(res.data);
 setReturnQuantities({});
 setReturnReason("");
 setRefundNow(false);
 setRefundMode("cash");
 } catch (e) {
 Alert.alert("Error", "Could not load this invoice's details.");
 } finally {
 setOpeningId(null);
 }
 };

 const closeReturn = async () => {
 const hasChanges =
 returnReason.trim().length > 0 ||
 refundNow ||
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
 setReturnDetail(null);
 };

 const handleSubmitReturn = async () => {
 if (!returnDetail) return;
 const items = returnDetail.items
 .map((i) => ({
 productId: i.product.id,
 quantity: parseFloat(returnQuantities[i.product.id] || "0"),
 price: parseFloat(i.price),
 taxRate: parseFloat(i.tax_rate),
 }))
 .filter((i) => i.quantity > 0);

 if (items.length === 0) {
 Alert.alert("Nothing to Return", "Enter a quantity greater than 0 for at least one item.");
 return;
 }

 setSubmittingReturn(true);
 try {
 const res = await api.post<{ data: { grand_total: string } }>("/credit-notes", {
 invoiceId: returnDetail.id,
 reason: returnReason || undefined,
 items,
 });

 // A credit note only adjusts the party's ledger balance (store credit
 // for next time). If the shop wants to hand back real cash/UPI right
 // now instead, record that as an actual payment-out so the balance
 // nets back to zero instead of sitting as an open credit.
 if (refundNow) {
 await api.post("/ledger/payments", {
 partyId: returnDetail.party.id,
 direction: "out",
 amount: parseFloat(res.data.grand_total),
 mode: refundMode,
 reference: `Refund against ${returnDetail.invoice_number}`,
 });
 }

 Alert.alert(
 "Credit Note Created",
 refundNow
 ? "Stock has been restocked and the refund has been recorded as paid out."
 : "Stock and the customer's balance have been updated."
 );
 setReturnDetail(null);
 load();
 } catch (e) {
 Alert.alert("Error", e instanceof ApiError ? e.message : "Failed to create credit note.");
 } finally {
 setSubmittingReturn(false);
 }
 };

 // Deep-link support: Recent Activity / Activity Log rows can pass a
 // specific invoice id (via the standalone Invoice History screen wrapper)
 // so tapping "New bill #INV-..." jumps straight into that invoice's
 // reprint/share flow instead of just landing on the general list.
 useEffect(() => {
 if (!autoOpenInvoiceId || autoOpenInvoiceId === autoOpenedId || invoices.length === 0) return;
 const match = invoices.find((inv) => inv.id === autoOpenInvoiceId);
 if (match) {
 setAutoOpenedId(autoOpenInvoiceId);
 handleOpenInvoice(match);
 }
 }, [autoOpenInvoiceId, invoices, autoOpenedId, handleOpenInvoice]);

 return (
 <View className="flex-1 bg-background ">
 <View className="px-4 pb-3" style={{ gap: 12 }}>
 {summary && (
 <>
 <View className="flex-row" style={{ gap: 8 }}>
 <View className="flex-1 bg-surface border border-outline-variant rounded-xl p-3">
 <Text className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Today&apos;s Sales</Text>
 <Text className="text-lg font-black text-primary mt-1">₹{summary.today_sales_total.toFixed(0)}</Text>
 </View>
 <View className="flex-1 bg-surface border border-outline-variant rounded-xl p-3">
 <Text className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Bills Today</Text>
 <Text className="text-lg font-black text-on-surface mt-1">{summary.today_txn_count}</Text>
 </View>
 <View className="flex-1 bg-surface border border-outline-variant rounded-xl p-3">
 <Text className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Avg Bill</Text>
 <Text className="text-lg font-black text-on-surface mt-1">₹{summary.average_bill.toFixed(0)}</Text>
 </View>
 </View>

 {/* Retail / GST / Estimate breakdown — a shop running both
 retail counter sales and B2B GST billing wants to see each
 at a glance, not one blended number. */}
 <View className="flex-row" style={{ gap: 8 }}>
 {(
 [
 { key: "retail" as const, label: "Retail", icon: "storefront-outline" },
 { key: "gst" as const, label: "GST / B2B", icon: "file-document-outline" },
 { key: "estimate" as const, label: "Estimates", icon: "file-clock-outline" },
 ] as const
 ).map((t) => {
 const stat = summary.today_by_type[t.key];
 return (
 <View key={t.key} className="flex-1 bg-surface border border-outline-variant rounded-xl p-3">
 <View className="flex-row items-center" style={{ gap: 4 }}>
 <MaterialCommunityIcons name={t.icon as any} size={12} color="#6B7280" />
 <Text className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">{t.label}</Text>
 </View>
 <Text className="text-base font-black text-on-surface mt-1">₹{stat.total.toFixed(0)}</Text>
 <Text className="text-xs text-on-surface-variant mt-0.5">{stat.count} bill{stat.count !== 1 ? "s" : ""}</Text>
 </View>
 );
 })}
 </View>
 </>
 )}

 <TextInput
 value={search}
 onChangeText={setSearch}
 placeholder="Search by invoice number"
 placeholderTextColor="#A0A0A0"
 className="bg-surface text-on-surface border border-outline-variant rounded-xl px-4 py-3 text-base"
 />

 {/* Type filter — lets the shopkeeper jump straight to "just GST
 invoices" or "just retail bills" instead of scrolling everything. */}
 <View className="flex-row" style={{ gap: 6 }}>
 {(Object.keys(TYPE_LABEL) as TypeFilter[]).map((key) => (
 <Pressable
 key={key}
 onPress={() => setTypeFilter(key)}
 className={`flex-1 py-2 rounded-lg items-center border ${
 typeFilter === key
 ? "bg-primary border-primary "
 : "bg-surface border-outline-variant "
 }`}
 >
 <Text className={`text-xs font-bold ${typeFilter === key ? "text-white" : "text-on-surface-variant "}`}>
 {TYPE_LABEL[key]}
 </Text>
 </Pressable>
 ))}
 </View>

 {/* GST Returns — opens GSTR-1 / GSTR-3B reports for filing */}
 <Pressable
 onPress={() => { fetchGstrReports(); setIsGstrOpen(true); }}
 className="flex-row items-center justify-center bg-surface border border-outline-variant rounded-xl py-3 active:opacity-80"
 style={{ gap: 6 }}
 >
 <MaterialCommunityIcons name="file-document-edit-outline" size={16} color={theme.colors.primary} />
 <Text className="text-sm font-bold text-primary ">GST Returns</Text>
 </Pressable>
 </View>

 {loading ? (
 <View className="flex-1 justify-center items-center">
 <ActivityIndicator size="large" color={theme.colors.primary} />
 </View>
 ) : filtered.length === 0 ? (
 <View className="flex-1 justify-center items-center py-20">
 <Text className="text-on-surface-variant font-bold text-base">
 No invoices found
 </Text>
 </View>
 ) : (
 <FlatList
 data={filtered}
 keyExtractor={(item) => item.id}
 contentContainerStyle={{ padding: 16, paddingTop: 0, gap: 12, paddingBottom: 16 + bottomInset }}
 renderItem={({ item }) => (
 <View className="bg-surface rounded-2xl border border-gray-100 shadow-sm">
 <Pressable
 onPress={() => handleOpenInvoice(item)}
 disabled={openingId === item.id}
 className="p-4 flex-row justify-between items-center"
 >
 <View className="flex-1 mr-2">
 <Text className="font-bold text-base text-text-primary ">
 {item.invoice_number}
 </Text>
 <Text className="text-sm text-text-secondary mt-1">
 {new Date(item.date).toLocaleDateString()} · {item.type.toUpperCase()}
 </Text>
 </View>
 <View className="items-end">
 <Text className="text-base font-black text-text-primary ">
 ₹{parseFloat(item.grand_total).toFixed(2)}
 </Text>
 {openingId === item.id ? (
 <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginTop: 4 }} />
 ) : (
 <Text className="text-sm text-primary font-bold mt-1 uppercase">
 {item.payment_status === "unpaid" ? "Hold" : item.payment_status === "partial" ? "Partial Paid" : item.payment_status}
 </Text>
 )}
 </View>
 </Pressable>
 {item.type !== "estimate" && (
 <View className="border-t border-gray-100 flex-row">
 <Pressable
 onPress={() => handleSetPaymentStatus(item, "hold")}
 disabled={settingStatusId === item.id}
 className="flex-1 py-2.5 items-center border-r border-gray-100 "
 >
 {settingStatusId === item.id ? (
 <ActivityIndicator size="small" color={theme.colors.primary} />
 ) : (
 <Text className="text-sm font-bold text-primary">Hold</Text>
 )}
 </Pressable>
 <Pressable
 onPress={() => { setPartialModalInvoice(item); setPartialAmount(""); }}
 className="flex-1 py-2.5 items-center"
 >
 <Text className="text-sm font-bold text-primary">Partial Paid</Text>
 </Pressable>
 </View>
 )}
 <View className="border-t border-gray-100 flex-row">
 <Pressable
 onPress={() => handleOpenReturn(item)}
 className="flex-1 py-2.5 items-center border-r border-gray-100 "
 >
 <View className="flex-row items-center" style={{ gap: 5 }}>
 <MaterialCommunityIcons name="undo-variant" size={15} color="#D64545" />
 <Text className="text-sm font-bold text-error">Return</Text>
 </View>
 </Pressable>
 <Pressable
 onPress={() => handleVoidInvoice(item)}
 disabled={voidingId === item.id}
 className="flex-1 py-2.5 items-center"
 >
 {voidingId === item.id ? (
 <ActivityIndicator size="small" color="#D64545" />
 ) : (
 <View className="flex-row items-center" style={{ gap: 5 }}>
 <MaterialCommunityIcons name="cancel" size={15} color="#D64545" />
 <Text className="text-sm font-bold text-error">Void</Text>
 </View>
 )}
 </Pressable>
 </View>
 </View>
 )}
 />
 )}

 <Modal visible={returnDetail !== null} animationType="slide" onRequestClose={closeReturn}>
 <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : undefined}>
 <ScrollView className="flex-1 bg-background px-6 pb-10" style={{ paddingTop: topInset }} keyboardShouldPersistTaps="handled">
 <View className="flex-row justify-between items-center mb-6">
 <Text className="text-2xl font-bold text-on-surface ">
 Return / Credit Note
 </Text>
 <Pressable onPress={closeReturn} className="w-11 h-11 items-center justify-center">
 <MaterialCommunityIcons name="close" size={20} color="#6B7280" />
 </Pressable>
 </View>

 {returnDetail && (
 <>
 <Text className="text-sm text-on-surface-variant mb-6">
 Against invoice {returnDetail.invoice_number}. Enter the quantity being returned for each item — leave at 0 for items not being returned.
 </Text>

 {returnDetail.items.map((item) => (
 <View
 key={item.product.id}
 className="flex-row justify-between items-center bg-surface p-4 rounded-xl border border-gray-100 mb-3"
 >
 <View className="flex-1 mr-3">
 <Text className="font-bold text-on-surface ">{item.product.name}</Text>
 <Text className="text-sm text-on-surface-variant ">
 Sold: {parseFloat(item.quantity).toFixed(0)} @ ₹{parseFloat(item.price).toFixed(2)}
 </Text>
 </View>
 <TextInput
 value={returnQuantities[item.product.id] || ""}
 onChangeText={(v) => setReturnQuantities((prev) => ({ ...prev, [item.product.id]: v }))}
 placeholder="0"
 keyboardType="numeric"
 className="bg-background text-on-surface border border-outline-variant rounded-xl px-4 py-3 text-base font-bold w-20 text-center"
 />
 </View>
 ))}

 <Text className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider mb-2 mt-2">
 Reason (optional)
 </Text>
 <TextInput
 value={returnReason}
 onChangeText={setReturnReason}
 placeholder="e.g. damaged goods, wrong item"
 placeholderTextColor="#A0A0A0"
 className="bg-surface text-on-surface border border-outline-variant rounded-xl px-4 py-4 text-base font-medium mb-6"
 />

 <Pressable
 onPress={() => setRefundNow(!refundNow)}
 className={`flex-row items-center justify-between p-4 rounded-xl border mb-4 ${
 refundNow ? "bg-error/10 border-error/30" : "bg-surface border-outline-variant "
 }`}
 >
 <View className="flex-1 mr-3">
 <Text className="font-bold text-on-surface ">Refund in cash/UPI now</Text>
 <Text className="text-sm text-on-surface-variant mt-0.5">
 Off = store credit for next purchase. On = pay them back right now.
 </Text>
 </View>
 <MaterialCommunityIcons
 name={refundNow ? "toggle-switch" : "toggle-switch-off-outline"}
 size={32}
 color={refundNow ? "#D64545" : "#9E9E9E"}
 />
 </Pressable>

 {refundNow && (
 <View className="flex-row mb-8" style={{ gap: 8 }}>
 {(["cash", "upi"] as const).map((m) => (
 <Pressable
 key={m}
 onPress={() => setRefundMode(m)}
 className={`flex-1 py-3.5 rounded-xl border items-center ${
 refundMode === m
 ? "bg-error border-error"
 : "bg-surface border-outline-variant "
 }`}
 >
 <Text className={`text-sm font-bold uppercase ${refundMode === m ? "text-white" : "text-on-surface "}`}>
 {m}
 </Text>
 </Pressable>
 ))}
 </View>
 )}
 {!refundNow && <View className="mb-4" />}

 <Pressable
 onPress={handleSubmitReturn}
 disabled={submittingReturn}
 className="bg-error py-4 rounded-xl items-center"
 style={{ marginBottom: bottomInset }}
 >
 {submittingReturn ? (
 <ActivityIndicator color="white" />
 ) : (
 <Text className="text-white font-bold text-base">
 {refundNow ? "Create Credit Note & Refund" : "Create Credit Note"}
 </Text>
 )}
 </Pressable>
 </>
 )}
 </ScrollView>
 </KeyboardAvoidingView>
 </Modal>

 {/* Invoice Preview — tapping an invoice used to fire an Alert asking
 Print/Share immediately with no way to actually see it first. Now
 it opens a real read-only preview, and Print/Share are actions
 taken from inside it. */}
 <Modal visible={previewDetail !== null} animationType="slide" onRequestClose={closePreview}>
 <View className="flex-1 bg-background " style={{ paddingTop: topInset }}>
 <View className="flex-row justify-between items-center px-6 mb-4">
 <Text className="text-2xl font-bold text-on-surface ">Invoice</Text>
 <Pressable onPress={closePreview} className="w-11 h-11 items-center justify-center">
 <MaterialCommunityIcons name="close" size={20} color="#6B7280" />
 </Pressable>
 </View>

 {previewDetail && (
 <>
 <ScrollView className="flex-1 px-6" contentContainerStyle={{ paddingBottom: 24 }}>
 <View className="bg-surface p-4 rounded-xl border border-gray-100 mb-4">
 <Text className="text-lg font-bold text-on-surface ">
 {previewDetail.invoice_number}
 </Text>
 <Text className="text-sm text-on-surface-variant mt-0.5">
 {new Date(previewDetail.date).toLocaleDateString()} · {previewDetail.type.toUpperCase()}
 </Text>
 <Text className="text-base font-semibold text-on-surface mt-2">
 {previewDetail.party.name}
 </Text>
 {!!previewDetail.party.phone && (
 <Text className="text-sm text-on-surface-variant ">{previewDetail.party.phone}</Text>
 )}
 {!!previewDetail.party.gstin && (
 <Text className="text-sm text-on-surface-variant ">GSTIN: {previewDetail.party.gstin}</Text>
 )}
 </View>

 {previewDetail.items.map((item, idx) => (
 <View
 key={`${item.product.id}-${idx}`}
 className="flex-row justify-between items-center bg-surface p-3 rounded-xl border border-gray-100 mb-2"
 >
 <View className="flex-1 mr-3">
 <Text className="font-bold text-on-surface ">{item.product.name}</Text>
 <Text className="text-sm text-on-surface-variant ">
 {parseFloat(item.quantity).toFixed(0)} × ₹{parseFloat(item.price).toFixed(2)}
 {parseFloat(item.tax_rate) > 0 ? ` · ${item.tax_rate}% GST` : ""}
 </Text>
 </View>
 <Text className="font-bold text-on-surface ">
 ₹{parseFloat(item.total).toFixed(2)}
 </Text>
 </View>
 ))}

 <View className="bg-surface p-4 rounded-xl border border-gray-100 mt-2" style={{ gap: 4 }}>
 <View className="flex-row justify-between">
 <Text className="text-on-surface-variant ">Subtotal</Text>
 <Text className="text-on-surface ">₹{parseFloat(previewDetail.subtotal).toFixed(2)}</Text>
 </View>
 {parseFloat(previewDetail.discount_total || "0") > 0 && (
 <View className="flex-row justify-between">
 <Text className="text-on-surface-variant ">Discount</Text>
 <Text className="text-on-surface ">−₹{parseFloat(previewDetail.discount_total).toFixed(2)}</Text>
 </View>
 )}
 {previewDetail.type === "gst" && (
 <>
 {parseFloat(previewDetail.cgst_total || "0") > 0 && (
 <View className="flex-row justify-between">
 <Text className="text-on-surface-variant ">CGST</Text>
 <Text className="text-on-surface ">₹{parseFloat(previewDetail.cgst_total).toFixed(2)}</Text>
 </View>
 )}
 {parseFloat(previewDetail.sgst_total || "0") > 0 && (
 <View className="flex-row justify-between">
 <Text className="text-on-surface-variant ">SGST</Text>
 <Text className="text-on-surface ">₹{parseFloat(previewDetail.sgst_total).toFixed(2)}</Text>
 </View>
 )}
 {parseFloat(previewDetail.igst_total || "0") > 0 && (
 <View className="flex-row justify-between">
 <Text className="text-on-surface-variant ">IGST</Text>
 <Text className="text-on-surface ">₹{parseFloat(previewDetail.igst_total).toFixed(2)}</Text>
 </View>
 )}
 </>
 )}
 {!!previewDetail.extra_charge_label && parseFloat(previewDetail.extra_charge_total || "0") > 0 && (
 <View className="flex-row justify-between">
 <Text className="text-on-surface-variant ">{previewDetail.extra_charge_label}</Text>
 <Text className="text-on-surface ">₹{parseFloat(previewDetail.extra_charge_total!).toFixed(2)}</Text>
 </View>
 )}
 <View className="flex-row justify-between border-t border-gray-100 pt-2 mt-1">
 <Text className="font-bold text-lg text-on-surface ">Total</Text>
 <Text className="font-bold text-lg text-primary ">₹{parseFloat(previewDetail.grand_total).toFixed(2)}</Text>
 </View>
 </View>
 </ScrollView>

 <View className="px-6" style={{ paddingBottom: bottomInset + 12, gap: 10 }}>
 {/* Tally-style only makes sense for GST invoices — a retail/
 estimate bill only ever had a thermal receipt. */}
 {previewDetail.type === "gst" && (
 <View className="flex-row bg-surface rounded-xl border border-gray-100 p-1">
 {(["thermal", "tally"] as const).map((f) => (
 <Pressable
 key={f}
 onPress={() => setPreviewFormat(f)}
 className={`flex-1 py-2 rounded-lg items-center ${previewFormat === f ? "bg-primary " : ""}`}
 >
 <Text className={`font-semibold text-sm ${previewFormat === f ? "text-white" : "text-on-surface "}`}>
 {f === "thermal" ? "Thermal Receipt" : "Tally Style"}
 </Text>
 </Pressable>
 ))}
 </View>
 )}
 <View className="flex-row" style={{ gap: 10 }}>
 <Pressable
 onPress={handlePrintPreview}
 disabled={previewBusy !== null}
 className="flex-1 bg-primary py-3.5 rounded-xl items-center flex-row justify-center"
 style={{ gap: 8 }}
 >
 {previewBusy === "print" ? (
 <ActivityIndicator color="white" />
 ) : (
 <>
 <MaterialCommunityIcons name="printer-outline" size={18} color="#ffffff" />
 <Text className="text-white font-bold text-base">Print</Text>
 </>
 )}
 </Pressable>
 <Pressable
 onPress={handleSharePreview}
 disabled={previewBusy !== null}
 className="flex-1 bg-surface border border-gray-200 py-3.5 rounded-xl items-center flex-row justify-center"
 style={{ gap: 8 }}
 >
 {previewBusy === "share" ? (
 <ActivityIndicator color={theme.colors.primary} />
 ) : (
 <>
 <MaterialCommunityIcons name="share-variant-outline" size={18} color={theme.colors.primary} />
 <Text className="text-primary font-bold text-base">Share</Text>
 </>
 )}
 </Pressable>
 </View>
 </View>
 </>
 )}
 </View>
 </Modal>

 {/* ══════ GSTR Reports Modal ══════ */}
 <Modal visible={isGstrOpen} animationType="slide" onRequestClose={() => setIsGstrOpen(false)}>
 <View className="flex-1 bg-background " style={{ paddingTop: topInset }}>
 <View className="px-5 pb-4 border-b border-outline-variant flex-row justify-between items-center">
 <Text className="text-2xl font-black text-on-surface ">GST Returns</Text>
 <Pressable onPress={() => setIsGstrOpen(false)} className="w-10 h-10 rounded-full bg-surface-container items-center justify-center">
 <MaterialCommunityIcons name="close" size={18} color="#3e4944" />
 </Pressable>
 </View>

 <View className="px-5 pt-4 pb-3">
 <View className="bg-surface border border-outline-variant rounded-2xl px-4 py-3 flex-row items-center" style={{ gap: 8 }}>
 <MaterialCommunityIcons name="calendar-month" size={18} color={theme.colors.primary} />
 <TextInput
 value={gstrMonth}
 onChangeText={(t) => setGstrMonth(t)}
 placeholder="YYYY-MM"
 placeholderTextColor="#A0A0A0"
 className="flex-1 text-base font-bold text-on-surface "
 />
 <Pressable onPress={fetchGstrReports} className="bg-primary px-4 py-2 rounded-xl active:opacity-90">
 {gstrLoading ? (
 <ActivityIndicator size="small" color="white" />
 ) : (
 <Text className="text-white font-bold text-sm">Load</Text>
 )}
 </Pressable>
 </View>
 </View>

 {gstrLoading ? (
 <View className="flex-1 justify-center items-center">
 <ActivityIndicator size="large" color={theme.colors.primary} />
 </View>
 ) : !gstrData.gstr1 && !gstrData.gstr3b ? (
 <View className="flex-1 justify-center items-center px-5">
 <MaterialCommunityIcons name="file-document-outline" size={64} color="#D0D0D0" />
 <Text className="text-on-surface-variant text-base mt-4 text-center">Tap &quot;Load&quot; to generate GSTR-1 and GSTR-3B for this period.</Text>
 </View>
 ) : (
 <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingBottom: 32 }}>
 {/* GSTR-3B Summary */}
 {gstrData.gstr3b && (
 <View className="bg-surface border border-outline-variant rounded-2xl p-4 mb-4">
 <Text className="text-lg font-black text-on-surface mb-3">GSTR-3B Summary</Text>
 <View className="mb-3" style={{ gap: 8 }}>
 <View className="flex-row justify-between">
 <Text className="text-sm text-on-surface-variant">Invoices</Text>
 <Text className="text-sm font-bold text-on-surface">{gstrData.gstr3b.summary?.totalInvoices ?? 0}</Text>
 </View>
 <View className="flex-row justify-between">
 <Text className="text-sm text-on-surface-variant">Credit Notes</Text>
 <Text className="text-sm font-bold text-on-surface">{gstrData.gstr3b.summary?.totalCreditNotes ?? 0}</Text>
 </View>
 <View className="flex-row justify-between">
 <Text className="text-sm text-on-surface-variant">Outward Taxable Value</Text>
 <Text className="text-sm font-bold text-on-surface">₹{(gstrData.gstr3b.summary?.totalOutwardTxval ?? 0).toLocaleString("en-IN")}</Text>
 </View>
 <View className="flex-row justify-between">
 <Text className="text-sm text-on-surface-variant">Outward Tax (CGST+SGST+IGST)</Text>
 <Text className="text-sm font-bold text-primary">₹{(gstrData.gstr3b.summary?.totalOutwardTax ?? 0).toLocaleString("en-IN")}</Text>
 </View>
 <View className="flex-row justify-between">
 <Text className="text-sm text-on-surface-variant">ITC Available</Text>
 <Text className="text-sm font-bold text-green-600">₹{(gstrData.gstr3b.summary?.totalITC ?? 0).toLocaleString("en-IN")}</Text>
 </View>
 </View>
 {/* Tax rate breakdown */}
 {gstrData.gstr3b.sup_details?.osup_det && (
 <View className="bg-surface-container-lowest rounded-xl p-3">
 <Text className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2">Tax Rate Breakup</Text>
 {gstrData.gstr3b.itc_elg?.itc_avl?.length > 0 ? (
 gstrData.gstr3b.itc_elg.itc_avl.map((b: any, i: number) => (
 <View key={i} className="flex-row justify-between py-1">
 <Text className="text-xs text-on-surface-variant">{b.rt}%</Text>
 <Text className="text-xs font-bold text-on-surface">₹{b.txval.toLocaleString("en-IN")}</Text>
 </View>
 ))
 ) : (
 <Text className="text-xs text-on-surface-variant">No ITC data</Text>
 )}
 </View>
 )}
 </View>
 )}

 {/* GSTR-1 Summary */}
 {gstrData.gstr1 && (
 <View className="bg-surface border border-outline-variant rounded-2xl p-4 mb-4">
 <Text className="text-lg font-black text-on-surface mb-3">GSTR-1 Summary</Text>
 <View style={{ gap: 8 }}>
 <View className="flex-row justify-between">
 <Text className="text-sm text-on-surface-variant">B2B Invoices</Text>
 <Text className="text-sm font-bold text-on-surface">{gstrData.gstr1.b2b?.length ?? 0}</Text>
 </View>
 <View className="flex-row justify-between">
 <Text className="text-sm text-on-surface-variant">B2C (Small) Invoices</Text>
 <Text className="text-sm font-bold text-on-surface">{gstrData.gstr1.b2cs?.length ?? 0}</Text>
 </View>
 <View className="flex-row justify-between">
 <Text className="text-sm text-on-surface-variant">Credit Notes</Text>
 <Text className="text-sm font-bold text-on-surface">{gstrData.gstr1.cdnr?.length ?? 0}</Text>
 </View>
 <View className="flex-row justify-between">
 <Text className="text-sm text-on-surface-variant">HSN Categories</Text>
 <Text className="text-sm font-bold text-on-surface">{gstrData.gstr1.hsn?.length ?? 0}</Text>
 </View>
 <View className="flex-row justify-between">
 <Text className="text-sm text-on-surface-variant">Gross Turnover</Text>
 <Text className="text-sm font-bold text-on-surface">₹{(gstrData.gstr1.gt ?? 0).toLocaleString("en-IN")}</Text>
 </View>
 </View>

 {/* HSN-wise table */}
 {gstrData.gstr1.hsn?.length > 0 && (
 <View className="mt-4 bg-surface-container-lowest rounded-xl p-3">
 <Text className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2">HSN-wise Summary</Text>
 {gstrData.gstr1.hsn.map((h: any, i: number) => (
 <View key={i} className="flex-row justify-between py-1 border-b border-outline-variant/30">
 <View className="flex-1">
 <Text className="text-xs font-bold text-on-surface">{h.hsn_sc}</Text>
 <Text className="text-[10px] text-on-surface-variant">{h.rt}% · {h.qty} qty</Text>
 </View>
 <Text className="text-xs font-bold text-on-surface">₹{h.txval.toLocaleString("en-IN")}</Text>
 </View>
 ))}
 </View>
 )}
 </View>
 )}

 {/* Export buttons */}
 <View style={{ gap: 10 }}>
 {gstrData.gstr1 && (
 <Pressable onPress={handleExportGstr1} className="flex-row items-center justify-center bg-primary py-4 rounded-2xl active:opacity-90" style={{ gap: 8 }}>
 <MaterialCommunityIcons name="file-export-outline" size={18} color="white" />
 <Text className="text-white font-bold text-base">Export GSTR-1 JSON</Text>
 </Pressable>
 )}
 </View>
 </ScrollView>
 )}
 </View>
 </Modal>

 {/* Partial Paid amount entry */}
 <Modal visible={partialModalInvoice !== null} transparent animationType="fade">
 <View className="flex-1 bg-black/40 justify-center items-center px-8">
 <View className="w-full max-w-sm bg-white rounded-3xl p-6">
 <Text className="text-lg font-bold text-gray-900 mb-1">Record Partial Payment</Text>
 <Text className="text-sm text-gray-500 mb-4">
 {partialModalInvoice?.invoice_number} — Total ₹{partialModalInvoice ? parseFloat(partialModalInvoice.grand_total).toFixed(2) : "0.00"}
 </Text>
 <TextInput
 value={partialAmount}
 onChangeText={setPartialAmount}
 placeholder="Amount paid so far"
 keyboardType="numeric"
 className="bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-900 mb-4"
 autoFocus
 />
 <View className="flex-row gap-3">
 <Pressable onPress={() => { setPartialModalInvoice(null); setPartialAmount(""); }} className="flex-1 py-3 rounded-xl border border-gray-200 ">
 <Text className="text-sm font-bold text-gray-600 text-center">Cancel</Text>
 </Pressable>
 <Pressable
 onPress={() => partialModalInvoice && handleSetPaymentStatus(partialModalInvoice, "partial", Number(partialAmount) || 0)}
 disabled={settingStatusId === partialModalInvoice?.id}
 className="flex-1 bg-primary py-3 rounded-xl"
 >
 <Text className="text-sm font-bold text-white text-center">Save</Text>
 </Pressable>
 </View>
 </View>
 </View>
 </Modal>
 </View>
 );
}
