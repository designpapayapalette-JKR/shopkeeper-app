import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, Switch, Pressable, ActivityIndicator, Alert } from "react-native";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useTopInset } from "../src/lib/useTopInset";
import {
  getNotificationSettings,
  saveNotificationSettings,
  NotificationSettings,
} from "../src/lib/realtime-notification-engine";

export default function NotificationSettingsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const topInset = useTopInset();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<NotificationSettings>({
    pos_sale: true,
    b2b_invoice: true,
    inventory_alert: true,
    agent_expense: true,
    attendance_alert: true,
    udhaar_reminder: true,
    sound_enabled: true,
    vibration_enabled: true,
  });

  useEffect(() => {
    (async () => {
      const data = await getNotificationSettings();
      setSettings(data);
      setLoading(false);
    })();
  }, []);

  const toggleChannel = async (key: keyof NotificationSettings) => {
    const updated = { ...settings, [key]: !settings[key] };
    setSettings(updated);
    await saveNotificationSettings(updated);
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color="#0368FE" />
      </View>
    );
  }

  const channels: { key: keyof NotificationSettings; title: string; desc: string; icon: keyof typeof MaterialCommunityIcons.glyphMap; color: string }[] = [
    {
      key: "pos_sale",
      title: "POS & Retail Sales Alerts",
      desc: "Real-time notifications whenever counter billing occurs",
      icon: "cash-register",
      color: "#0368FE",
    },
    {
      key: "b2b_invoice",
      title: "B2B & GST Invoice Creation",
      desc: "Instant alerts on GST tax invoices generated for parties",
      icon: "file-document-outline",
      color: "#7C3AED",
    },
    {
      key: "inventory_alert",
      title: "Stock Reorder & Low Stock Warnings",
      desc: "Alerts when inventory falls below minimum reorder levels",
      icon: "alert-box-outline",
      color: "#D64545",
    },
    {
      key: "agent_expense",
      title: "Field Agent Activity & Expense Updates",
      desc: "Notifications for expenses submitted or collections logged by agents",
      icon: "wallet-outline",
      color: "#1E8E85",
    },
    {
      key: "attendance_alert",
      title: "Staff Attendance Check-In / Check-Out",
      desc: "Updates when staff or managers mark attendance across any location",
      icon: "account-clock-outline",
      color: "#2E9E5B",
    },
    {
      key: "udhaar_reminder",
      title: "Udhaar & Credit Overdue Alerts",
      desc: "Reminders for party accounts exceeding 30/60/90 days credit limits",
      icon: "account-arrow-left-outline",
      color: "#835400",
    },
  ];

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: topInset }}>
      {/* Header */}
      <View className="px-5 py-3 border-b border-outline-variant bg-surface-container-lowest flex-row items-center justify-between">
        <View className="flex-row items-center" style={{ gap: 12 }}>
          <Pressable onPress={() => router.back()} className="p-1 -ml-1">
            <MaterialCommunityIcons name="arrow-left" size={24} color="#15171A" />
          </Pressable>
          <View>
            <Text className="text-xl font-extrabold text-on-surface">Notification Channels</Text>
            <Text className="text-xs text-on-surface-variant mt-0.5">Customize live alert preferences</Text>
          </View>
        </View>
      </View>

      <ScrollView className="flex-1 px-5 py-4" contentContainerStyle={{ paddingBottom: 110 + insets.bottom }}>
        {/* Banner Card */}
        <View className="bg-primary/5 border border-primary/20 rounded-2xl p-4 mb-4 flex-row items-center" style={{ gap: 12 }}>
          <View className="w-10 h-10 rounded-xl bg-primary/10 items-center justify-center">
            <MaterialCommunityIcons name="tune-variant" size={22} color="#0368FE" />
          </View>
          <View className="flex-1">
            <Text className="text-xs font-bold text-on-surface">Real-time Alert Controls</Text>
            <Text className="text-xs text-on-surface-variant mt-0.5">
              By default, all business transactions and inventory events trigger instant alerts.
            </Text>
          </View>
        </View>

        {/* Business Notification Channels */}
        <Text className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2 ml-1">
          Business Event Channels
        </Text>

        <View className="bg-surface-container-lowest border border-outline-variant rounded-2xl overflow-hidden mb-5">
          {channels.map((channel, index) => (
            <View
              key={channel.key}
              className="p-4 flex-row items-center justify-between"
              style={{
                borderBottomWidth: index < channels.length - 1 ? 1 : 0,
                borderColor: "#E5E7EB",
              }}
            >
              <View className="flex-row items-center flex-1 mr-3" style={{ gap: 12 }}>
                <View
                  className="w-10 h-10 rounded-xl items-center justify-center"
                  style={{ backgroundColor: `${channel.color}15` }}
                >
                  <MaterialCommunityIcons name={channel.icon} size={22} color={channel.color} />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-bold text-on-surface">{channel.title}</Text>
                  <Text className="text-xs text-on-surface-variant mt-0.5">{channel.desc}</Text>
                </View>
              </View>

              <Switch
                value={settings[channel.key]}
                onValueChange={() => toggleChannel(channel.key)}
                trackColor={{ false: "#E5E7EB", true: "#0368FE" }}
                thumbColor="#FFFFFF"
              />
            </View>
          ))}
        </View>

        {/* Device Sound & Vibration Controls */}
        <Text className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2 ml-1">
          Sound & Haptics
        </Text>

        <View className="bg-surface-container-lowest border border-outline-variant rounded-2xl overflow-hidden mb-6">
          <View className="p-4 flex-row items-center justify-between border-b border-outline-variant">
            <View className="flex-row items-center flex-1 mr-3" style={{ gap: 12 }}>
              <View className="w-10 h-10 rounded-xl bg-primary/10 items-center justify-center">
                <MaterialCommunityIcons name="volume-high" size={22} color="#0368FE" />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-bold text-on-surface">Notification Sound</Text>
                <Text className="text-xs text-on-surface-variant mt-0.5">Play chime when new alerts arrive</Text>
              </View>
            </View>
            <Switch
              value={settings.sound_enabled}
              onValueChange={() => toggleChannel("sound_enabled")}
              trackColor={{ false: "#E5E7EB", true: "#0368FE" }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View className="p-4 flex-row items-center justify-between">
            <View className="flex-row items-center flex-1 mr-3" style={{ gap: 12 }}>
              <View className="w-10 h-10 rounded-xl bg-primary/10 items-center justify-center">
                <MaterialCommunityIcons name="vibrate" size={22} color="#0368FE" />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-bold text-on-surface">Vibration Alert</Text>
                <Text className="text-xs text-on-surface-variant mt-0.5">Haptic vibration pattern on incoming alert</Text>
              </View>
            </View>
            <Switch
              value={settings.vibration_enabled}
              onValueChange={() => toggleChannel("vibration_enabled")}
              trackColor={{ false: "#E5E7EB", true: "#0368FE" }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
