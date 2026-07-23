import React, { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { api, ApiError } from "../src/lib/api";
import { useTopInset } from "../src/lib/useTopInset";
import { useBottomInset } from "../src/lib/useBottomInset";
import ToggleSwitch from "../src/components/ToggleSwitch";
import { SETTINGS_MODULE_CATEGORIES } from "../src/lib/moduleCategories";

// Mirrors shopkeeper-web/src/app/dashboard/settings/page.tsx's "Modules"
// tab — turn core operational modules on/off company-wide. Uses the same
// SETTINGS_MODULE_CATEGORIES grouping the mobile module-visibility system
// already defines, so this stays in sync with what the grid can show.
export default function ModulesSettingsScreen() {
  const router = useRouter();
  const topInset = useTopInset();
  const bottomInset = useBottomInset();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [enabledModules, setEnabledModules] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: any }>("/companies/me");
      setEnabledModules(Array.isArray(res.data?.enabled_modules) ? res.data.enabled_modules : []);
    } catch (e) {
      console.error("Failed to load module settings:", e);
      setError(e instanceof ApiError ? e.message : "Failed to load module settings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleModule = async (key: string, nextValue: boolean) => {
    setError(null);
    const previous = enabledModules;
    const next = nextValue ? [...enabledModules, key] : enabledModules.filter((m) => m !== key);
    setEnabledModules(next); // optimistic
    setSaving(key);
    try {
      await api.patch("/companies/me", { enabledModules: next });
    } catch (e) {
      setEnabledModules(previous); // revert on failure
      setError(e instanceof ApiError ? e.message : "Failed to update — please try again.");
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background" style={{ paddingTop: topInset }}>
        <ActivityIndicator size="large" color="#0368FE" />
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
        <Text className="font-headline-md text-on-surface" style={{ fontSize: 20, fontWeight: "700" }}>Modules</Text>
      </View>

      <Text className="text-sm text-on-surface-variant mb-5" style={{ lineHeight: 20 }}>
        Turn features on or off across your whole business — for the web portal and both mobile apps.
      </Text>

      {error && (
        <View className="bg-red-50 border border-red-200 p-3 rounded-xl mb-4">
          <Text className="text-error font-semibold text-sm">{error}</Text>
        </View>
      )}

      {SETTINGS_MODULE_CATEGORIES.map((cat) => (
        <View key={cat.id} className="mb-5">
          <Text className="text-xs font-extrabold text-on-surface-variant uppercase tracking-wider mb-2">{cat.label}</Text>
          <View className="bg-surface-container-lowest rounded-2xl border border-outline-variant overflow-hidden">
            {cat.modules.map((mod, idx) => (
              <View
                key={mod.key}
                className="flex-row items-center justify-between px-4 py-3.5"
                style={{ borderBottomWidth: idx < cat.modules.length - 1 ? 1 : 0, borderColor: "#E5E7EB" }}
              >
                <View className="flex-1 pr-3">
                  <Text className="text-sm font-bold text-on-surface">{mod.label}</Text>
                  <Text className="text-xs text-on-surface-variant mt-0.5">{mod.desc}</Text>
                </View>
                {saving === mod.key ? (
                  <ActivityIndicator size="small" color="#0368FE" />
                ) : (
                  <ToggleSwitch
                    value={enabledModules.includes(mod.key)}
                    onValueChange={(v) => toggleModule(mod.key, v)}
                  />
                )}
              </View>
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}
