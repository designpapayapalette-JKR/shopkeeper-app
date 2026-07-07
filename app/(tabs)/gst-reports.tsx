import React, { useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  TextInput,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { api } from "../../src/lib/api";
import { rowsToCsv, shareCsv } from "../../src/lib/csvExport";
import { useTopInset } from "../../src/lib/useTopInset";
import { useTerminology } from "../../src/lib/terminology-context";

// Note: shopkeeper-api returns camelCase, but src/lib/api.ts converts every
// response body through toSnakeCase() before handing it back — so every
// field here is snake_case, matching the convention used across the rest of
// this app (see caseConvert.ts). Do not read these as camelCase.

type ReportTab = "hsn" | "gst" | "daybook";

const TABS: { key: ReportTab; label: string }[] = [
  { key: "hsn", label: "HSN Summary" },
  { key: "gst", label: "GST Return Data" },
  { key: "daybook", label: "Day Book" },
];

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function monthStartStr() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

interface HsnRow {
  hsn_code: string;
  tax_rate: number;
  total_quantity: number;
  total_taxable_value: number;
  total_tax_amount: number;
  invoice_item_count: number;
}

interface GstSaleRow {
  invoice_number: string;
  date: string;
  party_name: string;
  gstin?: string;
  taxable_value: number;
  cgst: number;
  sgst: number;
  igst: number;
  grand_total: number;
}

interface GstPurchaseRow {
  purchase_number: string;
  date: string;
  supplier_name: string;
  gstin?: string;
  taxable_value: number;
  tax_total: number;
  grand_total: number;
}

interface GstSummary {
  sales_b2_b: GstSaleRow[];
  sales_b2_c: GstSaleRow[];
  purchase_register: GstPurchaseRow[];
}

interface DayBook {
  date: string;
  invoices: { invoice_number: string; party_name: string; grand_total: number; payment_status: string }[];
  purchases: { purchase_number: string; supplier_name: string; grand_total: number }[];
  payments_in: { party_name: string; amount: number; mode?: string; reference?: string }[];
  payments_out: { party_name: string; amount: number; mode?: string; reference?: string }[];
  expenses: { category: string; amount: number; notes?: string }[];
  total_in: number;
  total_out: number;
  net: number;
}

export default function GstReportsScreen() {
  const topInset = useTopInset();
  const { t } = useTerminology();
  const params = useLocalSearchParams<{ tab?: string }>();
  const initialTab: ReportTab = params.tab === "daybook" || params.tab === "gst" ? (params.tab as ReportTab) : "hsn";
  const [activeTab, setActiveTab] = useState<ReportTab>(initialTab);
  const [from, setFrom] = useState(monthStartStr());
  const [to, setTo] = useState(todayStr());
  const [dayBookDate, setDayBookDate] = useState(todayStr());
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [hsnRows, setHsnRows] = useState<HsnRow[] | null>(null);
  const [gstSummary, setGstSummary] = useState<GstSummary | null>(null);
  const [dayBook, setDayBook] = useState<DayBook | null>(null);

  const handleRunHsn = async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: HsnRow[] }>("/reports/hsn-summary", { params: { from, to } });
      setHsnRows(res.data ?? []);
    } catch (e) {
      Alert.alert("Error", "Could not load the HSN summary.");
    } finally {
      setLoading(false);
    }
  };

  const handleRunGst = async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: GstSummary }>("/reports/gst-summary", { params: { from, to } });
      setGstSummary(res.data);
    } catch (e) {
      Alert.alert("Error", "Could not load GST return data.");
    } finally {
      setLoading(false);
    }
  };

  const handleRunDayBook = async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: DayBook }>("/reports/day-book", { params: { date: dayBookDate } });
      setDayBook(res.data);
    } catch (e) {
      Alert.alert("Error", "Could not load the day book.");
    } finally {
      setLoading(false);
    }
  };

  const handleExportHsn = async () => {
    if (!hsnRows || hsnRows.length === 0) return;
    setExporting(true);
    try {
      const csv = rowsToCsv(
        ["HSN Code", "Tax Rate %", "Total Quantity", "Taxable Value", "Tax Amount", "Line Items"],
        hsnRows.map((r) => [r.hsn_code, r.tax_rate, r.total_quantity.toFixed(2), r.total_taxable_value.toFixed(2), r.total_tax_amount.toFixed(2), r.invoice_item_count])
      );
      await shareCsv(csv, `HSN-Summary-${from}-to-${to}.csv`);
    } catch (e: any) {
      Alert.alert("Export Failed", e?.message || "Could not export the report.");
    } finally {
      setExporting(false);
    }
  };

  const handleExportGst = async () => {
    if (!gstSummary) return;
    setExporting(true);
    try {
      const lines: string[] = [];
      lines.push("B2B SALES");
      lines.push(rowsToCsv(
        ["Invoice No", "Date", "Party", "GSTIN", "Taxable Value", "CGST", "SGST", "IGST", "Grand Total"],
        gstSummary.sales_b2_b.map((r) => [r.invoice_number, new Date(r.date).toLocaleDateString(), r.party_name, r.gstin || "", r.taxable_value.toFixed(2), r.cgst.toFixed(2), r.sgst.toFixed(2), r.igst.toFixed(2), r.grand_total.toFixed(2)])
      ));
      lines.push("");
      lines.push("B2C SALES");
      lines.push(rowsToCsv(
        ["Invoice No", "Date", "Party", "Taxable Value", "CGST", "SGST", "IGST", "Grand Total"],
        gstSummary.sales_b2_c.map((r) => [r.invoice_number, new Date(r.date).toLocaleDateString(), r.party_name, r.taxable_value.toFixed(2), r.cgst.toFixed(2), r.sgst.toFixed(2), r.igst.toFixed(2), r.grand_total.toFixed(2)])
      ));
      lines.push("");
      lines.push("PURCHASE REGISTER");
      lines.push(rowsToCsv(
        ["Purchase No", "Date", "Supplier", "GSTIN", "Taxable Value", "Tax Total", "Grand Total"],
        gstSummary.purchase_register.map((r) => [r.purchase_number, new Date(r.date).toLocaleDateString(), r.supplier_name, r.gstin || "", r.taxable_value.toFixed(2), r.tax_total.toFixed(2), r.grand_total.toFixed(2)])
      ));
      await shareCsv(lines.join("\n"), `GST-Return-Data-${from}-to-${to}.csv`);
    } catch (e: any) {
      Alert.alert("Export Failed", e?.message || "Could not export the report.");
    } finally {
      setExporting(false);
    }
  };

  const handleExportDayBook = async () => {
    if (!dayBook) return;
    setExporting(true);
    try {
      const lines: string[] = [];
      lines.push(`DAY BOOK — ${dayBook.date}`);
      lines.push("");
      lines.push("SALES");
      lines.push(rowsToCsv(["Invoice No", "Party", "Amount", "Status"], dayBook.invoices.map((r) => [r.invoice_number, r.party_name, r.grand_total.toFixed(2), r.payment_status])));
      lines.push("");
      lines.push("PURCHASES");
      lines.push(rowsToCsv(["Purchase No", "Supplier", "Amount"], dayBook.purchases.map((r) => [r.purchase_number, r.supplier_name, r.grand_total.toFixed(2)])));
      lines.push("");
      lines.push("PAYMENTS RECEIVED");
      lines.push(rowsToCsv(["Party", "Amount", "Mode", "Reference"], dayBook.payments_in.map((r) => [r.party_name, r.amount.toFixed(2), r.mode || "", r.reference || ""])));
      lines.push("");
      lines.push("PAYMENTS MADE");
      lines.push(rowsToCsv(["Party", "Amount", "Mode", "Reference"], dayBook.payments_out.map((r) => [r.party_name, r.amount.toFixed(2), r.mode || "", r.reference || ""])));
      lines.push("");
      lines.push("EXPENSES");
      lines.push(rowsToCsv(["Category", "Amount", "Notes"], dayBook.expenses.map((r) => [r.category, r.amount.toFixed(2), r.notes || ""])));
      lines.push("");
      lines.push(rowsToCsv(["Total In", "Total Out", "Net"], [[dayBook.total_in.toFixed(2), dayBook.total_out.toFixed(2), dayBook.net.toFixed(2)]]));
      await shareCsv(lines.join("\n"), `Day-Book-${dayBook.date}.csv`);
    } catch (e: any) {
      Alert.alert("Export Failed", e?.message || "Could not export the report.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <ScrollView className="flex-1 bg-background dark:bg-bg-dark px-6" style={{ paddingTop: topInset }} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text className="text-2xl font-bold text-on-surface dark:text-text-primary-dark mb-1">
        GST & Compliance Reports
      </Text>
      <Text className="text-sm text-on-surface-variant dark:text-text-secondary-dark mb-6">
        HSN summary, GSTR-ready sales/purchase registers, and a day book — export any of these as CSV to hand off to your accountant.
      </Text>

      <View className="flex-row mb-6" style={{ gap: 8 }}>
        {TABS.map((tab) => (
          <Pressable
            key={tab.key}
            onPress={() => setActiveTab(tab.key)}
            className={`flex-1 py-3 rounded-xl border items-center ${
              activeTab === tab.key
                ? "bg-primary border-primary dark:bg-primary-dark"
                : "bg-surface-container-lowest dark:bg-surface-dark border-outline-variant dark:border-outline"
            }`}
          >
            <Text className={`text-sm font-bold text-center ${activeTab === tab.key ? "text-white" : "text-on-surface dark:text-text-primary-dark"}`}>
              {tab.key === "daybook" ? t("dayBook") : tab.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {(activeTab === "hsn" || activeTab === "gst") && (
        <View className="flex-row mb-4" style={{ gap: 12 }}>
          <View className="flex-1">
            <Text className="text-sm font-semibold text-on-surface-variant dark:text-text-secondary-dark uppercase tracking-wider mb-2">From</Text>
            <TextInput
              value={from}
              onChangeText={setFrom}
              placeholder="YYYY-MM-DD"
              className="bg-surface-container-lowest dark:bg-surface-dark text-on-surface dark:text-text-primary-dark border border-outline-variant dark:border-outline rounded-xl px-4 py-3 text-base"
            />
          </View>
          <View className="flex-1">
            <Text className="text-sm font-semibold text-on-surface-variant dark:text-text-secondary-dark uppercase tracking-wider mb-2">To</Text>
            <TextInput
              value={to}
              onChangeText={setTo}
              placeholder="YYYY-MM-DD"
              className="bg-surface-container-lowest dark:bg-surface-dark text-on-surface dark:text-text-primary-dark border border-outline-variant dark:border-outline rounded-xl px-4 py-3 text-base"
            />
          </View>
        </View>
      )}

      {activeTab === "daybook" && (
        <View className="mb-4">
          <Text className="text-sm font-semibold text-on-surface-variant dark:text-text-secondary-dark uppercase tracking-wider mb-2">Date</Text>
          <TextInput
            value={dayBookDate}
            onChangeText={setDayBookDate}
            placeholder="YYYY-MM-DD"
            className="bg-surface-container-lowest dark:bg-surface-dark text-on-surface dark:text-text-primary-dark border border-outline-variant dark:border-outline rounded-xl px-4 py-3 text-base"
          />
        </View>
      )}

      <Pressable
        onPress={activeTab === "hsn" ? handleRunHsn : activeTab === "gst" ? handleRunGst : handleRunDayBook}
        disabled={loading}
        className="bg-primary dark:bg-primary-dark py-3.5 rounded-xl items-center mb-6"
      >
        {loading ? <ActivityIndicator color="white" /> : <Text className="text-white font-bold text-base">Run Report</Text>}
      </Pressable>

      {activeTab === "hsn" && hsnRows && (
        <View>
          {hsnRows.length === 0 ? (
            <Text className="text-on-surface-variant dark:text-text-secondary-dark text-center py-8">No GST sales in this range.</Text>
          ) : (
            <>
              {hsnRows.map((row) => (
                <View key={`${row.hsn_code}-${row.tax_rate}`} className="bg-surface dark:bg-surface-dark p-4 rounded-xl border border-gray-100 dark:border-zinc-800 mb-3">
                  <View className="flex-row justify-between mb-1">
                    <Text className="font-bold text-on-surface dark:text-text-primary-dark">HSN {row.hsn_code}</Text>
                    <Text className="font-bold text-on-surface dark:text-text-primary-dark">{row.tax_rate}%</Text>
                  </View>
                  <Text className="text-sm text-on-surface-variant dark:text-text-secondary-dark">
                    Qty {row.total_quantity.toFixed(2)} · Taxable ₹{row.total_taxable_value.toFixed(2)} · Tax ₹{row.total_tax_amount.toFixed(2)}
                  </Text>
                </View>
              ))}
              <Pressable onPress={handleExportHsn} disabled={exporting} className="border border-primary py-3.5 rounded-xl items-center mt-2">
                {exporting ? <ActivityIndicator color="#0F7A5F" /> : <Text className="text-primary font-bold text-base">Export & Share CSV</Text>}
              </Pressable>
            </>
          )}
        </View>
      )}

      {activeTab === "gst" && gstSummary && (
        <View>
          <Text className="font-bold text-on-surface dark:text-text-primary-dark mb-2">B2B Sales ({gstSummary.sales_b2_b.length})</Text>
          <Text className="font-bold text-on-surface dark:text-text-primary-dark mb-2 mt-3">B2C Sales ({gstSummary.sales_b2_c.length})</Text>
          <Text className="font-bold text-on-surface dark:text-text-primary-dark mb-2 mt-3">Purchases ({gstSummary.purchase_register.length})</Text>
          <Pressable onPress={handleExportGst} disabled={exporting} className="border border-primary py-3.5 rounded-xl items-center mt-4">
            {exporting ? <ActivityIndicator color="#0F7A5F" /> : <Text className="text-primary font-bold text-base">Export & Share CSV</Text>}
          </Pressable>
        </View>
      )}

      {activeTab === "daybook" && dayBook && (
        <View className="mt-2">
          {/* Summary Card */}
          <View className="bg-surface dark:bg-surface-dark p-4 rounded-xl border border-gray-100 dark:border-zinc-800 mb-4">
            <View className="flex-row justify-between mb-1.5">
              <Text className="text-on-surface-variant dark:text-text-secondary-dark text-sm">Total Inflow</Text>
              <Text className="font-bold text-success text-sm">₹{dayBook.total_in.toFixed(2)}</Text>
            </View>
            <View className="flex-row justify-between mb-1.5">
              <Text className="text-on-surface-variant dark:text-text-secondary-dark text-sm">Total Outflow</Text>
              <Text className="font-bold text-error text-sm">₹{dayBook.total_out.toFixed(2)}</Text>
            </View>
            <View className="flex-row justify-between pt-1.5 border-t border-gray-100 dark:border-zinc-800">
              <Text className="text-on-surface-variant dark:text-text-secondary-dark font-bold text-sm">Net Balance</Text>
              <Text className={`font-black text-sm ${dayBook.net >= 0 ? "text-primary dark:text-primary-dark" : "text-error"}`}>₹{dayBook.net.toFixed(2)}</Text>
            </View>
          </View>

          {/* Action buttons */}
          <Pressable onPress={handleExportDayBook} disabled={exporting} className="border border-primary dark:border-primary-dark py-3.5 rounded-xl items-center mb-6">
            {exporting ? <ActivityIndicator color="#0F7A5F" /> : <Text className="text-primary dark:text-primary-dark font-bold text-sm">Export & Share Day Book CSV</Text>}
          </Pressable>

          {/* Detailed Lists */}
          <View className="space-y-6">
            {/* Sales Invoices */}
            <View>
              <Text className="text-sm font-bold text-on-surface dark:text-text-primary-dark mb-2 uppercase tracking-wide">Invoices Billed (Sales)</Text>
              {dayBook.invoices.length === 0 ? (
                <Text className="text-xs text-on-surface-variant dark:text-text-secondary-dark italic bg-surface/50 dark:bg-surface-dark/50 p-3 rounded-xl border border-gray-100 dark:border-zinc-800">No sales recorded today.</Text>
              ) : (
                dayBook.invoices.map((i, idx) => (
                  <View key={idx} className="bg-surface dark:bg-surface-dark p-3.5 rounded-xl border border-gray-100 dark:border-zinc-800 mb-2 flex-row justify-between items-center">
                    <View>
                      <Text className="font-bold text-on-surface dark:text-text-primary-dark text-sm">{i.invoice_number}</Text>
                      <Text className="text-xs text-on-surface-variant dark:text-text-secondary-dark">{i.party_name}</Text>
                    </View>
                    <Text className="font-bold text-emerald-600 text-sm">₹{i.grand_total.toFixed(2)}</Text>
                  </View>
                ))
              )}
            </View>

            {/* Purchases */}
            <View className="mt-4">
              <Text className="text-sm font-bold text-on-surface dark:text-text-primary-dark mb-2 uppercase tracking-wide">Purchases Staged</Text>
              {dayBook.purchases.length === 0 ? (
                <Text className="text-xs text-on-surface-variant dark:text-text-secondary-dark italic bg-surface/50 dark:bg-surface-dark/50 p-3 rounded-xl border border-gray-100 dark:border-zinc-800">No purchases recorded today.</Text>
              ) : (
                dayBook.purchases.map((p, idx) => (
                  <View key={idx} className="bg-surface dark:bg-surface-dark p-3.5 rounded-xl border border-gray-100 dark:border-zinc-800 mb-2 flex-row justify-between items-center">
                    <View>
                      <Text className="font-bold text-on-surface dark:text-text-primary-dark text-sm">{p.purchase_number}</Text>
                      <Text className="text-xs text-on-surface-variant dark:text-text-secondary-dark">{p.supplier_name}</Text>
                    </View>
                    <Text className="font-bold text-error text-sm">₹{p.grand_total.toFixed(2)}</Text>
                  </View>
                ))
              )}
            </View>

            {/* Payments Received */}
            <View className="mt-4">
              <Text className="text-sm font-bold text-on-surface dark:text-text-primary-dark mb-2 uppercase tracking-wide">Payments Received (Inbound)</Text>
              {dayBook.payments_in.length === 0 ? (
                <Text className="text-xs text-on-surface-variant dark:text-text-secondary-dark italic bg-surface/50 dark:bg-surface-dark/50 p-3 rounded-xl border border-gray-100 dark:border-zinc-800">No inbound payments.</Text>
              ) : (
                dayBook.payments_in.map((pi, idx) => (
                  <View key={idx} className="bg-surface dark:bg-surface-dark p-3.5 rounded-xl border border-gray-100 dark:border-zinc-800 mb-2 flex-row justify-between items-center">
                    <View>
                      <Text className="font-bold text-on-surface dark:text-text-primary-dark text-sm">{pi.party_name}</Text>
                      <Text className="text-xs text-on-surface-variant dark:text-text-secondary-dark">{pi.mode || "Payment"} {pi.reference ? `· ${pi.reference}` : ""}</Text>
                    </View>
                    <Text className="font-bold text-emerald-600 text-sm">₹{pi.amount.toFixed(2)}</Text>
                  </View>
                ))
              )}
            </View>

            {/* Payments Outflow */}
            <View className="mt-4">
              <Text className="text-sm font-bold text-on-surface dark:text-text-primary-dark mb-2 uppercase tracking-wide">Payments Made (Outbound)</Text>
              {dayBook.payments_out.length === 0 ? (
                <Text className="text-xs text-on-surface-variant dark:text-text-secondary-dark italic bg-surface/50 dark:bg-surface-dark/50 p-3 rounded-xl border border-gray-100 dark:border-zinc-800">No outbound payments.</Text>
              ) : (
                dayBook.payments_out.map((po, idx) => (
                  <View key={idx} className="bg-surface dark:bg-surface-dark p-3.5 rounded-xl border border-gray-100 dark:border-zinc-800 mb-2 flex-row justify-between items-center">
                    <View>
                      <Text className="font-bold text-on-surface dark:text-text-primary-dark text-sm">{po.party_name}</Text>
                      <Text className="text-xs text-on-surface-variant dark:text-text-secondary-dark">{po.mode || "Payment"} {po.reference ? `· ${po.reference}` : ""}</Text>
                    </View>
                    <Text className="font-bold text-error text-sm">₹{po.amount.toFixed(2)}</Text>
                  </View>
                ))
              )}
            </View>

            {/* Expenses */}
            <View className="mt-4">
              <Text className="text-sm font-bold text-on-surface dark:text-text-primary-dark mb-2 uppercase tracking-wide">Expenses Recorded</Text>
              {dayBook.expenses.length === 0 ? (
                <Text className="text-xs text-on-surface-variant dark:text-text-secondary-dark italic bg-surface/50 dark:bg-surface-dark/50 p-3 rounded-xl border border-gray-100 dark:border-zinc-800">No expenses recorded today.</Text>
              ) : (
                dayBook.expenses.map((e, idx) => (
                  <View key={idx} className="bg-surface dark:bg-surface-dark p-3.5 rounded-xl border border-gray-100 dark:border-zinc-800 mb-2 flex-row justify-between items-center">
                    <View className="flex-1 pr-2">
                      <Text className="font-bold text-on-surface dark:text-text-primary-dark text-sm capitalize">{e.category}</Text>
                      {e.notes ? <Text className="text-xs text-on-surface-variant dark:text-text-secondary-dark">{e.notes}</Text> : null}
                    </View>
                    <Text className="font-bold text-error text-sm">₹{e.amount.toFixed(2)}</Text>
                  </View>
                ))
              )}
            </View>
          </View>
        </View>
      )}
    </ScrollView>
  );
}
