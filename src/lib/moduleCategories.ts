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
    roles: ["owner", "manager", "staff"],
    children: [
      { key: "pos", label: "POS Billing", icon: "point-of-sale", desc: "Counter billing terminal", route: "/(tabs)/pos" },
      { key: "b2b", label: "B2B Sales", icon: "briefcase-account", desc: "Wholesale invoicing", route: "/(tabs)/b2b" },
      { key: "estimates", label: "Orders & Quotes", icon: "file-document-outline", desc: "Estimates and quotations", route: "/(tabs)/estimates" },
      { key: "recurring", label: "Recurring Invoices", icon: "repeat", desc: "Auto-repeating invoices", route: "/recurring-invoices" },
      { key: "price-lists", label: "Price Lists", icon: "tag-multiple", desc: "Product pricing tiers", route: "/price-lists" },
      { key: "history", label: "History", icon: "history", desc: "Past transaction records", route: "/invoice-history" },
      { key: "counters", label: "Counters", icon: "counter", desc: "POS counter management", route: "/counters" },
    ],
  },
  {
    id: "inventory",
    label: "Inventory & Products",
    icon: "package-variant",
    roles: ["owner", "manager", "warehouse_manager"],
    children: [
      { key: "inventory", label: "Inventory", icon: "package-variant-closed", desc: "Product catalog and stock", route: "/(tabs)/inventory" },
      { key: "categories", label: "Categories", icon: "tag", desc: "Product categories and brands", route: "/categories" },
      { key: "brands", label: "Brands", icon: "trademark", desc: "Product brand management", route: "/brands" },
      { key: "purchases", label: "Purchases", icon: "truck", desc: "Stock purchase entry", route: "/purchase-entry" },
      { key: "purchase-orders", label: "Purchase Orders", icon: "clipboard-text", desc: "PO creation and management", route: "/purchase-orders" },
      { key: "barcodes", label: "Barcodes", icon: "barcode", desc: "Barcode label generation", route: "/barcode-generator" },
      { key: "warehouse", label: "Warehouses & Stores", icon: "warehouse", desc: "Multi-warehouse management", route: "/stock-transfer-requests" },
    ],
  },
  {
    id: "accounting",
    label: "Accounting & Finance",
    icon: "account-cash",
    roles: ["owner", "manager"],
    children: [
      { key: "ledger", label: "Parties", icon: "account-group", desc: "Customer/supplier ledger", route: "/(tabs)/ledger" },
      { key: "customer-groups", label: "Customer Groups", icon: "account-multiple", desc: "Group-based pricing", route: "/customer-groups" },
      { key: "payments", label: "Payments", icon: "credit-card", desc: "Payment in/out recording", route: "/payment-history" },
      { key: "credit-notes", label: "Credit Notes", icon: "credit-refund", desc: "Customer credit issuance", route: "/credit-note" },
      { key: "debit-notes", label: "Debit Notes", icon: "credit-card-minus", desc: "Supplier debit issuance", route: "/debit-note" },
      { key: "expenses", label: "Expenses", icon: "wallet", desc: "Operational expense tracking", route: "/expenses" },
      { key: "analytics", label: "Analytics", icon: "chart-arc", desc: "Business analytics and trends", route: "/analytics" },
      { key: "reports", label: "Reports", icon: "chart-box-outline", desc: "GST reports and summaries", route: "/gst-reports" },
      { key: "bank-accounts", label: "Bank Accounts", icon: "bank", desc: "Bank account management", route: "/bank-accounts" },
      { key: "daybook", label: "Daybook", icon: "book-open-page-variant", desc: "Daily transaction journal", route: "/daybook" },
      { key: "reminders", label: "Payment Reminders", icon: "bell-ring", desc: "Overdue payment reminders", route: "/reminders" },
    ],
  },
  {
    id: "staff-hr",
    label: "Staff & HR",
    icon: "account-tie",
    roles: ["owner", "manager"],
    children: [
      { key: "staff", label: "Staff", icon: "account-multiple-outline", desc: "Employee profiles and roles", route: "/staff" },
      { key: "attendance", label: "Attendance", icon: "calendar-check", desc: "Staff check-in/out", route: "/attendance" },
      { key: "payroll", label: "Payroll", icon: "cash-multiple", desc: "Salary and payslips", route: "/payroll" },
    ],
  },
  {
    id: "operations",
    label: "Operations & Logistics",
    icon: "truck-delivery",
    roles: ["owner", "manager", "warehouse_manager"],
    children: [
      { key: "challans", label: "Challans", icon: "clipboard-list", desc: "Delivery challans", route: "/challans" },
      { key: "agents", label: "Field Agents", icon: "map-marker-radius", desc: "GPS tracking and tasks", route: "/(tabs)/agents" },
      { key: "outlets", label: "Outlets", icon: "store", desc: "Branch/location management", route: "/outlets" },
    ],
  },
  {
    id: "back-office",
    label: "Back Office",
    icon: "file-document-multiple",
    roles: ["owner", "manager"],
    children: [
      { key: "scanned-docs", label: "Scanned Docs", icon: "scanner", desc: "Document scanning and OCR", route: "/scanned-documents" },
      { key: "activity-log", label: "Activity Log", icon: "clipboard-text-clock", desc: "Audit trail", route: "/activity-log" },
      { key: "recycle-bin", label: "Recycle Bin", icon: "delete-restore", desc: "Deleted records", route: "/recycle-bin" },
      { key: "notifications", label: "Notifications", icon: "bell-outline", desc: "Notification inbox", route: "/notifications" },
    ],
  },
  {
    id: "settings",
    label: "Settings",
    icon: "cog",
    roles: ["owner"],
    children: [
      { key: "account-security", label: "Account Security", icon: "shield-lock", desc: "Password and 2FA", route: "/account-security" },
      { key: "subscription", label: "Subscription", icon: "credit-card-outline", desc: "Plan and billing", route: "/subscription" },
      { key: "support", label: "Support", icon: "help-circle", desc: "Help and tickets", route: "/support-tickets" },
      { key: "referrals", label: "Referral Program", icon: "gift", desc: "Referral codes and rewards", route: "/referral-program" },
      { key: "tax-rates", label: "Tax Rates", icon: "percent", desc: "Tax rate configuration", route: "/tax-rates" },
    ],
  },
];

export const ALL_MODULES = [
  "pos", "b2b", "estimates", "inventory", "warehouse", "ledger",
  "staff", "attendance", "agents", "challans",
  "payments", "expenses", "reports", "payroll",
  "recurring", "price-lists", "history", "categories",
  "purchases", "purchase-orders", "barcodes",
  "customer-groups", "credit-notes", "debit-notes",
  "analytics", "bank-accounts", "daybook",
  "scanned-docs", "activity-log", "recycle-bin",
  "account-security", "subscription", "support", "referrals",
  "notifications", "outlets", "reminders", "brands", "counters", "tax-rates",
];

export const ROLE_MODULES: Record<UserRole, string[]> = {
  owner: ALL_MODULES,
  manager: [
    "pos", "b2b", "estimates", "inventory", "warehouse",
    "ledger", "payments", "expenses", "reports",
    "staff", "attendance", "payroll", "challans", "agents",
    "recurring", "price-lists", "history", "categories",
    "purchases", "purchase-orders", "barcodes",
    "customer-groups", "credit-notes", "debit-notes",
    "analytics", "scanned-docs", "activity-log",
    "account-security", "support",
    "reminders", "brands", "counters", "tax-rates",
  ],
  staff: ["pos", "history"],
  warehouse_manager: [
    "inventory", "warehouse", "challans",
    "categories", "barcodes",
    "purchases", "purchase-orders",
    "scanned-docs",
  ],
  field_agent: [],
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
      { key: "inventory", label: "Inventory Management", desc: "Product catalog, stock tracking, barcodes" },
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
      { key: "reports", label: "Reports & Compliance", desc: "GST reports, HSN summaries, day book" },
    ],
  },
  {
    id: "staff",
    label: "Staff & HR",
    modules: [
      { key: "staff", label: "Staff Management", desc: "Employee profiles, roles, credentials" },
      { key: "attendance", label: "Attendance", desc: "Staff check-in/out tracking" },
      { key: "payroll", label: "Payroll", desc: "Salary structures, payslips, and payroll runs" },
    ],
  },
  {
    id: "operations",
    label: "Operations & Logistics",
    modules: [
      { key: "challans", label: "Delivery Challans", desc: "Dispatch manifests, transit tracking" },
      { key: "agents", label: "Field Agents", desc: "GPS tracking, task assignment" },
    ],
  },
];
