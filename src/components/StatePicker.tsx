import React, { useState, useMemo } from "react";
import { View, Text, TextInput, Pressable, Modal, FlatList } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { INDIAN_STATES } from "../lib/indianStates";

// A searchable bottom-sheet-style picker constrained to the 36 official
// Indian states/UTs — replaces a free-text state input. Free text here is
// what let party.state/company.state silently drift out of sync with each
// other (typos, "UP" vs "Uttar Pradesh"), which computeGstSplit() compares
// by exact string match to decide CGST/SGST vs IGST.
export function StatePicker({ value, onChange, placeholder = "Select state" }: {
 value: string;
 onChange: (v: string) => void;
 placeholder?: string;
}) {
 const [open, setOpen] = useState(false);
 const [query, setQuery] = useState("");

 const filtered = useMemo(
 () => INDIAN_STATES.filter((s) => s.toLowerCase().includes(query.toLowerCase())),
 [query]
 );

 return (
 <>
 <Pressable
 onPress={() => setOpen(true)}
 className="bg-surface-container-lowest border border-outline-variant rounded-xl px-4 py-4 flex-row items-center justify-between"
 >
 <Text className={`text-base font-medium ${value ? "text-on-surface " : "text-[#A0A0A0]"}`}>
 {value || placeholder}
 </Text>
 <MaterialCommunityIcons name="chevron-down" size={18} color="#A0A0A0" />
 </Pressable>

 <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
 <View className="flex-1 bg-background px-6 pt-16 pb-6">
 <View className="flex-row justify-between items-center mb-4">
 <Text className="text-xl font-bold text-text-primary ">Select State</Text>
 <Pressable onPress={() => setOpen(false)} className="w-11 h-11 items-center justify-center">
 <MaterialCommunityIcons name="close" size={20} color="#6B7280" />
 </Pressable>
 </View>
 <TextInput
 value={query}
 onChangeText={setQuery}
 placeholder="Search states…"
 placeholderTextColor="#A0A0A0"
 autoFocus
 className="bg-surface text-text-primary border border-gray-200 rounded-xl px-4 py-3.5 text-base font-medium mb-3"
 />
 <FlatList
 data={filtered}
 keyExtractor={(item) => item}
 keyboardShouldPersistTaps="handled"
 renderItem={({ item }) => (
 <Pressable
 onPress={() => {
 onChange(item);
 setQuery("");
 setOpen(false);
 }}
 className={`px-4 py-3.5 rounded-xl mb-1 ${item === value ? "bg-primary/10 " : ""}`}
 >
 <Text className={`text-base font-medium ${item === value ? "text-primary font-bold" : "text-text-primary "}`}>
 {item}
 </Text>
 </Pressable>
 )}
 />
 </View>
 </Modal>
 </>
 );
}
