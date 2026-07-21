import { File, Directory, Paths } from "expo-file-system";

// Every photo captured through the Dashboard's Scan Hub (purchase bills,
// product photos, expense receipts) is saved here permanently, alongside a
// small JSON index for metadata — this is what backs the "Scanned
// Documents" screen so a capture is never a one-shot, throwaway action.
export type ScanCategory = "purchase" | "product" | "expense" | "transfer";

export interface ScanRecord {
 id: string;
 category: ScanCategory;
 uri: string;
 createdAt: string;
 label?: string;
}

const SCANS_DIR_NAME = "scanned-documents";
const INDEX_FILE_NAME = "index.json";

function getScansDir(): Directory {
 const dir = new Directory(Paths.document, SCANS_DIR_NAME);
 if (!dir.exists) dir.create();
 return dir;
}

function getIndexFile(): File {
 return new File(getScansDir(), INDEX_FILE_NAME);
}

async function readIndex(): Promise<ScanRecord[]> {
 const file = getIndexFile();
 if (!file.exists) return [];
 try {
 return JSON.parse(await file.text()) as ScanRecord[];
 } catch {
 return [];
 }
}

async function writeIndex(records: ScanRecord[]): Promise<void> {
 const file = getIndexFile();
 if (!file.exists) file.create();
 await file.write(JSON.stringify(records));
}

// Copies the just-captured photo into permanent local storage and records
// it in the index. Returns the permanent file URI to hand off to whatever
// form (Record Purchase, Add Product, Record Expense) is using it next.
export async function saveScan(sourceUri: string, category: ScanCategory, label?: string): Promise<ScanRecord> {
 const dir = getScansDir();
 const dest = new File(dir, `${category}-${Date.now()}.jpg`);
 const src = new File(sourceUri);
 await src.copy(dest);

 const record: ScanRecord = {
 id: dest.name,
 category,
 uri: dest.uri,
 createdAt: new Date().toISOString(),
 label,
 };
 const records = await readIndex();
 records.unshift(record);
 await writeIndex(records);
 return record;
}

export async function listScans(category?: ScanCategory): Promise<ScanRecord[]> {
 const records = await readIndex();
 return category ? records.filter((r) => r.category === category) : records;
}

export async function deleteScan(id: string): Promise<void> {
 const records = await readIndex();
 const record = records.find((r) => r.id === id);
 if (record) {
 try {
 new File(record.uri).delete();
 } catch {
 // File already gone — still remove it from the index below.
 }
 }
 await writeIndex(records.filter((r) => r.id !== id));
}
