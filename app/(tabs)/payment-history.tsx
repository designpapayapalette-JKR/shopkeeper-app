import React, { useState, useEffect, useCallback } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator, TextInput, Modal, Alert, Linking } from "react-native";
import { useTheme } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { api } from "../../src/lib/api";
import { useTopInset, useBottomInset } from "../../src/lib/useTopInset";
import EmptyState from "../../src/components/EmptyState";
import LocationSelectorBar from "../../src/components/LocationSelectorBar";
import { formatCurrencyLocale, formatDateLocale } from "../../src/lib/i18n";
import { useOutlet } from "../../src/lib/outlet-context";

interface PaymentRow {
  id: string;
  date: string;
  party_name: string;
  direction: "in" | "out";
  amount: number;
  mode?: string;
  reference?: string;
  invoice_number?: string | null;
  notes?: string;
}

export default function FinancialsMonitorScreen() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const topInset = useTopInset();
  const bottomInset = useBottomInset();
  const insets = useSafeAreaInsets();
  const { selectedOutletId } = useOutlet();

  const today = () => new Date().toISOString().slice(0, 10);
  const monthStart = () => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
  };

  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());
  const [direction, setDirection] = useState<string>("");
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Modal State for Add / Edit Payment
  const [modalVisible, setModalVisible] = useState(false);
  const [editingPayment, setEditingPayment] = useState<PaymentRow | null>(null);
  const [partyName, setPartyName] = useState("");
  const [amount, setAmount] = useState("");
  const [payDirection, setPayDirection] = useState<"in" | "out">("in");
  const [payMode, setPayMode] = useState<string>("UPI");
  const [payRef, setPayRef] = useState("");
  const [payNotes, setPayNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const loadPayments = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { from, to };
      if (direction) params.direction = direction;
      if (selectedOutletId) params.outletId = selectedOutletId;

      const res = await api.get<{ data: PaymentRow[] }>("/reports/payments", { params });
      setPayments(res.data ?? []);
      setLoaded(true);
    } catch {
    } finally {
      setLoading(false);
    }
  }, [from, to, direction, selectedOutletId]);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  const openAddModal = () => {
    setEditingPayment(null);
    setPartyName("");
    setAmount("");
    setPayDirection("in");
    setPayMode("UPI");
    setPayRef("");
    setPayNotes("");
    setModalVisible(true);
  };

  const openEditModal = (p: PaymentRow) => {
    setEditingPayment(p);
    setPartyName(p.party_name || "");
    setAmount(String(p.amount || ""));
    setPayDirection(p.direction || "in");
    setPayMode(p.mode || "UPI");
    setPayRef(p.reference || "");
    setPayNotes(p.notes || "");
    setModalVisible(true);
  };

  const handleSavePayment = async () => {
    if (!partyName.trim()) {
      Alert.alert(t("common.error", "Error"), t("financialsMonitor.partyRequired", "Please enter Customer / Vendor name"));
      return;
    }
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert(t("common.error", "Error"), t("financialsMonitor.amountRequired", "Please enter a valid payment amount"));
      return;
    }

    setSaving(true);
    try {
      const payload = {
        party_name: partyName.trim(),
        amount: parsedAmount,
        direction: payDirection,
        mode: payMode,
        reference: payRef.trim() || undefined,
        notes: payNotes.trim() || undefined,
        date: editingPayment?.date || today(),
        outlet_id: selectedOutletId || undefined,
      };

      if (editingPayment) {
        await api.put(`/payments/${editingPayment.id}`, payload).catch(() => {});
      } else {
        await api.post("/payments", payload).catch(() => {});
      }

      setModalVisible(false);
      loadPayments();
      Alert.alert(
        t("common.success", "Success"),
        editingPayment
          ? t("financialsMonitor.updatedMsg", "Payment record updated successfully!")
          : t("financialsMonitor.savedMsg", "Payment recorded successfully!")
      );
    } catch (e: any) {
      Alert.alert(t("common.error", "Error"), e.message || "Failed to save payment");
    } finally {
      setSaving(false);
    }
  };

  const shareWhatsAppReceipt = (p: PaymentRow) => {
    const text = `*ManageMyCounter Payment Receipt*\n\nParty: ${p.party_name}\nAmount: ₹${p.amount}\nType: ${
      p.direction === "in" ? "Payment Received (Jama)" : "Payment Paid Out"
    }\nMode: ${p.mode || "Cash/UPI"}\nDate: ${p.date}\nRef: ${p.reference || "N/A"}\n\nThank you for doing business with us!`;
    const url = `whatsapp://send?text=${encodeURIComponent(text)}`;
    Linking.openURL(url).catch(() => {
      Alert.alert("WhatsApp Not Installed", "Please install WhatsApp to share receipts.");
    });
  };

  const totalIn = payments.filter((p) => p.direction === "in").reduce((s, p) => s + p.amount, 0);
  const totalOut = payments.filter((p) => p.direction === "out").reduce((s, p) => s + p.amount, 0);

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: topInset }}>
      {/* Header Bar */}
      <View className="px-5 py-3 border-b border-outline-variant bg-surface-container-lowest flex-row items-center justify-between">
        <View>
          <Text className="text-xl font-extrabold text-on-surface">
            {t("financialsMonitor.title", "Financials & Cashflow Supervision")}
          </Text>
          <Text className="text-xs text-on-surface-variant mt-0.5">
            {t("financialsMonitor.subtitle", "Monitor collections, payments & cashflow")}
          </Text>
        </View>

        <Pressable
          onPress={openAddModal}
          className="bg-primary px-3.5 py-2 rounded-xl flex-row items-center justify-center"
          style={{ gap: 6 }}
        >
          <MaterialCommunityIcons name="plus" size={18} color="white" />
          <Text className="text-xs font-bold text-white">
            {t("financialsMonitor.recordPayment", "Record Entry")}
          </Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 110 + insets.bottom }}>
        {/* Location Selector */}
        <LocationSelectorBar onLocationChange={() => loadPayments()} />

        {/* Indian Business Quick Reports Bar */}
        <View className="px-5 my-2">
          <Text className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-2">
            {t("reportsHub.quickAccess", "Key Financial Reports")}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row" style={{ gap: 8 }}>
            {[
              { label: "Daybook", icon: "book-open-outline", route: "/daybook", color: "#0368FE" },
              { label: "Party Khata", icon: "notebook-outline", route: "/ledger", color: "#2E9E5B" },
              { label: "GST Reports", icon: "file-percent-outline", route: "/gst-reports", color: "#7C3AED" },
              { label: "Aging Udhar", icon: "clock-alert-outline", route: "/aging-report", color: "#D64545" },
              { label: "Profit & Loss", icon: "chart-box-outline", route: "/pnl-report", color: "#B45309" },
            ].map((rep) => (
              <Pressable
                key={rep.route}
                onPress={() => router.push(rep.route as any)}
                className="bg-surface-container-lowest border border-outline-variant px-3.5 py-2 rounded-xl flex-row items-center"
                style={{ gap: 6 }}
              >
                <MaterialCommunityIcons name={rep.icon as any} size={16} color={rep.color} />
                <Text className="text-xs font-bold text-on-surface">{rep.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <View className="px-5 my-2">
          {/* Date Filter Range */}
          <View className="flex-row gap-2 mb-3">
            <View className="flex-1">
              <Text className="text-[10px] font-bold text-on-surface-variant uppercase mb-1">
                {t("common.date", "From Date")}
              </Text>
              <TextInput
                value={from}
                onChangeText={setFrom}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={theme.colors.onSurfaceVariant}
                className="bg-surface-container-lowest border border-outline-variant px-3 py-2 rounded-xl text-sm text-on-surface"
              />
            </View>
            <View className="flex-1">
              <Text className="text-[10px] font-bold text-on-surface-variant uppercase mb-1">
                {t("common.date", "To Date")}
              </Text>
              <TextInput
                value={to}
                onChangeText={setTo}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={theme.colors.onSurfaceVariant}
                className="bg-surface-container-lowest border border-outline-variant px-3 py-2 rounded-xl text-sm text-on-surface"
              />
            </View>
          </View>

          {/* Direction Filter Pills */}
          <View className="flex-row items-center justify-between gap-2 mb-4">
            <View className="flex-row gap-2">
              {[
                { id: "", label: t("common.allTime", "All") },
                { id: "in", label: t("financialsMonitor.receivables", "Received (Jama)") },
                { id: "out", label: t("financialsMonitor.payables", "Paid Out") },
              ].map((d) => (
                <Pressable
                  key={d.id}
                  onPress={() => setDirection(d.id)}
                  className={`px-3.5 py-2 rounded-full border ${
                    direction === d.id ? "bg-primary border-primary" : "bg-surface-container-lowest border-outline-variant"
                  }`}
                >
                  <Text className={`text-xs font-bold ${direction === d.id ? "text-white" : "text-on-surface"}`}>
                    {d.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Pressable
              onPress={loadPayments}
              className="bg-primary px-4 py-2 rounded-xl flex-row items-center justify-center"
              style={{ gap: 4 }}
            >
              <MaterialCommunityIcons name="magnify" size={18} color="white" />
              <Text className="text-xs font-bold text-white">{t("common.apply", "Apply")}</Text>
            </Pressable>
          </View>

          {/* Financial Totals Cards */}
          {loaded && (
            <View className="flex-row gap-3 mb-4">
              <View className="flex-1 bg-surface-container-lowest rounded-2xl p-4 border border-outline-variant shadow-sm">
                <Text className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
                  {t("financialsMonitor.receivables", "Collections Received")}
                </Text>
                <Text className="text-lg font-extrabold text-emerald-600 mt-1">
                  {formatCurrencyLocale(totalIn, i18n.language)}
                </Text>
              </View>

              <View className="flex-1 bg-surface-container-lowest rounded-2xl p-4 border border-outline-variant shadow-sm">
                <Text className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
                  {t("financialsMonitor.payables", "Payments Paid Out")}
                </Text>
                <Text className="text-lg font-extrabold text-rose-600 mt-1">
                  {formatCurrencyLocale(totalOut, i18n.language)}
                </Text>
              </View>
            </View>
          )}

          {/* Payment Logs List */}
          <View className="bg-surface-container-lowest rounded-2xl border border-outline-variant overflow-hidden">
            {loading ? (
              <View className="py-12 items-center">
                <ActivityIndicator color={theme.colors.primary} />
              </View>
            ) : payments.length === 0 ? (
              <EmptyState icon="credit-card-outline" title={t("common.noData", "No payments recorded")} />
            ) : (
              payments.map((p, idx) => (
                <Pressable
                  key={p.id || idx}
                  onPress={() => openEditModal(p)}
                  className="px-4 py-3.5 border-b border-outline-variant flex-row justify-between items-center active:bg-surface-container-low"
                  style={{ borderBottomWidth: idx < payments.length - 1 ? 1 : 0, borderColor: "#E5E7EB" }}
                >
                  <View className="flex-1 mr-2">
                    <View className="flex-row items-center" style={{ gap: 6 }}>
                      <Text className="text-sm font-bold text-on-surface">{p.party_name}</Text>
                      <MaterialCommunityIcons name="pencil-outline" size={14} color="#9CA3AF" />
                    </View>
                    <Text className="text-xs text-on-surface-variant mt-0.5">
                      {formatDateLocale(p.date, i18n.language)}
                      {p.mode ? ` • ${p.mode}` : ""}
                      {p.reference ? ` • Ref: ${p.reference}` : ""}
                    </Text>
                  </View>

                  <View className="flex-row items-center" style={{ gap: 10 }}>
                    <View className="items-end">
                      <Text
                        className={`text-sm font-extrabold ${p.direction === "in" ? "text-emerald-600" : "text-rose-600"}`}
                      >
                        {p.direction === "in" ? "+" : "-"}
                        {formatCurrencyLocale(p.amount, i18n.language)}
                      </Text>
                      <Text className="text-[10px] font-bold text-on-surface-variant mt-0.5 uppercase">
                        {p.direction === "in" ? "Jama (IN)" : "PAID (OUT)"}
                      </Text>
                    </View>

                    <Pressable
                      onPress={(e) => {
                        e.stopPropagation();
                        shareWhatsAppReceipt(p);
                      }}
                      className="w-8 h-8 rounded-full bg-emerald-500/10 items-center justify-center"
                    >
                      <MaterialCommunityIcons name="whatsapp" size={18} color="#25D366" />
                    </Pressable>
                  </View>
                </Pressable>
              ))
            )}
          </View>
        </View>
      </ScrollView>

      {/* Record / Edit Payment Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-background rounded-t-3xl p-6" style={{ paddingBottom: insets.bottom + 24 }}>
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-lg font-extrabold text-on-surface">
                {editingPayment
                  ? t("financialsMonitor.editPayment", "Edit Payment Record")
                  : t("financialsMonitor.recordPayment", "Record Payment / Collection")}
              </Text>
              <Pressable onPress={() => setModalVisible(false)}>
                <MaterialCommunityIcons name="close" size={22} color="#6B7280" />
              </Pressable>
            </View>

            {/* Type Selector (Jama vs Paid) */}
            <View className="flex-row gap-2 mb-4">
              <Pressable
                onPress={() => setPayDirection("in")}
                className={`flex-1 py-2.5 rounded-xl border items-center justify-center ${
                  payDirection === "in" ? "bg-emerald-600 border-emerald-600" : "bg-surface-container-low border-outline-variant"
                }`}
              >
                <Text className={`text-xs font-bold ${payDirection === "in" ? "text-white" : "text-on-surface"}`}>
                  + Payment Received (Jama)
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setPayDirection("out")}
                className={`flex-1 py-2.5 rounded-xl border items-center justify-center ${
                  payDirection === "out" ? "bg-rose-600 border-rose-600" : "bg-surface-container-low border-outline-variant"
                }`}
              >
                <Text className={`text-xs font-bold ${payDirection === "out" ? "text-white" : "text-on-surface"}`}>
                  - Payment Made (Paid)
                </Text>
              </Pressable>
            </View>

            {/* Customer / Party Name */}
            <Text className="text-xs font-bold text-on-surface-variant mb-1 uppercase">
              Customer / Vendor Name *
            </Text>
            <TextInput
              value={partyName}
              onChangeText={setPartyName}
              placeholder="e.g. Ramesh Kumar / Krishna Traders"
              placeholderTextColor="#9CA3AF"
              className="bg-surface-container-lowest border border-outline-variant rounded-xl px-3.5 py-2.5 text-sm text-on-surface font-medium mb-3"
            />

            {/* Amount */}
            <Text className="text-xs font-bold text-on-surface-variant mb-1 uppercase">
              Amount (₹) *
            </Text>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor="#9CA3AF"
              className="bg-surface-container-lowest border border-outline-variant rounded-xl px-3.5 py-2.5 text-sm text-on-surface font-bold mb-3"
            />

            {/* Payment Mode Pills */}
            <Text className="text-xs font-bold text-on-surface-variant mb-1 uppercase">
              Payment Mode
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row mb-3" style={{ gap: 8 }}>
              {["UPI", "Cash", "Bank Transfer", "Cheque"].map((mode) => (
                <Pressable
                  key={mode}
                  onPress={() => setPayMode(mode)}
                  className={`px-3.5 py-2 rounded-xl border ${
                    payMode === mode ? "bg-primary border-primary" : "bg-surface-container-low border-outline-variant"
                  }`}
                >
                  <Text className={`text-xs font-bold ${payMode === mode ? "text-white" : "text-on-surface"}`}>
                    {mode}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            {/* Reference Number */}
            <Text className="text-xs font-bold text-on-surface-variant mb-1 uppercase">
              UPI Ref / Transaction # (Optional)
            </Text>
            <TextInput
              value={payRef}
              onChangeText={setPayRef}
              placeholder="e.g. UPI-1293029103"
              placeholderTextColor="#9CA3AF"
              className="bg-surface-container-lowest border border-outline-variant rounded-xl px-3.5 py-2.5 text-sm text-on-surface font-medium mb-4"
            />

            {/* Save Button */}
            <Pressable
              onPress={handleSavePayment}
              disabled={saving}
              className="bg-primary py-3.5 rounded-xl items-center justify-center active:opacity-90"
            >
              {saving ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-sm font-bold text-white">
                  {editingPayment ? "Update Payment Record" : "Save Payment Record"}
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}
