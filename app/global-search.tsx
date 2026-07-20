import React, { useState, useMemo } from "react";
import { View, FlatList, Pressable, Text } from "react-native";
import { Searchbar, Card, Chip, useTheme } from "react-native-paper";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAuth } from "../src/lib/auth-context";
import { useModuleVisibility } from "../src/lib/useModuleVisibility";
import { type ModuleItem } from "../src/lib/moduleCategories";
import { useTopInset } from "../src/lib/useTopInset";

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
      <Searchbar
        placeholder="Search modules, invoices, products..."
        onChangeText={setQuery}
        value={query}
        className="mx-4 mb-2"
        elevation={1}
        inputStyle={{ fontSize: 14 }}
      />
      {query.trim() ? (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.key}
          contentContainerStyle={{ padding: 16, gap: 8 }}
          ListEmptyComponent={
            <View className="items-center py-20">
              <MaterialCommunityIcons name="magnify-close" size={48} color="#9E9E9E" />
              <Text className="text-base text-on-surface-variant text-center mt-4">No results found</Text>
            </View>
          }
          renderItem={({ item }: { item: ModuleItem }) => (
            <Card mode="elevated" className="mb-1" onPress={() => router.push(item.route as any)}>
              <Card.Content className="flex-row items-center" style={{ gap: 12 }}>
                <MaterialCommunityIcons name={item.icon as any} size={24} color={theme.colors.primary} />
                <View className="flex-1">
                  <Text className="font-bold text-on-surface">{item.label}</Text>
                  <Text className="text-xs text-on-surface-variant">{item.desc}</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={20} color="#9E9E9E" />
              </Card.Content>
            </Card>
          )}
        />
      ) : (
        <View className="px-4">
          <Text className="text-base font-bold text-on-surface-variant mb-3">Quick Access</Text>
          <View className="flex-row flex-wrap" style={{ gap: 8 }}>
            {recentModules.map((mod) => (
              <Chip
                key={mod.key}
                icon={mod.icon as any}
                mode="flat"
                onPress={() => router.push(mod.route as any)}
                className="mb-1"
              >
                {mod.label}
              </Chip>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}
