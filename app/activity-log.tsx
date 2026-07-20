import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, FlatList, ActivityIndicator, Pressable, RefreshControl, Modal, ScrollView, Alert } from "react-native";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Searchbar, useTheme } from "react-native-paper";
import { useAuth } from "../src/lib/auth-context";
import { api } from "../src/lib/api";
import { useTopInset } from "../src/lib/useTopInset";
import { useBottomInset } from "../src/lib/useBottomInset";
import { shareDataAsPdf } from "../src/lib/pdfExport";

interface LogEntry {
  id: string;
  user_label: string | null;
  action: "create" | "update" | "delete" | "restore";
  entity_type: string;
  entity_id: string;
  entity_label: string | null;
  notes: string | null;
  // Full field-value snapshot at the time of the action — populated for
  // hard-deleted entities (no recycle bin) so the record can be viewed and
  // manually re-created even though it's gone for good; for updates it's
  // {before, after} so a change can actually be reviewed.
  detail: Record<string, unknown> | { before: Record<string, unknown>; after: Record<string, unknown> } | null;
  created_at: string;
}

// Renders an arbitrary snapshot object as a readable key/value list —
// there's no fixed shape since this can be a product, warehouse, brand,
// party, etc., so this just formats whatever fields exist.
function DetailFields({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data).filter(
    ([key]) => !["id", "companyId", "createdAt", "updatedAt", "deletedAt"].includes(key)
  );
  if (entries.length === 0) {
    return (
      <Text className="text-sm text-on-surface-variant dark:text-text-secondary-dark">No details recorded.</Text>
    );
  }
  return (
    <View style={{ gap: 8 }}>
      {entries.map(([key, value]) => (
        <View key={key} className="flex-row justify-between" style={{ gap: 12 }}>
          <Text className="text-sm font-semibold text-on-surface-variant dark:text-text-secondary-dark" style={{ flex: 1 }}>
            {key}
          </Text>
          <Text className="text-sm text-on-surface dark:text-text-primary-dark" style={{ flex: 1, textAlign: "right" }}>
            {value === null || value === undefined || value === "" ? "—" : String(value)}
          </Text>
        </View>
      ))}
    </View>
  );
}

// Maps a logged entity type to the screen that can actually show it, so a
// log line like "Ramesh created party: Sharma Traders" is clickable and
// lands the user on that exact record instead of just a text description of
// something that already happened.
function navigateToEntity(router: ReturnType<typeof useRouter>, entry: LogEntry) {
  switch (entry.entity_type) {
    case "invoice":
      router.push(`/invoice-history?openInvoiceId=${entry.entity_id}` as any);
      break;
    case "party":
      router.push(`/ledger?openPartyId=${entry.entity_id}` as any);
      break;
    case "product":
      router.push(`/inventory?openProductId=${entry.entity_id}` as any);
      break;
    case "credit_note":
      router.push("/invoice-history" as any);
      break;
    case "debit_note":
      router.push("/purchase-history" as any);
      break;
    case "bank_account":
      router.push("/bank-accounts" as any);
      break;
    default:
      break;
  }
}

const ACTION_META: Record<LogEntry["action"], { icon: keyof typeof MaterialCommunityIcons.glyphMap; color: string; verb: string }> = {
  create: { icon: "plus-circle-outline", color: "#2E9E5B", verb: "created" },
  update: { icon: "pencil-outline", color: "#0368FE", verb: "updated" },
  delete: { icon: "trash-can-outline", color: "#D64545", verb: "deleted" },
  restore: { icon: "backup-restore", color: "#835400", verb: "restored" },
};

function timeAgo(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const PAGE_SIZE = 50;

export default function ActivityLogScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const theme = useTheme();
  const topInset = useTopInset();
  const bottomInset = useBottomInset();
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [detailEntry, setDetailEntry] = useState<LogEntry | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");

  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      if (actionFilter !== "all" && entry.action !== actionFilter) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        entry.user_label?.toLowerCase().includes(q) ||
        entry.entity_type.toLowerCase().includes(q) ||
        entry.entity_label?.toLowerCase().includes(q)
      );
    });
  }, [entries, searchQuery, actionFilter]);

  const FILTER_ACTIONS = ["all", "create", "update", "delete", "restore"] as const;

  const load = useCallback(async (pageNum = 1, append = false) => {
    try {
      if (!user?.company_id) {
        setEntries([]);
        return;
      }
      if (!append) setLoading(true);
      const res = await api.get<{ data: LogEntry[] }>("/activity-log", { params: { page: pageNum, limit: PAGE_SIZE } });
      if (append) {
        setEntries(prev => [...prev, ...(res.data ?? [])]);
      } else {
        setEntries(res.data ?? []);
      }
      setHasMore((res.data ?? []).length >= PAGE_SIZE);
    } catch (e) {
      console.error("Failed to load activity log:", e);
      Alert.alert("Error", "Could not load activity log. Please try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [user]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    await load(page + 1, true);
    setPage(p => p + 1);
  }, [loadingMore, hasMore, page, load]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <View className="flex-1 bg-background dark:bg-bg-dark">
      <View className="bg-surface-container-lowest dark:bg-surface-dark border-b border-outline-variant dark:border-outline flex-row items-center justify-between px-margin-mobile pb-3" style={{ gap: 12, paddingTop: topInset }}>
        <View className="flex-row items-center" style={{ gap: 12 }}>
          <Pressable onPress={() => router.back()} className="w-touch-target h-touch-target items-center justify-center -ml-2">
            <MaterialCommunityIcons name="arrow-left" size={22} color={theme.colors.primary} />
          </Pressable>
          <Text className="font-headline-md text-headline-md text-on-surface dark:text-text-primary-dark">
            Activity Log
          </Text>
        </View>
        <Pressable onPress={() => {
          const headers = ["User", "Action", "Entity", "Label", "Date"];
          const rows = entries.map((e) => [e.user_label || "—", e.action, e.entity_type, e.entity_label || "—", new Date(e.created_at).toLocaleDateString("en-IN")]);
          shareDataAsPdf("Activity Log", headers, rows, "activity-log.pdf");
        }} className="flex-row items-center gap-1 bg-primary px-3 py-2 rounded-lg">
          <MaterialCommunityIcons name="file-pdf-box" size={16} color="white" />
          <Text className="text-xs font-bold text-white">Export</Text>
        </Pressable>
      </View>

      <View className="px-margin-mobile pt-2 pb-1" style={{ gap: 8 }}>
        <Searchbar
          placeholder="Search activity…"
          value={searchQuery}
          onChangeText={setSearchQuery}
          onClearIconPress={() => setSearchQuery("")}
          elevation={0}
          inputStyle={{ fontSize: 14 }}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {FILTER_ACTIONS.map((a) => {
            const isAll = a === "all";
            const color = isAll ? theme.colors.primary : ACTION_META[a].color;
            const selected = actionFilter === a;
            return (
              <Pressable
                key={a}
                onPress={() => setActionFilter(a)}
                className="px-3 py-1.5 rounded-full"
                style={{
                  backgroundColor: selected ? color : "transparent",
                  borderWidth: 1,
                  borderColor: color,
                }}
              >
                <Text
                  className="text-sm font-medium"
                  style={{ color: selected ? "#FFFFFF" : color }}
                >
                  {isAll ? "All" : a.charAt(0).toUpperCase() + a.slice(1)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filteredEntries}
          keyExtractor={(item) => item.id}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={loadingMore ? <View className="py-4"><ActivityIndicator size="small" color={theme.colors.primary} /></View> : !hasMore && filteredEntries.length > 0 ? <View className="py-4"><Text className="text-center text-sm text-on-surface-variant dark:text-text-secondary-dark">All entries loaded</Text></View> : null}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
            />
          }
          ListEmptyComponent={
            <View className="items-center py-24">
              <MaterialCommunityIcons name={searchQuery || actionFilter !== "all" ? "magnify-close" : "history"} size={40} color={theme.colors.outline} style={{ marginBottom: 12 }} />
              <Text className="font-body-md text-body-md text-on-surface-variant dark:text-text-secondary-dark">
                {searchQuery || actionFilter !== "all" ? "No matching activity found." : "No activity recorded yet."}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const meta = ACTION_META[item.action];
            return (
              <Pressable
                onPress={() => setDetailEntry(item)}
                className="bg-surface-container-lowest dark:bg-surface-dark rounded-xl border border-outline-variant dark:border-outline p-md flex-row items-center active:opacity-70"
                style={{ gap: 12 }}
              >
                <View className="w-8 h-8 rounded-full items-center justify-center" style={{ backgroundColor: `${meta.color}1A` }}>
                  <MaterialCommunityIcons name={meta.icon} size={16} color={meta.color} />
                </View>
                <View className="flex-1">
                  <Text className="font-body-md text-body-md text-on-surface dark:text-text-primary-dark">
                    <Text className="font-semibold">{item.user_label ?? "Someone"}</Text> {meta.verb}{" "}
                    <Text className="font-semibold">{item.entity_type}</Text>: {item.entity_label}
                  </Text>
                  {item.notes && (
                    <Text className="font-caption text-caption text-on-surface-variant dark:text-text-secondary-dark mt-1">
                      {item.notes}
                    </Text>
                  )}
                  <Text className="font-caption text-caption text-on-surface-variant dark:text-text-secondary-dark mt-1">
                    {timeAgo(item.created_at)}
                  </Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={18} color={theme.colors.onSurfaceVariant} />
              </Pressable>
            );
          }}
        />
      )}

      <Modal
        visible={!!detailEntry}
        animationType="slide"
        transparent
        onRequestClose={() => setDetailEntry(null)}
      >
        <View className="flex-1 justify-end bg-black/40">
          <View
            className="bg-background dark:bg-bg-dark rounded-t-3xl px-6 pt-6"
            style={{ paddingBottom: bottomInset + 24, maxHeight: "80%" }}
          >
            {detailEntry && (
              <>
                <View className="flex-row justify-between items-center mb-2">
                  <Text className="text-xl font-bold text-on-surface dark:text-text-primary-dark" style={{ flex: 1 }}>
                    {ACTION_META[detailEntry.action].verb.charAt(0).toUpperCase() + ACTION_META[detailEntry.action].verb.slice(1)}
                    {" "}{detailEntry.entity_type}
                  </Text>
                  <Pressable onPress={() => setDetailEntry(null)} className="w-10 h-10 items-center justify-center">
                    <MaterialCommunityIcons name="close" size={20} color={theme.colors.onSurfaceVariant} />
                  </Pressable>
                </View>
                <Text className="text-sm text-on-surface-variant dark:text-text-secondary-dark mb-1">
                  {detailEntry.entity_label} · by {detailEntry.user_label ?? "Someone"} · {timeAgo(detailEntry.created_at)}
                </Text>
                {detailEntry.notes && (
                  <Text className="text-sm text-on-surface-variant dark:text-text-secondary-dark mb-3">{detailEntry.notes}</Text>
                )}
                <ScrollView style={{ marginTop: 12 }} contentContainerStyle={{ paddingBottom: 8 }}>
                  {detailEntry.detail && "before" in detailEntry.detail ? (
                    <View style={{ gap: 16 }}>
                      <View>
                        <Text className="text-sm font-bold text-on-surface dark:text-text-primary-dark mb-2">Before</Text>
                        <DetailFields data={(detailEntry.detail as any).before ?? {}} />
                      </View>
                      <View>
                        <Text className="text-sm font-bold text-on-surface dark:text-text-primary-dark mb-2">After</Text>
                        <DetailFields data={(detailEntry.detail as any).after ?? {}} />
                      </View>
                    </View>
                  ) : (
                    <DetailFields data={(detailEntry.detail as Record<string, unknown>) ?? {}} />
                  )}
                </ScrollView>
                {detailEntry.action !== "delete" && (
                  <Pressable
                    onPress={() => {
                      const entry = detailEntry;
                      setDetailEntry(null);
                      navigateToEntity(router, entry);
                    }}
                    className="bg-primary dark:bg-primary-dark py-4 rounded-xl items-center mt-4"
                  >
                    <Text className="text-white font-bold text-base">View Record</Text>
                  </Pressable>
                )}
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

