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

const STORAGE_KEY = "shopkeeper_saved_printer";

export type PrinterConnectionType = "bluetooth" | "usb" | "wifi";

export interface SavedPrinter {
  type: PrinterConnectionType;
  name: string;
  // bluetooth: inner_mac_address; usb: "vendorId:productId"; wifi: "host:port"
  address: string;
}

export async function getSavedPrinter(): Promise<SavedPrinter | null> {
  const raw = await SecureStore.getItemAsync(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SavedPrinter;
  } catch {
    return null;
  }
}

export async function savePrinter(printer: SavedPrinter): Promise<void> {
  await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(printer));
}

export async function clearSavedPrinter(): Promise<void> {
  await SecureStore.deleteItemAsync(STORAGE_KEY);
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
// share, and now a direct raw print to a paired printer).
function buildEscPosBill(data: ReceiptData): string {
  const ALIGN_CT = COMMANDS.TEXT_FORMAT.TXT_ALIGN_CT;
  const ALIGN_LT = COMMANDS.TEXT_FORMAT.TXT_ALIGN_LT;
  const BOLD_ON = COMMANDS.TEXT_FORMAT.TXT_BOLD_ON;
  const BOLD_OFF = COMMANDS.TEXT_FORMAT.TXT_BOLD_OFF;
  const HR = COMMANDS.HORIZONTAL_LINE.HR3_58MM;

  const lines: string[] = [];
  lines.push(`${ALIGN_CT}${BOLD_ON}${data.storeName}${BOLD_OFF}\n`);
  if (data.storeAddress) lines.push(`${data.storeAddress}\n`);
  if (data.storePhone) lines.push(`Phone: ${data.storePhone}\n`);
  if (data.invoiceType === "gst" && data.gstNumber) lines.push(`GSTIN: ${data.gstNumber}\n`);
  lines.push(
    `${data.invoiceType === "gst" ? "TAX INVOICE" : data.invoiceType === "retail" ? "RETAIL BILL" : "ESTIMATE"}\n`
  );
  lines.push(`${HR}\n`);
  lines.push(`${ALIGN_LT}Bill No: ${data.invoiceNumber}\n`);
  lines.push(`Date: ${data.date}\n`);
  lines.push(`${HR}\n`);

  for (const item of data.items) {
    lines.push(`${item.name}\n`);
    lines.push(`  ${item.quantity.toFixed(0)} x Rs.${item.price.toFixed(2)}`.padEnd(24) + `Rs.${item.total.toFixed(2)}\n`);
  }

  lines.push(`${HR}\n`);
  lines.push(`Subtotal:`.padEnd(20) + `Rs.${data.subtotal.toFixed(2)}\n`);
  if (data.invoiceType === "gst") {
    if (data.igst > 0) {
      lines.push(`IGST:`.padEnd(20) + `Rs.${data.igst.toFixed(2)}\n`);
    } else {
      lines.push(`CGST:`.padEnd(20) + `Rs.${data.cgst.toFixed(2)}\n`);
      lines.push(`SGST:`.padEnd(20) + `Rs.${data.sgst.toFixed(2)}\n`);
    }
  }
  lines.push(`${HR}\n`);
  lines.push(`${BOLD_ON}GRAND TOTAL:`.padEnd(20) + `Rs.${data.total.toFixed(2)}${BOLD_OFF}\n`);
  lines.push(`${HR}\n`);
  lines.push(`${ALIGN_CT}Thank you for your business!\n`);
  lines.push(`Powered by Shopkeeper ERP\n\n\n`);

  return lines.join("");
}

// Reconnects to the saved printer and sends the bill. Callers should treat
// any rejection as "printer unreachable" and fall back to the HTML
// Print/Share flow — this never assumes the printer is already connected,
// since the app may have been backgrounded or the printer may have dropped
// its Bluetooth/Wi-Fi link since the last print job.
export async function printToSavedPrinter(data: ReceiptData): Promise<void> {
  const saved = await getSavedPrinter();
  if (!saved) throw new Error("No printer is paired yet. Add one in Printer Settings.");

  await connectToPrinter(saved);
  const driver = activeDriver(saved.type);
  const bill = buildEscPosBill(data);
  driver.printBill(bill);
}
