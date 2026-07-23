import { useEffect } from "react";
import { useRouter } from "expo-router";
import { Alert } from "react-native";
import { useAuth } from "./auth-context";
import type { UserRole } from "./moduleCategories";

// Client-side nav hiding (ROLE_MODULES) only controls whether a tile shows
// up in the grid — it does nothing to stop someone reaching the screen
// directly (deep link, global search, or just typing the route). Screens
// that touch money, credentials, or company-wide config need their own
// gate. See docs/role-access-gap-analysis-and-solutions.md V1/V2/V4.
//
// Real access control still lives server-side (shopkeeper-api's
// requireRole middleware) — this is a UX guard so an unauthorized user
// sees a clear message and bounces back, instead of a broken screen full
// of 403s or, worse, a form that looks editable but silently fails.
export function useRoleGate(allowedRoles: UserRole[], message: string) {
  const { userRole } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (userRole && !allowedRoles.includes(userRole)) {
      Alert.alert("Access Restricted", message, [{ text: "OK", onPress: () => router.back() }]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userRole]);

  return allowedRoles.includes((userRole ?? "") as UserRole);
}
