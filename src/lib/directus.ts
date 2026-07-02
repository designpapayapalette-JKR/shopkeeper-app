import { authentication, createDirectus, rest } from "@directus/sdk";

const apiUrl = process.env.EXPO_PUBLIC_API_URL;

if (!apiUrl) {
  throw new Error("EXPO_PUBLIC_API_URL is not set — see .env.example");
}

export const directus = createDirectus(apiUrl).with(rest()).with(authentication());
