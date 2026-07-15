export const SETTINGS_MODULE_CATEGORIES: { id: string; label: string; modules: { key: string; label: string; desc: string }[] }[] = [
  {
    id: "billing",
    label: "Billing & Sales",
    modules: [
      { key: "pos",        label: "POS Billing",             desc: "Point of Sale — retail counter billing" },
      { key: "b2b",        label: "B2B Sales",               desc: "Wholesale / bulk order invoicing" },
      { key: "estimates",  label: "Estimates & Quotations",   desc: "Create and manage sales estimates and quotations" },
    ],
  },
  {
    id: "inventory",
    label: "Inventory & Products",
    modules: [
      { key: "inventory",  label: "Inventory Management",     desc: "Product catalog, stock tracking, barcodes" },
      { key: "warehouse",  label: "Warehouse Management",     desc: "Multi-warehouse stock transfers" },
    ],
  },
  {
    id: "accounting",
    label: "Accounting & Finance",
    modules: [
      { key: "ledger",     label: "Party Ledger",             desc: "Customer/supplier balances, payment tracking" },
      { key: "payments",   label: "Payments",                 desc: "Payment in/out records" },
      { key: "expenses",   label: "Expenses",                 desc: "Operational expense tracking" },
      { key: "reports",    label: "Reports & Compliance",     desc: "GST reports, HSN summaries, day book" },
    ],
  },
  {
    id: "staff",
    label: "Staff & HR",
    modules: [
      { key: "staff",      label: "Staff Management",         desc: "Employee profiles, roles, credentials" },
      { key: "attendance", label: "Attendance",               desc: "Staff check-in/out tracking" },
      { key: "payroll",    label: "Payroll",                  desc: "Salary structures, payslips, and payroll runs" },
    ],
  },
  {
    id: "operations",
    label: "Operations & Logistics",
    modules: [
      { key: "challans",   label: "Delivery Challans",        desc: "Dispatch manifests, transit tracking" },
      { key: "agents",     label: "Field Agents",             desc: "GPS tracking, task assignment" },
    ],
  },
];
