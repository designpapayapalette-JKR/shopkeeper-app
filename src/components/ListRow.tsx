import React from "react";
import { Pressable, View, Text } from "react-native";
import { useTheme } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";

interface ListRowProps {
 title: string;
 subtitle?: string;
 /** Pre-formatted, e.g. "₹6,00,000" — this component never formats numbers. */
 amount?: string;
 /** success/error/neutral — colors the amount + status word, redundantly, per §4.1 ("never color alone") */
 status?: { label: string; tone: "success" | "error" | "neutral" };
 avatarLabel?: string;
 avatarColor?: string;
 onPress?: () => void;
}

// The standard repeated row for party/item/invoice lists — card, leading
// initial-circle, title + subtitle, trailing amount + status word (never
// color alone). Min height 64dp — frequently-tapped, err generous.
// shopkeeper-mobile-design-system.md §6.7.
export default function ListRow({ title, subtitle, amount, status, avatarLabel, avatarColor, onPress }: ListRowProps) {
 const theme = useTheme();
 const toneColor = status?.tone === "error" ? theme.colors.error : status?.tone === "success" ? "#2E9E5B" : theme.colors.onSurfaceVariant;

 return (
 <Pressable
 onPress={onPress}
 className="flex-row items-center bg-surface-container-lowest rounded-xl mb-2 active:opacity-80"
 style={{ minHeight: 64, paddingHorizontal: 14, paddingVertical: 10 }}
 >
 {avatarLabel && (
 <View
 className="items-center justify-center rounded-full mr-3"
 style={{ width: 40, height: 40, backgroundColor: `${avatarColor ?? theme.colors.primary}20` }}
 >
 <Text style={{ fontSize: 15, fontWeight: "700", color: avatarColor ?? theme.colors.primary }}>
 {avatarLabel}
 </Text>
 </View>
 )}
 <View className="flex-1 pr-2">
 <Text className="font-body-lg text-on-surface" style={{ fontSize: 16, fontWeight: "700" }} numberOfLines={2}>
 {title}
 </Text>
 {subtitle ? (
 <Text className="text-sm text-on-surface-variant mt-0.5" numberOfLines={1}>
 {subtitle}
 </Text>
 ) : null}
 </View>
 <View className="items-end">
 {amount ? (
 <Text className="font-numeric-emphasis" style={{ fontSize: 16, fontWeight: "700", color: toneColor }}>
 {amount}
 </Text>
 ) : null}
 {status ? (
 <View className="flex-row items-center mt-0.5" style={{ gap: 3 }}>
 {status.tone !== "neutral" && (
 <MaterialCommunityIcons
 name={status.tone === "success" ? "check-circle" : "alert-circle"}
 size={12}
 color={toneColor}
 />
 )}
 <Text style={{ fontSize: 12, fontWeight: "600", color: toneColor }}>{status.label}</Text>
 </View>
 ) : null}
 </View>
 {onPress && !amount && (
 <MaterialCommunityIcons name="chevron-right" size={20} color={theme.colors.onSurfaceVariant} />
 )}
 </Pressable>
 );
}
