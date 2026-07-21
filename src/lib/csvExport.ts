import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

function escapeCsvCell(value: unknown): string {
 const str = value === null || value === undefined ? "" : String(value);
 if (str.includes(",") || str.includes("\n") || str.includes('"')) {
 return `"${str.replace(/"/g, '""')}"`;
 }
 return str;
}

export function rowsToCsv(headers: string[], rows: (string | number)[][]): string {
 const lines = [headers.map(escapeCsvCell).join(",")];
 for (const row of rows) {
 lines.push(row.map(escapeCsvCell).join(","));
 }
 return lines.join("\n");
}

// Writes a CSV string to a real file and opens the native share sheet —
// same file-based sharing pattern as invoice PDFs (sharer.ts), so an
// accountant can receive this as an actual attachment over WhatsApp/email
// rather than a screenshot or pasted text.
export async function shareCsv(csv: string, filename: string): Promise<void> {
 const canShare = await Sharing.isAvailableAsync();
 if (!canShare) {
 throw new Error("File sharing is not available on this device.");
 }
 const file = new File(Paths.cache, filename);
 if (file.exists) file.delete();
 file.create();
 file.write(csv);
 await Sharing.shareAsync(file.uri, { mimeType: "text/csv", dialogTitle: filename });
}
