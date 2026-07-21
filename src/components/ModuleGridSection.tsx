import React from "react";
import { View, Text } from "react-native";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "react-native-paper";
import IconGridItem from "./IconGridItem";
import { CATEGORY_COLORS, type ModuleItem } from "../lib/moduleCategories";

interface ModuleGridSectionProps {
  id: string;
  label: string;
  icon: string;
  items: ModuleItem[];
}

// Category header + icon tint use the category's color from CATEGORY_COLORS
// (design-system §6) so each module group reads visually distinct at a glance.
export default function ModuleGridSection({ id, label, icon, items }: ModuleGridSectionProps) {
  const theme = useTheme();
  const router = useRouter();
  const categoryColor = CATEGORY_COLORS[id] ?? theme.colors.primary;

  if (items.length === 0) return null;

  return (
    <View className="mx-5 mb-4">
      <View className="flex-row items-center mb-2" style={{ gap: 6 }}>
        <MaterialCommunityIcons name={icon as any} size={13} color={categoryColor} />
        <Text className="text-xs font-bold uppercase tracking-wider" style={{ color: categoryColor }}>{label}</Text>
      </View>
      <View className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-4">
        <View className="flex-row flex-wrap" style={{ gap: 12, rowGap: 14 }} key={id}>
          {items.map((child) => (
            <IconGridItem
              key={child.key}
              label={child.label}
              icon={child.icon}
              color={categoryColor}
              onPress={() => router.push(child.route as any)}
            />
          ))}
        </View>
      </View>
    </View>
  );
}
