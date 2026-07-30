"use client";

import { useState, useEffect } from "react";
import { api } from "./api";

export type ProductFieldSection =
  | "basic" | "packaging" | "serial"
  | "kirana" | "pharmacy" | "electronics" | "apparel"
  | "container" | "rack" | "pinned" | "variant";

export interface ProductVerticalConfig {
  visibleSections: ProductFieldSection[];
  requiredSections: ProductFieldSection[];
  allowedUnits: string[];
  defaultUnit: string;
  fieldDefaults: Record<string, unknown>;
  fieldLabels?: Record<string, string>;
}

interface ProductConfigResponse {
  businessVertical: string;
  config: ProductVerticalConfig;
}

interface ApiResponse<T> {
  data: T;
}

const DEFAULT_CONFIG: ProductVerticalConfig = {
  visibleSections: ["basic", "packaging", "rack", "pinned", "variant"],
  requiredSections: ["basic"],
  allowedUnits: ["pcs", "kg", "g", "mL", "L", "meter", "pair", "set", "box", "dozen", "packet", "bottle", "tin"],
  defaultUnit: "pcs",
  fieldDefaults: {},
};

export function useProductVerticalConfig() {
  const [config, setConfig] = useState<ProductVerticalConfig>(DEFAULT_CONFIG);
  const [verticalLabel, setVerticalLabel] = useState("General Retail");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get<ApiResponse<ProductConfigResponse>>("/verticals/product-config");
        if (!cancelled && res?.data) {
          setConfig(res.data.config);
          setVerticalLabel(res.data.businessVertical.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()));
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const isSectionVisible = (section: ProductFieldSection) => config.visibleSections.includes(section);

  return { config, verticalLabel, loading, isSectionVisible };
}