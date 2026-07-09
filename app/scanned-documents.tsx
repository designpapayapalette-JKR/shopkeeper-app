import React, { useCallback, useEffect, useState } from "react";
import { View, Text, FlatList, Pressable, Image, Alert, Modal } from "react-native";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTopInset } from "../src/lib/useTopInset";
import { listScans, deleteScan, ScanRecord, ScanCategory } from "../src/lib/scanCapture";

const TABS: { key: ScanCategory | "all"; label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }[] = [
  { key: "all", label: "All", icon: "image-multiple-outline" },
  { key: "purchase", label: "Purchase Bills", icon: "cart-arrow-down" },
  { key: "product", label: "Products", icon: "package-variant-closed" },
  { key: "expense", label: "Expenses", icon: "receipt" },
  { key: "transfer", label: "Transfers", icon: "truck-delivery-outline" },
];

function timeAgo(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// Every photo captured through the Dashboard's Scan Hub lands here — a
// single searchable/filterable record of everything that's been scanned,
// so a capture is never a "where did that go?" one-shot action.
export default function ScannedDocumentsScreen() {
  const router = useRouter();
  const topInset = useTopInset();
  const [activeTab, setActiveTab] = useState<ScanCategory | "all">("all");
  const [records, setRecords] = useState<ScanRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewingUri, setViewingUri] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const all = await listScans();
      setRecords(all);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = activeTab === "all" ? records : records.filter((r) => r.category === activeTab);

  const handleDelete = (record: ScanRecord) => {
    Alert.alert("Delete this scan?", "This only removes the saved photo — any purchase, product, or expense already recorded stays as-is.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteScan(record.id);
          load();
        },
      },
    ]);
  };

  return (
    <View className="flex-1 bg-background dark:bg-bg-dark">
      <View
        className="bg-surface-container-lowest dark:bg-surface-dark border-b border-outline-variant dark:border-outline flex-row items-center px-margin-mobile pb-3"
        style={{ gap: 12, paddingTop: topInset }}
      >
        <Pressable onPress={() => router.back()} className="w-touch-target h-touch-target items-center justify-center -ml-2">
          <MaterialCommunityIcons name="arrow-left" size={22} color="#005f49" />
        </Pressable>
        <Text className="text-xl font-bold text-on-surface dark:text-text-primary-dark">Scanned Documents</Text>
      </View>

      <View className="flex-row px-4 py-3" style={{ gap: 8 }}>
        {TABS.map((tab) => (
          <Pressable
            key={tab.key}
            onPress={() => setActiveTab(tab.key)}
            className={`flex-1 py-2.5 rounded-xl items-center border ${
              activeTab === tab.key
                ? "bg-primary border-primary dark:bg-primary-dark"
                : "bg-surface-container-lowest dark:bg-surface-dark border-outline-variant dark:border-outline"
            }`}
          >
            <MaterialCommunityIcons name={tab.icon} size={16} color={activeTab === tab.key ? "#FFFFFF" : "#6e7a74"} />
            <Text className={`text-xs font-bold mt-1 ${activeTab === tab.key ? "text-white" : "text-on-surface-variant dark:text-text-secondary-dark"}`}>
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        columnWrapperStyle={{ gap: 12 }}
        refreshing={loading}
        onRefresh={load}
        ListEmptyComponent={
          <View className="items-center py-20">
            <MaterialCommunityIcons name="camera-outline" size={40} color="#9E9E9E" style={{ marginBottom: 12 }} />
            <Text className="text-on-surface-variant dark:text-text-secondary-dark font-semibold text-sm text-center">
              Nothing scanned yet. Use the Scan option on the Dashboard to photograph a purchase bill, product, or expense receipt.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => setViewingUri(item.uri)}
            onLongPress={() => handleDelete(item)}
            className="flex-1 bg-surface dark:bg-surface-dark rounded-2xl border border-gray-100 dark:border-zinc-800 overflow-hidden"
          >
            <Image source={{ uri: item.uri }} style={{ width: "100%", height: 130 }} resizeMode="cover" />
            <View className="px-3 py-2">
              <Text className="text-sm font-bold text-on-surface dark:text-text-primary-dark capitalize" numberOfLines={1}>
                {item.category}
              </Text>
              <Text className="text-sm text-on-surface-variant dark:text-text-secondary-dark mt-0.5">
                {timeAgo(item.createdAt)}
              </Text>
            </View>
          </Pressable>
        )}
      />

      <Modal visible={viewingUri !== null} animationType="fade" transparent onRequestClose={() => setViewingUri(null)}>
        <Pressable className="flex-1 bg-black/90 items-center justify-center" onPress={() => setViewingUri(null)}>
          {viewingUri && <Image source={{ uri: viewingUri }} style={{ width: "90%", height: "70%" }} resizeMode="contain" />}
          <Text className="text-white text-sm font-bold mt-6">Tap anywhere to close · Long-press a card to delete</Text>
        </Pressable>
      </Modal>
    </View>
  );
}

