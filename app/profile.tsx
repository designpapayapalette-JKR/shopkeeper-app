import React, { useState } from "react";
import { View, ScrollView, Text, Modal, Pressable } from "react-native";
import { Card, Button, List, Divider, Avatar, useTheme } from "react-native-paper";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAuth } from "../src/lib/auth-context";
import { useTopInset, useBottomInset } from "../src/lib/useTopInset";
import { useConfirm } from "../src/components/ConfirmDialog";
import RoleBadge from "../src/components/RoleBadge";
import { roleColor } from "../src/lib/roles";
import { useTerminology, type TerminologyLang } from "../src/lib/terminology-context";

const LANGUAGES: { key: TerminologyLang; label: string }[] = [
  { key: "en", label: "English" },
  { key: "hi", label: "हिंदी" },
  { key: "ta", label: "தமிழ்" },
  { key: "ml", label: "മലയാളം" },
  { key: "kn", label: "ಕನ್ನಡ" },
  { key: "te", label: "తెలుగు" },
  { key: "mr", label: "मराठी" },
  { key: "gu", label: "ગુજરાતી" },
];

export default function ProfileScreen() {
  const theme = useTheme();
  const { user, userRole, activeCompany, activeBrand, logout } = useAuth();
  const router = useRouter();
  const topInset = useTopInset();
  const bottomInset = useBottomInset(0);
  const confirm = useConfirm();
  const { lang, setLang } = useTerminology();
  const insets = useSafeAreaInsets();
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);

  const initials = [user?.firstName, user?.lastName].filter(Boolean).map((s: string) => s[0]).join("").toUpperCase() || "U";
  const badgeColor = roleColor(userRole);
  const outletName = user?.outlet?.name || activeCompany?.name || "Main Store";
  const isOwner = userRole === "owner";

  const handleLogout = async () => {
    const ok = await confirm({
      title: "Logout karein?",
      message: `You'll be signed out of ${outletName}. Any bill saved on this phone but not yet synced will stay safe and upload automatically next time you log in.`,
      confirmLabel: "Logout",
      cancelLabel: "Cancel",
      destructive: true,
    });
    if (ok) logout();
  };

  return (
    <ScrollView
      className="flex-1 bg-background dark:bg-bg-dark"
      contentContainerStyle={{ paddingTop: topInset + 16, paddingBottom: bottomInset + 24 }}
    >
      {/* Avatar + Name */}
      <View className="items-center px-4 mb-6">
        <Avatar.Text
          size={72}
          label={initials}
          color="#FFFFFF"
          style={{ backgroundColor: badgeColor, marginBottom: 12 }}
        />
        <Text className="font-headline-md text-on-surface dark:text-text-primary-dark text-center" style={{ fontSize: 22, fontWeight: "700" }}>
          {[user?.firstName, user?.lastName].filter(Boolean).join(" ") || "User"}
        </Text>
        <View className="flex-row items-center mt-1.5" style={{ gap: 6 }}>
          <MaterialCommunityIcons name="store" size={14} color={theme.colors.onSurfaceVariant} />
          <Text className="text-sm text-on-surface-variant dark:text-text-secondary-dark">{outletName}</Text>
        </View>
        <View className="mt-2">
          <RoleBadge role={userRole} />
        </View>
      </View>

      {/* Preferences — every row is icon + plain label + chevron; toggle rows
          reserve the trailing slot for a Switch, never both (design system §6.9) */}
      <Card mode="elevated" className="mx-4 mb-4">
        <List.Item
          title="Outlet / Brand"
          description={activeBrand?.name || "All Brands"}
          left={(props) => <List.Icon {...props} icon="store" />}
          titleStyle={{ fontSize: 16, fontWeight: "600" }}
        />
        <Divider />
        <List.Item
          title="Printer Settings"
          left={(props) => <List.Icon {...props} icon="printer" />}
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          titleStyle={{ fontSize: 16, fontWeight: "600" }}
          onPress={() => router.push("/printer-settings" as any)}
        />
        <Divider />
        <List.Item
          title="Bhasha (Language)"
          description={LANGUAGES.find((l) => l.key === lang)?.label}
          left={(props) => <List.Icon {...props} icon="translate" />}
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          titleStyle={{ fontSize: 16, fontWeight: "600" }}
          onPress={() => setShowLanguagePicker(true)}
        />
        <Divider />
        <List.Item
          title="Madad (Help)"
          left={(props) => <List.Icon {...props} icon="help-circle" />}
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          titleStyle={{ fontSize: 16, fontWeight: "600" }}
          onPress={() => router.push("/support-tickets" as any)}
        />
      </Card>

      {/* Account — only Owner/Manager get security settings surfaced here;
          Cashier/Godown Manager keep this tab short (design system §8.2) */}
      {isOwner && (
        <Card mode="elevated" className="mx-4 mb-4">
          <List.Item
            title="Account Security"
            left={(props) => <List.Icon {...props} icon="shield-lock" />}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            titleStyle={{ fontSize: 16, fontWeight: "600" }}
            onPress={() => router.push("/account-security" as any)}
          />
        </Card>
      )}

      {/* Logout */}
      <View className="px-4 mt-2">
        <Button
          mode="contained"
          buttonColor={theme.colors.error}
          textColor="#FFFFFF"
          icon="logout"
          onPress={handleLogout}
          className="mb-3"
          contentStyle={{ minHeight: 52 }}
          labelStyle={{ fontSize: 16, fontWeight: "700" }}
        >
          Logout
        </Button>
        <Text className="text-xs text-center text-on-surface-variant dark:text-text-secondary-dark">MMC User v1.0</Text>
      </View>

      {/* Language picker — bottom sheet, thumb-reachable one-handed
          (shopkeeper-mobile-design-system.md §6.8/§7.1: language selection
          is one tap from the Me tab always). */}
      <Modal visible={showLanguagePicker} transparent animationType="slide" onRequestClose={() => setShowLanguagePicker(false)}>
        <Pressable className="flex-1 bg-black/40 justify-end" onPress={() => setShowLanguagePicker(false)}>
          <Pressable
            onPress={() => {}}
            className="bg-surface-container-lowest dark:bg-surface-dark rounded-t-2xl px-lg pt-lg"
            style={{ paddingBottom: Math.max(insets.bottom, 16) + 16 }}
          >
            <View className="self-center rounded-full bg-outline-variant mb-lg" style={{ width: 40, height: 4 }} />
            <Text className="font-headline-sm text-on-surface dark:text-text-primary-dark mb-lg" style={{ fontSize: 18, fontWeight: "700" }}>
              Bhasha Chunein (Choose Language)
            </Text>
            {LANGUAGES.map((l) => (
              <Pressable
                key={l.key}
                onPress={() => {
                  setLang(l.key);
                  setShowLanguagePicker(false);
                }}
                className="flex-row items-center justify-between border-b border-outline-variant dark:border-outline"
                style={{ minHeight: 52, paddingVertical: 4 }}
              >
                <Text
                  className="text-on-surface dark:text-text-primary-dark"
                  style={{ fontSize: 17, fontWeight: lang === l.key ? "700" : "400" }}
                >
                  {l.label}
                </Text>
                {lang === l.key && <MaterialCommunityIcons name="check-circle" size={20} color={theme.colors.primary} />}
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}
