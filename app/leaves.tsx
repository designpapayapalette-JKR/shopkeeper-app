import React, { useState, useEffect, useCallback } from "react";
import { View, ScrollView, ActivityIndicator, RefreshControl, Text, Pressable, Alert } from "react-native";
import { Card, useTheme, Button, TextInput, Dialog, Portal, Chip, Searchbar } from "react-native-paper";
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
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 mb-4">
          <View className="flex-row items-center" style={{ gap: 8 }}>
            <Pressable onPress={() => router.back()}>
              <MaterialCommunityIcons name="arrow-left" size={24} color={theme.colors.primary} />
            </Pressable>
            <MaterialCommunityIcons name="briefcase-clock" size={24} color={theme.colors.primary} />
            <Text className="text-2xl font-bold text-on-surface">Leaves</Text>
          </View>
          {activeTab === "requests" && (
            <Button mode="contained" compact onPress={() => { setFormUserId(""); setFormType("casual"); setFormStart(""); setFormEnd(""); setFormReason(""); setCreateDialog(true); }} icon="plus">
              Request
            </Button>
          )}
        </View>

        {/* Tab Switcher */}
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
            {/* Status Filter */}
            <View className="flex-row flex-wrap px-4 mb-3" style={{ gap: 6 }}>
              <Chip
                mode="flat"
                compact
                selected={!statusFilter}
                onPress={() => setStatusFilter("")}
                showSelectedCheck={false}
              >
                All
              </Chip>
              {LEAVE_STATUS_OPTIONS.map((opt) => (
                <Chip
                  key={opt.value}
                  mode="flat"
                  compact
                  selected={statusFilter === opt.value}
                  onPress={() => setStatusFilter(opt.value)}
                  showSelectedCheck={false}
                  textStyle={{ color: opt.color }}
                >
                  {opt.label}
                </Chip>
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
                  <Card key={req.id} mode="elevated" className="mx-4 mb-2">
                    <Card.Content>
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
                          <Chip mode="flat" compact textStyle={{ fontSize: 10, color: statusOpt.color }} style={{ backgroundColor: `${statusOpt.color}15` }}>
                            {statusOpt.label}
                          </Chip>
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

                      {/* Approve/Reject actions */}
                      {canManage && req.status === "pending" && (
                        <View className="flex-row mt-3" style={{ gap: 8 }}>
                          <Button compact mode="contained" onPress={() => handleStatus(req.id, "approved")} icon="check" style={{ backgroundColor: "#2E9E5B" }}>
                            Approve
                          </Button>
                          <Button compact mode="outlined" onPress={() => handleStatus(req.id, "rejected")} icon="close" textColor="#D64545">
                            Reject
                          </Button>
                        </View>
                      )}
                    </Card.Content>
                  </Card>
                );
              })
            )}

            {reqMeta && reqMeta.totalPages > 1 && (
              <View className="flex-row justify-center items-center px-4 mt-3" style={{ gap: 12 }}>
                <Button mode="outlined" compact disabled={reqPage <= 1} onPress={() => setReqPage((p) => Math.max(1, p - 1))}>
                  Previous
                </Button>
                <Text className="text-sm text-on-surface-variant">Page {reqMeta.page} of {reqMeta.totalPages}</Text>
                <Button mode="outlined" compact disabled={reqPage >= reqMeta.totalPages} onPress={() => setReqPage((p) => p + 1)}>
                  Next
                </Button>
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
                  <Card key={bal.id} mode="elevated" className="mx-4 mb-2">
                    <Card.Content className="flex-row items-center justify-between">
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
                    </Card.Content>
                  </Card>
                );
              })
            )}
          </>
        )}
      </ScrollView>

      {/* Create Request Dialog */}
      <Portal>
        <Dialog visible={createDialog} onDismiss={() => setCreateDialog(false)}>
          <Dialog.Title>New Leave Request</Dialog.Title>
          <Dialog.Content>
            {canManage && (
              <>
                <Text className="text-sm text-on-surface-variant mb-2">Employee (leave blank for self)</Text>
                <Searchbar
                  placeholder="Search employees..."
                  value={userSearch}
                  onChangeText={(q) => {
                    setUserSearch(q);
                    if (q.length < 1) { setUserResults([]); return; }
                    api.get<any>("/staff", { params: { search: q, limit: 10 } })
                      .then((res) => setUserResults(res.data || []))
                      .catch(() => setUserResults([]));
                  }}
                  onClearIconPress={() => { setUserSearch(""); setUserResults([]); setFormUserId(""); }}
                  className="mb-2"
                />
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
            <TextInput mode="outlined" label="Start Date (YYYY-MM-DD)" value={formStart} onChangeText={setFormStart} placeholder="2025-01-15" className="mb-3" />
            <TextInput mode="outlined" label="End Date (YYYY-MM-DD)" value={formEnd} onChangeText={setFormEnd} placeholder="2025-01-15" className="mb-3" />
            <TextInput mode="outlined" label="Reason (optional)" value={formReason} onChangeText={setFormReason} multiline className="mb-3" />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setCreateDialog(false)}>Cancel</Button>
            <Button onPress={handleCreate} loading={saving} disabled={saving || !formStart || !formEnd}>Submit</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}
