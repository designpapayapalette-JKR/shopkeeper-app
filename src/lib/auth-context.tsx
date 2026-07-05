import React, { createContext, useContext, useState, useEffect } from "react";
import { api, login as apiLogin, logout as apiLogout, fetchMe, hasStoredSession } from "./api";
import { setPin, verifyPin, hasPin, setLastUserId, getLastUserId } from "./pin";

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: any | null;
  activeCompany: any | null;
  activeBrand: any | null;
  availableBrands: any[];
  setActiveBrand: (brand: any | null) => void;
  login: (email: string, password: string) => Promise<void>;
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
          setIsAuthenticated(true);
          if (me.company_id) {
            await fetchTenantData();
          }
        }
      } catch (error) {
        setIsAuthenticated(false);
        setUser(null);
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
      setIsAuthenticated(true);
      await setLastUserId(me.id);
      setPinLoginAvailable(await hasPin(me.id));
      if (me.company_id) {
        await fetchTenantData();
      }
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
      setIsAuthenticated(true);
      if (me.company_id) {
        await fetchTenantData();
      }
      return true;
    } catch (error) {
      // Underlying session/refresh token has expired — a full email/password
      // sign-in is required before PIN-unlock can work again.
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
        activeCompany,
        activeBrand,
        availableBrands,
        setActiveBrand,
        login,
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
