import React from "react";
import { View, Text } from "react-native";
import { useTheme } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";

interface KpiTileProps {
  /** Pre-formatted value, e.g. "₹42,000" or "34" — this component never formats numbers itself. */
  value: string;
  label: string;
  /** Optional trend chip, e.g. "+8.2%" — tinted success/error, never color alone (also shown as an arrow icon). */
  delta?: { text: string; direction: "up" | "down" };
  color?: string;
}

// The single biggest, boldest number on a dashboard screen — money/count
// KPIs are the reason this app exists (design system §2 Principle #3:
// "Numbers are the hero"). display-md, not a smaller "safe" size.
export default function KpiTile({ value, label, delta, color }: KpiTileProps) {
  const theme = useTheme();
  const valueColor = color ?? theme.colors.onSurface;
  const deltaColor = delta?.direction === "down" ? theme.colors.error : "#2E9E5B";

  return (
    <View
      className="flex-1 items-center justify-center rounded-xl bg-surface-container-lowest"
      style={{ paddingVertical: 14, paddingHorizontal: 8, minWidth: 84 }}
    >
      <Text
        className="font-display-md"
        numberOfLines={1}
        adjustsFontSizeToFit
        style={{ fontSize: 24, lineHeight: 28, fontWeight: "700", color: valueColor }}
      >
        {value}
      </Text>
      <Text className="font-body-md text-on-surface-variant mt-1" style={{ fontSize: 12 }} numberOfLines={1}>
        {label}
      </Text>
      {delta && (
        <View className="flex-row items-center mt-1" style={{ gap: 2 }}>
          <MaterialCommunityIcons
            name={delta.direction === "down" ? "arrow-down" : "arrow-up"}
            size={12}
            color={deltaColor}
          />
          <Text style={{ fontSize: 11, fontWeight: "700", color: deltaColor }}>{delta.text}</Text>
        </View>
      )}
    </View>
  );
}
