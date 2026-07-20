import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  Pressable,
  Alert,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { api, ApiError } from "../src/lib/api";
import { useConfirm } from "../src/components/ConfirmDialog";
import { useTopInset, useBottomInset } from "../src/lib/useTopInset";
import EmptyState from "../src/components/EmptyState";
import {
  Card,
  useTheme,
  Button,
  Snackbar,
  Chip,
  TextInput,
  Dialog,
  Portal,
  Switch,
} from "react-native-paper";

interface Counter {
  id: string;
  name: string;
  prefix?: string;
  invoice_series?: string;
  current_number?: number;
  is_active: boolean;
}

interface CounterForm {
  name: string;
  prefix: string;
  invoice_series: string;
  is_active: boolean;
}

const EMPTY_FORM: CounterForm = {
  name: "",
  prefix: "",
  invoice_series: "",
  is_active: true,
};

export default function CountersScreen() {
  const topInset = useTopInset();
  const bottomInset = useBottomInset();
  const confirm = useConfirm();
  const router = useRouter();
  const theme = useTheme();

  const [counters, setCounters] = useState<Counter[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Counter | null>(null);
  const [form, setForm] = useState<CounterForm>({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);

  const [snackbar, setSnackbar] = useState({ visible: false, message: "" });
  const [loadTrigger, setLoadTrigger] = useState(0);

  const showSuccess = (message: string) => setSnackbar({ visible: true, message });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: Counter[] }>("/counters");
      setCounters(res.data ?? []);
    } catch (e) {
      console.error("Failed to load counters:", e);
      Alert.alert("Error", "Could not load counters. Check your connection.");
    } finally {
      setLoading(false);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await load(); } finally { setRefreshing(false); }
  }, [load]);

  useEffect(() => {
    load();
  }, [load, loadTrigger]);

  const openAdd = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setShowForm(true);
  };

  const openEdit = (item: Counter) => {
    setEditing(item);
    setForm({
      name: item.name,
      prefix: item.prefix ?? "",
      invoice_series: item.invoice_series ?? "",
      is_active: item.is_active,
    });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditing(null);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      Alert.alert("Required", "Counter name is required.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        prefix: form.prefix.trim() || undefined,
        invoice_series: form.invoice_series.trim() || undefined,
        is_active: form.is_active,
      };
      if (editing) {
        await api.patch(`/counters/${editing.id}`, payload);
        showSuccess("Counter updated.");
      } else {
        await api.post("/counters", payload);
        showSuccess("Counter created.");
      }
      closeForm();
      setLoadTrigger((n) => n + 1);
    } catch (e) {
      Alert.alert("Error", e instanceof ApiError ? e.message : "Failed to save counter.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: Counter) => {
    const ok = await confirm({
      title: `Delete "${item.name}"?`,
      message: "This counter and its sequence will be permanently removed.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    try {
      await api.delete(`/counters/${item.id}`);
      setLoadTrigger((n) => n + 1);
      showSuccess("Counter deleted.");
    } catch (e) {
      Alert.alert("Error", e instanceof ApiError ? e.message : "Failed to delete counter.");
    }
  };

  const renderItem = ({ item }: { item: Counter }) => (
    <Card
      className="mb-3 rounded-2xl bg-surface-container-lowest dark:bg-surface-dark"
      style={{ elevation: 0 }}
      onPress={() => openEdit(item)}
      onLongPress={() => handleDelete(item)}
    >
      <View className="p-4">
        <View className="flex-row items-start justify-between">
          <View className="flex-1 mr-3">
            <Text className="text-base font-bold text-on-surface dark:text-text-primary-dark">
              {item.name}
            </Text>
            <View className="flex-row items-center mt-1" style={{ gap: 6 }}>
              {item.prefix && (
                <Text className="text-sm text-on-surface-variant dark:text-text-secondary-dark font-mono">
                  {item.prefix}
                </Text>
              )}
              {item.current_number !== undefined && (
                <Text className="text-sm text-on-surface-variant dark:text-text-secondary-dark font-mono">
                  #{item.current_number}
                </Text>
              )}
            </View>
            {item.invoice_series && (
              <Text className="text-xs text-on-surface-variant dark:text-text-secondary-dark mt-1">
                Series: {item.invoice_series}
              </Text>
            )}
          </View>
          <Chip
            mode="flat"
            compact
            className={item.is_active ? "bg-green-100" : "bg-surface-container dark:bg-zinc-800"}
          >
            {item.is_active ? "Active" : "Inactive"}
          </Chip>
        </View>
      </View>
    </Card>
  );

  return (
    <View className="flex-1 bg-background dark:bg-bg-dark" style={{ paddingTop: topInset }}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-6 py-4">
        <View className="flex-row items-center" style={{ gap: 8 }}>
          <Pressable onPress={() => router.back()} className="w-9 h-9 items-center justify-center active:opacity-70">
            <MaterialCommunityIcons name="arrow-left" size={22} color={theme.colors.onSurfaceVariant} />
          </Pressable>
          <Text className="text-xl font-bold text-on-surface dark:text-text-primary-dark">
            Counters
          </Text>
        </View>
        <Pressable
          onPress={openAdd}
          className="bg-primary dark:bg-primary-dark px-4 py-2.5 rounded-xl flex-row items-center active:opacity-80"
          style={{ gap: 4 }}
        >
          <MaterialCommunityIcons name="plus" size={16} color="white" />
          <Text className="text-white font-bold text-sm">Add</Text>
        </Pressable>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center pb-20">
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : counters.length === 0 ? (
        <EmptyState
          icon="counter"
          title="No counters yet"
          description="Tap the Add button above to create your first counter."
        />
      ) : (
        <FlatList
          data={counters}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: bottomInset + 24 }}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Create/Edit Dialog */}
      <Portal>
        <Dialog visible={showForm} onDismiss={closeForm}>
          <Dialog.Title>{editing ? "Edit Counter" : "New Counter"}</Dialog.Title>
          <Dialog.Content>
            <View style={{ gap: 12 }}>
              <TextInput
                label="Name *"
                value={form.name}
                onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
                mode="outlined"
              />
              <TextInput
                label="Prefix"
                value={form.prefix}
                onChangeText={(v) => setForm((f) => ({ ...f, prefix: v }))}
                mode="outlined"
                placeholder="e.g. INV-"
              />
              <TextInput
                label="Invoice Series"
                value={form.invoice_series}
                onChangeText={(v) => setForm((f) => ({ ...f, invoice_series: v }))}
                mode="outlined"
                placeholder="e.g. 2024-25"
              />
              <View className="flex-row items-center justify-between mt-2">
                <Text className="text-sm font-semibold text-on-surface-variant dark:text-text-secondary-dark">
                  Active
                </Text>
                <Switch
                  value={form.is_active}
                  onValueChange={(v) => setForm((f) => ({ ...f, is_active: v }))}
                />
              </View>
            </View>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={closeForm}>Cancel</Button>
            <Button onPress={handleSave} loading={saving} disabled={saving}>
              {editing ? "Update" : "Create"}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Snackbar */}
      <Snackbar
        visible={snackbar.visible}
        onDismiss={() => setSnackbar({ visible: false, message: "" })}
        duration={3000}
        action={{
          label: "OK",
          onPress: () => setSnackbar({ visible: false, message: "" }),
        }}
      >
        {snackbar.message}
      </Snackbar>
    </View>
  );
}
