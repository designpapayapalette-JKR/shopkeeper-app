import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  Pressable,
  Alert,
  TextInput,
  Modal,
  ScrollView,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { api, ApiError } from "../src/lib/api";
import { useConfirm } from "../src/components/ConfirmDialog";
import { useTopInset } from "../src/lib/useTopInset";
import { useBottomInset } from "../src/lib/useBottomInset";
import BulkUploadCard from "../src/components/BulkUploadCard";

export interface BankAccount {
  id: string;
  account_name: string;
  bank_name?: string;
  account_number?: string;
  ifsc?: string;
  opening_balance: string;
  current_balance: string;
}

export default function BankAccountsScreen() {
  const topInset = useTopInset();
  const bottomInset = useBottomInset();
  const confirm = useConfirm();
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);

  const [name, setName] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [ifsc, setIfsc] = useState("");
  const [openingBalance, setOpeningBalance] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: BankAccount[] }>("/bank-accounts");
      setAccounts(res.data ?? []);
    } catch (e) {
      console.error("Failed to load bank accounts:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const resetAddForm = () => {
    setName("");
    setBankName("");
    setAccountNumber("");
    setIfsc("");
    setOpeningBalance("");
  };

  const closeAdd = async () => {
    const hasChanges =
      name.trim() !== "" ||
      bankName.trim() !== "" ||
      accountNumber.trim() !== "" ||
      ifsc.trim() !== "" ||
      openingBalance.trim() !== "";
    if (hasChanges) {
      const ok = await confirm({
        title: "Discard changes?",
        message: "You have unsaved changes. Are you sure you want to go back?",
        confirmLabel: "Discard",
        destructive: true,
      });
      if (!ok) return;
    }
    setIsAdding(false);
    resetAddForm();
  };

  const handleAdd = async () => {
    if (!name.trim()) {
      Alert.alert("Required Field", "Account name is required.");
      return;
    }
    setSubmitting(true);
    try {
      const balance = parseFloat(openingBalance || "0");
      await api.post("/bank-accounts", {
        account_name: name.trim(),
        bank_name: bankName.trim() || undefined,
        account_number: accountNumber.trim() || undefined,
        ifsc: ifsc.trim() || undefined,
        opening_balance: balance,
        current_balance: balance,
      });
      Alert.alert("Success", "Bank account added.");
      setIsAdding(false);
      resetAddForm();
      load();
    } catch (e) {
      Alert.alert("Error", e instanceof ApiError ? e.message : "Failed to add bank account.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (account: BankAccount) => {
    const ok = await confirm({
      title: "Delete this bank account?",
      message: `"${account.account_name}" will be removed. Past payments recorded against it stay on record.`,
      confirmLabel: "Delete",
    });
    if (!ok) return;
    setDeletingId(account.id);
    try {
      await api.delete(`/bank-accounts/${account.id}`);
      load();
    } catch (e) {
      Alert.alert("Error", "Failed to delete bank account.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <View className="flex-1 bg-background dark:bg-bg-dark">
      <View
        className="bg-surface-container-lowest dark:bg-surface-dark border-b border-outline-variant dark:border-outline px-margin-mobile pb-3 flex-row justify-between items-center"
        style={{ paddingTop: topInset }}
      >
        <Text className="text-2xl font-bold text-on-surface dark:text-text-primary-dark">
          Bank Accounts
        </Text>
        <View className="flex-row" style={{ gap: 8 }}>
          <Pressable
            onPress={() => setIsBulkImportOpen(true)}
            className="bg-surface-container-lowest dark:bg-surface-dark border border-outline-variant dark:border-outline px-3 py-2.5 rounded-xl items-center justify-center"
          >
            <MaterialCommunityIcons name="tray-arrow-up" size={18} color="#0F7A5F" />
          </Pressable>
          <Pressable
            onPress={() => setIsAdding(true)}
            className="bg-primary dark:bg-primary-dark px-4 py-2.5 rounded-xl flex-row items-center"
            style={{ gap: 4 }}
          >
            <MaterialCommunityIcons name="plus" size={16} color="white" />
            <Text className="text-white font-bold text-sm">Add</Text>
          </Pressable>
        </View>
      </View>

      {loading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#0F7A5F" />
        </View>
      ) : accounts.length === 0 ? (
        <View className="flex-1 justify-center items-center py-20 px-6">
          <Text className="text-on-surface-variant dark:text-text-secondary-dark font-bold text-base text-center">
            No bank accounts yet. Add one to track which account payments are credited or debited from.
          </Text>
        </View>
      ) : (
        <FlatList
          data={accounts}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          renderItem={({ item }) => (
            <View className="bg-surface dark:bg-surface-dark p-4 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm flex-row justify-between items-center">
              <View className="flex-1 mr-2">
                <Text className="font-bold text-base text-text-primary dark:text-text-primary-dark">
                  {item.account_name}
                </Text>
                <Text className="text-sm text-text-secondary mt-1">
                  {item.bank_name || "—"} {item.account_number ? `· ${item.account_number}` : ""}
                </Text>
              </View>
              <View className="items-end">
                <Text className="text-base font-black text-text-primary dark:text-text-primary-dark">
                  ₹{parseFloat(item.current_balance).toFixed(2)}
                </Text>
                <Pressable onPress={() => handleDelete(item)} disabled={deletingId === item.id} className="mt-1.5">
                  {deletingId === item.id ? (
                    <ActivityIndicator size="small" color="#D64545" />
                  ) : (
                    <Text className="text-sm text-error font-bold">Delete</Text>
                  )}
                </Pressable>
              </View>
            </View>
          )}
        />
      )}

      <Modal visible={isAdding} animationType="slide" onRequestClose={closeAdd}>
        <ScrollView className="flex-1 bg-background dark:bg-bg-dark px-6 pb-10" style={{ paddingTop: topInset }}>
          <View className="flex-row justify-between items-center mb-6">
            <Text className="text-2xl font-bold text-on-surface dark:text-text-primary-dark">Add Bank Account</Text>
            <Pressable onPress={closeAdd} className="w-11 h-11 items-center justify-center">
              <MaterialCommunityIcons name="close" size={20} color="#6B7280" />
            </Pressable>
          </View>

          {[
            { label: "Account Name *", value: name, setter: setName, placeholder: "e.g. HDFC Current Account" },
            { label: "Bank Name", value: bankName, setter: setBankName, placeholder: "e.g. HDFC Bank" },
            { label: "Account Number", value: accountNumber, setter: setAccountNumber, placeholder: "Account number" },
            { label: "IFSC", value: ifsc, setter: setIfsc, placeholder: "IFSC code" },
          ].map((field) => (
            <View className="mb-4" key={field.label}>
              <Text className="text-sm font-semibold text-on-surface-variant dark:text-text-secondary-dark uppercase tracking-wider mb-2">
                {field.label}
              </Text>
              <TextInput
                value={field.value}
                onChangeText={field.setter}
                placeholder={field.placeholder}
                placeholderTextColor="#A0A0A0"
                className="bg-surface-container-lowest dark:bg-surface-dark text-on-surface dark:text-text-primary-dark border border-outline-variant dark:border-outline rounded-xl px-4 py-4 text-base font-medium"
              />
            </View>
          ))}

          <View className="mb-8">
            <Text className="text-sm font-semibold text-on-surface-variant dark:text-text-secondary-dark uppercase tracking-wider mb-2">
              Opening Balance (INR)
            </Text>
            <TextInput
              value={openingBalance}
              onChangeText={setOpeningBalance}
              placeholder="0.00"
              keyboardType="numeric"
              className="bg-surface-container-lowest dark:bg-surface-dark text-on-surface dark:text-text-primary-dark border border-outline-variant dark:border-outline rounded-xl px-4 py-4 text-base font-medium"
            />
          </View>

          <Pressable onPress={handleAdd} disabled={submitting} className="bg-primary dark:bg-primary-dark py-4 rounded-xl items-center" style={{ marginBottom: bottomInset }}>
            {submitting ? <ActivityIndicator color="white" /> : <Text className="text-white font-bold text-base">Save Account</Text>}
          </Pressable>
        </ScrollView>
      </Modal>

      <Modal visible={isBulkImportOpen} animationType="slide" onRequestClose={() => setIsBulkImportOpen(false)}>
        <View className="flex-1 bg-background dark:bg-bg-dark px-6" style={{ paddingTop: topInset }}>
          <View className="flex-row justify-between items-center mb-6">
            <Text className="text-2xl font-bold text-on-surface dark:text-text-primary-dark">
              Bulk Import Bank Accounts
            </Text>
            <Pressable onPress={() => setIsBulkImportOpen(false)} className="w-11 h-11 items-center justify-center">
              <MaterialCommunityIcons name="close" size={20} color="#6B7280" />
            </Pressable>
          </View>
          <BulkUploadCard
            entityLabel="Bank Accounts"
            columns={[
              { header: "account_name", example: "HDFC Current Account", required: true },
              { header: "bank_name", example: "HDFC Bank", required: false },
              { header: "account_number", example: "50100123456789", required: false },
              { header: "ifsc", example: "HDFC0001234", required: false },
              { header: "opening_balance", example: "0", required: false },
            ]}
            mapRowToPayload={(row) => {
              if (!row.account_name?.trim()) return null;
              const balance = row.opening_balance ? parseFloat(row.opening_balance) : 0;
              return {
                account_name: row.account_name.trim(),
                bank_name: row.bank_name?.trim() || undefined,
                account_number: row.account_number?.trim() || undefined,
                ifsc: row.ifsc?.trim() || undefined,
                opening_balance: balance,
                current_balance: balance,
              };
            }}
            createOne={async (payload) => {
              await api.post("/bank-accounts", payload);
            }}
            onComplete={load}
          />
        </View>
      </Modal>
    </View>
  );
}

