import React, { useCallback, useEffect, useState } from "react";
import { View, Text, FlatList, ActivityIndicator, Pressable, Alert } from "react-native";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAuth } from "../src/lib/auth-context";
import { api } from "../src/lib/api";
import { useConfirm } from "../src/components/ConfirmDialog";
import { useTopInset } from "../src/lib/useTopInset";

type Kind = "products" | "parties" | "invoices";

interface DeletedItem {
  id: string;
  label: string;
  deleted_at: string;
}

const KINDS: { key: Kind; label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap; labelField: string }[] = [
  { key: "products", label: "Products", icon: "package-variant", labelField: "name" },
  { key: "parties", label: "Parties", icon: "account-group-outline", labelField: "name" },
  { key: "invoices", label: "Invoices", icon: "receipt", labelField: "invoice_number" },
];

export default function RecycleBinScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const confirm = useConfirm();
  const topInset = useTopInset();
  const [activeKind, setActiveKind] = useState<Kind>("products");
  const [items, setItems] = useState<DeletedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.company_id) return;
    setLoading(true);
    try {
      const kindMeta = KINDS.find((k) => k.key === activeKind)!;
      const res = await api.get<{ data: any[] }>(`/${activeKind}/recycle-bin/list`);
      setItems(
        (res.data ?? []).map((row) => ({
          id: row.id,
          label: row[kindMeta.labelField] ?? "(untitled)",
          deleted_at: row.deleted_at,
        }))
      );
    } catch (e) {
      console.error("Failed to load recycle bin:", e);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [user, activeKind]);

  useEffect(() => {
    load();
  }, [load]);

  const handleRestore = async (item: DeletedItem) => {
    const ok = await confirm({
      title: "Restore this item?",
      message: `"${item.label}" will be restored and visible again in ${activeKind}.`,
      confirmLabel: "Restore",
    });
    if (!ok || !user?.company_id) return;

    setRestoringId(item.id);
    try {
      await api.post(`/${activeKind}/${item.id}/restore`);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
    } catch (e) {
      console.error("Failed to restore item:", e);
      Alert.alert("Restore Failed", "Could not restore this item. Please try again.");
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <View className="flex-1 bg-background dark:bg-bg-dark">
      <View className="bg-surface-container-lowest dark:bg-surface-dark border-b border-outline-variant dark:border-outline flex-row items-center px-margin-mobile pb-3" style={{ gap: 12, paddingTop: topInset }}>
        <Pressable onPress={() => router.back()} className="w-touch-target h-touch-target items-center justify-center -ml-2">
          <MaterialCommunityIcons name="arrow-left" size={22} color="#005f49" />
        </Pressable>
        <Text className="font-headline-md text-headline-md text-on-surface dark:text-text-primary-dark">
          Recycle Bin
        </Text>
      </View>

      <View className="flex-row px-margin-mobile pt-sm" style={{ gap: 8 }}>
        {KINDS.map((k) => (
          <Pressable
            key={k.key}
            onPress={() => setActiveKind(k.key)}
            className={`flex-1 py-2 rounded-full items-center border ${
              activeKind === k.key
                ? "bg-primary border-primary"
                : "bg-surface-container-lowest dark:bg-surface-dark border-outline-variant dark:border-outline"
            }`}
          >
            <Text
              className={`font-label-md text-label-md ${
                activeKind === k.key ? "text-on-primary" : "text-on-surface-variant dark:text-text-secondary-dark"
              }`}
            >
              {k.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#0F7A5F" />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          ListEmptyComponent={
            <View className="items-center py-24">
              <MaterialCommunityIcons name="trash-can-outline" size={40} color="#6e7a74" style={{ marginBottom: 12 }} />
              <Text className="font-body-md text-body-md text-on-surface-variant dark:text-text-secondary-dark">
                Nothing deleted here.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View className="bg-surface-container-lowest dark:bg-surface-dark rounded-xl border border-outline-variant dark:border-outline p-md flex-row items-center justify-between">
              <View className="flex-1 mr-3">
                <Text className="font-body-md text-body-md text-on-surface dark:text-text-primary-dark font-semibold" numberOfLines={1}>
                  {item.label}
                </Text>
                <Text className="font-caption text-caption text-on-surface-variant dark:text-text-secondary-dark">
                  Deleted {new Date(item.deleted_at).toLocaleDateString()}
                </Text>
              </View>
              <Pressable
                onPress={() => handleRestore(item)}
                disabled={restoringId === item.id}
                className="flex-row items-center bg-primary/10 dark:bg-primary-dark/10 px-3 py-2 rounded-lg"
                style={{ gap: 4 }}
              >
                {restoringId === item.id ? (
                  <ActivityIndicator size="small" color="#005f49" />
                ) : (
                  <>
                    <MaterialCommunityIcons name="backup-restore" size={16} color="#005f49" />
                    <Text className="text-primary dark:text-primary-dark font-label-md text-label-md">Restore</Text>
                  </>
                )}
              </Pressable>
            </View>
          )}
        />
      )}
    </View>
  );
}

