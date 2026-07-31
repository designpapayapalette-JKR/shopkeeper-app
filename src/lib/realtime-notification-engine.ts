import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

export interface BusinessNotification {
  id: string;
  title: string;
  body: string;
  type: "pos_sale" | "b2b_invoice" | "inventory_alert" | "agent_expense" | "attendance_alert" | "udhaar_reminder" | "system";
  created_at: string;
  is_read: boolean;
  data?: any;
}

export interface NotificationSettings {
  pos_sale: boolean;
  b2b_invoice: boolean;
  inventory_alert: boolean;
  agent_expense: boolean;
  attendance_alert: boolean;
  udhaar_reminder: boolean;
  sound_enabled: boolean;
  vibration_enabled: boolean;
}

const SETTINGS_STORAGE_KEY = "mmc_owner_notification_settings_v1";
const NOTIFS_STORAGE_KEY = "mmc_owner_notifications_list_v1";

const DEFAULT_SETTINGS: NotificationSettings = {
  pos_sale: true,
  b2b_invoice: true,
  inventory_alert: true,
  agent_expense: true,
  attendance_alert: true,
  udhaar_reminder: true,
  sound_enabled: true,
  vibration_enabled: true,
};

type NotificationListener = (notif: BusinessNotification) => void;
const listeners: Set<NotificationListener> = new Set();

export function subscribeRealtimeNotifications(listener: NotificationListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function getNotificationSettings(): Promise<NotificationSettings> {
  try {
    const raw = await SecureStore.getItemAsync(SETTINGS_STORAGE_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {}
  return DEFAULT_SETTINGS;
}

export async function saveNotificationSettings(settings: NotificationSettings): Promise<void> {
  try {
    await SecureStore.setItemAsync(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {}
}

export async function triggerBusinessNotification(
  type: BusinessNotification["type"],
  title: string,
  body: string,
  data?: any
): Promise<void> {
  const settings = await getNotificationSettings();

  // Check if channel is enabled in owner preferences
  if (type !== "system" && !settings[type]) {
    return;
  }

  const notif: BusinessNotification = {
    id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    title,
    body,
    type,
    created_at: new Date().toISOString(),
    is_read: false,
    data,
  };

  // 1. Save to local persistent notifications list
  try {
    const raw = await SecureStore.getItemAsync(NOTIFS_STORAGE_KEY);
    const existing: BusinessNotification[] = raw ? JSON.parse(raw) : [];
    const updated = [notif, ...existing].slice(0, 100);
    await SecureStore.setItemAsync(NOTIFS_STORAGE_KEY, JSON.stringify(updated));
  } catch {}

  // 2. Broadcast to in-app listeners (for drop-down banner)
  listeners.forEach((listener) => {
    try {
      listener(notif);
    } catch {}
  });

  // 3. Trigger local system notification with sound & vibration
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: data || {},
        sound: settings.sound_enabled ? "default" : undefined,
      },
      trigger: null, // immediate
    });
  } catch {}
}
