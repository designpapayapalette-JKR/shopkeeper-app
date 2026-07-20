import React, { useState, useEffect, useCallback } from "react";
import { View, ScrollView, ActivityIndicator, RefreshControl, Text, Pressable, Alert } from "react-native";
import { Card, useTheme, Button, Dialog, Portal, Snackbar, Chip } from "react-native-paper";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { api } from "../src/lib/api";
import { useAuth } from "../src/lib/auth-context";
import { useTopInset, useBottomInset } from "../src/lib/useTopInset";

type Plan = {
  id: string;
  name: string;
  code: string;
  description: string | null;
  price: number;
  interval: "month" | "year";
  currency: string;
  max_staff: number;
  max_warehouses: number;
  features: string[];
};

type SubscriptionEvent = {
  id: string;
  plan: string;
  status: string;
  amount: number;
  payment_method: string;
  note: string | null;
  created_at: string;
};

type CompanyData = {
  id: string;
  name: string;
  subscription_status: string | null;
  subscription_plan: string | null;
  subscription_end_date: string | null;
  max_staff: number | null;
  max_warehouses: number | null;
  plan_id: string | null;
};

export default function SubscriptionScreen() {
  const { userRole, activeCompany, refreshCompany } = useAuth();
  const router = useRouter();
  const theme = useTheme();
  const topInset = useTopInset();
  const bottomInset = useBottomInset();
  const isOwner = userRole === "owner";

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [company, setCompany] = useState<CompanyData | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [events, setEvents] = useState<SubscriptionEvent[]>([]);

  // Change plan dialog
  const [changeDialog, setChangeDialog] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [saving, setSaving] = useState(false);

  const [snackbar, setSnackbar] = useState({ visible: false, message: "" });

  const fetchData = useCallback(async () => {
    try {
      const [companyRes, plansRes] = await Promise.all([
        api.get<{ data: CompanyData }>("/companies/me"),
        api.get<Plan[]>("/plans"),
      ]);
      setCompany(companyRes.data);
      setPlans(Array.isArray(plansRes) ? plansRes : []);
    } catch { Alert.alert("Error", "Could not load subscription data."); }
  }, []);

  const fetchEvents = useCallback(async () => {
    try {
      const res = await api.get<{ data: SubscriptionEvent[] }>("/subscription-events");
      setEvents(res.data || []);
    } catch { setEvents([]); }
  }, []);

  const loadAll = useCallback(async () => {
    await Promise.all([fetchData(), fetchEvents()]);
  }, [fetchData, fetchEvents]);

  useEffect(() => { loadAll().finally(() => { setLoading(false); setRefreshing(false); }); }, [loadAll]);

  const handleChangePlan = async () => {
    if (!selectedPlan) return;
    setSaving(true);
    try {
      await api.patch("/companies/subscription", { planId: selectedPlan.id });
      setChangeDialog(false);
      setSelectedPlan(null);
      await refreshCompany();
      await fetchData();
      setSnackbar({ visible: true, message: `Plan changed to ${selectedPlan.name}` });
    } catch { setSnackbar({ visible: true, message: "Failed to change plan." }); }
    finally { setSaving(false); }
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  };

  const statusConfig: Record<string, { icon: string; color: string; label: string }> = {
    trial: { icon: "star-outline", color: "#F0AE4E", label: "Trial" },
    active: { icon: "check-circle", color: "#2E9E5B", label: "Active" },
    expired: { icon: "alert-circle", color: "#D64545", label: "Expired" },
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  const status = statusConfig[company?.subscription_status || "trial"] || statusConfig.trial;
  const daysLeft = company?.subscription_end_date
    ? Math.ceil((new Date(company.subscription_end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        contentContainerStyle={{ paddingTop: topInset + 16, paddingBottom: bottomInset + 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadAll(); }} />}
      >
        {/* Header */}
        <View className="flex-row items-center px-4 mb-4">
          <Pressable onPress={() => router.back()} className="mr-2">
            <MaterialCommunityIcons name="arrow-left" size={24} color={theme.colors.primary} />
          </Pressable>
          <MaterialCommunityIcons name="credit-card-outline" size={24} color={theme.colors.primary} />
          <Text className="text-2xl font-bold text-on-surface ml-2">Subscription</Text>
        </View>

        {/* Current Plan Card */}
        <Card mode="elevated" className="mx-4 mb-4">
          <Card.Content>
            <View className="flex-row items-center justify-between mb-3">
              <View>
                <Text className="text-xs text-on-surface-variant">Current Plan</Text>
                <Text className="text-lg font-black text-on-surface mt-1">{company?.subscription_plan || "Trial"}</Text>
              </View>
              <Chip
                mode="flat"
                compact
                textStyle={{ fontSize: 11, color: status.color }}
                style={{ backgroundColor: `${status.color}15` }}
              >
                <View className="flex-row items-center" style={{ gap: 4 }}>
                  <MaterialCommunityIcons name={status.icon as any} size={14} color={status.color} />
                  <Text style={{ color: status.color, fontWeight: "700", fontSize: 11 }}>{status.label}</Text>
                </View>
              </Chip>
            </View>

            {/* Limits */}
            <View className="flex-row" style={{ gap: 12 }}>
              <View className="flex-1 items-center p-3 rounded-xl bg-primary/5">
                <MaterialCommunityIcons name="account-group" size={20} color={theme.colors.primary} />
                <Text className="text-sm font-black text-on-surface mt-1">{company?.max_staff ?? "—"}</Text>
                <Text className="text-[10px] text-on-surface-variant">Staff Limit</Text>
              </View>
              <View className="flex-1 items-center p-3 rounded-xl" style={{ backgroundColor: "#2E9E5B10" }}>
                <MaterialCommunityIcons name="warehouse" size={20} color="#2E9E5B" />
                <Text className="text-sm font-black text-on-surface mt-1">{company?.max_warehouses ?? "—"}</Text>
                <Text className="text-[10px] text-on-surface-variant">Warehouses</Text>
              </View>
              <View className="flex-1 items-center p-3 rounded-xl" style={{ backgroundColor: `${status.color}10` }}>
                <MaterialCommunityIcons name="calendar-clock" size={20} color={status.color} />
                <Text className="text-sm font-black text-on-surface mt-1">{daysLeft !== null ? daysLeft : "—"}</Text>
                <Text className="text-[10px] text-on-surface-variant">Days Left</Text>
              </View>
            </View>

            {company?.subscription_end_date && (
              <Text className="text-xs text-on-surface-variant text-center mt-3">
                Expires: {formatDate(company.subscription_end_date)}
              </Text>
            )}
          </Card.Content>
        </Card>

        {/* Available Plans */}
        {plans.length > 0 && (
          <>
            <Text className="text-base font-bold text-on-surface px-4 mb-3">Available Plans</Text>
            {plans.map((plan) => {
              const isCurrent = plan.id === company?.plan_id;
              const isMonthly = plan.interval === "month";
              return (
                <Pressable key={plan.id} onPress={() => isOwner && !isCurrent && setSelectedPlan(plan) && setChangeDialog(true)}>
                  <Card
                    mode="elevated"
                    className={`mx-4 mb-3 ${isCurrent ? "border-2" : ""}`}
                    style={isCurrent ? { borderColor: theme.colors.primary } : {}}
                  >
                    <Card.Content>
                      <View className="flex-row items-center justify-between mb-2">
                        <View className="flex-row items-center" style={{ gap: 8 }}>
                          <Text className="text-base font-bold text-on-surface">{plan.name}</Text>
                          {isCurrent && (
                            <Chip mode="flat" compact textStyle={{ fontSize: 9, color: theme.colors.primary }} style={{ backgroundColor: `${theme.colors.primary}15`, height: 22 }}>
                              Current
                            </Chip>
                          )}
                        </View>
                        <View className="items-end">
                          <Text className="text-lg font-black text-primary">₹{plan.price.toLocaleString("en-IN")}</Text>
                          <Text className="text-[10px] text-on-surface-variant">/{isMonthly ? "month" : "year"}</Text>
                        </View>
                      </View>

                      {plan.description && (
                        <Text className="text-xs text-on-surface-variant mb-2">{plan.description}</Text>
                      )}

                      {/* Limits */}
                      <View className="flex-row mb-2" style={{ gap: 16 }}>
                        <View className="flex-row items-center" style={{ gap: 4 }}>
                          <MaterialCommunityIcons name="account-group" size={14} color="#6B7280" />
                          <Text className="text-xs text-on-surface-variant">{plan.max_staff} staff</Text>
                        </View>
                        <View className="flex-row items-center" style={{ gap: 4 }}>
                          <MaterialCommunityIcons name="warehouse" size={14} color="#6B7280" />
                          <Text className="text-xs text-on-surface-variant">{plan.max_warehouses} warehouses</Text>
                        </View>
                      </View>

                      {/* Features */}
                      {plan.features.length > 0 && (
                        <View className="flex-row flex-wrap" style={{ gap: 4 }}>
                          {plan.features.map((f) => (
                            <Chip key={f} mode="flat" compact textStyle={{ fontSize: 9 }} style={{ backgroundColor: "#2E9E5B10", height: 22 }}>
                              {f}
                            </Chip>
                          ))}
                        </View>
                      )}
                    </Card.Content>
                  </Card>
                </Pressable>
              );
            })}
          </>
        )}

        {/* Subscription History */}
        {events.length > 0 && (
          <>
            <Text className="text-base font-bold text-on-surface px-4 mb-3 mt-2">Billing History</Text>
            {events.map((evt) => (
              <Card key={evt.id} mode="elevated" className="mx-4 mb-2">
                <Card.Content className="flex-row items-center justify-between">
                  <View>
                    <Text className="text-sm font-bold text-on-surface">{evt.plan}</Text>
                    <Text className="text-xs text-on-surface-variant">{formatDate(evt.created_at)}</Text>
                    {evt.note && <Text className="text-[10px] text-on-surface-variant mt-0.5">{evt.note}</Text>}
                  </View>
                  <View className="items-end">
                    <Text className="text-sm font-black text-primary">₹{Number(evt.amount).toLocaleString("en-IN")}</Text>
                    <Chip mode="flat" compact textStyle={{ fontSize: 9, color: "#2E9E5B" }} style={{ backgroundColor: "#2E9E5B15", height: 20, marginTop: 2 }}>
                      {evt.payment_method.replace("_", " ")}
                    </Chip>
                  </View>
                </Card.Content>
              </Card>
            ))}
          </>
        )}

        {!loading && plans.length === 0 && events.length === 0 && (
          <View className="items-center py-10">
            <MaterialCommunityIcons name="credit-card-off" size={40} color="#9E9E9E" />
            <Text className="text-sm text-on-surface-variant mt-2">No subscription data available</Text>
          </View>
        )}
      </ScrollView>

      {/* Change Plan Confirmation Dialog */}
      <Portal>
        <Dialog visible={changeDialog} onDismiss={() => { setChangeDialog(false); setSelectedPlan(null); }}>
          <Dialog.Title>Change Plan</Dialog.Title>
          <Dialog.Content>
            {selectedPlan && (
              <View style={{ gap: 8 }}>
                <Text className="text-sm text-on-surface-variant">
                  Switch to <Text className="font-bold text-on-surface">{selectedPlan.name}</Text>?
                </Text>
                <Text className="text-lg font-black text-primary">
                  ₹{selectedPlan.price.toLocaleString("en-IN")}/{selectedPlan.interval === "month" ? "mo" : "yr"}
                </Text>
                {selectedPlan.description && <Text className="text-xs text-on-surface-variant">{selectedPlan.description}</Text>}
                <View className="flex-row" style={{ gap: 16 }}>
                  <Text className="text-xs text-on-surface-variant">{selectedPlan.max_staff} staff</Text>
                  <Text className="text-xs text-on-surface-variant">{selectedPlan.max_warehouses} warehouses</Text>
                </View>
              </View>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => { setChangeDialog(false); setSelectedPlan(null); }}>Cancel</Button>
            <Button onPress={handleChangePlan} loading={saving} disabled={saving}>Confirm</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Snackbar
        visible={snackbar.visible}
        onDismiss={() => setSnackbar({ visible: false, message: "" })}
        duration={2000}
      >
        {snackbar.message}
      </Snackbar>
    </View>
  );
}
