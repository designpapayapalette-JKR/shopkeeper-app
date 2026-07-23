import { api } from "./api";
import type {
  ApiResponse,
  PaginatedResponse,
  User,
  Company,
  UpdateCompanyPayload,
  DashboardKpi,
  OwnerDashboard,
  ConsolidatedDashboard,
  Product,
  StockMovement,
  Party,
  LedgerEntry,
  Payment,
  Invoice,
  Outlet,
  StaffMember,
  CreateStaffPayload,
  AppNotification,
} from "./api-types";

// Typed API client — wraps the generic `api` from api.ts with full type
// information. Screens that need typed responses should import from here
// instead of calling api.get directly.
export const typedApi = {
  // ── Auth ──
  me: () => api.get<{ user: User }>("/auth/me"),

  // ── Company ──
  getCompany: () => api.get<ApiResponse<Company>>("/companies/me"),
  updateCompany: (payload: UpdateCompanyPayload) => api.patch<ApiResponse<Company>>("/companies/me", payload),
  getModules: () => api.get<ApiResponse<string[]>>("/companies/me/modules"),
  updateModules: (modules: string[]) => api.patch<ApiResponse<string[]>>("/companies/me/modules", { modules }),

  // ── Dashboard ──
  getDashboardKpi: () => api.get<ApiResponse<DashboardKpi>>("/dashboard"),
  getOwnerDashboard: () => api.get<ApiResponse<OwnerDashboard>>("/dashboard/owner"),
  getConsolidatedDashboard: () => api.get<ApiResponse<ConsolidatedDashboard>>("/dashboard/consolidated"),

  // ── Products ──
  getProducts: () => api.get<ApiResponse<Product[]>>("/products"),
  getProduct: (id: string) => api.get<ApiResponse<Product>>(`/products/${id}`),
  createProduct: (payload: Partial<Product>) => api.post<ApiResponse<Product>>("/products", payload),
  updateProduct: (id: string, payload: Partial<Product>) => api.patch<ApiResponse<Product>>(`/products/${id}`, payload),
  deleteProduct: (id: string) => api.delete<{ success: boolean }>(`/products/${id}`),

  // ── Stock Movements ──
  getStockMovements: () => api.get<ApiResponse<StockMovement[]>>("/stock-movements"),
  adjustStock: (payload: { product_id: string; warehouse_id: string; quantity: number; reason: string }) =>
    api.post<ApiResponse<StockMovement>>("/stock-movements/adjust", payload),

  // ── Parties ──
  getParties: (type?: Party["type"]) =>
    api.get<ApiResponse<Party[]>>("/parties", { params: type ? { type } : undefined }),
  getParty: (id: string) => api.get<ApiResponse<Party>>(`/parties/${id}`),
  createParty: (payload: Partial<Party>) => api.post<ApiResponse<Party>>("/parties", payload),

  // ── Ledger ──
  getLedgerEntries: (partyId: string, page = 1) =>
    api.get<PaginatedResponse<LedgerEntry>>(`/ledger/${partyId}`, { params: { page, limit: 50 } }),
  getUnifiedLedger: (page = 1) =>
    api.get<PaginatedResponse<LedgerEntry>>("/ledger/unified/all", { params: { page, limit: 50 } }),
  recordPayment: (payload: {
    party_id: string; invoice_id?: string; direction: "in" | "out";
    amount: number; mode?: string; reference?: string;
  }) => api.post<ApiResponse<Payment>>("/ledger/payments", payload),
  createManualEntry: (payload: {
    party_id: string; type: "debit" | "credit";
    amount: number; reference?: string;
  }) => api.post<ApiResponse<LedgerEntry>>("/ledger/entries", payload),

  // ── Invoices ──
  getInvoices: (page = 1) =>
    api.get<PaginatedResponse<Invoice>>("/invoices", { params: { page, limit: 20 } }),
  getInvoice: (id: string) => api.get<ApiResponse<Invoice>>(`/invoices/${id}`),

  // ── Outlets ──
  getOutlets: () => api.get<ApiResponse<Outlet[]>>("/outlets"),

  // ── Staff ──
  getStaff: () => api.get<ApiResponse<StaffMember[]>>("/staff"),
  createStaff: (payload: CreateStaffPayload) => api.post<ApiResponse<StaffMember>>("/staff", payload),
  updateStaff: (id: string, payload: Partial<StaffMember>) => api.patch<ApiResponse<StaffMember>>(`/staff/${id}`, payload),
  deleteStaff: (id: string) => api.delete<{ success: boolean }>(`/staff/${id}`),

  // ── Notifications ──
  getNotifications: (page = 1) =>
    api.get<PaginatedResponse<AppNotification>>("/notifications", { params: { page, limit: 20 } }),
  markNotificationRead: (id: string) => api.patch<{ success: boolean }>(`/notifications/${id}/read`),
  markAllNotificationsRead: () => api.post<{ success: boolean }>("/notifications/read-all"),
  clearNotifications: () => api.delete<{ success: boolean }>("/notifications/clear-all"),

  // ── Brands ──
  getBrands: () => api.get<ApiResponse<any[]>>("/brands"),
};
