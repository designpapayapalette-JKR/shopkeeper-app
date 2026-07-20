import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, FlatList, ActivityIndicator, Pressable, Alert } from "react-native";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Searchbar, useTheme } from "react-native-paper";
import { useAuth } from "../src/lib/auth-context";
import { api } from "../src/lib/api";
import { useConfirm } from "../src/components/ConfirmDialog";
import { useTopInset, useBottomInset } from "../src/lib/useTopInset";

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

const PAGE_SIZE = 50;

export default function RecycleBinScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const confirm = useConfirm();
  const theme = useTheme();
  const topInset = useTopInset();
  const bottomInset = useBottomInset();
  const [activeKind, setActiveKind] = useState<Kind>("products");
  const [items, setItems] = useState<DeletedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredItems = useMemo(
    () => (searchQuery ? items.filter((i) => i.label.toLowerCase().includes(searchQuery.toLowerCase())) : items),
    [items, searchQuery],
  );

  const load = useCallback(async (pageNum = 1, append = false) => {
    if (!user?.company_id) return;
    if (!append) { setPage(1); setLoading(true); }
    try {
      const kindMeta = KINDS.find((k) => k.key === activeKind)!;
      const res = await api.get<{ data: any[] }>(`/${activeKind}/recycle-bin/list`, { params: { page: pageNum, limit: PAGE_SIZE } });
      const mapped = (res.data ?? []).map((row) => ({
        id: row.id,
        label: row[kindMeta.labelField] ?? "(untitled)",
        deleted_at: row.deleted_at,
      }));
      if (append) {
        setItems(prev => [...prev, ...mapped]);
      } else {
        setItems(mapped);
      }
      setHasMore((res.data ?? []).length >= PAGE_SIZE);
    } catch (e) {
      console.error("Failed to load recycle bin:", e);
      setItems([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [user, activeKind]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    await load(page + 1, true);
    setPage(p => p + 1);
  }, [loadingMore, hasMore, page, load]);

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
          <MaterialCommunityIcons name="arrow-left" size={22} color={theme.colors.primary} />
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

      <View className="px-margin-mobile pt-sm">
        <Searchbar
          placeholder="Search..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          className="bg-surface-container-lowest dark:bg-surface-dark border border-outline-variant dark:border-outline"
        />
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={(item) => item.id}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={loadingMore ? <View className="py-4"><ActivityIndicator size="small" color={theme.colors.primary} /></View> : !hasMore && items.length > 0 ? <View className="py-4"><Text className="text-center text-sm text-on-surface-variant dark:text-text-secondary-dark">All items loaded</Text></View> : null}
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: bottomInset + 24 }}
          ListEmptyComponent={
            <View className="items-center py-24">
              <MaterialCommunityIcons name="trash-can-outline" size={40} color={theme.colors.onSurfaceVariant} style={{ marginBottom: 12 }} />
              <Text className="font-body-md text-body-md text-on-surface-variant dark:text-text-secondary-dark">
                {searchQuery ? "No matches found." : "Nothing deleted here."}
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
                  <ActivityIndicator size="small" color={theme.colors.primary} />
                ) : (
                  <>
                    <MaterialCommunityIcons name="backup-restore" size={16} color={theme.colors.primary} />
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

