// The new shopkeeper-api returns/expects camelCase (companyId, stockQuantity)
// since that's idiomatic for a hand-written Node API, but every screen in
// this app was written against Directus's snake_case field names
// (company_id, stock_quantity). Converting at the API client boundary keeps
// the screen-by-screen migration mechanical — swap the call, not every
// field reference throughout the JSX.

function toSnake(key: string): string {
  return key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

function toCamel(key: string): string {
  return key.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
}

function deepConvert(value: unknown, convertKey: (key: string) => string): unknown {
  if (Array.isArray(value)) {
    return value.map((v) => deepConvert(v, convertKey));
  }
  if (value !== null && typeof value === "object" && !(value instanceof Date)) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        convertKey(k),
        deepConvert(v, convertKey),
      ])
    );
  }
  return value;
}

export function toSnakeCase<T = unknown>(value: unknown): T {
  return deepConvert(value, toSnake) as T;
}

export function toCamelCase<T = unknown>(value: unknown): T {
  return deepConvert(value, toCamel) as T;
}
