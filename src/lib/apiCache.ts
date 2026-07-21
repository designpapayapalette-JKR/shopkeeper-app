import { File, Directory, Paths } from "expo-file-system";

const DEFAULT_TTL_MS = 60 * 60 * 1000; // 1 hour

export function getCacheKey(endpoint: string, params?: Record<string, any>): string {
 const paramStr = params ? `?${JSON.stringify(params)}` : "";
 return `api_${endpoint.replace(/\//g, "_")}${paramStr}.json`;
}

export async function writeCache<T>(key: string, data: T): Promise<void> {
 try {
 const file = new File(Paths.cache, key);
 const entry = { data, cachedAt: Date.now() };
 if (file.exists) file.delete();
 file.create();
 file.write(JSON.stringify(entry));
 } catch (e) {
 console.warn("[apiCache] write failed:", e);
 }
}

export async function readCache<T>(key: string, ttlMs = DEFAULT_TTL_MS): Promise<T | null> {
 try {
 const file = new File(Paths.cache, key);
 if (!file.exists) return null;
 const raw = await file.text();
 const entry = JSON.parse(raw);
 if (!entry || !entry.data) return null;
 if (Date.now() - (entry.cachedAt ?? 0) > ttlMs) {
 file.delete();
 return null;
 }
 return entry.data as T;
 } catch {
 return null;
 }
}

export async function clearCache(): Promise<void> {
 try {
 const cacheDir = new Directory(Paths.cache);
 for (const item of cacheDir.list()) {
 if (item instanceof File && item.name.startsWith("api_")) {
 item.delete();
 }
 }
 } catch (e) {
 console.warn("[apiCache] clear failed:", e);
 }
}
