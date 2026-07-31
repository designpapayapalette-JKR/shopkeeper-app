import React, { useEffect, useState, useRef } from "react";
import { View, Text, Pressable, Animated } from "react-native";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  BusinessNotification,
  subscribeRealtimeNotifications,
} from "../lib/realtime-notification-engine";

const CHANNEL_CONFIG: Record<
  string,
  { icon: keyof typeof MaterialCommunityIcons.glyphMap; color: string; route: string }
> = {
  pos_sale: { icon: "cash-register", color: "#0368FE", route: "/(tabs)/pos" },
  b2b_invoice: { icon: "file-document-outline", color: "#7C3AED", route: "/(tabs)/pos" },
  inventory_alert: { icon: "alert-box-outline", color: "#D64545", route: "/(tabs)/inventory" },
  agent_expense: { icon: "wallet-outline", color: "#1E8E85", route: "/expenses" },
  attendance_alert: { icon: "account-clock-outline", color: "#2E9E5B", route: "/attendance" },
  udhaar_reminder: { icon: "account-arrow-left-outline", color: "#835400", route: "/aging-report" },
  system: { icon: "bell-outline", color: "#0368FE", route: "/notifications" },
};

export default function RealtimeNotificationBanner() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [currentNotif, setCurrentNotif] = useState<BusinessNotification | null>(null);
  const slideAnim = useRef(new Animated.Value(-120)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeRealtimeNotifications((notif) => {
      if (hideTimer.current) clearTimeout(hideTimer.current);

      setCurrentNotif(notif);

      // Slide Down Animation
      Animated.spring(slideAnim, {
        toValue: insets.top + 8,
        useNativeDriver: true,
        friction: 8,
        tension: 50,
      }).start();

      // Auto Dismiss after 4 seconds
      hideTimer.current = setTimeout(() => {
        dismissBanner();
      }, 4000);
    });

    return () => {
      unsubscribe();
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [insets.top, slideAnim]);

  const dismissBanner = () => {
    Animated.timing(slideAnim, {
      toValue: -140,
      duration: 300,
      useNativeDriver: true,
    }).start(() => setCurrentNotif(null));
  };

  if (!currentNotif) return null;

  const config = CHANNEL_CONFIG[currentNotif.type] || CHANNEL_CONFIG.system;

  return (
    <Animated.View
      style={{
        position: "absolute",
        top: 0,
        left: 16,
        right: 16,
        zIndex: 9999,
        transform: [{ translateY: slideAnim }],
      }}
    >
      <Pressable
        onPress={() => {
          dismissBanner();
          router.push(config.route as any);
        }}
        className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-4 flex-row items-center justify-between shadow-lg"
        style={{
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.15,
          shadowRadius: 12,
          elevation: 10,
        }}
      >
        <View className="flex-row items-center flex-1 mr-2" style={{ gap: 12 }}>
          <View
            className="w-10 h-10 rounded-xl items-center justify-center"
            style={{ backgroundColor: `${config.color}15` }}
          >
            <MaterialCommunityIcons name={config.icon} size={22} color={config.color} />
          </View>

          <View className="flex-1">
            <View className="flex-row items-center justify-between">
              <Text className="text-xs font-bold text-on-surface" numberOfLines={1}>
                {currentNotif.title}
              </Text>
              <Text className="text-[10px] text-on-surface-variant font-medium">Just now</Text>
            </View>
            <Text className="text-xs text-on-surface-variant mt-0.5" numberOfLines={2}>
              {currentNotif.body}
            </Text>
          </View>
        </View>

        <Pressable onPress={dismissBanner} className="p-1 -mr-1">
          <MaterialCommunityIcons name="close" size={18} color="#9CA3AF" />
        </Pressable>
      </Pressable>
    </Animated.View>
  );
}
