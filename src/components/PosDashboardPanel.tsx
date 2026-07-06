import React, { useCallback, useEffect, useState } from "react";
import { View, Text, FlatList, ActivityIndicator, Pressable, Alert, TextInput, Modal, ScrollView } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
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

  // Return / Credit Note modal state
  const [returnDetail, setReturnDetail] = useState<InvoiceDetail | null>(null);
  const [returnQuantities, setReturnQuantities] = useState<Record<string, string>>({});
  const [returnReason, setReturnReason] = useState("");
  const [submittingReturn, setSubmittingReturn] = useState(false);
  const [refundNow, setRefundNow] = useState(false);
  const [refundMode, setRefundMode] = useState<"cash" | "upi">("cash");

  const [summary, setSummary] = useState<PosSummary | null>(null);
  const [defaultPaperWidth, setDefaultPaperWidth] = useState<ThermalPaperWidth>("58");

  useEffect(() => {
    getDefaultPrinter().then((p) => setDefaultPaperWidth(p?.paperWidth ?? "58"));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [invRes, summaryRes] = await Promise.all([
        api.get<{ data: InvoiceSummary[] }>("/invoices"),
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
    });
  };

  const handleOpenInvoice = useCallback(
    async (invoice: InvoiceSummary) => {
      setOpeningId(invoice.id);
      try {
        const res = await api.get<{ data: InvoiceDetail }>(`/invoices/${invoice.id}/detail`);
        const detail = res.data;

        const offerPrintOrShare = (formatLabel: string, format: "tally" | "thermal") => {
          const thermalPageSize =
            format === "thermal"
              ? { width: thermalPageWidthPt(defaultPaperWidth), height: estimateThermalPageHeightPt(detail.items.length, !!activeCompany?.upi_id) }
              : undefined;
          Alert.alert(formatLabel, `Invoice ${detail.invoice_number} — what would you like to do?`, [
            {
              text: "Print",
              onPress: async () => {
                try {
                  if (format === "thermal") {
                    const saved = await getDefaultPrinter();
                    if (saved) {
                      try {
                        await printToSavedPrinter(buildReceiptDataFromDetail(detail), saved);
                        return;
                      } catch {
                        Alert.alert("Printer Unreachable", `Could not reach ${saved.name}. Falling back to the system print dialog.`);
                      }
                    }
                  }
                  await Print.printAsync({ html: buildHtmlFromDetail(detail, format), ...thermalPageSize });
                } catch (e: any) {
                  Alert.alert("Print Error", e.message || "Could not print invoice.");
                }
              },
            },
            {
              text: "Share",
              onPress: async () => {
                try {
                  await shareInvoiceFile(buildHtmlFromDetail(detail, format), `Invoice ${detail.invoice_number}`, thermalPageSize);
                } catch (e: any) {
                  Alert.alert("Share Error", e.message || "Could not share invoice.");
                }
              },
            },
            { text: "Cancel", style: "cancel" },
          ]);
        };

        // Tally-style is only meaningful for GST invoices — a retail/estimate
        // bill only ever had a thermal receipt, so skip straight to it.
        if (detail.type === "gst") {
          Alert.alert("Reprint Invoice", `Invoice ${detail.invoice_number} — choose a format.`, [
            { text: "Tally Style Invoice", onPress: () => offerPrintOrShare("Tally Style Invoice", "tally") },
            { text: "Thermal Receipt", onPress: () => offerPrintOrShare("Thermal Receipt", "thermal") },
            { text: "Cancel", style: "cancel" },
          ]);
        } else {
          offerPrintOrShare("Thermal Receipt", "thermal");
        }
      } catch (e) {
        Alert.alert("Error", "Could not load this invoice's details.");
      } finally {
        setOpeningId(null);
      }
    },
    [activeCompany, defaultPaperWidth]
  );

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
    <View className="flex-1 bg-background dark:bg-bg-dark">
      <View className="px-4 pb-3" style={{ gap: 12 }}>
        {summary && (
          <>
            <View className="flex-row" style={{ gap: 8 }}>
              <View className="flex-1 bg-surface dark:bg-surface-dark border border-outline-variant dark:border-outline rounded-xl p-3">
                <Text className="text-xs font-bold text-on-surface-variant dark:text-text-secondary-dark uppercase tracking-wider">Today's Sales</Text>
                <Text className="text-lg font-black text-primary dark:text-primary-dark mt-1">₹{summary.today_sales_total.toFixed(0)}</Text>
              </View>
              <View className="flex-1 bg-surface dark:bg-surface-dark border border-outline-variant dark:border-outline rounded-xl p-3">
                <Text className="text-xs font-bold text-on-surface-variant dark:text-text-secondary-dark uppercase tracking-wider">Bills Today</Text>
                <Text className="text-lg font-black text-on-surface dark:text-text-primary-dark mt-1">{summary.today_txn_count}</Text>
              </View>
              <View className="flex-1 bg-surface dark:bg-surface-dark border border-outline-variant dark:border-outline rounded-xl p-3">
                <Text className="text-xs font-bold text-on-surface-variant dark:text-text-secondary-dark uppercase tracking-wider">Avg Bill</Text>
                <Text className="text-lg font-black text-on-surface dark:text-text-primary-dark mt-1">₹{summary.average_bill.toFixed(0)}</Text>
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
                  <View key={t.key} className="flex-1 bg-surface dark:bg-surface-dark border border-outline-variant dark:border-outline rounded-xl p-3">
                    <View className="flex-row items-center" style={{ gap: 4 }}>
                      <MaterialCommunityIcons name={t.icon as any} size={12} color="#6B7280" />
                      <Text className="text-xs font-bold text-on-surface-variant dark:text-text-secondary-dark uppercase tracking-wider">{t.label}</Text>
                    </View>
                    <Text className="text-base font-black text-on-surface dark:text-text-primary-dark mt-1">₹{stat.total.toFixed(0)}</Text>
                    <Text className="text-xs text-on-surface-variant dark:text-text-secondary-dark mt-0.5">{stat.count} bill{stat.count !== 1 ? "s" : ""}</Text>
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
          className="bg-surface dark:bg-surface-dark text-on-surface dark:text-text-primary-dark border border-outline-variant dark:border-outline rounded-xl px-4 py-3 text-base"
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
                  ? "bg-primary border-primary dark:bg-primary-dark"
                  : "bg-surface dark:bg-surface-dark border-outline-variant dark:border-outline"
              }`}
            >
              <Text className={`text-xs font-bold ${typeFilter === key ? "text-white" : "text-on-surface-variant dark:text-text-secondary-dark"}`}>
                {TYPE_LABEL[key]}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {loading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#0F7A5F" />
        </View>
      ) : filtered.length === 0 ? (
        <View className="flex-1 justify-center items-center py-20">
          <Text className="text-on-surface-variant dark:text-text-secondary-dark font-bold text-base">
            No invoices found
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingTop: 0, gap: 12, paddingBottom: 16 + bottomInset }}
          renderItem={({ item }) => (
            <View className="bg-surface dark:bg-surface-dark rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm">
              <Pressable
                onPress={() => handleOpenInvoice(item)}
                disabled={openingId === item.id}
                className="p-4 flex-row justify-between items-center"
              >
                <View className="flex-1 mr-2">
                  <Text className="font-bold text-base text-text-primary dark:text-text-primary-dark">
                    {item.invoice_number}
                  </Text>
                  <Text className="text-sm text-text-secondary mt-1">
                    {new Date(item.date).toLocaleDateString()} · {item.type.toUpperCase()}
                  </Text>
                </View>
                <View className="items-end">
                  <Text className="text-base font-black text-text-primary dark:text-text-primary-dark">
                    ₹{parseFloat(item.grand_total).toFixed(2)}
                  </Text>
                  {openingId === item.id ? (
                    <ActivityIndicator size="small" color="#0F7A5F" style={{ marginTop: 4 }} />
                  ) : (
                    <Text className="text-sm text-primary font-bold mt-1 uppercase">
                      {item.payment_status}
                    </Text>
                  )}
                </View>
              </Pressable>
              <View className="border-t border-gray-100 dark:border-zinc-800 flex-row">
                <Pressable
                  onPress={() => handleOpenReturn(item)}
                  className="flex-1 py-2.5 items-center border-r border-gray-100 dark:border-zinc-800"
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
        <ScrollView className="flex-1 bg-background dark:bg-bg-dark px-6 pb-10" style={{ paddingTop: topInset }}>
          <View className="flex-row justify-between items-center mb-6">
            <Text className="text-2xl font-bold text-on-surface dark:text-text-primary-dark">
              Return / Credit Note
            </Text>
            <Pressable onPress={closeReturn} className="w-11 h-11 items-center justify-center">
              <MaterialCommunityIcons name="close" size={20} color="#6B7280" />
            </Pressable>
          </View>

          {returnDetail && (
            <>
              <Text className="text-sm text-on-surface-variant dark:text-text-secondary-dark mb-6">
                Against invoice {returnDetail.invoice_number}. Enter the quantity being returned for each item — leave at 0 for items not being returned.
              </Text>

              {returnDetail.items.map((item) => (
                <View
                  key={item.product.id}
                  className="flex-row justify-between items-center bg-surface dark:bg-surface-dark p-4 rounded-xl border border-gray-100 dark:border-zinc-800 mb-3"
                >
                  <View className="flex-1 mr-3">
                    <Text className="font-bold text-on-surface dark:text-text-primary-dark">{item.product.name}</Text>
                    <Text className="text-sm text-on-surface-variant dark:text-text-secondary-dark">
                      Sold: {parseFloat(item.quantity).toFixed(0)} @ ₹{parseFloat(item.price).toFixed(2)}
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

              <Text className="text-sm font-semibold text-on-surface-variant dark:text-text-secondary-dark uppercase tracking-wider mb-2 mt-2">
                Reason (optional)
              </Text>
              <TextInput
                value={returnReason}
                onChangeText={setReturnReason}
                placeholder="e.g. damaged goods, wrong item"
                placeholderTextColor="#A0A0A0"
                className="bg-surface dark:bg-surface-dark text-on-surface dark:text-text-primary-dark border border-outline-variant dark:border-outline rounded-xl px-4 py-4 text-base font-medium mb-6"
              />

              <Pressable
                onPress={() => setRefundNow(!refundNow)}
                className={`flex-row items-center justify-between p-4 rounded-xl border mb-4 ${
                  refundNow ? "bg-error/10 border-error/30" : "bg-surface dark:bg-surface-dark border-outline-variant dark:border-outline"
                }`}
              >
                <View className="flex-1 mr-3">
                  <Text className="font-bold text-on-surface dark:text-text-primary-dark">Refund in cash/UPI now</Text>
                  <Text className="text-sm text-on-surface-variant dark:text-text-secondary-dark mt-0.5">
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
                          : "bg-surface dark:bg-surface-dark border-outline-variant dark:border-outline"
                      }`}
                    >
                      <Text className={`text-sm font-bold uppercase ${refundMode === m ? "text-white" : "text-on-surface dark:text-text-primary-dark"}`}>
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
      </Modal>
    </View>
  );
}
