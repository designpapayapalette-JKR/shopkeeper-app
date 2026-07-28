import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";
import { api } from "./api";

const BACKUP_FILE_NAME = "shopkeeper_user_data_backup.json";

export interface BackupDataPayload {
  version: number;
  timestamp: string;
  products: any[];
  categories: any[];
  brands: any[];
  parties: any[];
  ledgerEntries: any[];
  invoicesMeta: any[];
  stockMovements: any[];
  appSettings: Record<string, any>;
}

export interface BackupStatus {
  exists: boolean;
  timestamp: string | null;
  productCount: number;
  partyCount: number;
  invoiceCount: number;
  fileSizeBytes: number;
}

function getBackupFile(): File {
  return new File(Paths.document, BACKUP_FILE_NAME);
}

/**
  Write structured user data snapshot to device's persistent document directory.
 */
export async function saveLocalBackup(payload: Partial<BackupDataPayload>): Promise<boolean> {
  try {
    const file = getBackupFile();
    const existing = await readLocalBackup();

    const fullPayload: BackupDataPayload = {
      version: 1,
      timestamp: new Date().toISOString(),
      products: payload.products ?? existing?.products ?? [],
      categories: payload.categories ?? existing?.categories ?? [],
      brands: payload.brands ?? existing?.brands ?? [],
      parties: payload.parties ?? existing?.parties ?? [],
      ledgerEntries: payload.ledgerEntries ?? existing?.ledgerEntries ?? [],
      invoicesMeta: payload.invoicesMeta ?? existing?.invoicesMeta ?? [],
      stockMovements: payload.stockMovements ?? existing?.stockMovements ?? [],
      appSettings: payload.appSettings ?? existing?.appSettings ?? {},
    };

    if (file.exists) file.delete();
    file.create();
    file.write(JSON.stringify(fullPayload, null, 2));
    return true;
  } catch (error) {
    console.error("[localBackup] Failed to save local backup:", error);
    return false;
  }
}

/**
  Read local backup snapshot from persistent device storage.
 */
export async function readLocalBackup(): Promise<BackupDataPayload | null> {
  try {
    const file = getBackupFile();
    if (!file.exists) return null;
    const content = await file.text();
    if (!content) return null;
    return JSON.parse(content) as BackupDataPayload;
  } catch (error) {
    console.error("[localBackup] Failed to read local backup:", error);
    return null;
  }
}

/**
  Get quick status summary of local backup.
 */
export async function getBackupStatus(): Promise<BackupStatus> {
  try {
    const file = getBackupFile();
    if (!file.exists) {
      return { exists: false, timestamp: null, productCount: 0, partyCount: 0, invoiceCount: 0, fileSizeBytes: 0 };
    }
    const content = await file.text();
    const data = JSON.parse(content) as BackupDataPayload;
    return {
      exists: true,
      timestamp: data.timestamp ?? null,
      productCount: data.products?.length ?? 0,
      partyCount: data.parties?.length ?? 0,
      invoiceCount: data.invoicesMeta?.length ?? 0,
      fileSizeBytes: content.length,
    };
  } catch {
    return { exists: false, timestamp: null, productCount: 0, partyCount: 0, invoiceCount: 0, fileSizeBytes: 0 };
  }
}

/**
  Fetch full user data from backend API and update persistent local backup snapshot on device.
 */
export async function autoSyncDeviceBackup(): Promise<BackupStatus> {
  try {
    const [productsRes, categoriesRes, brandsRes, partiesRes, invoicesRes] = await Promise.allSettled([
      api.get<any>("/products?limit=1000"),
      api.get<any>("/categories"),
      api.get<any>("/brands"),
      api.get<any>("/parties?limit=1000"),
      api.get<any>("/invoices?limit=1000"),
    ]);

    const extractList = (res: PromiseSettledResult<any>): any[] => {
      if (res.status !== "fulfilled" || !res.value) return [];
      const val = res.value;
      if (Array.isArray(val)) return val;
      if (Array.isArray(val.data)) return val.data;
      return [];
    };

    const products = extractList(productsRes);
    const categories = extractList(categoriesRes);
    const brands = extractList(brandsRes);
    const parties = extractList(partiesRes);
    const invoices = extractList(invoicesRes);

    await saveLocalBackup({
      products,
      categories,
      brands,
      parties,
      invoicesMeta: invoices,
    });
  } catch (err) {
    console.warn("[localBackup] Auto-sync backup encountered partial error:", err);
  }
  return getBackupStatus();
}

/**
  Export backup JSON file to external storage or sharing apps.
 */
export async function exportBackupFile(): Promise<boolean> {
  try {
    const file = getBackupFile();
    if (!file.exists) {
      // Ensure backup exists before export
      await autoSyncDeviceBackup();
    }
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(file.uri, {
        mimeType: "application/json",
        dialogTitle: "Export MMC Local Data Backup",
        UTI: "public.json",
      });
      return true;
    }
    return false;
  } catch (err) {
    console.error("[localBackup] Export failed:", err);
    return false;
  }
}

/**
  Import backup file selected by user and save as device persistent backup.
 */
export async function importBackupFile(): Promise<{ success: boolean; message: string }> {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: "application/json",
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets || result.assets.length === 0) {
      return { success: false, message: "Import cancelled." };
    }
    const pickedFile = new File(result.assets[0].uri);
    const content = await pickedFile.text();
    const parsed = JSON.parse(content) as BackupDataPayload;

    if (!parsed || (typeof parsed !== "object")) {
      return { success: false, message: "Invalid backup file format." };
    }

    const file = getBackupFile();
    if (file.exists) file.delete();
    file.create();
    file.write(JSON.stringify(parsed, null, 2));

    return {
      success: true,
      message: `Backup imported successfully (${parsed.products?.length ?? 0} products, ${parsed.parties?.length ?? 0} parties, ${parsed.invoicesMeta?.length ?? 0} invoices).`,
    };
  } catch (err: unknown) {
    return { success: false, message: "Import failed: " + (err instanceof Error ? err.message : String(err)) };
  }
}
