import { File, Paths } from "expo-file-system";
import * as SecureStore from "expo-secure-store";

const LAST_SYNC_KEY = "mobile_read_cache_last_sync";

export interface CacheEntry<T = unknown> {
  data: T;
  cachedAt: number;
  updatedAtIso: string;
}

function getCacheFilePath(key: string): string {
  const safeKey = key.replace(/[^a-zA-Z0-9_-]/g, "_");
  return `readcache_${safeKey}.json`;
}

export async function setCachedEntity<T>(key: string, data: T): Promise<void> {
  try {
    const filename = getCacheFilePath(key);
    const file = new File(Paths.document, filename);
    const entry: CacheEntry<T> = {
      data,
      cachedAt: Date.now(),
      updatedAtIso: new Date().toISOString(),
    };
    if (file.exists) file.delete();
    file.create();
    file.write(JSON.stringify(entry));
  } catch (err) {
    console.warn(`[readCache] Failed to write cache for key "${key}":`, err);
  }
}

export async function getCachedEntity<T>(key: string): Promise<T | null> {
  try {
    const filename = getCacheFilePath(key);
    const file = new File(Paths.document, filename);
    if (!file.exists) return null;
    const raw = await file.text();
    const entry = JSON.parse(raw) as CacheEntry<T>;
    return entry && entry.data !== undefined ? entry.data : null;
  } catch {
    return null;
  }
}

export async function getLastSyncTime(): Promise<string> {
  try {
    const raw = await SecureStore.getItemAsync(LAST_SYNC_KEY);
    return raw || "1970-01-01T00:00:00.000Z";
  } catch {
    return "1970-01-01T00:00:00.000Z";
  }
}

export async function setLastSyncTime(timestampIso: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(LAST_SYNC_KEY, timestampIso);
  } catch (err) {
    console.warn("[readCache] Failed to save last sync timestamp:", err);
  }
}

const CACHED_ENTITY_KEYS = ["products", "parties", "invoices"];

export async function clearReadCache(): Promise<void> {
  for (const key of CACHED_ENTITY_KEYS) {
    try {
      const file = new File(Paths.document, getCacheFilePath(key));
      if (file.exists) file.delete();
    } catch (err) {
      console.warn(`[readCache] Failed to clear cache for key "${key}":`, err);
    }
  }
  try {
    await SecureStore.deleteItemAsync(LAST_SYNC_KEY);
  } catch (err) {
    console.warn("[readCache] Failed to clear last sync timestamp:", err);
  }
}
