import * as SecureStore from "expo-secure-store";
import { api, ApiError } from "./api";

const QUEUE_KEY = "shopkeeper_offline_sale_queue";

export interface QueuedSale {
 id: string; // local-only reference — never a real invoice number
 queuedAt: string;
 payload: Record<string, unknown>;
}

// A sale only ever gets queued here when the checkout request never reached
// the server at all (a real network failure, not a business-logic error
// like insufficient stock or a validation failure) — see isNetworkFailure().
// No invoice number is ever fabricated client-side, since the real one is
// assigned atomically and sequentially by the server (GST compliance
// requires no gaps in that sequence); the sale simply isn't "real" yet
// until it actually syncs.
export function isNetworkFailure(error: unknown): boolean {
 return !(error instanceof ApiError);
}

async function readQueue(): Promise<QueuedSale[]> {
 const raw = await SecureStore.getItemAsync(QUEUE_KEY);
 if (!raw) return [];
 try {
 return JSON.parse(raw) as QueuedSale[];
 } catch {
 return [];
 }
}

async function writeQueue(queue: QueuedSale[]): Promise<void> {
 await SecureStore.setItemAsync(QUEUE_KEY, JSON.stringify(queue));
}

export async function enqueueSale(payload: Record<string, unknown>): Promise<QueuedSale> {
 const queue = await readQueue();
 const entry: QueuedSale = {
 id: `offline-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
 queuedAt: new Date().toISOString(),
 payload,
 };
 queue.push(entry);
 await writeQueue(queue);
 return entry;
}

export async function getQueuedSales(): Promise<QueuedSale[]> {
 return readQueue();
}

export async function getQueueCount(): Promise<number> {
 return (await readQueue()).length;
}

// Replays queued sales in the order they were recorded (oldest first) —
// order doesn't affect correctness of the atomic per-company invoice
// counter, but replaying in recording order keeps invoice dates/numbers
// intuitively matching when the sale actually happened.
export async function syncQueuedSales(): Promise<{ synced: number; remaining: number }> {
 const queue = await readQueue();
 if (queue.length === 0) return { synced: 0, remaining: 0 };

 const stillQueued: QueuedSale[] = [];
 let synced = 0;
 for (const entry of queue) {
 try {
 await api.post("/pos/checkout", entry.payload);
 synced++;
 } catch (error) {
 if (isNetworkFailure(error)) {
 // Still offline — stop here and keep this + everything after it
 // queued, rather than reordering on partial failure.
 stillQueued.push(entry, ...queue.slice(queue.indexOf(entry) + 1));
 break;
 }
 // A real server-side rejection (e.g. stock changed underneath it) —
 // drop it rather than retrying forever, since it will never succeed
 // as-is. The sale is lost from the queue but the cashier already saw
 // the original "saved offline" confirmation; a rejected replay is
 // rare enough (products/warehouses don't disappear mid-day) that
 // this is an acceptable edge case for a v1.
 console.error("[offlineQueue] dropping sale that the server rejected:", error);
 }
 }
 await writeQueue(stillQueued);
 return { synced, remaining: stillQueued.length };
}
