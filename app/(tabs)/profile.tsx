import React, { useState } from "react";
import { View, ScrollView, Text, Modal, Pressable, Linking } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "react-native-paper";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "../../src/lib/auth-context";
import { useTopInset, useBottomInset } from "../../src/lib/useTopInset";
import { useConfirm } from "../../src/components/ConfirmDialog";
import { roleLabel } from "../../src/lib/roles";
import { useTerminology, type TerminologyLang } from "../../src/lib/terminology-context";
import { useOutlet } from "../../src/lib/outlet-context";
import { useModuleVisibility } from "../../src/lib/useModuleVisibility";

const LANGUAGES: { key: TerminologyLang; label: string }[] = [
  { key: "en", label: "English" }, { key: "hi", label: "हिंदी" }, { key: "ta", label: "தமிழ்" },
  { key: "ml", label: "മലയാളം" }, { key: "kn", label: "ಕನ್ನಡ" }, { key: "te", label: "తెలుగు" },
  { key: "mr", label: "मराठी" }, { key: "gu", label: "ગુજરાતી" },
];

function MenuRow({ icon, title, description, onPress, showChevron = true, titleBold = true }: any) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} className="flex-row items-center px-5 py-4" style={{ minHeight: 52 }}>
      <MaterialCommunityIcons name={icon} size={22} color={theme.colors.onSurfaceVariant} style={{ width: 28 }} />
      <View className="flex-1 ml-3">
        <Text className={`text-sm ${titleBold ? "font-bold" : "font-medium"} text-on-surface`}>{title}</Text>
        {description && <Text className="text-xs text-on-surface-variant mt-0.5">{description}</Text>}
      </View>
      {showChevron && <MaterialCommunityIcons name="chevron-right" size={20} color="#9CA3AF" />}
    </Pressable>
  );
}

export default function ProfileScreen() {
  const theme = useTheme();
  const { user, userRole, activeCompany, logout } = useAuth();
  const router = useRouter();
  const topInset = useTopInset();
  const bottomInset = useBottomInset(0);
  const confirm = useConfirm();
  const { lang, setLang } = useTerminology();
  const insets = useSafeAreaInsets();
  const { outlets, selectedOutlet, selectedOutletId, setSelectedOutletId, loading: outletsLoading } = useOutlet();
  const { getVisibleChildren } = useModuleVisibility(userRole);
  const [showLang, setShowLang] = useState(false);
  const [showOutlet, setShowOutlet] = useState(false);

  // Mirrors shopkeeper-web's top-right account menu — Business Settings and
  // Back Office live under the profile avatar there too, instead of being
  // scattered across the sidebar. Same MODULE_CATEGORIES data the dashboard
  // grid uses, just rendered as a settings list instead of icon tiles.
  const settingsItems = getVisibleChildren("settings-hub");
  const backOfficeItems = getVisibleChildren("back-office");

  const initials = [user?.firstName, user?.lastName].filter(Boolean).map((s: string) => s[0]).join("").toUpperCase() || "U";
  const outletName = user?.outlet?.name || activeCompany?.name || "Main Store";
  const isOwner = userRole === "owner";
  const isManager = userRole === "manager";

  const handleLogout = async () => {
    const ok = await confirm({ title: "Logout karein?", message: `You'll be signed out of ${outletName}.`, confirmLabel: "Logout", cancelLabel: "Cancel", destructive: true });
    if (ok) logout();
  };

  return (
    <ScrollView className="flex-1 bg-background" contentContainerStyle={{ paddingBottom: bottomInset + 24 }}>
      {/* Gradient hero — matches Login/Dashboard's visual language
          (feedback_ui_visual_quality.md) instead of a flat avatar-on-white-bg. */}
      <LinearGradient
        colors={["#0368FE", "#000D3A"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          paddingTop: topInset + 16,
          paddingBottom: 32,
          paddingHorizontal: 20,
          borderBottomLeftRadius: 28,
          borderBottomRightRadius: 28,
          alignItems: "center",
          overflow: "hidden",
          marginBottom: 24,
        }}
      >
        <View style={{ position: "absolute", top: -50, right: -30, width: 130, height: 130, borderRadius: 65, backgroundColor: "rgba(255,255,255,0.08)" }} />
        <View style={{ position: "absolute", bottom: -40, left: -20, width: 100, height: 100, borderRadius: 50, backgroundColor: "rgba(3,168,254,0.16)" }} />

        <View
          className="w-[72px] h-[72px] rounded-full items-center justify-center mb-3"
          style={{ backgroundColor: "rgba(255,255,255,0.16)", borderWidth: 2, borderColor: "rgba(255,255,255,0.35)" }}
        >
          <Text className="text-white font-bold" style={{ fontSize: 26 }}>{initials}</Text>
        </View>
        <Text style={{ color: "#FFFFFF", fontSize: 22, fontWeight: "800", textAlign: "center" }}>
          {[user?.firstName, user?.lastName].filter(Boolean).join(" ") || "User"}
        </Text>
        <View className="flex-row items-center mt-1.5" style={{ gap: 6 }}>
          <MaterialCommunityIcons name="store" size={13} color="rgba(255,255,255,0.65)" />
          <Text style={{ color: "rgba(255,255,255,0.75)", fontSize: 13 }}>{outletName}</Text>
        </View>
        <View style={{ marginTop: 10, backgroundColor: "rgba(255,255,255,0.18)", paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999 }}>
          <Text style={{ color: "#FFFFFF", fontSize: 12, fontWeight: "700" }}>{roleLabel(userRole)}</Text>
        </View>
      </LinearGradient>

      {/* Business Settings — moved here from the Dashboard grid to match
          shopkeeper-web's top-right account menu. */}
      {settingsItems.length > 0 && (
        <>
          <Text className="text-xs font-extrabold text-on-surface-variant uppercase tracking-wider mx-5 mb-2">
            Business Settings
          </Text>
          <View className="mx-5 mb-4 bg-surface-container-lowest border border-outline-variant rounded-2xl overflow-hidden">
            {settingsItems.map((item, idx) => (
              <React.Fragment key={item.key}>
                {idx > 0 && <View className="h-px bg-outline-variant mx-5" />}
                <MenuRow icon={item.icon} title={item.label} description={item.desc} onPress={() => router.push(item.route as any)} />
              </React.Fragment>
            ))}
          </View>
        </>
      )}

      {backOfficeItems.length > 0 && (
        <>
          <Text className="text-xs font-extrabold text-on-surface-variant uppercase tracking-wider mx-5 mb-2">
            Back Office
          </Text>
          <View className="mx-5 mb-4 bg-surface-container-lowest border border-outline-variant rounded-2xl overflow-hidden">
            {backOfficeItems.map((item, idx) => (
              <React.Fragment key={item.key}>
                {idx > 0 && <View className="h-px bg-outline-variant mx-5" />}
                <MenuRow icon={item.icon} title={item.label} description={item.desc} onPress={() => router.push(item.route as any)} />
              </React.Fragment>
            ))}
          </View>
        </>
      )}

      {/* Preferences */}
      <View className="mx-5 mb-4 bg-surface-container-lowest border border-outline-variant rounded-2xl overflow-hidden">
        {(isOwner || (isManager && outlets.length > 1)) && (
          <MenuRow icon="store" title="Outlet" description={selectedOutlet?.name || activeCompany?.name || "All Outlets"}
            onPress={() => setShowOutlet(true)} />
        )}
        {isManager && outlets.length <= 1 && (
          <MenuRow icon="store" title={outletName} showChevron={false} />
        )}
        <View className="h-px bg-outline-variant mx-5" />
        <MenuRow icon="printer" title="Printer Settings" onPress={() => router.push("/printer-settings" as any)} />
        <View className="h-px bg-outline-variant mx-5" />
        <MenuRow icon="translate" title="Bhasha (Language)" description={LANGUAGES.find((l) => l.key === lang)?.label}
          onPress={() => setShowLang(true)} />
        <View className="h-px bg-outline-variant mx-5" />
        <MenuRow icon="cash-multiple" title="My Payslip" onPress={() => router.push("/payroll" as any)} />
        {!isOwner && (
          <>
            <View className="h-px bg-outline-variant mx-5" />
            <MenuRow icon="calendar-check" title="My Attendance" onPress={() => router.push("/attendance" as any)} />
          </>
        )}
        {isOwner && (
          <>
            <View className="h-px bg-outline-variant mx-5" />
            <MenuRow icon="open-in-new" title="Open Full Admin (Web)" onPress={() => Linking.openURL("https://manage.mycounter.com")} />
          </>
        )}
        <View className="h-px bg-outline-variant mx-5" />
        <MenuRow icon="help-circle" title="Need help?" description="Call or WhatsApp support"
          onPress={() => { const phone = activeCompany?.support_phone || "+918080000000"; Linking.openURL(`tel:${phone}`); }} />
      </View>

      {/* Logout */}
      <View className="px-5 mt-2">
        <Pressable onPress={handleLogout}
          className="bg-error py-4 rounded-2xl flex-row items-center justify-center" style={{ gap: 8, minHeight: 52 }}>
          <MaterialCommunityIcons name="logout" size={18} color="white" />
          <Text className="text-white font-bold text-base">Logout</Text>
        </Pressable>
        <Text className="text-xs text-center text-on-surface-variant mt-3">MMC User v2.0</Text>
      </View>

      {/* Language picker */}
      <Modal visible={showLang} transparent animationType="slide" onRequestClose={() => setShowLang(false)}>
        <Pressable className="flex-1 bg-black/40 justify-end" onPress={() => setShowLang(false)}>
          <Pressable onPress={() => {}}
            className="bg-surface-container-lowest rounded-t-2xl px-5 pt-5"
            style={{ paddingBottom: Math.max(insets.bottom, 16) + 16 }}>
            <View className="self-center rounded-full bg-outline-variant mb-4" style={{ width: 40, height: 4 }} />
            <Text className="font-headline-md text-on-surface mb-4" style={{ fontSize: 18, fontWeight: "700" }}>Bhasha Chunein (Choose Language)</Text>
            {LANGUAGES.map((l) => (
              <Pressable key={l.key} onPress={() => { setLang(l.key); setShowLang(false); }}
                className="flex-row items-center justify-between border-b border-outline-variant" style={{ minHeight: 52, paddingVertical: 4 }}>
                <Text className="text-on-surface" style={{ fontSize: 17, fontWeight: lang === l.key ? "700" : "400" }}>{l.label}</Text>
                {lang === l.key && <MaterialCommunityIcons name="check-circle" size={20} color={theme.colors.primary} />}
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Outlet picker */}
      <Modal visible={showOutlet} transparent animationType="slide" onRequestClose={() => setShowOutlet(false)}>
        <Pressable className="flex-1 bg-black/40 justify-end" onPress={() => setShowOutlet(false)}>
          <Pressable onPress={() => {}}
            className="bg-surface-container-lowest rounded-t-2xl px-5 pt-5"
            style={{ paddingBottom: Math.max(insets.bottom, 16) + 16, maxHeight: "70%" }}>
            <View className="self-center rounded-full bg-outline-variant mb-4" style={{ width: 40, height: 4 }} />
            <Text className="font-headline-md text-on-surface mb-4" style={{ fontSize: 18, fontWeight: "700" }}>Select Outlet</Text>
            {outletsLoading ? (
              <View className="py-8 items-center"><Text className="text-sm text-on-surface-variant">Loading outlets...</Text></View>
            ) : (
              <ScrollView>
                {outlets.map((o: any) => {
                  const isActive = o.id === selectedOutletId;
                  return (
                    <Pressable key={o.id} onPress={() => { setSelectedOutletId(o.id); setShowOutlet(false); }}
                      className="flex-row items-center py-4 px-2 border-b border-outline-variant">
                      <View className="w-10 h-10 rounded-full items-center justify-center mr-3" style={{ backgroundColor: isActive ? theme.colors.primary : theme.colors.outlineVariant }}>
                        <MaterialCommunityIcons name={isActive ? "store-check" : "store-outline"} size={20} color={isActive ? "#fff" : "#6B7280"} />
                      </View>
                      <View className="flex-1">
                        <Text className={`text-base font-bold ${isActive ? "text-primary" : "text-on-surface"}`}>{o.name}</Text>
                        <Text className="text-xs text-on-surface-variant mt-0.5 capitalize">{o.type?.replace("_", " ")}</Text>
                      </View>
                      {isActive && <MaterialCommunityIcons name="check-circle" size={22} color={theme.colors.primary} />}
                    </Pressable>
                  );
                })}
                {isOwner && (
                  <Pressable onPress={() => { setSelectedOutletId(null); setShowOutlet(false); }}
                    className="mt-4 py-3 rounded-xl items-center border border-outline-variant">
                    <Text className="text-sm font-bold text-on-surface-variant">All Outlets (Owner View)</Text>
                  </Pressable>
                )}
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}
