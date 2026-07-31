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
        // The shared mobile API adapter converts server responses to snake_case
        // for legacy screens. Normalize this newer camelCase config explicitly
        // so a successful response cannot replace the defaults with undefined
        // arrays and crash Inventory.
        const res = await api.get<ApiResponse<ProductConfigResponse> | any>("/verticals/product-config");
        if (!cancelled && res?.data) {
          const rawConfig = res.data.config ?? {};
          const normalized: ProductVerticalConfig = {
            visibleSections: rawConfig.visibleSections ?? rawConfig.visible_sections ?? DEFAULT_CONFIG.visibleSections,
            requiredSections: rawConfig.requiredSections ?? rawConfig.required_sections ?? DEFAULT_CONFIG.requiredSections,
            allowedUnits: rawConfig.allowedUnits ?? rawConfig.allowed_units ?? DEFAULT_CONFIG.allowedUnits,
            defaultUnit: rawConfig.defaultUnit ?? rawConfig.default_unit ?? DEFAULT_CONFIG.defaultUnit,
            fieldDefaults: rawConfig.fieldDefaults ?? rawConfig.field_defaults ?? DEFAULT_CONFIG.fieldDefaults,
            fieldLabels: rawConfig.fieldLabels ?? rawConfig.field_labels,
          };
          setConfig(normalized);
          const vertical = res.data.businessVertical ?? res.data.business_vertical ?? "general_retail";
          setVerticalLabel(vertical.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()));
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
