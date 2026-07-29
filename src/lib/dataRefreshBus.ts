/**
 * Minimal pub/sub so screens can react when auth-context invalidates
 * tenant-scoped data (e.g. on a brand/company switch) without a global
 * state manager or React Query — just a plain Set of listeners.
 */
export type RefreshTopic = "products" | "parties" | "invoices";

const listeners: Record<RefreshTopic, Set<() => void>> = {
  products: new Set(),
  parties: new Set(),
  invoices: new Set(),
};

export function subscribeDataRefresh(topic: RefreshTopic, listener: () => void): () => void {
  listeners[topic].add(listener);
  return () => listeners[topic].delete(listener);
}

export function emitDataRefresh(topic: RefreshTopic): void {
  listeners[topic].forEach((listener) => listener());
}
