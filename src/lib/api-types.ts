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
  // Phase 2: GST pricing mode for the company default
  gst_pricing_mode?: "inclusive" | "exclusive";
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
  // Phase 2: per-product GST fields
  tax_category?: "taxable" | "exempt" | "nil_rated" | "non_gst";
  is_tax_inclusive?: boolean;
  cess_rate?: number;
  cess_amount?: number;
  tax_effective_from?: string;
  tracks_serials?: boolean;
  sell_by_weight?: boolean;
  weight_unit?: string;
  price_per_unit?: number;
  has_alternate_pricing?: boolean;
  alternate_price?: number;
  alternate_unit?: string;
  default_billing_mode?: "fixed" | "weight";
  is_returnable_container?: boolean;
  container_deposit?: number;
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

// ── Purchases ───────────────────────────────────────────────────────────────

export type PurchaseStatus = "draft" | "received";

export interface Purchase {
  id: string;
  purchase_number: string;
  supplier_id: string;
  date: string;
  subtotal: number;
  tax_total: number;
  grand_total: number;
  warehouse_id: string;
  is_rcm?: boolean;
  rcm_gst_amount?: number;
  notes?: string;
  purchase_order_id?: string;
  status?: PurchaseStatus;
  created_at: string;
  items?: PurchaseItem[];
  supplier?: Party;
}

export interface PurchaseItem {
  id: string;
  purchase_id: string;
  product_id: string;
  quantity: number;
  cost: number;
  tax_rate: number;
  total: number;
  batch_number?: string;
  expiry_date?: string;
  remaining_quantity?: number;
}

// ── Barcode History ────────────────────────────────────────────────────────

export interface BarcodeHistory {
  id: string;
  company_id: string;
  product_id: string;
  variant_id?: string;
  unit_level?: string;
  barcode_value: string;
  format: "ean13" | "ean8" | "upca" | "code128" | "code39" | "qr" | "internal";
  origin: "generated" | "imported" | "manual";
  is_official_gtin: boolean;
  is_active: boolean;
  check_digit?: string;
  validation_result?: string;
  created_by_id?: string;
  retired_at?: string;
  retired_reason?: string;
  created_at: string;
  product?: { id: string; name: string; sku?: string; barcode?: string };
}

// ── Printer Profiles ───────────────────────────────────────────────────────

export interface PrinterProfile {
  id: string;
  company_id: string;
  name: string;
  outlet_id?: string;
  user_id?: string;
  document_type?: string;
  printer_name?: string;
  printer_type: string;
  paper_size?: string;
  orientation: string;
  margins: string;
  copies: number;
  print_density: number;
  character_width: number;
  auto_cut: boolean;
  cash_drawer_command?: string;
  show_logo: boolean;
  show_header: boolean;
  show_footer: boolean;
  default_template: string;
  fallback_printer_id?: string;
  connection_type: string;
  silent_print: boolean;
  auto_print: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ResolvedPrinterProfile {
  id: string;
  name: string;
  printer_name: string;
  printer_type: string;
  paper_size?: string;
  orientation: string;
  margins: string;
  copies: number;
  print_density: number;
  character_width: number;
  auto_cut: boolean;
  cash_drawer_command?: string;
  show_logo: boolean;
  show_header: boolean;
  show_footer: boolean;
  default_template: string;
  fallback_printer_id?: string;
  connection_type: string;
  silent_print: boolean;
  auto_print: boolean;
  fallback_chain?: ResolvedPrinterProfile[];
}

// ── Print Jobs ──────────────────────────────────────────────────────────────

export type PrintJobStatus = "queued" | "printing" | "printed" | "failed" | "cancelled";

export interface PrintJob {
  id: string;
  company_id: string;
  outlet_id?: string;
  document_type: string;
  document_id?: string;
  document_number?: string;
  printer_profile_id?: string;
  printer_used?: string;
  status: PrintJobStatus;
  failure_reason?: string;
  is_reprint: boolean;
  original_print_job_id?: string;
  original_printed_at?: string;
  requested_by_id?: string;
  requested_by_name?: string;
  terminal_info?: string;
  idempotency_key: string;
  copies: number;
  paper_size?: string;
  template_used?: string;
  created_at: string;
  printed_at?: string;
  updated_at: string;
}

// ── Invoices ──────────────────────────────────────────────────────────────

export type InvoiceType = "gst" | "retail" | "estimate" | "bill_of_supply";
export type PaymentMode = "cash" | "upi" | "credit";
export type PaymentStatus = "paid" | "partial" | "unpaid";
export type InvoiceStatus = "draft" | "confirmed" | "finalized" | "gst_reported" | "locked";
export type GstPricingMode = "inclusive" | "exclusive";

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
  // Phase 1/3: document lifecycle + GST
  version?: number;
  is_edited?: boolean;
  status?: InvoiceStatus;
  gst_pricing_mode?: GstPricingMode;
  cgst_total?: number;
  sgst_total?: number;
  igst_total?: number;
  extra_charge_total?: number;
  extra_charge_label?: string;
  round_off_amount?: number;
  applies_gst?: boolean;
  valid_until?: string;
  notes?: string;
  split_payments?: { method: PaymentMode; amount: number }[];
  tds_amount?: number;
  tds_section?: string;
  tds_rate?: number;
  tcs_amount?: number;
  tcs_rate?: number;
  gst_tds_amount?: number;
  pdf_url?: string;
  deleted_at?: string | null;
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
  // Phase 2: per-line GST columns
  taxable_value?: number;
  cess_amount?: number;
  is_tax_inclusive?: boolean;
  tax_category?: "taxable" | "exempt" | "nil_rated" | "non_gst";
}

// ── Outlets ───────────────────────────────────────────────────────────────

export interface Outlet {
  id: string;
  name: string;
  code: string;
  type: "shop" | "showroom" | "branch" | "warehouse_only" | "office";
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
