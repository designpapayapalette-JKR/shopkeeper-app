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
import { requestPasswordReset } from "../../src/lib/api";

// Mobile deliberately doesn't try to handle the reset link itself (that
// would need deep-link routing for a token that's really meant for a
// browser) — same account works on both, so this just triggers the email
// and points the user at the web reset page already live at
// app.managemycounter.com/reset-password.
export default function ForgotPasswordScreen() {
 const router = useRouter();
 const [email, setEmail] = useState("");
 const [loading, setLoading] = useState(false);
 const [error, setError] = useState<string | null>(null);
 const [sent, setSent] = useState(false);

 const handleSubmit = async () => {
 if (!email.trim()) {
 setError("Enter the email address on your account.");
 return;
 }
 setError(null);
 setLoading(true);
 try {
 await requestPasswordReset(email.trim());
 setSent(true);
 } catch (err: any) {
 setError(err.message || "Something went wrong. Please try again.");
 } finally {
 setLoading(false);
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
 <View className="items-center mb-10">
 <View className="w-16 h-16 rounded-2xl items-center justify-center shadow-lg mb-4 overflow-hidden">
 <Image source={require("../../assets/icon.png")} className="w-16 h-16" resizeMode="contain" />
 </View>
 <Text className="text-3xl font-extrabold text-text-primary text-center tracking-tight">
 Reset Password
 </Text>
 <Text className="text-text-secondary text-center mt-2 font-medium">
 We'll email you a link to set a new password.
 </Text>
 </View>

 <View className="bg-surface p-6 rounded-3xl border border-gray-100 shadow-xl">
 {sent ? (
 <>
 <Text className="text-xl font-bold text-text-primary mb-2">
 Check your email
 </Text>
 <Text className="text-text-secondary text-sm font-medium mb-6">
 If an account exists for {email}, a reset link has been sent. Open it on your
 phone or computer to set a new password, then come back and sign in here.
 </Text>
 <Pressable
 onPress={() => router.back()}
 className="bg-primary py-5 rounded-xl items-center active:opacity-90 shadow-md"
 accessibilityRole="button"
 accessibilityLabel="Back to log in"
 >
 <Text className="text-white font-bold text-lg">Back to Log In</Text>
 </Pressable>
 </>
 ) : (
 <>
 <Text className="text-xl font-bold text-text-primary mb-4">
 Forgot Password
 </Text>

 {error && (
 <View className="bg-red-50 border border-red-200 p-4 rounded-xl mb-4">
 <Text className="text-error font-semibold text-base">{error}</Text>
 </View>
 )}

 <Text className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-2">
 Email Address
 </Text>
 <TextInput
 value={email}
 onChangeText={setEmail}
 placeholder="you@business.com"
 placeholderTextColor="#A0A0A0"
 autoCapitalize="none"
 autoFocus
 keyboardType="email-address"
 autoCorrect={false}
 className="bg-background text-text-primary border border-gray-200 rounded-xl px-4 py-4 text-base font-medium focus:border-primary :border-primary-dark"
 />

 <Pressable
 onPress={handleSubmit}
 disabled={loading}
 className="bg-primary mt-6 py-5 rounded-xl items-center active:opacity-90 shadow-md"
 accessibilityRole="button"
 accessibilityLabel="Send reset link"
 >
 {loading ? <ActivityIndicator color="white" /> : <Text className="text-white font-bold text-lg">Send Reset Link</Text>}
 </Pressable>

 <Pressable onPress={() => router.back()} className="mt-4 py-3 items-center" accessibilityRole="button" accessibilityLabel="Back to log in">
 <Text className="text-primary font-semibold text-base">Back to Log In</Text>
 </Pressable>
 </>
 )}
 </View>
 </View>
 </ScrollView>
 </KeyboardAvoidingView>
 );
}
