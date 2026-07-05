import { buildUpiQrSvg } from "./upiQr";

export interface ReceiptItem {
  name: string;
  quantity: number;
  price: number;
  total: number;
}

export interface ReceiptData {
  storeName: string;
  storeAddress?: string;
  storePhone?: string;
  gstNumber?: string;
  upiId?: string;
  invoiceNumber: string;
  date: string;
  invoiceType: "gst" | "retail" | "estimate";
  items: ReceiptItem[];
  subtotal: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
}

// expo-print's printAsync/printToFileAsync default to a full Letter/A4 page
// (the body's `width: 58mm` CSS only limits content width *inside* that big
// page, leaving a mostly-blank sheet) — the actual PDF/print page size has to
// be set explicitly via the `width`/`height` options, in points (1mm ≈
// 2.8346pt). Height is estimated from item count since a thermal roll is
// continuous-feed, not a fixed page.
const MM_TO_PT = 2.8346;
export const THERMAL_PAGE_WIDTH_PT = Math.round(58 * MM_TO_PT);

export function estimateThermalPageHeightPt(itemCount: number, hasUpiQr: boolean = false): number {
  const headerFooterPt = 220;
  const perItemPt = 34;
  const qrPt = hasUpiQr ? 150 : 0;
  return Math.round(headerFooterPt + itemCount * perItemPt + qrPt);
}

export function generateReceiptHtml(data: ReceiptData): string {
  // Effective rate shown is derived from the real computed amounts (not a fixed
  // assumption) — accurate for a single-tax-rate cart, an approximation for a
  // mixed-rate cart, but never fabricated the way a hardcoded 9%/9% would be.
  const pct = (amount: number) =>
    data.subtotal > 0 ? ((amount / data.subtotal) * 100).toFixed(1) : "0.0";

  const itemsHtml = data.items
    .map(
      (item) => `
      <div style="margin-bottom: 6px;">
        <div style="font-weight: bold;">${item.name}</div>
        <div style="display: flex; justify-content: space-between; font-size: 11px;">
          <span>${item.quantity.toFixed(0)} x ₹${item.price.toFixed(2)}</span>
          <span>₹${item.total.toFixed(2)}</span>
        </div>
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
            size: 58mm auto;
            margin: 0;
          }
          body {
            width: 58mm;
            margin: 0;
            padding: 2mm;
            font-family: 'Courier New', Courier, monospace;
            font-size: 12px;
            color: #000;
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
          <div class="store-title">${data.storeName}</div>
          ${data.storeAddress ? `<div style="font-size: 10px;">${data.storeAddress}</div>` : ""}
          ${data.storePhone ? `<div style="font-size: 10px;">Phone: ${data.storePhone}</div>` : ""}
          ${data.invoiceType === "gst" && data.gstNumber ? `<div style="font-size: 10px; font-weight: bold; margin-top: 2px;">GSTIN: ${data.gstNumber}</div>` : ""}
          <div style="font-size: 12px; font-weight: bold; margin-top: 4px; border: 1px solid #000; padding: 2px; display: inline-block;">
            ${data.invoiceType === "gst" ? "TAX INVOICE" : data.invoiceType === "retail" ? "RETAIL BILL" : "ESTIMATE / QUOTATION"}
          </div>
        </div>

        <div class="divider"></div>

        <!-- Invoice Details -->
        <div class="invoice-details">
          <div>Bill No: ${data.invoiceNumber}</div>
          <div>Date: ${data.date}</div>
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
        <div class="totals-row">
          <span>Subtotal:</span>
          <span>₹${data.subtotal.toFixed(2)}</span>
        </div>

        ${
          data.invoiceType === "gst"
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

        <div class="divider"></div>

        <div class="totals-row grand-total">
          <span>GRAND TOTAL:</span>
          <span>₹${data.total.toFixed(2)}</span>
        </div>

        <div class="divider"></div>

        ${
          data.upiId
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
          <div>Thank you for your business!</div>
          <div style="margin-top: 3px; font-style: italic;">Powered by Shopkeeper ERP</div>
        </div>
      </body>
    </html>
  `;
}
