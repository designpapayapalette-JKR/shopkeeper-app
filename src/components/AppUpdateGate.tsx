import React, { useState, useEffect } from "react";
import { View, Text, Modal, Pressable, Linking } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { api } from "../lib/api";

interface VersionCheckResult {
  isOutdated: boolean;
  forceUpdate: boolean;
  daysRemainingInGracePeriod: number;
  latestVersion: string;
  updateUrl: string;
  message: string;
}

export function AppUpdateGate({ appType, children }: { appType: "admin" | "staff"; children: React.ReactNode }) {
  const [updateInfo, setUpdateInfo] = useState<VersionCheckResult | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const currentVersion = Constants.expoConfig?.version || "0.1.0";

  useEffect(() => {
    async function checkVersion() {
      try {
        const res = await api.get<any>(`/app/version-check`, {
          params: { app: appType, currentVersion },
        });
        if (res) {
          setUpdateInfo(res);
        }
      } catch {
        // Best-effort check — network offline or API error should not block user from opening app
      }
    }
    checkVersion();
  }, [appType, currentVersion]);

  // If 15-day grace period has expired or version is below minimum supported, show blocking modal
  const showBlockingModal = updateInfo?.forceUpdate === true;

  // If outdated but within 15-day grace period, show optional banner (if not dismissed)
  const showGracePeriodBanner =
    updateInfo?.isOutdated && !updateInfo?.forceUpdate && !bannerDismissed;

  return (
    <View style={{ flex: 1 }}>
      {children}

      {/* ── Grace Period Optional Banner (0–15 Days post release) ── */}
      {showGracePeriodBanner && (
        <View className="absolute top-12 left-4 right-4 bg-amber-500 rounded-2xl p-4 shadow-xl z-50 flex-row items-center justify-between">
          <View className="flex-row items-center flex-1 mr-2" style={{ gap: 10 }}>
            <MaterialCommunityIcons name="cloud-download-outline" size={24} color="#FFFFFF" />
            <View className="flex-1">
              <Text className="text-white font-bold text-xs">Update Available (v{updateInfo?.latestVersion})</Text>
              <Text className="text-white/90 text-[11px] mt-0.5" numberOfLines={2}>
                App continues working. {updateInfo?.daysRemainingInGracePeriod} day(s) left in grace period before force update.
              </Text>
            </View>
          </View>
          <View className="flex-row items-center" style={{ gap: 8 }}>
            <Pressable
              onPress={() => Linking.openURL(updateInfo?.updateUrl || "")}
              className="bg-white px-3 py-1.5 rounded-xl active:opacity-80"
            >
              <Text className="text-amber-800 font-bold text-xs">Update</Text>
            </Pressable>
            <Pressable onPress={() => setBannerDismissed(true)} className="p-1">
              <MaterialCommunityIcons name="close" size={18} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>
      )}

      {/* ── Blocking Force Update Modal (After 15-Day Grace Period Expired) ── */}
      <Modal
        visible={showBlockingModal}
        transparent={false}
        animationType="fade"
        onRequestClose={() => {
          // Prevent back button dismiss on Android
        }}
      >
        <View className="flex-1 bg-slate-900 justify-center items-center px-8 py-12">
          <View className="w-24 h-24 rounded-full bg-primary/20 items-center justify-center mb-6 border-2 border-primary/40">
            <MaterialCommunityIcons name="update" size={48} color="#0368FE" />
          </View>

          <Text className="text-2xl font-black text-white text-center mb-3">
            App Update Required
          </Text>

          <Text className="text-sm text-slate-300 text-center leading-relaxed mb-6">
            {updateInfo?.message ||
              `Your installed app version (v${currentVersion}) has completed its 15-day grace period. Please update to v${updateInfo?.latestVersion} to continue using the app.`}
          </Text>

          <View className="w-full bg-slate-800/80 rounded-2xl p-4 border border-slate-700 mb-8" style={{ gap: 8 }}>
            <View className="flex-row justify-between text-xs">
              <Text className="text-slate-400 font-medium">Your Version:</Text>
              <Text className="text-amber-400 font-bold">v{currentVersion}</Text>
            </View>
            <View className="flex-row justify-between text-xs">
              <Text className="text-slate-400 font-medium">Latest Version:</Text>
              <Text className="text-emerald-400 font-bold">v{updateInfo?.latestVersion}</Text>
            </View>
            <View className="flex-row justify-between text-xs">
              <Text className="text-slate-400 font-medium">Grace Period Status:</Text>
              <Text className="text-rose-400 font-bold">Expired (15 Days Completed)</Text>
            </View>
          </View>

          <Pressable
            onPress={() => Linking.openURL(updateInfo?.updateUrl || "")}
            className="w-full bg-primary py-4 rounded-2xl items-center shadow-lg active:opacity-90 flex-row justify-center"
            style={{ gap: 8 }}
          >
            <MaterialCommunityIcons name="download" size={20} color="#FFFFFF" />
            <Text className="text-white font-black text-sm uppercase tracking-widest">
              Update Now
            </Text>
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}
