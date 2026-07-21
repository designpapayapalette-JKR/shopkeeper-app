import React, { useState, useCallback } from "react";
import { View, ScrollView, Pressable, ActivityIndicator, RefreshControl, Text, Alert } from "react-native";
import { useTheme } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { api, ApiError } from "../src/lib/api";
import { useAuth } from "../src/lib/auth-context";
import { useTopInset } from "../src/lib/useTopInset";

function formatRupee(n: number): string {
 return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function timeAgo(iso: string): string {
 const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
 if (mins < 1) return "just now";
 if (mins < 60) return `${mins}m ago`;
 const hours = Math.floor(mins / 60);
 if (hours < 24) return `${hours}h ago`;
 return `${Math.floor(hours / 24)}d ago`;
}

function formatTime(iso: string): string {
 const d = new Date(iso);
 return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

export default function ShiftReconciliationScreen() {
 const theme = useTheme();
 const { userRole } = useAuth();
 const topInset = useTopInset();
 const [loading, setLoading] = useState(true);
 const [refreshing, setRefreshing] = useState(false);
 const [activeShift, setActiveShift] = useState<any>(null);
 const [todaySummary, setTodaySummary] = useState<any>(null);
 const [cashCount, setCashCount] = useState("");
 const [note, setNote] = useState("");
 const [submitting, setSubmitting] = useState(false);
 const [showCloseForm, setShowCloseForm] = useState(false);
 const [outletShifts, setOutletShifts] = useState<any[]>([]);
 const [showOutletView, setShowOutletView] = useState(false);

 const isCashier = userRole === "staff";
 const isManager = userRole === "manager" || userRole === "owner";

 const fetchData = useCallback(async () => {
 try {
 const activeRes = await api.get<{ data: any }>("/shifts/active");
 const active = activeRes.data;
 setActiveShift(active.active ? active.shift : null);
 setTodaySummary(active.todaySummary || null);

 if (isManager) {
 const outletRes = await api.get<{ data: any[]; meta: any }>("/shifts/outlet");
 setOutletShifts(outletRes.data ?? []);
 setShowOutletView(true);
 }
 } catch {}
 finally { setLoading(false); setRefreshing(false); }
 }, [isManager]);

 const handleStartShift = async () => {
 try {
 await api.post("/shifts/start");
 fetchData();
 Alert.alert("Shift Started", "Your shift has been started.");
 } catch (e) {
 Alert.alert("Error", e instanceof ApiError ? e.message : "Failed to start shift.");
 }
 };

 const handleCloseShift = async () => {
 if (!cashCount) {
 Alert.alert("Required", "Enter the cash amount counted.");
 return;
 }
 setSubmitting(true);
 try {
 const res = await api.post<{ data: any }>("/shifts/close", {
 countedCashAmount: parseFloat(cashCount),
 note: note || undefined,
 });
 const shift = res.data;
 const diff = Number(shift.discrepancy);
 if (diff === 0) {
 Alert.alert("✅ Exact Match", "Shift closed successfully. Cash count matches the system total.");
 } else {
 Alert.alert(
 diff > 0 ? "⚠️ Over by " + formatRupee(diff) : "⚠️ Short by " + formatRupee(Math.abs(diff)),
 `System showed ${formatRupee(Number(shift.systemCashTotal))}, you counted ${formatRupee(Number(shift.countedCashAmount))}. Your manager will review this.`
 );
 }
 setShowCloseForm(false);
 setCashCount("");
 setNote("");
 fetchData();
 } catch (e) {
 Alert.alert("Error", e instanceof ApiError ? e.message : "Failed to close shift.");
 } finally {
 setSubmitting(false);
 }
 };

 const handleReconcile = async (shiftId: string) => {
 try {
 await api.patch(`/shifts/${shiftId}/reconcile`);
 setOutletShifts((prev) =>
 prev.map((s) => (s.id === shiftId ? { ...s, status: "reconciled", reviewedById: "you" } : s))
 );
 Alert.alert("Reconciled", "Shift marked as reviewed.");
 } catch (e) {
 Alert.alert("Error", e instanceof ApiError ? e.message : "Failed to reconcile.");
 }
 };

 return (
 <ScrollView
 className="flex-1 bg-background"
 contentContainerStyle={{ paddingTop: topInset + 16, paddingBottom: 32 }}
 refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} />}
 >
 <Text className="font-headline-md text-on-surface px-4 mb-4" style={{ fontSize: 22, fontWeight: "700" }}>
 {showOutletView ? "Day's Shifts" : "Shift"}
 </Text>

 {loading ? (
 <View className="py-20 items-center">
 <ActivityIndicator size="large" color={theme.colors.primary} />
 </View>
 ) : showOutletView && isManager ? (
 <>
 {outletShifts.map((shift: any) => (
 <View key={shift.id} className="mx-4 mb-3 bg-surface-container-lowest rounded-xl overflow-hidden">
 <View className="p-4">
 <View className="flex-row items-center justify-between mb-2">
 <View className="flex-row items-center" style={{ gap: 8 }}>
 <MaterialCommunityIcons
 name={shift.status === "reconciled" ? "check-circle" : shift.status === "closed" ? "clock-outline" : "circle-outline"}
 size={18}
 color={shift.status === "reconciled" ? "#2E9E5B" : shift.discrepancy && Number(shift.discrepancy) !== 0 ? "#D64545" : "#835400"}
 />
 <Text className="font-bold text-on-surface">
 {shift.user?.firstName} {shift.user?.lastName || ""}
 </Text>
 </View>
 <Text className="text-xs text-on-surface-variant">{formatTime(shift.openedAt)}</Text>
 </View>

 <View className="flex-row flex-wrap" style={{ gap: 12 }}>
 <View>
 <Text className="text-xs text-on-surface-variant">System Cash</Text>
 <Text className="font-bold text-on-surface">{formatRupee(Number(shift.systemCashTotal))}</Text>
 </View>
 <View>
 <Text className="text-xs text-on-surface-variant">Counted</Text>
 <Text className="font-bold text-on-surface">
 {shift.countedCashAmount ? formatRupee(Number(shift.countedCashAmount)) : "—"}
 </Text>
 </View>
 <View>
 <Text className="text-xs text-on-surface-variant">Discrepancy</Text>
 <Text
 className="font-bold"
 style={{
 color: !shift.discrepancy || Number(shift.discrepancy) === 0 ? "#2E9E5B" : Number(shift.discrepancy) > 0 ? "#D64545" : "#D64545",
 }}
 >
 {shift.discrepancy !== null ? formatRupee(Number(shift.discrepancy)) : "—"}
 </Text>
 </View>
 </View>

 {shift.status === "closed" && (
 <Pressable
 onPress={() => handleReconcile(shift.id)}
 className="mt-3 py-2 rounded-xl items-center bg-teal-50"
 >
 <Text className="font-bold text-sm" style={{ color: "#1E8E85" }}>Mark Reconciled</Text>
 </Pressable>
 )}
 {shift.status === "reconciled" && (
 <Text className="text-xs text-on-surface-variant mt-2">Reviewed · {timeAgo(shift.reviewedAt)}</Text>
 )}
 </View>
 </View>
 ))}

 <View className="px-4 mt-2">
 <Pressable
 onPress={() => setShowOutletView(false)}
 className="py-3 rounded-xl items-center border border-outline-variant"
 >
 <Text className="font-bold text-on-surface-variant text-sm">My Shift</Text>
 </Pressable>
 </View>
 </>
 ) : isCashier ? (
 <>
 {activeShift ? (
 <View className="mx-4 bg-surface-container-lowest rounded-xl p-6 items-center">
 <MaterialCommunityIcons name="clock-outline" size={48} color={theme.colors.primary} />
 <Text className="font-headline-md text-on-surface mt-3" style={{ fontSize: 20, fontWeight: "700" }}>
 Shift Active
 </Text>
 <Text className="text-sm text-on-surface-variant mt-1">
 Started at {formatTime(activeShift.openedAt)}
 </Text>

 {showCloseForm ? (
 <View className="w-full mt-6">
 <Text className="font-label-md text-on-surface mb-2" style={{ fontSize: 15, fontWeight: "600" }}>
 Cash in drawer (₹)
 </Text>
 <View className="bg-surface-container rounded-xl p-4 mb-3">
 <Text className="font-display-lg text-on-surface text-center" style={{ fontSize: 36 }}>
 {cashCount || "0"}
 </Text>
 <View className="flex-row flex-wrap justify-center mt-3" style={{ gap: 8 }}>
 {[["1","2","3"],["4","5","6"],["7","8","9"],["clear","0","backspace"]].map((row, ri) => (
 <View key={ri} className="flex-row w-full justify-center" style={{ gap: 6, marginBottom: 4 }}>
 {row.map((key) => (
 <Pressable
 key={key}
 onPress={() => {
 if (key === "backspace") setCashCount((p) => p.slice(0, -1));
 else if (key === "clear") setCashCount("");
 else setCashCount((p) => (p + key).slice(0, 10));
 }}
 className="w-20 h-12 rounded-xl items-center justify-center bg-surface-container-high active:opacity-70"
 >
 {key === "backspace" ? (
 <MaterialCommunityIcons name="backspace-outline" size={20} color="#374151" />
 ) : key === "clear" ? (
 <Text className="text-sm font-bold text-red-600">CLR</Text>
 ) : (
 <Text className="text-xl font-black text-gray-800">{key}</Text>
 )}
 </Pressable>
 ))}
 </View>
 ))}
 </View>
 </View>

 <View className="flex-row mt-3" style={{ gap: 8 }}>
 <Pressable
 onPress={() => setShowCloseForm(false)}
 className="flex-1 py-3 rounded-xl items-center border border-outline-variant"
 >
 <Text className="font-bold text-on-surface-variant">Cancel</Text>
 </Pressable>
 <Pressable
 onPress={handleCloseShift}
 disabled={submitting || !cashCount}
 className="flex-1 py-3 rounded-xl items-center bg-primary"
 style={{ opacity: submitting || !cashCount ? 0.5 : 1 }}
 >
 {submitting ? (
 <ActivityIndicator size="small" color="#fff" />
 ) : (
 <Text className="font-bold text-white">Close Shift</Text>
 )}
 </Pressable>
 </View>
 </View>
 ) : (
 <Pressable
 onPress={() => setShowCloseForm(true)}
 className="mt-6 w-full py-3 rounded-xl items-center"
 style={{ backgroundColor: "#1E8E85" }}
 >
 <Text className="font-bold text-white">Close Shift</Text>
 </Pressable>
 )}
 </View>
 ) : (
 <View className="mx-4 bg-surface-container-lowest rounded-xl p-6 items-center">
 <MaterialCommunityIcons name="play-circle-outline" size={48} color={theme.colors.primary} />
 <Text className="font-headline-md text-on-surface mt-3" style={{ fontSize: 20, fontWeight: "700" }}>
 No Active Shift
 </Text>
 <Text className="text-sm text-on-surface-variant mt-1 text-center">
 Start your shift before billing. This tracks your sales and cash for the day.
 </Text>
 <Pressable
 onPress={handleStartShift}
 className="mt-6 w-full py-3 rounded-xl items-center bg-primary"
 >
 <Text className="font-bold text-white">Start Shift</Text>
 </Pressable>
 </View>
 )}

 {todaySummary && (
 <View className="mx-4 mt-4 bg-surface-container rounded-xl p-4">
 <Text className="font-headline-sm text-on-surface mb-3" style={{ fontSize: 15, fontWeight: "700" }}>
 Today&apos;s Summary
 </Text>
 <View className="flex-row flex-wrap" style={{ gap: 16 }}>
 <View>
 <Text className="text-xs text-on-surface-variant">Cash Sales</Text>
 <Text className="font-bold text-on-surface">{formatRupee(todaySummary.systemCashTotal || 0)}</Text>
 </View>
 <View>
 <Text className="text-xs text-on-surface-variant">UPI Sales</Text>
 <Text className="font-bold text-on-surface">{formatRupee(todaySummary.systemUpiTotal || 0)}</Text>
 </View>
 <View>
 <Text className="text-xs text-on-surface-variant">Bills</Text>
 <Text className="font-bold text-on-surface">{todaySummary.systemBillCount || 0}</Text>
 </View>
 </View>
 </View>
 )}
 </>
 ) : null}
 </ScrollView>
 );
}
