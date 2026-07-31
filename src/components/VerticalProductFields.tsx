"use client";

import React from "react";
import { View, Text, TextInput, Pressable, Alert } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "react-native-paper";
import type { ProductVerticalConfig, ProductFieldSection } from "../lib/useProductVerticalConfig";

interface Props {
  config: ProductVerticalConfig;
  prefix: "new" | "edit";
  values: Record<string, string | number | boolean>;
  setters: Record<string, (v: any) => void>;
  section: ProductFieldSection;
}

const SECTION_LABELS: Record<ProductFieldSection, string> = {
  basic: "",
  packaging: "",
  serial: "",
  kirana: "Kirana / Grocery Fields",
  pharmacy: "Pharmacy Fields",
  electronics: "Electronics Fields",
  apparel: "Apparel / Fashion Fields",
  container: "",
  rack: "",
  pinned: "",
  variant: "",
};

export function VerticalFieldsSection({ config, prefix, values, setters, section }: Props) {
  const theme = useTheme();
  const label = SECTION_LABELS[section];
  if (!label) return null;

  const v = (key: string) => values[key] ?? "";
  const s = (key: string) => setters[key] ?? (() => {});

  return (
    <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.colors.outline }}>
      <Text style={{ fontSize: 14, fontWeight: "600", color: theme.colors.onSurface, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
        {label}
      </Text>

      {section === "pharmacy" && (
        <>
          <LabeledInput
            style={inputStyle(theme)}
            label="Generic Name"
            value={String(v("genericName"))}
            onChangeText={(t: string) => s("genericName")(t)}
            placeholder="e.g. Paracetamol"
            placeholderTextColor="#A0A0A0"
          />
          <LabeledInput
            style={inputStyle(theme)}
            label="Strength"
            value={String(v("strength"))}
            onChangeText={(t: string) => s("strength")(t)}
            placeholder="e.g. 500mg"
            placeholderTextColor="#A0A0A0"
          />
          <PickerField
            style={inputStyle(theme)}
            label="Dosage Form"
            value={String(v("dosageForm"))}
            onValueChange={(val: string) => s("dosageForm")(val)}
            items={["Tablet", "Capsule", "Syrup", "Injection", "Cream", "Ointment", "Drops", "Spray", "Inhaler", "Lotion", "Gel", "Powder", "Sachet", "Strip", "Vial", "Ampoule"].map(s => ({ label: s, value: s }))}
            placeholder="Select"
          />
          <PickerField
            style={inputStyle(theme)}
            label="Schedule Category"
            value={String(v("scheduleCategory"))}
            onValueChange={(val: string) => s("scheduleCategory")(val)}
            items={[
              { label: "None (OTC)", value: "NONE" },
              { label: "Schedule H", value: "H" },
              { label: "Schedule H1", value: "H1" },
              { label: "Schedule X", value: "X" },
              { label: "Schedule G", value: "G" },
            ]}
            placeholder="Select"
          />
          <LabeledInput
            style={inputStyle(theme)}
            label="Manufacturer"
            value={String(v("manufacturer"))}
            onChangeText={(t: string) => s("manufacturer")(t)}
            placeholder="e.g. Cipla"
            placeholderTextColor="#A0A0A0"
          />
          <CheckboxField
            label="Cold Chain (requires refrigeration)"
            value={!!v("isColdChain")}
            onValueChange={(val: boolean) => s("isColdChain")(val)}
            theme={theme}
          />
          <CheckboxField
            label="Narcotic / Controlled Substance"
            value={!!v("isNarcotic")}
            onValueChange={(val: boolean) => s("isNarcotic")(val)}
            theme={theme}
          />
          <CheckboxField
            label="Psychotropic Substance"
            value={!!v("isPsychotropic")}
            onValueChange={(val: boolean) => s("isPsychotropic")(val)}
            theme={theme}
          />
          <CheckboxField
            label="Antibiotic (requires stewardship audit)"
            value={!!v("isAntibiotic")}
            onValueChange={(val: boolean) => s("isAntibiotic")(val)}
            theme={theme}
          />
        </>
      )}

      {section === "electronics" && (
        <>
          <LabeledInput
            style={inputStyle(theme)}
            label="Model Number"
            value={String(v("modelNumber"))}
            onChangeText={(t) => s("modelNumber")(t)}
            placeholder="e.g. iPhone 16 Pro"
            placeholderTextColor="#A0A0A0"
          />
          <LabeledInput
            style={inputStyle(theme)}
            label="Color / Variant"
            value={String(v("color"))}
            onChangeText={(t) => s("color")(t)}
            placeholder="e.g. Space Black"
            placeholderTextColor="#A0A0A0"
          />
          <LabeledInput
            style={inputStyle(theme)}
            label="Warranty Period (months)"
            value={String(v("warrantyPeriodMonths"))}
            onChangeText={(t) => s("warrantyPeriodMonths")(parseInt(t) || 0)}
            placeholder="e.g. 12"
            placeholderTextColor="#A0A0A0"
            keyboardType="numeric"
          />
          <PickerField
            style={inputStyle(theme)}
            label="Warranty Type"
            value={String(v("warrantyType"))}
            onValueChange={(val: string) => s("warrantyType")(val)}
            items={[
              { label: "Manufacturer Warranty", value: "manufacturer" },
              { label: "Store Warranty", value: "store" },
              { label: "Extended Warranty", value: "extended" },
            ]}
            placeholder="Select"
          />
        </>
      )}

      {section === "apparel" && (
        <>
          <PickerField
            style={inputStyle(theme)}
            label="Gender"
            value={String(v("gender"))}
            onValueChange={(val: string) => s("gender")(val)}
            items={[
              { label: "Men", value: "M" },
              { label: "Women", value: "F" },
              { label: "Kids", value: "Kids" },
              { label: "Unisex", value: "Unisex" },
            ]}
            placeholder="Select"
          />
          <PickerField
            style={inputStyle(theme)}
            label="Size"
            value={String(v("apparelSize"))}
            onValueChange={(val: string) => s("apparelSize")(val)}
            items={[
              "XS", "S", "M", "L", "XL", "XXL", "3XL",
              "28", "30", "32", "34", "36", "38", "40", "42", "44"
            ].map(s => ({ label: s, value: s }))}
            placeholder="Select"
          />
          <LabeledInput
            style={inputStyle(theme)}
            label="Color"
            value={String(v("color"))}
            onChangeText={(t) => s("color")(t)}
            placeholder="e.g. Navy Blue"
            placeholderTextColor="#A0A0A0"
          />
          <LabeledInput
            style={inputStyle(theme)}
            label="Fabric"
            value={String(v("fabric"))}
            onChangeText={(t) => s("fabric")(t)}
            placeholder="e.g. 100% Cotton"
            placeholderTextColor="#A0A0A0"
          />
          <LabeledInput
            style={[inputStyle(theme), { minHeight: 80, textAlignVertical: "top" }]}
            label="Care Instructions"
            value={String(v("careInstructions"))}
            onChangeText={(t) => s("careInstructions")(t)}
            placeholder="e.g. Machine wash cold, tumble dry low"
            placeholderTextColor="#A0A0A0"
            multiline
          />
        </>
      )}

      {section === "kirana" && (
        <>
          <CheckboxField
            label="Sell by Weight (weighing scale)"
            value={!!v("sellByWeight")}
            onValueChange={(val: boolean) => s("sellByWeight")(val)}
            theme={theme}
          />
          <PickerField
            style={inputStyle(theme)}
            label="Weight Unit"
            value={String(v("weightUnit"))}
            onValueChange={(val: string) => s("weightUnit")(val)}
            items={["g", "kg", "mL", "L"].map(s => ({ label: s, value: s }))}
            placeholder="Select"
            disabled={!v("sellByWeight")}
          />
          <LabeledInput
            style={inputStyle(theme)}
            label={`Price Per Unit (₹/${v("weightUnit") || "kg"})`}
            value={String(v("pricePerUnit"))}
            onChangeText={(t) => s("pricePerUnit")(parseFloat(t) || 0)}
            placeholder={`₹ per ${v("weightUnit") || "kg"}`}
            placeholderTextColor="#A0A0A0"
            keyboardType="numeric"
            disabled={!v("sellByWeight")}
          />
          <CheckboxField
            label="Perishable Item"
            value={!!v("perishable")}
            onValueChange={(val: boolean) => s("perishable")(val)}
            theme={theme}
          />
          <LabeledInput
            style={inputStyle(theme)}
            label="Shelf Life (days)"
            value={String(v("shelfLifeDays"))}
            onChangeText={(t) => s("shelfLifeDays")(parseInt(t) || 0)}
            placeholder="e.g. 7"
            placeholderTextColor="#A0A0A0"
            keyboardType="numeric"
          />
          <CheckboxField
            label="Loose / Unpackaged Item"
            value={!!v("isLoose")}
            onValueChange={(val: boolean) => s("isLoose")(val)}
            theme={theme}
          />
        </>
      )}
    </View>
  );
}

function inputStyle(theme: any) {
  return {
    backgroundColor: (theme.colors as any).surfaceContainerLowest || "#FFF",
    borderWidth: 1,
    borderColor: theme.colors.outline || "#E0E0E0",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    fontWeight: "500" as const,
    color: theme.colors.onSurface || "#333",
    marginBottom: 12,
  };
}

interface LabeledInputProps {
  style?: any;
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  placeholderTextColor?: string;
  keyboardType?: "default" | "numeric" | "email-address" | "phone-pad";
  multiline?: boolean;
  disabled?: boolean;
}

function LabeledInput({ style, label, ...props }: LabeledInputProps) {
  const theme = useTheme();
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ fontSize: 14, fontWeight: "600", color: theme.colors.onSurfaceVariant, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
        {label}
      </Text>
      <TextInput style={style} {...props} />
    </View>
  );
}

interface PickerFieldProps {
  style?: any;
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  items: Array<{ label: string; value: string }>;
  placeholder: string;
  disabled?: boolean;
}

interface AlertButton {
  text: string;
  onPress?: () => void;
  style?: "default" | "cancel" | "destructive";
}

interface PickerFieldProps {
  style?: any;
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  items: Array<{ label: string; value: string }>;
  placeholder: string;
  disabled?: boolean;
}

function PickerField({ style, label, value, onValueChange, items, placeholder, disabled }: PickerFieldProps) {
  const theme = useTheme();
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ fontSize: 14, fontWeight: "600", color: theme.colors.onSurfaceVariant, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
        {label}
      </Text>
      <View style={[style, { backgroundColor: (theme.colors as any).surfaceContainerLowest || "#FFF", borderWidth: 1, borderColor: disabled ? theme.colors.outlineVariant || "#E0E0E0" : theme.colors.outline || "#E0E0E0", borderRadius: 12 }]}>
        <Pressable
          onPress={() => {
            if (disabled) return;
            const options: AlertButton[] = items.map((i: any, idx: number) => ({
              text: i.label,
              onPress: () => onValueChange(i.value),
            }));
            options.push({ text: "Cancel", style: "cancel" });
            Alert.alert(label, "", options);
          }}
          disabled={disabled}
        >
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12 }}>
            <Text style={{ fontSize: 14, fontWeight: "500", color: value ? theme.colors.onSurface : theme.colors.outline }}>
              {value ? items.find((i: any) => i.value === value)?.label : placeholder}
            </Text>
            <MaterialCommunityIcons name="chevron-down" size={20} color={theme.colors.outline} />
          </View>
        </Pressable>
      </View>
    </View>
  );
}

function CheckboxField({ label, value, onValueChange, theme }: any) {
  return (
    <Pressable onPress={() => onValueChange(!value)} style={{ minHeight: 44, flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
      <View style={{ width: 22, height: 22, borderRadius: 4, borderWidth: 2, borderColor: value ? theme.colors.primary : theme.colors.outline, backgroundColor: value ? theme.colors.primary : "transparent", alignItems: "center", justifyContent: "center", marginRight: 10 }}>
        {value && <MaterialCommunityIcons name="check" size={16} color="#fff" />}
      </View>
      <Text style={{ fontSize: 14, color: theme.colors.onSurface }}>{label}</Text>
    </Pressable>
  );
}

export function getVerticalSections(config: ProductVerticalConfig): ProductFieldSection[] {
  const visibleSections = Array.isArray(config?.visibleSections) ? config.visibleSections : [];
  return (["pharmacy", "electronics", "apparel", "kirana"] as ProductFieldSection[]).filter(
    (s) => visibleSections.includes(s)
  );
}
