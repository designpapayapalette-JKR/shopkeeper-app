// Formal, full-page ("Tally style") GST tax invoice — an A4 layout with
// seller/buyer GSTIN, an HSN-wise item table, CGST/SGST/IGST breakup, an
// amount-in-words line, bank details, and a signature block. This is the
// sibling of printer.ts's generateReceiptHtml (58mm thermal layout); both
// consume data assembled at checkout time in pos.tsx and are offered to the
// user as an explicit format choice, since the ask was "one Tally-style, one
// thermal" rather than replacing either.

import { buildUpiQrSvg } from "./upiQr";
import { TemplateConfig } from "./printer";

export interface TallyInvoiceItem {
 name: string;
 hsnCode?: string;
 quantity: number;
 price: number;
 taxRate: number;
 taxAmount: number;
 total: number;
 serialNumbers?: string;
}

export interface TallyInvoiceData {
 company: {
 name: string;
 address?: string;
 phone?: string;
 gstin?: string;
 state?: string;
 bankName?: string;
 bankAccountNumber?: string;
 bankIfsc?: string;
 upiId?: string;
 };
 party: {
 name: string;
 phone?: string;
 gstin?: string;
 state?: string;
 category: "b2b" | "b2c";
 };
 invoiceNumber: string;
 date: string;
 invoiceType: "gst" | "retail" | "estimate" | "bill_of_supply";
 items: TallyInvoiceItem[];
 subtotal: number;
 discountTotal: number;
 cgst: number;
 sgst: number;
 igst: number;
 total: number;
 paymentMode?: "cash" | "upi" | "credit";
 extraCharge?: number;
 extraChargeLabel?: string;
}

const ONES = [
 "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
 "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
 "Seventeen", "Eighteen", "Nineteen",
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function threeDigitsToWords(n: number): string {
 let out = "";
 if (n >= 100) {
 out += `${ONES[Math.floor(n / 100)]} Hundred `;
 n %= 100;
 }
 if (n >= 20) {
 out += `${TENS[Math.floor(n / 10)]} `;
 n %= 10;
 }
 if (n > 0) out += `${ONES[n]} `;
 return out.trim();
}

// Indian numbering (lakh/crore), not the international thousand/million
// grouping — matches how amounts are conventionally written on Indian
// invoices and how an accountant expects to read them.
function numberToIndianWords(amount: number): string {
 const rupees = Math.floor(amount);
 const paise = Math.round((amount - rupees) * 100);

 if (rupees === 0 && paise === 0) return "Zero Rupees Only";

 let n = rupees;
 const parts: string[] = [];
 const crore = Math.floor(n / 10000000);
 n %= 10000000;
 const lakh = Math.floor(n / 100000);
 n %= 100000;
 const thousand = Math.floor(n / 1000);
 n %= 1000;
 const hundred = n;

 if (crore > 0) parts.push(`${threeDigitsToWords(crore)} Crore`);
 if (lakh > 0) parts.push(`${threeDigitsToWords(lakh)} Lakh`);
 if (thousand > 0) parts.push(`${threeDigitsToWords(thousand)} Thousand`);
 if (hundred > 0) parts.push(threeDigitsToWords(hundred));

 let words = parts.length ? `${parts.join(" ")} Rupees` : "Zero Rupees";
 if (paise > 0) words += ` and ${threeDigitsToWords(paise)} Paise`;
 return `${words} Only`;
}

export function generateTallyInvoiceHtml(data: TallyInvoiceData, template?: TemplateConfig): string {
 const cfg = (k: keyof TemplateConfig): boolean | string | undefined => template?.[k];
 const primaryColor = (cfg("primaryColor") as string) || "#111";
 const accentColor = (cfg("accentColor") as string) || "#0368FE";

 const isGst = data.invoiceType === "gst";
 const isInterstate = data.igst > 0;

 const rows = data.items
 .map(
 (item, idx) => `
 <tr>
 ${cfg("showItemSno") !== false ? `<td class="cell center">${idx + 1}</td>` : ""}
 <td class="cell">${item.name}${item.serialNumbers ? `<div style="font-size: 9px; color: #666;">S/N: ${item.serialNumbers}</div>` : ""}</td>
 ${cfg("showHsnCode") !== false ? `<td class="cell center">${item.hsnCode || "-"}</td>` : ""}
 <td class="cell center">${item.quantity.toFixed(2)}</td>
 <td class="cell right">₹${item.price.toFixed(2)}</td>
 ${isGst ? `<td class="cell center">${item.taxRate.toFixed(1)}%</td><td class="cell right">₹${item.taxAmount.toFixed(2)}</td>` : ""}
 <td class="cell right">₹${item.total.toFixed(2)}</td>
 </tr>
 `
 )
 .join("");

 return `
 <!DOCTYPE html>
 <html>
 <head>
 <meta charset="utf-8" />
 <style>
 @page { size: A4; margin: 12mm; }
 body {
 font-family: Arial, Helvetica, sans-serif;
 font-size: 12px;
 color: ${primaryColor};
 margin: 0;
 }
 .invoice-box {
 border: 1px solid #000;
 }
 .title-bar {
 text-align: center;
 font-size: 16px;
 font-weight: bold;
 padding: 8px;
 border-bottom: 1px solid #000;
 text-transform: uppercase;
 letter-spacing: 1px;
 color: ${accentColor};
 }
 .header {
 display: flex;
 justify-content: space-between;
 padding: 10px 12px;
 border-bottom: 1px solid #000;
 }
 .header .col { width: 48%; }
 .company-name { font-size: 16px; font-weight: bold; margin-bottom: 4px; }
 .meta-row { display: flex; justify-content: space-between; padding: 6px 12px; border-bottom: 1px solid #000; font-size: 11px; }
 .party-block { padding: 10px 12px; border-bottom: 1px solid #000; }
 .party-block .label { font-weight: bold; text-transform: uppercase; font-size: 10px; color: #444; margin-bottom: 3px; }
 table { width: 100%; border-collapse: collapse; }
 th, .cell { border: 1px solid #000; padding: 5px 6px; font-size: 11px; }
 th { background: #f0f0f0; text-transform: uppercase; font-size: 10px; }
 .center { text-align: center; }
 .right { text-align: right; }
 .totals { width: 100%; }
 .totals td { padding: 4px 12px; font-size: 12px; }
 .totals .label { text-align: right; font-weight: bold; }
 .totals .value { text-align: right; width: 120px; }
 .grand-total-row td { border-top: 1px solid #000; font-size: 14px; font-weight: bold; }
 .words-row { padding: 8px 12px; border-top: 1px solid #000; border-bottom: 1px solid #000; font-size: 11px; }
 .footer { display: flex; justify-content: space-between; padding: 10px 12px; }
 .footer .col { width: 48%; font-size: 11px; }
 .signature-box { margin-top: 40px; text-align: center; font-size: 11px; border-top: 1px solid #000; padding-top: 4px; }
 </style>
 </head>
 <body>
 <div class="invoice-box">
 <div class="title-bar">
 ${isGst ? "Tax Invoice" : data.invoiceType === "retail" ? "Retail Invoice" : data.invoiceType === "bill_of_supply" ? "Bill of Supply" : "Estimate / Quotation"}
 </div>

 <div class="header">
 <div class="col">
 ${cfg("showCompanyName") !== false ? `<div class="company-name">${data.company.name}</div>` : ""}
 ${cfg("showCompanyAddress") !== false && data.company.address ? `<div>${data.company.address}</div>` : ""}
 ${cfg("showCompanyPhone") !== false && data.company.phone ? `<div>Phone: ${data.company.phone}</div>` : ""}
 ${cfg("showCompanyGstin") !== false && isGst && data.company.gstin ? `<div><b>GSTIN: ${data.company.gstin}</b></div>` : ""}
 </div>
 <div class="col" style="text-align: right;">
 ${cfg("showInvoiceNumber") !== false ? `<div><b>Invoice No:</b> ${data.invoiceNumber}</div>` : ""}
 ${cfg("showDate") !== false ? `<div><b>Date:</b> ${data.date}</div>` : ""}
 ${cfg("showDate") !== false && isGst ? `<div><b>Supply Type:</b> ${isInterstate ? "Interstate (IGST)" : "Intrastate (CGST+SGST)"}</div>` : ""}
 <div><b>Bill Type:</b> ${data.party.category === "b2b" ? "B2B" : "B2C"}</div>
 </div>
 </div>

 <div class="party-block">
 <div class="label">Bill To</div>
 <div><b>${data.party.name}</b></div>
 ${cfg("showCustomerPhone") !== false && data.party.phone ? `<div>Phone: ${data.party.phone}</div>` : ""}
 ${cfg("showCustomerGstin") !== false && data.party.category === "b2b" && data.party.gstin ? `<div><b>GSTIN: ${data.party.gstin}</b></div>` : ""}
 </div>

 <table>
 <thead>
 <tr>
 ${cfg("showItemSno") !== false ? "<th>#</th>" : ""}
 <th>Item</th>
 ${cfg("showHsnCode") !== false ? "<th>HSN</th>" : ""}
 <th>Qty</th>
 <th>Rate</th>
 ${isGst ? "<th>Tax %</th><th>Tax Amt</th>" : ""}
 <th>Amount</th>
 </tr>
 </thead>
 <tbody>
 ${rows}
 </tbody>
 </table>

 <table class="totals">
 ${cfg("showSubtotal") !== false ? `
 <tr>
 <td class="label">Subtotal</td>
 <td class="value">₹${data.subtotal.toFixed(2)}</td>
 </tr>
 ` : ""}
 ${
 data.discountTotal > 0
 ? `<tr><td class="label">Discount</td><td class="value">-₹${data.discountTotal.toFixed(2)}</td></tr>`
 : ""
 }
 ${
 cfg("showTaxBreakup") !== false && isGst
 ? isInterstate
 ? `<tr><td class="label">IGST</td><td class="value">₹${data.igst.toFixed(2)}</td></tr>`
 : `<tr><td class="label">CGST</td><td class="value">₹${data.cgst.toFixed(2)}</td></tr>
 <tr><td class="label">SGST</td><td class="value">₹${data.sgst.toFixed(2)}</td></tr>`
 : ""
 }
 ${
 data.extraCharge && data.extraCharge > 0
 ? `<tr><td class="label">${data.extraChargeLabel || "Extra Charge"}</td><td class="value">₹${data.extraCharge.toFixed(2)}</td></tr>`
 : ""
 }
 <tr class="grand-total-row">
 <td class="label">Grand Total</td>
 <td class="value">₹${data.total.toFixed(2)}</td>
 </tr>
 ${cfg("showPaymentMode") !== false && data.paymentMode
 ? `<tr><td class="label">Payment Mode</td><td class="value">${{ cash: "CASH", upi: "UPI", credit: "CREDIT" }[data.paymentMode]}</td></tr>`
 : ""
 }
 </table>

 <div class="words-row">
 <b>Amount in Words:</b> ${numberToIndianWords(data.total)}
 </div>

 <div class="footer">
 <div class="col" style="${cfg("showUpiQr") !== false && data.company.upiId ? "width: 38%;" : ""}">
 ${
 cfg("showBankDetails") !== false && data.company.bankName
 ? `
 <div class="label" style="font-weight:bold; text-transform:uppercase; font-size:10px; color:#444; margin-bottom:3px;">Bank Details</div>
 <div>Bank: ${data.company.bankName}</div>
 ${data.company.bankAccountNumber ? `<div>A/c No: ${data.company.bankAccountNumber}</div>` : ""}
 ${data.company.bankIfsc ? `<div>IFSC: ${data.company.bankIfsc}</div>` : ""}
 `
 : "<div>This is a computer-generated invoice.</div>"
 }
 </div>
 ${
 cfg("showUpiQr") !== false && data.company.upiId
 ? `
 <div class="col" style="width: 24%; text-align:center;">
 <div class="label" style="font-weight:bold; text-transform:uppercase; font-size:10px; color:#444; margin-bottom:3px;">Scan to Pay</div>
 ${buildUpiQrSvg(data.company.upiId, data.company.name, data.total, 90)}
 </div>
 `
 : ""
 }
 <div class="col" style="${cfg("showUpiQr") !== false && data.company.upiId ? "width: 38%;" : ""}">
 ${cfg("showSignature") !== false ? `
 <div class="signature-box">
 For ${data.company.name}<br />Authorized Signatory
 </div>
 ` : ""}
 </div>
 </div>
 </div>
 </body>
 </html>
 `;
}
