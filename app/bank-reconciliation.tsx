import React, { useState, useEffect, useCallback } from "react";
import { Text, View, ScrollView, Pressable, ActivityIndicator, Alert, Modal } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { api, ApiError } from "../src/lib/api";
import { useTopInset } from "../src/lib/useTopInset";
import { pickAndReadCsvFile, parseCsvToObjects } from "../src/lib/csvImport";

interface BankAccount {
  id: string;
  bankName: string;
  accountNumber: string;
}

interface StatementLine {
  id: string;
  date: string;
  description: string;
  amount: string;
  matchStatus: "unmatched" | "matched" | "ignored";
  matchedPayment?: { reference: string | null } | null;
}

interface Suggestion {
  payment: { id: string; amount: string; reference: string | null; date: string; party?: { name: string } };
  daysApart: number;
  confidence: "high" | "low";
}

export default function BankReconciliationScreen() {
  const topInset = useTopInset();
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [lines, setLines] = useState<StatementLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [suggestFor, setSuggestFor] = useState<StatementLine | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);

  useEffect(() => {
    api.get<{ data: BankAccount[] }>("/bank-accounts").then((res) => {
      setAccounts(res.data);
      if (res.data.length > 0) setAccountId(res.data[0].id);
    }).catch(() => {});
  }, []);

  const loadLines = useCallback(async () => {
    if (!accountId) return;
    setLoading(true);
    try {
      const res = await api.get<{ data: StatementLine[] }>("/bank-reconciliation/lines", {
        params: { bankAccountId: accountId, matchStatus: "unmatched" },
      });
      setLines(res.data);
    } catch {
      Alert.alert("Error", "Could not load statement lines.");
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => { loadLines(); }, [loadLines]);

  const handleImport = async () => {
    if (!accountId) {
      Alert.alert("Select Account", "Choose a bank account first.");
      return;
    }
    try {
      const text = await pickAndReadCsvFile();
      if (!text) return;
      const rows = parseCsvToObjects(text);
      const lower = (s: string) => s.toLowerCase();
      const parsed = rows
        .map((r) => {
          const dateKey = Object.keys(r).find((k) => lower(k) === "date");
          const descKey = Object.keys(r).find((k) => lower(k) === "description");
          const amountKey = Object.keys(r).find((k) => lower(k) === "amount");
          if (!dateKey || !descKey || !amountKey) return null;
          const date = new Date(r[dateKey]);
          if (isNaN(date.getTime())) return null;
          return { date: date.toISOString(), description: r[descKey], amount: parseFloat(r[amountKey]) || 0 };
        })
        .filter((r): r is { date: string; description: string; amount: number } => r !== null);

      if (parsed.length === 0) {
        Alert.alert("No Rows", "CSV must have columns: date, description, amount.");
        return;
      }

      setImporting(true);
      const res = await api.post<{ data: { imported: number } }>("/bank-reconciliation/import", {
        bankAccountId: accountId,
        lines: parsed,
      });
      Alert.alert("Imported", `${res.data.imported} statement line(s) imported.`);
      loadLines();
    } catch (e) {
      Alert.alert("Import Failed", e instanceof ApiError ? e.message : "Could not read or import the file.");
    } finally {
      setImporting(false);
    }
  };

  const openSuggestions = async (line: StatementLine) => {
    setSuggestFor(line);
    setSuggestLoading(true);
    try {
      const res = await api.get<{ data: Suggestion[] }>(`/bank-reconciliation/lines/${line.id}/suggestions`);
      setSuggestions(res.data);
    } catch {
      setSuggestions([]);
    } finally {
      setSuggestLoading(false);
    }
  };

  const matchLine = async (paymentId: string) => {
    if (!suggestFor) return;
    try {
      await api.post(`/bank-reconciliation/lines/${suggestFor.id}/match`, { paymentId });
      setSuggestFor(null);
      loadLines();
    } catch {
      Alert.alert("Error", "Failed to match.");
    }
  };

  const ignoreLine = async (line: StatementLine) => {
    try {
      await api.post(`/bank-reconciliation/lines/${line.id}/ignore`, {});
      loadLines();
    } catch {
      Alert.alert("Error", "Failed to ignore.");
    }
  };

  return (
    <View className="flex-1 bg-background dark:bg-bg-dark" style={{ paddingTop: topInset + 8 }}>
    <ScrollView className="flex-1 px-4">
      <Text className="text-xl font-black text-text-primary mb-1">Bank Reconciliation</Text>
      <Text className="text-sm text-text-secondary mb-4">Import your bank statement and match each line to a recorded payment.</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row mb-3">
        {accounts.map((a) => (
          <Pressable
            key={a.id}
            onPress={() => setAccountId(a.id)}
            className={`mr-2 px-4 py-3 rounded-lg border ${accountId === a.id ? "bg-primary border-primary" : "bg-surface border-gray-200 dark:border-zinc-800"}`}
          >
            <Text className={`text-sm font-semibold ${accountId === a.id ? "text-white" : "text-text-secondary"}`}>{a.bankName} — {a.accountNumber}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <Pressable onPress={handleImport} disabled={importing} className="bg-primary py-3 rounded-xl items-center flex-row justify-center mb-4" style={{ gap: 6 }}>
        {importing ? <ActivityIndicator color="white" size="small" /> : (
          <>
            <MaterialCommunityIcons name="upload-outline" size={16} color="white" />
            <Text className="text-white font-bold text-sm">Import Statement CSV</Text>
          </>
        )}
      </Pressable>
      <Text className="text-xs text-text-secondary mb-4">CSV columns required: date, description, amount (positive = money in, negative = money out).</Text>

      {loading ? (
        <View className="py-10 items-center"><ActivityIndicator color="#0F7A5F" /></View>
      ) : lines.length === 0 ? (
        <View className="py-10 items-center">
          <Text className="text-sm text-text-secondary">No unmatched statement lines.</Text>
        </View>
      ) : (
        lines.map((l) => (
          <View key={l.id} className="bg-surface dark:bg-surface-dark p-4 rounded-xl border border-gray-100 dark:border-zinc-800 mb-3">
            <View className="flex-row justify-between items-start mb-2">
              <Text className="font-bold text-text-primary dark:text-text-primary-dark flex-1 mr-2" numberOfLines={2}>{l.description}</Text>
              <Text className={`font-black ${Number(l.amount) >= 0 ? "text-success" : "text-error"}`}>₹{Number(l.amount).toLocaleString("en-IN")}</Text>
            </View>
            <Text className="text-xs text-text-secondary mb-3">{new Date(l.date).toLocaleDateString("en-IN")}</Text>
            <View className="flex-row" style={{ gap: 8 }}>
              <Pressable onPress={() => openSuggestions(l)} className="flex-1 border border-primary py-2.5 rounded-xl items-center">
                <Text className="text-primary font-bold text-sm">Match</Text>
              </Pressable>
              <Pressable onPress={() => ignoreLine(l)} className="flex-1 border border-gray-300 dark:border-zinc-700 py-2.5 rounded-xl items-center">
                <Text className="text-text-secondary font-bold text-sm">Ignore</Text>
              </Pressable>
            </View>
          </View>
        ))
      )}

      <Modal visible={suggestFor !== null} animationType="slide" transparent onRequestClose={() => setSuggestFor(null)}>
        <View className="flex-1 justify-end bg-black/40">
          <View className="bg-background dark:bg-bg-dark rounded-t-3xl px-6 pt-6 pb-10" style={{ maxHeight: "75%" }}>
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-lg font-bold text-text-primary dark:text-text-primary-dark flex-1 mr-2" numberOfLines={1}>{suggestFor?.description}</Text>
              <Pressable onPress={() => setSuggestFor(null)}>
                <MaterialCommunityIcons name="close" size={20} color="#6B7280" />
              </Pressable>
            </View>
            {suggestLoading ? (
              <ActivityIndicator color="#0F7A5F" />
            ) : suggestions.length === 0 ? (
              <Text className="text-sm text-text-secondary py-6 text-center">No candidate payments found nearby.</Text>
            ) : (
              <ScrollView>
                {suggestions.map((s) => (
                  <Pressable
                    key={s.payment.id}
                    onPress={() => matchLine(s.payment.id)}
                    className="p-3 rounded-xl border mb-2"
                    style={{ borderColor: s.confidence === "high" ? "#2E9E5B" : "#e5e7eb" }}
                  >
                    <View className="flex-row justify-between">
                      <Text className="font-bold text-text-primary dark:text-text-primary-dark">{s.payment.party?.name || "—"} — ₹{Number(s.payment.amount).toLocaleString("en-IN")}</Text>
                      <Text className={`text-xs font-bold ${s.confidence === "high" ? "text-success" : "text-warning"}`}>{s.confidence}</Text>
                    </View>
                    <Text className="text-xs text-text-secondary mt-0.5">{s.payment.reference || "No reference"} · {s.daysApart.toFixed(0)}d apart</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </ScrollView>
    </View>
  );
}
