import { Platform, PermissionsAndroid, Permission } from "react-native";
import * as Location from "expo-location";
import { Camera } from "expo-camera";

/**
 * Prompts the user for all required sensor permissions (Location, Camera, Bluetooth).
 * Ensures adherence to Play Store and App Store privacy guidelines.
 */
export async function requestAppPermissions() {
 const results = {
 location: false,
 camera: false,
 bluetooth: false,
 wifi: true,
 };

 try {
 // 1. Camera permission
 const cameraStatus = await Camera.requestCameraPermissionsAsync();
 results.camera = cameraStatus.granted;

 // 2. Location permission
 const locationStatus = await Location.requestForegroundPermissionsAsync();
 results.location = locationStatus.granted;

 // 3. Bluetooth permissions (Android 12+ requires explicit runtime check)
 if (Platform.OS === "android") {
 const permissionsToRequest: Permission[] = [];

 // Check if Android SDK version is 31+
 const androidVersion = typeof Platform.Version === "string" 
 ? parseInt(Platform.Version, 10) 
 : Platform.Version;

 if (androidVersion >= 31) {
 permissionsToRequest.push(
 PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
 PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT
 );
 }

 if (permissionsToRequest.length > 0) {
 const granted = await PermissionsAndroid.requestMultiple(permissionsToRequest);
 results.bluetooth =
 granted[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] === PermissionsAndroid.RESULTS.GRANTED &&
 granted[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] === PermissionsAndroid.RESULTS.GRANTED;
 } else {
 results.bluetooth = true;
 }
 } else {
 results.bluetooth = true;
 }
 } catch (e) {
 console.error("Error requesting permissions:", e);
 }

 return results;
}
