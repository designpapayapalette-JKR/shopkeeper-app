import React, { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator, Alert } from "react-native";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "react-native-paper";
import { api, ApiError } from "../src/lib/api";
import { useTopInset } from "../src/lib/useTopInset";
import { useBottomInset } from "../src/lib/useBottomInset";

// Mirrors shopkeeper-web/src/app/dashboard/billing/page.tsx — current plan
// + usage thresholds + plan cards to upgrade/downgrade. Skips the dev-only
// mock-charge sandbox (web-only debugging tool, not relevant to a real
// merchant on their phone). See docs/web-vs-mobile-role-access-gap-
// analysis.md R6 — owner previously had no way to view/change their plan
// on mobile at all.
interface Plan {
  id: string;
  name: string;
  code: string;
  description?: string;
  price: number;
  interval: string;
  currency: string;
  max_staff: number;
  max_warehouses: number;
  features: string[];
}

interface CompanyData {
  subscription_plan?: string;
  subscription_status?: string;
  subscription_end_date?: string;
  gateway_subscription_id?: string;
  plan_id?: string;
  max_staff?: number;
  max_warehouses?: number;
}

function formatPrice(plan: Plan): string {
  if (plan.price === 0) return "Free";
  return `₹${plan.price.toLocaleString("en-IN")}/${plan.interval}`;
}

function UsageBar({ label, used, max }: { label: string; used: number; max: number }) {
  const theme = useTheme();
  const pct = Math.min(100, (used / Math.max(1, max)) * 100);
  return (
    <View className="mb-3">
      <View className="flex-row justify-between mb-1.5">
        <Text className="text-xs font-bold text-on-surface">{label}</Text>
        <Text className="text-xs text-on-surface-variant">{used} / {max >= 999 ? "∞" : max}</Text>
      </View>
      <View className="h-1.5 rounded-full bg-outline-variant overflow-hidden">
        <View style={{ width: `${pct}%`, height: "100%", backgroundColor: theme.colors.primary, borderRadius: 999 }} />
      </View>
    </View>
  );
}

export default function SubscriptionBillingScreen() {
  const router = useRouter();
  const theme = useTheme();
  const topInset = useTopInset();
  const bottomInset = useBottomInset();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [changingPlanId, setChangingPlanId] = useState<string | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [company, setCompany] = useState<CompanyData>({});
  const [usage, setUsage] = useState({ staff: 0, warehouses: 0 });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [plansRes, meRes, staffRes, warehousesRes] = await Promise.all([
        api.get<{ data: Plan[] }>("/plans"),
        api.get<{ data: CompanyData }>("/companies/me"),
        api.get<{ data: any[] }>("/staff").catch(() => ({ data: [] })),
        api.get<{ data: any[] }>("/warehouses").catch(() => ({ data: [] })),
      ]);
      setPlans(plansRes.data ?? []);
      setCompany(meRes.data ?? {});
      setUsage({ staff: (staffRes.data ?? []).length, warehouses: (warehousesRes.data ?? []).length });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load subscription details.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const isCurrentPlan = (plan: Plan) => company.plan_id === plan.id || company.subscription_plan === plan.name;

  const handleChangePlan = (plan: Plan) => {
    Alert.alert(
      `Switch to ${plan.name}?`,
      `Your plan will change to ${plan.name} (${formatPrice(plan)}).`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          onPress: async () => {
            setChangingPlanId(plan.id);
            try {
              await api.patch("/companies/subscription", { planId: plan.id });
              await load();
              Alert.alert("Plan updated", `You're now on the ${plan.name} plan.`);
            } catch (e) {
              Alert.alert("Error", e instanceof ApiError ? e.message : "Failed to update plan.");
            } finally {
              setChangingPlanId(null);
            }
          },
        },
      ]
    );
  };

  const statusColor =
    company.subscription_status === "active" ? "#2E9E5B" :
    company.subscription_status === "trial" ? theme.colors.primary : "#DC2626";

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background" style={{ paddingTop: topInset }}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-background px-5"
      style={{ paddingTop: topInset }}
      contentContainerStyle={{ paddingBottom: bottomInset + 32 }}
    >
      <View className="flex-row items-center mb-5 pt-2" style={{ gap: 12 }}>
        <Pressable onPress={() => router.back()} className="w-9 h-9 rounded-full bg-surface-container items-center justify-center">
          <MaterialCommunityIcons name="arrow-left" size={20} color="#1c1b1b" />
        </Pressable>
        <Text className="font-headline-md text-on-surface" style={{ fontSize: 20, fontWeight: "700" }}>Subscription & Billing</Text>
      </View>

      {error && (
        <View className="bg-red-50 border border-red-200 p-3 rounded-xl mb-4">
          <Text className="text-error font-semibold text-sm">{error}</Text>
        </View>
      )}

      {/* Current plan card */}
      <View className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-5 mb-6">
        <Text className="text-xs font-extrabold text-on-surface-variant uppercase tracking-wider mb-3">Active Subscription</Text>

        <View className="flex-row justify-between items-center mb-3">
          <View>
            <Text className="text-xs text-on-surface-variant">Current Plan</Text>
            <Text className="text-lg font-black text-on-surface mt-0.5">{company.subscription_plan || "Free Trial"}</Text>
          </View>
          <View style={{ backgroundColor: `${statusColor}20`, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999 }}>
            <Text style={{ color: statusColor, fontSize: 11, fontWeight: "800" }}>
              {(company.subscription_status || "trial").toUpperCase()}
            </Text>
          </View>
        </View>

        <View className="flex-row justify-between mb-4">
          <Text className="text-xs text-on-surface-variant">
            {company.subscription_status === "trial" ? "Trial Ends" : "Renews / Expires"}
          </Text>
          <Text className="text-xs font-bold text-on-surface">
            {company.subscription_end_date
              ? new Date(company.subscription_end_date).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })
              : "N/A"}
          </Text>
        </View>

        <UsageBar label="Staff Accounts" used={usage.staff} max={company.max_staff ?? 5} />
        <UsageBar label="Warehouse Slots" used={usage.warehouses} max={company.max_warehouses ?? 2} />
      </View>

      {/* Plan cards */}
      <Text className="text-xs font-extrabold text-on-surface-variant uppercase tracking-wider mb-3">Available Plans</Text>
      {plans.map((plan) => {
        const current = isCurrentPlan(plan);
        return (
          <View
            key={plan.id}
            className="bg-surface-container-lowest rounded-2xl p-5 mb-3"
            style={{ borderWidth: current ? 2 : 1, borderColor: current ? theme.colors.primary : "#E5E1DC" }}
          >
            {current && (
              <View style={{ alignSelf: "flex-start", backgroundColor: theme.colors.primary, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, marginBottom: 8 }}>
                <Text style={{ color: "#FFFFFF", fontSize: 10, fontWeight: "800" }}>CURRENT PLAN</Text>
              </View>
            )}
            <Text className="text-lg font-black text-on-surface">{plan.name}</Text>
            {!!plan.description && <Text className="text-xs text-on-surface-variant mt-1">{plan.description}</Text>}
            <Text className="text-2xl font-black text-on-surface mt-3">{formatPrice(plan)}</Text>

            <View className="mt-3" style={{ gap: 6 }}>
              <View className="flex-row items-center" style={{ gap: 6 }}>
                <MaterialCommunityIcons name="check-circle" size={14} color={theme.colors.primary} />
                <Text className="text-xs text-on-surface">Up to {plan.max_staff >= 999 ? "unlimited" : plan.max_staff} staff</Text>
              </View>
              <View className="flex-row items-center" style={{ gap: 6 }}>
                <MaterialCommunityIcons name="check-circle" size={14} color={theme.colors.primary} />
                <Text className="text-xs text-on-surface">Up to {plan.max_warehouses >= 999 ? "unlimited" : plan.max_warehouses} warehouses</Text>
              </View>
              {(plan.features ?? []).map((f) => (
                <View key={f} className="flex-row items-center" style={{ gap: 6 }}>
                  <MaterialCommunityIcons name="check-circle" size={14} color={theme.colors.primary} />
                  <Text className="text-xs text-on-surface capitalize">{f.replace(/_/g, " ")}</Text>
                </View>
              ))}
            </View>

            <Pressable
              onPress={() => handleChangePlan(plan)}
              disabled={current || changingPlanId === plan.id}
              className="mt-4 py-3.5 rounded-xl items-center"
              style={{ backgroundColor: current ? theme.colors.surfaceVariant : theme.colors.primary, opacity: changingPlanId === plan.id ? 0.6 : 1 }}
            >
              {changingPlanId === plan.id ? (
                <ActivityIndicator size="small" color={current ? theme.colors.onSurfaceVariant : "#FFFFFF"} />
              ) : (
                <Text style={{ color: current ? theme.colors.onSurfaceVariant : "#FFFFFF", fontWeight: "700", fontSize: 14 }}>
                  {current ? "Current Plan" : plan.price === 0 ? "Get Started" : `Switch to ${plan.name}`}
                </Text>
              )}
            </Pressable>
          </View>
        );
      })}
    </ScrollView>
  );
}
