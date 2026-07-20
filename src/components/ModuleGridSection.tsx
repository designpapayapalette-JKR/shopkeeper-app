import React from "react";
import { View, Text } from "react-native";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "react-native-paper";
import IconGridItem from "./IconGridItem";
import type { ModuleItem } from "../lib/moduleCategories";

interface ModuleGridSectionProps {
  id: string;
  label: string;
  icon: string;
  items: ModuleItem[];
}

// A grouped, labeled card of module tiles — the "banking app" home-screen
// pattern from shopkeeper-mobile-design-system.md §5.2 / §6.4. Sections only
// render when they have visible items — an empty section header with
// nothing under it reads as broken, not tidy.
export default function ModuleGridSection({ id, label, icon, items }: ModuleGridSectionProps) {
  const theme = useTheme();
  const router = useRouter();

  if (items.length === 0) return null;

  return (
    <View className="mx-4 mb-3 rounded-xl bg-surface-container" style={{ padding: 14 }}>
      <View className="flex-row items-center mb-3" style={{ gap: 8 }}>
        <MaterialCommunityIcons name={icon as any} size={18} color={theme.colors.primary} />
        <Text className="font-headline-sm text-on-surface" style={{ fontSize: 15, fontWeight: "700" }}>
          {label}
        </Text>
      </View>
      <View className="flex-row flex-wrap" style={{ gap: 12, rowGap: 14 }} key={id}>
        {items.map((child) => (
          <IconGridItem
            key={child.key}
            label={child.label}
            icon={child.icon}
            onPress={() => router.push(child.route as any)}
          />
        ))}
      </View>
    </View>
  );
}
