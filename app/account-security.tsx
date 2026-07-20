import React, { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, ActivityIndicator, Pressable, TextInput, Alert, Switch } from "react-native";
import { useRouter } from "expo-router";
import { useTheme } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { api, resendVerificationEmail, enableTwoFactor, disableTwoFactor } from "../src/lib/api";
import { useTopInset } from "../src/lib/useTopInset";
import { useBottomInset } from "../src/lib/useBottomInset";

interface Me {
  email: string;
  email_verified: boolean;
  two_factor_enabled: boolean;
}

// Mirrors shopkeeper-web's Settings > Security & Access > Account Security
// card — same two endpoints (/auth/verify-email/resend, /auth/2fa/enable
// or /disable), just a native shell around them.
export default function AccountSecurityScreen() {
  const theme = useTheme();
  const router = useRouter();
  const topInset = useTopInset();
  const bottomInset = useBottomInset();
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [sendingVerify, setSendingVerify] = useState(false);
  const [verifyMsg, setVerifyMsg] = useState<string | null>(null);
  const [toggling, setToggling] = useState(false);
  const [showDisableConfirm, setShowDisableConfirm] = useState(false);
  const [disablePassword, setDisablePassword] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await api.get<{ user: Me }>("/auth/me");
      setMe(res.user);
    } catch (e) {
      console.error("Failed to load account security status:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleResendVerification = async () => {
    setSendingVerify(true);
    setVerifyMsg(null);
    try {
      await resendVerificationEmail();
      setVerifyMsg("Verification email sent.");
    } catch (e: any) {
      setVerifyMsg(e.message || "Failed to send email.");
    } finally {
      setSendingVerify(false);
    }
  };

  const handleToggle = async (next: boolean) => {
    if (!next) {
      setShowDisableConfirm(true);
      return;
    }
    setToggling(true);
    try {
      await enableTwoFactor();
      setMe((prev) => (prev ? { ...prev, two_factor_enabled: true } : prev));
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to enable 2FA.");
    } finally {
      setToggling(false);
    }
  };

  const handleDisable = async () => {
    if (!disablePassword) return;
    setToggling(true);
    try {
      await disableTwoFactor(disablePassword);
      setMe((prev) => (prev ? { ...prev, two_factor_enabled: false } : prev));
      setShowDisableConfirm(false);
      setDisablePassword("");
    } catch (e: any) {
      Alert.alert("Error", e.message || "Incorrect password.");
    } finally {
      setToggling(false);
    }
  };

  return (
    <View className="flex-1 bg-background dark:bg-bg-dark">
      <View className="bg-surface-container-lowest dark:bg-surface-dark border-b border-outline-variant dark:border-outline flex-row items-center px-margin-mobile pb-3" style={{ gap: 12, paddingTop: topInset }}>
        <Pressable onPress={() => router.back()} className="w-touch-target h-touch-target items-center justify-center -ml-2">
          <MaterialCommunityIcons name="arrow-left" size={22} color={theme.colors.primary} />
        </Pressable>
        <Text className="font-headline-md text-headline-md text-on-surface dark:text-text-primary-dark">
          Account Security
        </Text>
      </View>

      {loading || !me ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : (
        <ScrollView className="flex-1 px-6 pt-6" contentContainerStyle={{ paddingBottom: bottomInset + 24 }}>
          <View className="bg-surface-container-lowest dark:bg-surface-dark p-6 rounded-3xl border border-outline-variant dark:border-outline shadow-sm mb-6">
            <View className="flex-row items-start justify-between" style={{ gap: 12 }}>
              <View className="flex-1 flex-row items-start" style={{ gap: 10 }}>
                <MaterialCommunityIcons name="email-outline" size={18} color={theme.colors.onSurfaceVariant} style={{ marginTop: 2 }} />
                <View className="flex-1">
                  <Text className="text-base font-bold text-on-surface dark:text-text-primary-dark">{me.email}</Text>
                  {me.email_verified ? (
                    <View className="flex-row items-center mt-1" style={{ gap: 4 }}>
                      <MaterialCommunityIcons name="check-circle" size={13} color="#16a34a" />
                      <Text className="text-xs font-semibold" style={{ color: "#16a34a" }}>Verified</Text>
                    </View>
                  ) : (
                    <Text className="text-xs text-on-surface-variant dark:text-text-secondary-dark mt-1">Not verified yet.</Text>
                  )}
                </View>
              </View>
              {!me.email_verified && (
                <Pressable onPress={handleResendVerification} disabled={sendingVerify} className="py-2 px-3 rounded-lg bg-background dark:bg-bg-dark border border-outline-variant dark:border-outline">
                  <Text className="text-primary dark:text-primary-dark font-bold text-xs">
                    {sendingVerify ? "Sending..." : "Resend"}
                  </Text>
                </Pressable>
              )}
            </View>
            {verifyMsg && <Text className="text-xs text-on-surface-variant dark:text-text-secondary-dark mt-3">{verifyMsg}</Text>}
          </View>

          <View className="bg-surface-container-lowest dark:bg-surface-dark p-6 rounded-3xl border border-outline-variant dark:border-outline shadow-sm mb-6">
            <View className="flex-row items-center justify-between" style={{ gap: 12 }}>
              <View className="flex-1">
                <Text className="text-base font-bold text-on-surface dark:text-text-primary-dark">
                  Two-Factor Authentication
                </Text>
                <Text className="text-sm text-on-surface-variant dark:text-text-secondary-dark mt-1">
                  After entering your password, we'll also email a 6-digit code you must enter to finish signing in.
                </Text>
              </View>
              <Switch value={me.two_factor_enabled} disabled={toggling} onValueChange={handleToggle} trackColor={{ true: theme.colors.primary }} />
            </View>

            {showDisableConfirm && (
              <View className="mt-4 pt-4 border-t border-outline-variant dark:border-outline">
                <Text className="text-sm font-semibold text-on-surface dark:text-text-primary-dark mb-2">
                  Confirm your password to disable 2FA
                </Text>
                <TextInput
                  value={disablePassword}
                  onChangeText={setDisablePassword}
                  placeholder="Current password"
                  placeholderTextColor="#A0A0A0"
                  secureTextEntry
                  autoCapitalize="none"
                  className="bg-background dark:bg-bg-dark text-on-surface dark:text-text-primary-dark border border-outline-variant dark:border-outline rounded-xl px-4 py-3 text-base font-medium mb-3"
                />
                <View className="flex-row" style={{ gap: 8 }}>
                  <Pressable
                    onPress={() => { setShowDisableConfirm(false); setDisablePassword(""); }}
                    className="flex-1 py-3 rounded-xl items-center border border-outline-variant dark:border-outline"
                  >
                    <Text className="text-on-surface-variant dark:text-text-secondary-dark font-bold text-sm">Cancel</Text>
                  </Pressable>
                  <Pressable
                    onPress={handleDisable}
                    disabled={toggling || !disablePassword}
                    className="flex-1 py-3 rounded-xl items-center bg-error"
                  >
                    <Text className="text-white font-bold text-sm">{toggling ? "Disabling..." : "Disable 2FA"}</Text>
                  </Pressable>
                </View>
              </View>
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}
