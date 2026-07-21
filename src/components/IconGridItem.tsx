import React from "react";
import { Pressable, View, Text } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "react-native-paper";

interface IconGridItemProps {
 label: string;
 icon: string;
 onPress: () => void;
 color?: string;
 /** Overall tile width including label — keep ≥72dp per design system §6.3. */
 size?: number;
}

// A single module/action tile: icon-in-circle + label below, per
// shopkeeper-mobile-design-system.md §6.3. Never icon-only — the label is
// part of the component, not optional.
export default function IconGridItem({ label, icon, onPress, color, size = 76 }: IconGridItemProps) {
 const theme = useTheme();
 const tint = color ?? theme.colors.primary;

 return (
 <Pressable
 onPress={onPress}
 accessibilityRole="button"
 accessibilityLabel={label}
 className="items-center active:opacity-70"
 style={{ width: size }}
 hitSlop={4}
 >
 {({ pressed }) => (
 <>
 <View
 className="items-center justify-center rounded-full"
 style={{
 width: 56,
 height: 56,
 backgroundColor: pressed ? `${tint}2A` : `${tint}15`,
 }}
 >
 <MaterialCommunityIcons name={icon as any} size={24} color={tint} />
 </View>
 <Text
 className="font-label-md text-on-surface text-center mt-1.5"
 style={{ fontSize: 12, lineHeight: 15 }}
 numberOfLines={2}
 >
 {label}
 </Text>
 </>
 )}
 </Pressable>
 );
}
