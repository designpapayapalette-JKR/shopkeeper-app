import React, { useCallback, useEffect, useState } from "react";
import { View, Text, FlatList, ActivityIndicator, Pressable, Alert, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "react-native-paper";
import { api } from "../src/lib/api";
import { useTopInset, useBottomInset } from "../src/lib/useTopInset";
import EmptyState from "../src/components/EmptyState";

interface NotificationItem {
 id: string;
 title: string;
 body: string;
 type: string;
 is_read: boolean;
 created_at: string;
 data?: any;
}

const TYPE_ICONS: Record<string, keyof typeof MaterialCommunityIcons.glyphMap> = {
 order: "package-variant-closed",
 invoice: "receipt",
 payment: "bank-transfer",
 alert: "alert-circle",
 warning: "alert-outline",
 info: "information-outline",
 promotion: "brightness-percent",
 system: "cog-outline",
 reminder: "bell-ring-outline",
 update: "update",
};

const TYPE_DEFAULT_ICON: keyof typeof MaterialCommunityIcons.glyphMap = "bell-outline";

function getTypeIcon(type: string): keyof typeof MaterialCommunityIcons.glyphMap {
 return TYPE_ICONS[type] || TYPE_DEFAULT_ICON;
}

function timeAgo(iso: string): string {
 const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
 if (mins < 1) return "just now";
 if (mins < 60) return `${mins}m ago`;
 const hours = Math.floor(mins / 60);
 if (hours < 24) return `${hours}h ago`;
 const days = Math.floor(hours / 24);
 if (days < 30) return `${days}d ago`;
 return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export default function NotificationsScreen() {
 const router = useRouter();
 const topInset = useTopInset();
 const bottomInset = useBottomInset();
 const theme = useTheme();

 const [items, setItems] = useState<NotificationItem[]>([]);
 const [loading, setLoading] = useState(true);
 const [refreshing, setRefreshing] = useState(false);
 const [markingId, setMarkingId] = useState<string | null>(null);

 const showAlert = (message: string) => Alert.alert("", message);

 const load = useCallback(async () => {
 setLoading(true);
 try {
 const res = await api.get<{ data: NotificationItem[] }>("/notifications");
 setItems(res.data ?? []);
 } catch {
 setItems([]);
 } finally {
 setLoading(false);
 }
 }, []);

 const onRefresh = useCallback(async () => {
 setRefreshing(true);
 try {
 await load();
 } finally {
 setRefreshing(false);
 }
 }, [load]);

 useEffect(() => {
 load();
 }, [load]);

 const handleMarkRead = async (id: string) => {
 if (markingId) return;
 setMarkingId(id);
 try {
 await api.patch(`/notifications/${id}/read`);
 setItems((prev) =>
 prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
 );
 } catch {
 showAlert("Failed to mark as read");
 } finally {
 setMarkingId(null);
 }
 };

 const handleMarkAllRead = async () => {
 try {
 await api.post("/notifications/read-all");
 setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
 showAlert("All notifications marked as read");
 } catch {
 showAlert("Failed to mark all as read");
 }
 };

 const handleDelete = (item: NotificationItem) => {
 Alert.alert("Delete notification?", `"${item.title}" will be permanently removed.`, [
 { text: "Cancel", style: "cancel" },
 {
 text: "Delete",
 style: "destructive",
 onPress: async () => {
 try {
 await api.delete(`/notifications/${item.id}`);
 setItems((prev) => prev.filter((n) => n.id !== item.id));
 showAlert("Notification deleted");
 } catch {
 showAlert("Failed to delete notification");
 }
 },
 },
 ]);
 };

 const handleClearAll = () => {
 Alert.alert("Clear all notifications?", "All notifications will be permanently removed. This cannot be undone.", [
 { text: "Cancel", style: "cancel" },
 {
 text: "Clear All",
 style: "destructive",
 onPress: async () => {
 try {
 await api.delete("/notifications/clear-all");
 setItems([]);
 showAlert("All notifications cleared");
 } catch {
 showAlert("Failed to clear notifications");
 }
 },
 },
 ]);
 };

 const unreadCount = items.filter((n) => !n.is_read).length;

 const renderItem = ({ item }: { item: NotificationItem }) => {
 const iconName = getTypeIcon(item.type);

 return (
 <Pressable
 onPress={() => !item.is_read && handleMarkRead(item.id)}
 onLongPress={() => handleDelete(item)}
 className="active:opacity-80"
 >
 <View
 className={`mb-3 rounded-2xl p-4 mx-4 border ${item.is_read ? "bg-surface-container-lowest border-outline-variant" : "bg-primary-container border-transparent"}`}
 >
 <Pressable onPress={() => handleDelete(item)} className="absolute top-3 right-3 z-10 p-1">
 <MaterialCommunityIcons name="close" size={16} color={theme.colors.onSurfaceVariant} />
 </Pressable>

 <View className="flex-row pr-6" style={{ gap: 12 }}>
 <View
 className="w-10 h-10 rounded-full items-center justify-center"
 style={{ backgroundColor: item.is_read ? theme.colors.surfaceVariant : theme.colors.primaryContainer }}
 >
 <MaterialCommunityIcons
 name={iconName}
 size={20}
 color={item.is_read ? theme.colors.onSurfaceVariant : theme.colors.primary}
 />
 </View>

 <View className="flex-1" style={{ gap: 2 }}>
 <View className="flex-row items-center" style={{ gap: 8 }}>
 <Text
 className={`flex-1 font-label-md text-label-md ${item.is_read ? "text-on-surface " : "text-on-surface font-bold"}`}
 numberOfLines={1}
 >
 {item.title}
 </Text>
 {!item.is_read && (
 <View className="w-2.5 h-2.5 rounded-full bg-primary" />
 )}
 </View>

 <Text
 className="font-body-md text-body-md text-on-surface-variant "
 numberOfLines={2}
 >
 {item.body}
 </Text>

 <Text className="font-caption text-caption text-outline mt-1">
 {timeAgo(item.created_at)}
 </Text>
 </View>
 </View>
 </View>
 </Pressable>
 );
 };

 return (
 <View className="flex-1 bg-background ">
 <View
 className="bg-surface-container-lowest border-b border-outline-variant flex-row items-center px-margin-mobile pb-3"
 style={{ gap: 12, paddingTop: topInset }}
 >
 <Pressable onPress={() => router.back()} className="w-touch-target h-touch-target items-center justify-center -ml-2">
 <MaterialCommunityIcons name="arrow-left" size={22} color={theme.colors.primary} />
 </Pressable>
 <Text className="font-headline-md text-headline-md text-on-surface flex-1">
 Notifications
 </Text>

 {unreadCount > 0 && (
 <Pressable
 onPress={handleMarkAllRead}
 className="bg-primary/10 px-3 py-2 rounded-lg flex-row items-center"
 style={{ gap: 4 }}
 >
 <MaterialCommunityIcons name="check-all" size={16} color={theme.colors.primary} />
 <Text className="text-primary font-label-md text-label-md">Mark All Read</Text>
 </Pressable>
 )}

 {items.length > 0 && (
 <Pressable
 onPress={handleClearAll}
 className="flex-row items-center px-3 py-2 rounded-lg"
 style={{ gap: 4 }}
 >
 <MaterialCommunityIcons name="delete-sweep-outline" size={16} color={theme.colors.error} />
 <Text className="text-error font-label-md text-label-md">Clear All</Text>
 </Pressable>
 )}
 </View>

 {loading ? (
 <View className="flex-1 items-center justify-center">
 <ActivityIndicator size="large" color={theme.colors.primary} />
 </View>
 ) : (
 <FlatList
 data={items}
 keyExtractor={(item) => item.id}
 renderItem={renderItem}
 refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
 contentContainerStyle={{
 paddingTop: 16,
 paddingBottom: bottomInset + 24,
 }}
 ListEmptyComponent={
 <EmptyState icon="bell-off-outline" title="No notifications yet" description="Updates and alerts will appear here." />
 }
 />
 )}
 </View>
 );
}
