import React, { useState } from "react";
import {
  Text,
  View,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../src/lib/auth-context";

export default function LoginScreen() {
  const router = useRouter();
  const { login, unlockWithPin, pinLoginAvailable } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pin, setPin] = useState("");
  const [isPinLogin, setIsPinLogin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError(null);
    if (isPinLogin) {
      if (!pin || pin.length < 4) {
        setError("Please enter a valid 4-digit PIN.");
        return;
      }
      setLoading(true);
      try {
        const unlocked = await unlockWithPin(pin);
        if (!unlocked) {
          setError("Incorrect PIN, or your session has expired — please sign in with email & password.");
        }
      } catch (err: any) {
        setError(err.message || "Failed to unlock.");
      } finally {
        setLoading(false);
      }
    } else {
      if (!email || !password) {
        setError("Email and password are required.");
        return;
      }
      setLoading(true);
      try {
        await login(email, password);
      } catch (err: any) {
        setError(err.message || "Invalid email or password.");
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={0}
      className="flex-1 bg-background dark:bg-background-dark"
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <View className="px-6 py-12 justify-center flex-1 max-w-md mx-auto w-full">
          {/* Logo / Header */}
          <View className="items-center mb-10">
            <View className="w-16 h-16 rounded-2xl items-center justify-center shadow-lg mb-4 overflow-hidden">
              <Image source={require("../../assets/icon.png")} className="w-16 h-16" resizeMode="contain" />
            </View>
            <Text className="text-3xl font-extrabold text-text-primary dark:text-text-primary-dark text-center tracking-tight">
              MMC Shop
            </Text>
            <Text className="text-text-secondary dark:text-text-secondary-dark text-center mt-2 font-medium">
              Manage your business with ease
            </Text>
          </View>

          {/* Form Card */}
          <View className="bg-surface dark:bg-surface-dark p-6 rounded-3xl border border-gray-100 dark:border-zinc-800 shadow-xl">
            <Text className="text-xl font-bold text-text-primary dark:text-text-primary-dark mb-4">
              {isPinLogin ? "Quick PIN Login" : "Sign In"}
            </Text>

            {error && (
              <View className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 p-4 rounded-xl mb-4">
                <Text className="text-error font-semibold text-base">{error}</Text>
              </View>
            )}

            {!isPinLogin ? (
              // Email / Password Form
              <View className="space-y-4">
                <View>
                  <Text className="text-sm font-semibold text-text-secondary dark:text-text-secondary-dark uppercase tracking-wider mb-2">
                    Email Address
                  </Text>
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    placeholder="you@business.com"
                    placeholderTextColor="#A0A0A0"
                    autoCapitalize="none"
                    keyboardType="email-address"
                    autoCorrect={false}
                    className="bg-background dark:bg-background-dark text-text-primary dark:text-text-primary-dark border border-gray-200 dark:border-zinc-800 rounded-xl px-4 py-4 text-base font-medium focus:border-primary dark:focus:border-primary-dark"
                  />
                </View>

                <View>
                  <Text className="text-sm font-semibold text-text-secondary dark:text-text-secondary-dark uppercase tracking-wider mb-2">
                    Password
                  </Text>
                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Enter your password"
                    placeholderTextColor="#A0A0A0"
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                    className="bg-background dark:bg-background-dark text-text-primary dark:text-text-primary-dark border border-gray-200 dark:border-zinc-800 rounded-xl px-4 py-4 text-base font-medium focus:border-primary dark:focus:border-primary-dark"
                  />
                </View>

                <View className="pt-1">
                  <Text className="text-xs text-text-secondary dark:text-text-secondary-dark">
                    Having trouble? Use email login (or request access).
                  </Text>
                </View>
              </View>
            ) : (
              // PIN Form
              <View>
                <Text className="text-sm font-semibold text-text-secondary dark:text-text-secondary-dark uppercase tracking-wider mb-2">
                  Enter 4-Digit PIN
                </Text>
                <TextInput
                  value={pin}
                  onChangeText={setPin}
                  placeholder="••••"
                  placeholderTextColor="#A0A0A0"
                  secureTextEntry
                  maxLength={4}
                  keyboardType="number-pad"
                  className="bg-background dark:bg-background-dark text-text-primary dark:text-text-primary-dark border border-gray-200 dark:border-zinc-800 rounded-xl px-4 py-4 font-bold text-3xl text-center tracking-widest focus:border-primary dark:focus:border-primary-dark"
                />
                <Text className="text-xs text-text-secondary dark:text-text-secondary-dark mt-3">
                  Tip: Switch to email login if your session expired.
                </Text>
              </View>
            )}

            {/* Login Button */}
            <Pressable
              onPress={handleLogin}
              disabled={loading}
              className="bg-primary dark:bg-primary-dark mt-6 py-5 rounded-xl items-center active:opacity-90 shadow-md"
              accessibilityRole="button"
              accessibilityLabel={isPinLogin ? "Enter Shop with PIN" : "Sign In"}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white font-bold text-lg">
                  {isPinLogin ? "Enter Shop" : "Sign In"}
                </Text>
              )}
            </Pressable>

            {/* Toggle PIN / Email login — PIN option only shown once a PIN has
                actually been set up on this device (Profile/More → Set Quick PIN) */}
            {(isPinLogin || pinLoginAvailable) && (
              <Pressable
                onPress={() => {
                  setIsPinLogin(!isPinLogin);
                  setError(null);
                }}
                className="mt-6 py-3 items-center"
                accessibilityRole="button"
                accessibilityLabel={isPinLogin ? "Switch to email login" : "Switch to quick PIN login"}
              >
                <Text className="text-primary dark:text-primary-dark font-semibold text-base">
                  {isPinLogin ? "Use Email & Password" : "Use Quick PIN"}
                </Text>
              </Pressable>
            )}

            {!isPinLogin && (
              <>
                <Pressable
                  onPress={() => router.push("/(auth)/register" as any)}
                  className="mt-4 py-3 items-center"
                  accessibilityRole="button"
                  accessibilityLabel="Sign up with invite code"
                >
                  <Text className="text-primary dark:text-primary-dark font-semibold text-base">
                    Have an invite code? Sign Up
                  </Text>
                </Pressable>

                <Text className="text-xs text-text-secondary dark:text-text-secondary-dark mt-4 text-center">
                  Need help? Contact support via your admin.
                </Text>
              </>
            )}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
