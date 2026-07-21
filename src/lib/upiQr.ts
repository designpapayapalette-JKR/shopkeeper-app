import QRCode from "qrcode-generator";

// Generates a scannable UPI payment QR as inline SVG markup (a string of
// <rect> tags), so it can be embedded directly in the printed/shared
// invoice HTML with no image file, network request, or native canvas —
// works identically whether the receipt is rendered to a thermal printer,
// a PDF, or shared as a file.
export function buildUpiQrSvg(upiId: string, payeeName: string, amount: number, sizePx: number = 120): string {
 const upiUrl = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(payeeName)}&am=${amount.toFixed(2)}&cu=INR`;

 const qr = QRCode(0, "M");
 qr.addData(upiUrl);
 qr.make();

 const moduleCount = qr.getModuleCount();
 const cell = sizePx / moduleCount;
 let rects = "";
 for (let row = 0; row < moduleCount; row++) {
 for (let col = 0; col < moduleCount; col++) {
 if (qr.isDark(row, col)) {
 rects += `<rect x="${(col * cell).toFixed(2)}" y="${(row * cell).toFixed(2)}" width="${cell.toFixed(2)}" height="${cell.toFixed(2)}" fill="#000"/>`;
 }
 }
 }

 return `<svg width="${sizePx}" height="${sizePx}" viewBox="0 0 ${sizePx} ${sizePx}" xmlns="http://www.w3.org/2000/svg">
 <rect width="${sizePx}" height="${sizePx}" fill="#fff"/>
 ${rects}
 </svg>`;
}
