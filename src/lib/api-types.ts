// Auto-generated API types — mirrors shopkeeper-api route response shapes.
// These are manually curated from the backend route files and should be
// regenerated when the API changes. In a mature project this file would be
// produced by openapi-typescript from a real OpenAPI spec.

// ── Auth ──────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name?: string;
  phone?: string;
  role: UserRole;
  company_id?: string;
  is_active?: boolean;
  created_at: string;
  push_token?: string | null;
  counter_id?: string | null;
  restrict_sales_to_own_counter?: boolean;
  counter?: { id: string; name: string } | null;
}

export type UserRole = "owner" | "manager" | "staff" | "warehouse_manager" | "field_agent";

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user: User;
  requires2_f_a?: boolean;
  pending_token?: string;
}

export interface RegisterResponse {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user: User;
}

// ── Company ───────────────────────────────────────────────────────────────

export interface Company {
  id: string;
  name: string;
  state?: string;
  gstin?: string;
  address?: string;
  phone?: string;
  email?: string;
  logo_url?: string;
  signature_url?: string;
  upi_id?: string;
  upi_payee_name?: string;
  upi_qr_url?: string;
  business_mode?: "retail" | "b2b";
  onboarding_completed_at?: string;
  subscription_status: "trial" | "active" | "expired";
  subscription_plan?: string;
  subscription_end_date?: string;
  enabled_modules?: string[];
  mobile_enabled_modules?: string[];
  session_timeout?: number;
  created_at: string;
}

export interface UpdateCompanyPayload {
  name?: string;
  state?: string;
  gstin?: string;
  address?: string;
  phone?: string;
  business_mode?: "retail" | "b2b";
  onboarding_completed_at?: string;
  enabled_modules?: string[];
}

// ── Dashboard ─────────────────────────────────────────────────────────────

export interface DashboardKpi {
  sales_today: number;
  invoices_today: number;
  cash_total: number;
  upi_total: number;
}

export interface OwnerDashboard extends DashboardKpi {
  outlets: { id: string; name: string; sales: number; bills: number }[];
}

export interface ConsolidatedDashboard {
  today_sales_total: number;
  today_txn_count: number;
  average_bill: number;
  total_parties: number;
  total_products: number;
  week_trend: { date: string; total: number }[];
  top_products: { name: string; revenue: number; quantity: number }[];
  low_stock_alerts: { id: string; name: string; stock: number; threshold: number }[];
  recent_activity: { id: string; action: string; entity_type: string; entity_label: string; created_at: string }[];
}

// ── Products & Stock ──────────────────────────────────────────────────────

export interface Product {
  id: string;
  name: string;
  sku?: string;
  hsn_code?: string;
  unit?: string;
  mrp?: number;
  cost?: number;
  price?: number;
  tax_rate?: number;
  stock_quantity: number;
  reorder_level?: number;
  category_id?: string;
  category?: { id: string; name: string };
  brand_id?: string;
  warehouse_id?: string;
  barcode?: string;
  is_active: boolean;
  created_at: string;
}

export interface StockMovement {
  id: string;
  product_id: string;
  warehouse_id: string;
  quantity: number;
  type: string;
  reason: string;
  created_at: string;
  product?: { name: string };
}

// ── Parties & Ledger ──────────────────────────────────────────────────────

export type PartyType = "customer" | "supplier";

export interface Party {
  id: string;
  name: string;
  phone?: string;
  gstin?: string;
  address?: string;
  state?: string;
  type: PartyType;
  current_balance: number;
  credit_limit?: number;
  is_active: boolean;
  created_at: string;
}

export interface LedgerEntry {
  id: string;
  party_id: string;
  date: string;
  type: "debit" | "credit";
  amount: number;
  reference?: string;
  party?: { id: string; name: string; type: PartyType };
  created_at: string;
}

export interface Payment {
  id: string;
  party_id: string;
  invoice_id?: string;
  direction: "in" | "out";
  amount: number;
  mode?: string;
  reference?: string;
  date: string;
  created_at: string;
}

// ── Invoices ──────────────────────────────────────────────────────────────

export type InvoiceType = "gst" | "retail" | "estimate" | "bill_of_supply";
export type PaymentMode = "cash" | "upi" | "credit";
export type PaymentStatus = "paid" | "partial" | "unpaid";

export interface Invoice {
  id: string;
  invoice_number: string;
  type: InvoiceType;
  channel?: string;
  date: string;
  due_date?: string;
  party_id: string;
  subtotal: number;
  discount_total: number;
  tax_total: number;
  grand_total: number;
  amount_paid: number;
  payment_mode: PaymentMode;
  payment_status: PaymentStatus;
  party?: Party;
  items?: InvoiceItem[];
  created_at: string;
}

export interface InvoiceItem {
  id: string;
  product_id: string;
  quantity: number;
  price: number;
  tax_rate: number;
  discount: number;
  total: number;
  product?: { name: string; sku?: string; hsn_code?: string };
}

// ── Outlets ───────────────────────────────────────────────────────────────

export interface Outlet {
  id: string;
  name: string;
  code: string;
  type: "shop" | "showroom" | "branch" | "warehouse_only";
  is_active: boolean;
}

// ── Staff ─────────────────────────────────────────────────────────────────

export interface StaffMember {
  id: string;
  email: string;
  first_name: string;
  last_name?: string;
  phone?: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  counter_id?: string | null;
  restrict_sales_to_own_counter?: boolean;
  counter?: { id: string; name: string } | null;
}

export interface CreateStaffPayload {
  email?: string;
  password?: string;
  first_name: string;
  last_name?: string;
  phone?: string;
  role: Exclude<UserRole, "owner">;
}

// ── Notifications ─────────────────────────────────────────────────────────

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  type: string;
  link?: string;
  is_read: boolean;
  created_at: string;
}

// ── API Response Wrappers ─────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total_count: number;
    total_pages: number;
    unread_count?: number;
  };
}
