import React, { useState, useEffect, useCallback } from "react";
import { View, ScrollView, ActivityIndicator, RefreshControl, Text, Pressable, Alert, TextInput } from "react-native";
import { useTheme } from "react-native-paper";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { api } from "../src/lib/api";
import { useAuth } from "../src/lib/auth-context";
import { useOutlet } from "../src/lib/outlet-context";
import { useTopInset, useBottomInset } from "../src/lib/useTopInset";
import EmptyState from "../src/components/EmptyState";
import LocationSelectorBar from "../src/components/LocationSelectorBar";

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
  location_name?: string;
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
  const { selectedOutletId, locationLabel } = useOutlet();
  const { t } = useTranslation();
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
    checkedIn: false,
    checkedOut: false,
    record: null,
  });

  const [monthYear, setMonthYear] = useState(() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`;
  });

  const canManage = userRole === "owner" || userRole === "manager" || userRole === "warehouse_manager";

  const fetchRoster = useCallback(async () => {
    if (!canManage) return;
    try {
      const params: any = { date };
      if (selectedOutletId) params.outletId = selectedOutletId;

      const res = await api.get<{ data: RosterRow[] }>("/attendance/roster", { params });
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
    } catch {
      setRoster([]);
    }
  }, [selectedOutletId, date, canManage]);

  const fetchHistory = useCallback(async () => {
    try {
      const { from, to } = getDateRange(preset);
      const params: any = { startDate: from, endDate: to, page: historyPage, limit: 50 };
      if (selectedOutletId) params.outletId = selectedOutletId;

      const res = await api.get<{ data: AttendanceRecord[]; meta: any }>("/attendance", { params });
      setHistory(res.data || []);
      setHistoryMeta(res.meta);
    } catch {
      setHistory([]);
    }
  }, [preset, historyPage, selectedOutletId]);

  const checkSelfStatus = useCallback(async () => {
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
    } catch {}
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchRoster(), fetchHistory(), checkSelfStatus()]);
    setLoading(false);
    setRefreshing(false);
  }, [fetchRoster, fetchHistory, checkSelfStatus]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSelfCheckIn = async () => {
    try {
      await api.post("/attendance/check-in", { outletId: selectedOutletId || undefined });
      await checkSelfStatus();
      Alert.alert("Success", `Checked in successfully for ${locationLabel}!`);
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to check in.");
    }
  };

  const handleSelfCheckOut = async () => {
    try {
      await api.post("/attendance/check-out", { outletId: selectedOutletId || undefined });
      await checkSelfStatus();
      Alert.alert("Success", "Checked out successfully!");
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to check out.");
    }
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
      await api.post("/attendance/mark", { outletId: selectedOutletId || undefined, date, records });
      await fetchRoster();
      Alert.alert("Success", `Attendance updated for ${locationLabel}!`);
    } catch {
      Alert.alert("Error", "Failed to save attendance.");
    } finally {
      setSaving(false);
    }
  };

  const handleFillMissing = async () => {
    const [year, month] = monthYear.split("-").map(Number);
    try {
      await api.post("/attendance/fill-missing", { year, month });
      await fetchRoster();
      Alert.alert("Success", "Missing attendance records updated.");
    } catch {
      Alert.alert("Error", "Failed to fill missing attendance.");
    }
  };

  const changeDate = (offset: number) => {
    const d = new Date(date);
    d.setDate(d.getDate() + offset);
    setDate(d.toISOString().split("T")[0]);
  };

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
        contentContainerStyle={{ paddingTop: topInset + 16, paddingBottom: bottomInset + 110 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} />
        }
      >
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 mb-3">
          <View className="flex-row items-center" style={{ gap: 8 }}>
            <MaterialCommunityIcons name="calendar-check" size={24} color={theme.colors.primary} />
            <Text className="text-2xl font-bold text-on-surface">Mark Attendance</Text>
          </View>
        </View>

        {/* Multi-Location Switcher (Any Outlet / Branch / Warehouse) */}
        <LocationSelectorBar onLocationChange={() => fetchData()} />

        {/* Self Check-in/Check-out for Selected Location */}
        <View className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-4 mx-4 my-3 shadow-sm">
          <View className="flex-row items-center justify-between mb-2">
            <View>
              <Text className="text-sm font-bold text-on-surface">My Location Check-In</Text>
              <Text className="text-xs text-on-surface-variant">Active: {locationLabel}</Text>
            </View>
            {selfStatus.checkedIn && (
              <View className="bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                <Text className="text-emerald-600 font-bold text-xs">Checked In</Text>
              </View>
            )}
          </View>

          <View className="flex-row gap-3 mt-1">
            <Pressable
              onPress={handleSelfCheckIn}
              disabled={selfStatus.checkedIn}
              className={`flex-1 py-3 rounded-xl items-center flex-row justify-center ${
                selfStatus.checkedIn ? "bg-surface-container-high" : "bg-emerald-600 active:opacity-90"
              }`}
              style={{ gap: 6 }}
            >
              <MaterialCommunityIcons
                name="login"
                size={18}
                color={selfStatus.checkedIn ? "#9CA3AF" : "#FFFFFF"}
              />
              <Text
                className={`text-xs font-bold ${selfStatus.checkedIn ? "text-on-surface-variant" : "text-white"}`}
              >
                Check In
              </Text>
            </Pressable>

            <Pressable
              onPress={handleSelfCheckOut}
              disabled={!selfStatus.checkedIn || selfStatus.checkedOut}
              className={`flex-1 py-3 rounded-xl items-center flex-row justify-center ${
                !selfStatus.checkedIn || selfStatus.checkedOut
                  ? "bg-surface-container-high"
                  : "bg-rose-600 active:opacity-90"
              }`}
              style={{ gap: 6 }}
            >
              <MaterialCommunityIcons
                name="logout"
                size={18}
                color={!selfStatus.checkedIn || selfStatus.checkedOut ? "#9CA3AF" : "#FFFFFF"}
              />
              <Text
                className={`text-xs font-bold ${
                  !selfStatus.checkedIn || selfStatus.checkedOut ? "text-on-surface-variant" : "text-white"
                }`}
              >
                Check Out
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Roster & History Tabs */}
        <View className="flex-row mx-4 mb-4 bg-surface-container-low p-1 rounded-2xl">
          {[
            { key: "roster", label: "Team Roster", icon: "clipboard-check" },
            { key: "history", label: "Attendance Logs", icon: "history" },
          ].map((tab) => {
            const active = activeTab === tab.key;
            return (
              <Pressable
                key={tab.key}
                onPress={() => setActiveTab(tab.key)}
                className={`flex-1 py-2.5 rounded-xl items-center flex-row justify-center ${
                  active ? "bg-surface-container-lowest shadow-sm" : ""
                }`}
                style={{ gap: 6 }}
              >
                <MaterialCommunityIcons
                  name={tab.icon as any}
                  size={18}
                  color={active ? theme.colors.primary : "#9CA3AF"}
                />
                <Text
                  className={`text-xs font-bold ${active ? "text-primary" : "text-on-surface-variant"}`}
                >
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {activeTab === "roster" && (
          <>
            {/* Date Selector */}
            <View className="flex-row items-center justify-between mx-4 mb-3 bg-surface-container-lowest border border-outline-variant rounded-2xl p-3">
              <Pressable onPress={() => changeDate(-1)} className="p-1">
                <MaterialCommunityIcons name="chevron-left" size={24} color="#6B7280" />
              </Pressable>
              <View className="items-center">
                <Text className="text-sm font-bold text-on-surface">{formatDate(new Date(date))}</Text>
                <Text className="text-[10px] text-on-surface-variant font-medium">
                  {dayNames[new Date(date).getDay()]}
                </Text>
              </View>
              <Pressable onPress={() => changeDate(1)} className="p-1">
                <MaterialCommunityIcons name="chevron-right" size={24} color="#6B7280" />
              </Pressable>
            </View>

            {/* Fill Missing & Auto Actions */}
            {canManage && (
              <View className="flex-row items-center justify-between px-4 mb-3">
                <View className="flex-row items-center" style={{ gap: 8 }}>
                  <TextInput
                    className="bg-surface-container-lowest text-on-surface border border-outline-variant rounded-xl px-3 py-1.5 text-xs font-medium"
                    value={monthYear}
                    onChangeText={setMonthYear}
                    placeholder="YYYY-MM"
                    style={{ width: 100 }}
                  />
                  <Pressable onPress={handleFillMissing} className="flex-row items-center py-1.5 px-2.5 bg-primary/10 rounded-xl" style={{ gap: 4 }}>
                    <MaterialCommunityIcons name="auto-fix" size={14} color={theme.colors.primary} />
                    <Text className="text-primary font-bold text-xs">Auto Fill</Text>
                  </Pressable>
                </View>

                {roster.length > 0 && (
                  <Pressable
                    onPress={() => {
                      const allPresent: Record<string, { status: string }> = {};
                      roster.forEach((r) => { allPresent[r.user_id] = { status: "present" }; });
                      setMarks(allPresent);
                    }}
                    className="flex-row items-center py-1.5 px-2.5 bg-emerald-500/10 rounded-xl"
                    style={{ gap: 4 }}
                  >
                    <MaterialCommunityIcons name="check-all" size={16} color="#2E9E5B" />
                    <Text className="text-emerald-700 font-bold text-xs">All Present</Text>
                  </Pressable>
                )}
              </View>
            )}

            {roster.length === 0 ? (
              <EmptyState
                icon="account-multiple-remove"
                title="No staff found for this location"
                description={`No team members registered for ${locationLabel}.`}
              />
            ) : (
              <>
                {/* Staff Roster Cards */}
                {roster.map((staff) => {
                  const current = marks[staff.user_id] || { status: "present" };
                  return (
                    <View key={staff.user_id} className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-4 mx-4 mb-3 shadow-sm">
                      <View className="flex-row items-center justify-between mb-2">
                        <View className="flex-row items-center" style={{ gap: 10 }}>
                          <View className="w-10 h-10 rounded-full items-center justify-center bg-primary/10 border border-primary/20">
                            <Text className="text-sm font-black text-primary">
                              {staff.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                            </Text>
                          </View>
                          <View>
                            <Text className="text-sm font-bold text-on-surface">{staff.name}</Text>
                            <Text className="text-[10px] text-on-surface-variant capitalize font-medium">
                              {staff.role.replace("_", " ")}
                            </Text>
                          </View>
                        </View>
                      </View>

                      {/* Status Buttons */}
                      <View className="flex-row flex-wrap gap-1.5 mt-2">
                        {STATUS_OPTIONS.map((opt) => {
                          const active = current.status === opt.value;
                          return (
                            <Pressable
                              key={opt.value}
                              onPress={() =>
                                setMarks((prev) => ({
                                  ...prev,
                                  [staff.user_id]: { ...prev[staff.user_id], status: opt.value },
                                }))
                              }
                              className={`px-3 py-1.5 rounded-xl border flex-row items-center ${
                                active ? "border-transparent" : "bg-surface-container-low border-outline-variant"
                              }`}
                              style={{
                                backgroundColor: active ? opt.color : undefined,
                                gap: 4,
                              }}
                            >
                              <MaterialCommunityIcons
                                name={opt.icon as any}
                                size={14}
                                color={active ? "#FFFFFF" : "#6B7280"}
                              />
                              <Text
                                className={`text-xs font-bold ${active ? "text-white" : "text-on-surface-variant"}`}
                              >
                                {opt.label}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  );
                })}

                {/* Save Button */}
                <View className="px-4 mt-2">
                  <Pressable
                    onPress={handleSaveRoster}
                    disabled={saving}
                    className="bg-primary py-3.5 rounded-2xl items-center justify-center active:opacity-90 shadow-sm"
                  >
                    {saving ? (
                      <ActivityIndicator color="white" />
                    ) : (
                      <Text className="text-sm font-bold text-white">Save Attendance Roster</Text>
                    )}
                  </Pressable>
                </View>
              </>
            )}
          </>
        )}

        {/* History Tab */}
        {activeTab === "history" && (
          <View className="px-4">
            <View className="flex-row gap-2 mb-3">
              {DATE_PRESETS.map((p) => {
                const active = preset === p.value;
                return (
                  <Pressable
                    key={p.value}
                    onPress={() => setPreset(p.value)}
                    className={`px-3.5 py-1.5 rounded-full border ${
                      active ? "bg-primary border-primary" : "bg-surface-container-lowest border-outline-variant"
                    }`}
                  >
                    <Text className={`text-xs font-bold ${active ? "text-white" : "text-on-surface"}`}>
                      {p.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {history.length === 0 ? (
              <EmptyState icon="calendar-blank" title="No attendance logs found" description="Attendance logs will appear here." />
            ) : (
              history.map((h) => {
                const opt = STATUS_OPTIONS.find((s) => s.value === h.status);
                const userName = h.user ? `${h.user.first_name} ${h.user.last_name || ""}`.trim() : "Staff";
                return (
                  <View key={h.id} className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-4 mb-2 shadow-sm">
                    <View className="flex-row items-center justify-between mb-1">
                      <Text className="text-sm font-bold text-on-surface">{userName}</Text>
                      <View
                        className="px-2.5 py-0.5 rounded-full"
                        style={{ backgroundColor: `${opt?.color || "#6B7280"}20` }}
                      >
                        <Text className="text-xs font-bold" style={{ color: opt?.color || "#6B7280" }}>
                          {opt?.label || h.status}
                        </Text>
                      </View>
                    </View>
                    <Text className="text-xs text-on-surface-variant">
                      {h.date ? h.date.split("T")[0] : ""}
                      {h.work_location ? ` • Location: ${h.work_location}` : ""}
                    </Text>
                  </View>
                );
              })
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
