import React, { createContext, useContext, useState, useEffect } from "react";
import { api, login as apiLogin, logout as apiLogout, registerCompany as apiRegisterCompany, fetchMe, hasStoredSession, verifyTwoFactor as apiVerifyTwoFactor } from "./api";
import { setPin, verifyPin, hasPin, setLastUserId, getLastUserId } from "./pin";
import { registerForPushNotifications } from "./pushNotifications";

import type { UserRole } from "./moduleCategories";

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: any | null;
  userRole: UserRole | null;
  activeCompany: any | null;
  activeBrand: any | null;
  availableBrands: any[];
  setActiveBrand: (brand: any | null) => void;
  login: (email: string, password: string) => Promise<void>;
  verifyTwoFactor: (pendingToken: string, code: string) => Promise<void>;
  register: (data: {
    companyName: string;
    state?: string;
    email: string;
    password: string;
    firstName: string;
    lastName?: string;
    inviteCode: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  refreshBrands: () => Promise<void>;
  refreshCompany: () => Promise<void>;
  pinLoginAvailable: boolean;
  setupQuickPin: (pin: string) => Promise<void>;
  unlockWithPin: (pin: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<any | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [activeCompany, setActiveCompany] = useState<any | null>(null);
  const [activeBrand, setActiveBrand] = useState<any | null>(null);
  const [availableBrands, setAvailableBrands] = useState<any[]>([]);
  const [pinLoginAvailable, setPinLoginAvailable] = useState(false);

  const fetchTenantData = async () => {
    try {
      const company = await api.get<any>("/companies/me");
      setActiveCompany(company.data);

      const brands = await api.get<any>("/brands");
      setAvailableBrands(brands.data ?? []);
    } catch (error) {
      console.error("Failed to fetch tenant data:", error);
    }
  };

  const refreshBrands = async () => {
    try {
      const brands = await api.get<any>("/brands");
      setAvailableBrands(brands.data ?? []);
    } catch (error) {
      console.error("Failed to refresh brands:", error);
    }
  };

  const refreshCompany = async () => {
    try {
      const company = await api.get<any>("/companies/me");
      setActiveCompany(company.data);
    } catch (error) {
      console.error("Failed to refresh company:", error);
    }
  };

  useEffect(() => {
    async function checkAuth() {
      try {
        const lastUserId = await getLastUserId();
        if (lastUserId) {
          setPinLoginAvailable(await hasPin(lastUserId));
        }

        if (!(await hasStoredSession())) {
          setIsLoading(false);
          return;
        }

        const me = await fetchMe();
        if (me) {
          setUser(me);
          setUserRole(me.role || null);
          setIsAuthenticated(true);
          if (me.company_id) {
            await fetchTenantData();
          }
          registerForPushNotifications().catch((e) => {
            console.warn("[Auth] Push registration failed during startup:", e);
          });
        }
      } catch (error) {
        setIsAuthenticated(false);
        setUser(null);
        setUserRole(null);
        setActiveCompany(null);
        setActiveBrand(null);
        setAvailableBrands([]);
      } finally {
        setIsLoading(false);
      }
    }
    checkAuth();
  }, []);

  const login = async (email: string, password: string) => {
    // Deliberately does NOT touch the global isLoading flag — that flag
    // controls whether the root layout renders the whole app as a blank
    // spinner (see app/_layout.tsx), which is only appropriate for the
    // initial boot-time auth check. Toggling it here used to unmount the
    // login screen mid-request on every attempt, silently discarding
    // whatever error message the catch block below tried to show.
    try {
      const me = await apiLogin(email, password);
      setUser(me);
      setUserRole(me.role || null);
      setIsAuthenticated(true);
      await setLastUserId(me.id);
      setPinLoginAvailable(await hasPin(me.id));
      if (me.company_id) {
        await fetchTenantData();
      }
      registerForPushNotifications().catch((e) => {
        console.warn("[Auth] Push registration failed during login:", e);
      });
    } catch (error) {
      setIsAuthenticated(false);
      setUser(null);
      setActiveCompany(null);
      setActiveBrand(null);
      setAvailableBrands([]);
      throw error;
    }
  };

  // Second step of a 2FA login: exchanges the pendingToken (thrown as
  // TwoFactorRequiredError by login() above) plus the emailed code for a
  // real session — mirrors login()'s post-success setup exactly.
  const verifyTwoFactor = async (pendingToken: string, code: string) => {
    try {
      const me = await apiVerifyTwoFactor(pendingToken, code);
      setUser(me);
      setUserRole(me.role || null);
      setIsAuthenticated(true);
      await setLastUserId(me.id);
      setPinLoginAvailable(await hasPin(me.id));
      if (me.company_id) {
        await fetchTenantData();
      }
      registerForPushNotifications().catch((e) => {
        console.warn("[Auth] Push registration failed during 2FA verify:", e);
      });
    } catch (error) {
      setIsAuthenticated(false);
      setUser(null);
      setActiveCompany(null);
      setActiveBrand(null);
      setAvailableBrands([]);
      throw error;
    }
  };

  const register = async (data: {
    companyName: string;
    state?: string;
    email: string;
    password: string;
    firstName: string;
    lastName?: string;
    inviteCode: string;
  }) => {
    try {
      const me = await apiRegisterCompany(data);
      setUser(me);
      setUserRole(me.role || null);
      setIsAuthenticated(true);
      await setLastUserId(me.id);
      if (me.company_id) {
        await fetchTenantData();
      }
      registerForPushNotifications().catch((e) => {
        console.warn("[Auth] Push registration failed during register:", e);
      });
    } catch (error) {
      setIsAuthenticated(false);
      setUser(null);
      setActiveCompany(null);
      setActiveBrand(null);
      setAvailableBrands([]);
      throw error;
    }
  };

  const setupQuickPin = async (pin: string) => {
    if (!user?.id) throw new Error("You must be signed in to set up a PIN.");
    await setPin(user.id, pin);
    setPinLoginAvailable(true);
  };

  const unlockWithPin = async (pin: string): Promise<boolean> => {
    const lastUserId = await getLastUserId();
    if (!lastUserId) return false;

    const verified = await verifyPin(lastUserId, pin);
    if (!verified) return false;

    // PIN is correct — restore the already-persisted session rather than
    // re-authenticating with email/password (which we never store).
    try {
      const me = await fetchMe();
      if (!me) return false;
      setUser(me);
      setUserRole(me.role || null);
      setIsAuthenticated(true);
      if (me.company_id) {
        await fetchTenantData();
      }
      return true;
    } catch (error) {
      setUserRole(null);
      return false;
    }
  };

  const logout = async () => {
    try {
      await apiLogout();
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      setUser(null);
      setUserRole(null);
      setIsAuthenticated(false);
      setActiveCompany(null);
      setActiveBrand(null);
      setAvailableBrands([]);
    }
  };

  return (
      <AuthContext.Provider
        value={{
          isAuthenticated,
          isLoading,
          user,
          userRole,
          activeCompany,
          activeBrand,
          availableBrands,
          setActiveBrand,
        login,
        verifyTwoFactor,
        register,
        logout,
        refreshBrands,
        refreshCompany,
        pinLoginAvailable,
        setupQuickPin,
        unlockWithPin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
