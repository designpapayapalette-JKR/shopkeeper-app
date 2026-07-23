import { useState, useEffect, useCallback, useRef } from "react";
import { AppState, AppStateStatus } from "react-native";
import { api } from "./api";
import { ALL_MODULES, ROLE_MODULES, MODULE_CATEGORIES, type UserRole, type ModuleCategory, type ModuleItem } from "./moduleCategories";

const POLL_INTERVAL = 30000;

export function useModuleVisibility(userRole: UserRole | null | undefined) {
 const [enabledModules, setEnabledModules] = useState<string[]>(ALL_MODULES);
 const [loading, setLoading] = useState(true);
 const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
 const appStateRef = useRef<AppStateStatus>(AppState.currentState);

 const effectiveRole = userRole || "owner";

 const fetchModules = useCallback(async () => {
 try {
 const mobileRes: any = await api.get("/companies/me/mobile-modules");
 if (Array.isArray(mobileRes?.data) && mobileRes.data.length > 0) {
 setEnabledModules(mobileRes.data);
 return;
 }
 const webRes: any = await api.get("/companies/me/modules");
 if (Array.isArray(webRes?.data) && webRes.data.length > 0) {
 setEnabledModules(webRes.data);
 }
 } catch {
 } finally {
 setLoading(false);
 }
 }, []);

 useEffect(() => {
 fetchModules().then(() => setLoading(false));
 pollRef.current = setInterval(fetchModules, POLL_INTERVAL);
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

 const isModuleEnabled = useCallback(
 (moduleKey: string) => {
 const roleModules = ROLE_MODULES[effectiveRole] || ALL_MODULES;
 return roleModules.includes(moduleKey) && enabledModules.includes(moduleKey);
 },
 [effectiveRole, enabledModules]
 );

 const isChildVisible = useCallback(
 (child: ModuleItem, roleModules: string[]) =>
 roleModules.includes(child.key) && (!child.gateKey || enabledModules.includes(child.gateKey)),
 [enabledModules]
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
