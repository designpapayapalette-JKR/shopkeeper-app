import React, { useState, useEffect, useCallback } from "react";
import { View, ScrollView, ActivityIndicator, RefreshControl, Text, Pressable } from "react-native";
import { useTheme } from "react-native-paper";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { api } from "../src/lib/api";
import { useAuth } from "../src/lib/auth-context";
import { useTopInset, useBottomInset } from "../src/lib/useTopInset";

type DaybookData = {
 from: string;
 to: string;
 summary: {
 totalSales: number; totalPurchases: number;
 totalPaymentsIn: number; totalPaymentsOut: number;
 totalExpenses: number;
 invoiceCount: number; purchaseCount: number;
 paymentCount: number; expenseCount: number;
 };
 invoices: any[];
 purchases: any[];
 payments: any[];
 expenses: any[];
 creditNotes: any[];
 debitNotes: any[];
 challans: any[];
 stockMovements: any[];
};

const DATE_PRESETS = [
 { value: "today", label: "Today" },
 { value: "week", label: "This Week" },
 { value: "month", label: "This Month" },
];

function getDateRange(preset: string): { from: string; to: string } {
 const now = new Date();
 const to = now.toISOString().split("T")[0];
 if (preset === "today") return { from: to, to };
 if (preset === "week") {
 const day = now.getDay();
 const diff = now.getDate() - day + (day === 0 ? -6 : 1);
 const monday = new Date(now.setDate(diff));
 return { from: monday.toISOString().split("T")[0], to };
 }
 // month
 const first = new Date(now.getFullYear(), now.getMonth(), 1);
 return { from: first.toISOString().split("T")[0], to };
}

export default function DaybookScreen() {
 const { userRole } = useAuth();
 const router = useRouter();
 const theme = useTheme();
 const topInset = useTopInset();
 const bottomInset = useBottomInset();

 const [preset, setPreset] = useState("today");
 const [loading, setLoading] = useState(true);
 const [refreshing, setRefreshing] = useState(false);
 const [data, setData] = useState<DaybookData | null>(null);
 const [activeSection, setActiveSection] = useState<string>("summary");

 const fetchData = useCallback(async () => {
 const { from, to } = getDateRange(preset);
 try {
 const res = await api.get<{ data: DaybookData }>(`/reports/day-book?from=${from}&to=${to}`);
 setData(res.data);
 } catch { /* ignore */ }
 finally { setLoading(false); setRefreshing(false); }
 }, [preset]);

 useEffect(() => { fetchData(); }, [fetchData]);

 const sections = [
 { key: "summary", label: "Summary", icon: "view-dashboard-outline" },
 { key: "invoices", label: "Invoices", icon: "file-document-outline", count: data?.summary.invoiceCount },
 { key: "payments", label: "Payments", icon: "credit-card-outline", count: data?.summary.paymentCount },
 { key: "expenses", label: "Expenses", icon: "wallet-outline", count: data?.summary.expenseCount },
 ];

 if (loading) {
 return (
 <View className="flex-1 items-center justify-center bg-background">
 <ActivityIndicator size="large" color={theme.colors.primary} />
 </View>
 );
 }

 const summaryItems = data ? [
 { label: "Sales", value: `₹${data.summary.totalSales.toLocaleString("en-IN")}`, count: data.summary.invoiceCount, icon: "trending-up", color: theme.colors.primary },
 { label: "Purchases", value: `₹${data.summary.totalPurchases.toLocaleString("en-IN")}`, count: data.summary.purchaseCount, icon: "truck", color: theme.colors.secondary },
 { label: "Payments In", value: `₹${data.summary.totalPaymentsIn.toLocaleString("en-IN")}`, count: data.summary.paymentCount, icon: "cash-plus", color: "#2E9E5B" },
 { label: "Payments Out", value: `₹${data.summary.totalPaymentsOut.toLocaleString("en-IN")}`, count: 0, icon: "cash-minus", color: "#D64545" },
 { label: "Expenses", value: `₹${data.summary.totalExpenses.toLocaleString("en-IN")}`, count: data.summary.expenseCount, icon: "wallet", color: "#873D34" },
 ] : [];

 const netFlow = data ? data.summary.totalSales + data.summary.totalPaymentsIn - data.summary.totalPurchases - data.summary.totalPaymentsOut - data.summary.totalExpenses : 0;

 return (
 <View className="flex-1 bg-background">
 <ScrollView
 contentContainerStyle={{ paddingTop: topInset + 16, paddingBottom: bottomInset + 24 }}
 refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} />}
 >
 {/* Header */}
 <View className="flex-row items-center justify-between px-4 mb-4">
 <View className="flex-row items-center" style={{ gap: 8 }}>
 <MaterialCommunityIcons name="book-open-page-variant" size={24} color={theme.colors.primary} />
 <Text className="text-2xl font-bold text-on-surface">Daybook</Text>
 </View>
 </View>

 {/* Date Presets */}
 <View className="px-4 mb-4">
 <View className="flex-row bg-surface-container-high rounded-lg p-1">
 {DATE_PRESETS.map((btn) => (
 <Pressable
 key={btn.value}
 onPress={() => { setPreset(btn.value); setLoading(true); }}
 className={`flex-1 py-2 rounded-md items-center ${preset === btn.value ? 'bg-primary' : ''}`}
 >
 <Text className={`text-xs font-bold ${preset === btn.value ? 'text-white' : 'text-on-surface-variant'}`}>
 {btn.label}
 </Text>
 </Pressable>
 ))}
 </View>
 </View>

 {/* Net Flow Card */}
 {data && (
 <View className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-4 mx-4 mb-4 items-center py-3">
 <Text className="text-xs text-on-surface-variant mb-1">Net Cash Flow</Text>
 <Text className="text-3xl font-black" style={{ color: netFlow >= 0 ? "#2E9E5B" : "#D64545" }}>
 {netFlow >= 0 ? "+" : ""}₹{netFlow.toLocaleString("en-IN")}
 </Text>
 <Text className="text-xs text-on-surface-variant mt-1">
 {data.from === data.to ? data.from : `${data.from} → ${data.to}`}
 </Text>
 </View>
 )}

 {/* Summary Cards */}
 {data && (
 <View className="px-4 mb-4" style={{ gap: 8 }}>
 <View className="flex-row" style={{ gap: 8 }}>
 {summaryItems.slice(0, 3).map((item) => (
 <View key={item.label} className="flex-1 bg-surface-container-lowest border border-outline-variant rounded-2xl p-4 items-center py-2">
 <MaterialCommunityIcons name={item.icon as any} size={18} color={item.color} />
 <Text className="text-sm font-black mt-1" style={{ color: item.color }}>{item.value}</Text>
 <Text className="text-[10px] text-on-surface-variant">{item.label}</Text>
 {item.count !== undefined && (
 <Text className="text-[10px] text-on-surface-variant">({item.count})</Text>
 )}
 </View>
 ))}
 </View>
 <View className="flex-row" style={{ gap: 8 }}>
 {summaryItems.slice(3).map((item) => (
 <View key={item.label} className="flex-1 bg-surface-container-lowest border border-outline-variant rounded-2xl p-4 items-center py-2">
 <MaterialCommunityIcons name={item.icon as any} size={18} color={item.color} />
 <Text className="text-sm font-black mt-1" style={{ color: item.color }}>{item.value}</Text>
 <Text className="text-[10px] text-on-surface-variant">{item.label}</Text>
 </View>
 ))}
 </View>
 </View>
 )}

 {/* Section Tabs */}
 <View className="flex-row px-4 mb-3" style={{ gap: 8 }}>
 {sections.map((s) => (
 <Pressable
 key={s.key}
 onPress={() => setActiveSection(s.key)}
 className={`flex-row items-center px-3 py-2 rounded-full ${activeSection === s.key ? "bg-primary" : "bg-surface-container-high"}`}
 style={{ gap: 4 }}
 >
 <MaterialCommunityIcons name={s.icon as any} size={14} color={activeSection === s.key ? "#FFFFFF" : "#6B7280"} />
 <Text className={`text-xs font-bold ${activeSection === s.key ? "text-white" : "text-on-surface-variant"}`}>
 {s.label}{s.count ? ` (${s.count})` : ""}
 </Text>
 </Pressable>
 ))}
 </View>

 {/* Section Content */}
 <View className="px-4">
 {activeSection === "summary" && data && (
 <>
 {/* Credit/Debit Notes */}
 {data.creditNotes.length > 0 && (
 <View className="mb-3">
 <Text className="text-sm font-bold text-on-surface mb-2">
 Credit Notes ({data.creditNotes.length})
 </Text>
 {data.creditNotes.slice(0, 3).map((cn: any) => (
 <View key={cn.id} className="flex-row items-center justify-between py-1.5 border-b border-outline-variant/30">
 <Text className="text-xs text-on-surface">{cn.number || cn.id.slice(0, 8)}</Text>
 <Text className="text-xs font-bold text-on-surface">₹{parseFloat(cn.grandTotal || 0).toLocaleString("en-IN")}</Text>
 </View>
 ))}
 </View>
 )}

 {/* Stock Movements */}
 {data.stockMovements.length > 0 && (
 <View className="mb-3">
 <Text className="text-sm font-bold text-on-surface mb-2">
 Stock Movements ({data.stockMovements.length})
 </Text>
 {data.stockMovements.slice(0, 3).map((sm: any) => (
 <View key={sm.id} className="flex-row items-center justify-between py-1.5 border-b border-outline-variant/30">
 <Text className="text-xs text-on-surface flex-1">{sm.productName}</Text>
 <Text className="text-xs text-on-surface-variant">{sm.type}</Text>
 <Text className="text-xs font-bold text-on-surface">{sm.quantity}</Text>
 </View>
 ))}
 </View>
 )}

 {data.creditNotes.length === 0 && data.stockMovements.length === 0 && (
 <View className="items-center py-10">
 <MaterialCommunityIcons name="calendar-blank" size={40} color="#9E9E9E" />
 <Text className="text-sm text-on-surface-variant mt-2">No additional activity</Text>
 </View>
 )}
 </>
 )}

 {activeSection === "invoices" && (
 <>
 {(data?.invoices || []).length === 0 ? (
 <View className="items-center py-10">
 <MaterialCommunityIcons name="file-document-remove-outline" size={40} color="#9E9E9E" />
 <Text className="text-sm text-on-surface-variant mt-2">No invoices</Text>
 </View>
 ) : (
 (data?.invoices || []).map((inv: any) => (
 <View key={inv.id} className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-4 mb-2 flex-row items-center justify-between">
 <View>
 <Text className="text-sm font-bold text-on-surface">{inv.number || inv.invoiceNumber}</Text>
 <Text className="text-xs text-on-surface-variant">{inv.partyName} · {inv.type}</Text>
 </View>
 <View className="items-end">
 <Text className="text-sm font-bold text-on-surface">₹{parseFloat(inv.grandTotal || 0).toLocaleString("en-IN")}</Text>
 <Text className="text-xs text-on-surface-variant">{inv.paymentStatus}</Text>
 </View>
 </View>
 ))
 )}
 </>
 )}

 {activeSection === "payments" && (
 <>
 {(data?.payments || []).length === 0 ? (
 <View className="items-center py-10">
 <MaterialCommunityIcons name="credit-card-remove-outline" size={40} color="#9E9E9E" />
 <Text className="text-sm text-on-surface-variant mt-2">No payments</Text>
 </View>
 ) : (
 (data?.payments || []).map((pmt: any) => (
 <View key={pmt.id} className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-4 mb-2 flex-row items-center justify-between">
 <View className="flex-row items-center" style={{ gap: 8 }}>
 <MaterialCommunityIcons
 name={pmt.direction === "in" ? "cash-plus" : "cash-minus"}
 size={20}
 color={pmt.direction === "in" ? "#2E9E5B" : "#D64545"}
 />
 <View>
 <Text className="text-sm font-bold text-on-surface">{pmt.partyName}</Text>
 <Text className="text-xs text-on-surface-variant">{pmt.mode}{pmt.reference ? ` · ${pmt.reference}` : ""}</Text>
 </View>
 </View>
 <Text className="text-sm font-bold text-on-surface">
 ₹{parseFloat(pmt.amount || 0).toLocaleString("en-IN")}
 </Text>
 </View>
 ))
 )}
 </>
 )}

 {activeSection === "expenses" && (
 <>
 {(data?.expenses || []).length === 0 ? (
 <View className="items-center py-10">
 <MaterialCommunityIcons name="wallet-outline" size={40} color="#9E9E9E" />
 <Text className="text-sm text-on-surface-variant mt-2">No expenses</Text>
 </View>
 ) : (
 (data?.expenses || []).map((exp: any) => (
 <View key={exp.id} className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-4 mb-2 flex-row items-center justify-between">
 <View>
 <Text className="text-sm font-bold text-on-surface">{exp.category}</Text>
 {exp.notes && <Text className="text-xs text-on-surface-variant">{exp.notes}</Text>}
 </View>
 <Text className="text-sm font-bold text-on-surface">₹{parseFloat(exp.amount || 0).toLocaleString("en-IN")}</Text>
 </View>
 ))
 )}
 </>
 )}
 </View>
 </ScrollView>
 </View>
 );
}
