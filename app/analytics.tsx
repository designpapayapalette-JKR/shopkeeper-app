import React, { useState, useEffect, useCallback } from "react";
import { View, ScrollView, ActivityIndicator, RefreshControl, Text, useWindowDimensions, Pressable } from "react-native";
import { useTheme } from "react-native-paper";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { BarChart, PieChart, LineChart } from "react-native-chart-kit";
import { api } from "../src/lib/api";
import { useAuth } from "../src/lib/auth-context";
import { useTopInset, useBottomInset } from "../src/lib/useTopInset";

const MONTH_OPTIONS = [
 { value: "3", label: "3M" },
 { value: "6", label: "6M" },
 { value: "12", label: "12M" },
 { value: "24", label: "24M" },
];

const CHART_COLORS = ["#0368FE", "#835400", "#2E9E5B", "#873D34", "#F0AE4E", "#D64545", "#03A8FE", "#9E9E9E"];

export default function AnalyticsScreen() {
 const { userRole } = useAuth();
 const router = useRouter();
 const theme = useTheme();
 const topInset = useTopInset();
 const bottomInset = useBottomInset();
 const { width: screenWidth } = useWindowDimensions();
 const chartWidth = screenWidth - 48;

 const [months, setMonths] = useState("12");
 const [loading, setLoading] = useState(true);
 const [refreshing, setRefreshing] = useState(false);

 // Data states
 const [revenueTrend, setRevenueTrend] = useState<{ month: string; revenue: number; profit: number }[]>([]);
 const [salesByCategory, setSalesByCategory] = useState<{ name: string; value: number }[]>([]);
 const [topProducts, setTopProducts] = useState<{ name: string; revenue: number; quantity: number }[]>([]);
 const [paymentModes, setPaymentModes] = useState<{ name: string; value: number }[]>([]);
 const [inventory, setInventory] = useState<{
 totalProducts: number; totalStockQty: number; totalStockValue: number;
 totalSellValue: number; lowStockCount: number;
 } | null>(null);

 const fetchData = useCallback(async () => {
 try {
 const [trend, categories, products, payments, inv] = await Promise.all([
 api.get<any>(`/analytics/revenue-trend?months=${months}`).catch(() => ({ data: [] })),
 api.get<any>(`/analytics/sales-by-category?months=${months}`).catch(() => ({ data: { categories: [] } })),
 api.get<any>(`/analytics/top-products?months=${months}&limit=5`).catch(() => ({ data: [] })),
 api.get<any>(`/analytics/payment-modes?months=${months}`).catch(() => ({ data: [] })),
 api.get<any>("/analytics/inventory-summary").catch(() => ({ data: null })),
 ]);
 setRevenueTrend(Array.isArray(trend.data) ? trend.data : []);
 setSalesByCategory(categories.data?.categories || []);
 setTopProducts(Array.isArray(products.data) ? products.data : []);
 setPaymentModes(Array.isArray(payments.data) ? payments.data : []);
 setInventory(inv.data);
 } catch { /* ignore */ }
 finally { setLoading(false); setRefreshing(false); }
 }, [months]);

 useEffect(() => { fetchData(); }, [fetchData]);

 const chartConfig = {
 backgroundColor: "#FFFFFF",
 backgroundGradientFrom: "#FFFFFF",
 backgroundGradientTo: "#FFFFFF",
 decimalPlaces: 0,
 color: (opacity = 1) => `rgba(3, 104, 254, ${opacity})`,
 labelColor: () => "#6B7280",
 propsForBackgroundLines: { strokeDasharray: "", stroke: "#F0EDED", strokeWidth: 1 },
 propsForLabels: { fontSize: 10, fontWeight: "600" },
 barPercentage: 0.6,
 };

 const abbreviateMonth = (m: string) => {
 const d = new Date(m + "-01");
 return d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
 };

 if (loading) {
 return (
 <View className="flex-1 items-center justify-center bg-background ">
 <ActivityIndicator size="large" color={theme.colors.primary} />
 </View>
 );
 }

 return (
 <ScrollView
 className="flex-1 bg-background "
 contentContainerStyle={{ paddingTop: topInset + 16, paddingBottom: bottomInset + 24 }}
 refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} />}
 >
 {/* Header */}
 <View className="flex-row items-center justify-between px-4 mb-4">
 <View className="flex-row items-center" style={{ gap: 8 }}>
 <MaterialCommunityIcons name="chart-arc" size={24} color={theme.colors.primary} />
 <Text className="text-2xl font-bold text-on-surface ">Analytics</Text>
 </View>
 <View className="flex-row bg-surface-container-high rounded-lg p-1 w-48">
 {MONTH_OPTIONS.map((btn) => (
 <Pressable
 key={btn.value}
 onPress={() => { setMonths(btn.value); setLoading(true); }}
 className={`flex-1 py-2 rounded-md items-center ${months === btn.value ? 'bg-primary' : ''}`}
 >
 <Text className={`text-xs font-bold ${months === btn.value ? 'text-white' : 'text-on-surface-variant'}`}>
 {btn.label}
 </Text>
 </Pressable>
 ))}
 </View>
 </View>

 {/* Revenue Trend */}
 {revenueTrend.length > 0 && (
 <View className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-4 mx-4 mb-4">
 <Text className="text-base font-bold text-on-surface mb-3">Revenue & Profit Trend</Text>
 <BarChart
 data={{
 labels: revenueTrend.slice(-8).map((r) => abbreviateMonth(r.month)),
 datasets: [
 { data: revenueTrend.slice(-8).map((r) => Math.max(0, r.revenue)) },
 ],
 }}
 width={chartWidth}
 height={180}
 chartConfig={chartConfig}
 yAxisLabel="₹"
 yAxisSuffix=""
 fromZero
 showValuesOnTopOfBars={false}
 style={{ borderRadius: 12, marginLeft: -8 }}
 />
 <View className="flex-row justify-between mt-3" style={{ gap: 8 }}>
 <View className="flex-1 items-center p-2 rounded-xl bg-primary/10">
 <Text className="text-lg font-black" style={{ color: theme.colors.primary }}>
 ₹{revenueTrend.reduce((s, r) => s + r.revenue, 0).toLocaleString("en-IN")}
 </Text>
 <Text className="text-xs text-on-surface-variant ">Total Revenue</Text>
 </View>
 <View className="flex-1 items-center p-2 rounded-xl" style={{ backgroundColor: "#83540015" }}>
 <Text className="text-lg font-black" style={{ color: theme.colors.secondary }}>
 ₹{revenueTrend.reduce((s, r) => s + Math.max(0, r.profit), 0).toLocaleString("en-IN")}
 </Text>
 <Text className="text-xs text-on-surface-variant ">Total Profit</Text>
 </View>
 </View>
 </View>
 )}

 {/* Sales by Category */}
 {salesByCategory.length > 0 && (
 <View className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-4 mx-4 mb-4">
 <Text className="text-base font-bold text-on-surface mb-3">Sales by Category</Text>
 {salesByCategory.slice(0, 5).map((cat, idx) => {
 const total = salesByCategory.reduce((s, c) => s + c.value, 0);
 const pct = total > 0 ? (cat.value / total) * 100 : 0;
 return (
 <View key={cat.name} className="flex-row items-center mb-2" style={{ gap: 8 }}>
 <View className="w-3 h-3 rounded-full" style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }} />
 <Text className="text-sm text-on-surface flex-1">{cat.name}</Text>
 <Text className="text-sm font-bold text-on-surface ">₹{cat.value.toLocaleString("en-IN")}</Text>
 <Text className="text-xs text-on-surface-variant w-10 text-right">{pct.toFixed(0)}%</Text>
 </View>
 );
 })}
 </View>
 )}

 {/* Payment Modes */}
 {paymentModes.length > 0 && (
 <View className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-4 mx-4 mb-4">
 <Text className="text-base font-bold text-on-surface mb-3">Payment Modes</Text>
 <View className="flex-row" style={{ gap: 8 }}>
 {paymentModes.map((pm, idx) => {
 const total = paymentModes.reduce((s, p) => s + p.value, 0);
 const pct = total > 0 ? (pm.value / total) * 100 : 0;
 return (
 <View key={pm.name} className="flex-1 items-center p-3 rounded-xl" style={{ backgroundColor: `${CHART_COLORS[idx % CHART_COLORS.length]}15` }}>
 <Text className="text-lg font-black" style={{ color: CHART_COLORS[idx % CHART_COLORS.length] }}>
 {pct.toFixed(0)}%
 </Text>
 <Text className="text-xs font-semibold text-on-surface-variant mt-1 capitalize">{pm.name}</Text>
 </View>
 );
 })}
 </View>
 </View>
 )}

 {/* Top Products */}
 {topProducts.length > 0 && (
 <View className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-4 mx-4 mb-4">
 <Text className="text-base font-bold text-on-surface mb-3">Top Products</Text>
 {topProducts.map((p, idx) => (
 <View key={p.name} className="flex-row items-center py-2" style={{ gap: 10 }}>
 <View className="w-7 h-7 rounded-full items-center justify-center" style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}>
 <Text className="text-xs font-bold text-white">{idx + 1}</Text>
 </View>
 <View className="flex-1">
 <Text className="text-sm font-semibold text-on-surface " numberOfLines={1}>{p.name}</Text>
 <Text className="text-xs text-on-surface-variant ">{p.quantity} units sold</Text>
 </View>
 <Text className="text-sm font-bold text-on-surface ">₹{p.revenue.toLocaleString("en-IN")}</Text>
 </View>
 ))}
 </View>
 )}

 {/* Inventory Summary */}
 {inventory && (
 <View className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-4 mx-4 mb-4">
 <Text className="text-base font-bold text-on-surface mb-3">Inventory Summary</Text>
 <View className="flex-row flex-wrap" style={{ gap: 8 }}>
 {[
 { label: "Products", value: inventory.totalProducts, color: theme.colors.primary },
 { label: "Stock Value", value: `₹${inventory.totalStockValue.toLocaleString("en-IN")}`, color: theme.colors.secondary },
 { label: "Sell Value", value: `₹${inventory.totalSellValue.toLocaleString("en-IN")}`, color: "#2E9E5B" },
 { label: "Low Stock", value: inventory.lowStockCount, color: "#D64545" },
 ].map((item) => (
 <View key={item.label} className="flex-1 min-w-[45%] items-center p-3 rounded-xl" style={{ backgroundColor: `${item.color}10` }}>
 <Text className="text-base font-black" style={{ color: item.color }}>{item.value}</Text>
 <Text className="text-xs text-on-surface-variant mt-1">{item.label}</Text>
 </View>
 ))}
 </View>
 </View>
 )}
 </ScrollView>
 );
}
