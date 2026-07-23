import React, { useState } from "react";
import { View, Text, ScrollView, Pressable, TextInput, ActivityIndicator, Alert, Linking } from "react-native";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "react-native-paper";
import { api, ApiError } from "../src/lib/api";
import { useTopInset } from "../src/lib/useTopInset";
import { useBottomInset } from "../src/lib/useBottomInset";

const STAFF_ROLES = [
  { id: "manager", name: "Manager" },
  { id: "staff", name: "Cashier / Biller" },
  { id: "warehouse_manager", name: "Warehouse Manager" },
  { id: "field_agent", name: "Field Agent" },
];

export default function InviteStaffScreen() {
  const router = useRouter();
  const theme = useTheme();
  const topInset = useTopInset();
  const bottomInset = useBottomInset();

  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("staff");
  const [submitting, setSubmitting] = useState(false);

  const handleInvite = async () => {
    if (!email.trim()) {
      Alert.alert("Required", "Email is required to send an invitation.");
      return;
    }
    if (!firstName.trim()) {
      Alert.alert("Required", "First name is required.");
      return;
    }

    setSubmitting(true);
    try {
      const tempPassword = Math.random().toString(36).slice(-8) + "!1";
      await api.post("/staff", {
        email: email.trim(),
        password: tempPassword,
        first_name: firstName.trim(),
        last_name: lastName.trim() || undefined,
        phone: phone.trim() || undefined,
        role,
      });

      if (phone.trim()) {
        const message = `You have been invited to ${email.trim()} on MMC Shop.\n\nDownload the MMC Agent app:\nhttps://mmcshop.app/agent\n\nLogin with:\nEmail: ${email.trim()}\nPassword: ${tempPassword}`;
        const url = `whatsapp://send?text=${encodeURIComponent(message)}&phone=+91${phone.replace(/\D/g, "")}`;
        Linking.canOpenURL(url).then((supported) => {
          if (supported) {
            Linking.openURL(url);
          }
        });
      }

      Alert.alert("Invitation Sent", `Login credentials sent to ${email.trim()}.`, [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (e) {
      Alert.alert("Error", e instanceof ApiError ? e.message : "Failed to send invitation.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView className="flex-1 bg-background" contentContainerStyle={{ paddingTop: topInset + 16, paddingHorizontal: 20, paddingBottom: bottomInset + 24 }}>
      <Pressable onPress={() => router.back()} className="flex-row items-center mb-6" style={{ gap: 6 }}>
        <MaterialCommunityIcons name="arrow-left" size={20} color={theme.colors.onSurface} />
        <Text className="font-body-lg text-on-surface">Back</Text>
      </Pressable>

      <Text className="text-2xl font-black text-on-surface mb-1">Invite Team Member</Text>
      <Text className="text-sm text-on-surface-variant mb-6">
        They will receive login credentials for the MMC Agent app.
      </Text>

      <View className="mb-4">
        <Text className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider mb-2">Email *</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="Email for login"
          placeholderTextColor="#A0A0A0"
          autoCapitalize="none"
          keyboardType="email-address"
          className="bg-surface-container-lowest text-on-surface border border-outline-variant rounded-xl px-4 py-4 text-base"
        />
      </View>

      <View className="mb-4">
        <Text className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider mb-2">First Name *</Text>
        <TextInput
          value={firstName}
          onChangeText={setFirstName}
          placeholder="First name"
          placeholderTextColor="#A0A0A0"
          className="bg-surface-container-lowest text-on-surface border border-outline-variant rounded-xl px-4 py-4 text-base"
        />
      </View>

      <View className="mb-4">
        <Text className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider mb-2">Last Name</Text>
        <TextInput
          value={lastName}
          onChangeText={setLastName}
          placeholder="Last name"
          placeholderTextColor="#A0A0A0"
          className="bg-surface-container-lowest text-on-surface border border-outline-variant rounded-xl px-4 py-4 text-base"
        />
      </View>

      <View className="mb-4">
        <Text className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider mb-2">Phone (for WhatsApp invite)</Text>
        <TextInput
          value={phone}
          onChangeText={setPhone}
          placeholder="10-digit mobile number"
          placeholderTextColor="#A0A0A0"
          keyboardType="phone-pad"
          className="bg-surface-container-lowest text-on-surface border border-outline-variant rounded-xl px-4 py-4 text-base"
        />
      </View>

      <View className="mb-6">
        <Text className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider mb-2">Role</Text>
        <View className="flex-row flex-wrap" style={{ gap: 8 }}>
          {STAFF_ROLES.map((r) => (
            <Pressable
              key={r.id}
              onPress={() => setRole(r.id)}
              className={`py-2.5 px-4 rounded-xl border ${
                role === r.id ? "bg-primary border-primary" : "bg-background border-outline-variant"
              }`}
            >
              <Text className={`text-xs font-bold ${role === r.id ? "text-white" : "text-on-surface-variant"}`}>{r.name}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <Pressable
        onPress={handleInvite}
        disabled={submitting}
        className="bg-primary py-4 rounded-xl items-center flex-row justify-center"
        style={{ gap: 8 }}
      >
        {submitting ? (
          <ActivityIndicator color="white" />
        ) : (
          <>
            <MaterialCommunityIcons name="send" size={18} color="white" />
            <Text className="text-white font-bold text-base">Send Invitation</Text>
          </>
        )}
      </Pressable>
    </ScrollView>
  );
}
