import React, { useState, useEffect, useCallback, useRef } from "react";
import { View, ScrollView, ActivityIndicator, RefreshControl, Pressable, TextInput, Modal, Alert } from "react-native";
import { Text } from "react-native";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { api } from "../src/lib/api";
import { useAuth } from "../src/lib/auth-context";
import { useTopInset, useBottomInset } from "../src/lib/useTopInset";
import { useTheme } from "react-native-paper";
import EmptyState from "../src/components/EmptyState";

function formatRupee(n: number): string {
 return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function formatDate(iso: string): string {
 return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

const STATUS_CFG: Record<string, { label: string; icon: string; color: string }> = {
 pending: { label: "Pending", icon: "clock-outline", color: "#F0AE4E" },
 in_transit: { label: "In Transit", icon: "truck-delivery", color: "#0368FE" },
 delivered: { label: "Delivered", icon: "check-circle", color: "#2E9E5B" },
};

const REASONS = [
 { value: "supply", label: "Supply" }, { value: "export", label: "Export" },
 { value: "job_work", label: "Job Work" }, { value: "sales_return", label: "Sales Return" },
 { value: "line_sales", label: "Line Sales" }, { value: "exhibition_or_fairs", label: "Exhibition / Fairs" },
 { value: "own_use", label: "Own Use" }, { value: "others", label: "Others" },
];

const TRANSPORT_MODES = [
 { value: "road", label: "Road" }, { value: "rail", label: "Rail" },
 { value: "air", label: "Air" }, { value: "ship", label: "Ship" },
];

export default function ChallansScreen() {
 const { userRole } = useAuth();
 const router = useRouter();
 const theme = useTheme();
 const topInset = useTopInset();
 const bottomInset = useBottomInset();
 const canEdit = userRole ? ["owner", "manager", "warehouse_manager", "staff"].includes(userRole) : false;

 const [loading, setLoading] = useState(true);
 const [refreshing, setRefreshing] = useState(false);
 const [challans, setChallans] = useState<any[]>([]);
 const [meta, setMeta] = useState<any>(null);
 const [page, setPage] = useState(1);
 const [search, setSearch] = useState("");

 const [detail, setDetail] = useState<any | null>(null);
 const [detailLoading, setDetailLoading] = useState(false);

 const [showCreate, setShowCreate] = useState(false);
 const [saving, setSaving] = useState(false);
 const [fPartyId, setFPartyId] = useState("");
 const [fPartySearch, setFPartySearch] = useState("");
 const [fPartyResults, setFPartyResults] = useState<any[]>([]);
 const [fReason, setFReason] = useState("supply");
 const [fDest, setFDest] = useState("");
 const [fPlace, setFPlace] = useState("");
 const [fVehicle, setFVehicle] = useState("");
 const [fTransport, setFTransport] = useState("road");
 const [fDriver, setFDriver] = useState("");
 const [fDriverPhone, setFDriverPhone] = useState("");
 const [fNotes, setFNotes] = useState("");
 const [fInvoiceId, setFInvoiceId] = useState("");
 const [fCart, setFCart] = useState<any[]>([]);
 const [fProdSearch, setFProdSearch] = useState("");
 const [fProdResults, setFProdResults] = useState<any[]>([]);

 const [showEdit, setShowEdit] = useState(false);
 const [editChallan, setEditChallan] = useState<any | null>(null);
 const [editDest, setEditDest] = useState("");
 const [editPlace, setEditPlace] = useState("");
 const [editVehicle, setEditVehicle] = useState("");
 const [editTransport, setEditTransport] = useState("road");
 const [editDriver, setEditDriver] = useState("");
 const [editDriverPhone, setEditDriverPhone] = useState("");
 const [editNotes, setEditNotes] = useState("");
 const [editLoading, setEditLoading] = useState(false);

 const partyTimer = useRef<any>(null);
 const prodTimer = useRef<any>(null);

 const fetchChallans = useCallback(async () => {
 try {
 const params: any = { page, limit: 20 };
 if (search) params.search = search;
 const res = await api.get<{ data: any[]; meta: any }>("/challans", { params });
 setChallans(res.data || []);
 setMeta(res.meta);
 } catch { setChallans([]); }
 }, [page, search]);

 useEffect(() => {
 fetchChallans().finally(() => { setLoading(false); setRefreshing(false); });
 }, [fetchChallans]);

 const loadDetail = async (id: string) => {
 setDetailLoading(true);
 try {
 const res = await api.get<{ data: any }>(`/challans/${id}/detail`);
 setDetail(res.data);
 } catch { Alert.alert("Error", "Could not load challan details."); }
 finally { setDetailLoading(false); }
 };

 const searchParty = (q: string) => {
 setFPartySearch(q);
 if (partyTimer.current) clearTimeout(partyTimer.current);
 if (q.length < 1) { setFPartyResults([]); return; }
 partyTimer.current = setTimeout(async () => {
 try {
 const res = await api.get<any>("/parties", { params: { search: q, limit: 10 } });
 setFPartyResults(res.data || []);
 } catch { setFPartyResults([]); }
 }, 300);
 };

 const searchProduct = (q: string) => {
 setFProdSearch(q);
 if (prodTimer.current) clearTimeout(prodTimer.current);
 if (q.length < 1) { setFProdResults([]); return; }
 prodTimer.current = setTimeout(async () => {
 try {
 const res = await api.get<any>("/products", { params: { search: q, limit: 10 } });
 setFProdResults(res.data || []);
 } catch { setFProdResults([]); }
 }, 300);
 };

 const handleCreate = async () => {
 setSaving(true);
 try {
 await api.post("/challans", {
 reason: fReason, destination: fDest || undefined, placeOfSupply: fPlace || undefined,
 vehicleNumber: fVehicle || undefined, transportMode: fTransport,
 driverName: fDriver || undefined, driverPhone: fDriverPhone || undefined,
 notes: fNotes || undefined, partyId: fPartyId || undefined, invoiceId: fInvoiceId || undefined,
 items: fCart.map((c) => ({ productId: c.productId, quantity: c.quantity })),
 });
 setShowCreate(false);
 resetForm();
 await fetchChallans();
 } catch { Alert.alert("Error", "Failed to create challan."); }
 finally { setSaving(false); }
 };

 const handleEdit = async () => {
 if (!editChallan) return;
 setEditLoading(true);
 try {
 await api.patch(`/challans/${editChallan.id}`, {
 destination: editDest || undefined, placeOfSupply: editPlace || undefined,
 vehicleNumber: editVehicle || undefined, transportMode: editTransport,
 driverName: editDriver || undefined, driverPhone: editDriverPhone || undefined,
 notes: editNotes || undefined,
 });
 setShowEdit(false);
 setEditChallan(null);
 await fetchChallans();
 } catch { Alert.alert("Error", "Failed to update challan."); }
 finally { setEditLoading(false); }
 };

 const handleStatus = async (id: string, status: string) => {
 try {
 await api.patch(`/challans/${id}/status`, { status });
 await fetchChallans();
 if (detail?.id === id) loadDetail(id);
 } catch { Alert.alert("Error", "Failed to update status."); }
 };

 const handleDelete = async (id: string) => {
 try {
 await api.delete(`/challans/${id}`);
 await fetchChallans();
 setDetail(null);
 } catch { Alert.alert("Error", "Failed to delete challan."); }
 };

 const resetForm = () => {
 setFPartyId(""); setFPartySearch(""); setFPartyResults([]); setFReason("supply");
 setFDest(""); setFPlace(""); setFVehicle(""); setFTransport("road");
 setFDriver(""); setFDriverPhone(""); setFNotes(""); setFInvoiceId("");
 setFCart([]); setFProdSearch(""); setFProdResults([]);
 };

 const openEdit = (c: any) => {
 setEditChallan(c); setEditDest(c.destination || ""); setEditPlace(c.place_of_supply || "");
 setEditVehicle(c.vehicle_number || ""); setEditTransport(c.transport_mode || "road");
 setEditDriver(c.driver_name || ""); setEditDriverPhone(c.driver_phone || ""); setEditNotes(c.notes || "");
 setShowEdit(true);
 };

 if (loading) {
 return <View className="flex-1 items-center justify-center bg-background"><ActivityIndicator size="large" color={theme.colors.primary} /></View>;
 }

 return (
 <View className="flex-1 bg-background">
 <ScrollView
 contentContainerStyle={{ paddingTop: topInset + 16, paddingBottom: bottomInset + 100 }}
 refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchChallans(); }} />}
 >
 {/* Header */}
 <View className="flex-row items-center justify-between px-5 mb-3">
 <View className="flex-row items-center" style={{ gap: 8 }}>
 <Pressable onPress={() => router.back()} className="w-9 h-9 items-center justify-center -ml-1">
 <MaterialCommunityIcons name="arrow-left" size={22} color={theme.colors.onSurfaceVariant} />
 </Pressable>
 <Text className="font-headline-md text-on-surface" style={{ fontSize: 20, fontWeight: "700" }}>Challans</Text>
 </View>
 {canEdit && (
 <Pressable onPress={() => setShowCreate(true)} className="bg-primary px-4 py-2.5 rounded-xl flex-row items-center" style={{ gap: 4 }}>
 <MaterialCommunityIcons name="plus" size={16} color="white" /><Text className="text-white font-bold text-sm">New</Text>
 </Pressable>
 )}
 </View>

 {/* Search */}
 <View className="flex-row items-center bg-surface-container-lowest mx-5 mb-3 rounded-2xl px-4 py-3 border border-outline-variant">
 <MaterialCommunityIcons name="magnify" size={18} color="#6B7280" />
 <TextInput value={search} onChangeText={(v) => { setSearch(v); setPage(1); }}
 placeholder="Search challans..." placeholderTextColor="#9CA3AF"
 className="flex-1 ml-2 text-base font-medium text-on-surface" />
 {search ? (
 <Pressable onPress={() => { setSearch(""); setPage(1); }}>
 <MaterialCommunityIcons name="close-circle" size={18} color="#9CA3AF" />
 </Pressable>
 ) : null}
 </View>

 {challans.length === 0 ? (
 <EmptyState icon="clipboard-list-outline" title="No challans yet"
 description={canEdit ? 'Tap "New" to create your first delivery challan.' : undefined} />
 ) : (
 challans.map((c) => {
 const st = STATUS_CFG[c.status] || { label: c.status, icon: "help", color: "#9E9E9E" };
 return (
 <Pressable key={c.id} onPress={() => loadDetail(c.id)}
 className="mx-5 mb-3 bg-surface-container-lowest border border-outline-variant rounded-2xl p-4">
 <View className="flex-row items-center justify-between mb-2">
 <View className="flex-row items-center" style={{ gap: 8 }}>
 <View className="w-9 h-9 rounded-full items-center justify-center" style={{ backgroundColor: `${st.color}15` }}>
 <MaterialCommunityIcons name={st.icon as any} size={18} color={st.color} />
 </View>
 <View>
 <Text className="text-sm font-bold text-on-surface">{c.challan_number}</Text>
 <Text className="text-xs text-on-surface-variant">{c.party?.name || "Walk-in"} · {formatDate(c.created_at)}</Text>
 </View>
 </View>
 <View className="items-end">
 <Text className="text-sm font-bold text-on-surface">{formatRupee(Number(c.total_taxable_value))}</Text>
 <View className="rounded-full px-2 py-0.5 mt-1" style={{ backgroundColor: `${st.color}15` }}>
 <Text className="text-xs font-bold" style={{ color: st.color }}>{st.label}</Text>
 </View>
 </View>
 </View>
 {(c.vehicle_number || c.destination) && (
 <View className="flex-row" style={{ gap: 12 }}>
 {c.vehicle_number && (
 <View className="flex-row items-center" style={{ gap: 4 }}>
 <MaterialCommunityIcons name="truck" size={12} color="#9CA3AF" />
 <Text className="text-xs text-on-surface-variant">{c.vehicle_number}</Text>
 </View>
 )}
 {c.destination && (
 <View className="flex-row items-center" style={{ gap: 4 }}>
 <MaterialCommunityIcons name="map-marker" size={12} color="#9CA3AF" />
 <Text className="text-xs text-on-surface-variant" numberOfLines={1}>{c.destination}</Text>
 </View>
 )}
 </View>
 )}
 </Pressable>
 );
 })
 )}

 {/* Pagination */}
 {meta && meta.totalPages > 1 && (
 <View className="flex-row justify-center items-center px-5 mt-3" style={{ gap: 12 }}>
 <Pressable onPress={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
 className="border border-outline-variant rounded-xl px-4 py-2">
 <Text className="text-xs font-bold text-on-surface" style={{ opacity: page <= 1 ? 0.4 : 1 }}>Previous</Text>
 </Pressable>
 <Text className="text-xs text-on-surface-variant">Page {meta.page} of {meta.totalPages}</Text>
 <Pressable onPress={() => setPage((p) => p + 1)} disabled={page >= meta.totalPages}
 className="border border-outline-variant rounded-xl px-4 py-2">
 <Text className="text-xs font-bold text-on-surface" style={{ opacity: page >= meta.totalPages ? 0.4 : 1 }}>Next</Text>
 </Pressable>
 </View>
 )}
 </ScrollView>

 {/* Detail bottom sheet */}
 <Modal visible={!!detail} animationType="slide" transparent onRequestClose={() => setDetail(null)}>
 <View className="flex-1 justify-end bg-black/40">
 {detailLoading ? (
 <View className="bg-background rounded-t-3xl p-10 items-center"><ActivityIndicator size="large" color={theme.colors.primary} /></View>
 ) : detail ? (
 <View className="bg-background rounded-t-3xl max-h-[85%]" style={{ paddingBottom: bottomInset + 16 }}>
 {/* Handle */}
 <View className="items-center pt-3 pb-2"><View className="w-10 h-1 rounded-full bg-gray-300" /></View>

 <ScrollView className="px-5">
 {/* Title row */}
 <View className="flex-row justify-between items-start mb-4">
 <View>
 <Text className="font-headline-md text-on-surface" style={{ fontSize: 18, fontWeight: "700" }}>{detail.challan_number}</Text>
 <Text className="text-xs text-on-surface-variant">{formatDate(detail.created_at)}</Text>
 </View>
 <Pressable onPress={() => setDetail(null)} className="w-9 h-9 items-center justify-center">
 <MaterialCommunityIcons name="close" size={20} color={theme.colors.onSurfaceVariant} />
 </Pressable>
 </View>

 {/* Status stepper */}
 <View className="flex-row items-center mb-5" style={{ gap: 0 }}>
 {["pending", "in_transit", "delivered"].map((s, i) => {
 const cfg = STATUS_CFG[s];
 const isCurrent = detail.status === s;
 const isPast = s === "pending" || (s === "in_transit" && detail.status === "delivered");
 return (
 <React.Fragment key={s}>
 <View className="flex-row items-center" style={{ gap: 4 }}>
 <MaterialCommunityIcons name={cfg.icon as any} size={16}
 color={isCurrent || isPast ? cfg.color : "#D1D5DB"} />
 <Text className="text-xs font-bold" style={{ color: isCurrent || isPast ? cfg.color : "#9CA3AF" }}>{cfg.label}</Text>
 </View>
 {i < 2 && <View className="w-6 h-px mx-1" style={{ backgroundColor: "#D1D5DB" }} />}
 </React.Fragment>
 );
 })}
 </View>

 {/* Party */}
 <View className="mb-4">
 <Text className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-0.5">Party</Text>
 <Text className="text-sm font-bold text-on-surface">{detail.party?.name || "Walk-in / Unnamed"}</Text>
 {detail.party?.gstin && <Text className="text-xs text-on-surface-variant">GSTIN: {detail.party.gstin}</Text>}
 </View>

 {/* Reason */}
 <View className="mb-4">
 <Text className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-0.5">Reason</Text>
 <Text className="text-sm text-on-surface capitalize">{detail.reason.replace(/_/g, " ")}</Text>
 </View>

 {/* Transport */}
 {(detail.vehicle_number || detail.driver_name || detail.destination) && (
 <View className="bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant mb-4">
 {detail.vehicle_number && <Text className="text-xs text-on-surface">Vehicle: {detail.vehicle_number}</Text>}
 {detail.driver_name && <Text className="text-xs text-on-surface mt-1">Driver: {detail.driver_name}{detail.driver_phone ? ` (${detail.driver_phone})` : ""}</Text>}
 {detail.destination && <Text className="text-xs text-on-surface mt-1">Destination: {detail.destination}</Text>}
 {detail.place_of_supply && <Text className="text-xs text-on-surface mt-1">Place of Supply: {detail.place_of_supply}</Text>}
 </View>
 )}

 {/* Items */}
 {detail.items && detail.items.length > 0 && (
 <View className="bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant mb-4">
 <Text className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">Items</Text>
 {detail.items.map((item: any) => (
 <View key={item.id} className="flex-row items-center justify-between py-2 border-b border-outline-variant">
 <View className="flex-1">
 <Text className="text-xs font-semibold text-on-surface">{item.product?.name || item.product_id}</Text>
 <Text className="text-xs text-on-surface-variant">{item.product?.sku || ""}{item.hsn_code ? ` HSN: ${item.hsn_code}` : ""}</Text>
 </View>
 <View className="items-end">
 <Text className="text-xs text-on-surface">{Number(item.quantity).toLocaleString("en-IN")} {item.product?.unit || "pcs"}</Text>
 {item.taxable_value != null && <Text className="text-xs font-bold text-on-surface">{formatRupee(Number(item.taxable_value))}</Text>}
 </View>
 </View>
 ))}
 <View className="flex-row justify-between pt-2">
 <Text className="text-xs font-bold text-on-surface">Total</Text>
 <Text className="text-sm font-bold text-primary">{formatRupee(Number(detail.total_taxable_value))}</Text>
 </View>
 </View>
 )}

 {/* Notes */}
 {detail.notes && (
 <View className="mb-4">
 <Text className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-0.5">Notes</Text>
 <Text className="text-xs text-on-surface">{detail.notes}</Text>
 </View>
 )}

 {/* Actions */}
 <View className="flex-row flex-wrap" style={{ gap: 8, paddingBottom: bottomInset + 16 }}>
 {canEdit && detail.status === "pending" && (
 <>
 <Pressable onPress={() => { setDetail(null); openEdit(detail); }}
 className="bg-primary px-5 py-3 rounded-xl"><Text className="text-white font-bold text-sm">Edit Logistics</Text></Pressable>
 <Pressable onPress={() => handleStatus(detail.id, "in_transit")}
 className="bg-success px-5 py-3 rounded-xl flex-row items-center" style={{ gap: 4 }}>
 <MaterialCommunityIcons name="truck-delivery" size={16} color="white" />
 <Text className="text-white font-bold text-sm">In Transit</Text>
 </Pressable>
 <Pressable onPress={() => handleDelete(detail.id)}
 className="border border-error px-5 py-3 rounded-xl"><Text className="text-error font-bold text-sm">Delete</Text></Pressable>
 </>
 )}
 {canEdit && detail.status === "in_transit" && (
 <Pressable onPress={() => handleStatus(detail.id, "delivered")}
 className="bg-success px-5 py-3 rounded-xl flex-row items-center" style={{ gap: 4 }}>
 <MaterialCommunityIcons name="check-circle" size={16} color="white" />
 <Text className="text-white font-bold text-sm">Mark Delivered</Text>
 </Pressable>
 )}
 </View>
 </ScrollView>
 </View>
 ) : null}
 </View>
 </Modal>

 {/* Create modal */}
 <Modal visible={showCreate} animationType="slide" onRequestClose={() => { setShowCreate(false); resetForm(); }}>
 <View className="flex-1 bg-background" style={{ paddingTop: topInset }}>
 <View className="flex-row items-center justify-between px-5 py-4">
 <Text className="font-headline-md text-on-surface" style={{ fontSize: 20, fontWeight: "700" }}>New Challan</Text>
 <Pressable onPress={() => { setShowCreate(false); resetForm(); }} className="w-9 h-9 items-center justify-center">
 <MaterialCommunityIcons name="close" size={20} color={theme.colors.onSurfaceVariant} />
 </Pressable>
 </View>
 <ScrollView className="flex-1 px-5 pb-10" style={{ gap: 12 }}>
 {/* Party */}
 <Text className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1">Party (optional)</Text>
 <View className="flex-row items-center bg-surface-container-lowest rounded-2xl px-4 py-3 border border-outline-variant mb-2">
 <MaterialCommunityIcons name="magnify" size={18} color="#6B7280" />
 <TextInput value={fPartySearch} onChangeText={searchParty} placeholder="Search parties..." placeholderTextColor="#9CA3AF"
 className="flex-1 ml-2 text-base font-medium text-on-surface" />
 </View>
 {fPartyResults.length > 0 && (
 <View className="border border-outline-variant rounded-xl mb-3">
 {fPartyResults.map((p: any) => (
 <Pressable key={p.id} onPress={() => { setFPartyId(p.id); setFPartySearch(p.name); setFPartyResults([]); }}
 className="px-4 py-3 border-b border-outline-variant">
 <Text className="text-sm text-on-surface">{p.name}</Text>
 {p.gstin && <Text className="text-xs text-on-surface-variant">{p.gstin}</Text>}
 </Pressable>
 ))}
 </View>
 )}

 {/* Reason */}
 <Text className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">Reason</Text>
 <View className="flex-row flex-wrap mb-3" style={{ gap: 6 }}>
 {REASONS.map((r) => (
 <Pressable key={r.value} onPress={() => setFReason(r.value)}
 className={`rounded-xl px-4 py-2.5 ${fReason === r.value ? "bg-primary" : "bg-surface-container-lowest border border-outline-variant"}`}>
 <Text className={`text-xs font-bold ${fReason === r.value ? "text-white" : "text-on-surface"}`}>{r.label}</Text>
 </Pressable>
 ))}
 </View>

 <TextInput value={fDest} onChangeText={setFDest} placeholder="Destination (optional)" placeholderTextColor="#9CA3AF"
 className="bg-surface-container-lowest text-on-surface border border-outline-variant rounded-xl px-4 py-3 font-medium mb-3" />
 <TextInput value={fPlace} onChangeText={setFPlace} placeholder="Place of Supply (optional)" placeholderTextColor="#9CA3AF"
 className="bg-surface-container-lowest text-on-surface border border-outline-variant rounded-xl px-4 py-3 font-medium mb-3" />
 <TextInput value={fVehicle} onChangeText={setFVehicle} placeholder="Vehicle Number (optional)" placeholderTextColor="#9CA3AF"
 className="bg-surface-container-lowest text-on-surface border border-outline-variant rounded-xl px-4 py-3 font-medium mb-3" />

 {/* Transport Mode */}
 <Text className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">Transport Mode</Text>
 <View className="flex-row flex-wrap mb-3" style={{ gap: 6 }}>
 {TRANSPORT_MODES.map((m) => (
 <Pressable key={m.value} onPress={() => setFTransport(m.value)}
 className={`rounded-xl px-4 py-2.5 ${fTransport === m.value ? "bg-primary" : "bg-surface-container-lowest border border-outline-variant"}`}>
 <Text className={`text-xs font-bold ${fTransport === m.value ? "text-white" : "text-on-surface"}`}>{m.label}</Text>
 </Pressable>
 ))}
 </View>

 <TextInput value={fDriver} onChangeText={setFDriver} placeholder="Driver Name (optional)" placeholderTextColor="#9CA3AF"
 className="bg-surface-container-lowest text-on-surface border border-outline-variant rounded-xl px-4 py-3 font-medium mb-3" />
 <TextInput value={fDriverPhone} onChangeText={setFDriverPhone} placeholder="Driver Phone (optional)" placeholderTextColor="#9CA3AF" keyboardType="phone-pad"
 className="bg-surface-container-lowest text-on-surface border border-outline-variant rounded-xl px-4 py-3 font-medium mb-3" />
 <TextInput value={fNotes} onChangeText={setFNotes} placeholder="Notes (optional)" placeholderTextColor="#9CA3AF" multiline
 className="bg-surface-container-lowest text-on-surface border border-outline-variant rounded-xl px-4 py-3 font-medium mb-3" />
 <TextInput value={fInvoiceId} onChangeText={setFInvoiceId} placeholder="Link Invoice ID (optional)" placeholderTextColor="#9CA3AF"
 className="bg-surface-container-lowest text-on-surface border border-outline-variant rounded-xl px-4 py-3 font-medium mb-3" />

 {/* Products */}
 <Text className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">Items ({fCart.length})</Text>
 <View className="flex-row mb-2" style={{ gap: 8 }}>
 <View className="flex-1 flex-row items-center bg-surface-container-lowest rounded-2xl px-4 py-3 border border-outline-variant">
 <MaterialCommunityIcons name="magnify" size={18} color="#6B7280" />
 <TextInput value={fProdSearch} onChangeText={searchProduct} placeholder="Search products..." placeholderTextColor="#9CA3AF"
 className="flex-1 ml-2 text-base font-medium text-on-surface" />
 </View>
 </View>
 {fProdResults.length > 0 && (
 <View className="border border-outline-variant rounded-xl max-h-32 mb-2">
 {fProdResults.map((p: any) => (
 <Pressable key={p.id}
 onPress={() => {
 const existing = fCart.find((c) => c.productId === p.id);
 if (existing) {
 setFCart(fCart.map((c) => c.productId === p.id ? { ...c, quantity: c.quantity + 1 } : c));
 } else {
 setFCart([...fCart, { productId: p.id, name: p.name, quantity: 1 }]);
 }
 setFProdSearch(""); setFProdResults([]);
 }}
 className="px-4 py-3 border-b border-outline-variant">
 <Text className="text-sm text-on-surface">{p.name}</Text>
 </Pressable>
 ))}
 </View>
 )}
 {fCart.map((item: any) => (
 <View key={item.productId} className="flex-row items-center bg-surface-container-lowest rounded-xl px-4 py-3 mb-2 border border-outline-variant" style={{ gap: 8 }}>
 <Text className="text-sm font-bold text-on-surface flex-1" numberOfLines={1}>{item.name}</Text>
 <Pressable onPress={() => setFCart(fCart.map((c) => c.productId === item.productId ? { ...c, quantity: Math.max(1, c.quantity - 1) } : c))}
 className="w-7 h-7 rounded-full bg-surface-container items-center justify-center">
 <MaterialCommunityIcons name="minus" size={14} color={theme.colors.onSurfaceVariant} />
 </Pressable>
 <Text className="text-sm font-bold w-5 text-center text-on-surface">{item.quantity}</Text>
 <Pressable onPress={() => setFCart(fCart.map((c) => c.productId === item.productId ? { ...c, quantity: c.quantity + 1 } : c))}
 className="w-7 h-7 rounded-full bg-surface-container items-center justify-center">
 <MaterialCommunityIcons name="plus" size={14} color={theme.colors.onSurfaceVariant} />
 </Pressable>
 <Pressable onPress={() => setFCart(fCart.filter((c) => c.productId !== item.productId))}>
 <MaterialCommunityIcons name="close" size={16} color="#D64545" />
 </Pressable>
 </View>
 ))}

 <Pressable onPress={handleCreate} disabled={saving}
 className="bg-primary py-4 rounded-2xl items-center mt-4" style={{ marginBottom: bottomInset }}>
 {saving ? <ActivityIndicator color="white" /> : <Text className="text-white font-bold">Create Challan</Text>}
 </Pressable>
 </ScrollView>
 </View>
 </Modal>

 {/* Edit modal */}
 <Modal visible={showEdit} animationType="slide" transparent onRequestClose={() => setShowEdit(false)}>
 <View className="flex-1 justify-end bg-black/40">
 <View className="bg-background rounded-t-3xl max-h-[80%]" style={{ paddingBottom: bottomInset + 16 }}>
 <View className="items-center pt-3 pb-2"><View className="w-10 h-1 rounded-full bg-gray-300" /></View>
 <ScrollView className="px-5">
 <Text className="font-headline-md text-on-surface mb-4" style={{ fontSize: 20, fontWeight: "700" }}>Edit Logistics</Text>
 <TextInput value={editDest} onChangeText={setEditDest} placeholder="Destination" placeholderTextColor="#9CA3AF"
 className="bg-surface-container-lowest text-on-surface border border-outline-variant rounded-xl px-4 py-3 font-medium mb-3" />
 <TextInput value={editPlace} onChangeText={setEditPlace} placeholder="Place of Supply" placeholderTextColor="#9CA3AF"
 className="bg-surface-container-lowest text-on-surface border border-outline-variant rounded-xl px-4 py-3 font-medium mb-3" />
 <TextInput value={editVehicle} onChangeText={setEditVehicle} placeholder="Vehicle Number" placeholderTextColor="#9CA3AF"
 className="bg-surface-container-lowest text-on-surface border border-outline-variant rounded-xl px-4 py-3 font-medium mb-3" />

 <Text className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">Transport Mode</Text>
 <View className="flex-row flex-wrap mb-3" style={{ gap: 6 }}>
 {TRANSPORT_MODES.map((m) => (
 <Pressable key={m.value} onPress={() => setEditTransport(m.value)}
 className={`rounded-xl px-4 py-2.5 ${editTransport === m.value ? "bg-primary" : "bg-surface-container-lowest border border-outline-variant"}`}>
 <Text className={`text-xs font-bold ${editTransport === m.value ? "text-white" : "text-on-surface"}`}>{m.label}</Text>
 </Pressable>
 ))}
 </View>

 <TextInput value={editDriver} onChangeText={setEditDriver} placeholder="Driver Name" placeholderTextColor="#9CA3AF"
 className="bg-surface-container-lowest text-on-surface border border-outline-variant rounded-xl px-4 py-3 font-medium mb-3" />
 <TextInput value={editDriverPhone} onChangeText={setEditDriverPhone} placeholder="Driver Phone" placeholderTextColor="#9CA3AF" keyboardType="phone-pad"
 className="bg-surface-container-lowest text-on-surface border border-outline-variant rounded-xl px-4 py-3 font-medium mb-3" />
 <TextInput value={editNotes} onChangeText={setEditNotes} placeholder="Notes" placeholderTextColor="#9CA3AF" multiline
 className="bg-surface-container-lowest text-on-surface border border-outline-variant rounded-xl px-4 py-3 font-medium mb-4" />

 <View className="flex-row" style={{ gap: 8 }}>
 <Pressable onPress={() => setShowEdit(false)}
 className="flex-1 border border-outline-variant py-4 rounded-2xl items-center">
 <Text className="text-on-surface font-bold">Cancel</Text>
 </Pressable>
 <Pressable onPress={handleEdit} disabled={editLoading}
 className="flex-1 bg-primary py-4 rounded-2xl items-center">
 {editLoading ? <ActivityIndicator color="white" /> : <Text className="text-white font-bold">Save</Text>}
 </Pressable>
 </View>
 </ScrollView>
 </View>
 </View>
 </Modal>
 </View>
 );
}
