import React from "react";
import { Pressable, Text, View } from "react-native";
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

// A single module/action tile: soft pastel-tinted square + colored icon +
// label below. Previously a bold two-stop gradient with a white icon; moved
// to a lighter, banking-app-style pastel background per user reference
// (colored icon on a tinted background of the same hue, not a vivid filled
// circle) — reads calmer across a whole grid of 8-12 tiles at once.
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
            style={{
              width: 56,
              height: 56,
              borderRadius: 18,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: `${tint}1F`,
              opacity: pressed ? 0.7 : 1,
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
