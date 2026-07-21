import React, { useState, useEffect } from "react";
import {
 Text,
 View,
 ScrollView,
 Pressable,
 TextInput,
 Modal,
 ActivityIndicator,
 Alert,
 FlatList,
 Linking,
 KeyboardAvoidingView,
 Platform,
} from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "react-native-paper";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useAuth } from "../../src/lib/auth-context";
import { api, ApiError } from "../../src/lib/api";
import { useConfirm } from "../../src/components/ConfirmDialog";
import { useTopInset } from "../../src/lib/useTopInset";
import { useBottomInset } from "../../src/lib/useBottomInset";
import { getAvatarColor, getInitial } from "../../src/lib/avatarColor";
import BulkUploadCard from "../../src/components/BulkUploadCard";
function IconBtn({ icon, color, loading, onPress }: { icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"]; color: string; loading?: boolean; onPress: () => void }) {
 return (
 <Pressable onPress={onPress} disabled={loading} className="w-10 h-10 rounded-xl items-center justify-center bg-surface-container">
 {loading ? <ActivityIndicator size="small" color={color} /> : <MaterialCommunityIcons name={icon} size={18} color={color} />}
 </Pressable>
 );
}
import type { BankAccount } from "../bank-accounts";
import { useTerminology } from "../../src/lib/terminology-context";
import { StatePicker } from "../../src/components/StatePicker";
import ListRow from "../../src/components/ListRow";
import EmptyState from "../../src/components/EmptyState";

// Indian lakh/crore grouping, not Western thousands grouping — a
// shopkeeper reads "₹1,20,000" fluently and "₹1,20,000.00" as foreign.
// shopkeeper-mobile-design-system.md §3.1.
function formatRupee(n: number): string {
 return `₹${Math.abs(n).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

interface Party {
 id: string;
 name: string;
 phone: string;
 type: string;
 category?: "b2b" | "b2c";
 gstin?: string;
 current_balance: string;
 opening_balance: string;
}

interface LedgerEntry {
 id: string;
 date: string;
 type: "debit" | "credit";
 amount: string;
 reference: string;
 invoice_id?: string | null;
 purchase_id?: string | null;
}

export default function LedgerScreen() {
 const theme = useTheme();
 const { user, activeCompany } = useAuth();
 const { t } = useTerminology();
 const confirm = useConfirm();
 const router = useRouter();
 const topInset = useTopInset();
 const bottomInset = useBottomInset();
 const params = useLocalSearchParams<{ openPartyId?: string; openPartyType?: "customer" | "supplier" }>();
 const [parties, setParties] = useState<Party[]>([]);
 const [loading, setLoading] = useState(true);
 const [activeTab, setActiveTab] = useState<"customer" | "supplier">(
 params.openPartyType === "supplier" ? "supplier" : "customer"
 );
 const [search, setSearch] = useState("");
 const [autoOpenedPartyId, setAutoOpenedPartyId] = useState<string | null>(null);
 const [deletingPartyId, setDeletingPartyId] = useState<string | null>(null);
 const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);

 // Detailed Ledger Modal State
 const [selectedParty, setSelectedParty] = useState<Party | null>(null);
 const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
 const [entriesLoading, setEntriesLoading] = useState(false);

 // Container / Crate Tracking
 const [containerInventory, setContainerInventory] = useState<any[]>([]);
 const [containerLoading, setContainerLoading] = useState(false);
 const fetchContainerBalance = async (partyId: string) => {
 setContainerLoading(true);
 try {
 const res = await api.get<{ data: any[] }>(`/container/inventory/${partyId}`);
 setContainerInventory(res.data ?? []);
 } catch {
 setContainerInventory([]);
 } finally {
 setContainerLoading(false);
 }
 };

 // Add Party Modal State
 const [isAddingParty, setIsAddingParty] = useState(false);
 const [editingParty, setEditingParty] = useState<Party | null>(null);
 const [newPartyName, setNewPartyName] = useState("");
 const [newPartyPhone, setNewPartyPhone] = useState("");
 const [newPartyState, setNewPartyState] = useState("");
 const [newPartyGstin, setNewPartyGstin] = useState("");
 const [newPartyCategory, setNewPartyCategory] = useState<"b2b" | "b2c">(activeCompany?.default_customer_category || "b2c");
 const [newPartyBalance, setNewPartyBalance] = useState("");
 const [newPartyCreditLimit, setNewPartyCreditLimit] = useState("");
 const [newPartyAddress, setNewPartyAddress] = useState("");
 const [newPartyPan, setNewPartyPan] = useState("");
 const [newPartyAadhaar, setNewPartyAadhaar] = useState("");
 const [addPartyLoading, setAddPartyLoading] = useState(false);
 const [gstinAutoFilled, setGstinAutoFilled] = useState(false);

 // GSTIN auto-fill: mirrors the web ledger page — once a full 15-character
 // GSTIN is typed, check whether this company already has a party saved
 // with the same GSTIN and offer to fill name/address/state/phone from it
 // instead of making the user re-type it. Only fills fields still blank.
 useEffect(() => {
 if (editingParty) return;
 const gstin = newPartyGstin.trim().toUpperCase();
 if (gstin.length !== 15) { setGstinAutoFilled(false); return; }
 const timer = setTimeout(async () => {
 try {
 const res = await api.get<{ data: { name?: string; address?: string; state?: string; phone?: string } | null }>(
 `/parties/lookup-by-gstin/${gstin}`
 );
 const match = res.data;
 if (!match) return;
 if (!newPartyName.trim()) setNewPartyName(match.name || "");
 if (!newPartyAddress.trim()) setNewPartyAddress(match.address || "");
 if (!newPartyState.trim() && match.state) setNewPartyState(match.state);
 if (!newPartyPhone.trim() && match.phone) setNewPartyPhone(match.phone);
 setGstinAutoFilled(true);
 } catch { /* silent — auto-fill is a convenience, not a required step */ }
 }, 500);
 return () => clearTimeout(timer);
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [newPartyGstin, editingParty]);

 // Record Payment Modal State
 const [isRecordingPayment, setIsRecordingPayment] = useState(false);
 const [paymentType, setPaymentType] = useState<"debit" | "credit">("credit"); // credit = payment received (reduces customer balance), debit = payment paid (reduces supplier balance)
 const [paymentAmount, setPaymentAmount] = useState("");
 const [paymentReference, setPaymentReference] = useState("");
 const [paymentLoading, setPaymentLoading] = useState(false);
 const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
 const [selectedBankAccountId, setSelectedBankAccountId] = useState<string | null>(null);
 // Optional invoice link — lets a specific invoice's payment status update
 // instead of only the party's overall balance (KNOWLEDGE-BASE.md §6).
 const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
 const [outstandingInvoices, setOutstandingInvoices] = useState<{ id: string; invoice_number: string; grand_total: string; amount_paid?: string }[]>([]);

 const closeRecordPayment = async () => {
 const hasChanges =
 paymentAmount.trim() !== "" || paymentReference.trim() !== "" || selectedBankAccountId !== null;
 if (hasChanges) {
 const ok = await confirm({
 title: "Discard changes?",
 message: "You have unsaved changes. Are you sure you want to go back?",
 confirmLabel: "Discard",
 destructive: true,
 });
 if (!ok) return;
 }
 setIsRecordingPayment(false);
 };

 const openRecordPayment = async () => {
 setSelectedBankAccountId(null);
 setSelectedInvoiceId(null);
 setOutstandingInvoices([]);
 setIsRecordingPayment(true);
 try {
 const res = await api.get<{ data: BankAccount[] }>("/bank-accounts");
 setBankAccounts(res.data ?? []);
 } catch (e) {
 console.error("Failed to load bank accounts:", e);
 }
 if (selectedParty) {
 try {
 const res = await api.get<{ data: any[] }>("/invoices", { params: { partyId: selectedParty.id, limit: 100 } });
 setOutstandingInvoices(
 (res.data ?? [])
 .filter((inv) => inv.type !== "estimate" && inv.payment_status !== "paid")
 .map((inv) => ({ id: inv.id, invoice_number: inv.invoice_number, grand_total: inv.grand_total, amount_paid: inv.amount_paid }))
 );
 } catch (e) {
 console.error("Failed to load outstanding invoices:", e);
 }
 }
 };

 const fetchParties = async () => {
 if (!user?.company_id) return;
 setLoading(true);
 try {
 const res = await api.get<{ data: Party[] }>("/parties", { params: { type: activeTab } });
 setParties(res.data ?? []);
 } catch (error) {
 console.error("Failed to fetch parties:", error);
 } finally {
 setLoading(false);
 }
 };

 useEffect(() => {
 fetchParties();
 }, [user, activeTab]);

 // Deep-link support: Recent Activity / Activity Log rows navigate here
 // with the specific party id (+ its customer/supplier tab, set as the
 // initial activeTab above) so tapping a party-related entry opens that
 // party's ledger directly instead of landing on the general list.
 useEffect(() => {
 if (!params.openPartyId || params.openPartyId === autoOpenedPartyId || parties.length === 0) return;
 const match = parties.find((p) => p.id === params.openPartyId);
 if (match) {
 setAutoOpenedPartyId(params.openPartyId);
 handleSelectParty(match);
 }
 }, [params.openPartyId, parties]);

 const fetchLedgerEntries = async (partyId: string) => {
 setEntriesLoading(true);
 try {
 const res = await api.get<{ data: LedgerEntry[] }>(`/ledger/${partyId}`);
 setLedgerEntries(res.data ?? []);
 } catch (error) {
 console.error("Failed to fetch ledger entries:", error);
 } finally {
 setEntriesLoading(false);
 }
 };

 const handleSelectParty = (party: Party) => {
 setSelectedParty(party);
 fetchLedgerEntries(party.id);
 fetchContainerBalance(party.id);
 };

 const handleRecordPayment = async () => {
 if (!selectedParty || !paymentAmount) {
 Alert.alert("Required Fields", "Payment amount is required.");
 return;
 }
 if (!user?.company_id) return;

 setPaymentLoading(true);
 try {
 const amountNum = parseFloat(paymentAmount);

 // "credit" (payment received) always maps to direction "in"; "debit"
 // (payment paid out) always maps to "out" — the server computes the
 // customer/supplier-specific balance delta from party.type + direction.
 await api.post("/ledger/payments", {
 party_id: selectedParty.id,
 invoice_id: selectedInvoiceId || undefined,
 bank_account_id: selectedBankAccountId || undefined,
 direction: paymentType === "credit" ? "in" : "out",
 amount: amountNum,
 reference: paymentReference || "Payment entry",
 });

 Alert.alert("Success", "Payment recorded successfully.");

 // Reset payment form
 setPaymentAmount("");
 setPaymentReference("");
 setIsRecordingPayment(false);

 // Refresh the selected party's balance (server-computed) plus listings
 const updated = await api.get<{ data: Party }>(`/parties/${selectedParty.id}`);
 setSelectedParty(updated.data);
 fetchLedgerEntries(selectedParty.id);
 fetchParties();
 } catch (error) {
 Alert.alert("Error", error instanceof ApiError ? error.message : "Failed to record payment.");
 } finally {
 setPaymentLoading(false);
 }
 };

 const resetPartyForm = () => {
 setIsAddingParty(false);
 setEditingParty(null);
 setNewPartyName("");
 setNewPartyPhone("");
 setNewPartyState("");
 setNewPartyGstin("");
 setNewPartyCategory(activeCompany?.default_customer_category || "b2c");
 setNewPartyBalance("");
 setNewPartyAddress("");
 setNewPartyPan("");
 setNewPartyAadhaar("");
 setGstinAutoFilled(false);
 };

 const handleOpenEditParty = (party: Party) => {
 setEditingParty(party);
 setNewPartyName(party.name);
 setNewPartyPhone(party.phone || "");
 setNewPartyGstin(party.gstin || "");
 setNewPartyCategory(party.category || "b2c");
 setNewPartyState("");
 setNewPartyAddress((party as any).address || "");
 setNewPartyPan((party as any).pan || "");
 setNewPartyAadhaar((party as any).aadhaar || "");
 };

 const closePartyForm = async () => {
 const hasChanges = editingParty
 ? newPartyName !== editingParty.name ||
 newPartyPhone !== (editingParty.phone || "") ||
 newPartyGstin !== (editingParty.gstin || "") ||
 newPartyCategory !== (editingParty.category || "b2c") ||
 newPartyAddress !== ((editingParty as any).address || "") ||
 newPartyPan !== ((editingParty as any).pan || "") ||
 newPartyAadhaar !== ((editingParty as any).aadhaar || "")
 : newPartyName.trim() !== "" ||
 newPartyPhone.trim() !== "" ||
 newPartyState.trim() !== "" ||
 newPartyGstin.trim() !== "" ||
 newPartyBalance.trim() !== "" ||
 newPartyAddress.trim() !== "" ||
 newPartyPan.trim() !== "" ||
 newPartyAadhaar.trim() !== "" ||
 newPartyCategory !== "b2c";
 if (hasChanges) {
 const ok = await confirm({
 title: "Discard changes?",
 message: "You have unsaved changes. Are you sure you want to go back?",
 confirmLabel: "Discard",
 destructive: true,
 });
 if (!ok) return;
 }
 resetPartyForm();
 };

 const handleAddParty = async () => {
 if (!newPartyName) {
 Alert.alert("Required Fields", "Name is required.");
 return;
 }
 if (newPartyCategory === "b2b" && !newPartyGstin.trim()) {
 Alert.alert("Required Fields", "GSTIN is required for a B2B account to issue a valid tax invoice.");
 return;
 }
 if (!user?.company_id) return;

 setAddPartyLoading(true);
 try {
 if (editingParty) {
 await api.patch(`/parties/${editingParty.id}`, {
 name: newPartyName,
 phone: newPartyPhone || undefined,
 gstin: newPartyGstin || undefined,
 category: newPartyCategory,
 credit_limit: newPartyCreditLimit ? parseFloat(newPartyCreditLimit) : null,
 address: newPartyAddress || undefined,
 pan: newPartyPan || undefined,
 aadhaar: newPartyAadhaar || undefined,
 });
 Alert.alert("Success", "Party details updated.");
 } else {
 const balance = parseFloat(newPartyBalance || "0");
 await api.post("/parties", {
 name: newPartyName,
 phone: newPartyPhone || undefined,
 state: newPartyState || undefined,
 gstin: newPartyGstin || undefined,
 category: newPartyCategory,
 type: activeTab,
 current_balance: balance,
 opening_balance: balance,
 credit_limit: newPartyCreditLimit ? parseFloat(newPartyCreditLimit) : null,
 address: newPartyAddress || undefined,
 pan: newPartyPan || undefined,
 aadhaar: newPartyAadhaar || undefined,
 });
 Alert.alert("Success", `${activeTab === "customer" ? "Customer" : "Supplier"} added successfully.`);
 }
 resetPartyForm();
 fetchParties();
 } catch (e) {
 Alert.alert("Error", e instanceof ApiError ? e.message : "Failed to save party.");
 } finally {
 setAddPartyLoading(false);
 }
 };

 const handleDeleteParty = async (party: Party) => {
 if (!user?.company_id) return;
 const balance = parseFloat(party.current_balance || "0");
 const ok = await confirm({
 title: `Delete this ${party.type}?`,
 message:
 balance !== 0
 ? `"${party.name}" has an outstanding balance of ${formatRupee(balance)}. It will be moved to the Recycle Bin, not deleted forever — you can restore it later from More > Recycle Bin.`
 : `"${party.name}" will be moved to the Recycle Bin. You can restore it later from More > Recycle Bin.`,
 confirmLabel: "Delete",
 destructive: true,
 });
 if (!ok) return;

 setDeletingPartyId(party.id);
 try {
 await api.delete(`/parties/${party.id}`);
 setParties((prev) => prev.filter((p) => p.id !== party.id));
 if (selectedParty?.id === party.id) setSelectedParty(null);
 } catch (e) {
 Alert.alert("Error", e instanceof ApiError ? e.message : "Failed to delete party.");
 } finally {
 setDeletingPartyId(null);
 }
 };

 const handleSendReminder = (party: Party = selectedParty!) => {
 if (!party?.phone) {
 Alert.alert("No Phone Number", "This party does not have a phone number saved.");
 return;
 }
 const balance = parseFloat(party.current_balance || "0");
 const balStr = formatRupee(balance).replace("₹", "");

 // In our simplified logic: Customer positive balance = they owe us. Supplier positive balance = we owe them.
 const message = party.type === "customer"
 ? `Dear ${party.name},\n\nThis is a friendly reminder that your outstanding balance is ₹${balStr}. Please settle at your earliest convenience.\n\nThank you!`
 : `Hi ${party.name},\n\nI am reaching out regarding our outstanding payable of ₹${balStr}. We will process this shortly.\n\nThanks!`;

 // Try linking to whatsapp
 const url = `whatsapp://send?text=${encodeURIComponent(message)}&phone=+91${party.phone.replace(/\D/g, '')}`;
 Linking.canOpenURL(url).then(supported => {
 if (supported) {
 return Linking.openURL(url);
 } else {
 Alert.alert("Error", "WhatsApp is not installed on this device.");
 }
 }).catch(err => {
 Alert.alert("Error", "Could not open WhatsApp.");
 });
 };

 const filteredParties = parties.filter((p) =>
 p.name.toLowerCase().includes(search.toLowerCase()) || p.phone?.includes(search)
 );

 return (
 <View className="flex-1 bg-background px-5" style={{ paddingTop: topInset }}>
 {/* Header */}
 <View className="flex-row items-center justify-between mb-4 pt-2">
 <View className="flex-1 mr-3">
 <Text className="font-headline-md text-on-surface" style={{ fontSize: 20, fontWeight: "700" }}>
 {activeTab === "customer" ? t("receivables") : t("payables")}
 </Text>
 </View>
 <Pressable
 onPress={() => router.push("/unified-ledger" as any)}
 className="flex-row items-center bg-surface-container rounded-xl px-3 py-2"
 style={{ gap: 6 }}
 >
 <MaterialCommunityIcons name="view-list-outline" size={16} color={theme.colors.primary} />
 <Text className="text-sm font-bold text-primary">All Ledger</Text>
 </Pressable>
 </View>

 {/* Tabs */}
 <View className="flex-row bg-surface-container rounded-xl p-1 mb-4">
 <Pressable
 onPress={() => { setActiveTab("customer"); setSelectedParty(null); }}
 className={`flex-1 py-3 rounded-xl items-center ${activeTab === "customer" ? "bg-surface-container-lowest shadow-sm" : ""}`}
 >
 <Text className={`font-label-md ${activeTab === "customer" ? "text-primary" : "text-on-surface-variant"}`}>Customers</Text>
 </Pressable>
 <Pressable
 onPress={() => { setActiveTab("supplier"); setSelectedParty(null); }}
 className={`flex-1 py-3 rounded-xl items-center ${activeTab === "supplier" ? "bg-surface-container-lowest shadow-sm" : ""}`}
 >
 <Text className={`font-label-md ${activeTab === "supplier" ? "text-primary" : "text-on-surface-variant"}`}>Suppliers</Text>
 </Pressable>
 </View>

 {/* Search */}
 <View className="flex-row items-center mb-4 bg-surface-container-lowest rounded-2xl px-4 py-3 border border-outline-variant">
 <MaterialCommunityIcons name="magnify" size={18} color="#6B7280" />
 <TextInput
 placeholder={`Search ${activeTab}s...`}
 placeholderTextColor="#9CA3AF"
 value={search}
 onChangeText={setSearch}
 className="flex-1 ml-2 text-base font-medium text-on-surface"
 />
 {search !== "" && (
 <Pressable onPress={() => setSearch("")} className="ml-2">
 <MaterialCommunityIcons name="close-circle" size={16} color="#9CA3AF" />
 </Pressable>
 )}
 </View>

 {/* List — ListRow per shopkeeper-mobile-design-system.md §6.7: title +
 subtitle + trailing amount, status conveyed by icon+color+word
 together (never color alone). WhatsApp reminder and edit stay as
 separate affordances below each row since they're secondary
 actions, not part of the row's own tap target. */}
 {loading ? (
 <View className="flex-1 justify-center items-center">
 <ActivityIndicator size="large" color={theme.colors.primary} />
 </View>
 ) : filteredParties.length === 0 ? (
 <EmptyState
 icon={activeTab === "customer" ? "account-group" : "truck-outline"}
 title={activeTab === "customer" ? "No customers yet" : "No suppliers yet"}
 description={`Add your first ${activeTab} to start tracking their balance.`}
 actionLabel={`Add ${activeTab === "customer" ? "Customer" : "Supplier"}`}
 onAction={() => setIsAddingParty(true)}
 />
 ) : (
 <FlatList
 data={filteredParties}
 keyExtractor={(item) => item.id}
 showsVerticalScrollIndicator={false}
 contentContainerStyle={{ paddingBottom: 80 + bottomInset }}
 renderItem={({ item }) => {
 const bal = parseFloat(item.current_balance || "0");
 const isReceivable = activeTab === "customer";
 const owed = bal > 0;
 const avatarColor = getAvatarColor(item.name);
 const tone: "success" | "error" | "neutral" = !owed ? "neutral" : isReceivable ? "success" : "error";
 const statusLabel = !owed ? "No dues" : isReceivable ? "You'll get" : "You owe";

 return (
 <View className="mb-1">
 <ListRow
 title={item.name}
 subtitle={item.phone || "No phone number"}
 amount={formatRupee(bal)}
 status={{ label: statusLabel, tone }}
 avatarLabel={getInitial(item.name)}
 avatarColor={avatarColor.text}
 onPress={() => handleSelectParty(item)}
 />
 <View className="flex-row items-center px-2 -mt-1 mb-2" style={{ gap: 16 }}>
 <Pressable
 onPress={() => handleOpenEditParty(item)}
 hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
 className="flex-row items-center"
 style={{ gap: 4 }}
 >
 <MaterialCommunityIcons name="pencil-outline" size={14} color="#6B7280" />
 <Text className="text-xs font-bold text-on-surface-variant">Edit</Text>
 </Pressable>
 {item.phone && bal !== 0 && (
 <Pressable
 onPress={() => handleSendReminder(item)}
 hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
 className="flex-row items-center"
 style={{ gap: 4 }}
 >
 <MaterialCommunityIcons name="whatsapp" size={14} color="#128C7E" />
 <Text className="text-xs font-bold text-[#128C7E][#25D366]">Send Reminder</Text>
 </Pressable>
 )}
 </View>
 </View>
 );
 }}
 />
 )}

 {/* Bottom Action Bar */}
 <View
 className="absolute bottom-0 left-0 right-0 bg-background border-t border-outline-variant px-6 pt-3 flex-row"
 style={{ paddingBottom: bottomInset, gap: 10 }}
 >
 <Pressable
 onPress={() => setIsBulkImportOpen(true)}
 className="bg-surface-container-lowest border border-outline-variant px-5 py-4 rounded-2xl items-center justify-center"
 >
 <MaterialCommunityIcons name="tray-arrow-up" size={20} color={theme.colors.primary} />
 </Pressable>
 <Pressable
 onPress={() => setIsAddingParty(true)}
 className="flex-1 bg-primary py-4 rounded-2xl items-center justify-center flex-row shadow-sm active:opacity-90"
 style={{ gap: 6 }}
 >
 <MaterialCommunityIcons name="plus" size={18} color="white" />
 <Text className="text-white font-black text-sm uppercase tracking-widest">
 Create {activeTab === "customer" ? "Customer" : "Supplier"}
 </Text>
 </Pressable>
 </View>

 {/* Bulk Import Modal */}
 <Modal visible={isBulkImportOpen} animationType="slide" onRequestClose={() => setIsBulkImportOpen(false)}>
 <SafeAreaProvider>
 <View className="flex-1 bg-background px-6" style={{ paddingTop: topInset }}>
 <View className="flex-row justify-between items-center mb-6">
 <Text className="text-2xl font-bold text-on-surface">
 Bulk Import {activeTab === "customer" ? "Customers" : "Suppliers"}
 </Text>
 <Pressable onPress={() => setIsBulkImportOpen(false)} className="w-11 h-11 items-center justify-center">
 <MaterialCommunityIcons name="close" size={20} color="#6B7280" />
 </Pressable>
 </View>
 <BulkUploadCard
 entityLabel={activeTab === "customer" ? "Customers" : "Suppliers"}
 columns={[
 { header: "name", example: "Sharma General Store", required: true },
 { header: "phone", example: "9876543210", required: false },
 { header: "state", example: "Maharashtra", required: false },
 { header: "gstin", example: "27ABCDE1234F1Z5", required: false },
 { header: "category", example: "b2b", required: false },
 { header: "opening_balance", example: "0", required: false },
 ]}
 mapRowToPayload={(row) => {
 if (!row.name?.trim()) return null;
 const balance = row.opening_balance ? parseFloat(row.opening_balance) : 0;
 return {
 name: row.name.trim(),
 phone: row.phone?.trim() || undefined,
 state: row.state?.trim() || undefined,
 gstin: row.gstin?.trim() || undefined,
 category: row.category?.trim().toLowerCase() === "b2b" ? "b2b" : "b2c",
 type: activeTab,
 current_balance: balance,
 opening_balance: balance,
 };
 }}
 createOne={async (payload) => {
 await api.post("/parties", payload);
 }}
 onComplete={fetchParties}
 />
 </View>
 </SafeAreaProvider>
 </Modal>

 {/* Detailed Ledger Entries Modal */}
 {selectedParty && (
 <Modal visible={selectedParty !== null} animationType="slide" onRequestClose={() => setSelectedParty(null)}>
 <SafeAreaProvider>
 <View className="flex-1 bg-background px-5" style={{ paddingTop: topInset }}>
 {/* Header */}
 <View className="flex-row items-center justify-between mb-6">
 <View className="flex-1 mr-3">
 <Text className="font-headline-md text-on-surface" style={{ fontSize: 20, fontWeight: "700" }}>
 {selectedParty.name}
 </Text>
 <Text className="text-sm text-on-surface-variant font-bold mt-0.5 uppercase tracking-wider">
 {selectedParty.type} Ledger
 </Text>
 </View>
 <View className="flex-row" style={{ gap: 4 }}>
 <IconBtn icon="pencil-outline" color="#6B7280" onPress={() => handleOpenEditParty(selectedParty)} />
 <IconBtn
 icon="trash-can-outline"
 color="#D64545"
 loading={deletingPartyId === selectedParty.id}
 onPress={() => handleDeleteParty(selectedParty)}
 />
 <IconBtn icon="close" color="#374151" onPress={() => setSelectedParty(null)} />
 </View>
 </View>

 {/* Quick Balances info */}
 <View className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant mb-4">
 <View className="flex-row justify-between items-center mb-4">
 <View>
 <Text className="text-xs text-on-surface-variant font-bold uppercase tracking-wider mb-1">
 Outstanding
 </Text>
 <Text className="text-2xl font-bold text-primary">
 {formatRupee(parseFloat(selectedParty.current_balance || "0"))}
 </Text>
 </View>
 <Pressable
 onPress={() => { setPaymentType(selectedParty.type === "customer" ? "credit" : "debit"); openRecordPayment(); }}
 className="bg-primary px-5 py-3 rounded-xl"
 >
 <Text className="text-white font-bold text-sm">Record Payment</Text>
 </Pressable>
 </View>
 {selectedParty.phone && (
 <Pressable
 onPress={() => handleSendReminder()}
 className="bg-[#25D366]/10 py-3 rounded-xl flex-row items-center justify-center"
 style={{ gap: 8 }}
 >
 <MaterialCommunityIcons name="whatsapp" size={18} color="#128C7E" />
 <Text className="text-[#128C7E] font-bold text-sm">Send WhatsApp Reminder</Text>
 </Pressable>
 )}
 </View>

 {/* Container / Crate Balance */}
 {containerLoading ? (
 <View className="bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant mb-4 items-center">
 <ActivityIndicator size="small" color="#7c3aed" />
 </View>
 ) : containerInventory.length > 0 ? (
 <View className="bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant mb-4">
 <Text className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-3">Containers / Crates</Text>
 {containerInventory.map((ci: any) => (
 <View key={ci.id} className="flex-row justify-between items-center py-2 border-b border-outline-variant/40">
 <View className="flex-1 mr-2">
 <Text className="text-sm font-bold text-on-surface">{ci.product?.name || "Unknown"}</Text>
 <Text className="text-xs text-on-surface-variant mt-0.5">{ci.total_issued} issued / {ci.total_returned} returned</Text>
 </View>
 <View className="items-end">
 <Text className="text-sm font-bold text-on-surface">Net: {ci.net_pending}</Text>
 <Text className="text-xs font-bold text-purple-600">₹{Number(ci.deposit_value || 0).toFixed(2)}</Text>
 </View>
 </View>
 ))}
 </View>
 ) : null}

 {/* Entries timeline */}
 {entriesLoading ? (
 <View className="flex-grow justify-center items-center py-20">
 <ActivityIndicator size="large" color={theme.colors.primary} />
 </View>
 ) : ledgerEntries.length === 0 ? (
 <View className="flex-grow justify-center items-center py-20">
 <Text className="text-on-surface-variant font-bold text-base text-center">
 No transaction ledger records
 </Text>
 </View>
 ) : (
 <FlatList
 data={ledgerEntries}
 keyExtractor={(item) => item.id}
 showsVerticalScrollIndicator={false}
 contentContainerStyle={{ paddingBottom: bottomInset + 16 }}
 renderItem={({ item }) => {
 const isDebit = item.type === "debit";
 const indicatorColor = isDebit ? "text-red-500 font-bold" : "text-green-500 font-bold";
 const typeLabel = isDebit ? "Debit (+)" : "Credit (-)";
 const linkedInvoiceId = item.invoice_id;
 const linkedPurchaseId = item.purchase_id;
 const isLinked = !!linkedInvoiceId || !!linkedPurchaseId;

 return (
 <Pressable
 disabled={!isLinked}
 onPress={() => {
 if (linkedInvoiceId) router.push(`/invoice-history?openInvoiceId=${linkedInvoiceId}` as any);
 else if (linkedPurchaseId) router.push(`/purchase-history?openPurchaseId=${linkedPurchaseId}` as any);
 }}
 className="bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant mb-3.5 shadow-sm active:opacity-70"
 >
 <View className="flex-row justify-between items-start">
 <View className="flex-1 mr-2">
 <Text className="font-bold text-base text-on-surface">
 {item.reference || "Ledger Entry"}
 </Text>
 <Text className="text-sm text-on-surface-variant mt-1">
 Date: {item.date}
 </Text>
 {isLinked && (
 <Text className="text-xs font-bold text-primary mt-1">
 Tap to view {linkedInvoiceId ? "invoice" : "purchase"} →
 </Text>
 )}
 </View>
 <View className="items-end">
 <Text className={`text-lg ${indicatorColor}`}>
 {isDebit ? "+" : "-"} {formatRupee(parseFloat(item.amount))}
 </Text>
 <Text className="text-sm font-bold text-on-surface-variant mt-1 uppercase tracking-widest">
 {typeLabel}
 </Text>
 </View>
 </View>
 </Pressable>
 );
 }}
 />
 )}
 </View>
 </SafeAreaProvider>
 </Modal>
 )}

 {/* Record Payment Form Modal */}
 <Modal visible={isRecordingPayment} animationType="slide" onRequestClose={closeRecordPayment}>
 <SafeAreaProvider>
 <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : undefined}>
 <ScrollView className="flex-1 bg-background px-6" style={{ paddingTop: topInset }} contentContainerStyle={{ paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
 <View className="flex-row justify-between items-center mb-6">
 <Text className="text-2xl font-bold text-on-surface">
 Record Payment
 </Text>
 <Pressable onPress={closeRecordPayment} className="w-11 h-11 items-center justify-center">
 <MaterialCommunityIcons name="close" size={20} color="#6B7280" />
 </Pressable>
 </View>

 {/* Form */}
 <View className="space-y-4">
 <View>
 <Text className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider mb-2">
 Transaction Type
 </Text>

 {/* Type Switcher */}
 <View className="flex-row bg-surface-container-lowest border border-gray-150 p-1 rounded-xl">
 <Pressable
 onPress={() => setPaymentType("credit")}
 className={`flex-1 py-3.5 rounded-lg items-center ${
 paymentType === "credit" ? "bg-primary" : "bg-transparent"
 }`}
 >
 <Text
 className={`text-sm font-bold text-center ${
 paymentType === "credit" ? "text-white" : "text-on-surface-variant"
 }`}
 >
 Credit (Payment In / Received)
 </Text>
 </Pressable>
 <Pressable
 onPress={() => setPaymentType("debit")}
 className={`flex-1 py-3.5 rounded-lg items-center ${
 paymentType === "debit" ? "bg-primary" : "bg-transparent"
 }`}
 >
 <Text
 className={`text-sm font-bold text-center ${
 paymentType === "debit" ? "text-white" : "text-on-surface-variant"
 }`}
 >
 Debit (Payment Out / Paid)
 </Text>
 </Pressable>
 </View>
 </View>

 <View className="mt-4">
 <Text className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider mb-2">
 Amount (INR) *
 </Text>
 <TextInput
 value={paymentAmount}
 onChangeText={setPaymentAmount}
 placeholder="0.00"
 placeholderTextColor="#A0A0A0"
 keyboardType="numeric"
 className="bg-surface-container-lowest text-on-surface border border-outline-variant rounded-xl px-4 py-4 font-bold text-lg"
 />
 </View>

 {outstandingInvoices.length > 0 && (
 <View className="mt-4">
 <Text className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider mb-2">
 Link to Invoice (optional)
 </Text>
 <ScrollView horizontal showsHorizontalScrollIndicator={false}>
 <View className="flex-row" style={{ gap: 8 }}>
 <Pressable
 onPress={() => setSelectedInvoiceId(null)}
 className={`px-4 py-2.5 rounded-xl border-2 ${
 selectedInvoiceId === null ? "border-primary bg-primary/10" : "border-outline-variant"
 }`}
 >
 <Text className={`text-xs font-bold ${selectedInvoiceId === null ? "text-primary" : "text-on-surface"}`}>Not linked</Text>
 </Pressable>
 {outstandingInvoices.map((inv) => (
 <Pressable
 key={inv.id}
 onPress={() => setSelectedInvoiceId(inv.id)}
 className={`px-4 py-2.5 rounded-xl border-2 ${
 selectedInvoiceId === inv.id ? "border-primary bg-primary/10" : "border-outline-variant"
 }`}
 >
 <Text className={`text-xs font-bold ${selectedInvoiceId === inv.id ? "text-primary" : "text-on-surface"}`}>
 {inv.invoice_number} — ₹{(parseFloat(inv.grand_total) - parseFloat(inv.amount_paid || "0")).toFixed(0)} due
 </Text>
 </Pressable>
 ))}
 </View>
 </ScrollView>
 </View>
 )}

 <View className="mt-4">
 <Text className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider mb-2">
 Credited / Debited Account
 </Text>
 <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
 <Pressable
 onPress={() => setSelectedBankAccountId(null)}
 className={`mr-2 px-4 py-3 rounded-xl border ${
 selectedBankAccountId === null
 ? "bg-primary border-primary"
 : "bg-surface-container-lowest border-outline-variant"
 }`}
 >
 <Text className={`text-sm font-bold ${selectedBankAccountId === null ? "text-white" : "text-on-surface"}`}>
 Cash (no bank account)
 </Text>
 </Pressable>
 {bankAccounts.map((acc) => (
 <Pressable
 key={acc.id}
 onPress={() => setSelectedBankAccountId(acc.id)}
 className={`mr-2 px-4 py-3 rounded-xl border ${
 selectedBankAccountId === acc.id
 ? "bg-primary border-primary"
 : "bg-surface-container-lowest border-outline-variant"
 }`}
 >
 <Text className={`text-sm font-bold ${selectedBankAccountId === acc.id ? "text-white" : "text-on-surface"}`}>
 {acc.account_name}
 </Text>
 </Pressable>
 ))}
 <Pressable
 onPress={() => {
 setIsRecordingPayment(false);
 router.push("/bank-accounts" as any);
 }}
 className="mr-2 px-4 py-3 rounded-xl border border-dashed border-primary"
 >
 <Text className="text-sm font-bold text-primary">+ Add New</Text>
 </Pressable>
 </ScrollView>
 </View>

 <View className="mt-4">
 <Text className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider mb-2">
 Reference / Note
 </Text>
 <TextInput
 value={paymentReference}
 onChangeText={setPaymentReference}
 placeholder="e.g. Cash payment, Bank transfer, Invoice settlement"
 placeholderTextColor="#A0A0A0"
 className="bg-surface-container-lowest text-on-surface border border-outline-variant rounded-xl px-4 py-4 text-base font-medium"
 />
 </View>
 </View>

 {/* Form Actions */}
 <View className="flex-row justify-between mt-10">
 <Pressable
 onPress={closeRecordPayment}
 className="border border-outline-variant py-4 px-6 rounded-xl w-[48%] items-center"
 >
 <Text className="text-on-surface-variant font-bold text-base">Cancel</Text>
 </Pressable>
 <Pressable
 onPress={handleRecordPayment}
 disabled={paymentLoading}
 className="bg-primary py-4 px-6 rounded-xl w-[48%] items-center animate-pulse"
 >
 {paymentLoading ? (
 <ActivityIndicator color="white" />
 ) : (
 <Text className="text-white font-bold text-base">Record Payment</Text>
 )}
 </Pressable>
 </View>
 </ScrollView>
 </KeyboardAvoidingView>
 </SafeAreaProvider>
 </Modal>

 {/* Add Party Modal Form */}
 <Modal visible={isAddingParty || editingParty !== null} animationType="slide" onRequestClose={closePartyForm}>
 <SafeAreaProvider>
 <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : undefined}>
 <ScrollView className="flex-1 bg-background px-6 pb-10" keyboardShouldPersistTaps="handled" style={{ paddingTop: topInset }}>
 <View className="flex-row justify-between items-center mb-6">
 <Text className="text-2xl font-bold text-on-surface">
 {editingParty ? "Edit Party" : `Add New ${activeTab === "customer" ? "Customer" : "Supplier"}`}
 </Text>
 <Pressable onPress={closePartyForm} className="w-10 h-10 rounded-full bg-surface-container items-center justify-center">
 <MaterialCommunityIcons name="close" size={18} color="#3e4944" />
 </Pressable>
 </View>

 {/* Form fields */}
 <View className="space-y-4">
 <Text className="text-xs font-extrabold text-on-surface-variant uppercase tracking-widest">
 Basic Info
 </Text>
 <View>
 <Text className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider mb-2">
 Name *
 </Text>
 <TextInput
 value={newPartyName}
 onChangeText={setNewPartyName}
 placeholder="Business or Person Name"
 placeholderTextColor="#A0A0A0"
 className="bg-surface-container-lowest text-on-surface border border-outline-variant rounded-xl px-4 py-4 text-base font-medium"
 />
 </View>

 <View className="mt-4">
 <Text className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider mb-2">
 Phone Number
 </Text>
 <TextInput
 value={newPartyPhone}
 onChangeText={setNewPartyPhone}
 placeholder="10-digit mobile number"
 placeholderTextColor="#A0A0A0"
 keyboardType="phone-pad"
 className="bg-surface-container-lowest text-on-surface border border-outline-variant rounded-xl px-4 py-4 text-base font-medium"
 />
 </View>

 <View className="mt-4">
 <Text className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider mb-2">
 Party Category
 </Text>
 <View className="flex-row" style={{ gap: 8 }}>
 {(["b2c", "b2b"] as const).map((cat) => (
 <Pressable
 key={cat}
 onPress={() => setNewPartyCategory(cat)}
 className={`flex-1 py-3.5 rounded-xl border items-center ${
 newPartyCategory === cat
 ? "bg-primary border-primary"
 : "bg-surface-container-lowest border-outline-variant"
 }`}
 >
 <Text
 className={`text-sm font-bold uppercase ${
 newPartyCategory === cat
 ? "text-white"
 : "text-on-surface"
 }`}
 >
 {cat === "b2b" ? "B2B (Business)" : "B2C (Retail)"}
 </Text>
 </Pressable>
 ))}
 </View>
 </View>

 <Text className="text-xs font-extrabold text-on-surface-variant uppercase tracking-widest mt-6">
 Tax & Billing
 </Text>

 {newPartyCategory === "b2b" && (
 <View className="mt-4">
 <Text className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider mb-2">
 GSTIN *
 </Text>
 <TextInput
 value={newPartyGstin}
 onChangeText={(v) => setNewPartyGstin(v.toUpperCase())}
 placeholder="15-character GSTIN"
 placeholderTextColor="#A0A0A0"
 autoCapitalize="characters"
 maxLength={15}
 className="bg-surface-container-lowest text-on-surface border border-outline-variant rounded-xl px-4 py-4 text-base font-medium"
 />
 {gstinAutoFilled ? (
 <Text className="text-xs text-green-600 mt-1.5">
 ✓ Filled from an existing record with this GSTIN.
 </Text>
 ) : (
 <Text className="text-xs text-on-surface-variant mt-1.5">
 Required for a B2B account to issue a valid tax invoice.
 </Text>
 )}
 </View>
 )}

 {!editingParty && (
 <View className="mt-4">
 <Text className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider mb-2">
 State (For GST)
 </Text>
 <StatePicker value={newPartyState} onChange={setNewPartyState} />
 </View>
 )}

 <View className="mt-4">
 <Text className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider mb-2">
 Address
 </Text>
 <TextInput
 value={newPartyAddress}
 onChangeText={setNewPartyAddress}
 placeholder="Street, city, state, PIN code"
 placeholderTextColor="#A0A0A0"
 multiline
 numberOfLines={2}
 className="bg-surface-container-lowest text-on-surface border border-outline-variant rounded-xl px-4 py-4 text-base font-medium"
 />
 </View>

 <View className="mt-4">
 <Text className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider mb-2">
 PAN
 </Text>
 <TextInput
 value={newPartyPan}
 onChangeText={(v) => setNewPartyPan(v.toUpperCase())}
 placeholder="e.g. ABCDE1234F"
 placeholderTextColor="#A0A0A0"
 autoCapitalize="characters"
 maxLength={10}
 className="bg-surface-container-lowest text-on-surface border border-outline-variant rounded-xl px-4 py-4 text-base font-medium"
 />
 </View>

 <View className="mt-4">
 <Text className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider mb-2">
 Aadhaar
 </Text>
 <TextInput
 value={newPartyAadhaar}
 onChangeText={setNewPartyAadhaar}
 placeholder="12-digit Aadhaar number"
 placeholderTextColor="#A0A0A0"
 keyboardType="number-pad"
 maxLength={12}
 className="bg-surface-container-lowest text-on-surface border border-outline-variant rounded-xl px-4 py-4 text-base font-medium"
 />
 </View>

 <Text className="text-xs font-extrabold text-on-surface-variant uppercase tracking-widest mt-6">
 Credit Terms
 </Text>

 {!editingParty && (
 <View className="mt-4">
 <Text className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider mb-2">
 Opening Balance (INR)
 </Text>
 <Text className="text-xs text-on-surface-variant mb-2">
 {activeTab === "customer"
 ? "Positive means they owe you (Receivable). Negative means you owe them."
 : "Positive means you owe them (Payable). Negative means they owe you."}
 </Text>
 <TextInput
 value={newPartyBalance}
 onChangeText={setNewPartyBalance}
 placeholder="0.00"
 placeholderTextColor="#A0A0A0"
 keyboardType="numeric"
 className="bg-surface-container-lowest text-on-surface border border-outline-variant rounded-xl px-4 py-4 text-base font-medium"
 />
 </View>
 )}
 <View className="mt-4">
 <Text className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider mb-2">
 Credit Limit (INR)
 </Text>
 <Text className="text-xs text-on-surface-variant mb-2">Leave empty for unlimited credit</Text>
 <TextInput
 value={newPartyCreditLimit}
 onChangeText={setNewPartyCreditLimit}
 placeholder="Unlimited"
 placeholderTextColor="#A0A0A0"
 keyboardType="numeric"
 className="bg-surface-container-lowest text-on-surface border border-outline-variant rounded-xl px-4 py-4 text-base font-medium"
 />
 </View>
 </View>

 {/* Form Actions */}
 <View className="flex-row justify-between mt-8" style={{ marginBottom: bottomInset }}>
 <Pressable
 onPress={closePartyForm}
 className="border border-outline-variant py-4 px-6 rounded-xl w-[48%] items-center"
 >
 <Text className="text-on-surface-variant font-bold text-base">Cancel</Text>
 </Pressable>
 <Pressable
 onPress={handleAddParty}
 disabled={addPartyLoading}
 className="bg-primary py-4 px-6 rounded-xl w-[48%] items-center"
 >
 {addPartyLoading ? (
 <ActivityIndicator color="white" />
 ) : (
 <Text className="text-white font-bold text-base">
 {editingParty ? "Save Changes" : `Save ${activeTab === "customer" ? "Customer" : "Supplier"}`}
 </Text>
 )}
 </Pressable>
 </View>
 </ScrollView>
 </KeyboardAvoidingView>
 </SafeAreaProvider>
 </Modal>
 </View>
 );
}
