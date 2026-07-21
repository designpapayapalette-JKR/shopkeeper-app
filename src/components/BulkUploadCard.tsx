import React, { useState } from "react";
import { View, Text, Pressable, ActivityIndicator, Alert, Modal, ScrollView } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "react-native-paper";
import { rowsToCsv, shareCsv } from "../lib/csvExport";
import { parseCsvToObjects, pickAndReadCsvFile } from "../lib/csvImport";

export interface BulkUploadColumn {
 header: string;
 example: string;
 required: boolean;
}

interface Props {
 entityLabel: string; // e.g. "Products", "Parties", "Bank Accounts"
 columns: BulkUploadColumn[];
 // Maps one parsed CSV row (keyed by column header) to a create payload,
 // or throws/returns null to skip+report that row as invalid.
 mapRowToPayload: (row: Record<string, string>) => Record<string, unknown> | null;
 // Persists a single mapped payload — usually `api.post("/products", payload)`.
 createOne: (payload: Record<string, unknown>) => Promise<void>;
 onComplete?: () => void;
}

interface RowResult {
 rowNumber: number;
 label: string;
 status: "success" | "error";
 message?: string;
}

// Generic "download a CSV template, fill it in, upload it back" flow reused
// across every module that has bulk-importable master data (Products,
// Parties, Bank Accounts, ...). Uploads run sequentially rather than in
// parallel — these are typically tens to low hundreds of rows for a small
// shop, and sequential requests give a clean, orderable per-row result list
// without needing a bulk-insert endpoint on the server.
export default function BulkUploadCard({ entityLabel, columns, mapRowToPayload, createOne, onComplete }: Props) {
 const theme = useTheme();
 const [downloading, setDownloading] = useState(false);
 const [uploading, setUploading] = useState(false);
 const [results, setResults] = useState<RowResult[] | null>(null);

 const handleDownloadTemplate = async () => {
 setDownloading(true);
 try {
 const headers = columns.map((c) => c.header);
 const exampleRow = columns.map((c) => c.example);
 const csv = rowsToCsv(headers, [exampleRow]);
 await shareCsv(csv, `${entityLabel.replace(/\s+/g, "-")}-Template.csv`);
 } catch (e: any) {
 Alert.alert("Error", e?.message || "Could not generate the template.");
 } finally {
 setDownloading(false);
 }
 };

 const handleUpload = async () => {
 try {
 const text = await pickAndReadCsvFile();
 if (!text) return; // user cancelled

 const rows = parseCsvToObjects(text);
 if (rows.length === 0) {
 Alert.alert("Empty File", "No data rows were found in this file.");
 return;
 }

 setUploading(true);
 const rowResults: RowResult[] = [];
 for (let i = 0; i < rows.length; i++) {
 const row = rows[i];
 const label = row[columns[0]?.header] || `Row ${i + 2}`;
 try {
 const payload = mapRowToPayload(row);
 if (!payload) {
 rowResults.push({ rowNumber: i + 2, label, status: "error", message: "Missing required fields" });
 continue;
 }
 await createOne(payload);
 rowResults.push({ rowNumber: i + 2, label, status: "success" });
 } catch (e: any) {
 rowResults.push({ rowNumber: i + 2, label, status: "error", message: e?.message || "Failed" });
 }
 }
 setResults(rowResults);
 onComplete?.();
 } catch (e: any) {
 Alert.alert("Upload Failed", e?.message || "Could not read or process the file.");
 } finally {
 setUploading(false);
 }
 };

 const successCount = results?.filter((r) => r.status === "success").length ?? 0;
 const errorCount = results?.filter((r) => r.status === "error").length ?? 0;

 return (
 <View className="bg-surface-container-lowest p-5 rounded-3xl border border-outline-variant shadow-sm mb-6">
 <View className="flex-row items-center mb-1" style={{ gap: 8 }}>
 <MaterialCommunityIcons name="tray-arrow-up" size={20} color={theme.colors.primary} />
 <Text className="text-lg font-bold text-on-surface ">
 Bulk Import {entityLabel}
 </Text>
 </View>
 <Text className="text-sm text-on-surface-variant mb-4">
 Download a CSV template, fill it in with your data, then upload it back to create many {entityLabel.toLowerCase()} at once.
 </Text>

 <View className="flex-row" style={{ gap: 10 }}>
 <Pressable
 onPress={handleDownloadTemplate}
 disabled={downloading}
 className="flex-1 border border-primary py-3.5 rounded-2xl items-center flex-row justify-center"
 style={{ gap: 6 }}
 >
 {downloading ? (
 <ActivityIndicator color={theme.colors.primary} size="small" />
 ) : (
 <>
 <MaterialCommunityIcons name="download-outline" size={16} color={theme.colors.primary} />
 <Text className="text-primary font-bold text-sm">Download Template</Text>
 </>
 )}
 </Pressable>
 <Pressable
 onPress={handleUpload}
 disabled={uploading}
 className="flex-1 bg-primary py-3.5 rounded-2xl items-center flex-row justify-center"
 style={{ gap: 6 }}
 >
 {uploading ? (
 <ActivityIndicator color="white" size="small" />
 ) : (
 <>
 <MaterialCommunityIcons name="upload-outline" size={16} color="white" />
 <Text className="text-white font-bold text-sm">Upload Filled CSV</Text>
 </>
 )}
 </Pressable>
 </View>

 <Modal visible={results !== null} animationType="slide" transparent>
 <View className="flex-1 justify-end bg-black/40">
 <View className="bg-background rounded-t-3xl px-6 pt-6" style={{ maxHeight: "80%" }}>
 <View className="flex-row justify-between items-center mb-4">
 <Text className="text-xl font-bold text-on-surface ">
 Import Results
 </Text>
 <Pressable onPress={() => setResults(null)} className="w-10 h-10 items-center justify-center">
 <MaterialCommunityIcons name="close" size={20} color={theme.colors.onSurfaceVariant} />
 </Pressable>
 </View>
 <View className="flex-row mb-4" style={{ gap: 10 }}>
 <View className="flex-1 bg-success/10 p-3 rounded-2xl items-center">
 <Text className="text-2xl font-black text-success">{successCount}</Text>
 <Text className="text-xs font-bold text-success uppercase">Imported</Text>
 </View>
 <View className="flex-1 bg-error/10 p-3 rounded-2xl items-center">
 <Text className="text-2xl font-black text-error">{errorCount}</Text>
 <Text className="text-xs font-bold text-error uppercase">Failed</Text>
 </View>
 </View>
 <ScrollView style={{ marginBottom: 24 }} showsVerticalScrollIndicator={false}>
 {results?.map((r) => (
 <View key={r.rowNumber} className="flex-row items-center py-2.5 border-b border-outline-variant ">
 <MaterialCommunityIcons
 name={r.status === "success" ? "check-circle" : "close-circle"}
 size={18}
 color={r.status === "success" ? "#2E9E5B" : theme.colors.error}
 style={{ marginRight: 10 }}
 />
 <View className="flex-1">
 <Text className="text-sm font-bold text-on-surface " numberOfLines={1}>
 Row {r.rowNumber}: {r.label}
 </Text>
 {r.message && <Text className="text-xs text-error mt-0.5">{r.message}</Text>}
 </View>
 </View>
 ))}
 </ScrollView>
 </View>
 </View>
 </Modal>
 </View>
 );
}
