import React, { useState, useMemo } from "react";
import { View, FlatList, Pressable, Text, TextInput } from "react-native";
import { useTheme } from "react-native-paper";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAuth } from "../../src/lib/auth-context";
import { useModuleVisibility } from "../../src/lib/useModuleVisibility";
import { type ModuleItem } from "../../src/lib/moduleCategories";
import { useTopInset } from "../../src/lib/useTopInset";
import EmptyState from "../../src/components/EmptyState";

export default function GlobalSearchScreen() {
 const { userRole } = useAuth();
 const { getVisibleCategories } = useModuleVisibility(userRole);
 const router = useRouter();
 const topInset = useTopInset();
 const theme = useTheme();
 const [query, setQuery] = useState("");

 const allModules = useMemo(() => {
 const cats = getVisibleCategories();
 return cats.flatMap((cat) => cat.children);
 }, [getVisibleCategories]);

 const filtered = useMemo(() => {
 if (!query.trim()) return [];
 const q = query.toLowerCase();
 return allModules.filter(
 (m) => m.label.toLowerCase().includes(q) || m.desc.toLowerCase().includes(q) || m.key.toLowerCase().includes(q)
 );
 }, [query, allModules]);

 const recentModules = useMemo(() => allModules.slice(0, 8), [allModules]);

 return (
 <View className="flex-1 bg-background" style={{ paddingTop: topInset + 8 }}>
 <View className="flex-row items-center bg-surface-container-lowest rounded-2xl px-4 py-3 border border-outline-variant mx-4 mb-2">
 <MaterialCommunityIcons name="magnify" size={18} color="#6B7280" />
 <TextInput
 placeholder="Search modules, invoices, products..."
 onChangeText={setQuery}
 value={query}
 className="flex-1 ml-2 text-base font-medium text-on-surface"
 placeholderTextColor="#9CA3AF"
 />
 {query ? (
 <Pressable onPress={() => setQuery("")} className="p-1">
 <MaterialCommunityIcons name="close" size={16} color="#9CA3AF" />
 </Pressable>
 ) : null}
 </View>
 {query.trim() ? (
 <FlatList
 data={filtered}
 keyExtractor={(item) => item.key}
 contentContainerStyle={{ padding: 16, gap: 8 }}
 ListEmptyComponent={
 <EmptyState icon="magnify-close" title="No results found" description="Try a different word, or check the spelling." />
 }
 renderItem={({ item }: { item: ModuleItem }) => (
 <Pressable
 onPress={() => router.push(item.route as any)}
 className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-4 mb-1"
 >
 <View className="flex-row items-center" style={{ gap: 12 }}>
 <MaterialCommunityIcons name={item.icon as any} size={24} color={theme.colors.primary} />
 <View className="flex-1">
 <Text className="font-bold text-on-surface">{item.label}</Text>
 <Text className="text-xs text-on-surface-variant">{item.desc}</Text>
 </View>
 <MaterialCommunityIcons name="chevron-right" size={20} color="#9E9E9E" />
 </View>
 </Pressable>
 )}
 />
 ) : (
 <View className="px-4">
 <Text className="text-base font-bold text-on-surface-variant mb-3">Quick Access</Text>
 <View className="flex-row flex-wrap" style={{ gap: 8 }}>
 {recentModules.map((mod) => (
 <Pressable
 key={mod.key}
 onPress={() => router.push(mod.route as any)}
 className="rounded-full px-3 py-1 bg-primary/10 flex-row items-center"
 style={{ gap: 4 }}
 >
 <MaterialCommunityIcons name={mod.icon as any} size={14} color={theme.colors.primary} />
 <Text className="text-xs font-bold text-primary">{mod.label}</Text>
 </Pressable>
 ))}
 </View>
 </View>
 )}
 </View>
 );
}
