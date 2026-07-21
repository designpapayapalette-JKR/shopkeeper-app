import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";

// Minimal RFC4180-style CSV parser — handles quoted fields (with embedded
// commas/newlines/escaped quotes) since a shop owner filling a template in
// Excel/Sheets will routinely have commas inside a name or address field.
export function parseCsv(text: string): string[][] {
 const rows: string[][] = [];
 let row: string[] = [];
 let field = "";
 let inQuotes = false;

 for (let i = 0; i < text.length; i++) {
 const char = text[i];
 if (inQuotes) {
 if (char === '"') {
 if (text[i + 1] === '"') {
 field += '"';
 i++;
 } else {
 inQuotes = false;
 }
 } else {
 field += char;
 }
 } else if (char === '"') {
 inQuotes = true;
 } else if (char === ",") {
 row.push(field);
 field = "";
 } else if (char === "\n" || char === "\r") {
 if (char === "\r" && text[i + 1] === "\n") i++;
 row.push(field);
 rows.push(row);
 row = [];
 field = "";
 } else {
 field += char;
 }
 }
 if (field.length > 0 || row.length > 0) {
 row.push(field);
 rows.push(row);
 }
 return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

// Parses a CSV into an array of plain objects keyed by the header row, so
// callers can map each row to an API payload by column name rather than by
// fragile positional index.
export function parseCsvToObjects(text: string): Record<string, string>[] {
 const rows = parseCsv(text);
 if (rows.length === 0) return [];
 const headers = rows[0].map((h) => h.trim());
 return rows.slice(1).map((row) => {
 const obj: Record<string, string> = {};
 headers.forEach((header, i) => {
 obj[header] = (row[i] ?? "").trim();
 });
 return obj;
 });
}

// Opens the system file picker restricted to CSV/text and returns the raw
// file contents, or null if the user cancelled.
export async function pickAndReadCsvFile(): Promise<string | null> {
 const result = await DocumentPicker.getDocumentAsync({
 type: ["text/csv", "text/comma-separated-values", "text/plain", "application/vnd.ms-excel"],
 copyToCacheDirectory: true,
 });
 if (result.canceled || !result.assets?.[0]) return null;
 const file = new File(result.assets[0].uri);
 return file.text();
}
