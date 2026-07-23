import { useEffect, useRef, useCallback } from "react";
import { apiUrl, getValidAccessToken } from "./api";

type SSEEvent =
  | "dashboard:update"
  | "ledger:update"
  | "stock:update"
  | "notification:new";

type SSECallback = (payload: unknown) => void;

const listeners = new Map<string, Set<SSECallback>>();
let abortController: AbortController | null = null;
let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
let reconnectCount = 0;

async function connect() {
  if (abortController) return;

  const token = await getValidAccessToken();
  if (!token) {
    reconnectTimeout = setTimeout(connect, 5000);
    return;
  }

  abortController = new AbortController();

  try {
    const response = await fetch(`${apiUrl}/realtime/events`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "text/event-stream",
      },
      signal: abortController.signal,
    });

    if (!response.ok) {
      abortController = null;
      scheduleReconnect();
      return;
    }

    reconnectCount = 0;
    const reader = response.body?.getReader();
    if (!reader) {
      abortController = null;
      scheduleReconnect();
      return;
    }

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      let currentEvent = "";
      let currentData = "";

      for (const line of lines) {
        if (line.startsWith("event: ")) {
          currentEvent = line.slice(7).trim();
        } else if (line.startsWith("data: ")) {
          currentData = line.slice(6).trim();
        } else if (line === "" && currentEvent && currentData) {
          try {
            const parsed = JSON.parse(currentData);
            listeners.get(currentEvent as SSEEvent)?.forEach((cb) => cb(parsed.payload));
          } catch {
            // malformed event data — skip
          }
          currentEvent = "";
          currentData = "";
        }
      }
    }
  } catch (error: any) {
    if (error?.name === "AbortError") return;
  }

  abortController = null;
  scheduleReconnect();
}

function scheduleReconnect() {
  if (reconnectTimeout) clearTimeout(reconnectTimeout);
  const delay = Math.min(2 ** reconnectCount * 1000, 30000);
  reconnectCount++;
  reconnectTimeout = setTimeout(connect, delay);
}

function disconnect() {
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }
  abortController?.abort();
  abortController = null;
  reconnectCount = 0;
}

export function useSSE(event: SSEEvent, callback: SSECallback, enabled = true) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  const stableCallback = useCallback(
    (payload: unknown) => callbackRef.current(payload),
    []
  );

  useEffect(() => {
    if (!enabled) return;

    if (!listeners.has(event)) {
      listeners.set(event, new Set());
    }
    listeners.get(event)!.add(stableCallback);

    if (!abortController) {
      connect();
    }

    return () => {
      listeners.get(event)?.delete(stableCallback);
      if (listeners.get(event)?.size === 0) {
        listeners.delete(event);
      }
      if (listeners.size === 0) {
        disconnect();
      }
    };
  }, [event, enabled, stableCallback]);
}
