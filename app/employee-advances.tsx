import React, { useState, useEffect, useCallback } from "react";
import { View, ScrollView, ActivityIndicator, RefreshControl, Text, Pressable, Alert, Modal, TextInput } from "react-native";
import { useTheme } from "react-native-paper";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { api } from "../src/lib/api";
import { useAuth } from "../src/lib/auth-context";
import { useTopInset, useBottomInset } from "../src/lib/useTopInset";
import EmptyState from "../src/components/EmptyState";

type AdvanceRecord = {
  id: string;
  userId: string;
  amount: number;
  date: string;
  reason: string | null;
  status: string;
  repaymentDate: string | null;
  repaymentAmount: number | null;
  notes: string | null;
  createdAt: string;
  user: { id: string; firstName: string; lastName: string | null; role: string };
};

type SummaryData = {
  pending: { count: number; total: number };
  approved: { count: number; total: number };
  repaid: { count: number; total: number; recovered: number };
  adjusted: { count: number; total: number; recovered: number };
  totalOutstanding: number;
};

const inr = (n: number) => `\u20B9${n.toLocaleString("en-IN", { minimumFractionDigits: 0 })}`;

const STATUS_META: Record<string, { label: string; color: string }> = {
  pending: { label: "Pending", color: "#D97706" },
  approved: { label: "Approved", color: "#3B82F6" },
  repaid: { label: "Repaid", color: "#10B981" },
  adjusted: { label: "Adjusted", color: "#6B7280" },
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export default function EmployeeAdvancesScreen() {
  const { userRole, user } = useAuth();
  const router = useRouter();
  const theme = useTheme();
  const topInset = useTopInset();
  const bottomInset = useBottomInset();
  const isStaffRole = ["staff", "field_agent", "general_staff", "peon"].includes(userRole || "");
  const canManage = userRole === "owner" || userRole === "manager";

  const [advances, setAdvances] = useState<AdvanceRecord[]>([]);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [statusFilter, setStatusFilter] = useState("");
  const [filterModal, setFilterModal] = useState(false);

  const [formModal, setFormModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formUserId, setFormUserId] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formDate, setFormDate] = useState(new Date().toISOString().slice(0, 10));
  const [formReason, setFormReason] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formLoading, setFormLoading] = useState(false);

  const [repayModal, setRepayModal] = useState<AdvanceRecord | null>(null);
  const [repayAmount, setRepayAmount] = useState("");
  const [repayDate, setRepayDate] = useState(new Date().toISOString().slice(0, 10));

  const load = useCallback(async () => {
    try {
      const params: Record<string, string> = {};
      if (statusFilter) params.status = statusFilter;
      const [advRes, sumRes] = await Promise.all([
        api.get("/employee-advances", { params }),
        api.get("/employee-advances/summary"),
      ]);
      const adv = advRes as { data: AdvanceRecord[] } | undefined;
      const sum = sumRes as { data: SummaryData } | undefined;
      if (adv?.data) setAdvances(adv.data);
      if (sum?.data) setSummary(sum.data);
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const openCreate = () => {
    setEditId(null);
    setFormUserId("");
    setFormAmount("");
    setFormDate(new Date().toISOString().slice(0, 10));
    setFormReason("");
    setFormNotes("");
    setFormModal(true);
  };

  const openEdit = (a: AdvanceRecord) => {
    setEditId(a.id);
    setFormUserId(a.userId);
    setFormAmount(String(a.amount));
    setFormDate(a.date.slice(0, 10));
    setFormReason(a.reason || "");
    setFormNotes(a.notes || "");
    setFormModal(true);
  };

  const handleSave = async () => {
    if (!formUserId || !formAmount || Number(formAmount) <= 0) {
      Alert.alert("Validation Error", "Employee and amount are required.");
      return;
    }
    setFormLoading(true);
    try {
      const body = {
        userId: formUserId,
        amount: Number(formAmount),
        date: formDate,
        reason: formReason.trim() || undefined,
        notes: formNotes.trim() || undefined,
      };
      if (editId) {
        await api.patch(`/employee-advances/${editId}`, body);
      } else {
        await api.post("/employee-advances", body);
      }
      setFormModal(false);
      load();
    } catch (err: any) {
      Alert.alert("Error", err?.response?.data?.error?.message || err?.response?.data?.error || "Failed to save");
    } finally {
      setFormLoading(false);
    }
  };

  const handleApprove = (id: string) => {
    Alert.alert("Approve Advance", "Approve this advance request?", [
      { text: "Cancel", style: "cancel" },
      { text: "Approve", onPress: async () => {
        try {
          await api.patch(`/employee-advances/${id}`, { status: "approved" });
          load();
        } catch { Alert.alert("Error", "Failed to approve"); }
      }},
    ]);
  };

  const handleRepay = async () => {
    if (!repayModal || !repayAmount || Number(repayAmount) <= 0) return;
    try {
      await api.patch(`/employee-advances/${repayModal.id}`, {
        status: "repaid",
        repaymentAmount: Number(repayAmount),
        repaymentDate: repayDate,
      });
      setRepayModal(null);
      setRepayAmount("");
      load();
    } catch { Alert.alert("Error", "Failed to record repayment"); }
  };

  const handleDelete = (id: string) => {
    Alert.alert("Delete Advance", "Delete this pending advance request?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        try { await api.delete(`/employee-advances/${id}`); load(); }
        catch { Alert.alert("Error", "Failed to delete"); }
      }},
    ]);
  };

  const staffName = (u: { firstName: string; lastName: string | null }) =>
    `${u.firstName}${u.lastName ? " " + u.lastName : ""}`;

  const filterOptions = [
    { value: "", label: "All Statuses" },
    { value: "pending", label: "Pending" },
    { value: "approved", label: "Approved" },
    { value: "repaid", label: "Repaid" },
    { value: "adjusted", label: "Adjusted" },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background, paddingTop: topInset }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.outlineVariant }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Pressable onPress={() => router.back()}><MaterialCommunityIcons name="arrow-left" size={22} color={theme.colors.onSurface} /></Pressable>
          <Text style={{ fontSize: 18, fontWeight: "800", color: theme.colors.onSurface }}>Employee Advances</Text>
        </View>
        <Pressable onPress={openCreate} style={{ backgroundColor: theme.colors.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 }}>
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>+ New</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: bottomInset + 80 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        {summary && (
          <View style={{ flexDirection: "row", flexWrap: "wrap", padding: 12, gap: 8 }}>
            <View style={{ flex: 1, minWidth: 100, backgroundColor: theme.colors.surfaceVariant, borderRadius: 12, padding: 12 }}>
              <Text style={{ fontSize: 10, fontWeight: "700", color: theme.colors.onSurfaceVariant, textTransform: "uppercase", letterSpacing: 0.5 }}>Pending</Text>
              <Text style={{ fontSize: 16, fontWeight: "800", color: "#D97706", marginTop: 2 }}>{inr(summary.pending.total)}</Text>
            </View>
            <View style={{ flex: 1, minWidth: 100, backgroundColor: theme.colors.surfaceVariant, borderRadius: 12, padding: 12 }}>
              <Text style={{ fontSize: 10, fontWeight: "700", color: theme.colors.onSurfaceVariant, textTransform: "uppercase", letterSpacing: 0.5 }}>Approved</Text>
              <Text style={{ fontSize: 16, fontWeight: "800", color: "#3B82F6", marginTop: 2 }}>{inr(summary.approved.total)}</Text>
            </View>
            <View style={{ flex: 1, minWidth: 100, backgroundColor: theme.colors.surfaceVariant, borderRadius: 12, padding: 12 }}>
              <Text style={{ fontSize: 10, fontWeight: "700", color: theme.colors.onSurfaceVariant, textTransform: "uppercase", letterSpacing: 0.5 }}>Repaid</Text>
              <Text style={{ fontSize: 16, fontWeight: "800", color: "#10B981", marginTop: 2 }}>{inr(summary.repaid.recovered)}</Text>
            </View>
            <View style={{ flex: 1, minWidth: 100, backgroundColor: theme.colors.surfaceVariant, borderRadius: 12, padding: 12 }}>
              <Text style={{ fontSize: 10, fontWeight: "700", color: theme.colors.onSurfaceVariant, textTransform: "uppercase", letterSpacing: 0.5 }}>Outstanding</Text>
              <Text style={{ fontSize: 16, fontWeight: "800", color: "#EF4444", marginTop: 2 }}>{inr(summary.totalOutstanding)}</Text>
            </View>
          </View>
        )}

        <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
          <Pressable onPress={() => setFilterModal(true)} style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: theme.colors.surfaceVariant, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, alignSelf: "flex-start" }}>
            <MaterialCommunityIcons name="filter-variant" size={16} color={theme.colors.onSurfaceVariant} />
            <Text style={{ fontSize: 12, fontWeight: "600", color: theme.colors.onSurfaceVariant }}>
              {statusFilter ? STATUS_META[statusFilter]?.label || statusFilter : "All Statuses"}
            </Text>
          </Pressable>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 60 }} />
        ) : advances.length === 0 ? (
          <EmptyState icon="currency-inr" title="No advances" description="Record the first advance to get started." />
        ) : (
          <View style={{ paddingHorizontal: 12, gap: 8 }}>
            {advances.map((a) => {
              const sm = STATUS_META[a.status] || { label: a.status, color: "#6B7280" };
              return (
                <View key={a.id} style={{ backgroundColor: theme.colors.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: theme.colors.outlineVariant }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: "700", color: theme.colors.onSurface }}>{a.user ? staffName(a.user) : "—"}</Text>
                      <Text style={{ fontSize: 11, color: theme.colors.onSurfaceVariant, marginTop: 1, textTransform: "capitalize" }}>{a.user?.role?.replace("_", " ") ?? "—"}</Text>
                    </View>
                    <Text style={{ fontSize: 17, fontWeight: "800", color: theme.colors.onSurface }}>{inr(a.amount)}</Text>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 }}>
                    <View style={{ backgroundColor: sm.color + "20", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                      <Text style={{ fontSize: 10, fontWeight: "700", color: sm.color }}>{sm.label}</Text>
                    </View>
                    <Text style={{ fontSize: 11, color: theme.colors.onSurfaceVariant }}>{formatDate(a.date)}</Text>
                    {a.reason ? <Text style={{ fontSize: 11, color: theme.colors.onSurfaceVariant, flex: 1 }} numberOfLines={1}>{a.reason}</Text> : null}
                  </View>
                  {a.repaymentAmount != null && (
                    <Text style={{ fontSize: 11, color: "#10B981", marginTop: 4 }}>Repaid: {inr(a.repaymentAmount)}</Text>
                  )}
                  {(a.status === "pending" || canManage) && (
                    <View style={{ flexDirection: "row", gap: 8, marginTop: 10, borderTopWidth: 1, borderTopColor: theme.colors.outlineVariant, paddingTop: 10 }}>
                      {a.status === "pending" && canManage && (
                        <Pressable onPress={() => handleApprove(a.id)} style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#10B98120", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 }}>
                          <MaterialCommunityIcons name="check-circle" size={14} color="#10B981" />
                          <Text style={{ fontSize: 11, fontWeight: "700", color: "#10B981" }}>Approve</Text>
                        </Pressable>
                      )}
                      {(a.status === "approved" || a.status === "pending") && canManage && (
                        <Pressable onPress={() => { setRepayModal(a); setRepayAmount(String(a.amount)); setRepayDate(new Date().toISOString().slice(0, 10)); }} style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#3B82F620", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 }}>
                          <MaterialCommunityIcons name="currency-inr" size={14} color="#3B82F6" />
                          <Text style={{ fontSize: 11, fontWeight: "700", color: "#3B82F6" }}>Repay</Text>
                        </Pressable>
                      )}
                      <Pressable onPress={() => openEdit(a)} style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 8 }}>
                        <MaterialCommunityIcons name="pencil" size={14} color={theme.colors.onSurfaceVariant} />
                      </Pressable>
                      {a.status === "pending" && (
                        <Pressable onPress={() => handleDelete(a.id)} style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 8 }}>
                          <MaterialCommunityIcons name="delete-outline" size={14} color="#EF4444" />
                        </Pressable>
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Filter modal */}
      <Modal visible={filterModal} transparent animationType="fade" onRequestClose={() => setFilterModal(false)}>
        <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 24 }} onPress={() => setFilterModal(false)}>
          <Pressable style={{ backgroundColor: theme.colors.surface, borderRadius: 16, padding: 20 }} onPress={() => {}}>
            <Text style={{ fontSize: 16, fontWeight: "800", color: theme.colors.onSurface, marginBottom: 12 }}>Filter by Status</Text>
            {filterOptions.map((opt) => (
              <Pressable key={opt.value} onPress={() => { setStatusFilter(opt.value); setFilterModal(false); }} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10 }}>
                <MaterialCommunityIcons name={statusFilter === opt.value ? "radiobox-marked" : "radiobox-blank"} size={20} color={theme.colors.primary} />
                <Text style={{ fontSize: 14, fontWeight: statusFilter === opt.value ? "700" : "400", color: theme.colors.onSurface }}>{opt.label}</Text>
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Create/Edit modal */}
      <Modal visible={formModal} transparent animationType="slide" onRequestClose={() => setFormModal(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: theme.colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: bottomInset + 20 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <Text style={{ fontSize: 17, fontWeight: "800", color: theme.colors.onSurface }}>{editId ? "Edit Advance" : "New Advance"}</Text>
              <Pressable onPress={() => setFormModal(false)}><MaterialCommunityIcons name="close" size={22} color={theme.colors.onSurfaceVariant} /></Pressable>
            </View>

            <ScrollView style={{ maxHeight: 400 }} keyboardShouldPersistTaps="handled">
              <Text style={{ fontSize: 12, fontWeight: "600", color: theme.colors.onSurfaceVariant, marginBottom: 4 }}>Amount (₹)</Text>
              <TextInput style={{ backgroundColor: theme.colors.surfaceVariant, borderRadius: 10, padding: 12, fontSize: 15, fontWeight: "600", color: theme.colors.onSurface, marginBottom: 12 }} keyboardType="number-pad" placeholder="e.g. 5000" placeholderTextColor={theme.colors.onSurfaceVariant} value={formAmount} onChangeText={setFormAmount} />

              <Text style={{ fontSize: 12, fontWeight: "600", color: theme.colors.onSurfaceVariant, marginBottom: 4 }}>Date</Text>
              <TextInput style={{ backgroundColor: theme.colors.surfaceVariant, borderRadius: 10, padding: 12, fontSize: 15, fontWeight: "600", color: theme.colors.onSurface, marginBottom: 12 }} value={formDate} onChangeText={setFormDate} placeholder="YYYY-MM-DD" placeholderTextColor={theme.colors.onSurfaceVariant} />

              <Text style={{ fontSize: 12, fontWeight: "600", color: theme.colors.onSurfaceVariant, marginBottom: 4 }}>Reason</Text>
              <TextInput style={{ backgroundColor: theme.colors.surfaceVariant, borderRadius: 10, padding: 12, fontSize: 15, color: theme.colors.onSurface, marginBottom: 12 }} placeholder="e.g. Medical expense" placeholderTextColor={theme.colors.onSurfaceVariant} value={formReason} onChangeText={setFormReason} />

              <Text style={{ fontSize: 12, fontWeight: "600", color: theme.colors.onSurfaceVariant, marginBottom: 4 }}>Notes</Text>
              <TextInput style={{ backgroundColor: theme.colors.surfaceVariant, borderRadius: 10, padding: 12, fontSize: 15, color: theme.colors.onSurface, marginBottom: 16, minHeight: 60 }} multiline placeholder="Optional notes..." placeholderTextColor={theme.colors.onSurfaceVariant} value={formNotes} onChangeText={setFormNotes} />

              <Pressable onPress={handleSave} disabled={formLoading} style={{ backgroundColor: theme.colors.primary, borderRadius: 12, padding: 14, alignItems: "center" }}>
                {formLoading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "800", fontSize: 15 }}>{editId ? "Update" : "Create Advance"}</Text>}
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Repayment modal */}
      <Modal visible={!!repayModal} transparent animationType="slide" onRequestClose={() => setRepayModal(null)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: theme.colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: bottomInset + 20 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <Text style={{ fontSize: 17, fontWeight: "800", color: theme.colors.onSurface }}>Record Repayment</Text>
              <Pressable onPress={() => setRepayModal(null)}><MaterialCommunityIcons name="close" size={22} color={theme.colors.onSurfaceVariant} /></Pressable>
            </View>
            {repayModal && (
              <>
                <Text style={{ fontSize: 13, color: theme.colors.onSurfaceVariant, marginBottom: 12 }}>
                  {repayModal.user ? staffName(repayModal.user) : "—"} — {inr(repayModal.amount)} on {formatDate(repayModal.date)}
                </Text>
                <Text style={{ fontSize: 12, fontWeight: "600", color: theme.colors.onSurfaceVariant, marginBottom: 4 }}>Repayment Amount (₹)</Text>
                <TextInput style={{ backgroundColor: theme.colors.surfaceVariant, borderRadius: 10, padding: 12, fontSize: 15, fontWeight: "600", color: theme.colors.onSurface, marginBottom: 12 }} keyboardType="number-pad" value={repayAmount} onChangeText={setRepayAmount} />
                <Text style={{ fontSize: 12, fontWeight: "600", color: theme.colors.onSurfaceVariant, marginBottom: 4 }}>Repayment Date</Text>
                <TextInput style={{ backgroundColor: theme.colors.surfaceVariant, borderRadius: 10, padding: 12, fontSize: 15, color: theme.colors.onSurface, marginBottom: 16 }} value={repayDate} onChangeText={setRepayDate} placeholder="YYYY-MM-DD" placeholderTextColor={theme.colors.onSurfaceVariant} />
                <Pressable onPress={handleRepay} style={{ backgroundColor: theme.colors.primary, borderRadius: 12, padding: 14, alignItems: "center" }}>
                  <Text style={{ color: "#fff", fontWeight: "800", fontSize: 15 }}>Record Repayment</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}
