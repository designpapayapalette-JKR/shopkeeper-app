import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api, setOutletId } from "./api";

const OUTLET_STORAGE_KEY = "shopkeeper_outlet_id";

export interface Outlet {
  id: string;
  name: string;
  code: string;
  type: "shop" | "showroom" | "branch" | "warehouse_only";
  isActive: boolean;
}

interface OutletContextType {
  outlets: Outlet[];
  selectedOutlet: Outlet | null;
  selectedOutletId: string | null;
  loading: boolean;
  setSelectedOutletId: (id: string | null) => void;
  refresh: () => Promise<void>;
}

const OutletContext = createContext<OutletContextType | undefined>(undefined);

export function OutletProvider({ children }: { children: React.ReactNode }) {
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [selectedOutletId, setSelectedOutletIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchOutlets = useCallback(async () => {
    try {
      const json = await api.get<any>("/outlets");
      if (json?.data) {
        setOutlets(json.data);
      }
    } catch { } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(OUTLET_STORAGE_KEY).then((stored) => {
      if (stored) setSelectedOutletIdState(stored);
      fetchOutlets();
    });
  }, [fetchOutlets]);

  // Sync the cached outlet ID to the API client so every request gets the header
  useEffect(() => {
    setOutletId(selectedOutletId);
  }, [selectedOutletId]);

  const setSelectedOutletId = useCallback((id: string | null) => {
    setSelectedOutletIdState(id);
    if (id) AsyncStorage.setItem(OUTLET_STORAGE_KEY, id);
    else AsyncStorage.removeItem(OUTLET_STORAGE_KEY);
  }, []);

  const selectedOutlet = outlets.find((o) => o.id === selectedOutletId) ?? null;

  return (
    <OutletContext.Provider value={{ outlets, selectedOutlet, selectedOutletId, loading, setSelectedOutletId, refresh: fetchOutlets }}>
      {children}
    </OutletContext.Provider>
  );
}

export function useOutlet() {
  const context = useContext(OutletContext);
  if (!context) throw new Error("useOutlet must be used within an OutletProvider");
  return context;
}
