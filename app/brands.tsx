import React, { useCallback, useEffect, useState } from "react";
import { View, Text, FlatList, ActivityIndicator, Pressable, Alert, RefreshControl } from "react-native";
import { Card, useTheme, Button, TextInput, Dialog, Portal, Snackbar } from "react-native-paper";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { api, ApiError } from "../src/lib/api";
import { useConfirm } from "../src/components/ConfirmDialog";
import { useTopInset } from "../src/lib/useTopInset";
import { useBottomInset } from "../src/lib/useBottomInset";

interface Brand {
  id: string;
  name: string;
  _count?: { products?: number };
}

export default function BrandsScreen() {
  const topInset = useTopInset();
  const bottomInset = useBottomInset();
  const confirm = useConfirm();
  const router = useRouter();
  const theme = useTheme();

  const [items, setItems] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadTrigger, setLoadTrigger] = useState(0);

  const [dialogVisible, setDialogVisible] = useState(false);
  const [editing, setEditing] = useState<Brand | null>(null);
  const [formName, setFormName] = useState("");
  const [saving, setSaving] = useState(false);

  const [snackbar, setSnackbar] = useState({ visible: false, message: "" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: Brand[] }>("/brands");
      setItems(res.data ?? []);
    } catch (e) {
      console.error("Failed to load brands:", e);
      Alert.alert("Error", "Could not load brands. Check your connection.");
    } finally {
      setLoading(false);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await load(); } finally { setRefreshing(false); }
  }, [load]);

  useEffect(() => { load(); }, [load, loadTrigger]);

  const openAdd = () => {
    setEditing(null);
    setFormName("");
    setDialogVisible(true);
  };

  const openEdit = (item: Brand) => {
    setEditing(item);
    setFormName(item.name);
    setDialogVisible(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      Alert.alert("Required", "Name is required.");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await api.patch(`/brands/${editing.id}`, { name: formName.trim() });
        setSnackbar({ visible: true, message: "Brand updated" });
      } else {
        await api.post("/brands", { name: formName.trim() });
        setSnackbar({ visible: true, message: "Brand created" });
      }
      setDialogVisible(false);
      setEditing(null);
      setLoadTrigger((n) => n + 1);
    } catch (e) {
      Alert.alert("Error", e instanceof ApiError ? e.message : "Failed to save brand.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: Brand) => {
    const ok = await confirm({
      title: `Delete "${item.name}"?`,
      message: "This brand will be permanently removed. Products assigned to it won't be deleted.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    try {
      await api.delete(`/brands/${item.id}`);
      setLoadTrigger((n) => n + 1);
      setSnackbar({ visible: true, message: "Brand deleted" });
    } catch (e) {
      Alert.alert("Error", e instanceof ApiError ? e.message : "Failed to delete brand.");
    }
  };

  const renderItem = ({ item }: { item: Brand }) => (
    <Card mode="elevated" className="mb-3">
      <Pressable onPress={() => openEdit(item)} onLongPress={() => handleDelete(item)}>
        <Card.Content>
          <View className="flex-row items-center justify-between">
            <View className="flex-1 mr-3">
              <Text className="text-base font-bold text-on-surface">{item.name}</Text>
              {item._count?.products !== undefined && (
                <View className="flex-row items-center mt-1" style={{ gap: 4 }}>
                  <MaterialCommunityIcons name="package-variant-closed" size={14} color="#6B7280" />
                  <Text className="text-sm text-on-surface-variant">
                    {item._count.products} product{item._count.products !== 1 ? "s" : ""}
                  </Text>
                </View>
              )}
            </View>
            <View className="flex-row" style={{ gap: 4 }}>
              <Pressable
                onPress={() => openEdit(item)}
                className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-zinc-800 items-center justify-center active:opacity-70"
              >
                <MaterialCommunityIcons name="pencil" size={16} color="#6B7280" />
              </Pressable>
              <Pressable
                onPress={() => handleDelete(item)}
                className="w-9 h-9 rounded-lg bg-red-50 items-center justify-center active:opacity-70"
              >
                <MaterialCommunityIcons name="delete-outline" size={16} color="#D64545" />
              </Pressable>
            </View>
          </View>
        </Card.Content>
      </Pressable>
    </Card>
  );

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background" style={{ paddingTop: topInset }}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: topInset }}>
      <View className="flex-row items-center justify-between px-6 py-4">
        <View className="flex-row items-center" style={{ gap: 8 }}>
          <Pressable onPress={() => router.back()} className="w-9 h-9 items-center justify-center active:opacity-70">
            <MaterialCommunityIcons name="arrow-left" size={22} color="#6B7280" />
          </Pressable>
          <Text className="text-xl font-bold text-on-surface">Brands</Text>
        </View>
        <Button mode="contained" compact icon="plus" onPress={openAdd}>
          Add
        </Button>
      </View>

      {items.length === 0 ? (
        <View className="flex-1 items-center justify-center pb-20 px-6">
          <MaterialCommunityIcons name="trademark" size={48} color="#D1D5DB" />
          <Text className="text-base font-bold text-on-surface-variant mt-4">No brands yet</Text>
          <Text className="text-sm text-on-surface-variant mt-1 text-center">
            Tap the Add button to create your first brand.
          </Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: bottomInset + 24 }}
          showsVerticalScrollIndicator={false}
        />
      )}

      <Portal>
        <Dialog visible={dialogVisible} onDismiss={() => setDialogVisible(false)}>
          <Dialog.Title>{editing ? "Edit Brand" : "Add Brand"}</Dialog.Title>
          <Dialog.Content>
            <TextInput
              mode="outlined"
              label="Name *"
              value={formName}
              onChangeText={setFormName}
              placeholder="e.g. Tata, ITC"
              autoFocus
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDialogVisible(false)}>Cancel</Button>
            <Button onPress={handleSave} loading={saving} disabled={saving}>
              {editing ? "Update" : "Create"}
            </Button>
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
