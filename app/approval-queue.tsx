import React, { useState, useCallback } from "react";
import { View, ScrollView, Pressable, ActivityIndicator, RefreshControl, Text, Alert } from "react-native";
import { useTheme } from "react-native-paper";
import { useFocusEffect } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { api, ApiError } from "../src/lib/api";
import { useAuth } from "../src/lib/auth-context";
import { useTopInset } from "../src/lib/useTopInset";
import EmptyState from "../src/components/EmptyState";

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

const TYPE_LABELS: Record<string, string> = {
 discount_override: "Discount Override",
 void_bill: "Void Bill",
 return_refund: "Return/Refund",
 credit_override: "Credit Override",
};

const TYPE_ICONS: Record<string, string> = {
 discount_override: "percent",
 void_bill: "cancel",
 return_refund: "backup-restore",
 credit_override: "credit-card-outline",
};

export default function ApprovalQueueScreen() {
 const theme = useTheme();
 const { userRole } = useAuth();
 const topInset = useTopInset();
 const [requests, setRequests] = useState<any[]>([]);
 const [loading, setLoading] = useState(true);
 const [refreshing, setRefreshing] = useState(false);
 const [processingId, setProcessingId] = useState<string | null>(null);
 const [tab, setTab] = useState<"pending" | "history">("pending");

 const canApprove = userRole === "manager" || userRole === "owner";

 const fetchRequests = useCallback(async () => {
 try {
 const endpoint = tab === "pending" ? "/approval-queue/pending" : "/approval-queue/my";
 const res = await api.get<{ data: any[] }>(endpoint);
 setRequests(res.data ?? []);
 } catch {}
 finally { setLoading(false); setRefreshing(false); }
 }, [tab]);

 useFocusEffect(useCallback(() => {
 setLoading(true);
 fetchRequests();
 }, [fetchRequests]));

 const handleAction = async (id: string, status: "approved" | "rejected") => {
 setProcessingId(id);
 try {
 await api.patch(`/approval-queue/${id}/status`, { status });
 setRequests((prev) => prev.filter((r) => r.id !== id));
 Alert.alert("Done", `Request ${status}.`);
 } catch (e) {
 Alert.alert("Error", e instanceof ApiError ? e.message : "Failed to update.");
 } finally {
 setProcessingId(null);
 }
 };

 return (
 <ScrollView
 className="flex-1 bg-background"
 contentContainerStyle={{ paddingTop: topInset + 16, paddingBottom: 32 }}
 refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchRequests(); }} />}
 >
 <View className="px-4 mb-4">
 <Text className="font-headline-md text-on-surface" style={{ fontSize: 22, fontWeight: "700" }}>
 Approvals
 </Text>
 </View>

 {/* Tab bar */}
 <View className="flex-row mx-4 mb-4 bg-surface-container rounded-xl" style={{ padding: 3 }}>
 <Pressable
 onPress={() => setTab("pending")}
 className={`flex-1 py-2.5 rounded-xl items-center ${tab === "pending" ? "bg-surface-container-lowest shadow-sm" : ""}`}
 >
 <Text className={`font-label-md ${tab === "pending" ? "text-primary" : "text-on-surface-variant"}`}>
 Pending
 </Text>
 </Pressable>
 <Pressable
 onPress={() => setTab("history")}
 className={`flex-1 py-2.5 rounded-xl items-center ${tab === "history" ? "bg-surface-container-lowest shadow-sm" : ""}`}
 >
 <Text className={`font-label-md ${tab === "history" ? "text-primary" : "text-on-surface-variant"}`}>
 My Requests
 </Text>
 </Pressable>
 </View>

 {loading ? (
 <View className="py-20 items-center">
 <ActivityIndicator size="large" color={theme.colors.primary} />
 </View>
 ) : requests.length === 0 ? (
 <EmptyState
 icon="clipboard-check-outline"
 title={tab === "pending" ? "All caught up!" : "No requests yet"}
 description={tab === "pending" ? "No pending approvals." : "You haven't made any approval requests."}
 />
 ) : (
 <View className="px-4" style={{ gap: 10 }}>
 {requests.map((req: any) => (
 <View
 key={req.id}
 className="bg-surface-container-lowest rounded-xl overflow-hidden"
 style={{ borderLeftWidth: 4, borderLeftColor: req.status === "pending" ? "#1E8E85" : req.status === "approved" ? "#2E9E5B" : "#D64545" }}
 >
 <View className="p-4">
 <View className="flex-row items-start" style={{ gap: 10 }}>
 <View className="w-10 h-10 rounded-full bg-surface-container items-center justify-center">
 <MaterialCommunityIcons name={(TYPE_ICONS[req.type] || "help-circle") as any} size={20} color={theme.colors.primary} />
 </View>
 <View className="flex-1">
 <View className="flex-row items-center flex-wrap" style={{ gap: 6 }}>
 <Text className="font-bold text-on-surface" style={{ fontSize: 15 }}>
 {TYPE_LABELS[req.type] || req.type}
 </Text>
 {req.status === "pending" && (
 <View className="bg-teal-50 rounded-full px-2 py-0.5">
 <Text className="text-[10px] font-bold" style={{ color: "#1E8E85" }}>PENDING</Text>
 </View>
 )}
 {req.status === "approved" && (
 <View className="bg-green-50 rounded-full px-2 py-0.5">
 <Text className="text-[10px] font-bold" style={{ color: "#2E9E5B" }}>APPROVED</Text>
 </View>
 )}
 {req.status === "rejected" && (
 <View className="bg-red-50 rounded-full px-2 py-0.5">
 <Text className="text-[10px] font-bold" style={{ color: "#D64545" }}>REJECTED</Text>
 </View>
 )}
 </View>
 <Text className="text-sm text-on-surface-variant mt-1">
 {formatRupee(Number(req.amount))}
 {req.reason ? ` · ${req.reason}` : ""}
 </Text>
 <View className="flex-row items-center mt-1.5" style={{ gap: 8 }}>
 {req.requestedBy && (
 <Text className="text-xs text-on-surface-variant">
 By: {req.requestedBy.firstName} {req.requestedBy.lastName || ""}
 </Text>
 )}
 <Text className="text-xs text-on-surface-variant">{timeAgo(req.createdAt)}</Text>
 </View>
 </View>
 </View>

 {/* Action buttons for pending requests */}
 {canApprove && req.status === "pending" && (
 <View className="flex-row mt-3" style={{ gap: 8 }}>
 <Pressable
 onPress={() => handleAction(req.id, "approved")}
 disabled={processingId === req.id}
 className="flex-1 py-2.5 rounded-xl items-center bg-success"
 >
 {processingId === req.id ? (
 <ActivityIndicator size="small" color="#fff" />
 ) : (
 <Text className="font-bold text-white text-sm">Approve</Text>
 )}
 </Pressable>
 <Pressable
 onPress={() => handleAction(req.id, "rejected")}
 disabled={processingId === req.id}
 className="flex-1 py-2.5 rounded-xl items-center"
 style={{ backgroundColor: "#FEE2E2" }}
 >
 <Text className="font-bold text-sm" style={{ color: "#D64545" }}>Reject</Text>
 </Pressable>
 </View>
 )}

 {req.approvedBy && (
 <Text className="text-xs text-on-surface-variant mt-2">
 Reviewed by: {req.approvedBy.firstName} {req.approvedBy.lastName || ""}
 {req.approvedAt ? ` · ${timeAgo(req.approvedAt)}` : ""}
 </Text>
 )}
 </View>
 </View>
 ))}
 </View>
 )}
 </ScrollView>
 );
}
