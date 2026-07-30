import { useState, useEffect, useCallback, useRef } from "react";
import { AppState, AppStateStatus } from "react-native";
import { api } from "./api";
import { ALL_MODULES, ROLE_MODULES, MODULE_CATEGORIES, OUTLET_TYPE_BLOCKED_GATE_KEYS, type UserRole, type ModuleCategory, type ModuleItem } from "./moduleCategories";

// Poll every 5 minutes — module list rarely changes.
const POLL_INTERVAL = 5 * 60 * 1000;

// Module-level cache to avoid duplicate requests across multiple hook instances.
let _cachedModules: string[] | null = null;
let _cacheTs = 0;
const CACHE_TTL = POLL_INTERVAL;
const MODULE_GATE_KEYS: Record<string, string> = {
  pos: "pos", history: "pos", "held-bills": "pos", returns: "pos",
  b2b: "b2b", "sales-orders": "b2b", "price-lists": "b2b", "bulk-price-update": "b2b",
  estimates: "estimates", "recurring-invoices": "estimates",
  inventory: "inventory", categories: "inventory", barcodes: "inventory",
  "reorder-suggestions": "inventory", "gst-rate-tools": "inventory",
  purchases: "warehouse", "purchase-history": "warehouse", "purchase-orders": "warehouse",
  warehouse: "warehouse", challans: "challans",
  ledger: "ledger", payments: "payments", expenses: "expenses",
  "customer-groups": "ledger", "credit-note": "ledger", "debit-note": "ledger",
  "unified-ledger": "ledger", staff: "staff", attendance: "attendance",
  payroll: "payroll", agents: "agents", "referral-program": "referrals",
  "pnl-report": "reports", "balance-sheet": "reports", "gst-reports": "reports",
  daybook: "reports", "aging-report": "reports", "bank-accounts": "reports",
  "bank-reconciliation": "reports", analytics: "reports", "financial-year": "reports",
};

export function useModuleVisibility(userRole: UserRole | null | undefined, outletType?: string) {
  const [enabledModules, setEnabledModules] = useState<string[]>(ALL_MODULES);
  const [loading, setLoading] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const effectiveRole = userRole || "owner";

  // A module is blocked by outlet type if it exists in the preset.
  const isAllowedByOutlet = useCallback((moduleKeyOrGateKey: string | undefined): boolean => {
    if (!outletType || !moduleKeyOrGateKey) return true;
    const blocked = OUTLET_TYPE_BLOCKED_GATE_KEYS[outletType];
    if (!blocked) return true;
    return !blocked.includes(moduleKeyOrGateKey);
  }, [outletType]);

 const fetchModules = useCallback(async (force = false) => {
  const now = Date.now();
  if (!force && _cachedModules && now - _cacheTs < CACHE_TTL) {
   setEnabledModules(_cachedModules);
   setLoading(false);
   return;
  }
  try {
   const mobileRes: any = await api.get("/companies/me/mobile-modules");
   if (Array.isArray(mobileRes?.data)) {
    _cachedModules = mobileRes.data;
    _cacheTs = Date.now();
    setEnabledModules(mobileRes.data);
    return;
   }
   const webRes: any = await api.get("/companies/me/modules");
   if (Array.isArray(webRes?.data) && webRes.data.length > 0) {
    _cachedModules = webRes.data;
    _cacheTs = Date.now();
    setEnabledModules(webRes.data);
   }
  } catch {
  } finally {
   setLoading(false);
  }
 }, []);

 useEffect(() => {
  fetchModules();
  pollRef.current = setInterval(() => fetchModules(true), POLL_INTERVAL);
  const sub = AppState.addEventListener("change", (nextState) => {
   if (appStateRef.current.match(/inactive|background/) && nextState === "active") {
    fetchModules(true);
   }
   appStateRef.current = nextState;
  });
  return () => {
   if (pollRef.current) clearInterval(pollRef.current);
   sub.remove();
  };
 }, [fetchModules]);

  const isModuleEnabled = useCallback(
  (moduleKey: string) => {
    const gateKey = MODULE_GATE_KEYS[moduleKey] ?? moduleKey;
    if (!isAllowedByOutlet(gateKey)) return false;
    const roleModules = ROLE_MODULES[effectiveRole] || ALL_MODULES;
    return roleModules.includes(moduleKey) && enabledModules.includes(gateKey);
  },
  [effectiveRole, enabledModules, isAllowedByOutlet]
  );

  const isChildVisible = useCallback(
  (child: ModuleItem, roleModules: string[]) => {
    const gateKey = child.gateKey ?? MODULE_GATE_KEYS[child.key];
    if (!isAllowedByOutlet(gateKey ?? child.key)) return false;
    return roleModules.includes(child.key) && (!gateKey || enabledModules.includes(gateKey));
  },
  [enabledModules, isAllowedByOutlet]
  );

  const getVisibleCategories = useCallback((): ModuleCategory[] => {
  const roleModules = ROLE_MODULES[effectiveRole] || ALL_MODULES;
  return MODULE_CATEGORIES
  .filter((cat) => cat.roles.includes(effectiveRole))
  .map((cat) => ({
  ...cat,
  children: cat.children.filter((child) => isChildVisible(child, roleModules)),
  }))
  .filter((cat) => cat.children.length > 0);
  }, [effectiveRole, isChildVisible]);

 const getVisibleChildren = useCallback(
 (categoryId: string): ModuleItem[] => {
 const roleModules = ROLE_MODULES[effectiveRole] || ALL_MODULES;
 const cat = MODULE_CATEGORIES.find((c) => c.id === categoryId);
 if (!cat) return [];
 return cat.children.filter((child) => isChildVisible(child, roleModules));
 },
 [effectiveRole, isChildVisible]
 );

 return {
 enabledModules,
 isModuleEnabled,
 getVisibleCategories,
 getVisibleChildren,
 loading,
 refresh: fetchModules,
 userRole: effectiveRole,
 };
}
