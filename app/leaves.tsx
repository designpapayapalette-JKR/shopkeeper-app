import React, { useState, useEffect, useCallback } from "react";
import { View, ScrollView, ActivityIndicator, RefreshControl, Text, Pressable, Alert, Modal, TextInput } from "react-native";
import { useTheme } from "react-native-paper";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { api } from "../src/lib/api";
import { useAuth } from "../src/lib/auth-context";
import { useTopInset, useBottomInset } from "../src/lib/useTopInset";
import EmptyState from "../src/components/EmptyState";

type LeaveRequest = {
  id: string;
  user_id: string;
  type: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  status: string;
  approved_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  user: { id: string; first_name: string; last_name: string };
  approver?: { id: string; first_name: string; last_name: string } | null;
};

type LeaveBalance = {
  id: string;
  user_id: string;
  type: string;
  total: number;
  used: number;
  year: number;
  user: { id: string; first_name: string; last_name: string };
};

const LEAVE_TYPES = ["casual", "sick", "earned", "unpaid", "other"];
const LEAVE_STATUS_OPTIONS = [
  { value: "pending", label: "Pending", icon: "clock-outline", color: "#F0AE4E" },
  { value: "approved", label: "Approved", icon: "check-circle", color: "#2E9E5B" },
  { value: "rejected", label: "Rejected", icon: "close-circle", color: "#D64545" },
  { value: "cancelled", label: "Cancelled", icon: "cancel", color: "#9E9E9E" },
];

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatDate(d: string): string {
  const dt = new Date(d);
  return `${DAYS[dt.getDay()]}, ${dt.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`;
}

export default function LeavesScreen() {
  const { userRole, user } = useAuth();
  const router = useRouter();
  const theme = useTheme();
  const topInset = useTopInset();
  const bottomInset = useBottomInset();
  const canManage = userRole === "owner" || userRole === "manager";

  const [activeTab, setActiveTab] = useState("requests");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Requests
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [reqPage, setReqPage] = useState(1);
  const [reqMeta, setReqMeta] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState("");

  // Balances
  const [balances, setBalances] = useState<LeaveBalance[]>([]);

  // Create dialog
  const [createDialog, setCreateDialog] = useState(false);
  const [formUserId, setFormUserId] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [userResults, setUserResults] = useState<any[]>([]);
  const [formType, setFormType] = useState("casual");
  const [formStart, setFormStart] = useState("");
  const [formEnd, setFormEnd] = useState("");
  const [formReason, setFormReason] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchRequests = useCallback(async () => {
    try {
      const params: any = { page: reqPage, limit: 50 };
      if (statusFilter) params.status = statusFilter;
      const res = await api.get<{ data: LeaveRequest[]; meta: any }>("/leave-management/leave-requests", { params });
      setRequests(res.data || []);
      setReqMeta(res.meta);
    } catch { setRequests([]); }
  }, [reqPage, statusFilter]);

  const fetchBalances = useCallback(async () => {
    try {
      const res = await api.get<{ data: LeaveBalance[] }>("/leave-management/leave-balances");
      setBalances(res.data || []);
    } catch { setBalances([]); }
  }, []);

  const fetchData = useCallback(async () => {
    await Promise.all([fetchRequests(), fetchBalances()]);
  }, [fetchRequests, fetchBalances]);

  useEffect(() => { fetchData().finally(() => { setLoading(false); setRefreshing(false); }); }, [fetchData]);

  const handleCreate = async () => {
    if (!formStart || !formEnd) return;
    setSaving(true);
    try {
      await api.post("/leave-management/leave-requests", {
        userId: formUserId || user?.id,
        type: formType,
        startDate: formStart,
        endDate: formEnd,
        reason: formReason || undefined,
      });
      setCreateDialog(false);
      await fetchRequests();
    } catch { Alert.alert("Error", "Failed to create leave request."); }
    finally { setSaving(false); }
  };

  const handleStatus = async (id: string, status: string) => {
    try {
      await api.patch(`/leave-management/leave-requests/${id}/status`, { status });
      await fetchRequests();
    } catch { Alert.alert("Error", "Failed to update leave status."); }
  };

  const tabs = [
    { key: "requests", label: "Requests", icon: "clipboard-text-clock" },
    { key: "balances", label: "Balances", icon: "scale-balance" },
  ];

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        contentContainerStyle={{ paddingTop: topInset + 16, paddingBottom: bottomInset + 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} />}
      >
        <View className="flex-row items-center justify-between px-4 mb-4">
          <View className="flex-row items-center" style={{ gap: 8 }}>
            <Pressable onPress={() => router.back()}>
              <MaterialCommunityIcons name="arrow-left" size={24} color={theme.colors.primary} />
            </Pressable>
            <MaterialCommunityIcons name="briefcase-clock" size={24} color={theme.colors.primary} />
            <Text className="text-2xl font-bold text-on-surface">Leaves</Text>
          </View>
          {activeTab === "requests" && (
            <Pressable
              onPress={() => { setFormUserId(""); setFormType("casual"); setFormStart(""); setFormEnd(""); setFormReason(""); setCreateDialog(true); }}
              className="bg-primary px-4 py-2.5 rounded-xl flex-row items-center active:opacity-80"
              style={{ gap: 4 }}
            >
              <MaterialCommunityIcons name="plus" size={16} color="white" />
              <Text className="text-white font-bold text-sm">Request</Text>
            </Pressable>
          )}
        </View>

        <View className="flex-row px-4 mb-3" style={{ gap: 8 }}>
          {tabs.map((t) => (
            <Pressable
              key={t.key}
              onPress={() => setActiveTab(t.key)}
              className={`flex-row items-center px-4 py-2 rounded-full ${activeTab === t.key ? "bg-primary" : "bg-surface-container-high"}`}
              style={{ gap: 6 }}
            >
              <MaterialCommunityIcons name={t.icon as any} size={16} color={activeTab === t.key ? "#FFFFFF" : "#6B7280"} />
              <Text className={`text-sm font-bold ${activeTab === t.key ? "text-white" : "text-on-surface-variant"}`}>
                {t.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {activeTab === "requests" && (
          <>
            <View className="flex-row flex-wrap px-4 mb-3" style={{ gap: 6 }}>
              <Pressable
                onPress={() => setStatusFilter("")}
                className={`rounded-full px-3 py-1 ${!statusFilter ? "bg-primary/20" : "bg-surface-container"}`}
              >
                <Text className={`text-xs font-bold ${!statusFilter ? "text-primary" : "text-on-surface-variant"}`}>All</Text>
              </Pressable>
              {LEAVE_STATUS_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.value}
                  onPress={() => setStatusFilter(opt.value)}
                  className="rounded-full px-3 py-1"
                  style={{ backgroundColor: statusFilter === opt.value ? `${opt.color}20` : "transparent" }}
                >
                  <Text className="text-xs font-bold" style={{ color: opt.color }}>{opt.label}</Text>
                </Pressable>
              ))}
            </View>

            {requests.length === 0 ? (
              <EmptyState icon="clipboard-remove" title="No leave requests" />
            ) : (
              requests.map((req) => {
                const statusOpt = LEAVE_STATUS_OPTIONS.find((s) => s.value === req.status);
                const name = req.user ? `${req.user.first_name} ${req.user.last_name}`.trim() : "—";
                const days = Math.max(1, Math.ceil((new Date(req.end_date).getTime() - new Date(req.start_date).getTime()) / (1000 * 60 * 60 * 24)) + 1);
                return (
                  <View key={req.id} className="mx-4 mb-2 bg-surface-container-lowest border border-outline-variant rounded-2xl p-4">
                    <View className="flex-row items-center justify-between mb-2">
                      <View className="flex-row items-center" style={{ gap: 8 }}>
                        <View className="w-9 h-9 rounded-full items-center justify-center bg-primary/10">
                          <Text className="text-xs font-bold text-primary">
                            {name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                          </Text>
                        </View>
                        <View>
                          <Text className="text-sm font-bold text-on-surface">{name}</Text>
                          <Text className="text-[10px] text-on-surface-variant capitalize">{req.type} Leave · {days} day{days > 1 ? "s" : ""}</Text>
                        </View>
                      </View>
                      {statusOpt && (
                        <View className="rounded-full px-3 py-1" style={{ backgroundColor: `${statusOpt.color}15` }}>
                          <Text className="text-xs font-bold" style={{ color: statusOpt.color, fontSize: 10 }}>{statusOpt.label}</Text>
                        </View>
                      )}
                    </View>
                    <Text className="text-xs text-on-surface-variant">
                      {formatDate(req.start_date)} → {formatDate(req.end_date)}
                    </Text>
                    {req.reason && <Text className="text-xs text-on-surface mt-1">{req.reason}</Text>}
                    {req.approver && req.status !== "pending" && (
                      <Text className="text-[10px] text-on-surface-variant mt-1">
                        Reviewed by {req.approver.first_name} {req.approver.last_name}
                      </Text>
                    )}

                    {canManage && req.status === "pending" && (
                      <View className="flex-row mt-3" style={{ gap: 8 }}>
                        <Pressable
                          onPress={() => handleStatus(req.id, "approved")}
                          className="py-2.5 px-4 rounded-xl flex-row items-center active:opacity-80"
                          style={{ gap: 4, backgroundColor: "#2E9E5B" }}
                        >
                          <MaterialCommunityIcons name="check" size={16} color="white" />
                          <Text className="text-white font-bold text-sm">Approve</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => handleStatus(req.id, "rejected")}
                          className="py-2.5 px-4 rounded-xl flex-row items-center border border-[#D64545] active:opacity-80"
                          style={{ gap: 4 }}
                        >
                          <MaterialCommunityIcons name="close" size={16} color="#D64545" />
                          <Text className="font-bold text-sm" style={{ color: "#D64545" }}>Reject</Text>
                        </Pressable>
                      </View>
                    )}
                  </View>
                );
              })
            )}

            {reqMeta && reqMeta.totalPages > 1 && (
              <View className="flex-row justify-center items-center px-4 mt-3" style={{ gap: 12 }}>
                <Pressable
                  disabled={reqPage <= 1}
                  onPress={() => setReqPage((p) => Math.max(1, p - 1))}
                  className="py-2.5 px-4 rounded-xl border border-outline-variant active:opacity-70"
                >
                  <Text className="text-sm font-bold text-on-surface">Previous</Text>
                </Pressable>
                <Text className="text-sm text-on-surface-variant">Page {reqMeta.page} of {reqMeta.totalPages}</Text>
                <Pressable
                  disabled={reqPage >= reqMeta.totalPages}
                  onPress={() => setReqPage((p) => p + 1)}
                  className="py-2.5 px-4 rounded-xl border border-outline-variant active:opacity-70"
                >
                  <Text className="text-sm font-bold text-on-surface">Next</Text>
                </Pressable>
              </View>
            )}
          </>
        )}

        {activeTab === "balances" && (
          <>
            {balances.length === 0 ? (
              <EmptyState icon="scale-balance" title="No leave balances configured" />
            ) : (
              balances.map((bal) => {
                const name = bal.user ? `${bal.user.first_name} ${bal.user.last_name}`.trim() : "—";
                const remaining = bal.total - bal.used;
                return (
                  <View key={bal.id} className="mx-4 mb-2 bg-surface-container-lowest border border-outline-variant rounded-2xl p-4">
                    <View className="flex-row items-center justify-between">
                      <View className="flex-row items-center" style={{ gap: 10 }}>
                        <View className="w-9 h-9 rounded-full items-center justify-center bg-primary/10">
                          <Text className="text-xs font-bold text-primary">
                            {name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                          </Text>
                        </View>
                        <View>
                          <Text className="text-sm font-bold text-on-surface">{name}</Text>
                          <Text className="text-[10px] text-on-surface-variant capitalize">{bal.type} · {bal.year}</Text>
                        </View>
                      </View>
                      <View className="items-end">
                        <View className="flex-row items-center" style={{ gap: 4 }}>
                          <Text className="text-base font-black text-on-surface">{remaining}</Text>
                          <Text className="text-xs text-on-surface-variant">/ {bal.total}</Text>
                        </View>
                        <Text className="text-[10px] text-on-surface-variant">{bal.used} used</Text>
                      </View>
                    </View>
                  </View>
                );
              })
            )}
          </>
        )}
      </ScrollView>

      <Modal visible={createDialog} transparent animationType="slide" onRequestClose={() => setCreateDialog(false)}>
        <View className="flex-1 justify-end bg-black/40">
          <View className="bg-surface-container-lowest rounded-t-2xl pb-10">
            <ScrollView className="px-6 pt-6">
              <Text className="text-lg font-bold text-on-surface mb-4">New Leave Request</Text>
              {canManage && (
                <>
                  <Text className="text-sm text-on-surface-variant mb-2">Employee (leave blank for self)</Text>
                  <View className="flex-row items-center bg-surface-container-lowest rounded-2xl px-4 py-3 border border-outline-variant mb-2">
                    <MaterialCommunityIcons name="magnify" size={18} color="#6B7280" />
                    <TextInput
                      className="flex-1 ml-2 text-base font-medium text-on-surface"
                      placeholderTextColor="#9CA3AF"
                      placeholder="Search employees..."
                      value={userSearch}
                      onChangeText={(q) => {
                        setUserSearch(q);
                        if (q.length < 1) { setUserResults([]); return; }
                        api.get<any>("/staff", { params: { search: q, limit: 10 } })
                          .then((res) => setUserResults(res.data || []))
                          .catch(() => setUserResults([]));
                      }}
                    />
                    {userSearch.length > 0 && (
                      <Pressable onPress={() => { setUserSearch(""); setUserResults([]); setFormUserId(""); }}>
                        <MaterialCommunityIcons name="close" size={18} color="#6B7280" />
                      </Pressable>
                    )}
                  </View>
                  {userResults.length > 0 && (
                    <View className="border border-outline-variant rounded-xl mb-3 max-h-32">
                      {userResults.map((u: any) => (
                        <Pressable
                          key={u.id}
                          onPress={() => { setFormUserId(u.id); setUserSearch(`${u.first_name || ""} ${u.last_name || ""}`.trim()); setUserResults([]); }}
                          className="px-3 py-2 border-b border-outline-variant/30"
                        >
                          <Text className="text-sm text-on-surface">{`${u.first_name || ""} ${u.last_name || ""}`.trim()}</Text>
                          <Text className="text-[10px] text-on-surface-variant capitalize">{u.role?.replace("_", " ") || "Staff"}</Text>
                        </Pressable>
                      ))}
                    </View>
                  )}
                </>
              )}
              <Text className="text-sm text-on-surface-variant mb-2">Leave Type</Text>
              <View className="flex-row flex-wrap mb-3" style={{ gap: 8 }}>
                {LEAVE_TYPES.map((t) => (
                  <Pressable
                    key={t}
                    onPress={() => setFormType(t)}
                    className={`px-3 py-1.5 rounded-full border ${formType === t ? "bg-primary border-0" : "border-outline-variant"}`}
                  >
                    <Text className={`text-xs font-bold ${formType === t ? "text-white" : "text-on-surface-variant"}`}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <TextInput
                placeholder="Start Date (YYYY-MM-DD)"
                value={formStart}
                onChangeText={setFormStart}
                placeholderTextColor="#9CA3AF"
                className="bg-surface-container-lowest text-on-surface border border-outline-variant rounded-xl px-4 py-3 font-medium mb-3"
              />
              <TextInput
                placeholder="End Date (YYYY-MM-DD)"
                value={formEnd}
                onChangeText={setFormEnd}
                placeholderTextColor="#9CA3AF"
                className="bg-surface-container-lowest text-on-surface border border-outline-variant rounded-xl px-4 py-3 font-medium mb-3"
              />
              <TextInput
                placeholder="Reason (optional)"
                value={formReason}
                onChangeText={setFormReason}
                multiline
                placeholderTextColor="#9CA3AF"
                className="bg-surface-container-lowest text-on-surface border border-outline-variant rounded-xl px-4 py-3 font-medium mb-3"
              />
              <View className="flex-row justify-end pt-2 pb-2 gap-3">
                <Pressable className="py-3 px-6 rounded-xl active:opacity-70" onPress={() => setCreateDialog(false)}>
                  <Text className="text-primary font-bold text-base">Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={handleCreate}
                  disabled={saving || !formStart || !formEnd}
                  className="bg-primary py-3 px-6 rounded-xl items-center active:opacity-80"
                >
                  <Text className="text-white font-bold text-base">
                    {saving ? "Saving..." : "Submit"}
                  </Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
