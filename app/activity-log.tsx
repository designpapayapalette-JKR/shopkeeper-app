import React, { useCallback, useEffect, useState } from "react";
import { View, Text, FlatList, ActivityIndicator, Pressable, RefreshControl, Modal, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAuth } from "../src/lib/auth-context";
import { api } from "../src/lib/api";
import { useTopInset } from "../src/lib/useTopInset";
import { useBottomInset } from "../src/lib/useBottomInset";

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
  update: { icon: "pencil-outline", color: "#3B7DD8", verb: "updated" },
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

export default function ActivityLogScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const topInset = useTopInset();
  const bottomInset = useBottomInset();
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [detailEntry, setDetailEntry] = useState<LogEntry | null>(null);

  const load = useCallback(async () => {
    if (!user?.company_id) return;
    try {
      const res = await api.get<{ data: LogEntry[] }>("/activity-log");
      setEntries(res.data ?? []);
    } catch (e) {
      console.error("Failed to load activity log:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <View className="flex-1 bg-background dark:bg-bg-dark">
      <View className="bg-surface-container-lowest dark:bg-surface-dark border-b border-outline-variant dark:border-outline flex-row items-center px-margin-mobile pb-3" style={{ gap: 12, paddingTop: topInset }}>
        <Pressable onPress={() => router.back()} className="w-touch-target h-touch-target items-center justify-center -ml-2">
          <MaterialCommunityIcons name="arrow-left" size={22} color="#005f49" />
        </Pressable>
        <Text className="font-headline-md text-headline-md text-on-surface dark:text-text-primary-dark">
          Activity Log
        </Text>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#0F7A5F" />
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item) => item.id}
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
              <MaterialCommunityIcons name="history" size={40} color="#6e7a74" style={{ marginBottom: 12 }} />
              <Text className="font-body-md text-body-md text-on-surface-variant dark:text-text-secondary-dark">
                No activity recorded yet.
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
                <MaterialCommunityIcons name="chevron-right" size={18} color="#9E9E9E" />
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
                    <MaterialCommunityIcons name="close" size={20} color="#6B7280" />
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

