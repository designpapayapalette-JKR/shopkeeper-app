import React from "react";
import { View, Text } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "react-native-paper";
import Button from "./Button";

interface EmptyStateProps {
 icon: string;
 title: string;
 description?: string;
 actionLabel?: string;
 onAction?: () => void;
}

function darken(hex: string, factor: number): string {
 const clean = hex.replace("#", "");
 const num = parseInt(clean, 16);
 const r = Math.max(0, Math.floor(((num >> 16) & 0xff) * factor));
 const g = Math.max(0, Math.floor(((num >> 8) & 0xff) * factor));
 const b = Math.max(0, Math.floor((num & 0xff) * factor));
 return `rgb(${r}, ${g}, ${b})`;
}

// Genuinely-empty-data state only — never used to stand in for a permission
// gap (a hidden module renders nothing at all, not an empty state).
// shopkeeper-mobile-design-system.md §7.6. Icon circle uses the same
// gradient-fill treatment as IconGridItem for visual consistency
// (feedback_ui_visual_quality.md).
export default function EmptyState({ icon, title, description, actionLabel, onAction }: EmptyStateProps) {
 const theme = useTheme();
 const primary = theme.colors.primary;

 return (
 <View className="flex-1 items-center justify-center px-8" style={{ paddingVertical: 48 }}>
 <LinearGradient
 colors={[primary, darken(primary, 0.62)]}
 start={{ x: 0, y: 0 }}
 end={{ x: 1, y: 1 }}
 style={{
 width: 72,
 height: 72,
 borderRadius: 24,
 alignItems: "center",
 justifyContent: "center",
 marginBottom: 16,
 shadowColor: primary,
 shadowOffset: { width: 0, height: 4 },
 shadowOpacity: 0.25,
 shadowRadius: 10,
 elevation: 3,
 }}
 >
 <MaterialCommunityIcons name={icon as any} size={32} color="#FFFFFF" />
 </LinearGradient>
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
