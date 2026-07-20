import React, { useEffect, useState, useCallback } from "react";
import { View, Text, FlatList, ActivityIndicator, Pressable, TextInput, Alert, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { useTheme } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { api } from "../src/lib/api";
import { useTopInset } from "../src/lib/useTopInset";
import { useBottomInset } from "../src/lib/useBottomInset";
import { getAvatarColor, getInitial } from "../src/lib/avatarColor";

interface UnifiedEntry {
  id: string;
  date: string;
  type: "debit" | "credit";
  amount: string;
  reference: string;
  party: { id: string; name: string; type: string };
}

type PartyFilter = "all" | "customer" | "supplier";

const PAGE_SIZE = 50;

export default function UnifiedLedgerScreen() {
  const theme = useTheme();
  const router = useRouter();
  const topInset = useTopInset();
  const bottomInset = useBottomInset();
  const [entries, setEntries] = useState<UnifiedEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [partyFilter, setPartyFilter] = useState<PartyFilter>("all");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchAll = async (pageNum = 1, append = false) => {
    if (!append) { setPage(1); setLoading(true); }
    try {
      const res = await api.get<{ data: UnifiedEntry[] }>("/ledger/unified/all", { params: { page: pageNum, limit: PAGE_SIZE } });
      if (append) {
        setEntries(prev => [...prev, ...(res.data ?? [])]);
      } else {
        setEntries(res.data ?? []);
      }
      setHasMore((res.data ?? []).length >= PAGE_SIZE);
    } catch (e) {
      console.error("Failed to load unified ledger:", e);
      Alert.alert("Error", "Could not load ledger entries. Please try again.");
      setEntries([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  };

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    await fetchAll(page + 1, true);
    setPage(p => p + 1);
  }, [loadingMore, hasMore, page]);

  useEffect(() => {
    fetchAll();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setPage(1);
    try { await fetchAll(); } finally { setRefreshing(false); }
  }, []);

  const filtered = entries.filter((e) => {
    if (partyFilter !== "all" && e.party.type !== partyFilter) return false;
    if (search && !e.party.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <View className="flex-1 bg-background dark:bg-bg-dark px-6" style={{ paddingTop: topInset }}>
      {/* Header */}
      <View className="flex-row items-center mb-6" style={{ gap: 10 }}>
        <Pressable
          onPress={() => router.back()}
          className="w-10 h-10 rounded-full bg-surface-container dark:bg-surface-dark items-center justify-center"
        >
          <MaterialCommunityIcons name="arrow-left" size={20} color={theme.colors.onSurfaceVariant} />
        </Pressable>
        <View>
          <Text className="text-2xl font-bold text-on-surface dark:text-text-primary-dark">
            All Ledger
          </Text>
          <Text className="text-sm text-on-surface-variant dark:text-text-secondary-dark font-medium mt-0.5">
            Every transaction across every party
          </Text>
        </View>
      </View>

      {/* Search */}
      <View className="bg-surface-container-lowest dark:bg-surface-dark border border-outline-variant dark:border-outline rounded-xl px-4 py-4 mb-4">
        <TextInput
          placeholder="Search by party name..."
          placeholderTextColor="#A0A0A0"
          value={search}
          onChangeText={setSearch}
          className="text-base font-medium text-on-surface dark:text-text-primary-dark"
        />
      </View>

      {/* Party type filter */}
      <View className="flex-row bg-surface-container-lowest dark:bg-surface-dark border border-outline-variant dark:border-outline p-1.5 rounded-full mb-6">
        {(["all", "customer", "supplier"] as const).map((f) => (
          <Pressable
            key={f}
            onPress={() => setPartyFilter(f)}
            className={`flex-1 py-3 rounded-full items-center ${
              partyFilter === f ? "bg-primary dark:bg-primary-dark" : "bg-transparent"
            }`}
          >
            <Text
              className={`text-sm font-bold capitalize ${
                partyFilter === f ? "text-white" : "text-on-surface-variant dark:text-text-secondary-dark"
              }`}
            >
              {f === "all" ? "All" : `${f}s`}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* List */}
      {loading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : filtered.length === 0 ? (
        <View className="flex-1 justify-center items-center py-20">
          <Text className="text-on-surface-variant dark:text-text-secondary-dark font-bold text-base text-center">
            No ledger entries found
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={loadingMore ? <View className="py-4"><ActivityIndicator size="small" color={theme.colors.primary} /></View> : !hasMore && entries.length > 0 ? <View className="py-4"><Text className="text-center text-sm text-on-surface-variant dark:text-text-secondary-dark">All entries loaded</Text></View> : null}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 24 + bottomInset }}
          renderItem={({ item }) => {
            const isDebit = item.type === "debit";
            const avatarColor = getAvatarColor(item.party.name);
            return (
              <Pressable
                onPress={() =>
                  router.push(`/ledger?openPartyId=${item.party.id}&openPartyType=${item.party.type}` as any)
                }
                className="bg-surface-container-lowest dark:bg-surface-dark p-4 rounded-2xl border border-outline-variant dark:border-outline shadow-sm mb-3 flex-row items-center active:bg-surface-container dark:active:bg-zinc-800"
              >
                <View
                  className="w-11 h-11 rounded-xl items-center justify-center mr-3"
                  style={{ backgroundColor: avatarColor.bg }}
                >
                  <Text className="font-black text-base" style={{ color: avatarColor.text }}>
                    {getInitial(item.party.name)}
                  </Text>
                </View>
                <View className="flex-1 mr-2">
                  <Text className="font-bold text-base text-on-surface dark:text-text-primary-dark" numberOfLines={1}>
                    {item.party.name}
                  </Text>
                  <Text className="text-sm text-on-surface-variant dark:text-text-secondary-dark mt-0.5" numberOfLines={1}>
                    {item.reference || "Ledger Entry"} · {item.date}
                  </Text>
                </View>
                <View className="items-end">
                  <Text className={`text-base font-black ${isDebit ? "text-error" : "text-success"}`}>
                    {isDebit ? "+" : "-"} ₹{parseFloat(item.amount).toFixed(2)}
                  </Text>
                  <Text className="text-xs font-bold text-on-surface-variant dark:text-text-secondary-dark mt-0.5 uppercase tracking-widest">
                    {item.party.type}
                  </Text>
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

