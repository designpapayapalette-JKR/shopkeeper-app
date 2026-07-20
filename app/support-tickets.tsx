import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  Pressable,
  TextInput,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  Alert,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "react-native-paper";
import { api, ApiError } from "../src/lib/api";
import { useTopInset } from "../src/lib/useTopInset";
import { useBottomInset } from "../src/lib/useBottomInset";

interface TicketMessage {
  id: string;
  author_name: string;
  body: string;
  is_internal: boolean;
  created_at: string;
}

interface Ticket {
  id: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  created_at: string;
  updated_at: string;
  messages?: TicketMessage[];
}

const PRIORITY_COLORS: Record<string, string> = {
  low: "#6B7280",
  medium: "#F59E0B",
  high: "#EF4444",
  urgent: "#DC2626",
};

const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  assigned: "Assigned",
  in_progress: "In Progress",
  waiting_on_merchant: "Waiting on You",
  resolved: "Resolved",
  closed: "Closed",
};

const STATUS_COLORS: Record<string, string> = {
  open: "#3B82F6",
  assigned: "#8B5CF6",
  in_progress: "#F59E0B",
  waiting_on_merchant: "#EF4444",
  resolved: "#10B981",
  closed: "#6B7280",
};

export default function SupportTicketsScreen() {
  const theme = useTheme();
  const topInset = useTopInset();
  const bottomInset = useBottomInset();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({ title: "", description: "", priority: "medium" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: Ticket[] }>("/support-tickets");
      setTickets(res.data ?? []);
    } catch (e) {
      console.error("Failed to load tickets:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await load(); } finally { setRefreshing(false); }
  }, [load]);

  useEffect(() => { load(); }, [load]);

  const openTicket = async (t: Ticket) => {
    try {
      const res = await api.get<Ticket>(`/support-tickets/${t.id}`);
      setSelected(res);
    } catch { Alert.alert("Error", "Could not load ticket details."); }
  };

  const sendMessage = async () => {
    if (!message.trim() || !selected) return;
    setSending(true);
    try {
      await api.post(`/support-tickets/${selected.id}/messages`, { body: message });
      setMessage("");
      openTicket(selected);
    } catch { Alert.alert("Error", "Failed to send message."); }
    setSending(false);
  };

  const createTicket = async () => {
    if (!createForm.title.trim() || !createForm.description.trim()) return;
    setCreating(true);
    try {
      await api.post("/support-tickets", createForm);
      setShowCreate(false);
      setCreateForm({ title: "", description: "", priority: "medium" });
      load();
    } catch { Alert.alert("Error", "Failed to create ticket."); }
    setCreating(false);
  };

  const renderTicket = ({ item }: { item: Ticket }) => (
    <Pressable
      onPress={() => openTicket(item)}
      className="bg-white dark:bg-zinc-900 rounded-2xl p-4 mb-3 border border-gray-100 dark:border-zinc-800"
      style={{ marginHorizontal: 16 }}
    >
      <View className="flex-row items-center gap-2 mb-1.5">
        <View className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PRIORITY_COLORS[item.priority] || "#6B7280" }} />
        <Text className="text-base font-bold text-gray-900 dark:text-white flex-1" numberOfLines={1}>
          {item.title}
        </Text>
      </View>
      <Text className="text-sm text-gray-500 dark:text-zinc-400 mb-2" numberOfLines={2}>
        {item.description}
      </Text>
      <View className="flex-row items-center justify-between">
        <View className="px-2 py-0.5 rounded-full" style={{ backgroundColor: (STATUS_COLORS[item.status] || "#6B7280") + "20" }}>
          <Text className="text-[11px] font-bold" style={{ color: STATUS_COLORS[item.status] || "#6B7280" }}>
            {STATUS_LABELS[item.status] || item.status}
          </Text>
        </View>
        <Text className="text-[10px] text-gray-400">
          {new Date(item.created_at).toLocaleDateString()}
        </Text>
      </View>
    </Pressable>
  );

  if (selected) {
    return (
      <View className="flex-1 bg-background dark:bg-bg-dark" style={{ paddingTop: topInset }}>
        <View className="flex-row items-center px-4 py-3 border-b border-outline-variant dark:border-outline bg-surface-container-lowest dark:bg-surface-dark">
          <Pressable onPress={() => setSelected(null)} className="mr-3 p-1">
            <MaterialCommunityIcons name="arrow-left" size={24} color={theme.colors.primary} />
          </Pressable>
          <View className="flex-1">
            <Text className="text-base font-bold text-on-surface dark:text-text-primary-dark" numberOfLines={1}>{selected.title}</Text>
            <Text className="text-[11px] text-on-surface-variant dark:text-text-secondary-dark">
              {STATUS_LABELS[selected.status]} · {selected.priority}
            </Text>
          </View>
        </View>

        <ScrollView className="flex-1 px-4 pt-3" keyboardShouldPersistTaps="handled">
          {selected.description && (
            <View className="bg-surface-container-lowest dark:bg-surface-dark rounded-2xl p-4 mb-3 border border-outline-variant dark:border-outline">
              <Text className="text-sm text-on-surface-variant dark:text-text-secondary-dark">{selected.description}</Text>
            </View>
          )}

          {(!selected.messages || selected.messages.length === 0) && (
            <Text className="text-center text-sm text-on-surface-variant dark:text-text-secondary-dark mt-8">No messages yet</Text>
          )}

          {selected.messages?.map(msg => (
            <View key={msg.id} className="bg-surface-container-lowest dark:bg-surface-dark rounded-2xl p-4 mb-3 border border-outline-variant dark:border-outline">
              <View className="flex-row items-center gap-1.5 mb-1.5">
                <MaterialCommunityIcons name="account" size={14} color={theme.colors.onSurfaceVariant} />
                <Text className="text-[11px] font-semibold text-on-surface-variant dark:text-text-secondary-dark">{msg.author_name}</Text>
                <Text className="text-[10px] text-on-surface-variant dark:text-text-secondary-dark">
                  {new Date(msg.created_at).toLocaleString()}
                </Text>
              </View>
              <Text className="text-sm text-on-surface dark:text-text-primary-dark">{msg.body}</Text>
            </View>
          ))}

          <View style={{ height: 100 }} />
        </ScrollView>

        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={0}>
          <View className="flex-row items-center px-4 py-3 border-t border-outline-variant dark:border-outline bg-surface-container-lowest dark:bg-surface-dark" style={{ paddingBottom: bottomInset + 12 }}>
            <TextInput
              value={message}
              onChangeText={setMessage}
              placeholder="Type a reply..."
              placeholderTextColor={theme.colors.onSurfaceVariant}
              className="flex-1 bg-surface-container dark:bg-zinc-800 rounded-xl px-4 py-2.5 text-sm text-on-surface dark:text-text-primary-dark mr-2"
              multiline
            />
            <Pressable
              onPress={sendMessage}
              disabled={sending || !message.trim()}
              className="bg-primary dark:bg-primary-dark rounded-xl p-3"
              style={{ opacity: sending || !message.trim() ? 0.5 : 1 }}
            >
              <MaterialCommunityIcons name="send" size={20} color="white" />
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background dark:bg-bg-dark" style={{ paddingTop: topInset }}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-outline-variant dark:border-outline bg-surface-container-lowest dark:bg-surface-dark">
        <Text className="text-lg font-bold text-on-surface dark:text-text-primary-dark">Support Tickets</Text>
        <Pressable onPress={() => setShowCreate(true)} className="bg-primary dark:bg-primary-dark rounded-xl px-4 py-2 flex-row items-center gap-1">
          <MaterialCommunityIcons name="plus" size={18} color="white" />
          <Text className="text-sm font-bold text-white">New</Text>
        </Pressable>
      </View>

      {/* List */}
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : tickets.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <MaterialCommunityIcons name="headset" size={48} color={theme.colors.outlineVariant} />
          <Text className="text-base text-on-surface-variant dark:text-text-secondary-dark mt-4 text-center">No support tickets yet</Text>
          <Text className="text-sm text-on-surface-variant dark:text-text-secondary-dark mt-1 text-center">Create one and our team will get back to you.</Text>
          <Pressable onPress={() => setShowCreate(true)} className="mt-6 bg-primary dark:bg-primary-dark rounded-xl px-6 py-3">
            <Text className="text-sm font-bold text-white">Create Ticket</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={tickets}
          keyExtractor={item => item.id}
          renderItem={renderTicket}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={{ paddingTop: 16, paddingBottom: bottomInset + 24 }}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Create Modal */}
      <Modal visible={showCreate} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1">
          <Pressable className="flex-1 bg-black/40" onPress={() => setShowCreate(false)} />
          <View className="bg-surface-container-lowest dark:bg-surface-dark rounded-t-3xl p-6" style={{ paddingBottom: bottomInset + 24 }}>
            <Text className="text-lg font-bold text-on-surface dark:text-text-primary-dark mb-4">New Support Ticket</Text>

            <Text className="text-sm font-semibold text-on-surface-variant dark:text-text-secondary-dark mb-1">Title</Text>
            <TextInput
              value={createForm.title}
              onChangeText={t => setCreateForm(f => ({ ...f, title: t }))}
              placeholder="Brief issue summary"
              placeholderTextColor={theme.colors.onSurfaceVariant}
              className="bg-surface-container dark:bg-zinc-800 rounded-xl px-4 py-3 text-sm text-on-surface dark:text-text-primary-dark mb-3"
            />

            <Text className="text-sm font-semibold text-on-surface-variant dark:text-text-secondary-dark mb-1">Description</Text>
            <TextInput
              value={createForm.description}
              onChangeText={t => setCreateForm(f => ({ ...f, description: t }))}
              placeholder="Describe the issue in detail..."
              placeholderTextColor={theme.colors.onSurfaceVariant}
              className="bg-surface-container dark:bg-zinc-800 rounded-xl px-4 py-3 text-sm text-on-surface dark:text-text-primary-dark mb-3"
              multiline
              numberOfLines={4}
              style={{ minHeight: 100, textAlignVertical: "top" }}
            />

            <Text className="text-sm font-semibold text-on-surface-variant dark:text-text-secondary-dark mb-1">Priority</Text>
            <View className="flex-row gap-2 mb-6">
              {["low", "medium", "high", "urgent"].map(p => (
                <Pressable
                  key={p}
                  onPress={() => setCreateForm(f => ({ ...f, priority: p }))}
                  className={`px-4 py-2 rounded-xl border ${createForm.priority === p ? "border-primary dark:border-primary-dark bg-primary/10 dark:bg-primary-dark/10" : "border-outline-variant dark:border-outline"}`}
                >
                  <Text className={`text-sm font-semibold capitalize ${createForm.priority === p ? "text-primary dark:text-primary-dark" : "text-on-surface-variant dark:text-text-secondary-dark"}`}>
                    {p}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View className="flex-row gap-3">
              <Pressable onPress={() => setShowCreate(false)} className="flex-1 py-3 rounded-xl border border-outline-variant dark:border-outline">
                <Text className="text-sm font-bold text-on-surface-variant dark:text-text-secondary-dark text-center">Cancel</Text>
              </Pressable>
              <Pressable
                onPress={createTicket}
                disabled={creating || !createForm.title.trim() || !createForm.description.trim()}
                className="flex-1 bg-primary dark:bg-primary-dark py-3 rounded-xl"
                style={{ opacity: creating || !createForm.title.trim() || !createForm.description.trim() ? 0.5 : 1 }}
              >
                <Text className="text-sm font-bold text-white text-center">
                  {creating ? "Submitting..." : "Submit"}
                </Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
