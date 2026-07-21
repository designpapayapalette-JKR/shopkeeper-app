import React, { useState, useCallback } from "react";
import { View, ScrollView, ActivityIndicator, RefreshControl, Text } from "react-native";
import { useTheme } from "react-native-paper";
import { useFocusEffect } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { api } from "../src/lib/api";
import { useAuth } from "../src/lib/auth-context";
import { useTopInset } from "../src/lib/useTopInset";
import { roleColor } from "../src/lib/roles";
import EmptyState from "../src/components/EmptyState";

function timeAgo(iso: string): string {
 const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
 if (mins < 1) return "just now";
 if (mins < 60) return `${mins}m ago`;
 const hours = Math.floor(mins / 60);
 if (hours < 24) return `${hours}h ago`;
 return `${Math.floor(hours / 24)}d ago`;
}

export default function LiveActivityScreen() {
 const theme = useTheme();
 const { userRole } = useAuth();
 const topInset = useTopInset();
 const [activities, setActivities] = useState<any[]>([]);
 const [loading, setLoading] = useState(true);
 const [refreshing, setRefreshing] = useState(false);

 const fetchData = useCallback(async () => {
 try {
 const res = await api.get<{ data: any[] }>("/activity-log", { params: { limit: 50 } });
 setActivities(res.data ?? []);
 } catch {}
 finally { setLoading(false); setRefreshing(false); }
 }, []);

 useFocusEffect(useCallback(() => {
 setLoading(true);
 fetchData();
 }, [fetchData]));

 return (
 <ScrollView
 className="flex-1 bg-background"
 contentContainerStyle={{ paddingTop: topInset + 16, paddingBottom: 32 }}
 refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} />}
 >
 <Text className="font-headline-md text-on-surface px-4 mb-4" style={{ fontSize: 22, fontWeight: "700" }}>
 Live Activity
 </Text>

 {loading ? (
 <View className="py-20 items-center">
 <ActivityIndicator size="large" color={theme.colors.primary} />
 </View>
 ) : activities.length === 0 ? (
 <EmptyState icon="animation" title="No activity yet" description="Staff actions will appear here in real time." />
 ) : (
 <View className="px-4">
 {activities.map((item: any, idx: number) => (
 <View key={item.id || idx} className="flex-row items-start mb-3" style={{ gap: 10 }}>
 <View className="w-8 h-8 rounded-full bg-surface-container items-center justify-center">
 <MaterialCommunityIcons name="circle-small" size={20} color={roleColor(userRole)} />
 </View>
 <View className="flex-1 bg-surface-container-lowest rounded-xl p-3">
 <Text className="text-sm text-on-surface">
 <Text className="font-bold">{item.user_name || "Someone"}</Text>
 {" "}{item.action || "did something"}
 </Text>
 {item.details && (
 <Text className="text-xs text-on-surface-variant mt-1">{item.details}</Text>
 )}
 <Text className="text-xs text-on-surface-variant mt-1">{timeAgo(item.created_at || item.createdAt)}</Text>
 </View>
 </View>
 ))}
 </View>
 )}
 </ScrollView>
 );
}
