import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import * as SecureStore from "expo-secure-store";
import { api, setOutletId } from "./api";
import i18n from "./i18n";

const OUTLET_STORAGE_KEY = "shopkeeper_outlet_id";

export interface Outlet {
  id: string;
  name: string;
  code: string;
  type: "shop" | "showroom" | "branch" | "warehouse_only" | "office";
  customTypeLabel?: string | null;
  isActive: boolean;
}

interface OutletContextType {
  outlets: Outlet[];
  selectedOutlet: Outlet | null;
  selectedOutletId: string | null;
  isAllLocations: boolean;
  locationLabel: string;
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
      const json = await api.get<any>("/outlets/mine");
      if (json?.data) {
        setOutlets(json.data);
      }
    } catch { } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    SecureStore.getItemAsync(OUTLET_STORAGE_KEY).then((stored) => {
      if (stored && stored !== "all") setSelectedOutletIdState(stored);
      fetchOutlets();
    });
  }, [fetchOutlets]);

  // Sync the cached outlet ID to the API client so every request gets the header
  useEffect(() => {
    setOutletId(selectedOutletId);
  }, [selectedOutletId]);

  const setSelectedOutletId = useCallback((id: string | null) => {
    const nextId = id === "all" ? null : id;
    setSelectedOutletIdState(nextId);
    if (nextId) SecureStore.setItemAsync(OUTLET_STORAGE_KEY, nextId);
    else SecureStore.deleteItemAsync(OUTLET_STORAGE_KEY);
  }, []);

  const selectedOutlet = outlets.find((o) => o.id === selectedOutletId) ?? null;
  const isAllLocations = !selectedOutletId;
  const locationLabel = selectedOutlet ? selectedOutlet.name : i18n.t("common.allLocations", "All Locations");

  return (
    <OutletContext.Provider
      value={{
        outlets,
        selectedOutlet,
        selectedOutletId,
        isAllLocations,
        locationLabel,
        loading,
        setSelectedOutletId,
        refresh: fetchOutlets,
      }}
    >
      {children}
    </OutletContext.Provider>
  );
}

export function useOutlet() {
  const context = useContext(OutletContext);
  if (!context) throw new Error("useOutlet must be used within an OutletProvider");
  return context;
}
