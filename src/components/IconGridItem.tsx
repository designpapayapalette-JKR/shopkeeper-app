import React from "react";
import { Pressable, Text } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "react-native-paper";

interface IconGridItemProps {
  label: string;
  icon: string;
  onPress: () => void;
  color?: string;
  /** Overall tile width including label — keep ≥72dp per design system §6.3. */
  size?: number;
}

// Darkens a hex color for the second gradient stop — e.g. "#0368FE" -> a
// deeper navy-blue shade, so the circle reads as a real gradient rather than
// a flat tint. Simple channel-multiply, no color library needed.
function darken(hex: string, factor: number): string {
  const clean = hex.replace("#", "");
  const num = parseInt(clean, 16);
  const r = Math.max(0, Math.floor(((num >> 16) & 0xff) * factor));
  const g = Math.max(0, Math.floor(((num >> 8) & 0xff) * factor));
  const b = Math.max(0, Math.floor((num & 0xff) * factor));
  return `rgb(${r}, ${g}, ${b})`;
}

// A single module/action tile: gradient-filled icon circle + label below.
// Previously a flat 15%-opacity tint circle with a colored icon — replaced
// with a real two-stop gradient + white icon + soft shadow per user
// feedback that the earlier look read as boring (feedback_ui_visual_quality.md).
// Never icon-only — the label is part of the component, not optional.
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
          <LinearGradient
            colors={[tint, darken(tint, 0.62)]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              width: 56,
              height: 56,
              borderRadius: 18,
              alignItems: "center",
              justifyContent: "center",
              opacity: pressed ? 0.85 : 1,
              shadowColor: tint,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 4,
            }}
          >
            <MaterialCommunityIcons name={icon as any} size={24} color="#FFFFFF" />
          </LinearGradient>
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
