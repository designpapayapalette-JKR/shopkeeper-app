import React from "react";
import { View, Text } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "react-native-paper";
import Button from "./Button";

interface EmptyStateProps {
 icon: string;
 title: string;
 description?: string;
 actionLabel?: string;
 onAction?: () => void;
}

// Genuinely-empty-data state only — never used to stand in for a permission
// gap (a hidden module renders nothing at all, not an empty state).
// shopkeeper-mobile-design-system.md §7.6.
export default function EmptyState({ icon, title, description, actionLabel, onAction }: EmptyStateProps) {
 const theme = useTheme();

 return (
 <View className="flex-1 items-center justify-center px-8" style={{ paddingVertical: 48 }}>
 <View
 className="items-center justify-center rounded-full mb-4"
 style={{ width: 72, height: 72, backgroundColor: `${theme.colors.primary}12` }}
 >
 <MaterialCommunityIcons name={icon as any} size={32} color={theme.colors.primary} />
 </View>
 <Text className="font-headline-sm text-on-surface text-center" style={{ fontSize: 17, fontWeight: "700" }}>
 {title}
 </Text>
 {description ? (
 <Text className="text-sm text-on-surface-variant text-center mt-2" style={{ lineHeight: 20 }}>
 {description}
 </Text>
 ) : null}
 {actionLabel && onAction ? (
 <View className="mt-5 w-full" style={{ maxWidth: 260 }}>
 <Button title={actionLabel} onPress={onAction} />
 </View>
 ) : null}
 </View>
 );
}
