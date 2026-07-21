export type UserRole = "owner" | "manager" | "staff" | "warehouse_manager" | "field_agent";

export interface ModuleItem {
 key: string;
 label: string;
 icon: string;
 desc: string;
 route: string;
}

export interface ModuleCategory {
 id: string;
 label: string;
 icon: string;
 roles: UserRole[];
 children: ModuleItem[];
}

export const MODULE_CATEGORIES: ModuleCategory[] = [
 {
 id: "billing",
 label: "Billing & Sales",
 icon: "receipt",
 roles: ["manager"],
 children: [
 { key: "pos", label: "POS Billing", icon: "point-of-sale", desc: "Counter billing terminal", route: "/(tabs)/pos" },
 { key: "b2b", label: "B2B Sales", icon: "briefcase-account", desc: "Wholesale invoicing", route: "/(tabs)/b2b" },
 { key: "estimates", label: "Orders & Quotes", icon: "file-document-outline", desc: "Estimates and quotations", route: "/(tabs)/estimates" },
 { key: "history", label: "Invoice History", icon: "history", desc: "Past transaction records", route: "/invoice-history" },
 { key: "held-bills", label: "Held Bills", icon: "content-save", desc: "Parked bills to resume", route: "/invoice-history" },
 { key: "returns", label: "Returns", icon: "backup-restore", desc: "Sales returns and refunds", route: "/invoice-history" },
 ],
 },
 {
 id: "inventory",
 label: "Inventory & Stock",
 icon: "package-variant",
 roles: ["manager", "warehouse_manager"],
 children: [
 { key: "inventory", label: "Stock View", icon: "package-variant-closed", desc: "Product catalog and stock", route: "/(tabs)/inventory" },
 { key: "categories", label: "Categories", icon: "tag", desc: "Product categories", route: "/categories" },
 { key: "barcodes", label: "Barcodes", icon: "barcode", desc: "Barcode label generation", route: "/barcode-generator" },
 ],
 },
 {
 id: "purchases-warehouse",
 label: "Purchases & Warehouse",
 icon: "truck-delivery",
 roles: ["manager", "warehouse_manager"],
 children: [
 { key: "purchases", label: "Purchases", icon: "truck", desc: "Stock purchase entry", route: "/purchase-entry" },
 { key: "purchase-orders", label: "Purchase Orders", icon: "clipboard-text", desc: "PO creation and management", route: "/purchase-orders" },
 { key: "warehouse", label: "Transfers", icon: "transfer", desc: "Stock transfers between warehouses", route: "/stock-transfer-requests" },
 { key: "challans", label: "Challans", icon: "clipboard-list", desc: "Delivery challans", route: "/challans" },
 ],
 },
 {
 id: "accounting",
 label: "Accounting & Payments",
 icon: "account-cash",
 roles: ["manager"],
 children: [
 { key: "ledger", label: "Party Ledger", icon: "account-group", desc: "Customer/supplier ledger", route: "/(tabs)/ledger" },
 { key: "payments", label: "Payments", icon: "credit-card", desc: "Payment in/out recording", route: "/payment-history" },
 { key: "expenses", label: "Expenses", icon: "wallet", desc: "Operational expense tracking", route: "/expenses" },
 ],
 },
 {
 id: "staff",
 label: "Staff & Attendance",
 icon: "account-tie",
 roles: ["manager"],
 children: [
 { key: "staff", label: "Staff", icon: "account-multiple-outline", desc: "Employee profiles and roles", route: "/staff" },
 { key: "attendance", label: "Attendance", icon: "calendar-check", desc: "Staff attendance marking", route: "/attendance" },
 ],
 },
 {
 id: "operations",
 label: "Approvals & Ops",
 icon: "clipboard-check",
 roles: ["manager", "owner"],
 children: [
 { key: "approval-queue", label: "Approvals", icon: "clipboard-check-outline", desc: "Pending approval requests", route: "/approval-queue" },
 { key: "shift-reconciliation", label: "Shift Close", icon: "cash-register", desc: "Cash shift reconciliation", route: "/shift-reconciliation" },
 { key: "live-activity", label: "Live Activity", icon: "animation", desc: "Real-time staff activity", route: "/live-activity" },
 ],
 },
 {
 id: "settings",
 label: "Settings",
 icon: "cog",
 roles: ["manager", "staff", "warehouse_manager"],
 children: [
 { key: "printer-settings", label: "Printer", icon: "printer", desc: "Printer configuration", route: "/printer-settings" },
 ],
 },
];

export const ALL_MODULES = [
 "pos", "b2b", "estimates", "inventory", "warehouse", "ledger",
 "staff", "attendance", "challans",
 "payments", "expenses", "history", "categories",
 "purchases", "purchase-orders", "barcodes",
 "printer-settings",
 "held-bills", "returns",
 "shift-reconciliation", "approval-queue", "live-activity",
 "web-handoff",
];

export const ROLE_MODULES: Record<UserRole, string[]> = {
 owner: ["approval-queue", "live-activity", "web-handoff"],
 manager: [
 "pos", "b2b", "estimates", "history", "held-bills", "returns",
 "inventory", "categories", "barcodes",
 "purchases", "purchase-orders", "warehouse", "challans",
 "ledger", "payments", "expenses",
 "staff", "attendance",
 "shift-reconciliation", "approval-queue", "live-activity",
 "printer-settings",
 ],
 staff: [
 "pos", "history", "held-bills", "returns",
 "ledger",
 "payments",
 "printer-settings",
 ],
 warehouse_manager: [
 "inventory", "categories", "barcodes",
 "purchases", "purchase-orders", "warehouse", "challans",
 "printer-settings",
 ],
 field_agent: [],
};

export const CATEGORY_COLORS: Record<string, string> = {
 billing: "#2E9E5B",
 inventory: "#375DFB",
 "purchases-warehouse": "#7C5CFC",
 accounting: "#B37400",
 staff: "#C24868",
 operations: "#1E8E85",
 settings: "#6B7280",
};

export const SETTINGS_MODULE_CATEGORIES: { id: string; label: string; modules: { key: string; label: string; desc: string }[] }[] = [
 {
 id: "billing",
 label: "Billing & Sales",
 modules: [
 { key: "pos", label: "POS Billing", desc: "Point of Sale — retail counter billing" },
 { key: "b2b", label: "B2B Sales", desc: "Wholesale / bulk order invoicing" },
 { key: "estimates", label: "Estimates & Quotations", desc: "Create and manage sales estimates and quotations" },
 ],
 },
 {
 id: "inventory",
 label: "Inventory & Products",
 modules: [
 { key: "inventory", label: "Inventory Management", desc: "Product catalog, stock tracking" },
 { key: "warehouse", label: "Warehouse Management", desc: "Multi-warehouse stock transfers" },
 ],
 },
 {
 id: "accounting",
 label: "Accounting & Finance",
 modules: [
 { key: "ledger", label: "Party Ledger", desc: "Customer/supplier balances, payment tracking" },
 { key: "payments", label: "Payments", desc: "Payment in/out records" },
 { key: "expenses", label: "Expenses", desc: "Operational expense tracking" },
 ],
 },
 {
 id: "staff",
 label: "Staff & HR",
 modules: [
 { key: "staff", label: "Staff Management", desc: "Employee profiles, roles, credentials" },
 { key: "attendance", label: "Attendance", desc: "Staff check-in/out tracking" },
 ],
 },
 {
 id: "operations",
 label: "Operations & Logistics",
 modules: [
 { key: "challans", label: "Delivery Challans", desc: "Dispatch manifests, transit tracking" },
 ],
 },
];
