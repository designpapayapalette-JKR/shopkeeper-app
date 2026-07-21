import React from "react";
import { View, Text } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { roleColor, roleLabel } from "../lib/roles";

interface RoleBadgeProps {
 role: string | null | undefined;
 size?: "sm" | "md";
}

// Small tinted pill showing the user's plain-language role (e.g. "Cashier",
// not "staff") — used on Home, Me tab, and Manage User so a shared-device
// handoff is identifiable at a glance. Tint + icon + text together, never
// color alone (shopkeeper-mobile-design-system.md §4.1).
export default function RoleBadge({ role, size = "md" }: RoleBadgeProps) {
 const color = roleColor(role);
 const label = roleLabel(role);
 const isSm = size === "sm";

 return (
 <View
 className="flex-row items-center self-start rounded-full"
 style={{
 backgroundColor: `${color}18`,
 paddingVertical: isSm ? 3 : 5,
 paddingHorizontal: isSm ? 8 : 10,
 gap: 4,
 }}
 >
 <MaterialCommunityIcons name="badge-account" size={isSm ? 12 : 14} color={color} />
 <Text
 className="font-label-sm"
 style={{ color, fontSize: isSm ? 11 : 12, fontWeight: "600" }}
 >
 {label}
 </Text>
 </View>
 );
}
