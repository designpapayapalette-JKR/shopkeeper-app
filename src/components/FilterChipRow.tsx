import React from "react";
import { ScrollView, Pressable, Text } from "react-native";
import { useTheme } from "react-native-paper";

export interface FilterChipOption {
 key: string;
 label: string;
}

interface FilterChipRowProps {
 options: FilterChipOption[];
 value: string;
 onChange: (key: string) => void;
}

// Horizontal pill filter row — myBillBook's Parties/Items filter pattern,
// adopted per shopkeeper-mobile-design-system.md §6.6. Always starts
// scrolled to the default/most-useful filter, never mid-scrolled.
export default function FilterChipRow({ options, value, onChange }: FilterChipRowProps) {
 const theme = useTheme();

 return (
 <ScrollView
 horizontal
 showsHorizontalScrollIndicator={false}
 contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
 style={{ flexGrow: 0 }}
 >
 {options.map((opt) => {
 const active = opt.key === value;
 return (
 <Pressable
 key={opt.key}
 onPress={() => onChange(opt.key)}
 className="rounded-full items-center justify-center active:opacity-80"
 style={{
 height: 40,
 paddingHorizontal: 16,
 backgroundColor: active ? theme.colors.primary : "transparent",
 borderWidth: active ? 0 : 1,
 borderColor: theme.colors.outlineVariant,
 }}
 >
 <Text
 style={{
 fontSize: 14,
 fontWeight: "600",
 color: active ? "#FFFFFF" : theme.colors.onSurfaceVariant,
 }}
 >
 {opt.label}
 </Text>
 </Pressable>
 );
 })}
 </ScrollView>
 );
}
