import * as SecureStore from "expo-secure-store";
import { toCamelCase, toSnakeCase } from "./caseConvert";

// The CI build doesn't include the local .env file (it's gitignored), so
// EXPO_PUBLIC_API_URL may be undefined at module-evaluation time. Instead of
// a hard throw that crashes the entire bundle on launch, default to the
// production URL. Callers should validate at point-of-use if needed.
export const apiUrl =
 process.env.EXPO_PUBLIC_API_URL || "https://api.managemycounter.com";

// Cached outlet ID — set by outlet-context on change so every API request
// doesn't need an async SecureStore read. This is updated by the outlet
// context provider when the user switches outlets.
let _cachedOutletId: string | null = null;
export function setOutletId(id: string | null) { _cachedOutletId = id; }
export function getOutletId() { return _cachedOutletId; }

const AUTH_STORAGE_KEY = "shopkeeper_auth_data";

interface AuthData {
 accessToken: string;
 refreshToken: string;
 expiresAt: number;
}

let refreshInFlight: Promise<string | null> | null = null;

async function getAuthData(): Promise<AuthData | null> {
 try {
 const raw = await SecureStore.getItemAsync(AUTH_STORAGE_KEY);
 return raw ? JSON.parse(raw) : null;
 } catch {
 return null;
 }
}

async function setAuthData(data: AuthData | null): Promise<void> {
 try {
 if (data === null) {
 await SecureStore.deleteItemAsync(AUTH_STORAGE_KEY);
 } else {
 await SecureStore.setItemAsync(AUTH_STORAGE_KEY, JSON.stringify(data));
 }
 } catch (e) {
 console.warn("[api] SecureStore write failed — auth tokens not persisted:", e);
 }
}

export class ApiError extends Error {
 status: number;
 body: unknown;
 constructor(status: number, message: string, body: unknown) {
 super(message);
 this.status = status;
 this.body = body;
 }
}

async function refreshAccessToken(): Promise<string | null> {
 if (refreshInFlight) return refreshInFlight;

 refreshInFlight = (async () => {
 const auth = await getAuthData();
 if (!auth?.refreshToken) return null;

 try {
 const res = await fetch(`${apiUrl}/auth/refresh`, {
 method: "POST",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify({ refreshToken: auth.refreshToken }),
 });
 // 401 is the server's ONLY status for "this refresh token is genuinely
 // dead" (not found, expired past its 7-day TTL, reuse-detected/theft, or
 // the user no longer exists — see shopkeeper-api's POST /auth/refresh).
 // Anything else (a network error below, a stray 5xx, a malformed body)
 // is transient and must NOT clear the stored session — that would log
 // someone out over a blip that has nothing to do with their session.
 if (res.status === 401) {
 await setAuthData(null);
 return null;
 }
 if (!res.ok) return null;
 const json = await res.json();
 if (
 typeof json?.accessToken !== "string" ||
 typeof json?.refreshToken !== "string" ||
 typeof json?.expiresAt !== "number"
 ) {
 return null;
 }
 const updated: AuthData = {
 accessToken: json.accessToken,
 refreshToken: json.refreshToken,
 expiresAt: json.expiresAt,
 };
 await setAuthData(updated);
 return updated.accessToken;
 } catch {
 // Network failure reaching the server at all — transient, same as above.
 return null;
 }
 })();

 try {
 return await refreshInFlight;
 } finally {
 refreshInFlight = null;
 }
}

export async function getValidAccessToken(): Promise<string | null> {
 const auth = await getAuthData();
 if (!auth) return null;
 // Refresh a little before actual expiry to avoid a request landing right
 // on the boundary.
 if (Date.now() > auth.expiresAt - 60_000) {
 return refreshAccessToken();
 }
 return auth.accessToken;
}

interface RequestOptions {
 params?: Record<string, string | number | boolean | undefined>;
 skipAuth?: boolean;
}

const REQUEST_TIMEOUT_MS = 20_000;

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
 const controller = new AbortController();
 const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
 try {
 return await fetch(url, { ...init, signal: controller.signal });
 } finally {
 clearTimeout(timer);
 }
}

async function request<T = unknown>(
 method: string,
 path: string,
 body?: unknown,
 options: RequestOptions = {}
): Promise<T> {
 let url = `${apiUrl}${path}`;
 if (options.params) {
 const qs = new URLSearchParams();
 for (const [k, v] of Object.entries(options.params)) {
 if (v !== undefined) qs.set(k, String(v));
 }
 const qsString = qs.toString();
 if (qsString) url += `?${qsString}`;
 }

 const headers: Record<string, string> = { "Content-Type": "application/json" };
 if (!options.skipAuth) {
 const token = await getValidAccessToken();
 if (token) headers.Authorization = `Bearer ${token}`;
 }
 if (_cachedOutletId) {
 headers["X-Outlet-Id"] = _cachedOutletId;
 }

 let res = await fetchWithTimeout(url, {
 method,
 // App code writes snake_case (matching the old Directus field names) —
 // convert to camelCase for this server.
 body: body !== undefined ? JSON.stringify(toCamelCase(body)) : undefined,
 headers,
 });

 if (!options.skipAuth && res.status === 401) {
 const refreshedToken = await refreshAccessToken();
 if (refreshedToken) {
 headers.Authorization = `Bearer ${refreshedToken}`;
 res = await fetchWithTimeout(url, {
 method,
 body: body !== undefined ? JSON.stringify(toCamelCase(body)) : undefined,
 headers,
 });
 }
 }

 const ct = res.headers.get("content-type") || "";
 let json: any = null;
 if (ct.includes("text/html") || ct.includes("text/plain")) {
 const text = await res.text().catch(() => "");
 if (text.includes("<!DOCTYPE") || text.includes("<html") || text.includes("Vercel")) {
 throw new ApiError(
 res.status,
 `API returned HTML instead of JSON — "${apiUrl}" may point to a frontend server. Check your DNS or EXPO_PUBLIC_API_URL.`,
 null
 );
 }
 json = { error: text };
 } else {
 json = await res.json().catch(() => null);
 }
 if (!res.ok) {
 throw new ApiError(res.status, json?.error?.toString() ?? `Request failed (${res.status})`, json);
 }
 // Server responds with camelCase — convert back to snake_case so every
 // existing screen's field access (item.stock_quantity, user.company_id,
 // etc.) keeps working unchanged.
 return toSnakeCase<T>(json);
}

export const api = {
 get: <T = unknown>(path: string, options?: RequestOptions) => request<T>("GET", path, undefined, options),
 post: <T = unknown>(path: string, body?: unknown, options?: RequestOptions) =>
 request<T>("POST", path, body, options),
 put: <T = unknown>(path: string, body?: unknown, options?: RequestOptions) =>
 request<T>("PUT", path, body, options),
 patch: <T = unknown>(path: string, body?: unknown, options?: RequestOptions) =>
 request<T>("PATCH", path, body, options),
 delete: <T = unknown>(path: string, options?: RequestOptions) => request<T>("DELETE", path, undefined, options),
};

// Thrown by login() when the account has email 2FA enabled — password was
// correct, but a session isn't issued yet. Callers (auth-context) catch
// this specifically and hand pendingToken to verifyTwoFactor() once the
// user enters the emailed code.
export class TwoFactorRequiredError extends Error {
 pendingToken: string;
 constructor(pendingToken: string) {
 super("Two-factor verification required");
 this.pendingToken = pendingToken;
 }
}

export class CompanySelectionRequiredError extends Error {
  companies: { id: string; name: string }[];
  constructor(companies: { id: string; name: string }[]) {
    super("Company selection required");
    this.companies = companies;
  }
}

// These three responses carry the raw token pair (accessToken/refreshToken/
// expiresAt), which must stay in the exact shape SecureStore/refresh logic
// expects — read them before the generic snake_case conversion applied to
// everything else, by reading the pre-conversion field names here since
// request() already ran toSnakeCase on the whole payload.
export async function login(email: string, password: string, companyId?: string) {
  const json: any = await request<any>("POST", "/auth/login", { email, password, companyId }, { skipAuth: true });
  // toSnakeCase() replaces each uppercase letter independently, so the
  // server's "requires2FA" (no snake_case-friendly word boundary before
  // consecutive caps) becomes "requires2_f_a", not "requires_2fa". Verified
  // against caseConvert.ts's actual regex rather than guessed.
  if (json.requires2_f_a) {
    throw new TwoFactorRequiredError(json.pending_token);
  }
  if (json.requires_company_selection && Array.isArray(json.companies)) {
    throw new CompanySelectionRequiredError(json.companies.map((c: any) => ({
      id: c.id,
      name: c.name,
    })));
  }
  await setAuthData({ accessToken: json.access_token, refreshToken: json.refresh_token, expiresAt: json.expires_at });
  return json.user;
}

export async function verifyTwoFactor(pendingToken: string, code: string) {
 const json: any = await request<any>("POST", "/auth/2fa/verify", { pendingToken, code }, { skipAuth: true });
 await setAuthData({ accessToken: json.access_token, refreshToken: json.refresh_token, expiresAt: json.expires_at });
 return json.user;
}

export async function resendTwoFactorCode(pendingToken: string): Promise<void> {
 await request("POST", "/auth/2fa/resend", { pendingToken }, { skipAuth: true });
}

export async function enableTwoFactor(): Promise<void> {
 await request("POST", "/auth/2fa/enable");
}

export async function disableTwoFactor(password: string): Promise<void> {
 await request("POST", "/auth/2fa/disable", { password });
}

export async function requestPasswordReset(email: string): Promise<void> {
 await request("POST", "/auth/forgot-password", { email }, { skipAuth: true });
}

export async function resendVerificationEmail(): Promise<void> {
 await request("POST", "/auth/verify-email/resend");
}

export async function registerCompany(data: {
  companyName: string;
  state?: string;
  email: string;
  password: string;
  firstName: string;
  lastName?: string;
  inviteCode: string;
  referralCode?: string;
}) {
 const json: any = await request<any>("POST", "/companies/register", data, { skipAuth: true });
 await setAuthData({ accessToken: json.access_token, refreshToken: json.refresh_token, expiresAt: json.expires_at });
 return json.user;
}

export async function logout(): Promise<void> {
 try {
 await request("POST", "/auth/logout");
 } catch {
 // best-effort — clear local session regardless
 }
 await setAuthData(null);
}

const LAST_USER_KEY = "shopkeeper_last_user";

// Cached alongside the tokens so a transient fetchMe() failure (see below)
// can still render the app with the last-known profile instead of forcing
// a login screen — the whole point of this cache is to make "no logout
// without manual action" actually achievable on a cold boot with a flaky
// connection, not just "don't clear the tokens."
async function getCachedUser(): Promise<any | null> {
 try {
 const raw = await SecureStore.getItemAsync(LAST_USER_KEY);
 return raw ? JSON.parse(raw) : null;
 } catch {
 return null;
 }
}

async function setCachedUser(user: unknown): Promise<void> {
 try {
 await SecureStore.setItemAsync(LAST_USER_KEY, JSON.stringify(user));
 } catch {
 // best-effort — losing the cache just means a future transient failure
 // can't fall back to it, not a functional break right now.
 }
}

export type FetchMeResult = { status: "ok"; user: any } | { status: "unauthenticated" } | { status: "transient"; cachedUser: any | null };

export async function fetchMe(): Promise<FetchMeResult> {
 const auth = await getAuthData();
 if (!auth) return { status: "unauthenticated" };
 try {
 const json: any = await request<any>("GET", "/auth/me");
 await setCachedUser(json.user);
 return { status: "ok", user: json.user };
 } catch (e) {
 // A real 401 here means request()'s own reactive refresh-and-retry
 // (see request() above) already tried once and the server confirmed
 // the session is genuinely dead — anything else (network error, 5xx,
 // timeout) is transient and must not be treated as "logged out."
 if (e instanceof ApiError && e.status === 401) {
 return { status: "unauthenticated" };
 }
 return { status: "transient", cachedUser: await getCachedUser() };
 }
}

export async function hasStoredSession(): Promise<boolean> {
 return (await getAuthData()) !== null;
}

// Uploads a device photo (e.g. an expense receipt) to Cloudinary via the
// backend's multipart endpoint and returns the durable URL to store on the
// record — bypasses the JSON request() path since this is multipart/
// form-data, not JSON.
export async function uploadDocument(fileUri: string, category: string): Promise<string> {
 let token = await getValidAccessToken();
 const form = new FormData();
 form.append("file", {
 uri: fileUri,
 name: `${category}-${Date.now()}.jpg`,
 type: "image/jpeg",
 } as any);
 form.append("category", category);

 let res = await fetch(`${apiUrl}/uploads/document`, {
 method: "POST",
 headers: token ? { Authorization: `Bearer ${token}` } : undefined,
 body: form,
 });

 if (res.status === 401) {
 token = await refreshAccessToken();
 if (token) {
 res = await fetch(`${apiUrl}/uploads/document`, {
 method: "POST",
 headers: { Authorization: `Bearer ${token}` },
 body: form,
 });
 }
 }

 const ct = res.headers.get("content-type") || "";
 let json: any = null;
 if (ct.includes("text/html") || ct.includes("text/plain")) {
 const text = await res.text().catch(() => "");
 if (text.includes("<!DOCTYPE") || text.includes("<html")) {
 throw new ApiError(res.status, `API returned HTML — "${apiUrl}" DNS may point to a frontend server.`, null);
 }
 json = { error: text };
 } else {
 json = await res.json().catch(() => null);
 }
 if (!res.ok) {
 throw new ApiError(res.status, json?.error?.toString() ?? `Upload failed (${res.status})`, json);
 }
 return json.data.url;
}

// Phase 3: Invoice status transitions & GST mode
export async function updateInvoiceStatus(
  invoiceId: string,
  status: "draft" | "confirmed" | "finalized" | "gst_reported" | "locked",
  reason?: string
) {
  return api.patch(`/invoices/${invoiceId}/status`, { status, reason });
}

export async function changeInvoiceGstMode(
  invoiceId: string,
  gstPricingMode: "inclusive" | "exclusive",
  reason: string
) {
  return api.post(`/invoices/${invoiceId}/gst-mode`, { gstPricingMode, reason });
}

export async function requestInvoiceEdit(
  invoiceId: string,
  fields: { notes?: string | null; dueDate?: string | null; validUntil?: string | null },
  reason: string
) {
  return api.post(`/invoices/${invoiceId}/edit-request`, { ...fields, reason });
}

export async function approveInvoiceEdit(invoiceId: string, versionId: string, reason?: string) {
  return api.post(`/invoices/${invoiceId}/edits/${versionId}/approve`, { reason });
}

export async function rejectInvoiceEdit(invoiceId: string, versionId: string, reason?: string) {
  return api.post(`/invoices/${invoiceId}/edits/${versionId}/reject`, { reason });
}

// Phase 4: Printer profiles & barcode history
export async function resolvePrinterProfile(params: {
  outletId?: string;
  userId?: string;
  documentType?: string;
}): Promise<{ profile: any; fallbackChain: any[] } | { profile: null }> {
  const qs = new URLSearchParams();
  if (params.outletId) qs.set("outletId", params.outletId);
  if (params.userId) qs.set("userId", params.userId);
  if (params.documentType) qs.set("documentType", params.documentType);
  return api.get(`/printer-profiles/resolve?${qs.toString()}`);
}

export async function getProductActiveBarcode(productId: string) {
  return api.get(`/barcode-history/products/${productId}/barcodes/active`);
}

export async function getProductBarcodeHistory(productId: string, limit = 100) {
  return api.get(`/barcode-history/products/${productId}/barcodes/history?limit=${limit}`);
}

export async function reprintPrintJob(printJobId: string, options?: {
  printerProfileId?: string;
  printerUsed?: string;
  copies?: number;
  paperSize?: string;
  templateUsed?: string;
}) {
  return api.post(`/print-jobs/${printJobId}/reprint`, options);
}

// Purchase status
export async function updatePurchaseStatus(purchaseId: string, status: "draft" | "received") {
  return api.patch(`/purchases/${purchaseId}`, { status });
}
