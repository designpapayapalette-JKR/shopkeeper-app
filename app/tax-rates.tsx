import React, { useState, useEffect, useCallback } from "react";
import { View, Text, FlatList, ActivityIndicator, Pressable, Alert, RefreshControl } from "react-native";
import { Card, useTheme, Button, Snackbar, TextInput, Dialog, Portal, Switch, Chip } from "react-native-paper";
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
  const [snackbar, setSnackbar] = useState({ visible: false, message: "" });
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
      setSnackbar({ visible: true, message: editing ? "Tax rate updated." : "Tax rate created." });
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
      setSnackbar({ visible: true, message: "Tax rate deleted." });
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
        <Card mode="elevated" className="mx-4 mb-3">
          <Card.Content className="flex-row items-center" style={{ gap: 12 }}>
            <View className="w-16 h-16 rounded-2xl items-center justify-center" style={{ backgroundColor: `${tc.color}15` }}>
              <Text className="text-xl font-black" style={{ color: tc.color }}>{item.rate}%</Text>
            </View>
            <View className="flex-1">
              <Text className="text-sm font-bold text-on-surface dark:text-text-primary-dark">{item.name}</Text>
              <View className="flex-row items-center mt-1.5" style={{ gap: 6 }}>
                <Chip mode="flat" compact textStyle={{ fontSize: 9, color: tc.color }} style={{ backgroundColor: `${tc.color}15`, height: 22 }}>
                  {tc.label}
                </Chip>
                {item.is_active ? (
                  <Chip mode="flat" compact textStyle={{ fontSize: 9, color: "#2E9E5B" }} style={{ backgroundColor: "#2E9E5B15", height: 22 }}>
                    Active
                  </Chip>
                ) : (
                  <Chip mode="flat" compact textStyle={{ fontSize: 9, color: "#9E9E9E" }} style={{ backgroundColor: "#F0EDED", height: 22 }}>
                    Inactive
                  </Chip>
                )}
              </View>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={theme.colors.onSurfaceVariant} />
          </Card.Content>
        </Card>
      </Pressable>
    );
  };

  return (
    <View className="flex-1 bg-background dark:bg-bg-dark">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4" style={{ paddingTop: topInset + 16, paddingBottom: 8 }}>
        <View className="flex-row items-center" style={{ gap: 8 }}>
          <Pressable onPress={() => router.back()}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={theme.colors.primary} />
          </Pressable>
          <Text className="text-2xl font-bold text-on-surface dark:text-text-primary-dark">Tax Rates</Text>
        </View>
        <Button mode="contained" compact onPress={openCreate} icon="plus">
          Add
        </Button>
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

      {/* Create/Edit Dialog */}
      <Portal>
        <Dialog visible={dialog} onDismiss={() => setDialog(false)}>
          <Dialog.Title>{editing ? "Edit Tax Rate" : "Add Tax Rate"}</Dialog.Title>
          <Dialog.Content>
            <TextInput mode="outlined" label="Name" value={formName} onChangeText={setFormName} className="mb-3" />
            <TextInput
              mode="outlined"
              label="Rate (%)"
              value={formRate}
              onChangeText={setFormRate}
              keyboardType="numeric"
              placeholder="18"
              className="mb-3"
            />
            <Text className="text-sm text-on-surface-variant dark:text-text-secondary-dark mb-2">Type</Text>
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
              <Text className="text-sm text-on-surface dark:text-text-primary-dark">Active</Text>
              <Switch value={formActive} onValueChange={setFormActive} color={theme.colors.primary} />
            </View>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDialog(false)}>Cancel</Button>
            <Button onPress={handleSave} loading={saving} disabled={saving || !formName.trim() || !formRate}>
              {editing ? "Update" : "Create"}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Snackbar
        visible={snackbar.visible}
        onDismiss={() => setSnackbar({ visible: false, message: "" })}
        duration={3000}
      >
        {snackbar.message}
      </Snackbar>
    </View>
  );
}
