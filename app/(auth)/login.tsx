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
import { TwoFactorRequiredError, resendTwoFactorCode } from "../../src/lib/api";

export default function LoginScreen() {
 const router = useRouter();
 const { login, verifyTwoFactor, unlockWithPin, pinLoginAvailable } = useAuth();
 const [email, setEmail] = useState("");
 const [password, setPassword] = useState("");
 const [pin, setPin] = useState("");
 const [isPinLogin, setIsPinLogin] = useState(false);
 const [error, setError] = useState<string | null>(null);
 const [loading, setLoading] = useState(false);

 // Set when login() throws TwoFactorRequiredError — switches the form to
 // the code-entry step instead of the usual email/password fields.
 const [pendingToken, setPendingToken] = useState<string | null>(null);
 const [otpCode, setOtpCode] = useState("");
 const [resendMsg, setResendMsg] = useState<string | null>(null);

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
 if (err instanceof TwoFactorRequiredError) {
 setPendingToken(err.pendingToken);
 } else {
 setError(err.message || "Invalid email or password.");
 }
 } finally {
 setLoading(false);
 }
 }
 };

 const handleVerifyCode = async () => {
 if (!pendingToken) return;
 setError(null);
 setLoading(true);
 try {
 await verifyTwoFactor(pendingToken, otpCode.trim());
 } catch (err: any) {
 setError(err.message || "Invalid or expired code.");
 } finally {
 setLoading(false);
 }
 };

 const handleResendCode = async () => {
 if (!pendingToken) return;
 setResendMsg(null);
 setError(null);
 try {
 await resendTwoFactorCode(pendingToken);
 setResendMsg("A new code has been sent.");
 } catch (err: any) {
 setError(err.message || "Failed to resend code.");
 }
 };

 return (
 <KeyboardAvoidingView
 behavior={Platform.OS === "ios" ? "padding" : undefined}
 keyboardVerticalOffset={0}
 className="flex-1 bg-background "
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
 <Text className="text-3xl font-extrabold text-text-primary text-center tracking-tight">
 MMC Shop
 </Text>
 <Text className="text-text-secondary text-center mt-2 font-medium">
 Manage your business with ease
 </Text>
 </View>

 {/* 2FA Code Entry — replaces the normal card while a login is pending verification */}
 {pendingToken ? (
 <View className="bg-surface p-6 rounded-3xl border border-gray-100 shadow-xl">
 <Text className="text-xl font-bold text-text-primary mb-1">
 Enter Verification Code
 </Text>
 <Text className="text-text-secondary text-sm font-medium mb-4">
 We sent a 6-digit code to {email}. It expires in 10 minutes.
 </Text>

 {error && (
 <View className="bg-red-50 border border-red-200 p-4 rounded-xl mb-4">
 <Text className="text-error font-semibold text-base">{error}</Text>
 </View>
 )}
 {resendMsg && !error && (
 <View className="bg-blue-50 border border-blue-200 p-4 rounded-xl mb-4">
 <Text className="text-primary font-semibold text-sm">{resendMsg}</Text>
 </View>
 )}

 <TextInput
 value={otpCode}
 onChangeText={(v) => setOtpCode(v.replace(/\D/g, "").slice(0, 6))}
 placeholder="000000"
 placeholderTextColor="#A0A0A0"
 keyboardType="number-pad"
 maxLength={6}
 autoFocus
 className="bg-background text-text-primary border border-gray-200 rounded-xl px-4 py-4 font-bold text-3xl text-center tracking-widest focus:border-primary :border-primary-dark"
 />

 <Pressable
 onPress={handleVerifyCode}
 disabled={loading || otpCode.length !== 6}
 className="bg-primary mt-6 py-5 rounded-xl items-center active:opacity-90 shadow-md"
 accessibilityRole="button"
 accessibilityLabel="Verify & Log In"
 >
 {loading ? <ActivityIndicator color="white" /> : <Text className="text-white font-bold text-lg">Verify & Log In</Text>}
 </Pressable>

 <Pressable onPress={handleResendCode} className="mt-4 py-3 items-center" accessibilityRole="button" accessibilityLabel="Resend code">
 <Text className="text-primary font-semibold text-base">Resend Code</Text>
 </Pressable>

 <Pressable
 onPress={() => { setPendingToken(null); setOtpCode(""); setError(null); setResendMsg(null); }}
 className="py-3 items-center"
 accessibilityRole="button"
 accessibilityLabel="Back to log in"
 >
 <Text className="text-text-secondary font-semibold text-sm">Back to log in</Text>
 </Pressable>
 </View>
 ) : (
 <View className="bg-surface p-6 rounded-3xl border border-gray-100 shadow-xl">
 <Text className="text-xl font-bold text-text-primary mb-4">
 {isPinLogin ? "Quick PIN Login" : "Sign In"}
 </Text>

 {error && (
 <View className="bg-red-50 border border-red-200 p-4 rounded-xl mb-4">
 <Text className="text-error font-semibold text-base">{error}</Text>
 </View>
 )}

 {!isPinLogin ? (
 // Email / Password Form
 <View className="space-y-4">
 <View>
 <Text className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-2">
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
 className="bg-background text-text-primary border border-gray-200 rounded-xl px-4 py-4 text-base font-medium focus:border-primary :border-primary-dark"
 />
 </View>

 <View>
 <Text className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-2">
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
 className="bg-background text-text-primary border border-gray-200 rounded-xl px-4 py-4 text-base font-medium focus:border-primary :border-primary-dark"
 />
 </View>

 <View className="pt-1">
 <Text className="text-xs text-text-secondary ">
 Having trouble? Use email login (or request access).
 </Text>
 </View>
 </View>
 ) : (
 // PIN Form
 <View>
 <Text className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-2">
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
 className="bg-background text-text-primary border border-gray-200 rounded-xl px-4 py-4 font-bold text-3xl text-center tracking-widest focus:border-primary :border-primary-dark"
 />
 <Text className="text-xs text-text-secondary mt-3">
 Tip: Switch to email login if your session expired.
 </Text>
 </View>
 )}

 {/* Login Button */}
 <Pressable
 onPress={handleLogin}
 disabled={loading}
 className="bg-primary mt-6 py-5 rounded-xl items-center active:opacity-90 shadow-md"
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
 <Text className="text-primary font-semibold text-base">
 {isPinLogin ? "Use Email & Password" : "Use Quick PIN"}
 </Text>
 </Pressable>
 )}

 {!isPinLogin && (
 <>
 <Pressable
 onPress={() => router.push("/(auth)/forgot-password" as any)}
 className="mt-4 py-3 items-center"
 accessibilityRole="button"
 accessibilityLabel="Forgot password"
 >
 <Text className="text-primary font-semibold text-base">
 Forgot password?
 </Text>
 </Pressable>

 <Pressable
 onPress={() => router.push("/(auth)/register" as any)}
 className="mt-2 py-3 items-center"
 accessibilityRole="button"
 accessibilityLabel="Sign up with invite code"
 >
 <Text className="text-primary font-semibold text-base">
 Have an invite code? Sign Up
 </Text>
 </Pressable>

 <Text className="text-xs text-text-secondary mt-4 text-center">
 Need help? Contact support via your admin.
 </Text>
 </>
 )}
 </View>
 )}
 </View>
 </ScrollView>
 </KeyboardAvoidingView>
 );
}
