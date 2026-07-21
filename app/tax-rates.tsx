import React, { useState, useEffect, useCallback } from "react";
import { View, Text, FlatList, ActivityIndicator, Pressable, Alert, RefreshControl, Modal, ScrollView, TextInput, Switch } from "react-native";
import { useTheme } from "react-native-paper";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { api, ApiError } from "../src/lib/api";
import { useConfirm } from "../src/components/ConfirmDialog";
import { useTopInset } from "../src/lib/useTopInset";
import { useBottomInset } from "../src/lib/useBottomInset";
import EmptyState from "../src/components/EmptyState";

interface TaxRate {
  id: string;
  name: string;
  rate: number;
  type?: string;
  is_active: boolean;
}

const TYPE_OPTIONS = [
  { value: "GST", label: "GST", color: "#0368FE" },
  { value: "Cess", label: "Cess", color: "#F0AE4E" },
  { value: "Other", label: "Other", color: "#6B7280" },
];

export default function TaxRatesScreen() {
  const topInset = useTopInset();
  const bottomInset = useBottomInset();
  const confirm = useConfirm();
  const router = useRouter();
  const theme = useTheme();

  const [taxRates, setTaxRates] = useState<TaxRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dialog, setDialog] = useState(false);
  const [editing, setEditing] = useState<TaxRate | null>(null);
  const [formName, setFormName] = useState("");
  const [formRate, setFormRate] = useState("");
  const [formType, setFormType] = useState("GST");
  const [formActive, setFormActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadTrigger, setLoadTrigger] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: TaxRate[] }>("/tax-rates");
      setTaxRates(res.data ?? []);
    } catch (e) {
      console.error("Failed to load tax rates:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await load(); } finally { setRefreshing(false); }
  }, [load]);

  useEffect(() => { load(); }, [load, loadTrigger]);

  const openCreate = () => {
    setEditing(null);
    setFormName("");
    setFormRate("");
    setFormType("GST");
    setFormActive(true);
    setDialog(true);
  };

  const openEdit = (item: TaxRate) => {
    setEditing(item);
    setFormName(item.name);
    setFormRate(String(item.rate));
    setFormType(item.type || "GST");
    setFormActive(item.is_active);
    setDialog(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) { Alert.alert("Required", "Name is required."); return; }
    const rate = parseFloat(formRate);
    if (isNaN(rate) || rate < 0) { Alert.alert("Required", "Valid rate is required."); return; }
    setSaving(true);
    try {
      const body = { name: formName.trim(), rate, type: formType, is_active: formActive };
      if (editing) {
        await api.patch(`/tax-rates/${editing.id}`, body);
      } else {
        await api.post("/tax-rates", body);
      }
      setDialog(false);
      Alert.alert("Success", editing ? "Tax rate updated." : "Tax rate created.");
      setLoadTrigger((n) => n + 1);
    } catch (e) {
      Alert.alert("Error", e instanceof ApiError ? e.message : "Failed to save tax rate.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: TaxRate) => {
    const ok = await confirm({
      title: `Delete "${item.name}"?`,
      message: "This tax rate will be permanently removed.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    try {
      await api.delete(`/tax-rates/${item.id}`);
      Alert.alert("Success", "Tax rate deleted.");
      setLoadTrigger((n) => n + 1);
    } catch (e) {
      Alert.alert("Error", e instanceof ApiError ? e.message : "Failed to delete tax rate.");
    }
  };

  const typeConfig = (t?: string) => TYPE_OPTIONS.find((o) => o.value === t) || TYPE_OPTIONS[2];

  const renderItem = ({ item }: { item: TaxRate }) => {
    const tc = typeConfig(item.type);
    return (
      <Pressable onPress={() => openEdit(item)} onLongPress={() => handleDelete(item)}>
        <View className="mx-4 mb-3 bg-surface-container-lowest border border-outline-variant rounded-2xl p-4">
          <View className="flex-row items-center" style={{ gap: 12 }}>
            <View className="w-16 h-16 rounded-2xl items-center justify-center" style={{ backgroundColor: `${tc.color}15` }}>
              <Text className="text-xl font-black" style={{ color: tc.color }}>{item.rate}%</Text>
            </View>
            <View className="flex-1">
              <Text className="text-sm font-bold text-on-surface">{item.name}</Text>
              <View className="flex-row items-center mt-1.5" style={{ gap: 6 }}>
                <View className="rounded-full px-3 py-1" style={{ backgroundColor: `${tc.color}15` }}>
                  <Text className="text-xs font-bold" style={{ color: tc.color, fontSize: 9 }}>{tc.label}</Text>
                </View>
                {item.is_active ? (
                  <View className="rounded-full px-3 py-1" style={{ backgroundColor: "#2E9E5B15" }}>
                    <Text className="text-xs font-bold" style={{ color: "#2E9E5B", fontSize: 9 }}>Active</Text>
                  </View>
                ) : (
                  <View className="rounded-full px-3 py-1" style={{ backgroundColor: "#F0EDED" }}>
                    <Text className="text-xs font-bold" style={{ color: "#9E9E9E", fontSize: 9 }}>Inactive</Text>
                  </View>
                )}
              </View>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={theme.colors.onSurfaceVariant} />
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <View className="flex-1 bg-background">
      <View className="flex-row items-center justify-between px-4" style={{ paddingTop: topInset + 16, paddingBottom: 8 }}>
        <View className="flex-row items-center" style={{ gap: 8 }}>
          <Pressable onPress={() => router.back()}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={theme.colors.primary} />
          </Pressable>
          <Text className="text-2xl font-bold text-on-surface">Tax Rates</Text>
        </View>
        <Pressable
          onPress={openCreate}
          className="bg-primary px-4 py-2.5 rounded-xl flex-row items-center active:opacity-80"
          style={{ gap: 4 }}
        >
          <MaterialCommunityIcons name="plus" size={16} color="white" />
          <Text className="text-white font-bold text-sm">Add</Text>
        </Pressable>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : taxRates.length === 0 ? (
        <EmptyState icon="percent" title="No tax rates yet" description="Tap Add above to create your first tax rate." />
      ) : (
        <FlatList
          data={taxRates}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={{ paddingBottom: bottomInset + 24, paddingTop: 8 }}
          showsVerticalScrollIndicator={false}
        />
      )}

      <Modal visible={dialog} transparent animationType="slide" onRequestClose={() => setDialog(false)}>
        <View className="flex-1 justify-end bg-black/40">
          <View className="bg-surface-container-lowest rounded-t-2xl pb-10">
            <ScrollView className="px-6 pt-6">
              <Text className="text-lg font-bold text-on-surface mb-4">
                {editing ? "Edit Tax Rate" : "Add Tax Rate"}
              </Text>
              <TextInput
                placeholder="Name"
                value={formName}
                onChangeText={setFormName}
                className="bg-surface-container-lowest text-on-surface border border-outline-variant rounded-xl px-4 py-3 font-medium mb-3"
                placeholderTextColor="#9CA3AF"
              />
              <TextInput
                placeholder="Rate (%)"
                value={formRate}
                onChangeText={setFormRate}
                keyboardType="numeric"
                placeholderTextColor="#9CA3AF"
                className="bg-surface-container-lowest text-on-surface border border-outline-variant rounded-xl px-4 py-3 font-medium mb-3"
              />
              <Text className="text-sm text-on-surface-variant mb-2">Type</Text>
              <View className="flex-row flex-wrap mb-3" style={{ gap: 8 }}>
                {TYPE_OPTIONS.map((opt) => (
                  <Pressable
                    key={opt.value}
                    onPress={() => setFormType(opt.value)}
                    className={`px-3 py-1.5 rounded-full border ${formType === opt.value ? "border-0" : "border-outline-variant"}`}
                    style={{ backgroundColor: formType === opt.value ? opt.color : "transparent" }}
                  >
                    <Text
                      className={`text-xs font-bold ${formType === opt.value ? "text-white" : ""}`}
                      style={formType === opt.value ? {} : { color: opt.color }}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <View className="flex-row items-center justify-between py-2">
                <Text className="text-sm text-on-surface">Active</Text>
                <Switch
                  value={formActive}
                  onValueChange={setFormActive}
                  trackColor={{ true: theme.colors.primary, false: "#ccc" }}
                  thumbColor="#f4f3f4"
                />
              </View>
              <View className="flex-row justify-end pt-4 pb-2 gap-3">
                <Pressable className="py-3 px-6 rounded-xl active:opacity-70" onPress={() => setDialog(false)}>
                  <Text className="text-primary font-bold text-base">Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={handleSave}
                  disabled={saving || !formName.trim() || !formRate}
                  className="bg-primary py-3 px-6 rounded-xl items-center active:opacity-80"
                >
                  <Text className="text-white font-bold text-base">
                    {saving ? "Saving..." : editing ? "Update" : "Create"}
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
