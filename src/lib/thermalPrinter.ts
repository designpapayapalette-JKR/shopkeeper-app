import * as SecureStore from "expo-secure-store";
import {
 BLEPrinter,
 USBPrinter,
 NetPrinter,
 COMMANDS,
 IBLEPrinter,
 IUSBPrinter,
 INetPrinter,
} from "react-native-thermal-receipt-printer-image-qr";
import type { ReceiptData } from "./printer";

const STORAGE_KEY = "shopkeeper_saved_printers";

export type PrinterConnectionType = "bluetooth" | "usb" | "wifi";
export type PaperWidth = "58" | "80";

export interface SavedPrinter {
 id: string;
 type: PrinterConnectionType;
 name: string;
 // bluetooth: inner_mac_address; usb: "vendorId:productId"; wifi: "host:port"
 address: string;
 paperWidth: PaperWidth;
 isDefault: boolean;
}

// A shop can have more than one printer (counter + godown, or a spare) and
// they aren't always the same roll width, so this is a proper list instead
// of a single saved printer — one is marked default for one-tap printing,
// but any of them can be picked explicitly per print job.
async function readPrinters(): Promise<SavedPrinter[]> {
 const raw = await SecureStore.getItemAsync(STORAGE_KEY);
 if (!raw) return [];
 try {
 return JSON.parse(raw) as SavedPrinter[];
 } catch {
 return [];
 }
}

async function writePrinters(printers: SavedPrinter[]): Promise<void> {
 await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(printers));
}

export async function getSavedPrinters(): Promise<SavedPrinter[]> {
 return readPrinters();
}

export async function getDefaultPrinter(): Promise<SavedPrinter | null> {
 const printers = await readPrinters();
 return printers.find((p) => p.isDefault) ?? printers[0] ?? null;
}

// Kept for existing call sites that only ever needed "the" printer — now
// resolves to the default one from the list.
export async function getSavedPrinter(): Promise<SavedPrinter | null> {
 return getDefaultPrinter();
}

export async function addPrinter(printer: Omit<SavedPrinter, "id">): Promise<SavedPrinter> {
 const printers = await readPrinters();
 const newPrinter: SavedPrinter = { ...printer, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` };
 // First printer added is automatically the default; otherwise respect the
 // caller's isDefault flag and demote any previous default.
 if (printers.length === 0) newPrinter.isDefault = true;
 const next = newPrinter.isDefault ? printers.map((p) => ({ ...p, isDefault: false })) : printers;
 next.push(newPrinter);
 await writePrinters(next);
 return newPrinter;
}

export async function removePrinter(id: string): Promise<void> {
 const printers = await readPrinters();
 const removed = printers.find((p) => p.id === id);
 const remaining = printers.filter((p) => p.id !== id);
 // If the removed printer was the default, promote the next one so there's
 // still a one-tap default whenever at least one printer is saved.
 if (removed?.isDefault && remaining.length > 0) remaining[0].isDefault = true;
 await writePrinters(remaining);
}

export async function setDefaultPrinter(id: string): Promise<void> {
 const printers = await readPrinters();
 await writePrinters(printers.map((p) => ({ ...p, isDefault: p.id === id })));
}

export async function scanBluetoothPrinters(): Promise<IBLEPrinter[]> {
 await BLEPrinter.init();
 return BLEPrinter.getDeviceList();
}

export async function scanUsbPrinters(): Promise<IUSBPrinter[]> {
 await USBPrinter.init();
 return USBPrinter.getDeviceList();
}

// Connects to the given printer and leaves it as the active connection for
// the current app session — the underlying library keeps one live socket per
// transport type, there is no persistent "handle" to store across restarts,
// so every print job first reconnects using the saved address.
export async function connectToPrinter(printer: SavedPrinter): Promise<void> {
 if (printer.type === "bluetooth") {
 await BLEPrinter.init();
 await BLEPrinter.connectPrinter(printer.address);
 } else if (printer.type === "usb") {
 const [vendorId, productId] = printer.address.split(":");
 await USBPrinter.init();
 await USBPrinter.connectPrinter(vendorId, productId);
 } else {
 const [host, portStr] = printer.address.split(":");
 await NetPrinter.init();
 await NetPrinter.connectPrinter(host, parseInt(portStr, 10) || 9100);
 }
}

function activeDriver(type: PrinterConnectionType) {
 if (type === "bluetooth") return BLEPrinter;
 if (type === "usb") return USBPrinter;
 return NetPrinter;
}

// Builds a plain ESC/POS text bill from the same ReceiptData shape used by
// the thermal HTML receipt (printer.ts) and the checkout/invoice-history
// screens — one data shape, three output paths (HTML print dialog, PDF
// share, and now a direct raw print to a paired printer). Line widths and
// the horizontal-rule command both depend on the physical roll width —
// padding tuned for a 58mm printer looks broken (columns misaligned) on an
// 80mm one and vice versa.
function buildEscPosBill(data: ReceiptData, paperWidth: PaperWidth): string {
 const ALIGN_CT = COMMANDS.TEXT_FORMAT.TXT_ALIGN_CT;
 const ALIGN_LT = COMMANDS.TEXT_FORMAT.TXT_ALIGN_LT;
 const BOLD_ON = COMMANDS.TEXT_FORMAT.TXT_BOLD_ON;
 const BOLD_OFF = COMMANDS.TEXT_FORMAT.TXT_BOLD_OFF;
 const HR = paperWidth === "80" ? COMMANDS.HORIZONTAL_LINE.HR3_80MM : COMMANDS.HORIZONTAL_LINE.HR3_58MM;
 // Standard font is ~32 chars/line at 58mm, ~48 chars/line at 80mm.
 const colWidth = paperWidth === "80" ? 32 : 20;

 const hasTax = data.cgst > 0 || data.sgst > 0 || data.igst > 0;
 const paymentModeLabel = data.paymentMode ? { cash: "CASH", upi: "UPI", credit: "CREDIT" }[data.paymentMode] : null;

 const lines: string[] = [];
 lines.push(`${ALIGN_CT}${BOLD_ON}${data.storeName}${BOLD_OFF}\n`);
 if (data.storeAddress) lines.push(`${data.storeAddress}\n`);
 if (data.storePhone) lines.push(`Phone: ${data.storePhone}\n`);
 if ((data.invoiceType === "gst" || hasTax) && data.gstNumber) lines.push(`GSTIN: ${data.gstNumber}\n`);
 lines.push(
 `${
 data.invoiceType === "gst"
 ? "TAX INVOICE"
 : data.invoiceType === "retail"
 ? "RETAIL BILL"
 : hasTax
 ? "GST ESTIMATE"
 : "ESTIMATE"
 }\n`
 );
 lines.push(`${HR}\n`);
 lines.push(`${ALIGN_LT}Bill No: ${data.invoiceNumber}\n`);
 lines.push(`Date: ${data.date}\n`);
 if (paymentModeLabel) lines.push(`Payment: ${paymentModeLabel}\n`);
 lines.push(`${HR}\n`);

 for (const item of data.items) {
 lines.push(`${item.name}\n`);
 lines.push(` ${item.quantity.toFixed(0)} x Rs.${item.price.toFixed(2)}`.padEnd(colWidth + 4) + `Rs.${item.total.toFixed(2)}\n`);
 }

 lines.push(`${HR}\n`);
 lines.push(`Subtotal:`.padEnd(colWidth) + `Rs.${data.subtotal.toFixed(2)}\n`);
 if (hasTax) {
 if (data.igst > 0) {
 lines.push(`IGST:`.padEnd(colWidth) + `Rs.${data.igst.toFixed(2)}\n`);
 } else {
 lines.push(`CGST:`.padEnd(colWidth) + `Rs.${data.cgst.toFixed(2)}\n`);
 lines.push(`SGST:`.padEnd(colWidth) + `Rs.${data.sgst.toFixed(2)}\n`);
 }
 }
 if (data.extraCharge && data.extraCharge > 0) {
 lines.push(`${data.extraChargeLabel || "Extra Charge"}:`.padEnd(colWidth) + `Rs.${data.extraCharge.toFixed(2)}\n`);
 }
 lines.push(`${HR}\n`);
 lines.push(`${BOLD_ON}GRAND TOTAL:`.padEnd(colWidth) + `Rs.${data.total.toFixed(2)}${BOLD_OFF}\n`);
 lines.push(`${HR}\n`);
 lines.push(`${ALIGN_CT}Thank you for your business!\n`);
 lines.push(`Powered by MMC Shop\n\n\n`);

 return lines.join("");
}

// Reconnects to the given printer (default, if none passed) and sends the
// bill. Callers should treat any rejection as "printer unreachable" and
// fall back to the HTML Print/Share flow — this never assumes the printer
// is already connected, since the app may have been backgrounded or the
// printer may have dropped its Bluetooth/Wi-Fi link since the last job.
export async function printToSavedPrinter(data: ReceiptData, printer?: SavedPrinter): Promise<void> {
 const target = printer ?? (await getDefaultPrinter());
 if (!target) throw new Error("No printer is paired yet. Add one in Printer Settings.");

 await connectToPrinter(target);
 const driver = activeDriver(target.type);
 const bill = buildEscPosBill(data, target.paperWidth);
 driver.printBill(bill);
}

// Sends the ESC/POS cash drawer kick command (pin 2) to the paired printer.
// On cash payment finalise the caller should invoke this to pop the drawer
// open automatically — no action required from the cashier.
export async function openCashDrawer(printer?: SavedPrinter): Promise<void> {
 const target = printer ?? (await getDefaultPrinter());
 if (!target) throw new Error("No printer is paired yet. Add one in Printer Settings.");

 await connectToPrinter(target);
 const driver = activeDriver(target.type);
 // Standard ESC/POS drawer kick: ESC p 0 25 250 (pin 2, 25ms pulse)
 const rawCmd = "\x1B\x70\x00\x19\xFA";
 (driver as any).printRaw(rawCmd);
}
