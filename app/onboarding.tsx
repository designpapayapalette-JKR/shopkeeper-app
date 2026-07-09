import React, { useState } from "react";
import { View, Text, ScrollView, Pressable, TextInput, ActivityIndicator, Alert, Linking } from "react-native";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAuth } from "../src/lib/auth-context";
import { api, ApiError } from "../src/lib/api";
import { useTopInset } from "../src/lib/useTopInset";
import { useBottomInset } from "../src/lib/useBottomInset";

const STAFF_ROLES = [
  { id: "manager", name: "Manager" },
  { id: "staff", name: "Staff" },
  { id: "field_agent", name: "Field Agent" },
];

function randomTempPassword(): string {
  // Not meant to be memorable — it's sent straight to the new team member
  // over WhatsApp and they're expected to change it after first login.
  return Math.random().toString(36).slice(-8) + "!1";
}

interface AddedMember {
  name: string;
  phone: string;
  email: string;
  role: string;
  tempPassword: string;
}

// A single guided flow to take a brand-new shopkeeper from "just registered"
// to "fully set up" in one sitting: business details (needed on every GST
// invoice but never asked for at signup), then optionally add team members
// and hand them their login over WhatsApp — instead of making them
// discover Business Profile and Staff Management as two separate, easy to
// miss screens buried in More.
export default function OnboardingScreen() {
  const router = useRouter();
  const { activeCompany, refreshCompany } = useAuth();
  const topInset = useTopInset();
  const bottomInset = useBottomInset();

  const [step, setStep] = useState(0);

  // Step 1 — Business Details
  const [bizName, setBizName] = useState(activeCompany?.name ?? "");
  const [bizGstin, setBizGstin] = useState("");
  const [bizState, setBizState] = useState("");
  const [bizAddress, setBizAddress] = useState("");
  const [bizPhone, setBizPhone] = useState("");
  const [savingBiz, setSavingBiz] = useState(false);

  // Step 2 — Team
  const [memberName, setMemberName] = useState("");
  const [memberPhone, setMemberPhone] = useState("");
  const [memberEmail, setMemberEmail] = useState("");
  const [memberRole, setMemberRole] = useState("staff");
  const [addingMember, setAddingMember] = useState(false);
  const [addedMembers, setAddedMembers] = useState<AddedMember[]>([]);

  const handleSaveBusinessDetails = async () => {
    if (!bizName.trim()) {
      Alert.alert("Required Field", "Business name is required.");
      return;
    }
    setSavingBiz(true);
    try {
      await api.patch("/companies/me", {
        name: bizName.trim(),
        gstin: bizGstin.trim() || undefined,
        state: bizState.trim() || undefined,
        address: bizAddress.trim() || undefined,
        phone: bizPhone.trim() || undefined,
      });
      await refreshCompany();
      setStep(1);
    } catch (e) {
      Alert.alert("Error", e instanceof ApiError ? e.message : "Failed to save business details.");
    } finally {
      setSavingBiz(false);
    }
  };

  const handleAddMember = async () => {
    if (!memberName.trim() || !memberEmail.trim()) {
      Alert.alert("Required Fields", "Name and email are required to create their login.");
      return;
    }
    setAddingMember(true);
    try {
      const tempPassword = randomTempPassword();
      await api.post("/staff", {
        email: memberEmail.trim(),
        password: tempPassword,
        first_name: memberName.trim(),
        phone: memberPhone.trim() || undefined,
        role: memberRole,
      });
      setAddedMembers((prev) => [
        ...prev,
        { name: memberName.trim(), phone: memberPhone.trim(), email: memberEmail.trim(), role: memberRole, tempPassword },
      ]);
      setMemberName("");
      setMemberPhone("");
      setMemberEmail("");
      setMemberRole("staff");
    } catch (e) {
      Alert.alert("Error", e instanceof ApiError ? e.message : "Failed to add team member.");
    } finally {
      setAddingMember(false);
    }
  };

  const handleSendWhatsapp = (member: AddedMember) => {
    if (!member.phone) {
      Alert.alert("No Phone Number", "Add a phone number for this member to send their login over WhatsApp.");
      return;
    }
    const message = `Hi ${member.name}! You've been added to ${activeCompany?.name ?? "our team"} on Shopkeeper/Employee App.\n\nDownload the Employee App and log in with:\nEmail: ${member.email}\nPassword: ${member.tempPassword}\n\nPlease change your password after logging in.`;
    const url = `whatsapp://send?text=${encodeURIComponent(message)}&phone=+91${member.phone.replace(/\D/g, "")}`;
    Linking.canOpenURL(url).then((supported) => {
      if (supported) {
        Linking.openURL(url);
      } else {
        Alert.alert("WhatsApp Not Installed", "Could not open WhatsApp on this device.");
      }
    });
  };

  const STEPS = ["Business Details", "Add Team", "Done"];

  return (
    <View className="flex-1 bg-background dark:bg-bg-dark px-6" style={{ paddingTop: topInset }}>
      {/* Step indicator */}
      <View className="flex-row items-center mb-8" style={{ gap: 6 }}>
        {STEPS.map((label, i) => (
          <React.Fragment key={label}>
            <View className="items-center">
              <View
                className={`w-8 h-8 rounded-full items-center justify-center ${
                  i <= step ? "bg-primary dark:bg-primary-dark" : "bg-surface-container dark:bg-surface-dark"
                }`}
              >
                {i < step ? (
                  <MaterialCommunityIcons name="check" size={16} color="white" />
                ) : (
                  <Text className={`text-sm font-bold ${i === step ? "text-white" : "text-on-surface-variant"}`}>{i + 1}</Text>
                )}
              </View>
            </View>
            {i < STEPS.length - 1 && (
              <View className={`flex-1 h-0.5 ${i < step ? "bg-primary dark:bg-primary-dark" : "bg-surface-container dark:bg-surface-dark"}`} />
            )}
          </React.Fragment>
        ))}
      </View>

      {step === 0 && (
        <ScrollView showsVerticalScrollIndicator={false}>
          <Text className="text-2xl font-black text-on-surface dark:text-text-primary-dark mb-1">Let's set up your business</Text>
          <Text className="text-sm text-on-surface-variant dark:text-text-secondary-dark mb-6">
            This appears on every GST invoice you print or share. You can change it later from More {"→"} Business Profile.
          </Text>

          {[
            { label: "Business Name *", value: bizName, setter: setBizName, placeholder: "Your Shop / Company Name" },
            { label: "GSTIN (optional)", value: bizGstin, setter: setBizGstin, placeholder: "15-character GSTIN", autoCapitalize: "characters" as const },
            { label: "State", value: bizState, setter: setBizState, placeholder: "e.g. Maharashtra" },
            { label: "Address", value: bizAddress, setter: setBizAddress, placeholder: "Shop address for invoices" },
            { label: "Phone", value: bizPhone, setter: setBizPhone, placeholder: "10-digit mobile number", keyboardType: "phone-pad" as const },
          ].map((field) => (
            <View className="mb-4" key={field.label}>
              <Text className="text-sm font-semibold text-on-surface-variant dark:text-text-secondary-dark uppercase tracking-wider mb-2">
                {field.label}
              </Text>
              <TextInput
                value={field.value}
                onChangeText={field.setter}
                placeholder={field.placeholder}
                placeholderTextColor="#A0A0A0"
                autoCapitalize={field.autoCapitalize}
                keyboardType={field.keyboardType}
                className="bg-surface-container-lowest dark:bg-surface-dark text-on-surface dark:text-text-primary-dark border border-outline-variant dark:border-outline rounded-xl px-4 py-4 text-base font-medium"
              />
            </View>
          ))}

          <Pressable
            onPress={handleSaveBusinessDetails}
            disabled={savingBiz}
            className="bg-primary dark:bg-primary-dark py-4 rounded-xl items-center mt-4"
            style={{ marginBottom: bottomInset + 24 }}
          >
            {savingBiz ? <ActivityIndicator color="white" /> : <Text className="text-white font-bold text-base">Continue</Text>}
          </Pressable>
        </ScrollView>
      )}

      {step === 1 && (
        <ScrollView showsVerticalScrollIndicator={false}>
          <Text className="text-2xl font-black text-on-surface dark:text-text-primary-dark mb-1">Add your team</Text>
          <Text className="text-sm text-on-surface-variant dark:text-text-secondary-dark mb-6">
            Optional — each person gets their own login for the Employee App, sent straight to their WhatsApp. You can add more anytime from More {"→"} Staff.
          </Text>

          <View className="bg-surface-container-lowest dark:bg-surface-dark border border-outline-variant dark:border-outline rounded-2xl p-4 mb-5">
            <TextInput
              value={memberName}
              onChangeText={setMemberName}
              placeholder="Full name"
              placeholderTextColor="#A0A0A0"
              className="text-on-surface dark:text-text-primary-dark border border-outline-variant dark:border-outline rounded-xl px-4 py-3.5 text-base font-medium mb-3"
            />
            <TextInput
              value={memberPhone}
              onChangeText={setMemberPhone}
              placeholder="Phone (for WhatsApp login share)"
              placeholderTextColor="#A0A0A0"
              keyboardType="phone-pad"
              className="text-on-surface dark:text-text-primary-dark border border-outline-variant dark:border-outline rounded-xl px-4 py-3.5 text-base font-medium mb-3"
            />
            <TextInput
              value={memberEmail}
              onChangeText={setMemberEmail}
              placeholder="Email (used to log in)"
              placeholderTextColor="#A0A0A0"
              autoCapitalize="none"
              keyboardType="email-address"
              className="text-on-surface dark:text-text-primary-dark border border-outline-variant dark:border-outline rounded-xl px-4 py-3.5 text-base font-medium mb-3"
            />
            <View className="flex-row mb-3" style={{ gap: 8 }}>
              {STAFF_ROLES.map((r) => (
                <Pressable
                  key={r.id}
                  onPress={() => setMemberRole(r.id)}
                  className={`flex-1 py-2.5 rounded-xl border items-center ${
                    memberRole === r.id ? "bg-primary border-primary dark:bg-primary-dark" : "bg-background dark:bg-bg-dark border-outline-variant dark:border-outline"
                  }`}
                >
                  <Text className={`text-xs font-bold ${memberRole === r.id ? "text-white" : "text-on-surface-variant dark:text-text-secondary-dark"}`}>{r.name}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable
              onPress={handleAddMember}
              disabled={addingMember}
              className="bg-primary/10 dark:bg-primary-dark/10 py-3 rounded-xl items-center flex-row justify-center"
              style={{ gap: 6 }}
            >
              {addingMember ? (
                <ActivityIndicator color="#0F7A5F" size="small" />
              ) : (
                <>
                  <MaterialCommunityIcons name="plus" size={16} color="#0F7A5F" />
                  <Text className="text-primary dark:text-primary-dark font-bold text-sm">Create Login & Add</Text>
                </>
              )}
            </Pressable>
          </View>

          {addedMembers.length > 0 && (
            <View className="mb-5">
              <Text className="text-sm font-bold text-on-surface-variant dark:text-text-secondary-dark uppercase tracking-wider mb-2">
                Added ({addedMembers.length})
              </Text>
              {addedMembers.map((m) => (
                <View
                  key={m.email}
                  className="bg-surface-container-lowest dark:bg-surface-dark border border-outline-variant dark:border-outline rounded-xl p-3.5 mb-2.5 flex-row items-center justify-between"
                >
                  <View className="flex-1 mr-2">
                    <Text className="font-bold text-on-surface dark:text-text-primary-dark">{m.name}</Text>
                    <Text className="text-xs text-on-surface-variant dark:text-text-secondary-dark mt-0.5">{m.email} · {m.role}</Text>
                  </View>
                  <Pressable
                    onPress={() => handleSendWhatsapp(m)}
                    className="bg-[#25D366]/10 px-3 py-2 rounded-lg flex-row items-center"
                    style={{ gap: 5 }}
                  >
                    <MaterialCommunityIcons name="whatsapp" size={15} color="#128C7E" />
                    <Text className="text-xs font-bold text-[#128C7E]">Send Login</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          )}

          <Pressable
            onPress={() => setStep(2)}
            className="bg-primary dark:bg-primary-dark py-4 rounded-xl items-center mt-2"
            style={{ marginBottom: bottomInset + 24 }}
          >
            <Text className="text-white font-bold text-base">{addedMembers.length > 0 ? "Continue" : "Skip for Now"}</Text>
          </Pressable>
        </ScrollView>
      )}

      {step === 2 && (
        <View className="flex-1 items-center justify-center px-4" style={{ paddingBottom: bottomInset }}>
          <View className="w-20 h-20 rounded-full bg-primary/10 dark:bg-primary-dark/10 items-center justify-center mb-6">
            <MaterialCommunityIcons name="check-circle" size={44} color="#0F7A5F" />
          </View>
          <Text className="text-2xl font-black text-on-surface dark:text-text-primary-dark mb-2 text-center">You're all set!</Text>
          <Text className="text-sm text-on-surface-variant dark:text-text-secondary-dark text-center mb-8">
            Your business details are saved{addedMembers.length > 0 ? ` and ${addedMembers.length} team member${addedMembers.length > 1 ? "s" : ""} added` : ""}. You're ready to start billing.
          </Text>
          <Pressable
            onPress={async () => {
              try {
                await api.patch("/companies/me", { onboarding_completed_at: new Date().toISOString() });
                await refreshCompany();
              } catch (e) {
                // Best-effort — don't block the user from reaching the
                // dashboard just because this one flag failed to save.
              }
              router.replace("/" as any);
            }}
            className="bg-primary dark:bg-primary-dark py-4 px-10 rounded-xl items-center"
          >
            <Text className="text-white font-bold text-base">Go to Dashboard</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

