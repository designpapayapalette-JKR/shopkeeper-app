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
} from "react-native";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAuth } from "../../src/lib/auth-context";

// The app-first signup flow: download the app → redeem an invite code here
// → land straight in the forced onboarding wizard (app/_layout.tsx redirects
// any company with no onboardingCompletedAt) → web dashboard access follows
// once the account exists, using the same login. This is the only place a
// brand-new company can be created from the mobile app.
export default function RegisterScreen() {
 const { register } = useAuth();
 const router = useRouter();
 const [inviteCode, setInviteCode] = useState("");
 const [companyName, setCompanyName] = useState("");
 const [firstName, setFirstName] = useState("");
 const [lastName, setLastName] = useState("");
 const [state, setState] = useState("");
 const [email, setEmail] = useState("");
 const [password, setPassword] = useState("");
 const [error, setError] = useState<string | null>(null);
 const [loading, setLoading] = useState(false);

 const handleSubmit = async () => {
 setError(null);
 if (!inviteCode.trim() || !companyName.trim() || !firstName.trim() || !email.trim() || !password) {
 setError("Please fill in all required fields.");
 return;
 }
 setLoading(true);
 try {
 await register({
 inviteCode: inviteCode.trim().toUpperCase(),
 companyName: companyName.trim(),
 firstName: firstName.trim(),
 lastName: lastName.trim() || undefined,
 state: state.trim() || undefined,
 email: email.trim(),
 password,
 });
 // app/_layout.tsx's NavigationGuard takes it from here — a fresh
 // company has no onboardingCompletedAt yet, so it redirects into the
 // onboarding wizard automatically.
 router.replace("/");
 } catch (err: any) {
 setError(err.message || "Registration failed. Check your invite code and try again.");
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
 <View className="items-center mb-8">
 <View className="w-16 h-16 bg-primary rounded-2xl items-center justify-center shadow-lg mb-4">
 <Text className="text-white text-3xl font-bold">S</Text>
 </View>
 <Text className="text-3xl font-extrabold text-text-primary text-center tracking-tight">
 Start Your Free Trial
 </Text>
 <Text className="text-text-secondary text-center mt-2 font-medium">
 MMC Shop is invite-only during beta — enter your invite code below.
 </Text>
 </View>

 <View className="bg-surface p-6 rounded-3xl border border-gray-100 shadow-xl">
 {error && (
 <View className="bg-red-50 border border-red-200 p-4 rounded-xl mb-4">
 <Text className="text-error font-semibold text-base">{error}</Text>
 </View>
 )}

 <Field label="Invite Code *" value={inviteCode} onChangeText={(t) => setInviteCode(t.toUpperCase())} placeholder="XXXX-XXXX" autoCapitalize="characters" />
 <Field label="Business Name *" value={companyName} onChangeText={setCompanyName} placeholder="e.g. Sharma General Store" />
 <View className="flex-row" style={{ gap: 12 }}>
 <View className="flex-1">
 <Field label="First Name *" value={firstName} onChangeText={setFirstName} />
 </View>
 <View className="flex-1">
 <Field label="Last Name" value={lastName} onChangeText={setLastName} />
 </View>
 </View>
 <Field label="State" value={state} onChangeText={setState} placeholder="e.g. Maharashtra" />
 <Field label="Email *" value={email} onChangeText={setEmail} placeholder="you@business.com" autoCapitalize="none" keyboardType="email-address" />
 <Field label="Password *" value={password} onChangeText={setPassword} placeholder="At least 6 characters" secureTextEntry autoCapitalize="none" />

 <Pressable
 onPress={handleSubmit}
 disabled={loading}
 className="bg-primary mt-6 py-5 rounded-xl items-center active:opacity-90 shadow-md"
 >
 {loading ? <ActivityIndicator color="white" /> : <Text className="text-white font-bold text-lg">Create Account</Text>}
 </Pressable>

 <Pressable onPress={() => router.replace("/(auth)/login")} className="mt-6 py-3 items-center">
 <Text className="text-primary font-semibold text-base">Already have an account? Log In</Text>
 </Pressable>
 </View>
 </View>
 </ScrollView>
 </KeyboardAvoidingView>
 );
}

function Field(props: {
 label: string;
 value: string;
 onChangeText: (t: string) => void;
 placeholder?: string;
 secureTextEntry?: boolean;
 autoCapitalize?: "none" | "characters" | "words" | "sentences";
 keyboardType?: "default" | "email-address";
}) {
 const [reveal, setReveal] = useState(false);
 return (
 <View className="mt-4">
 <Text className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-2">
 {props.label}
 </Text>
 <View className="relative justify-center">
 <TextInput
 value={props.value}
 onChangeText={props.onChangeText}
 placeholder={props.placeholder}
 placeholderTextColor="#A0A0A0"
 secureTextEntry={props.secureTextEntry && !reveal}
 autoCapitalize={props.autoCapitalize ?? "words"}
 keyboardType={props.keyboardType ?? "default"}
 className={`bg-background text-text-primary border border-gray-200 rounded-xl px-4 py-4 text-base font-medium focus:border-primary :border-primary-dark ${props.secureTextEntry ? "pr-12" : ""}`}
 />
 {props.secureTextEntry && (
 <Pressable
 onPress={() => setReveal((v) => !v)}
 hitSlop={8}
 style={{ position: "absolute", right: 14 }}
 accessibilityRole="button"
 accessibilityLabel={reveal ? "Hide password" : "Show password"}
 >
 <MaterialCommunityIcons name={reveal ? "eye-off-outline" : "eye-outline"} size={22} color="#6B7280" />
 </Pressable>
 )}
 </View>
 </View>
 );
}
