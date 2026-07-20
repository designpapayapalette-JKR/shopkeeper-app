import React, { useState, useEffect, useCallback } from "react";
import { View, Text, FlatList, ActivityIndicator, Pressable, Alert, RefreshControl, Linking } from "react-native";
import { Card, useTheme, Button, Snackbar, Chip, Searchbar } from "react-native-paper";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { api } from "../src/lib/api";
import { useTopInset, useBottomInset } from "../src/lib/useTopInset";

interface OverdueParty {
  id: string;
  name: string;
  phone?: string;
  total_due: number;
  days_overdue: number;
  last_invoice_date?: string;
}

type Severity = "urgent" | "warning" | "notice";

const SEVERITY_CONFIG: Record<Severity, { color: string; bg: string; label: string }> = {
  urgent: { color: "#ef4444", bg: "#fef2f2", label: "Urgent" },
  warning: { color: "#f97316", bg: "#fff7ed", label: "Overdue" },
  notice: { color: "#eab308", bg: "#fefce8", label: "Due Soon" },
};

function getSeverity(days: number): Severity {
  if (days >= 30) return "urgent";
  if (days >= 15) return "warning";
  return "notice";
}

function formatCurrency(amount: number): string {
  return "₹" + Number(amount).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function formatDate(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export default function RemindersScreen() {
  const theme = useTheme();
  const router = useRouter();
  const topInset = useTopInset();
  const bottomInset = useBottomInset();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<OverdueParty[]>([]);
  const [search, setSearch] = useState("");
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState({ visible: false, message: "" });

  const fetchData = useCallback(async () => {
    try {
      const res = await api.get<{ data: OverdueParty[] }>("/reminders/overdue");
      setData(res.data || []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const grouped = data.reduce((acc, item) => {
    const sev = getSeverity(item.days_overdue);
    if (!acc[sev]) acc[sev] = [];
    acc[sev].push(item);
    return acc;
  }, {} as Record<Severity, OverdueParty[]>);

  const filtered = search.trim()
    ? data.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    : data;

  const filteredGrouped = search.trim()
    ? filtered.reduce((acc, item) => {
        const sev = getSeverity(item.days_overdue);
        if (!acc[sev]) acc[sev] = [];
        acc[sev].push(item);
        return acc;
      }, {} as Record<Severity, OverdueParty[]>)
    : grouped;

  const totalDue = data.reduce((sum, p) => sum + p.total_due, 0);

  const handleSendReminder = async (party: OverdueParty) => {
    setSendingId(party.id);
    try {
      await api.post(`/reminders/${party.id}/mark-sent`);
      setSnackbar({ visible: true, message: `Reminder sent to ${party.name}` });
      if (party.phone) {
        const text = encodeURIComponent(
          `Dear ${party.name}, this is a reminder that ${formatCurrency(party.total_due)} is overdue by ${party.days_overdue} days. Please clear the outstanding at your earliest.`
        );
        Linking.openURL(`whatsapp://send?text=${text}&phone=${party.phone}`).catch(() => {
          Alert.alert("WhatsApp Not Found", "Please install WhatsApp to send messages.");
        });
      }
    } catch {
      Alert.alert("Error", "Failed to send reminder. Please try again.");
    } finally {
      setSendingId(null);
    }
  };

  const sections: { severity: Severity; items: OverdueParty[] }[] = (
    ["urgent", "warning", "notice"] as Severity[]
  ).filter((s) => (filteredGrouped[s]?.length || 0) > 0).map((s) => ({
    severity: s,
    items: filteredGrouped[s] || [],
  }));

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background dark:bg-bg-dark">
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background dark:bg-bg-dark">
      <FlatList
        data={sections}
        keyExtractor={(s) => s.severity}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchData(); }}
            tintColor={theme.colors.primary}
          />
        }
        contentContainerStyle={{ paddingTop: topInset + 16, paddingBottom: bottomInset + 24, paddingHorizontal: 16 }}
        ListHeaderComponent={
          <>
            <View className="flex-row items-center justify-between mb-4">
              <View className="flex-row items-center" style={{ gap: 8 }}>
                <MaterialCommunityIcons name="bell-ring-outline" size={24} color={theme.colors.primary} />
                <Text className="text-2xl font-bold text-on-surface dark:text-text-primary-dark">Reminders</Text>
              </View>
            </View>

            <Card mode="elevated" className="mb-4">
              <Card.Content>
                <View className="flex-row items-center justify-between">
                  <View>
                    <Text className="text-xs text-on-surface-variant dark:text-text-secondary-dark uppercase tracking-wide">
                      Total Overdue
                    </Text>
                    <Text className="text-2xl font-black text-on-surface dark:text-text-primary-dark mt-1">
                      {formatCurrency(totalDue)}
                    </Text>
                    <Text className="text-xs text-on-surface-variant dark:text-text-secondary-dark mt-0.5">
                      {data.length} {data.length === 1 ? "party" : "parties"}
                    </Text>
                  </View>
                  <View className="w-14 h-14 rounded-full bg-error/10 items-center justify-center">
                    <MaterialCommunityIcons name="alert-circle" size={28} color="#ef4444" />
                  </View>
                </View>
              </Card.Content>
            </Card>

            <View className="mb-3">
              <Searchbar
                placeholder="Search parties..."
                value={search}
                onChangeText={setSearch}
                onClearIconPress={() => setSearch("")}
              />
            </View>

            {data.length === 0 && (
              <View className="items-center py-20">
                <View className="w-20 h-20 rounded-full bg-primary/10 items-center justify-center mb-4">
                  <MaterialCommunityIcons name="check-circle-outline" size={40} color={theme.colors.primary} />
                </View>
                <Text className="text-lg font-bold text-on-surface dark:text-text-primary-dark text-center">
                  No overdue payments!
                </Text>
                <Text className="text-sm text-on-surface-variant dark:text-text-secondary-dark text-center mt-1">
                  All caught up!
                </Text>
              </View>
            )}
          </>
        }
        renderItem={({ item: section }) => (
          <View className="mb-4">
            <View className="flex-row items-center mb-2 px-1" style={{ gap: 6 }}>
              <View
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: SEVERITY_CONFIG[section.severity].color }}
              />
              <Text
                className="text-sm font-bold"
                style={{ color: SEVERITY_CONFIG[section.severity].color }}
              >
                {SEVERITY_CONFIG[section.severity].label}
              </Text>
              <Text className="text-xs text-on-surface-variant dark:text-text-secondary-dark">
                ({section.items.length})
              </Text>
            </View>

            {section.items.map((party) => {
              const sev = getSeverity(party.days_overdue);
              const cfg = SEVERITY_CONFIG[sev];
              const isSending = sendingId === party.id;

              return (
                <Card key={party.id} mode="elevated" className="mb-2" style={{ borderLeftWidth: 3, borderLeftColor: cfg.color }}>
                  <Card.Content>
                    <View className="flex-row items-start justify-between">
                      <View className="flex-1 mr-3">
                        <View className="flex-row items-center" style={{ gap: 6 }}>
                          <MaterialCommunityIcons name="account" size={16} color={theme.colors.primary} />
                          <Text className="text-base font-bold text-on-surface dark:text-text-primary-dark flex-1" numberOfLines={1}>
                            {party.name}
                          </Text>
                        </View>

                        <Text className="text-xl font-black text-on-surface dark:text-text-primary-dark mt-1">
                          {formatCurrency(party.total_due)}
                        </Text>

                        <View className="flex-row items-center mt-1.5" style={{ gap: 8 }}>
                          <Chip
                            mode="flat"
                            compact
                            textStyle={{ fontSize: 10, color: cfg.color, fontWeight: "700" }}
                            style={{ backgroundColor: cfg.bg, height: 24 }}
                          >
                            {party.days_overdue} days
                          </Chip>
                          {party.last_invoice_date && (
                            <Text className="text-xs text-on-surface-variant dark:text-text-secondary-dark">
                              Last: {formatDate(party.last_invoice_date)}
                            </Text>
                          )}
                        </View>
                      </View>

                      <Button
                        mode="contained"
                        compact
                        loading={isSending}
                        disabled={isSending}
                        onPress={() => handleSendReminder(party)}
                        buttonColor={cfg.color}
                        contentStyle={{ height: 36 }}
                        labelStyle={{ fontSize: 11, fontWeight: "700" }}
                      >
                        Send Reminder
                      </Button>
                    </View>
                  </Card.Content>
                </Card>
              );
            })}
          </View>
        )}
      />

      <Snackbar
        visible={snackbar.visible}
        onDismiss={() => setSnackbar({ visible: false, message: "" })}
        duration={2500}
        action={{
          label: "OK",
          onPress: () => setSnackbar({ visible: false, message: "" }),
        }}
      >
        {snackbar.message}
      </Snackbar>
    </View>
  );
}
