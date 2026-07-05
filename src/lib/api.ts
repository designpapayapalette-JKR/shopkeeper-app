import * as SecureStore from "expo-secure-store";
import { toCamelCase, toSnakeCase } from "./caseConvert";

const apiUrl = process.env.EXPO_PUBLIC_API_URL;

if (!apiUrl) {
  throw new Error("EXPO_PUBLIC_API_URL is not set — see .env.example");
}

const AUTH_STORAGE_KEY = "shopkeeper_auth_data";

interface AuthData {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

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
    console.error(e);
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
}

async function getValidAccessToken(): Promise<string | null> {
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

  const res = await fetch(url, {
    method,
    // App code writes snake_case (matching the old Directus field names) —
    // convert to camelCase for this server.
    body: body !== undefined ? JSON.stringify(toCamelCase(body)) : undefined,
    headers,
  });

  const json = await res.json().catch(() => null);
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
