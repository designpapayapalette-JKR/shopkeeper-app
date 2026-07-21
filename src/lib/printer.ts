import { buildUpiQrSvg } from "./upiQr";

export interface ReceiptItem {
 name: string;
 quantity: number;
 price: number;
 total: number;
 serialNumbers?: string;
}

export type ThermalPaperWidth = "58" | "80";

export interface ReceiptData {
 storeName: string;
 storeAddress?: string;
 storePhone?: string;
 gstNumber?: string;
 upiId?: string;
 invoiceNumber: string;
 date: string;
 invoiceType: "gst" | "retail" | "estimate" | "bill_of_supply";
 items: ReceiptItem[];
 subtotal: number;
 cgst: number;
 sgst: number;
 igst: number;
 total: number;
 // Which roll width this receipt is laid out for — defaults to 58mm to
 // match the printer most shops already have, but a shop with an 80mm
 // printer (set in Printer Settings) gets a correctly-sized receipt
 // instead of a 58mm-wide layout stretched or clipped onto their paper.
 paperWidth?: ThermalPaperWidth;
 // Shown so it's unambiguous on the printed slip how the customer is
 // expected to pay — especially important on an estimate, where no money
 // has actually changed hands yet.
 paymentMode?: "cash" | "upi" | "credit";
 // A surcharge on top of the total (e.g. a credit/commission charge) —
 // shown as its own line so it isn't mistaken for a pricing error.
 extraCharge?: number;
 extraChargeLabel?: string;
}

// expo-print's printAsync/printToFileAsync default to a full Letter/A4 page
// (the body's `width` CSS only limits content width *inside* that big page,
// leaving a mostly-blank sheet) — the actual PDF/print page size has to be
// set explicitly via the `width`/`height` options, in points (1mm ≈
// 2.8346pt). Height is estimated from item count since a thermal roll is
// continuous-feed, not a fixed page.
const MM_TO_PT = 2.8346;
export function thermalPageWidthPt(paperWidth: ThermalPaperWidth = "58"): number {
 return Math.round(parseInt(paperWidth, 10) * MM_TO_PT);
}
// Kept for existing call sites that only ever printed at 58mm.
export const THERMAL_PAGE_WIDTH_PT = thermalPageWidthPt("58");

export function estimateThermalPageHeightPt(itemCount: number, hasUpiQr: boolean = false): number {
 const headerFooterPt = 220;
 const perItemPt = 34;
 const qrPt = hasUpiQr ? 150 : 0;
 return Math.round(headerFooterPt + itemCount * perItemPt + qrPt);
}

// Template config for customizing what shows on the receipt.
// Every field is optional — omitted fields fall back to hardcoded defaults
// so existing call sites (which pass no config) keep working unchanged.
export interface TemplateConfig {
 primaryColor?: string;
 accentColor?: string;
 showCompanyLogo?: boolean;
 showCompanyName?: boolean;
 showCompanyGstin?: boolean;
 showCompanyPhone?: boolean;
 showCompanyAddress?: boolean;
 showBankDetails?: boolean;
 showUpiQr?: boolean;
 showCustomerName?: boolean;
 showCustomerGstin?: boolean;
 showCustomerPhone?: boolean;
 showCustomerAddress?: boolean;
 showInvoiceNumber?: boolean;
 showDate?: boolean;
 showDueDate?: boolean;
 showPaymentMode?: boolean;
 showHsnCode?: boolean;
 showItemDiscount?: boolean;
 showSubtotal?: boolean;
 showTaxBreakup?: boolean;
 roundAmount?: boolean;
 footerText?: string;
 showSignature?: boolean;
 paperSize?: "58mm" | "80mm" | "A4";
 showItemSno?: boolean;
 showItemMrp?: boolean;
}

export function generateReceiptHtml(data: ReceiptData, template?: TemplateConfig): string {
 // Effective rate shown is derived from the real computed amounts (not a fixed
 // assumption) — accurate for a single-tax-rate cart, an approximation for a
 // mixed-rate cart, but never fabricated the way a hardcoded 9%/9% would be.
 const pct = (amount: number) =>
 data.subtotal > 0 ? ((amount / data.subtotal) * 100).toFixed(1) : "0.0";
 const hasTax = data.cgst > 0 || data.sgst > 0 || data.igst > 0;
 const paymentModeLabel = data.paymentMode
 ? { cash: "CASH", upi: "UPI", credit: "CREDIT" }[data.paymentMode]
 : null;

 const cfg = (k: keyof TemplateConfig): boolean | string | undefined => template?.[k];

 // Paper width: config overrides data
 const paperSizeCfg = cfg("paperSize");
 const widthMm = paperSizeCfg && paperSizeCfg !== "A4"
 ? String(paperSizeCfg).replace("mm", "")
 : data.paperWidth ?? "58";

 // CSS color overrides from config
 const primaryColor = (cfg("primaryColor") as string) || "#000";
 const accentColor = (cfg("accentColor") as string) || "#0368FE";

 const itemsHtml = data.items
 .map(
 (item) => `
 <div style="margin-bottom: 6px;">
 <div style="font-weight: bold;">${item.name}</div>
 <div style="display: flex; justify-content: space-between; font-size: 11px;">
 <span>${item.quantity.toFixed(0)} x ₹${item.price.toFixed(2)}</span>
 <span>₹${item.total.toFixed(2)}</span>
 </div>
 ${item.serialNumbers ? `<div style="font-size: 9px; color: #666;">S/N: ${item.serialNumbers}</div>` : ""}
 </div>
 `
 )
 .join("");

 return `
 <!DOCTYPE html>
 <html>
 <head>
 <meta charset="utf-8">
 <style>
 @page {
 size: ${widthMm}mm auto;
 margin: 0;
 }
 body {
 width: ${widthMm}mm;
 margin: 0;
 padding: 2mm;
 font-family: 'Courier New', Courier, monospace;
 font-size: 12px;
 color: ${primaryColor};
 line-height: 1.3;
 }
 .text-center {
 text-align: center;
 }
 .text-right {
 text-align: right;
 }
 .divider {
 border-top: 1px dashed #000;
 margin: 8px 0;
 }
 .header {
 margin-bottom: 8px;
 }
 .store-title {
 font-size: 16px;
 font-weight: bold;
 margin-bottom: 2px;
 }
 .invoice-details {
 font-size: 11px;
 margin-bottom: 8px;
 }
 .totals-row {
 display: flex;
 justify-content: space-between;
 margin-bottom: 2px;
 font-size: 11px;
 }
 .grand-total {
 font-size: 13px;
 font-weight: bold;
 }
 .footer {
 margin-top: 15px;
 font-size: 10px;
 }
 </style>
 </head>
 <body>
 <!-- Header -->
 <div class="header text-center">
 ${cfg("showCompanyName") !== false ? `<div class="store-title">${data.storeName}</div>` : ""}
 ${cfg("showCompanyAddress") !== false && data.storeAddress ? `<div style="font-size: 10px;">${data.storeAddress}</div>` : ""}
 ${cfg("showCompanyPhone") !== false && data.storePhone ? `<div style="font-size: 10px;">Phone: ${data.storePhone}</div>` : ""}
 ${cfg("showCompanyGstin") !== false && (data.invoiceType === "gst" || hasTax) && data.gstNumber ? `<div style="font-size: 10px; font-weight: bold; margin-top: 2px;">GSTIN: ${data.gstNumber}</div>` : ""}
 <div style="font-size: 12px; font-weight: bold; margin-top: 4px; border: 1px solid ${accentColor}; padding: 2px; display: inline-block; color: ${accentColor};">
 ${
 data.invoiceType === "gst"
 ? "TAX INVOICE"
 : data.invoiceType === "retail"
 ? "RETAIL BILL"
 : data.invoiceType === "bill_of_supply"
 ? "BILL OF SUPPLY"
 : hasTax
 ? "GST ESTIMATE / QUOTATION"
 : "ESTIMATE / QUOTATION"
 }
 </div>
 </div>

 <div class="divider"></div>

 <!-- Invoice Details -->
 <div class="invoice-details">
 ${cfg("showInvoiceNumber") !== false ? `<div>Bill No: ${data.invoiceNumber}</div>` : ""}
 ${cfg("showDate") !== false ? `<div>Date: ${data.date}</div>` : ""}
 ${cfg("showPaymentMode") !== false && paymentModeLabel ? `<div>Payment: ${paymentModeLabel}</div>` : ""}
 </div>

 <div class="divider"></div>

 <!-- Item Headings -->
 <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 11px; margin-bottom: 4px;">
 <span>Item / Description</span>
 <span>Amount</span>
 </div>

 <!-- Items list -->
 <div style="margin-bottom: 8px;">
 ${itemsHtml}
 </div>

 <div class="divider"></div>

 <!-- Totals -->
 ${cfg("showSubtotal") !== false ? `
 <div class="totals-row">
 <span>Subtotal:</span>
 <span>₹${data.subtotal.toFixed(2)}</span>
 </div>
 ` : ""}

 ${
 cfg("showTaxBreakup") !== false && hasTax
 ? data.igst > 0
 ? `
 <div class="totals-row">
 <span>IGST (${pct(data.igst)}%):</span>
 <span>₹${data.igst.toFixed(2)}</span>
 </div>
 `
 : `
 <div class="totals-row">
 <span>CGST (${pct(data.cgst)}%):</span>
 <span>₹${data.cgst.toFixed(2)}</span>
 </div>
 <div class="totals-row">
 <span>SGST (${pct(data.sgst)}%):</span>
 <span>₹${data.sgst.toFixed(2)}</span>
 </div>
 `
 : ""
 }

 ${
 data.extraCharge && data.extraCharge > 0
 ? `
 <div class="totals-row">
 <span>${data.extraChargeLabel || "Extra Charge"}:</span>
 <span>₹${data.extraCharge.toFixed(2)}</span>
 </div>
 `
 : ""
 }

 <div class="divider"></div>

 <div class="totals-row grand-total">
 <span>GRAND TOTAL:</span>
 <span>₹${data.total.toFixed(2)}</span>
 </div>

 <div class="divider"></div>

 ${
 cfg("showUpiQr") !== false && data.upiId
 ? `
 <div class="text-center" style="margin: 8px 0;">
 <div style="font-size: 10px; font-weight: bold; margin-bottom: 4px;">Scan to Pay via UPI</div>
 ${buildUpiQrSvg(data.upiId, data.storeName, data.total, 110)}
 </div>
 <div class="divider"></div>
 `
 : ""
 }

 <!-- Footer -->
 <div class="footer text-center">
 <div>${(cfg("footerText") as string) || "Thank you for your business!"}</div>
 <div style="margin-top: 3px; font-style: italic;">Powered by MMC Shop</div>
 </div>

 ${cfg("showSignature") !== false ? `
 <div class="divider"></div>
 <div style="display: flex; justify-content: flex-end; margin-top: 20px; font-size: 10px;">
 <div style="text-align: center;">
 <div style="border-top: 1px solid #000; width: 120px; padding-top: 4px;">Authorised Signatory</div>
 </div>
 </div>
 ` : ""}
 </body>
 </html>
 `;
}
