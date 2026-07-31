import React, { useState, useCallback } from "react";
import { Modal, View, Pressable, ActivityIndicator, Platform, Text } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { WebView } from "react-native-webview";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../lib/auth-context";
import { generateTallyInvoiceHtml } from "../lib/invoiceTemplate";
import { generateReceiptHtml } from "../lib/printer";
import { shareInvoiceFile } from "../lib/sharer";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

type InvoiceFormat = "tally" | "thermal";

interface InvoicePreviewModalProps {
  visible: boolean;
  onClose: () => void;
  detail: any;
}

export default function InvoicePreviewModal({ visible, onClose, detail }: InvoicePreviewModalProps) {
  const { activeCompany } = useAuth();
  const insets = useSafeAreaInsets();
  const [format, setFormat] = useState<InvoiceFormat>("thermal");
  const [busy, setBusy] = useState<"print" | "share" | null>(null);
  const [webViewReady, setWebViewReady] = useState(false);

  const html = format === "thermal"
    ? generateReceiptHtml(buildReceiptDataFromDetail(detail, activeCompany))
    : generateTallyInvoiceHtml(buildTallyDataFromDetail(detail, activeCompany));

  const handlePrint = useCallback(async () => {
    if (!detail) return;
    setBusy("print");
    try {
      const { uri } = await Print.printToFileAsync({ html, width: 612, height: 792 });
      await Print.printAsync({ uri });
    } catch {
    } finally {
      setBusy(null);
    }
  }, [detail, html]);

  const handleShare = useCallback(async () => {
    if (!detail) return;
    setBusy("share");
    try {
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        const { uri } = await Print.printToFileAsync({ html, width: 612, height: 792 });
        await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: `Invoice ${detail.invoice_number}` });
      }
    } finally {
      setBusy(null);
    }
  }, [detail, html]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
        <View className="flex-row justify-between items-center px-4 py-3 border-b border-outline-variant">
          <Pressable onPress={onClose} className="p-2">
            <MaterialCommunityIcons name="close" size={24} color="#3e4944" />
          </Pressable>
          <View className="flex-row items-center" style={{ gap: 8 }}>
            <Pressable onPress={() => setFormat("thermal")} className={`px-3 py-1.5 rounded-lg ${format === "thermal" ? "bg-primary" : "bg-surface-container"}`}>
              <Text className={`text-sm font-bold ${format === "thermal" ? "text-white" : "text-on-surface"}`}>Thermal</Text>
            </Pressable>
            <Pressable onPress={() => setFormat("tally")} className={`px-3 py-1.5 rounded-lg ${format === "tally" ? "bg-primary" : "bg-surface-container"}`}>
              <Text className={`text-sm font-bold ${format === "tally" ? "text-white" : "text-on-surface"}`}>Tally Style</Text>
            </Pressable>
          </View>
          <View className="flex-row" style={{ gap: 4 }}>
            <Pressable onPress={handlePrint} disabled={busy !== null} className="p-2 rounded-lg bg-surface-container active:bg-surface-container-high">
              {busy === "print" ? <ActivityIndicator size="small" color="#0368FE" /> : <MaterialCommunityIcons name="printer" size={22} color="#0368FE" />}
            </Pressable>
            <Pressable onPress={handleShare} disabled={busy !== null} className="p-2 rounded-lg bg-surface-container active:bg-surface-container-high">
              {busy === "share" ? <ActivityIndicator size="small" color="#0368FE" /> : <MaterialCommunityIcons name="share-variant" size={22} color="#0368FE" />}
            </Pressable>
          </View>
        </View>

        <View className="flex-1" style={{ backgroundColor: "#fff" }}>
          <WebView
            source={{ html }}
            style={{ flex: 1 }}
            onLoadEnd={() => setWebViewReady(true)}
            onError={() => setWebViewReady(true)}
            originWhitelist={["*"]}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            mixedContentMode="always"
            scalesPageToFit={Platform.OS === "android"}
            contentInset={{ top: 0, bottom: insets.bottom, left: 0, right: 0 }}
          />
        </View>
      </View>
    </Modal>
  );
}

function buildReceiptDataFromDetail(detail: any, activeCompany: any) {
  return {
    storeName: activeCompany?.name || "Merchant POS Store",
    storeAddress: activeCompany?.address,
    storePhone: activeCompany?.phone,
    gstNumber: activeCompany?.gstin,
    upiId: activeCompany?.upi_id,
    paperWidth: "58" as const,
    invoiceNumber: detail.invoice_number,
    date: new Date(detail.date).toLocaleDateString(),
    invoiceType: detail.type,
    items: detail.items.map((i: any) => ({
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
  };
}

function buildTallyDataFromDetail(detail: any, activeCompany: any) {
  const isGst = detail.type === "gst";
  const isInterstate = parseFloat(detail.igst_total || "0") > 0;
  const partyCategory = detail.party?.category || (detail.party?.gstin ? "b2b" : "b2c");

  return {
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
      name: detail.party?.name || "Walk-in Customer",
      phone: detail.party?.phone,
      gstin: detail.party?.gstin,
      state: detail.party?.state,
      category: partyCategory,
    },
    invoiceNumber: detail.invoice_number,
    date: new Date(detail.date).toLocaleDateString(),
    invoiceType: detail.type,
    items: detail.items.map((i: any) => ({
      name: i.product.name,
      hsnCode: i.product.hsn_code,
      quantity: parseFloat(i.quantity),
      price: parseFloat(i.price),
      taxRate: parseFloat(i.tax_rate),
      taxAmount: parseFloat(i.tax_amount),
      total: parseFloat(i.total),
    })),
    subtotal: parseFloat(detail.subtotal),
    discountTotal: parseFloat(detail.discount_total || "0"),
    cgst: parseFloat(detail.cgst_total || "0"),
    sgst: parseFloat(detail.sgst_total || "0"),
    igst: parseFloat(detail.igst_total || "0"),
    total: parseFloat(detail.grand_total),
    paymentMode: detail.payment_mode ?? undefined,
    extraCharge: parseFloat(detail.extra_charge_total || "0"),
    extraChargeLabel: detail.extra_charge_label ?? undefined,
  };
}