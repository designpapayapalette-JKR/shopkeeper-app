import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "react-native-paper";
import { api, ApiError } from "../src/lib/api";
import { useTopInset } from "../src/lib/useTopInset";
import { useBottomInset } from "../src/lib/useBottomInset";
import { StatePicker } from "../src/components/StatePicker";
import Button from "../src/components/Button";

// Mirrors shopkeeper-web/src/app/dashboard/settings/page.tsx's "Business"
// tab — company identity + bank/UPI details, the fields an Owner most
// plausibly needs to update away from a desk (e.g. switching UPI ID).
// Deliberately does not cover every web settings tab (document numbering
// prefixes, financial year close, etc.) — see FUTURE-IMPROVEMENTS.md if
// those are wanted later; scoped per explicit user request to just
// Business Profile + Modules toggle for this pass.
interface FieldProps {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "email-address" | "phone-pad" | "numeric";
  multiline?: boolean;
  autoCapitalize?: "none" | "characters" | "words";
}

function Field({ label, value, onChangeText, placeholder, keyboardType = "default", multiline, autoCapitalize = "words" }: FieldProps) {
  return (
    <View className="mb-4">
      <Text className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        multiline={multiline}
        className="bg-surface-container-lowest text-on-surface border border-outline-variant rounded-xl px-4 py-3.5 text-base font-medium"
        style={multiline ? { minHeight: 80, textAlignVertical: "top" } : undefined}
      />
    </View>
  );
}

function SectionHeader({ icon, title }: { icon: string; title: string }) {
  const theme = useTheme();
  return (
    <View className="flex-row items-center mb-3 mt-2" style={{ gap: 8 }}>
      <MaterialCommunityIcons name={icon as any} size={16} color={theme.colors.primary} />
      <Text className="text-sm font-extrabold uppercase tracking-wider" style={{ color: theme.colors.primary }}>{title}</Text>
    </View>
  );
}

export default function BusinessProfileScreen() {
  const router = useRouter();
  const topInset = useTopInset();
  const bottomInset = useBottomInset();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [gstin, setGstin] = useState("");
  const [state, setState] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [bankIfsc, setBankIfsc] = useState("");
  const [upiId, setUpiId] = useState("");
  const [upiPayeeName, setUpiPayeeName] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: any }>("/companies/me");
      const c = res.data;
      setName(c.name || "");
      setEmail(c.email || "");
      setPhone(c.phone || "");
      setAddress(c.address || "");
      setGstin(c.gstin || "");
      setState(c.state || "");
      setBankName(c.bank_name || "");
      setBankAccountNumber(c.bank_account_number || "");
      setBankIfsc(c.bank_ifsc || "");
      setUpiId(c.upi_id || "");
      setUpiPayeeName(c.upi_payee_name || "");
    } catch (e) {
      console.error("Failed to load business profile:", e);
      setError(e instanceof ApiError ? e.message : "Failed to load business profile.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    setError(null);
    setSaved(false);
    if (!name.trim()) {
      setError("Business name is required.");
      return;
    }
    setSaving(true);
    try {
      await api.patch("/companies/me", {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        address: address.trim(),
        gstin: gstin.trim(),
        state: state.trim(),
        bankName: bankName.trim(),
        bankAccountNumber: bankAccountNumber.trim(),
        bankIfsc: bankIfsc.trim(),
        upiId: upiId.trim(),
        upiPayeeName: upiPayeeName.trim(),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background" style={{ paddingTop: topInset }}>
        <ActivityIndicator size="large" color="#0368FE" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView className="flex-1 bg-background" behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        className="flex-1 px-5"
        style={{ paddingTop: topInset }}
        contentContainerStyle={{ paddingBottom: bottomInset + 32 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="flex-row items-center mb-5 pt-2" style={{ gap: 12 }}>
          <Pressable onPress={() => router.back()} className="w-9 h-9 rounded-full bg-surface-container items-center justify-center">
            <MaterialCommunityIcons name="arrow-left" size={20} color="#1c1b1b" />
          </Pressable>
          <Text className="font-headline-md text-on-surface" style={{ fontSize: 20, fontWeight: "700" }}>Business Profile</Text>
        </View>

        {error && (
          <View className="bg-red-50 border border-red-200 p-3 rounded-xl mb-4">
            <Text className="text-error font-semibold text-sm">{error}</Text>
          </View>
        )}
        {saved && (
          <View className="bg-green-50 border border-green-200 p-3 rounded-xl mb-4 flex-row items-center" style={{ gap: 6 }}>
            <MaterialCommunityIcons name="check-circle" size={16} color="#2E9E5B" />
            <Text className="font-semibold text-sm" style={{ color: "#2E9E5B" }}>Business profile saved</Text>
          </View>
        )}

        <SectionHeader icon="store" title="Company Details" />
        <Field label="Business Name" value={name} onChangeText={setName} placeholder="Your shop or company name" />
        <Field label="Business Email" value={email} onChangeText={setEmail} placeholder="business@example.com" keyboardType="email-address" autoCapitalize="none" />
        <Field label="Business Phone" value={phone} onChangeText={setPhone} placeholder="10-digit phone number" keyboardType="phone-pad" />
        <Field label="Business Address" value={address} onChangeText={setAddress} placeholder="Street address, city, PIN code" multiline />

        <SectionHeader icon="file-percent-outline" title="GST & Tax" />
        <Field label="GSTIN" value={gstin} onChangeText={(v) => setGstin(v.toUpperCase())} placeholder="15-character GSTIN" autoCapitalize="characters" />
        <View className="mb-4">
          <Text className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">State</Text>
          <StatePicker value={state} onChange={setState} />
        </View>

        <SectionHeader icon="bank" title="Bank & UPI (shown on invoices & POS QR)" />
        <Field label="Bank Name" value={bankName} onChangeText={setBankName} placeholder="e.g. HDFC Bank" />
        <Field label="Account Number" value={bankAccountNumber} onChangeText={setBankAccountNumber} placeholder="Bank account number" keyboardType="numeric" autoCapitalize="none" />
        <Field label="IFSC Code" value={bankIfsc} onChangeText={(v) => setBankIfsc(v.toUpperCase())} placeholder="e.g. HDFC0001234" autoCapitalize="characters" />
        <Field label="UPI ID" value={upiId} onChangeText={setUpiId} placeholder="e.g. yourshop@okhdfcbank" autoCapitalize="none" />
        <Field label="UPI Payee Name" value={upiPayeeName} onChangeText={setUpiPayeeName} placeholder="Name shown to customers on UPI apps" />

        <View className="mt-2">
          <Button title="Save Business Profile" onPress={handleSave} loading={saving} fullWidth />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
