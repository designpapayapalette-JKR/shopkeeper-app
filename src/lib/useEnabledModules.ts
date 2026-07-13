import { useState, useEffect, useCallback, useRef } from "react";
import { AppState, AppStateStatus } from "react-native";
import { api } from "./api";

const POLL_INTERVAL = 30000;
const ALL_MODULES = [
  "pos", "b2b", "inventory", "warehouse", "ledger",
  "staff", "attendance", "agents", "challans",
  "payments", "expenses", "reports",
];

export function useEnabledModules() {
  const [enabledModules, setEnabledModules] = useState<string[]>(ALL_MODULES);
  const [loading, setLoading] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const fetchModules = useCallback(async () => {
    try {
      // Try mobile-specific config first
      const mobileRes: any = await api.get("/companies/me/mobile-modules");
      if (Array.isArray(mobileRes?.data) && mobileRes.data.length > 0) {
        setEnabledModules(mobileRes.data);
        return;
      }
      // Fall back to web modules
      const webRes: any = await api.get("/companies/me/modules");
      if (Array.isArray(webRes?.data) && webRes.data.length > 0) {
        setEnabledModules(webRes.data);
      }
    } catch {
      // Keep current state on error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchModules().then(() => setLoading(false));

    // Poll every 30s for real-time updates
    pollRef.current = setInterval(fetchModules, POLL_INTERVAL);

    // Re-fetch when app comes to foreground
    const sub = AppState.addEventListener("change", (nextState) => {
      if (appStateRef.current.match(/inactive|background/) && nextState === "active") {
        fetchModules();
      }
      appStateRef.current = nextState;
    });

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      sub.remove();
    };
  }, [fetchModules]);

  const isEnabled = useCallback(
    (moduleKey: string) => enabledModules.includes(moduleKey),
    [enabledModules]
  );

  return { enabledModules, isEnabled, loading, refresh: fetchModules };
}
