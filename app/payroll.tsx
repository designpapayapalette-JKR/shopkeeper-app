import React, { useState, useEffect, useCallback } from "react";
import { View, ScrollView, ActivityIndicator, RefreshControl, Text, Pressable, Alert } from "react-native";
import { Card, useTheme, Button, TextInput, Dialog, Portal, Chip } from "react-native-paper";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { api } from "../src/lib/api";
import { useAuth } from "../src/lib/auth-context";
import { useTopInset, useBottomInset } from "../src/lib/useTopInset";
import { useConfirm } from "../src/components/ConfirmDialog";
import EmptyState from "../src/components/EmptyState";

type PayrollSetting = {
  id: string;
  user_id: string;
  pay_per_day: number;
  base_pay: number | null;
  is_active: boolean;
  user: { id: string; first_name: string; last_name: string; role: string; is_active: boolean };
};

type CalcEntry = {
  user_id: string;
  employee: { first_name: string; last_name: string; role: string };
  pay_per_day: number;
  base_pay: number;
  days_present: number;
  days_absent: number;
  days_pay: number;
  total: number;
  month: string;
};

const SUB_PAGES = [
  { key: "holidays", label: "Holidays", icon: "calendar-star", route: "/holidays" },
  { key: "leaves", label: "Leaves", icon: "briefcase-clock", route: "/leaves" },
  { key: "shop-hours", label: "Shop Hours", icon: "clock-outline", route: "/shop-hours" },
];

export default function PayrollScreen() {
  const { userRole } = useAuth();
  const router = useRouter();
  const theme = useTheme();
  const topInset = useTopInset();
  const bottomInset = useBottomInset();
  const confirm = useConfirm();
  const canEdit = userRole === "owner" || userRole === "manager";

  const [activeTab, setActiveTab] = useState("settings");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Settings state
  const [settings, setSettings] = useState<PayrollSetting[]>([]);
  const [editDialog, setEditDialog] = useState(false);
  const [editUser, setEditUser] = useState<PayrollSetting | null>(null);
  const [editPayPerDay, setEditPayPerDay] = useState("");
  const [editBasePay, setEditBasePay] = useState("");

  // Calculate state
  const [calcMonth, setCalcMonth] = useState(() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`;
  });
  const [calcResults, setCalcResults] = useState<CalcEntry[]>([]);
  const [calcLoading, setCalcLoading] = useState(false);
  const [processing, setProcessing] = useState(false);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await api.get<{ data: PayrollSetting[] }>("/payroll/settings");
      setSettings(res.data || []);
    } catch { setSettings([]); }
  }, []);

  const fetchData = useCallback(async () => {
    await fetchSettings();
  }, [fetchSettings]);

  useEffect(() => { fetchData().finally(() => { setLoading(false); setRefreshing(false); }); }, [fetchData]);

  const handleSaveSetting = async () => {
    if (!editUser) return;
    try {
      await api.put("/payroll/settings", {
        userId: editUser.user_id,
        payPerDay: parseFloat(editPayPerDay) || 0,
        basePay: editBasePay ? parseFloat(editBasePay) : undefined,
      });
      setEditDialog(false);
      await fetchSettings();
    } catch { Alert.alert("Error", "Failed to save payroll settings."); }
  };

  const handleCalculate = async () => {
    setCalcLoading(true);
    const [year, month] = calcMonth.split("-").map(Number);
    try {
      const res = await api.post<{ data: CalcEntry[] }>("/payroll/calculate", { year, month });
      setCalcResults(res.data || []);
    } catch { setCalcResults([]); }
    finally { setCalcLoading(false); }
  };

  const handleProcess = async () => {
    const ok = await confirm({
      title: "Process Payroll",
      message: `Process payments for all ${calcResults.length} employee(s) totalling ₹${totalPay.toLocaleString("en-IN")}?`,
      confirmLabel: "Process Payments",
    });
    if (!ok) return;
    setProcessing(true);
    try {
      const entries = calcResults.map((r) => ({
        userId: r.user_id,
        amount: r.total,
        date: new Date().toISOString(),
      }));
      await api.post("/payroll/process", { entries });
      setCalcResults([]);
    } catch { Alert.alert("Error", "Failed to process payroll."); }
    finally { setProcessing(false); }
  };

  const openEdit = (setting: PayrollSetting) => {
    setEditUser(setting);
    setEditPayPerDay(String(setting.pay_per_day));
    setEditBasePay(setting.base_pay ? String(setting.base_pay) : "");
    setEditDialog(true);
  };

  const tabs = [
    { key: "settings", label: "Settings", icon: "cog" },
    { key: "calculate", label: "Calculate", icon: "calculator" },
  ];

  const totalPay = calcResults.reduce((s, r) => s + r.total, 0);

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
            <MaterialCommunityIcons name="cash-multiple" size={24} color={theme.colors.primary} />
            <Text className="text-2xl font-bold text-on-surface">Payroll</Text>
          </View>
        </View>

        {/* Sub-page links */}
        <ScrollView horizontal className="px-4 mb-4" showsHorizontalScrollIndicator={false} style={{ gap: 0 }}>
          <View className="flex-row" style={{ gap: 8 }}>
            {SUB_PAGES.map((page) => (
              <Pressable
                key={page.key}
                onPress={() => router.push(page.route as any)}
                className="flex-row items-center px-4 py-2 rounded-full bg-surface-container-high"
                style={{ gap: 6 }}
              >
                <MaterialCommunityIcons name={page.icon as any} size={16} color={theme.colors.primary} />
                <Text className="text-sm font-bold text-on-surface-variant">{page.label}</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>

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

        {activeTab === "settings" && (
          <>
            {settings.length === 0 ? (
              <EmptyState icon="cog-off" title="No payroll settings yet" description="Add staff members first, then set up their pay here." />
            ) : (
              settings.map((setting) => {
                const name = `${setting.user.first_name || ""} ${setting.user.last_name || ""}`.trim();
                return (
                  <Card key={setting.id} mode="elevated" className="mx-4 mb-2">
                    <Card.Content>
                      <View className="flex-row items-center justify-between">
                        <View className="flex-row items-center" style={{ gap: 10 }}>
                          <View className="w-10 h-10 rounded-full items-center justify-center bg-primary/10">
                            <Text className="text-sm font-bold text-primary">
                              {name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                            </Text>
                          </View>
                          <View>
                            <Text className="text-sm font-bold text-on-surface">{name}</Text>
                            <Text className="text-[10px] text-on-surface-variant capitalize">{setting.user.role.replace("_", " ")}</Text>
                            <View className="flex-row items-center mt-1" style={{ gap: 8 }}>
                              <Chip mode="flat" compact textStyle={{ fontSize: 9 }}>
                                ₹{setting.pay_per_day}/day
                              </Chip>
                              {setting.base_pay ? (
                                <Chip mode="flat" compact textStyle={{ fontSize: 9 }}>
                                  ₹{setting.base_pay} base
                                </Chip>
                              ) : null}
                            </View>
                          </View>
                        </View>
                        {canEdit && (
                          <Button compact mode="text" onPress={() => openEdit(setting)}>Edit</Button>
                        )}
                      </View>
                    </Card.Content>
                  </Card>
                );
              })
            )}
          </>
        )}

        {activeTab === "calculate" && (
          <>
            {/* Month Selector */}
            <View className="flex-row items-center px-4 mb-4" style={{ gap: 8 }}>
              <TextInput
                mode="outlined"
                value={calcMonth}
                onChangeText={setCalcMonth}
                label="Month (YYYY-MM)"
                dense
                style={{ flex: 1, height: 40 }}
              />
              <Button
                mode="contained"
                loading={calcLoading}
                disabled={calcLoading}
                onPress={handleCalculate}
                icon="calculator"
              >
                Calculate
              </Button>
            </View>

            {calcResults.length > 0 && (
              <>
                {/* Total Card */}
                <Card mode="elevated" className="mx-4 mb-4">
                  <Card.Content className="items-center py-3">
                    <Text className="text-xs text-on-surface-variant mb-1">Total Payroll for {calcMonth}</Text>
                    <Text className="text-3xl font-black text-primary">
                      ₹{totalPay.toLocaleString("en-IN")}
                    </Text>
                  </Card.Content>
                </Card>

                {/* Results */}
                {calcResults.map((entry) => {
                  const name = `${entry.employee.first_name} ${entry.employee.last_name}`.trim();
                  return (
                    <Card key={entry.user_id} mode="elevated" className="mx-4 mb-2">
                      <Card.Content>
                        <View className="flex-row items-center justify-between mb-2">
                          <Text className="text-sm font-bold text-on-surface">{name}</Text>
                          <Text className="text-base font-black text-primary">
                            ₹{entry.total.toLocaleString("en-IN")}
                          </Text>
                        </View>
                        <View className="flex-row" style={{ gap: 12 }}>
                          <View className="flex-1">
                            <Text className="text-[10px] text-on-surface-variant">Present</Text>
                            <Text className="text-sm font-bold text-on-surface">{entry.days_present} days</Text>
                          </View>
                          <View className="flex-1">
                            <Text className="text-[10px] text-on-surface-variant">Absent</Text>
                            <Text className="text-sm font-bold text-on-surface">{entry.days_absent} days</Text>
                          </View>
                          <View className="flex-1">
                            <Text className="text-[10px] text-on-surface-variant">Days Pay</Text>
                            <Text className="text-sm font-bold text-on-surface">₹{entry.days_pay.toLocaleString("en-IN")}</Text>
                          </View>
                          {entry.base_pay > 0 && (
                            <View className="flex-1">
                              <Text className="text-[10px] text-on-surface-variant">Base</Text>
                              <Text className="text-sm font-bold text-on-surface">₹{entry.base_pay.toLocaleString("en-IN")}</Text>
                            </View>
                          )}
                        </View>
                      </Card.Content>
                    </Card>
                  );
                })}

                {canEdit && (
                  <View className="px-4 mt-3 mb-6">
                    <Button
                      mode="contained"
                      loading={processing}
                      disabled={processing}
                      onPress={handleProcess}
                      icon="cash-check"
                    >
                      Process All Payments
                    </Button>
                  </View>
                )}
              </>
            )}

            {calcResults.length === 0 && !calcLoading && (
              <View className="items-center py-10">
                <MaterialCommunityIcons name="calculator-variant" size={40} color="#9E9E9E" />
                <Text className="text-sm text-on-surface-variant mt-2">Select a month and calculate payroll</Text>
              </View>
            )}
          </>
        )}

        {/* Edit Dialog */}
        <Portal>
          <Dialog visible={editDialog} onDismiss={() => setEditDialog(false)}>
            <Dialog.Title>
              {editUser ? `${editUser.user.first_name} ${editUser.user.last_name}`.trim() : ""}
            </Dialog.Title>
            <Dialog.Content>
              <TextInput
                mode="outlined"
                label="Pay Per Day (₹)"
                value={editPayPerDay}
                onChangeText={setEditPayPerDay}
                keyboardType="numeric"
                className="mb-3"
              />
              <TextInput
                mode="outlined"
                label="Base Pay (₹) — optional"
                value={editBasePay}
                onChangeText={setEditBasePay}
                keyboardType="numeric"
              />
            </Dialog.Content>
            <Dialog.Actions>
              <Button onPress={() => setEditDialog(false)}>Cancel</Button>
              <Button onPress={handleSaveSetting}>Save</Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>
      </ScrollView>
    </View>
  );
}
