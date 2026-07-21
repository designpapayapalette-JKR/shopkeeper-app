import React, { useCallback, useEffect, useState, useMemo } from "react";
import { View, Text, FlatList, ActivityIndicator, Pressable, Alert, Modal, ScrollView, TextInput, RefreshControl, Share } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "react-native-paper";
import { api, ApiError, apiUrl } from "../src/lib/api";
import { useTopInset } from "../src/lib/useTopInset";
import { useBottomInset } from "../src/lib/useBottomInset";
import { shareDataAsPdf } from "../src/lib/pdfExport";
import EmptyState from "../src/components/EmptyState";

function formatRupee(n: number): string {
 return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function formatDate(iso: string): string {
 const d = new Date(iso);
 return `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")}/${d.getFullYear()}`;
}

function timeAgo(iso: string): string {
 const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
 if (mins < 1) return "just now";
 if (mins < 60) return `${mins}m ago`;
 const hours = Math.floor(mins / 60);
 if (hours < 24) return `${hours}h ago`;
 return `${Math.floor(hours / 24)}d ago`;
}

type HistoryTab = "sales" | "b2b" | "purchases";

const TABS: { key: HistoryTab; label: string; icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"] }[] = [
 { key: "sales", label: "Retail", icon: "cash-register" },
 { key: "b2b", label: "B2B", icon: "briefcase-account" },
 { key: "purchases", label: "Purchases", icon: "truck-delivery" },
];

const TYPE_COLORS: Record<string, string> = {
 gst: "#0368FE",
 retail: "#6B21A8",
 estimate: "#B45309",
 bill_of_supply: "#334155",
 b2b: "#0368FE",
};

const TYPE_LABELS: Record<string, string> = {
 gst: "GST",
 retail: "Retail",
 estimate: "Estimate",
 bill_of_supply: "Bill of Supply",
 b2b: "B2B",
};

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
 paid: { bg: "#DCFCE7", text: "#15803D", label: "Paid" },
 unpaid: { bg: "#FEF3C7", text: "#B45309", label: "Unpaid" },
 overdue: { bg: "#FEE2E2", text: "#DC2626", label: "Overdue" },
 pending: { bg: "#DBEAFE", text: "#2563EB", label: "Pending" },
};

export default function InvoiceHistoryScreen() {
 const theme = useTheme();
 const topInset = useTopInset();
 const bottomInset = useBottomInset();
 const [activeTab, setActiveTab] = useState<HistoryTab>("sales");
 const [loading, setLoading] = useState(true);
 const [refreshing, setRefreshing] = useState(false);
 const [invoices, setInvoices] = useState<any[]>([]);
 const [b2bInvoices, setB2bInvoices] = useState<any[]>([]);
 const [purchases, setPurchases] = useState<any[]>([]);
 const [searchQuery, setSearchQuery] = useState("");
 const [statusFilter, setStatusFilter] = useState("All");

 const [detailTab, setDetailTab] = useState<HistoryTab>("sales");
 const [detailInvoiceId, setDetailInvoiceId] = useState<string | null>(null);
 const [detailInvoice, setDetailInvoice] = useState<any | null>(null);
 const [detailLoading, setDetailLoading] = useState(false);

 const [voiding, setVoiding] = useState(false);
 const [returning, setReturning] = useState(false);
 const [sending, setSending] = useState(false);

 const statuses = useMemo(() => {
 return ["All", ...new Set([...invoices, ...b2bInvoices, ...purchases].map((i) => i.payment_status || "pending"))];
 }, [invoices, b2bInvoices, purchases]);

 const loadData = useCallback(async () => {
 setLoading(true);
 try {
 const endpoints = {
 sales: "/invoices",
 b2b: "/b2b/invoices",
 purchases: "/purchases",
 } as const;
 const res: any = await api.get(endpoints[activeTab]);
 if (activeTab === "sales") setInvoices(res?.data || []);
 else if (activeTab === "b2b") setB2bInvoices(res?.data || []);
 else setPurchases(res?.data || []);
 } catch {} finally { setLoading(false); }
 }, [activeTab]);

 useEffect(() => { loadData(); }, [loadData]);

 const onRefresh = useCallback(async () => {
 setRefreshing(true);
 try { await loadData(); } finally { setRefreshing(false); }
 }, [loadData]);

 const getActiveData = () => {
 if (activeTab === "sales") return invoices;
 if (activeTab === "b2b") return b2bInvoices;
 return purchases;
 };

 const filteredData = useMemo(() => {
 const data = getActiveData();
 const q = searchQuery.toLowerCase().trim();
 return data.filter((item: any) => {
 const searchable = (item.invoice_number || item.purchase_number || "").toLowerCase();
 const partyName = item.party?.name || item.supplier?.name || "";
 const matchesSearch = !q || searchable.includes(q) || partyName.toLowerCase().includes(q);
 const matchesStatus = statusFilter === "All" || item.payment_status === statusFilter;
 return matchesSearch && matchesStatus;
 });
 }, [activeTab, invoices, b2bInvoices, purchases, searchQuery, statusFilter]);

 const openDetail = async (id: string, tab: HistoryTab = "sales") => {
 setDetailTab(tab);
 setDetailInvoiceId(id);
 setDetailLoading(true);
 setDetailInvoice(null);
 try {
 const endpoint = tab === "b2b" ? `/b2b/invoices/${id}` : tab === "purchases" ? `/purchases/${id}` : `/invoices/${id}/detail`;
 const res = await api.get<{ data: any }>(endpoint);
 setDetailInvoice(res.data);
 } catch { Alert.alert("Error", "Could not load detail."); } finally { setDetailLoading(false); }
 };

 const handleVoid = async () => {
 if (!detailInvoice) return;
 Alert.alert("Void Invoice", "Are you sure you want to void this invoice?", [
 { text: "Cancel", style: "cancel" },
 { text: "Void", style: "destructive", onPress: async () => {
 setVoiding(true);
 try { await api.patch(`/invoices/${detailInvoice.id}/void`); Alert.alert("Voided", "Invoice has been voided."); setDetailInvoiceId(null); loadData(); }
 catch (e) { Alert.alert("Error", e instanceof ApiError ? e.message : "Failed to void."); }
 finally { setVoiding(false); }
 }},
 ]);
 };

 const handleReturn = async () => {
 if (!detailInvoice) return;
 Alert.alert("Return", "Create a return for this invoice?", [
 { text: "Cancel", style: "cancel" },
 { text: "Create Return", onPress: async () => {
 setReturning(true);
 try { await api.post(`/invoices/${detailInvoice.id}/return`); Alert.alert("Return Created", "Return has been processed."); setDetailInvoiceId(null); loadData(); }
 catch (e) { Alert.alert("Error", e instanceof ApiError ? e.message : "Failed."); }
 finally { setReturning(false); }
 }},
 ]);
 };

 const handleSend = async () => {
 if (!detailInvoice) return;
 setSending(true);
 try { await api.post(`/invoices/${detailInvoice.id}/send`); Alert.alert("Sent"); }
 catch (e) { Alert.alert("Error", e instanceof ApiError ? e.message : "Failed to send."); }
 finally { setSending(false); }
 };

 const handleExport = () => {
 const data = getActiveData();
 const headers = ["Invoice #", "Party", "Date", "Amount", "Status"];
 const rows = data.map((i: any) => [
 i.invoice_number || i.purchase_number || "—",
 i.party?.name || i.supplier?.name || "—",
 formatDate(i.date),
 formatRupee(Number(i.grand_total)),
 i.payment_status || "—",
 ]);
 shareDataAsPdf(
 activeTab === "sales" ? "Retail Invoices" : activeTab === "b2b" ? "B2B Invoices" : "Purchases",
 headers, rows, `${activeTab}.pdf`
 );
 };

 const renderStatusBadge = (status?: string) => {
 if (!status || status === "All") return null;
 const s = STATUS_COLORS[status];
 if (!s) return null;
 return (
 <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: s.bg }}>
 <Text style={{ color: s.text, fontSize: 10, fontWeight: "700" }}>{s.label}</Text>
 </View>
 );
 };

 const renderCard = (item: any, tab: HistoryTab) => {
 const isPurchase = tab === "purchases";
 const number = item.invoice_number || item.purchase_number || "—";
 const party = item.party?.name || item.supplier?.name || (isPurchase ? "Supplier" : "Walk-in");
 const amount = Number(item.grand_total);
 const type = item.type || tab;
 const typeColor = TYPE_COLORS[type] || "#6B7280";
 const typeLabel = TYPE_LABELS[type] || type;

 return (
 <Pressable
 onPress={() => openDetail(item.id, tab)}
 className="bg-surface-container-lowest rounded-2xl mx-4 mb-3 overflow-hidden active:opacity-80"
 >
 <View style={{ borderLeftWidth: 3, borderLeftColor: typeColor }}>
 <View className="p-4">
 <View className="flex-row items-center justify-between mb-1">
 <View className="flex-row items-center flex-1 mr-2" style={{ gap: 6 }}>
 <Text className="font-mono text-sm font-bold text-on-surface" numberOfLines={1}>
 {number}
 </Text>
 <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: typeColor + "18" }}>
 <Text style={{ color: typeColor, fontSize: 9, fontWeight: "700" }}>{typeLabel}</Text>
 </View>
 </View>
 {renderStatusBadge(item.payment_status)}
 </View>
 <View className="flex-row items-center justify-between mt-1">
 <View className="flex-1 mr-2">
 <Text className="text-sm text-on-surface-variant" numberOfLines={1}>{party}</Text>
 <Text className="text-xs text-on-surface-variant mt-0.5">{formatDate(item.date)}</Text>
 </View>
 <Text className="font-bold text-base text-on-surface">{formatRupee(amount)}</Text>
 </View>
 </View>
 </View>
 </Pressable>
 );
 };

 const renderDetailSheet = () => {
 if (detailLoading || !detailInvoice) return <ActivityIndicator color={theme.colors.primary} className="py-10" />;

 const number = detailInvoice.invoiceNumber || detailInvoice.invoice_number || detailInvoice.purchaseNumber || detailInvoice.purchase_number || "Detail";
 const party = detailInvoice.party?.name || detailInvoice.supplier?.name || "—";
 const amount = Number(detailInvoice.grandTotal || detailInvoice.grand_total);
 const type = detailInvoice.type || detailTab;

 return (
 <ScrollView>
 <View className="flex-row items-center mb-3" style={{ gap: 8 }}>
 <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: (TYPE_COLORS[type] || "#6B7280") + "18" }}>
 <Text style={{ color: TYPE_COLORS[type] || "#6B7280", fontSize: 10, fontWeight: "700" }}>
 {TYPE_LABELS[type] || type}
 </Text>
 </View>
 {renderStatusBadge(detailInvoice.paymentStatus || detailInvoice.payment_status)}
 </View>
 <Text className="text-sm text-on-surface-variant mb-1" numberOfLines={1}>{party}</Text>
 <Text className="text-2xl font-black text-on-surface mb-4">{formatRupee(amount)}</Text>

 <View className="bg-surface-container rounded-xl p-4 mb-4">
 <Text className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">Details</Text>
 <DetailRow label="Date" value={formatDate(detailInvoice.date)} />
 <DetailRow label="Invoice" value={number} />
 {detailInvoice.paymentMode && <DetailRow label="Payment" value={detailInvoice.paymentMode} />}
 {detailInvoice.warehouse?.name && <DetailRow label="Warehouse" value={detailInvoice.warehouse.name} />}
 </View>

 {detailInvoice.items && detailInvoice.items.length > 0 && (
 <View className="bg-surface-container rounded-xl p-4 mb-4">
 <Text className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">Items</Text>
 {detailInvoice.items.map((item: any, idx: number) => (
 <View key={idx} className="flex-row items-center justify-between py-1.5" style={idx > 0 ? { borderTopWidth: 1, borderTopColor: "#E5E7EB" } : undefined}>
 <Text className="flex-1 mr-2 text-sm text-on-surface" numberOfLines={1}>
 {item.product?.name || item.name || `Item ${idx + 1}`}
 </Text>
 <Text className="text-sm font-bold text-on-surface-variant shrink-0">
 {item.quantity || 0} × {formatRupee(Number(item.rate || item.price || 0))}
 </Text>
 </View>
 ))}
 </View>
 )}

 <View className="bg-surface-container rounded-xl p-4 mb-4">
 <Text className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-3">Actions</Text>
 <View className="flex-row flex-wrap" style={{ gap: 8 }}>
 <ActionButton icon="share-variant" label="Share" onPress={() => Share.share({ message: `${number}: ${formatRupee(amount)}` })} />
 <ActionButton icon="file-pdf-box" label="PDF" onPress={async () => {
 const pdfUrl = `${apiUrl}/invoices/${detailInvoice.id}/pdf`;
 await Share.share({ message: `Download: ${pdfUrl}` });
 }} />
 <ActionButton icon="email" label={sending ? "..." : "Send"} onPress={handleSend} fill />
 {detailTab === "sales" && (
 <>
 <ActionButton icon="undo" label={returning ? "..." : "Return"} onPress={handleReturn} color="#EA580C" />
 <ActionButton icon="cancel" label={voiding ? "..." : "Void"} onPress={handleVoid} color="#DC2626" />
 </>
 )}
 </View>
 </View>

 {detailTab === "sales" && (
 <View className="bg-surface-container rounded-xl p-4">
 <Text className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-3">Compliance</Text>
 <ComplianceField
 label="e-Way Bill"
 value={detailInvoice.ewayBill ? `EWB ${detailInvoice.ewayBill.ewbNumber}` : null}
 onAdd={() => {
 Alert.prompt?.("e-Way Bill", "Enter e-way bill number:", async (val) => {
 if (!val?.trim()) return;
 try {
 const res = await api.post<{ data: any }>(`/eway-bills/${detailInvoice.id}`, { ewbNumber: val.trim() });
 setDetailInvoice({ ...detailInvoice, ewayBill: res.data });
 } catch (e) { Alert.alert("Error", e instanceof ApiError ? e.message : "Failed."); }
 });
 }}
 />
 <ComplianceField
 label="e-Invoice (IRN)"
 value={detailInvoice.eInvoice ? `IRN ${detailInvoice.eInvoice.irn}` : null}
 onAdd={() => {
 Alert.prompt?.("e-Invoice", "Enter IRN:", async (val) => {
 if (!val?.trim()) return;
 try {
 const res = await api.post<{ data: any }>(`/e-invoices/${detailInvoice.id}`, { irn: val.trim() });
 setDetailInvoice({ ...detailInvoice, eInvoice: res.data });
 } catch (e) { Alert.alert("Error", e instanceof ApiError ? e.message : "Failed."); }
 });
 }}
 />
 </View>
 )}
 </ScrollView>
 );
 };

 return (
 <View className="flex-1 bg-background" style={{ paddingTop: topInset }}>
 {/* Header */}
 <View className="flex-row items-center px-4 py-3 border-b border-outline-variant">
 <Pressable onPress={() => router.back()} className="w-9 h-9 rounded-full bg-surface-container items-center justify-center mr-3">
 <MaterialCommunityIcons name="arrow-left" size={20} color="#374151" />
 </Pressable>
 <Text className="font-headline-md text-on-surface flex-1" style={{ fontSize: 18, fontWeight: "700" }}>
 {activeTab === "sales" ? "Sales" : activeTab === "b2b" ? "B2B Orders" : "Purchases"}
 </Text>
 <Pressable onPress={handleExport} className="flex-row items-center bg-primary rounded-xl px-3 py-2" style={{ gap: 4 }}>
 <MaterialCommunityIcons name="file-pdf-box" size={14} color="white" />
 <Text className="text-white text-xs font-bold">Export</Text>
 </Pressable>
 </View>

 {/* Tabs */}
 <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-4 py-3" contentContainerStyle={{ gap: 8 }}>
 {TABS.map((tab) => (
 <Pressable
 key={tab.key}
 onPress={() => { setActiveTab(tab.key); setSearchQuery(""); setStatusFilter("All"); }}
 className={`flex-row items-center rounded-xl px-4 py-2.5 ${activeTab === tab.key ? "bg-surface-container-high" : "bg-surface-container"}`}
 style={{ gap: 6 }}
 >
 <MaterialCommunityIcons
 name={tab.icon}
 size={16}
 color={activeTab === tab.key ? theme.colors.primary : theme.colors.onSurfaceVariant}
 />
 <Text
 className="font-label-md"
 style={{ color: activeTab === tab.key ? theme.colors.primary : theme.colors.onSurfaceVariant }}
 >
 {tab.label}
 </Text>
 </Pressable>
 ))}
 </ScrollView>

 {/* Search + Filter */}
 <View className="px-4 pb-3" style={{ gap: 8 }}>
 <View className="flex-row items-center bg-surface-container-lowest rounded-2xl px-4 py-3 border border-outline-variant">
 <MaterialCommunityIcons name="magnify" size={18} color="#6B7280" />
 <TextInput
 value={searchQuery}
 onChangeText={setSearchQuery}
 placeholder="Search by invoice or party..."
 placeholderTextColor="#9CA3AF"
 className="flex-1 ml-2 text-sm font-medium text-on-surface"
 />
 {searchQuery.length > 0 && (
 <Pressable onPress={() => setSearchQuery("")} className="ml-2">
 <MaterialCommunityIcons name="close-circle" size={16} color="#9CA3AF" />
 </Pressable>
 )}
 </View>
 <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
 {statuses.map((s) => (
 <Pressable
 key={s}
 onPress={() => setStatusFilter(s)}
 className={`rounded-full px-3 py-1.5 ${statusFilter === s ? "bg-primary" : "bg-surface-container-lowest border border-outline-variant"}`}
 >
 <Text className={`text-xs font-bold ${statusFilter === s ? "text-white" : "text-on-surface-variant"}`}>
 {s === "All" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
 </Text>
 </Pressable>
 ))}
 </ScrollView>
 </View>

 {/* List */}
 {loading ? (
 <View className="flex-1 items-center justify-center">
 <ActivityIndicator size="large" color={theme.colors.primary} />
 </View>
 ) : filteredData.length === 0 ? (
 <EmptyState
 icon={activeTab === "sales" ? "cash-register" : activeTab === "b2b" ? "briefcase-account" : "truck-delivery"}
 title={activeTab === "sales" ? "No sales yet" : activeTab === "b2b" ? "No B2B orders" : "No purchases yet"}
 description={activeTab === "purchases" ? "Record purchase intakes in Inventory." : "Start selling at POS to register sales."}
 />
 ) : (
 <FlatList
 data={filteredData}
 keyExtractor={(i) => i.id}
 renderItem={({ item }) => renderCard(item, activeTab)}
 refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
 contentContainerStyle={{ paddingTop: 8, paddingBottom: bottomInset + 24 }}
 />
 )}

 {/* Detail bottom sheet */}
 <Modal visible={detailInvoiceId !== null} animationType="slide" transparent onRequestClose={() => setDetailInvoiceId(null)}>
 <View className="flex-1 justify-end bg-black/40">
 <View className="bg-background rounded-t-3xl px-5 pt-6 pb-10" style={{ maxHeight: "85%" }}>
 <View className="flex-row items-center justify-between mb-4">
 <View className="flex-1 mr-3">
 <Text className="font-bold text-lg text-on-surface" numberOfLines={1}>
 {detailInvoice?.invoiceNumber || detailInvoice?.invoice_number || detailInvoice?.purchaseNumber || detailInvoice?.purchase_number || "Detail"}
 </Text>
 </View>
 <Pressable onPress={() => setDetailInvoiceId(null)} className="w-9 h-9 rounded-full bg-surface-container items-center justify-center">
 <MaterialCommunityIcons name="close" size={18} color="#374151" />
 </Pressable>
 </View>
 {renderDetailSheet()}
 </View>
 </View>
 </Modal>
 </View>
 );
}

function DetailRow({ label, value }: { label: string; value: string }) {
 return (
 <View className="flex-row justify-between py-1">
 <Text className="text-sm text-on-surface-variant">{label}</Text>
 <Text className="text-sm font-semibold text-on-surface">{value}</Text>
 </View>
 );
}

function ActionButton({
 icon,
 label,
 onPress,
 fill,
 color,
}: {
 icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
 label: string;
 onPress: () => void;
 fill?: boolean;
 color?: string;
}) {
 const bgColor = color ? undefined : fill ? undefined : undefined;
 const textColor = fill ? "#fff" : color || "#1E8E85";

 return (
 <Pressable
 onPress={onPress}
 className={`flex-row items-center rounded-xl px-3.5 py-2.5 ${fill ? "bg-primary" : "bg-surface-container-lowest border border-outline-variant"}`}
 style={[fill ? {} : { backgroundColor: bgColor }, color && !fill ? { borderColor: color + "40" } : undefined]}
 >
 <MaterialCommunityIcons name={icon} size={14} color={fill ? "#fff" : textColor} />
 <Text className="text-xs font-bold ml-1.5" style={{ color: fill ? "#fff" : textColor }}>{label}</Text>
 </Pressable>
 );
}

function ComplianceField({
 label,
 value,
 onAdd,
}: {
 label: string;
 value: string | null;
 onAdd: () => void;
}) {
 return (
 <View className="flex-row items-center justify-between py-2">
 <Text className="text-sm text-on-surface-variant">{label}</Text>
 {value ? (
 <Text className="text-sm font-semibold text-on-surface" numberOfLines={1}>{value}</Text>
 ) : (
 <Pressable onPress={onAdd}>
 <Text className="text-sm font-bold text-primary">+ Add</Text>
 </Pressable>
 )}
 </View>
 );
}
