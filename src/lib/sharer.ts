import { Linking, Alert } from "react-native";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

// Renders the given invoice HTML to a real PDF file and opens the native
// share sheet (WhatsApp, email, Drive, etc. all appear automatically) with
// that file attached — replaces the old wa.me text-only deep link, which
// could never actually attach the invoice itself.
export async function shareInvoiceFile(
 html: string,
 dialogTitle: string,
 pageSize?: { width: number; height: number }
): Promise<void> {
 const canShare = await Sharing.isAvailableAsync();
 if (!canShare) {
 Alert.alert("Sharing Unavailable", "File sharing is not available on this device.");
 return;
 }
 const { uri } = await Print.printToFileAsync({ html, ...pageSize });
 await Sharing.shareAsync(uri, {
 mimeType: "application/pdf",
 dialogTitle,
 });
}

export function shareInvoice(invoiceNumber: string, customerName: string, customerPhone: string, total: number) {
 const message = `Hello ${customerName}, your invoice ${invoiceNumber} of amount ₹${total.toFixed(2)} has been generated. Thank you for shopping with us!`;
 const cleanPhone = customerPhone.replace(/[^0-9]/g, "");
 const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
 
 Linking.canOpenURL(whatsappUrl)
 .then((supported) => {
 if (supported) {
 Linking.openURL(whatsappUrl);
 } else {
 // Fallback to generic share or email
 Alert.alert("Error", "WhatsApp is not installed or url scheme is not supported.");
 }
 })
 .catch((err) => console.error("Error opening WhatsApp URL:", err));
}

export function shareLedgerReminder(partyName: string, partyPhone: string, balance: number, isSupplier: boolean) {
 const message = isSupplier
 ? `Dear ${partyName}, this is a verification note regarding our outstanding balance of ₹${balance.toFixed(2)} that we owe you. Please confirm at your convenience. Thank you!`
 : `Dear ${partyName}, this is a friendly reminder that your outstanding balance of ₹${balance.toFixed(2)} is due. Please clear it at your earliest convenience. Thank you!`;
 
 const cleanPhone = partyPhone.replace(/[^0-9]/g, "");
 const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;

 Linking.canOpenURL(whatsappUrl)
 .then((supported) => {
 if (supported) {
 Linking.openURL(whatsappUrl);
 } else {
 Alert.alert("Error", "WhatsApp is not installed.");
 }
 })
 .catch((err) => console.error("Error opening WhatsApp URL:", err));
}

export function shareChallan(challan: any) {
 const lines = [`Delivery Challan: ${challan.challan_number}`];
 if (challan.party?.name) lines.push(`Consignee: ${challan.party.name}`);
 else if (challan.destination) lines.push(`Destination: ${challan.destination}`);
 if (challan.vehicle_number) lines.push(`Vehicle: ${challan.vehicle_number}`);
 if (challan.driver_name) lines.push(`Driver: ${challan.driver_name}${challan.driver_phone ? ` (${challan.driver_phone})` : ""}`);
 lines.push(`Status: ${challan.status.toUpperCase()}`);
 const message = lines.join("\n");

 const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;

 Linking.canOpenURL(whatsappUrl)
 .then((supported) => {
 if (supported) {
 Linking.openURL(whatsappUrl);
 } else {
 Alert.alert("Error", "WhatsApp is not installed.");
 }
 })
 .catch((err) => console.error("Error opening WhatsApp URL:", err));
}
