import React from "react";
import { View, Text, TextInput, Pressable } from "react-native";

// The standard Indian GST slabs — a shopkeeper picks one with a tap instead
// of typing a percentage from memory every time, but can still type a
// custom value (some HSN codes use non-standard rates, and cess/compensation
// scenarios exist) via the input below the chips.
const GST_SLABS = ["0", "5", "12", "18", "28"];

export function GstRatePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
 return (
 <View>
 <View className="flex-row flex-wrap" style={{ gap: 8 }}>
 {GST_SLABS.map((slab) => {
 const isActive = parseFloat(value || "-1") === parseFloat(slab);
 return (
 <Pressable
 key={slab}
 onPress={() => onChange(slab)}
 className={`px-4 py-2.5 rounded-xl border ${
 isActive
 ? "bg-primary border-primary "
 : "bg-surface-container-lowest border-outline-variant "
 }`}
 >
 <Text className={`text-sm font-bold ${isActive ? "text-white" : "text-on-surface "}`}>
 {slab}%
 </Text>
 </Pressable>
 );
 })}
 </View>
 <TextInput
 value={value}
 onChangeText={onChange}
 placeholder="Custom rate, e.g. 3 or 0.25"
 placeholderTextColor="#A0A0A0"
 keyboardType="numeric"
 className="bg-surface-container-lowest text-on-surface border border-outline-variant rounded-xl px-4 py-4 text-base font-medium mt-2.5"
 />
 </View>
 );
}
