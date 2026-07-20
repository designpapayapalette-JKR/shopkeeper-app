import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  Pressable,
  Alert,
  RefreshControl,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { api, ApiError } from "../src/lib/api";
import { useConfirm } from "../src/components/ConfirmDialog";
import { useTopInset } from "../src/lib/useTopInset";
import { useBottomInset } from "../src/lib/useBottomInset";
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

interface Outlet {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  gstin?: string;
  is_active: boolean;
}

interface OutletForm {
  name: string;
  address: string;
  phone: string;
  email: string;
  gstin: string;
  is_active: boolean;
}

const EMPTY_FORM: OutletForm = {
  name: "",
  address: "",
  phone: "",
  email: "",
  gstin: "",
  is_active: true,
};

export default function OutletsScreen() {
  const topInset = useTopInset();
  const bottomInset = useBottomInset();
  const confirm = useConfirm();
  const router = useRouter();
  const theme = useTheme();

  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Outlet | null>(null);
  const [form, setForm] = useState<OutletForm>({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);

  const [snackbar, setSnackbar] = useState({ visible: false, message: "" });
  const [loadTrigger, setLoadTrigger] = useState(0);

  const showSuccess = (message: string) => setSnackbar({ visible: true, message });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: Outlet[] }>("/outlets");
      setOutlets(res.data ?? []);
    } catch (e) {
      console.error("Failed to load outlets:", e);
      Alert.alert("Error", "Could not load outlets. Check your connection.");
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

  const openEdit = (item: Outlet) => {
    setEditing(item);
    setForm({
      name: item.name,
      address: item.address ?? "",
      phone: item.phone ?? "",
      email: item.email ?? "",
      gstin: item.gstin ?? "",
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
      Alert.alert("Required", "Outlet name is required.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        address: form.address.trim() || undefined,
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        gstin: form.gstin.trim() || undefined,
        is_active: form.is_active,
      };
      if (editing) {
        await api.patch(`/outlets/${editing.id}`, payload);
        showSuccess("Outlet updated.");
      } else {
        await api.post("/outlets", payload);
        showSuccess("Outlet created.");
      }
      closeForm();
      setLoadTrigger((n) => n + 1);
    } catch (e) {
      Alert.alert("Error", e instanceof ApiError ? e.message : "Failed to save outlet.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: Outlet) => {
    const ok = await confirm({
      title: `Delete "${item.name}"?`,
      message: "This outlet and all its data will be permanently removed.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    try {
      await api.delete(`/outlets/${item.id}`);
      setLoadTrigger((n) => n + 1);
      showSuccess("Outlet deleted.");
    } catch (e) {
      Alert.alert("Error", e instanceof ApiError ? e.message : "Failed to delete outlet.");
    }
  };

  const renderItem = ({ item }: { item: Outlet }) => (
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
            {item.address ? (
              <Text className="text-sm text-on-surface-variant dark:text-text-secondary-dark mt-1" numberOfLines={1}>
                {item.address}
              </Text>
            ) : null}
            {item.phone ? (
              <View className="flex-row items-center mt-1" style={{ gap: 4 }}>
                <MaterialCommunityIcons name="phone-outline" size={12} color={theme.colors.onSurfaceVariant} />
                <Text className="text-sm text-on-surface-variant dark:text-text-secondary-dark">{item.phone}</Text>
              </View>
            ) : null}
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
            <MaterialCommunityIcons name="arrow-left" size={22} color={theme.colors.primary} />
          </Pressable>
          <Text className="text-xl font-bold text-on-surface dark:text-text-primary-dark">
            Outlets
          </Text>
        </View>
        <Pressable
          onPress={openAdd}
          className="bg-primary px-4 py-2.5 rounded-xl flex-row items-center active:opacity-80"
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
      ) : outlets.length === 0 ? (
        <EmptyState
          icon="store-outline"
          title="No outlets yet"
          description="Tap the Add button above to create your first outlet."
        />
      ) : (
        <FlatList
          data={outlets}
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
          <Dialog.Title>{editing ? "Edit Outlet" : "New Outlet"}</Dialog.Title>
          <Dialog.Content>
            <View style={{ gap: 12 }}>
              <TextInput
                label="Name *"
                value={form.name}
                onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
                mode="outlined"
              />
              <TextInput
                label="Address"
                value={form.address}
                onChangeText={(v) => setForm((f) => ({ ...f, address: v }))}
                mode="outlined"
                multiline
                numberOfLines={2}
              />
              <TextInput
                label="Phone"
                value={form.phone}
                onChangeText={(v) => setForm((f) => ({ ...f, phone: v }))}
                mode="outlined"
                keyboardType="phone-pad"
              />
              <TextInput
                label="Email"
                value={form.email}
                onChangeText={(v) => setForm((f) => ({ ...f, email: v }))}
                mode="outlined"
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <TextInput
                label="GSTIN"
                value={form.gstin}
                onChangeText={(v) => setForm((f) => ({ ...f, gstin: v }))}
                mode="outlined"
                autoCapitalize="characters"
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
