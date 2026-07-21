import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import { api } from "./api";

// Foreground notifications still show a banner/sound instead of being
// silently swallowed — the default behavior on Android is to suppress
// them while the app is open, which would make "Low Stock Alert" etc.
// invisible during the exact POS session where it matters most.
Notifications.setNotificationHandler({
 handleNotification: async () => ({
 shouldShowAlert: true,
 shouldPlaySound: true,
 shouldSetBadge: false,
 shouldShowBanner: true,
 shouldShowList: true,
 }),
});

// Delivery requires the app's release build to embed real Firebase (FCM)
// credentials (google-services.json) for this package name — Expo's push
// service is only the relay in front of FCM, not a replacement for it. If
// that file isn't present in the native build, token registration below
// will still run without crashing, but notifications will never arrive.
export async function registerForPushNotifications(): Promise<void> {
 if (!Device.isDevice) return; // push tokens don't work on simulators

 const { status: existingStatus } = await Notifications.getPermissionsAsync();
 let finalStatus = existingStatus;
 if (existingStatus !== "granted") {
 const { status } = await Notifications.requestPermissionsAsync();
 finalStatus = status;
 }
 if (finalStatus !== "granted") return;

 if (Platform.OS === "android") {
 await Notifications.setNotificationChannelAsync("default", {
 name: "default",
 importance: Notifications.AndroidImportance.HIGH,
 vibrationPattern: [0, 250, 250, 250],
 lightColor: "#0368FE",
 });
 }

 try {
 const projectId = "a9c628d7-7fd8-481b-8076-a32a0ce72a68";
 const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
 await api.post("/auth/push-token", { push_token: tokenResponse.data });
 } catch (e) {
 console.error("Failed to register push token:", e);
 }
}
