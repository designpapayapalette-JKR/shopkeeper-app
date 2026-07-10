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
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useAuth } from "../../src/lib/auth-context";
import { api, ApiError } from "../../src/lib/api";
import { useConfirm } from "../../src/components/ConfirmDialog";
import { useTopInset } from "../../src/lib/useTopInset";
import { useBottomInset } from "../../src/lib/useBottomInset";
import { getAvatarColor, getInitial } from "../../src/lib/avatarColor";
import BulkUploadCard from "../../src/components/BulkUploadCard";
import type { BankAccount } from "../bank-accounts";
import { useTerminology } from "../../src/lib/terminology-context";

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
  const { user } = useAuth();
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

  // Add Party Modal State
  const [isAddingParty, setIsAddingParty] = useState(false);
  const [editingParty, setEditingParty] = useState<Party | null>(null);
  const [newPartyName, setNewPartyName] = useState("");
  const [newPartyPhone, setNewPartyPhone] = useState("");
  const [newPartyState, setNewPartyState] = useState("");
  const [newPartyGstin, setNewPartyGstin] = useState("");
  const [newPartyCategory, setNewPartyCategory] = useState<"b2b" | "b2c">("b2c");
  const [newPartyBalance, setNewPartyBalance] = useState("");
  const [newPartyCreditLimit, setNewPartyCreditLimit] = useState("");
  const [addPartyLoading, setAddPartyLoading] = useState(false);

  // Record Payment Modal State
  const [isRecordingPayment, setIsRecordingPayment] = useState(false);
  const [paymentType, setPaymentType] = useState<"debit" | "credit">("credit"); // credit = payment received (reduces customer balance), debit = payment paid (reduces supplier balance)
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [selectedBankAccountId, setSelectedBankAccountId] = useState<string | null>(null);

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
    setIsRecordingPayment(true);
    try {
      const res = await api.get<{ data: BankAccount[] }>("/bank-accounts");
      setBankAccounts(res.data ?? []);
    } catch (e) {
      console.error("Failed to load bank accounts:", e);
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
    setNewPartyCategory("b2c");
    setNewPartyBalance("");
  };

  const handleOpenEditParty = (party: Party) => {
    setEditingParty(party);
    setNewPartyName(party.name);
    setNewPartyPhone(party.phone || "");
    setNewPartyGstin(party.gstin || "");
    setNewPartyCategory(party.category || "b2c");
    setNewPartyState("");
  };

  const closePartyForm = async () => {
    const hasChanges = editingParty
      ? newPartyName !== editingParty.name ||
        newPartyPhone !== (editingParty.phone || "") ||
        newPartyGstin !== (editingParty.gstin || "") ||
        newPartyCategory !== (editingParty.category || "b2c")
      : newPartyName.trim() !== "" ||
        newPartyPhone.trim() !== "" ||
        newPartyState.trim() !== "" ||
        newPartyGstin.trim() !== "" ||
        newPartyBalance.trim() !== "" ||
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
          ? `"${party.name}" has an outstanding balance of ₹${Math.abs(balance).toFixed(2)}. It will be moved to the Recycle Bin, not permanently erased — you can restore it from More > Recycle Bin.`
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
    const balStr = Math.abs(balance).toFixed(2);

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
    <View className="flex-1 bg-background dark:bg-bg-dark px-6" style={{ paddingTop: topInset }}>
      {/* Header */}
      <View className="mb-6 flex-row items-center justify-between">
        <View>
          <Text className="text-2xl font-bold text-on-surface dark:text-text-primary-dark">
            {activeTab === "customer" ? t("receivables") : t("payables")}
          </Text>
          <Text className="text-sm text-on-surface-variant dark:text-text-secondary-dark font-medium mt-0.5">
            Manage credit ledgers and outstanding balances
          </Text>
        </View>
        <Pressable
          onPress={() => router.push("/unified-ledger" as any)}
          className="flex-row items-center bg-surface-container-lowest dark:bg-surface-dark border border-outline-variant dark:border-outline px-3.5 py-2.5 rounded-xl"
          style={{ gap: 6 }}
        >
          <MaterialCommunityIcons name="view-list-outline" size={16} color="#0F7A5F" />
          <Text className="text-sm font-bold text-primary dark:text-primary-dark">All Ledger</Text>
        </Pressable>
      </View>

      {/* Tabs */}
      <View className="flex-row bg-surface-container-lowest dark:bg-surface-dark border border-gray-150 dark:border-zinc-800 p-1.5 rounded-full mb-6">
        <Pressable
          onPress={() => {
            setActiveTab("customer");
            setSelectedParty(null);
          }}
          className={`flex-1 py-3.5 rounded-full items-center ${
            activeTab === "customer" ? "bg-primary dark:bg-primary-dark" : "bg-transparent"
          }`}
        >
          <Text
            className={`text-base font-bold ${
              activeTab === "customer" ? "text-white" : "text-on-surface-variant dark:text-text-secondary-dark"
            }`}
          >
            Customers
          </Text>
        </Pressable>
        <Pressable
          onPress={() => {
            setActiveTab("supplier");
            setSelectedParty(null);
          }}
          className={`flex-1 py-3.5 rounded-full items-center ${
            activeTab === "supplier" ? "bg-primary dark:bg-primary-dark" : "bg-transparent"
          }`}
        >
          <Text
            className={`text-base font-bold ${
              activeTab === "supplier" ? "text-white" : "text-on-surface-variant dark:text-text-secondary-dark"
            }`}
          >
            Suppliers
          </Text>
        </Pressable>
      </View>

      {/* Search */}
      <View className="bg-surface-container-lowest dark:bg-surface-dark border border-outline-variant dark:border-outline rounded-xl px-4 py-4 mb-6">
        <TextInput
          placeholder={`Search ${activeTab}s...`}
          placeholderTextColor="#A0A0A0"
          value={search}
          onChangeText={setSearch}
          className="text-base font-medium text-on-surface dark:text-text-primary-dark"
        />
      </View>

      {/* List */}
      {loading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#0F7A5F" />
        </View>
      ) : filteredParties.length === 0 ? (
        <View className="flex-1 justify-center items-center py-20">
          <Text className="text-on-surface-variant dark:text-text-secondary-dark font-bold text-base text-center">
            No {activeTab}s found
          </Text>
        </View>
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
            const amountColor = owed ? (isReceivable ? "text-success" : "text-error") : "text-on-surface-variant dark:text-text-secondary-dark";
            const avatarColor = getAvatarColor(item.name);

            return (
              <Pressable
                onPress={() => handleSelectParty(item)}
                className="bg-surface-container-lowest dark:bg-surface-dark p-4 rounded-2xl border border-outline-variant dark:border-outline shadow-sm mb-3 flex-row items-center active:bg-gray-50 dark:active:bg-zinc-800"
              >
                <View
                  className="w-11 h-11 rounded-xl items-center justify-center mr-3"
                  style={{ backgroundColor: avatarColor.bg }}
                >
                  <Text className="font-black text-base" style={{ color: avatarColor.text }}>
                    {getInitial(item.name)}
                  </Text>
                </View>
                <View className="flex-1 mr-2">
                  <Text className="font-bold text-base text-on-surface dark:text-text-primary-dark" numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text className="text-sm text-on-surface-variant dark:text-text-secondary-dark mt-0.5">
                    {item.phone || "No phone"}
                  </Text>
                  {item.phone && bal !== 0 && (
                    <Pressable
                      onPress={(e) => {
                        e.stopPropagation();
                        handleSendReminder(item);
                      }}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      className="flex-row items-center mt-1"
                      style={{ gap: 4 }}
                    >
                      <MaterialCommunityIcons name="whatsapp" size={13} color="#128C7E" />
                      <Text className="text-sm font-bold text-[#128C7E] dark:text-[#25D366]">Send Reminder</Text>
                    </Pressable>
                  )}
                </View>
                <View className="items-end">
                  <View className="flex-row items-center" style={{ gap: 3 }}>
                    <MaterialCommunityIcons
                      name={owed ? "arrow-down-bold" : "arrow-up-bold"}
                      size={13}
                      color={owed ? (isReceivable ? "#2E9E5B" : "#D64545") : "#9E9E9E"}
                    />
                    <Text className={`text-base font-black ${amountColor}`}>
                      ₹{Math.abs(bal).toFixed(2)}
                    </Text>
                  </View>
                  <View className="flex-row items-center mt-2" style={{ gap: 6 }}>
                    <Pressable
                      onPress={(e) => {
                        e.stopPropagation();
                        handleOpenEditParty(item);
                      }}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      className="w-7 h-7 rounded-lg bg-surface-container dark:bg-zinc-800 items-center justify-center"
                    >
                      <MaterialCommunityIcons name="pencil-outline" size={14} color="#6B7280" />
                    </Pressable>
                    <Pressable
                      onPress={() => handleSelectParty(item)}
                      className="flex-row items-center bg-primary/10 px-2.5 py-1.5 rounded-lg"
                      style={{ gap: 3 }}
                    >
                      <MaterialCommunityIcons name="book-account-outline" size={13} color="#0F7A5F" />
                      <Text className="text-xs font-bold text-primary dark:text-primary-dark">Ledger</Text>
                    </Pressable>
                  </View>
                </View>
              </Pressable>
            );
          }}
        />
      )}

      {/* Bottom Action Bar */}
      <View
        className="absolute bottom-0 left-0 right-0 bg-background dark:bg-bg-dark border-t border-outline-variant dark:border-outline px-6 pt-3 flex-row"
        style={{ paddingBottom: bottomInset, gap: 10 }}
      >
        <Pressable
          onPress={() => setIsBulkImportOpen(true)}
          className="bg-surface-container-lowest dark:bg-surface-dark border border-outline-variant dark:border-outline px-5 py-4 rounded-2xl items-center justify-center"
        >
          <MaterialCommunityIcons name="tray-arrow-up" size={20} color="#0F7A5F" />
        </Pressable>
        <Pressable
          onPress={() => setIsAddingParty(true)}
          className="flex-1 bg-primary dark:bg-primary-dark py-4 rounded-2xl items-center justify-center flex-row shadow-sm active:opacity-90"
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
        <View className="flex-1 bg-background dark:bg-bg-dark px-6" style={{ paddingTop: topInset }}>
          <View className="flex-row justify-between items-center mb-6">
            <Text className="text-2xl font-bold text-on-surface dark:text-text-primary-dark">
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
      </Modal>

      {/* Detailed Ledger Entries Modal */}
      {selectedParty && (
        <Modal visible={selectedParty !== null} animationType="slide" onRequestClose={() => setSelectedParty(null)}>
          <View className="flex-1 bg-background dark:bg-bg-dark px-6" style={{ paddingTop: topInset }}>
            <View className="flex-row justify-between items-center mb-6">
              <View>
                <Text className="text-xl font-extrabold text-on-surface dark:text-text-primary-dark">
                  {selectedParty.name}
                </Text>
                <Text className="text-sm text-on-surface-variant dark:text-text-secondary-dark font-bold mt-0.5 uppercase tracking-wider">
                  {selectedParty.type} Ledger History
                </Text>
              </View>
              <View className="flex-row items-center" style={{ gap: 4 }}>
                <Pressable
                  onPress={() => handleOpenEditParty(selectedParty)}
                  className="w-11 h-11 items-center justify-center"
                >
                  <MaterialCommunityIcons name="pencil-outline" size={20} color="#6B7280" />
                </Pressable>
                <Pressable
                  onPress={() => handleDeleteParty(selectedParty)}
                  disabled={deletingPartyId === selectedParty.id}
                  className="w-11 h-11 items-center justify-center"
                >
                  {deletingPartyId === selectedParty.id ? (
                    <ActivityIndicator size="small" color="#D64545" />
                  ) : (
                    <MaterialCommunityIcons name="trash-can-outline" size={20} color="#D64545" />
                  )}
                </Pressable>
                <Pressable onPress={() => setSelectedParty(null)} className="w-11 h-11 items-center justify-center">
                  <MaterialCommunityIcons name="close" size={20} color="#3e4944" />
                </Pressable>
              </View>
            </View>

            {/* Quick Balances info */}
            <View className="bg-surface-container-lowest dark:bg-surface-dark p-5 rounded-3xl border border-outline-variant dark:border-outline mb-6 shadow-sm">
              <View className="flex-row justify-between items-center mb-4">
                <View>
                  <Text className="text-sm font-semibold text-on-surface-variant dark:text-text-secondary-dark uppercase tracking-wider">
                    Outstanding Balance
                  </Text>
                  <Text className="text-2xl font-black text-primary dark:text-primary-dark mt-1">
                    ₹{parseFloat(selectedParty.current_balance || "0").toFixed(2)}
                  </Text>
                </View>
                <Pressable
                  onPress={() => {
                    setPaymentType(selectedParty.type === "customer" ? "credit" : "debit");
                    openRecordPayment();
                  }}
                  className="bg-primary dark:bg-primary-dark px-5 py-3.5 rounded-xl active:opacity-90 shadow-sm"
                >
                  <Text className="text-white font-bold text-base">Record Payment</Text>
                </Pressable>
              </View>
              {selectedParty.phone && (
                <Pressable
                  onPress={() => handleSendReminder()}
                  className="bg-[#25D366]/10 py-3 rounded-xl flex-row items-center justify-center border border-[#25D366]/20"
                  style={{ gap: 8 }}
                >
                  <MaterialCommunityIcons name="whatsapp" size={18} color="#128C7E" />
                  <Text className="text-[#128C7E] dark:text-[#25D366] font-bold text-base">Send WhatsApp Reminder</Text>
                </Pressable>
              )}
            </View>

            {/* Entries timeline */}
            {entriesLoading ? (
              <View className="flex-grow justify-center items-center py-20">
                <ActivityIndicator size="large" color="#0F7A5F" />
              </View>
            ) : ledgerEntries.length === 0 ? (
              <View className="flex-grow justify-center items-center py-20">
                <Text className="text-on-surface-variant dark:text-text-secondary-dark font-bold text-base text-center">
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
                      className="bg-surface-container-lowest dark:bg-surface-dark p-4 rounded-2xl border border-outline-variant dark:border-outline mb-3.5 shadow-sm active:opacity-70"
                    >
                      <View className="flex-row justify-between items-start">
                        <View className="flex-1 mr-2">
                          <Text className="font-bold text-base text-on-surface dark:text-text-primary-dark">
                            {item.reference || "Ledger Entry"}
                          </Text>
                          <Text className="text-sm text-on-surface-variant dark:text-text-secondary-dark mt-1">
                            Date: {item.date}
                          </Text>
                          {isLinked && (
                            <Text className="text-xs font-bold text-primary dark:text-primary-dark mt-1">
                              Tap to view {linkedInvoiceId ? "invoice" : "purchase"} →
                            </Text>
                          )}
                        </View>
                        <View className="items-end">
                          <Text className={`text-lg ${indicatorColor}`}>
                            {isDebit ? "+" : "-"} ₹{parseFloat(item.amount).toFixed(2)}
                          </Text>
                          <Text className="text-sm font-bold text-on-surface-variant dark:text-text-secondary-dark mt-1 uppercase tracking-widest">
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
        </Modal>
      )}

      {/* Record Payment Form Modal */}
      <Modal visible={isRecordingPayment} animationType="slide" onRequestClose={closeRecordPayment}>
        <View className="flex-1 bg-background dark:bg-bg-dark px-6" style={{ paddingTop: topInset }}>
          <View className="flex-row justify-between items-center mb-6">
            <Text className="text-2xl font-bold text-on-surface dark:text-text-primary-dark">
              Record Payment
            </Text>
            <Pressable onPress={closeRecordPayment} className="w-11 h-11 items-center justify-center">
              <MaterialCommunityIcons name="close" size={20} color="#6B7280" />
            </Pressable>
          </View>

          {/* Form */}
          <View className="space-y-4">
            <View>
              <Text className="text-sm font-semibold text-on-surface-variant dark:text-text-secondary-dark uppercase tracking-wider mb-2">
                Transaction Type
              </Text>

              {/* Type Switcher */}
              <View className="flex-row bg-surface-container-lowest dark:bg-surface-dark border border-gray-150 dark:border-zinc-800 p-1 rounded-xl">
                <Pressable
                  onPress={() => setPaymentType("credit")}
                  className={`flex-1 py-3.5 rounded-lg items-center ${
                    paymentType === "credit" ? "bg-primary dark:bg-primary-dark" : "bg-transparent"
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
                    paymentType === "debit" ? "bg-primary dark:bg-primary-dark" : "bg-transparent"
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
              <Text className="text-sm font-semibold text-on-surface-variant dark:text-text-secondary-dark uppercase tracking-wider mb-2">
                Amount (INR) *
              </Text>
              <TextInput
                value={paymentAmount}
                onChangeText={setPaymentAmount}
                placeholder="0.00"
                placeholderTextColor="#A0A0A0"
                keyboardType="numeric"
                className="bg-surface-container-lowest dark:bg-surface-dark text-on-surface dark:text-text-primary-dark border border-outline-variant dark:border-outline rounded-xl px-4 py-4 font-bold text-lg"
              />
            </View>

            <View className="mt-4">
              <Text className="text-sm font-semibold text-on-surface-variant dark:text-text-secondary-dark uppercase tracking-wider mb-2">
                Credited / Debited Account
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
                <Pressable
                  onPress={() => setSelectedBankAccountId(null)}
                  className={`mr-2 px-4 py-3 rounded-xl border ${
                    selectedBankAccountId === null
                      ? "bg-primary border-primary dark:bg-primary-dark"
                      : "bg-surface-container-lowest dark:bg-surface-dark border-outline-variant dark:border-outline"
                  }`}
                >
                  <Text className={`text-sm font-bold ${selectedBankAccountId === null ? "text-white" : "text-on-surface dark:text-text-primary-dark"}`}>
                    Cash (no bank account)
                  </Text>
                </Pressable>
                {bankAccounts.map((acc) => (
                  <Pressable
                    key={acc.id}
                    onPress={() => setSelectedBankAccountId(acc.id)}
                    className={`mr-2 px-4 py-3 rounded-xl border ${
                      selectedBankAccountId === acc.id
                        ? "bg-primary border-primary dark:bg-primary-dark"
                        : "bg-surface-container-lowest dark:bg-surface-dark border-outline-variant dark:border-outline"
                    }`}
                  >
                    <Text className={`text-sm font-bold ${selectedBankAccountId === acc.id ? "text-white" : "text-on-surface dark:text-text-primary-dark"}`}>
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
              <Text className="text-sm font-semibold text-on-surface-variant dark:text-text-secondary-dark uppercase tracking-wider mb-2">
                Reference / Note
              </Text>
              <TextInput
                value={paymentReference}
                onChangeText={setPaymentReference}
                placeholder="e.g. Cash payment, Bank transfer, Invoice settlement"
                placeholderTextColor="#A0A0A0"
                className="bg-surface-container-lowest dark:bg-surface-dark text-on-surface dark:text-text-primary-dark border border-outline-variant dark:border-outline rounded-xl px-4 py-4 text-base font-medium"
              />
            </View>
          </View>

          {/* Form Actions */}
          <View className="flex-row justify-between mt-10">
            <Pressable
              onPress={closeRecordPayment}
              className="border border-outline-variant dark:border-outline py-4 px-6 rounded-xl w-[48%] items-center"
            >
              <Text className="text-on-surface-variant dark:text-text-secondary-dark font-bold text-base">Cancel</Text>
            </Pressable>
            <Pressable
              onPress={handleRecordPayment}
              disabled={paymentLoading}
              className="bg-primary dark:bg-primary-dark py-4 px-6 rounded-xl w-[48%] items-center animate-pulse"
            >
              {paymentLoading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white font-bold text-base">Record Payment</Text>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Add Party Modal Form */}
      <Modal visible={isAddingParty || editingParty !== null} animationType="slide" onRequestClose={closePartyForm}>
        <ScrollView className="flex-1 bg-background dark:bg-bg-dark px-6 pb-10" keyboardShouldPersistTaps="handled" style={{ paddingTop: topInset }}>
          <View className="flex-row justify-between items-center mb-6">
            <Text className="text-2xl font-bold text-on-surface dark:text-text-primary-dark">
              {editingParty ? "Edit Party" : `Add New ${activeTab === "customer" ? "Customer" : "Supplier"}`}
            </Text>
            <Pressable onPress={closePartyForm} className="w-10 h-10 rounded-full bg-surface-container dark:bg-surface-dark items-center justify-center">
              <MaterialCommunityIcons name="close" size={18} color="#3e4944" />
            </Pressable>
          </View>

          {/* Form fields */}
          <View className="space-y-4">
            <View>
              <Text className="text-sm font-semibold text-on-surface-variant dark:text-text-secondary-dark uppercase tracking-wider mb-2">
                Name *
              </Text>
              <TextInput
                value={newPartyName}
                onChangeText={setNewPartyName}
                placeholder="Business or Person Name"
                placeholderTextColor="#A0A0A0"
                className="bg-surface-container-lowest dark:bg-surface-dark text-on-surface dark:text-text-primary-dark border border-outline-variant dark:border-outline rounded-xl px-4 py-4 text-base font-medium"
              />
            </View>

            <View className="mt-4">
              <Text className="text-sm font-semibold text-on-surface-variant dark:text-text-secondary-dark uppercase tracking-wider mb-2">
                Phone Number
              </Text>
              <TextInput
                value={newPartyPhone}
                onChangeText={setNewPartyPhone}
                placeholder="10-digit mobile number"
                placeholderTextColor="#A0A0A0"
                keyboardType="phone-pad"
                className="bg-surface-container-lowest dark:bg-surface-dark text-on-surface dark:text-text-primary-dark border border-outline-variant dark:border-outline rounded-xl px-4 py-4 text-base font-medium"
              />
            </View>

            {!editingParty && (
              <View className="mt-4">
                <Text className="text-sm font-semibold text-on-surface-variant dark:text-text-secondary-dark uppercase tracking-wider mb-2">
                  State (For GST)
                </Text>
                <TextInput
                  value={newPartyState}
                  onChangeText={setNewPartyState}
                  placeholder="e.g. Maharashtra"
                  placeholderTextColor="#A0A0A0"
                  className="bg-surface-container-lowest dark:bg-surface-dark text-on-surface dark:text-text-primary-dark border border-outline-variant dark:border-outline rounded-xl px-4 py-4 text-base font-medium"
                />
              </View>
            )}

            <View className="mt-4">
              <Text className="text-sm font-semibold text-on-surface-variant dark:text-text-secondary-dark uppercase tracking-wider mb-2">
                Party Category
              </Text>
              <View className="flex-row" style={{ gap: 8 }}>
                {(["b2c", "b2b"] as const).map((cat) => (
                  <Pressable
                    key={cat}
                    onPress={() => setNewPartyCategory(cat)}
                    className={`flex-1 py-3.5 rounded-xl border items-center ${
                      newPartyCategory === cat
                        ? "bg-primary border-primary dark:bg-primary-dark"
                        : "bg-surface-container-lowest dark:bg-surface-dark border-outline-variant dark:border-outline"
                    }`}
                  >
                    <Text
                      className={`text-sm font-bold uppercase ${
                        newPartyCategory === cat
                          ? "text-white"
                          : "text-on-surface dark:text-text-primary-dark"
                      }`}
                    >
                      {cat === "b2b" ? "B2B (Business)" : "B2C (Retail)"}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {newPartyCategory === "b2b" && (
              <View className="mt-4">
                <Text className="text-sm font-semibold text-on-surface-variant dark:text-text-secondary-dark uppercase tracking-wider mb-2">
                  GSTIN
                </Text>
                <TextInput
                  value={newPartyGstin}
                  onChangeText={(v) => setNewPartyGstin(v.toUpperCase())}
                  placeholder="15-character GSTIN"
                  placeholderTextColor="#A0A0A0"
                  autoCapitalize="characters"
                  maxLength={15}
                  className="bg-surface-container-lowest dark:bg-surface-dark text-on-surface dark:text-text-primary-dark border border-outline-variant dark:border-outline rounded-xl px-4 py-4 text-base font-medium"
                />
              </View>
            )}

            {!editingParty && (
              <View className="mt-4">
                <Text className="text-sm font-semibold text-on-surface-variant dark:text-text-secondary-dark uppercase tracking-wider mb-2">
                  Opening Balance (INR)
                </Text>
                <Text className="text-xs text-on-surface-variant dark:text-text-secondary-dark mb-2">
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
                  className="bg-surface-container-lowest dark:bg-surface-dark text-on-surface dark:text-text-primary-dark border border-outline-variant dark:border-outline rounded-xl px-4 py-4 text-base font-medium"
                />
              </View>
            )}
            <View className="mt-4">
              <Text className="text-sm font-semibold text-on-surface-variant dark:text-text-secondary-dark uppercase tracking-wider mb-2">
                Credit Limit (INR)
              </Text>
              <Text className="text-xs text-on-surface-variant dark:text-text-secondary-dark mb-2">Leave empty for unlimited credit</Text>
              <TextInput
                value={newPartyCreditLimit}
                onChangeText={setNewPartyCreditLimit}
                placeholder="Unlimited"
                placeholderTextColor="#A0A0A0"
                keyboardType="numeric"
                className="bg-surface-container-lowest dark:bg-surface-dark text-on-surface dark:text-text-primary-dark border border-outline-variant dark:border-outline rounded-xl px-4 py-4 text-base font-medium"
              />
            </View>
          </View>

          {/* Form Actions */}
          <View className="flex-row justify-between mt-8" style={{ marginBottom: bottomInset }}>
            <Pressable
              onPress={closePartyForm}
              className="border border-outline-variant dark:border-outline py-4 px-6 rounded-xl w-[48%] items-center"
            >
              <Text className="text-on-surface-variant dark:text-text-secondary-dark font-bold text-base">Cancel</Text>
            </Pressable>
            <Pressable
              onPress={handleAddParty}
              disabled={addPartyLoading}
              className="bg-primary dark:bg-primary-dark py-4 px-6 rounded-xl w-[48%] items-center"
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
      </Modal>
    </View>
  );
}
