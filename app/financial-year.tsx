import React, { useState, useEffect } from "react";
import { Text, View, ScrollView, Pressable, ActivityIndicator, Alert } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { api, ApiError } from "../src/lib/api";
import { useConfirm } from "../src/components/ConfirmDialog";
import { useTopInset } from "../src/lib/useTopInset";

interface Closure {
  id: string;
  fyLabel: string;
  closedAt: string;
}

export default function FinancialYearScreen() {
  const topInset = useTopInset();
  const confirm = useConfirm();
  const [currentFyLabel, setCurrentFyLabel] = useState("");
  const [closures, setClosures] = useState<Closure[]>([]);
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: { currentFyLabel: string; closures: Closure[] } }>("/financial-year");
      setCurrentFyLabel(res.data.currentFyLabel);
      setClosures(res.data.closures || []);
    } catch {
      Alert.alert("Error", "Could not load financial year data.");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const priorFyLabel = (() => {
    if (!currentFyLabel) return "";
    const [startYear] = currentFyLabel.split("-").map(Number);
    const prevStart = startYear - 1;
    return `${prevStart}-${String((prevStart + 1) % 100).padStart(2, "0")}`;
  })();

  const closeFy = async (fyLabel: string) => {
    const ok = await confirm({
      title: `Close FY ${fyLabel}?`,
      message: "New transactions can no longer be backdated into this year. Existing data is never deleted or modified.",
      confirmLabel: "Close Year",
      destructive: true,
    });
    if (!ok) return;
    setClosing(true);
    try {
      await api.post("/financial-year/close", { fyLabel });
      load();
    } catch (e) {
      Alert.alert("Error", e instanceof ApiError ? e.message : "Failed to close financial year.");
    } finally {
      setClosing(false);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background dark:bg-bg-dark">
        <ActivityIndicator color="#0F7A5F" />
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-background dark:bg-bg-dark px-4" style={{ paddingTop: topInset + 8 }}>
      <Text className="text-xl font-black text-text-primary mb-1">Financial Year Closing</Text>
      <Text className="text-sm text-text-secondary mb-4">
        India's financial year runs April–March. Closing a past year blocks new backdated transactions — it never deletes or alters existing records.
      </Text>

      <View className="bg-surface dark:bg-surface-dark p-4 rounded-xl border border-gray-100 dark:border-zinc-800 mb-4">
        <Text className="text-sm text-text-secondary">Current financial year</Text>
        <Text className="text-lg font-black text-text-primary dark:text-text-primary-dark mt-0.5">{currentFyLabel} (open)</Text>
      </View>

      {closures.map((c) => (
        <View key={c.id} className="flex-row items-center justify-between py-3 border-b border-gray-100 dark:border-zinc-800">
          <View className="flex-row items-center" style={{ gap: 6 }}>
            <MaterialCommunityIcons name="lock-outline" size={16} color="#6B7280" />
            <Text className="font-bold text-text-primary dark:text-text-primary-dark">FY {c.fyLabel}</Text>
          </View>
          <Text className="text-xs text-text-secondary">Closed {new Date(c.closedAt).toLocaleDateString("en-IN")}</Text>
        </View>
      ))}

      {priorFyLabel && !closures.some((c) => c.fyLabel === priorFyLabel) && (
        <Pressable
          onPress={() => closeFy(priorFyLabel)}
          disabled={closing}
          className="border border-primary py-3.5 rounded-xl items-center flex-row justify-center mt-5"
          style={{ gap: 6, opacity: closing ? 0.5 : 1 }}
        >
          {closing ? <ActivityIndicator color="#0F7A5F" size="small" /> : (
            <>
              <MaterialCommunityIcons name="lock-outline" size={16} color="#0F7A5F" />
              <Text className="text-primary font-bold">Close FY {priorFyLabel}</Text>
            </>
          )}
        </Pressable>
      )}
    </ScrollView>
  );
}
