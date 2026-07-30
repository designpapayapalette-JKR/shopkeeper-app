import React, { useState, useEffect, useRef } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAuth } from "../lib/auth-context";
import { getIsConnected } from "../lib/connectivity";
import { syncQueuedSales } from "../lib/offlineQueue";
import { setCachedEntity, getLastSyncTime, setLastSyncTime } from "../lib/readCache";
import { api } from "../lib/api";

export function SyncGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const [ready, setReady] = useState(false);
  const [statusText, setStatusText] = useState("Syncing latest data…");
  const ranRef = useRef(false);

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      ranRef.current = false;
      setReady(true);
      return;
    }

    if (ranRef.current) return;
    ranRef.current = true;

    async function runSyncGate() {
      // Bounded 1.5s max display time for initial sync overlay
      const maxTimer = setTimeout(() => {
        setReady(true);
      }, 1500);

      try {
        const connected = getIsConnected();
        if (connected) {
          setStatusText("Syncing pending sales…");
          try {
            await syncQueuedSales();
          } catch (e) {
            console.warn("[SyncGate] Offline sale sync error:", e);
          }

          setStatusText("Updating offline cache…");
          try {
            const lastSync = await getLastSyncTime();
            const res = await api.get<{
              data?: {
                since: string;
                serverTime: string;
                products?: unknown[];
                parties?: unknown[];
                invoices?: unknown[];
              };
            }>(`/sync/pull`, { params: { since: lastSync } });

            if (res?.data) {
              const data = res.data;
              if (Array.isArray(data.products)) await setCachedEntity("products", data.products);
              if (Array.isArray(data.parties)) await setCachedEntity("parties", data.parties);
              if (Array.isArray(data.invoices)) await setCachedEntity("invoices", data.invoices);
              if (data.serverTime) await setLastSyncTime(data.serverTime);
            }
          } catch (e) {
            console.warn("[SyncGate] Cache pull error:", e);
          }
        }
      } catch (err) {
        console.error("[SyncGate] Unexpected error during boot sync:", err);
      } finally {
        clearTimeout(maxTimer);
        setReady(true);
      }
    }

    runSyncGate();
  }, [isAuthenticated, isLoading]);

  return (
    <View style={{ flex: 1 }}>
      {children}
      {!ready && isAuthenticated && (
        <View style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, backgroundColor: "#0f172a", justifyContent: "center", alignItems: "center", zIndex: 99999 }}>
          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: "rgba(16,185,129,0.15)", alignItems: "center", justifyContent: "center", marginBottom: 20, borderWidth: 2, borderColor: "rgba(16,185,129,0.3)" }}>
            <MaterialCommunityIcons name="sync" size={36} color="#10B981" />
          </View>
          <Text style={{ fontSize: 18, fontWeight: "900", color: "#ffffff", marginBottom: 6 }}>Starting Up</Text>
          <Text style={{ fontSize: 12, color: "#94a3b8", marginBottom: 20 }}>{statusText}</Text>
          <ActivityIndicator size="small" color="#10B981" />
        </View>
      )}
    </View>
  );
}
