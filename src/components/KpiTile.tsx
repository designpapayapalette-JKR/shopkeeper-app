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

export default function KpiTile({ value, label, delta, color, compact }: KpiTileProps) {
  const theme = useTheme();
  const accentColor = color ?? theme.colors.primary;
  const deltaColor = delta?.direction === "down" ? theme.colors.error : "#2E9E5B";

  return (
    <View
      className="bg-surface-container-lowest rounded-2xl overflow-hidden"
      style={{
        flex: 1,
        minWidth: compact ? 72 : 84,
        borderLeftWidth: 3,
        borderLeftColor: accentColor,
        padding: compact ? 8 : 12,
        gap: 2,
      }}
    >
      <Text className="text-on-surface-variant" style={{ fontSize: 11, fontWeight: "600", letterSpacing: 0.3, textTransform: "uppercase" }}>
        {label}
      </Text>
      <Text style={{ fontSize: compact ? 18 : 22, fontWeight: "700", color: accentColor, lineHeight: compact ? 22 : 26 }} numberOfLines={1} adjustsFontSizeToFit>
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
