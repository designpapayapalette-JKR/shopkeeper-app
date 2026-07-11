import * as SecureStore from "expo-secure-store";
import { toCamelCase, toSnakeCase } from "./caseConvert";

// The CI build doesn't include the local .env file (it's gitignored), so
// EXPO_PUBLIC_API_URL may be undefined at module-evaluation time. Instead of
// a hard throw that crashes the entire bundle on launch, default to the
// production URL. Callers should validate at point-of-use if needed.
export const apiUrl =
  process.env.EXPO_PUBLIC_API_URL || "https://api.papayapalette.online";

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

  const res = await fetch(`${apiUrl}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken: auth.refreshToken }),
  });
  if (!res.ok) {
    await setAuthData(null);
    return null;
  }
  const json = await res.json();
  const updated: AuthData = { ...auth, accessToken: json.accessToken, expiresAt: json.expiresAt };
  await setAuthData(updated);
  return updated.accessToken;
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

  let res = await fetch(url, {
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
      res = await fetch(url, {
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
  patch: <T = unknown>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>("PATCH", path, body, options),
  delete: <T = unknown>(path: string, options?: RequestOptions) => request<T>("DELETE", path, undefined, options),
};

// These three responses carry the raw token pair (accessToken/refreshToken/
// expiresAt), which must stay in the exact shape SecureStore/refresh logic
// expects — read them before the generic snake_case conversion applied to
// everything else, by reading the pre-conversion field names here since
// request() already ran toSnakeCase on the whole payload.
export async function login(email: string, password: string) {
  const json: any = await request<any>("POST", "/auth/login", { email, password }, { skipAuth: true });
  await setAuthData({ accessToken: json.access_token, refreshToken: json.refresh_token, expiresAt: json.expires_at });
  return json.user;
}

export async function registerCompany(data: {
  companyName: string;
  state?: string;
  email: string;
  password: string;
  firstName: string;
  lastName?: string;
  inviteCode: string;
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

export async function fetchMe(): Promise<any | null> {
  const auth = await getAuthData();
  if (!auth) return null;
  try {
    const json: any = await request<any>("GET", "/auth/me");
    return json.user;
  } catch {
    return null;
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
