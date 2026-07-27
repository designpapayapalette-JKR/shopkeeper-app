import React, { useState, useEffect, useCallback } from "react";
import { View, Text, ScrollView, ActivityIndicator, Pressable, RefreshControl } from "react-native";
import { useTheme } from "react-native-paper";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { api } from "../src/lib/api";
import { useTopInset, useBottomInset } from "../src/lib/useTopInset";

// Mirrors shopkeeper-web's /dashboard/insights page — all figures come
// from shopkeeper-api's /insights/* routes, which are plain arithmetic
// over existing data (no LLM call, no extra cost).

interface NearExpiryRow {
  purchaseItemId: string;
  product: { name: string; unit: string };
  remainingQuantity: number;
  daysLeft: number;
  suggestedDiscountPct: number;
  suggestedPrice: number;
}

interface CreditRiskRow {
  partyId: string;
  name: string;
  currentBalance: number;
  overdueAmount: number;
  overdueInvoiceCount: number;
  avgPaymentDelayDays: number | null;
  riskTier: "low" | "medium" | "high";
  suggestedSafeLimit: number | null;
}

interface AnomalyRow {
  invoiceId: string;
  invoiceNumber: string;
  partyName: string;
  discountPct: number;
  grandTotal: number;
}

const TIER_COLOR: Record<string, string> = { low: "#16a34a", medium: "#f59e0b", high: "#ef4444" };

function formatCurrency(amount: number): string {
  return "₹" + Number(amount).toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

function SectionHeader({ icon, color, title }: { icon: string; color: string; title: string }) {
  return (
    <View className="flex-row items-center mb-2 px-1" style={{ gap: 6 }}>
      <MaterialCommunityIcons name={icon as any} size={16} color={color} />
      <Text className="text-sm font-bold text-on-surface">{title}</Text>
    </View>
  );
}

export default function InsightsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const topInset = useTopInset();
  const bottomInset = useBottomInset();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [nearExpiry, setNearExpiry] = useState<NearExpiryRow[]>([]);
  const [creditRisk, setCreditRisk] = useState<CreditRiskRow[]>([]);
  const [anomalies, setAnomalies] = useState<AnomalyRow[]>([]);

  const fetchData = useCallback(async () => {
    try {
      const [ne, cr, an] = await Promise.all([
        api.get<{ data: NearExpiryRow[] }>("/insights/near-expiry", { params: { days: 14 } }).catch(() => ({ data: [] })),
        api.get<{ data: CreditRiskRow[] }>("/insights/credit-risk").catch(() => ({ data: [] })),
        api.get<{ data: AnomalyRow[] }>("/insights/discount-anomalies").catch(() => ({ data: [] })),
      ]);
      setNearExpiry(ne.data || []);
      setCreditRisk(cr.data || []);
      setAnomalies(an.data || []);
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerStyle={{ paddingTop: topInset + 16, paddingBottom: bottomInset + 24, paddingHorizontal: 16 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor={theme.colors.primary} />}
    >
      <View className="flex-row items-center mb-4" style={{ gap: 8 }}>
        <Pressable onPress={() => router.back()} className="w-9 h-9 items-center justify-center -ml-1">
          <MaterialCommunityIcons name="arrow-left" size={24} color={theme.colors.onSurfaceVariant} />
        </Pressable>
        <MaterialCommunityIcons name="creation" size={22} color={theme.colors.primary} />
        <Text className="text-2xl font-bold text-on-surface">Insights</Text>
      </View>

      {/* Near-expiry stock */}
      <SectionHeader icon="package-variant-closed-remove" color="#f97316" title="Near-Expiry Stock" />
      {nearExpiry.length === 0 ? (
        <View className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-4 mb-4">
          <Text className="text-xs text-on-surface-variant">Nothing expiring in the next 14 days.</Text>
        </View>
      ) : (
        <View className="mb-4" style={{ gap: 8 }}>
          {nearExpiry.map((row) => (
            <View key={row.purchaseItemId} className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-3.5">
              <View className="flex-row items-center justify-between">
                <Text className="text-sm font-bold text-on-surface flex-1 mr-2" numberOfLines={1}>{row.product.name}</Text>
                <Text className="text-xs font-bold" style={{ color: row.daysLeft <= 3 ? "#ef4444" : "#f59e0b" }}>
                  {row.daysLeft < 0 ? "Expired" : `${row.daysLeft}d left`}
                </Text>
              </View>
              <Text className="text-xs text-on-surface-variant mt-1">
                {row.remainingQuantity} {row.product.unit} left — suggest {row.suggestedDiscountPct}% off → {formatCurrency(row.suggestedPrice)}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Credit risk */}
      <SectionHeader icon="shield-alert-outline" color="#6366F1" title="Credit Risk — Udhaar Customers" />
      {creditRisk.length === 0 ? (
        <View className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-4 mb-4">
          <Text className="text-xs text-on-surface-variant">No outstanding credit customers.</Text>
        </View>
      ) : (
        <View className="mb-4" style={{ gap: 8 }}>
          {creditRisk.map((row) => (
            <View key={row.partyId} className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-3.5" style={{ borderLeftWidth: 3, borderLeftColor: TIER_COLOR[row.riskTier] }}>
              <View className="flex-row items-center justify-between">
                <Text className="text-sm font-bold text-on-surface flex-1 mr-2" numberOfLines={1}>{row.name}</Text>
                <View className="rounded-full px-2.5 py-0.5" style={{ backgroundColor: TIER_COLOR[row.riskTier] + "22" }}>
                  <Text className="text-[10px] font-bold capitalize" style={{ color: TIER_COLOR[row.riskTier] }}>{row.riskTier} risk</Text>
                </View>
              </View>
              <Text className="text-xs text-on-surface-variant mt-1">
                Balance {formatCurrency(row.currentBalance)}
                {row.overdueInvoiceCount > 0 ? ` · ${formatCurrency(row.overdueAmount)} overdue` : ""}
                {row.avgPaymentDelayDays != null ? ` · avg ${row.avgPaymentDelayDays}d late` : ""}
              </Text>
              <Text className="text-xs mt-0.5" style={{ color: theme.colors.primary }}>
                {row.suggestedSafeLimit != null ? `Suggested safe limit: ${formatCurrency(row.suggestedSafeLimit)}` : "Review manually before extending more credit"}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Discount anomalies */}
      <SectionHeader icon="trending-down" color="#ef4444" title="Unusual Discounts" />
      {anomalies.length === 0 ? (
        <View className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-4">
          <Text className="text-xs text-on-surface-variant">No invoices in the last 30 days had an outlier discount.</Text>
        </View>
      ) : (
        <View style={{ gap: 8 }}>
          {anomalies.map((row) => (
            <View key={row.invoiceId} className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-3.5">
              <View className="flex-row items-center justify-between">
                <Text className="text-sm font-bold text-on-surface flex-1 mr-2" numberOfLines={1}>{row.invoiceNumber} · {row.partyName}</Text>
                <Text className="text-xs font-bold" style={{ color: "#ef4444" }}>{row.discountPct}% off</Text>
              </View>
              <Text className="text-xs text-on-surface-variant mt-1">Total {formatCurrency(row.grandTotal)}</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}
