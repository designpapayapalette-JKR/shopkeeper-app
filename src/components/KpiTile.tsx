import React from "react";
import { View, Text } from "react-native";
import { useTheme } from "react-native-paper";

interface KpiTileProps {
  value: string;
  label: string;
  delta?: { text: string; direction: "up" | "down" };
  color?: string;
  compact?: boolean;
}

// Tinted-background treatment (not a flat white card + left border stripe)
// — gives KPI tiles real color presence per user feedback that the earlier
// flat/bordered look read as boring (see memory feedback_ui_visual_quality.md).
export default function KpiTile({ value, label, delta, color, compact }: KpiTileProps) {
  const theme = useTheme();
  const accentColor = color ?? theme.colors.primary;
  const deltaColor = delta?.direction === "down" ? theme.colors.error : "#2E9E5B";

  return (
    <View
      style={{
        flex: 1,
        minWidth: compact ? 72 : 84,
        borderRadius: 20,
        backgroundColor: `${accentColor}14`,
        borderWidth: 1,
        borderColor: `${accentColor}26`,
        padding: compact ? 10 : 14,
        gap: 3,
      }}
    >
      <Text style={{ fontSize: 11, fontWeight: "700", letterSpacing: 0.3, textTransform: "uppercase", color: accentColor }}>
        {label}
      </Text>
      <Text style={{ fontSize: compact ? 19 : 23, fontWeight: "800", color: "#1c1b1b", lineHeight: compact ? 23 : 27 }} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      {delta && (
        <Text style={{ fontSize: 11, fontWeight: "700", color: deltaColor }}>
          {delta.direction === "down" ? "↓" : "↑"} {delta.text}
        </Text>
      )}
    </View>
  );
}
