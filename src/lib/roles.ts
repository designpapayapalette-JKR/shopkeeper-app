import type { UserRole } from "./moduleCategories";

// Plain-language role names and per-role badge colors — the single source
// every screen pulls from instead of re-declaring its own copy (previously
// duplicated in index.tsx and profile.tsx with slightly different labels).
// See shopkeeper-mobile-design-system.md §4.1 and §8.1.
export const ROLE_LABELS: Record<string, string> = {
 owner: "Owner",
 manager: "Manager",
 staff: "Cashier",
 warehouse_manager: "Godown Manager",
 field_agent: "Field Agent",
};

export const ROLE_COLORS: Record<string, string> = {
 owner: "#0368FE",
 manager: "#835400",
 staff: "#2E9E5B",
 warehouse_manager: "#873D34",
 field_agent: "#6B7280",
};

export function roleLabel(role: UserRole | string | null | undefined): string {
 return ROLE_LABELS[role || ""] || "User";
}

export function roleColor(role: UserRole | string | null | undefined): string {
 return ROLE_COLORS[role || ""] || "#6B7280";
}
