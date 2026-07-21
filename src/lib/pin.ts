import { sha256 } from "js-sha256";
import * as SecureStore from "expo-secure-store";

const pinKey = (userId: string) => `staff_pin_hash_${userId}`;

// Pure-JS hash (no native module) so this never requires a fresh EAS dev-client
// build just to add PIN support — SecureStore already keeps the hash off any
// shared/synced storage, which is the actual security boundary here.
async function hashPin(pin: string): Promise<string> {
 return sha256(pin);
}

export async function setPin(userId: string, pin: string): Promise<void> {
 const hash = await hashPin(pin);
 await SecureStore.setItemAsync(pinKey(userId), hash);
}

export async function hasPin(userId: string): Promise<boolean> {
 const stored = await SecureStore.getItemAsync(pinKey(userId));
 return stored !== null;
}

export async function verifyPin(userId: string, pin: string): Promise<boolean> {
 const stored = await SecureStore.getItemAsync(pinKey(userId));
 if (!stored) return false;
 const hash = await hashPin(pin);
 return hash === stored;
}

export async function clearPin(userId: string): Promise<void> {
 await SecureStore.deleteItemAsync(pinKey(userId));
}

const LAST_USER_KEY = "last_authenticated_user_id";

export async function setLastUserId(userId: string): Promise<void> {
 await SecureStore.setItemAsync(LAST_USER_KEY, userId);
}

export async function getLastUserId(): Promise<string | null> {
 return SecureStore.getItemAsync(LAST_USER_KEY);
}
