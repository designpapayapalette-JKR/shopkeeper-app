import React, { useState, useEffect } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator } from "react-native";
import { api } from "../lib/api";

export type DataType = "text" | "number" | "decimal" | "boolean" | "singleSelect" | "dimension" | "weight";

export interface ProductAttributeDef {
 id: string;
 key: string;
 label: string;
 data_type: DataType;
 unit_options: string[];
 choices: string[];
 group_name: string | null;
 display_order: number;
 is_invoice_printable: boolean;
}

export interface CustomFieldValue {
 product_attribute_id: string;
 value_text?: string | null;
 value_number?: number | null;
 value_json?: Record<string, unknown> | null;
}

export function useProductAttributeDefs() {
 const [defs, setDefs] = useState<ProductAttributeDef[]>([]);
 const [loading, setLoading] = useState(true);

 useEffect(() => {
 api
 .get<{ data: ProductAttributeDef[] }>("/settings/product-attributes")
 .then((res) => {
 if (res?.data) setDefs(res.data);
 })
 .catch((e) => console.error("[ProductCustomFields] Failed to load defs:", e))
 .finally(() => setLoading(false));
 }, []);

 return { defs, loading };
}

export async function saveProductCustomFieldValues(productId: string, values: CustomFieldValue[]) {
 const nonEmpty = values.filter(
 (v) => v.value_text != null || v.value_number != null || v.value_json != null
 );
 await api.put(`/products/${productId}/attributes`, { values: nonEmpty });
}

export async function loadProductCustomFieldValues(productId: string): Promise<CustomFieldValue[]> {
 try {
 const res = await api.get<{ data: any[] }>(`/products/${productId}/attributes`);
 if (!res?.data) return [];
 return res.data.map((v: any) => ({
 product_attribute_id: v.product_attribute_id,
 value_text: v.value_text,
 value_number: v.value_number != null ? Number(v.value_number) : null,
 value_json: v.value_json,
 }));
 } catch {
 return [];
 }
}

function ValueInput({
 def,
 value,
 onChange,
}: {
 def: ProductAttributeDef;
 value: CustomFieldValue | undefined;
 onChange: (v: CustomFieldValue) => void;
}) {
 const base = { product_attribute_id: def.id };

 if (def.data_type === "boolean") {
 const boolVal = value?.value_text === "true";
 return (
 <View className="flex-row" style={{ gap: 8 }}>
 <Pressable
 onPress={() => onChange({ ...base, value_text: "true" })}
 className={`px-4 py-2.5 rounded-xl border flex-1 items-center ${
 boolVal
 ? "bg-primary border-primary"
 : "bg-surface-container-lowest border-outline-variant "
 }`}
 >
 <Text
 className={`text-sm font-bold ${boolVal ? "text-white" : "text-on-surface "}`}
 >
 Yes
 </Text>
 </Pressable>
 <Pressable
 onPress={() => onChange({ ...base, value_text: "false" })}
 className={`px-4 py-2.5 rounded-xl border flex-1 items-center ${
 !boolVal
 ? "bg-primary border-primary"
 : "bg-surface-container-lowest border-outline-variant "
 }`}
 >
 <Text
 className={`text-sm font-bold ${!boolVal ? "text-white" : "text-on-surface "}`}
 >
 No
 </Text>
 </Pressable>
 </View>
 );
 }

 if (def.data_type === "singleSelect") {
 const selected = value?.value_text || "";
 return (
 <View className="flex-row flex-wrap" style={{ gap: 6 }}>
 {def.choices.map((c) => {
 const isActive = selected === c;
 return (
 <Pressable
 key={c}
 onPress={() =>
 onChange({ ...base, value_text: isActive ? null : c })
 }
 className={`px-3 py-2 rounded-lg border ${
 isActive
 ? "bg-primary border-primary"
 : "bg-surface-container-lowest border-outline-variant "
 }`}
 >
 <Text
 className={`text-sm font-semibold ${
 isActive ? "text-white" : "text-on-surface "
 }`}
 >
 {c}
 </Text>
 </Pressable>
 );
 })}
 </View>
 );
 }

 if (def.data_type === "number" || def.data_type === "decimal") {
 const numVal = value?.value_number;
 return (
 <TextInput
 value={numVal != null ? String(numVal) : ""}
 onChangeText={(text) =>
 onChange({ ...base, value_number: text === "" ? null : Number(text) })
 }
 keyboardType={def.data_type === "number" ? "numeric" : "decimal-pad"}
 placeholder="0"
 placeholderTextColor="#A0A0A0"
 className="bg-surface-container-lowest text-on-surface border border-outline-variant rounded-xl px-4 py-3 text-base font-medium"
 />
 );
 }

 if (def.data_type === "weight") {
 const json = (value?.value_json as { value?: number; unit?: string } | undefined) || {};
 return (
 <View>
 <TextInput
 value={json.value != null ? String(json.value) : ""}
 onChangeText={(text) =>
 onChange({
 ...base,
 value_json: { ...json, value: text === "" ? undefined : Number(text) },
 })
 }
 keyboardType="decimal-pad"
 placeholder="Value"
 placeholderTextColor="#A0A0A0"
 className="bg-surface-container-lowest text-on-surface border border-outline-variant rounded-xl px-4 py-3 text-base font-medium mb-2"
 />
 <View className="flex-row flex-wrap" style={{ gap: 6 }}>
 {def.unit_options.map((u) => {
 const isActive = (json.unit || def.unit_options[0]) === u;
 return (
 <Pressable
 key={u}
 onPress={() => onChange({ ...base, value_json: { ...json, unit: u } })}
 className={`px-3 py-2 rounded-lg border ${
 isActive
 ? "bg-primary border-primary"
 : "bg-surface-container-lowest border-outline-variant "
 }`}
 >
 <Text
 className={`text-sm font-semibold ${
 isActive ? "text-white" : "text-on-surface "
 }`}
 >
 {u}
 </Text>
 </Pressable>
 );
 })}
 </View>
 </View>
 );
 }

 if (def.data_type === "dimension") {
 const json = (value?.value_json as { l?: number; w?: number; h?: number; unit?: string } | undefined) || {};
 return (
 <View>
 <View className="flex-row" style={{ gap: 8 }}>
 {(["l", "w", "h"] as const).map((dim) => (
 <View key={dim} className="flex-1">
 <Text className="text-xs font-semibold text-on-surface-variant mb-1 text-center">
 {dim.toUpperCase()}
 </Text>
 <TextInput
 value={json[dim] != null ? String(json[dim]) : ""}
 onChangeText={(text) =>
 onChange({
 ...base,
 value_json: { ...json, [dim]: text === "" ? undefined : Number(text) },
 })
 }
 keyboardType="decimal-pad"
 placeholder="0"
 placeholderTextColor="#A0A0A0"
 className="bg-surface-container-lowest text-on-surface border border-outline-variant rounded-xl px-3 py-3 text-base font-medium text-center"
 />
 </View>
 ))}
 </View>
 <View className="flex-row flex-wrap mt-2" style={{ gap: 6 }}>
 {def.unit_options.map((u) => {
 const isActive = (json.unit || def.unit_options[0]) === u;
 return (
 <Pressable
 key={u}
 onPress={() => onChange({ ...base, value_json: { ...json, unit: u } })}
 className={`px-3 py-2 rounded-lg border ${
 isActive
 ? "bg-primary border-primary"
 : "bg-surface-container-lowest border-outline-variant "
 }`}
 >
 <Text
 className={`text-sm font-semibold ${
 isActive ? "text-white" : "text-on-surface "
 }`}
 >
 {u}
 </Text>
 </Pressable>
 );
 })}
 </View>
 </View>
 );
 }

 return (
 <TextInput
 value={value?.value_text || ""}
 onChangeText={(text) => onChange({ ...base, value_text: text })}
 placeholder="Enter value"
 placeholderTextColor="#A0A0A0"
 className="bg-surface-container-lowest text-on-surface border border-outline-variant rounded-xl px-4 py-3 text-base font-medium"
 />
 );
}

export function ProductCustomFieldsFormSection({
 defs,
 values,
 onChange,
}: {
 defs: ProductAttributeDef[];
 values: CustomFieldValue[];
 onChange: (values: CustomFieldValue[]) => void;
}) {
 if (defs.length === 0) return null;

 const setValue = (v: CustomFieldValue) => {
 const next = values.filter((x) => x.product_attribute_id !== v.product_attribute_id);
 next.push(v);
 onChange(next);
 };

 const grouped = defs.reduce<Record<string, ProductAttributeDef[]>>((acc, d) => {
 const g = d.group_name || "Custom Fields";
 (acc[g] ||= []).push(d);
 return acc;
 }, {});

 return (
 <View className="mt-6 pt-4 border-t border-outline-variant ">
 {Object.entries(grouped).map(([group, groupDefs]) => (
 <View key={group} className="mb-4">
 <Text className="text-xs font-black uppercase tracking-wider text-on-surface-variant mb-3">
 {group}
 </Text>
 <View style={{ gap: 12 }}>
 {groupDefs.map((def) => (
 <View key={def.id}>
 <Text className="text-sm font-semibold text-on-surface mb-1.5">
 {def.label}
 </Text>
 <ValueInput
 def={def}
 value={values.find((v) => v.product_attribute_id === def.id)}
 onChange={setValue}
 />
 </View>
 ))}
 </View>
 </View>
 ))}
 </View>
 );
}
