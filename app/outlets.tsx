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
  TextInput,
  Switch,
} from "react-native";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { api, ApiError } from "../src/lib/api";
import { useConfirm } from "../src/components/ConfirmDialog";
import { useTopInset } from "../src/lib/useTopInset";
import { useBottomInset } from "../src/lib/useBottomInset";
import EmptyState from "../src/components/EmptyState";
import { useTheme } from "react-native-paper";

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

  const [loadTrigger, setLoadTrigger] = useState(0);

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
        Alert.alert("Success", "Outlet updated.");
      } else {
        await api.post("/outlets", payload);
        Alert.alert("Success", "Outlet created.");
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
      Alert.alert("Success", "Outlet deleted.");
    } catch (e) {
      Alert.alert("Error", e instanceof ApiError ? e.message : "Failed to delete outlet.");
    }
  };

  const renderItem = ({ item }: { item: Outlet }) => (
    <Pressable onPress={() => openEdit(item)} onLongPress={() => handleDelete(item)}>
      <View className="mb-3 bg-surface-container-lowest border border-outline-variant rounded-2xl p-4">
        <View className="flex-row items-start justify-between">
          <View className="flex-1 mr-3">
            <Text className="text-base font-bold text-on-surface">
              {item.name}
            </Text>
            {item.address ? (
              <Text className="text-sm text-on-surface-variant mt-1" numberOfLines={1}>
                {item.address}
              </Text>
            ) : null}
            {item.phone ? (
              <View className="flex-row items-center mt-1" style={{ gap: 4 }}>
                <MaterialCommunityIcons name="phone-outline" size={12} color={theme.colors.onSurfaceVariant} />
                <Text className="text-sm text-on-surface-variant">{item.phone}</Text>
              </View>
            ) : null}
          </View>
          <View className="rounded-full px-3 py-1 bg-primary/10">
            <Text className="text-xs font-bold text-primary">
              {item.is_active ? "Active" : "Inactive"}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: topInset }}>
      <View className="flex-row items-center justify-between px-6 py-4">
        <View className="flex-row items-center" style={{ gap: 8 }}>
          <Pressable onPress={() => router.back()} className="w-9 h-9 items-center justify-center active:opacity-70">
            <MaterialCommunityIcons name="arrow-left" size={22} color={theme.colors.primary} />
          </Pressable>
          <Text className="text-xl font-bold text-on-surface">
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

      <Modal visible={showForm} transparent animationType="slide" onRequestClose={closeForm}>
        <View className="flex-1 justify-end bg-black/40">
          <View className="bg-surface-container-lowest rounded-t-2xl pb-10">
            <ScrollView className="px-6 pt-6">
              <Text className="text-lg font-bold text-on-surface mb-4">
                {editing ? "Edit Outlet" : "New Outlet"}
              </Text>
              <View style={{ gap: 12 }}>
                <TextInput
                  placeholder="Name *"
                  value={form.name}
                  onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
                  className="bg-surface-container-lowest text-on-surface border border-outline-variant rounded-xl px-4 py-3 font-medium"
                  placeholderTextColor="#9CA3AF"
                />
                <TextInput
                  placeholder="Address"
                  value={form.address}
                  onChangeText={(v) => setForm((f) => ({ ...f, address: v }))}
                  multiline
                  numberOfLines={2}
                  className="bg-surface-container-lowest text-on-surface border border-outline-variant rounded-xl px-4 py-3 font-medium"
                  placeholderTextColor="#9CA3AF"
                />
                <TextInput
                  placeholder="Phone"
                  value={form.phone}
                  onChangeText={(v) => setForm((f) => ({ ...f, phone: v }))}
                  keyboardType="phone-pad"
                  className="bg-surface-container-lowest text-on-surface border border-outline-variant rounded-xl px-4 py-3 font-medium"
                  placeholderTextColor="#9CA3AF"
                />
                <TextInput
                  placeholder="Email"
                  value={form.email}
                  onChangeText={(v) => setForm((f) => ({ ...f, email: v }))}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  className="bg-surface-container-lowest text-on-surface border border-outline-variant rounded-xl px-4 py-3 font-medium"
                  placeholderTextColor="#9CA3AF"
                />
                <TextInput
                  placeholder="GSTIN"
                  value={form.gstin}
                  onChangeText={(v) => setForm((f) => ({ ...f, gstin: v }))}
                  autoCapitalize="characters"
                  className="bg-surface-container-lowest text-on-surface border border-outline-variant rounded-xl px-4 py-3 font-medium"
                  placeholderTextColor="#9CA3AF"
                />
                <View className="flex-row items-center justify-between mt-2">
                  <Text className="text-sm font-semibold text-on-surface-variant">
                    Active
                  </Text>
                  <Switch
                    value={form.is_active}
                    onValueChange={(v) => setForm((f) => ({ ...f, is_active: v }))}
                    trackColor={{ true: theme.colors.primary, false: "#ccc" }}
                    thumbColor="#f4f3f4"
                  />
                </View>
              </View>
              <View className="flex-row justify-end pt-6 pb-2 gap-3">
                <Pressable className="py-3 px-6 rounded-xl active:opacity-70" onPress={closeForm}>
                  <Text className="text-primary font-bold text-base">Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={handleSave}
                  disabled={saving}
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
