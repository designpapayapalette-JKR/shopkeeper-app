import React, { useState } from "react";
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

interface InvoiceItem {
  productId: string;
  quantity: number;
  price: number;
  taxRate: number;
  product?: { name?: string };
}

interface InvoiceDetail {
  id: string;
  invoiceNumber: string;
  party?: { id: string; name: string };
  items: InvoiceItem[];
  creditNotes?: { items: { productId: string; quantity: number }[] }[];
}

interface ReturnLine {
  productId: string;
  productName: string;
  maxQty: number;
  price: number;
  taxRate: number;
  quantity: string;
}

export default function CreditNoteScreen() {
  const topInset = useTopInset();
  const bottomInset = useBottomInset();

  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [lines, setLines] = useState<ReturnLine[]>([]);
  const [reason, setReason] = useState("");
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any | null>(null);

  const findInvoice = async () => {
    if (!invoiceNumber.trim()) return;
    setSearching(true);
    setInvoice(null);
    setLines([]);
    try {
      const listRes = await api.get<{ data: any[] }>("/invoices", { params: { search: invoiceNumber.trim() } });
      const found = listRes.data.find((i) => i.invoiceNumber === invoiceNumber.trim()) || listRes.data[0];
      if (!found) {
        Alert.alert("Not Found", "No invoice matches that number.");
        return;
      }
      const detailRes = await api.get<{ data: InvoiceDetail }>(`/invoices/${found.id}/detail`);
      const full = detailRes.data;
      setInvoice(full);
      const alreadyReturned: Record<string, number> = {};
      (full.creditNotes || []).forEach((cn) => cn.items.forEach((i) => { alreadyReturned[i.productId] = (alreadyReturned[i.productId] || 0) + Number(i.quantity); }));
      setLines(
        full.items.map((it) => ({
          productId: it.productId,
          productName: it.product?.name || it.productId,
          maxQty: Math.max(0, Number(it.quantity) - (alreadyReturned[it.productId] || 0)),
          price: Number(it.price),
          taxRate: Number(it.taxRate),
          quantity: "",
        }))
      );
    } catch (e) {
      Alert.alert("Error", e instanceof ApiError ? e.message : "Failed to look up invoice.");
    } finally {
      setSearching(false);
    }
  };

  const updateQty = (productId: string, value: string) => {
    setLines((prev) => prev.map((l) => (l.productId === productId ? { ...l, quantity: value } : l)));
  };

  const activeLines = lines.filter((l) => (parseFloat(l.quantity) || 0) > 0);
  const subtotal = activeLines.reduce((s, l) => s + l.price * (parseFloat(l.quantity) || 0), 0);

  const submit = async () => {
    if (!invoice || activeLines.length === 0) return;
    setSubmitting(true);
    try {
      const res = await api.post<{ data: any }>("/credit-notes", {
        invoiceId: invoice.id,
        reason: reason || undefined,
        items: activeLines.map((l) => ({ productId: l.productId, quantity: parseFloat(l.quantity), price: l.price, taxRate: l.taxRate })),
      });
      setResult(res.data);
      setInvoice(null);
      setLines([]);
      setInvoiceNumber("");
      setReason("");
    } catch (e) {
      Alert.alert("Error", e instanceof ApiError ? e.message : "Failed to create credit note.");
    } finally {
      setSubmitting(false);
    }
  };

  if (result) {
    return (
      <View className="flex-1 items-center justify-center bg-background dark:bg-bg-dark px-8" style={{ paddingTop: topInset }}>
        <MaterialCommunityIcons name="check-circle" size={48} color="#2E9E5B" />
        <Text className="text-xl font-black text-text-primary dark:text-text-primary-dark mt-3">Credit Note Created</Text>
        <Text className="text-base text-text-secondary mt-1">#{result.creditNoteNumber}</Text>
        <Text className="text-sm text-text-secondary mt-1">₹{Number(result.grandTotal).toLocaleString("en-IN")} — stock &amp; balance updated</Text>
        <View className="flex-row mt-6" style={{ gap: 10 }}>
          <Pressable onPress={() => setResult(null)} className="bg-primary px-5 py-3 rounded-xl">
            <Text className="text-white font-bold">New Credit Note</Text>
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
        <Text className="text-2xl font-black text-text-primary dark:text-text-primary-dark mb-1">Credit Note</Text>
        <Text className="text-sm text-text-secondary mb-4">Record a sales return against an existing invoice.</Text>

        <View className="flex-row mb-4" style={{ gap: 8 }}>
          <TextInput
            value={invoiceNumber}
            onChangeText={setInvoiceNumber}
            placeholder="Invoice number, e.g. INV-2026-000123"
            placeholderTextColor="#A0A0A0"
            className="flex-1 bg-surface dark:bg-surface-dark border border-gray-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-base font-medium text-text-primary"
          />
          <Pressable onPress={findInvoice} disabled={searching} className="bg-primary px-5 rounded-xl items-center justify-center">
            {searching ? <ActivityIndicator color="white" size="small" /> : <Text className="text-white font-bold">Find</Text>}
          </Pressable>
        </View>

        {invoice && (
          <>
            <Text className="text-sm text-text-secondary mb-2">
              Customer: <Text className="font-bold text-text-primary dark:text-text-primary-dark">{invoice.party?.name || "—"}</Text>
            </Text>

            {lines.map((l) => (
              <View key={l.productId} className="bg-surface dark:bg-surface-dark p-4 rounded-xl border border-gray-100 dark:border-zinc-800 mb-3">
                <Text className="font-bold text-on-surface dark:text-text-primary-dark mb-1">{l.productName}</Text>
                <View className="flex-row justify-between items-center">
                  <Text className="text-sm text-text-secondary">₹{l.price} × max {l.maxQty}</Text>
                  <TextInput
                    value={l.quantity}
                    onChangeText={(v) => updateQty(l.productId, v)}
                    placeholder="0"
                    keyboardType="numeric"
                    editable={l.maxQty > 0}
                    className="bg-background dark:bg-bg-dark border border-gray-200 dark:border-zinc-800 rounded-xl px-3 py-2.5 text-base font-bold w-20 text-center"
                  />
                </View>
              </View>
            ))}

            <Text className="text-sm font-semibold text-on-surface-variant dark:text-text-secondary-dark uppercase tracking-wider mb-2">Reason</Text>
            <TextInput
              value={reason}
              onChangeText={setReason}
              placeholder="Damaged goods, wrong item, etc."
              placeholderTextColor="#A0A0A0"
              className="bg-surface dark:bg-surface-dark border border-gray-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-base font-medium text-text-primary mb-4"
            />

            {activeLines.length > 0 && (
              <View className="flex-row justify-between items-center py-3 border-t border-gray-100 dark:border-zinc-800 mb-4">
                <Text className="text-base font-bold text-text-primary dark:text-text-primary-dark">Credit Amount</Text>
                <Text className="text-lg font-black text-text-primary dark:text-text-primary-dark">₹{subtotal.toLocaleString("en-IN")}</Text>
              </View>
            )}

            <Pressable
              onPress={submit}
              disabled={submitting || activeLines.length === 0}
              className="bg-primary py-4 rounded-xl items-center"
              style={{ marginBottom: bottomInset + 16, opacity: submitting || activeLines.length === 0 ? 0.5 : 1 }}
            >
              {submitting ? <ActivityIndicator color="white" /> : <Text className="text-white font-bold text-base">Create Credit Note</Text>}
            </Pressable>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
