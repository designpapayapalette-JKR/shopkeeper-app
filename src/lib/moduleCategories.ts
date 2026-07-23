export type UserRole = "owner" | "manager" | "staff" | "warehouse_manager" | "field_agent";

export interface ModuleItem {
 key: string;
 label: string;
 icon: string;
 desc: string;
 route: string;
 // Optional company enabledModules toggle key this item is gated behind —
 // mirrors shopkeeper-web/src/lib/moduleCategories.ts's `moduleKey?` pattern,
 // where most back-office nav items (Daybook, Bank Accounts, Recycle Bin,
 // etc.) have none and are always visible once role-permitted. Distinct
 // from `key`, which is this item's own stable identity (used in
 // ROLE_MODULES and as the route/list key) — `gateKey` is what gets checked
 // against the company's `enabledModules`/`mobileEnabledModules` toggle
 // list. Falls back to `key` if unset would be wrong here: many of these
 // screens don't correspond to any real toggle, so omitting `gateKey`
 // means "always visible to a role-permitted user", not "gated on `key`".
 gateKey?: string;
}

export interface ModuleCategory {
 id: string;
 label: string;
 icon: string;
 roles: UserRole[];
 children: ModuleItem[];
}

// MMC Admin App (Owner) parity wiring — 2026-07-22 rebrand/rebuild pass.
// Owner previously only had ["approval-queue", "live-activity", "web-handoff"]
// (an "Owner Snapshot" model). Per docs/Deep-Review-and-Dual-Mobile-Apps-Architectural-Plan.md
// §4, the Admin App now gets 100% web-portal parity. Every screen wired
// below already existed as a working route file — this is a visibility/
// role-wiring change, not new screen construction (verified against
// shopkeeper-web/src/lib/moduleCategories.ts for which items carry a real
// company enabledModules toggle vs. which are always-visible back-office
// pages — see `gateKey` doc comment above).
//
// Manager/Staff/Warehouse Manager's existing entries are untouched in this
// pass — only Owner's category membership and ROLE_MODULES.owner changed.
export const MODULE_CATEGORIES: ModuleCategory[] = [
 {
 id: "billing",
 label: "Billing & Sales",
 icon: "receipt",
 roles: ["manager", "owner"],
 children: [
 { key: "pos", label: "POS Billing", icon: "point-of-sale", desc: "Counter billing terminal", route: "/pos" },
 { key: "b2b", label: "B2B Sales", icon: "briefcase-account", desc: "Wholesale invoicing", route: "/b2b" },
 { key: "estimates", label: "Orders & Quotes", icon: "file-document-outline", desc: "Estimates and quotations", route: "/estimates" },
 { key: "history", label: "Invoice History", icon: "history", desc: "Past transaction records", route: "/invoice-history" },
 { key: "held-bills", label: "Held Bills", icon: "content-save", desc: "Parked bills to resume", route: "/invoice-history" },
 { key: "returns", label: "Returns", icon: "backup-restore", desc: "Sales returns and refunds", route: "/invoice-history" },
 { key: "sales-orders", label: "Sales Orders", icon: "clipboard-list-outline", desc: "Sales order tracking", route: "/sales-orders" },
 { key: "price-lists", label: "Price Lists", icon: "tag-multiple", desc: "Custom pricing tiers", route: "/price-lists" },
 { key: "bulk-price-update", label: "Bulk Price Update", icon: "cash-multiple", desc: "Update prices in bulk", route: "/bulk-price-update" },
 { key: "recurring-invoices", label: "Recurring Invoices", icon: "repeat", desc: "Auto-scheduled invoices", route: "/recurring-invoices", gateKey: "estimates" },
 { key: "bill-scanner", label: "Bill Scanner", icon: "camera-document", desc: "Scan & digitize paper bills", route: "/bill-scanner" },
 ],
 },
 {
 id: "inventory",
 label: "Inventory & Stock",
 icon: "package-variant",
 roles: ["manager", "warehouse_manager", "owner"],
 children: [
 { key: "inventory", label: "Stock View", icon: "package-variant-closed", desc: "Product catalog and stock", route: "/inventory" },
 { key: "categories", label: "Categories", icon: "tag", desc: "Product categories", route: "/categories" },
 { key: "barcodes", label: "Barcodes", icon: "barcode", desc: "Barcode label generation", route: "/barcode-generator" },
 { key: "reorder-suggestions", label: "Reorder Suggestions", icon: "cart-arrow-down", desc: "Low-stock reorder alerts", route: "/reorder-suggestions" },
 { key: "gst-rate-tools", label: "GST Rate Tools", icon: "percent", desc: "Bulk GST rate management", route: "/gst-rate-tools" },
 ],
 },
 {
 id: "purchases-warehouse",
 label: "Purchases & Warehouse",
 icon: "truck-delivery",
 roles: ["manager", "warehouse_manager", "owner"],
 children: [
 { key: "purchases", label: "Purchases", icon: "truck", desc: "Stock purchase entry", route: "/purchase-entry" },
 { key: "purchase-history", label: "Purchase History", icon: "history", desc: "Past purchase records", route: "/purchase-history" },
 { key: "purchase-orders", label: "Purchase Orders", icon: "clipboard-text", desc: "PO creation and management", route: "/purchase-orders" },
 { key: "warehouse", label: "Transfers", icon: "transfer", desc: "Stock transfers between warehouses", route: "/stock-transfer-requests" },
 { key: "challans", label: "Challans", icon: "clipboard-list", desc: "Delivery challans", route: "/challans" },
 ],
 },
 {
 id: "accounting",
 label: "Accounting & Payments",
 icon: "account-cash",
 roles: ["manager", "owner"],
 children: [
 { key: "ledger", label: "Party Ledger", icon: "account-group", desc: "Customer/supplier ledger", route: "/ledger" },
 { key: "payments", label: "Payments", icon: "credit-card", desc: "Payment in/out recording", route: "/payment-history" },
 { key: "expenses", label: "Expenses", icon: "wallet", desc: "Operational expense tracking", route: "/expenses" },
 { key: "customer-groups", label: "Customer Groups", icon: "account-multiple", desc: "Customer segmentation", route: "/customer-groups" },
 { key: "credit-note", label: "Credit Notes", icon: "file-undo-outline", desc: "Sales credit notes", route: "/credit-note", gateKey: "ledger" },
 { key: "debit-note", label: "Debit Notes", icon: "file-undo", desc: "Purchase debit notes", route: "/debit-note", gateKey: "ledger" },
 { key: "unified-ledger", label: "Unified Ledger", icon: "book-open-variant", desc: "Consolidated ledger view", route: "/unified-ledger" },
 ],
 },
 {
 id: "staff",
 label: "Staff & Attendance",
 icon: "account-tie",
 roles: ["manager", "owner"],
 children: [
 { key: "staff", label: "Staff", icon: "account-multiple-outline", desc: "Employee profiles and roles", route: "/staff" },
 { key: "attendance", label: "Attendance", icon: "calendar-check", desc: "Staff attendance marking", route: "/attendance" },
 { key: "payroll", label: "Payroll", icon: "cash-multiple", desc: "Salary structures and payslips", route: "/payroll", gateKey: "payroll" },
 { key: "holidays", label: "Holidays", icon: "calendar-star", desc: "Company holiday calendar", route: "/holidays" },
 { key: "leaves", label: "Leaves", icon: "calendar-remove", desc: "Staff leave requests", route: "/leaves" },
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
 { key: "agents", label: "Field Tracking", icon: "map-marker-radius", desc: "Live field agent map", route: "/agents" },
 { key: "outlets", label: "Outlets", icon: "store", desc: "Multi-outlet management", route: "/outlets" },
 { key: "counters", label: "Counters", icon: "cash-register", desc: "Billing counter & biller setup", route: "/counters" },
 { key: "account-security", label: "Account Security", icon: "shield-lock", desc: "2FA and login security", route: "/account-security" },
 ],
 },
 // Financial Reports Hub — owner-only. Deep-Review doc §4.2. "reports" is
 // the same company enabledModules toggle shopkeeper-web uses for
 // Analytics/Reports (see shopkeeper-web/src/lib/moduleCategories.ts) —
 // reused here rather than inventing granular per-screen toggles, since no
 // such granularity exists in the company settings UI today.
 {
 id: "reports",
 label: "Financial Reports",
 icon: "chart-box",
 roles: ["owner", "manager"],
 children: [
 { key: "pnl-report", label: "P&L Statement", icon: "chart-line", desc: "Profit & loss statement", route: "/pnl-report", gateKey: "reports" },
 { key: "balance-sheet", label: "Balance Sheet", icon: "scale-balance", desc: "Assets, liabilities & trial balance", route: "/balance-sheet" },
 { key: "gst-reports", label: "GST Returns", icon: "file-percent", desc: "GSTR-1, GSTR-3B, HSN summary", route: "/gst-reports", gateKey: "reports" },
 { key: "daybook", label: "Daybook", icon: "book-clock", desc: "Daily cash & transaction journal", route: "/daybook" },
 { key: "aging-report", label: "Aging Report", icon: "clock-alert-outline", desc: "Receivables & payables aging", route: "/aging-report" },
 { key: "bank-accounts", label: "Bank Accounts", icon: "bank", desc: "Bank account ledgers", route: "/bank-accounts" },
 { key: "bank-reconciliation", label: "Bank Reconciliation", icon: "bank-check", desc: "Match bank records", route: "/bank-reconciliation" },
 { key: "analytics", label: "Analytics", icon: "trending-up", desc: "Sales & growth analytics", route: "/analytics", gateKey: "reports" },
 { key: "financial-year", label: "Financial Year", icon: "calendar-sync", desc: "FY closing & period control", route: "/financial-year" },
 ],
 },
 // Back Office — owner-only. Mirrors shopkeeper-web's "scanned-docs" category.
 {
 id: "back-office",
 label: "Back Office",
 icon: "archive",
 roles: ["owner", "manager"],
 children: [
 { key: "scanned-documents", label: "Scanned Docs", icon: "file-image", desc: "Scanned document archive", route: "/scanned-documents" },
 { key: "activity-log", label: "Activity Log", icon: "history", desc: "System audit trail", route: "/activity-log" },
 { key: "recycle-bin", label: "Recycle Bin", icon: "trash-can-outline", desc: "Restore deleted records", route: "/recycle-bin" },
 ],
 },
 // Global Configuration & SaaS Settings — owner-only. Deep-Review doc §4.4.
 {
 id: "settings-hub",
 label: "Business Settings",
 icon: "cog-outline",
 roles: ["owner", "manager"],
 children: [
 { key: "business-profile", label: "Business Profile", icon: "domain", desc: "Company details, bank & UPI", route: "/business-profile" },
 { key: "modules-settings", label: "Modules", icon: "toggle-switch-outline", desc: "Turn features on or off", route: "/modules-settings" },
 { key: "tax-rates", label: "Tax & GST Rates", icon: "percent-outline", desc: "Tax rate configuration", route: "/tax-rates" },
 { key: "invoice-templates", label: "Invoice Templates", icon: "file-document-edit-outline", desc: "Invoice numbering & prefixes", route: "/invoice-templates" },
 { key: "shop-hours", label: "Shop Hours", icon: "clock-outline", desc: "Business operating hours", route: "/shop-hours" },
 { key: "brands", label: "Brands", icon: "shopping", desc: "Multi-brand configuration", route: "/brands" },
 { key: "referral-program", label: "Referral Program", icon: "gift-outline", desc: "Merchant referral tracking", route: "/referral-program", gateKey: "referrals" },
 { key: "support-tickets", label: "Support Tickets", icon: "lifebuoy", desc: "Help & support requests", route: "/support-tickets" },
 { key: "notifications", label: "Notifications", icon: "bell-outline", desc: "Notification preferences", route: "/notifications" },
 { key: "reminders", label: "Reminders", icon: "bell-ring-outline", desc: "Payment reminder settings", route: "/reminders" },
 { key: "subscription-billing", label: "Subscription & Billing", icon: "credit-card-outline", desc: "Plan, usage & billing", route: "/subscription-billing" },
 ],
 },
 {
 id: "settings",
 label: "Settings",
 icon: "cog",
 roles: ["manager", "staff", "warehouse_manager", "owner"],
 children: [
 { key: "printer-settings", label: "Printer", icon: "printer", desc: "Printer configuration", route: "/printer-settings" },
 ],
 },
];

export const ALL_MODULES = [
 "pos", "b2b", "estimates", "inventory", "warehouse", "ledger",
 "staff", "attendance", "challans",
 "payments", "expenses", "history", "categories",
 "purchases", "purchase-history", "purchase-orders", "barcodes", "bill-scanner",
 "printer-settings",
 "held-bills", "returns",
 "shift-reconciliation", "approval-queue", "agents",
 "web-handoff",
 // Owner full-parity additions (2026-07-22) — see MODULE_CATEGORIES above.
 "sales-orders", "price-lists", "bulk-price-update", "recurring-invoices",
 "reorder-suggestions", "gst-rate-tools",
 "customer-groups", "credit-note", "debit-note", "unified-ledger",
 "payroll", "holidays", "leaves",
 "outlets", "counters", "account-security",
 "pnl-report", "balance-sheet", "gst-reports", "daybook", "aging-report",
 "bank-accounts", "bank-reconciliation", "analytics", "financial-year",
 "scanned-documents", "activity-log", "recycle-bin",
 "business-profile", "modules-settings", "tax-rates", "invoice-templates", "shop-hours", "brands",
 "referral-program", "support-tickets", "notifications", "reminders",
 "subscription-billing",
];

export const ROLE_MODULES: Record<UserRole, string[]> = {
 owner: [
 // Executive Dashboard + Approvals & Control (already existed)
 "approval-queue", "agents", "web-handoff",
 // Billing & Sales
 "pos", "b2b", "estimates", "history", "held-bills", "returns",
 "sales-orders", "price-lists", "bulk-price-update", "recurring-invoices", "bill-scanner",
 // Inventory & Stock
 "inventory", "categories", "barcodes", "reorder-suggestions", "gst-rate-tools",
 // Purchases & Warehouse
 "purchases", "purchase-history", "purchase-orders", "warehouse", "challans",
 // Accounting & Payments
 "ledger", "payments", "expenses", "customer-groups", "credit-note", "debit-note", "unified-ledger",
 // Staff & Attendance
 "staff", "attendance", "payroll", "holidays", "leaves",
 // Approvals & Ops (owner-only additions)
 "shift-reconciliation", "outlets", "counters", "account-security",
 // Financial Reports Hub
 "pnl-report", "balance-sheet", "gst-reports", "daybook", "aging-report",
 "bank-accounts", "bank-reconciliation", "analytics", "financial-year",
 // Back Office
 "scanned-documents", "activity-log", "recycle-bin",
 // Global Configuration & SaaS Settings — Subscription & Billing is
 // owner-only (plan changes shouldn't be delegable to managers), so it's
 // deliberately not mirrored into the manager list below.
 "business-profile", "modules-settings", "tax-rates", "invoice-templates", "shop-hours", "brands",
 "referral-program", "support-tickets", "notifications", "reminders", "subscription-billing",
 "printer-settings",
 ],
 // Manager = everything Owner has, except Bank Accounts and Activity Log —
 // matches shopkeeper-web's manager restriction exactly (web hides only
 // those two for manager; mobile previously hid Reports/Back Office/
 // Settings Hub entirely instead, which left managers unable to do half
 // their job from the phone). See docs/web-vs-mobile-role-access-gap-
 // analysis.md R1-R3.
 manager: [
 "approval-queue", "agents", "web-handoff",
 "pos", "b2b", "estimates", "history", "held-bills", "returns",
 "sales-orders", "price-lists", "bulk-price-update", "recurring-invoices", "bill-scanner",
 "inventory", "categories", "barcodes", "reorder-suggestions", "gst-rate-tools",
 "purchases", "purchase-history", "purchase-orders", "warehouse", "challans",
 "ledger", "payments", "expenses", "customer-groups", "credit-note", "debit-note", "unified-ledger",
 "staff", "attendance", "payroll", "holidays", "leaves",
 "shift-reconciliation", "outlets", "counters", "account-security",
 // Financial Reports Hub — Bank Accounts intentionally excluded (web parity).
 "pnl-report", "balance-sheet", "gst-reports", "daybook", "aging-report",
 "bank-reconciliation", "analytics", "financial-year",
 // Back Office — Activity Log intentionally excluded (web parity).
 "scanned-documents", "recycle-bin",
 // Global Configuration & SaaS Settings
 "business-profile", "modules-settings", "tax-rates", "invoice-templates", "shop-hours", "brands",
 "referral-program", "support-tickets", "notifications", "reminders",
 "printer-settings",
 ],
 // "attendance" added — web gives staff self-check-in; mobile's screen
 // already supported it, but the module list blocked reaching it outside
 // Profile. See docs/web-vs-mobile-role-access-gap-analysis.md R5.
 staff: [
 "pos", "history", "held-bills", "returns",
 "ledger",
 "payments",
 "attendance",
 "printer-settings",
 ],
 // "attendance" and "scanned-documents" added to match web's warehouse
 // manager access. See docs/web-vs-mobile-role-access-gap-analysis.md R4.
 warehouse_manager: [
 "inventory", "categories", "barcodes",
 "purchases", "purchase-history", "purchase-orders", "warehouse", "challans",
 "attendance", "scanned-documents",
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
 reports: "#7C3AED",
 "back-office": "#57534E",
 "settings-hub": "#6B7280",
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
