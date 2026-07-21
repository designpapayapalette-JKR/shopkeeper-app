import React, { useState, useEffect, useCallback } from "react";
import { View, ScrollView, ActivityIndicator, RefreshControl, Text, Pressable, Alert, TextInput } from "react-native";
import { useTheme } from "react-native-paper";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { api } from "../src/lib/api";
import { useAuth } from "../src/lib/auth-context";
import { useOutlet } from "../src/lib/outlet-context";
import { useTopInset, useBottomInset } from "../src/lib/useTopInset";
import EmptyState from "../src/components/EmptyState";

const STATUS_OPTIONS = [
  { value: "present", label: "Present", icon: "check-circle", color: "#2E9E5B" },
  { value: "absent", label: "Absent", icon: "close-circle", color: "#D64545" },
  { value: "half_day", label: "Half Day", icon: "adjust", color: "#F0AE4E" },
  { value: "leave", label: "Leave", icon: "briefcase-clock", color: "#0368FE" },
  { value: "holiday", label: "Holiday", icon: "calendar-star", color: "#835400" },
];

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
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  return { from: first.toISOString().split("T")[0], to };
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

type RosterRow = {
  user_id: string;
  name: string;
  role: string;
  assigned_to_location: boolean;
  status: string | null;
  check_in: string | null;
  check_out: string | null;
  notes: string | null;
  record_outlet_id: string | null;
};

type AttendanceRecord = {
  id: string;
  user_id: string;
  date: string;
  status: string;
  check_in: string | null;
  check_out: string | null;
  is_remote: boolean;
  work_location: string | null;
  notes: string | null;
  user?: { id: string; first_name: string; last_name: string; email: string; role: string };
};

export default function AttendanceScreen() {
  const { userRole } = useAuth();
  const { selectedOutletId } = useOutlet();
  const router = useRouter();
  const theme = useTheme();
  const topInset = useTopInset();
  const bottomInset = useBottomInset();

  const [preset, setPreset] = useState("today");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [activeTab, setActiveTab] = useState("roster");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [roster, setRoster] = useState<RosterRow[]>([]);
  const [marks, setMarks] = useState<Record<string, { status: string; check_in?: string; check_out?: string }>>({});
  const [history, setHistory] = useState<AttendanceRecord[]>([]);
  const [historyMeta, setHistoryMeta] = useState<any>(null);
  const [historyPage, setHistoryPage] = useState(1);

  const [selfStatus, setSelfStatus] = useState<{ checkedIn: boolean; checkedOut: boolean; record: any }>({
    checkedIn: false, checkedOut: false, record: null,
  });

  const [monthYear, setMonthYear] = useState(() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`;
  });

  const canManage = userRole === "owner" || userRole === "manager" || userRole === "warehouse_manager";
  const isStaff = userRole === "staff";

  const fetchRoster = useCallback(async () => {
    if (!selectedOutletId || !canManage) return;
    try {
      const res = await api.get<{ data: RosterRow[] }>("/attendance/roster", {
        params: { outletId: selectedOutletId, date },
      });
      const rows = res.data || [];
      setRoster(rows);
      const initial: Record<string, { status: string; check_in?: string; check_out?: string }> = {};
      rows.forEach((r: RosterRow) => {
        initial[r.user_id] = {
          status: r.status || "present",
          check_in: r.check_in || undefined,
          check_out: r.check_out || undefined,
        };
      });
      setMarks(initial);
    } catch { setRoster([]); }
  }, [selectedOutletId, date]);

  const fetchHistory = useCallback(async () => {
    try {
      const { from, to } = getDateRange(preset);
      const res = await api.get<{ data: AttendanceRecord[]; meta: any }>("/attendance", {
        params: { startDate: from, endDate: to, page: historyPage, limit: 50 },
      });
      setHistory(res.data || []);
      setHistoryMeta(res.meta);
    } catch { setHistory([]); }
  }, [preset, historyPage]);

  const checkSelfStatus = useCallback(async () => {
    if (!canManage) return;
    try {
      const { from, to } = getDateRange("today");
      const res = await api.get<{ data: AttendanceRecord[] }>("/attendance", {
        params: { startDate: from, endDate: to, limit: 50 },
      });
      const records = res.data || [];
      const todayRecord = records.find((r: AttendanceRecord) => {
        const d = r.date ? r.date.split("T")[0] : "";
        return d === from;
      });
      if (todayRecord) {
        setSelfStatus({
          checkedIn: !!todayRecord.check_in,
          checkedOut: !!todayRecord.check_out,
          record: todayRecord,
        });
      } else {
        setSelfStatus({ checkedIn: false, checkedOut: false, record: null });
      }
    } catch { setSelfStatus({ checkedIn: false, checkedOut: false, record: null }); }
  }, []);

  const fetchData = useCallback(async () => {
    await Promise.all([
      canManage ? fetchRoster() : Promise.resolve(),
      fetchHistory(),
      checkSelfStatus(),
    ]);
  }, [fetchRoster, fetchHistory, checkSelfStatus, canManage]);

  useEffect(() => { fetchData().finally(() => { setLoading(false); setRefreshing(false); }); }, [fetchData]);

  const handleCheckIn = async () => {
    try {
      await api.post("/attendance/check-in");
      await checkSelfStatus();
    } catch { Alert.alert("Error", "Check-in failed. Please try again."); }
  };

  const handleCheckOut = async () => {
    try {
      await api.post("/attendance/check-out");
      await checkSelfStatus();
    } catch { Alert.alert("Error", "Check-out failed. Please try again."); }
  };

  const handleSaveRoster = async () => {
    setSaving(true);
    try {
      const records = Object.entries(marks).map(([userId, m]) => ({
        userId,
        status: m.status,
        checkIn: m.check_in || null,
        checkOut: m.check_out || null,
      }));
      await api.post("/attendance/mark", { outletId: selectedOutletId, date, records });
      await fetchRoster();
    } catch { Alert.alert("Error", "Failed to save attendance."); }
    finally { setSaving(false); }
  };

  const handleFillMissing = async () => {
    const [year, month] = monthYear.split("-").map(Number);
    try {
      await api.post("/attendance/fill-missing", { year, month });
      await fetchRoster();
    } catch { Alert.alert("Error", "Failed to fill missing attendance."); }
  };

  const changeDate = (offset: number) => {
    const d = new Date(date);
    d.setDate(d.getDate() + offset);
    setDate(d.toISOString().split("T")[0]);
  };

  const tabs = [
    { key: "roster", label: "Mark Attendance", icon: "clipboard-check" },
    { key: "history", label: "History", icon: "history" },
  ];

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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
            <MaterialCommunityIcons name="calendar-check" size={24} color={theme.colors.primary} />
            <Text className="text-2xl font-bold text-on-surface">Attendance</Text>
          </View>
        </View>

        {/* Self Check-in/Check-out — all roles */}
        <View className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-4 mx-4 mb-4">
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-sm font-bold text-on-surface">My Attendance</Text>
              <Text className="text-xs text-on-surface-variant mt-1">
                {selfStatus.checkedIn && !selfStatus.checkedOut ? "Checked in" :
                selfStatus.checkedIn && selfStatus.checkedOut ? "Checked out for today" :
                "Not checked in yet"}
              </Text>
            </View>
            <View className="flex-row" style={{ gap: 8 }}>
              <Pressable
                disabled={selfStatus.checkedIn}
                onPress={handleCheckIn}
                className="bg-primary flex-row items-center py-2 rounded-xl px-3"
                style={{ gap: 4, opacity: selfStatus.checkedIn ? 0.5 : 1 }}
              >
                <MaterialCommunityIcons name="login" size={16} color="#FFFFFF" />
                <Text className="text-white font-bold text-xs">Check In</Text>
              </Pressable>
              <Pressable
                disabled={!selfStatus.checkedIn || selfStatus.checkedOut}
                onPress={handleCheckOut}
                className="border border-outline-variant flex-row items-center py-2 rounded-xl px-3"
                style={{ gap: 4, opacity: (!selfStatus.checkedIn || selfStatus.checkedOut) ? 0.5 : 1 }}
              >
                <MaterialCommunityIcons name="logout" size={16} color={theme.colors.primary} />
                <Text className="text-primary font-bold text-xs">Check Out</Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* Date Navigation */}
        <View className="flex-row items-center justify-between px-4 mb-4">
          <Pressable onPress={() => changeDate(-1)} className="p-2">
            <MaterialCommunityIcons name="chevron-left" size={24} color={theme.colors.primary} />
          </Pressable>
          <View className="items-center">
            <Text className="text-base font-bold text-on-surface">{formatDate(new Date(date))}</Text>
            <Text className="text-xs text-on-surface-variant">{dayNames[new Date(date).getDay()]}</Text>
          </View>
          <Pressable onPress={() => changeDate(1)} className="p-2">
            <MaterialCommunityIcons name="chevron-right" size={24} color={theme.colors.primary} />
          </Pressable>
        </View>

        {/* Date Presets */}
        <View className="px-4 mb-4">
          <View className="flex-row rounded-lg bg-surface-container-high overflow-hidden">
            {DATE_PRESETS.map((presetOpt) => (
              <Pressable
                key={presetOpt.value}
                onPress={() => { setPreset(presetOpt.value); setLoading(true); }}
                className={`flex-1 py-2 px-3 items-center ${preset === presetOpt.value ? 'bg-primary' : ''}`}
              >
                <Text className={`text-xs font-bold ${preset === presetOpt.value ? 'text-white' : 'text-on-surface-variant'}`}>
                  {presetOpt.label}
                </Text>
              </Pressable>
            ))}
          </View>
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
              <MaterialCommunityIcons name={t.icon as any} size={16} color={activeTab === t.key ? "#FFFFFF" : theme.colors.onSurfaceVariant} />
              <Text className={`text-sm font-bold ${activeTab === t.key ? "text-white" : "text-on-surface-variant"}`}>
                {t.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {activeTab === "roster" && (
          <>
            {/* Fill Missing */}
            {canManage && (
              <View className="flex-row items-center px-4 mb-3" style={{ gap: 8 }}>
                <TextInput
                  className="bg-surface-container-lowest text-on-surface border border-outline-variant rounded-xl px-4 py-3 font-medium"
                  value={monthYear}
                  onChangeText={setMonthYear}
                  placeholder="Month (YYYY-MM)"
                  style={{ width: 120 }}
                />
                <Pressable onPress={handleFillMissing} className="flex-row items-center py-2 rounded-xl px-3" style={{ gap: 4 }}>
                  <MaterialCommunityIcons name="auto-fix" size={16} color={theme.colors.primary} />
                  <Text className="text-primary font-bold text-xs">Fill Absent</Text>
                </Pressable>
              </View>
            )}

            {!selectedOutletId ? (
              <EmptyState icon="store-off" title="Select an outlet" description="Choose an outlet above to mark attendance." />
            ) : roster.length === 0 ? (
              <EmptyState icon="account-multiple-remove" title="No staff assigned" description="No team members are assigned to this outlet yet." />
            ) : (
              <>
                {/* Mark All Present Quick Action */}
                <View className="px-4 mb-3">
                  <Pressable
                    onPress={() => {
                      const allPresent: Record<string, { status: string }> = {};
                      roster.forEach((r) => { allPresent[r.user_id] = { status: "present" }; });
                      setMarks(allPresent);
                    }}
                    className="flex-row items-center py-2 rounded-xl px-3"
                    style={{ gap: 4 }}
                  >
                    <MaterialCommunityIcons name="check-all" size={16} color={theme.colors.primary} />
                    <Text className="text-primary font-bold text-xs">Mark All Present</Text>
                  </Pressable>
                </View>

                {/* Staff Roster Cards */}
                {roster.map((staff) => {
                  const current = marks[staff.user_id] || { status: "present" };
                  const statusOpt = STATUS_OPTIONS.find((s) => s.value === current.status);
                  return (
                    <View key={staff.user_id} className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-4 mx-4 mb-2">
                      <View className="flex-row items-center justify-between mb-2">
                        <View className="flex-row items-center" style={{ gap: 8 }}>
                          <View className="w-9 h-9 rounded-full items-center justify-center bg-primary/10">
                            <Text className="text-sm font-bold text-primary">
                              {staff.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                            </Text>
                          </View>
                          <View>
                            <Text className="text-sm font-bold text-on-surface">{staff.name}</Text>
                            <Text className="text-[10px] text-on-surface-variant capitalize">{staff.role.replace("_", " ")}</Text>
                          </View>
                        </View>
                        {!staff.assigned_to_location && (
                          <View className="rounded-full px-3 py-1" style={{ backgroundColor: "#F0AE4E20" }}>
                            <Text className="text-xs font-bold" style={{ color: "#F0AE4E" }}>Unassigned</Text>
                          </View>
                        )}
                      </View>

                      {/* Status selector */}
                      <View className="flex-row flex-wrap" style={{ gap: 6 }}>
                        {STATUS_OPTIONS.map((opt) => {
                          const selected = current.status === opt.value;
                          return (
                            <Pressable
                              key={opt.value}
                              onPress={() => setMarks((prev) => ({ ...prev, [staff.user_id]: { ...prev[staff.user_id], status: opt.value } }))}
                              className={`flex-row items-center px-3 py-1.5 rounded-full border ${selected ? "border-0" : "border-outline-variant"}`}
                              style={{ backgroundColor: selected ? opt.color : "transparent", gap: 4 }}
                            >
                              <MaterialCommunityIcons name={opt.icon as any} size={14} color={selected ? "#FFFFFF" : opt.color} />
                              <Text className={`text-xs font-bold ${selected ? "text-white" : ""}`} style={selected ? {} : { color: opt.color }}>
                                {opt.label}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  );
                })}

                <View className="px-4 mt-3 mb-6">
                  <Pressable
                    disabled={saving}
                    onPress={handleSaveRoster}
                    className="bg-primary py-3 rounded-xl items-center flex-row justify-center"
                    style={{ gap: 6, opacity: saving ? 0.5 : 1 }}
                  >
                    {saving && <ActivityIndicator size="small" color="#FFFFFF" />}
                    <MaterialCommunityIcons name="content-save" size={18} color="#FFFFFF" />
                    <Text className="text-white font-bold">Save Attendance</Text>
                  </Pressable>
                </View>
              </>
            )}
          </>
        )}

        {activeTab === "history" && (
          <>
            {history.length === 0 ? (
              <EmptyState icon="calendar-blank" title="No attendance records" />
            ) : (
              history.map((rec) => {
                const statusOpt = STATUS_OPTIONS.find((s) => s.value === rec.status);
                const name = rec.user ? `${rec.user.first_name || ""} ${rec.user.last_name || ""}`.trim() : "—";
                return (
                  <View key={rec.id} className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-4 mx-4 mb-2">
                    <View className="flex-row items-center justify-between">
                      <View className="flex-row items-center" style={{ gap: 10 }}>
                        {statusOpt && (
                          <MaterialCommunityIcons name={statusOpt.icon as any} size={22} color={statusOpt.color} />
                        )}
                        <View>
                          <Text className="text-sm font-bold text-on-surface">{name}</Text>
                          <Text className="text-xs text-on-surface-variant">
                            {rec.date ? formatDate(new Date(rec.date)) : "—"}
                            {rec.check_in ? ` · In: ${new Date(rec.check_in).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}` : ""}
                            {rec.check_out ? ` · Out: ${new Date(rec.check_out).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}` : ""}
                          </Text>
                        </View>
                      </View>
                      <View className="items-end">
                        {statusOpt && (
                          <Text className="text-xs font-bold" style={{ color: statusOpt.color }}>
                            {statusOpt.label}
                          </Text>
                        )}
                        {rec.notes && <Text className="text-[10px] text-on-surface-variant mt-0.5">{rec.notes}</Text>}
                      </View>
                    </View>
                  </View>
                );
              })
            )}

            {historyMeta && historyMeta.totalPages > 1 && (
              <View className="flex-row justify-center items-center px-4 mt-3 mb-6" style={{ gap: 12 }}>
                <Pressable
                  disabled={historyPage <= 1}
                  onPress={() => setHistoryPage((p) => Math.max(1, p - 1))}
                  className="border border-outline-variant py-2 px-4 rounded-xl"
                  style={{ opacity: historyPage <= 1 ? 0.5 : 1 }}
                >
                  <Text className="text-on-surface font-bold text-xs">Previous</Text>
                </Pressable>
                <Text className="text-sm text-on-surface-variant">
                  Page {historyMeta.page} of {historyMeta.totalPages}
                </Text>
                <Pressable
                  disabled={historyPage >= historyMeta.totalPages}
                  onPress={() => setHistoryPage((p) => p + 1)}
                  className="border border-outline-variant py-2 px-4 rounded-xl"
                  style={{ opacity: historyPage >= historyMeta.totalPages ? 0.5 : 1 }}
                >
                  <Text className="text-on-surface font-bold text-xs">Next</Text>
                </Pressable>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}
