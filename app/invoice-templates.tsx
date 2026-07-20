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
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
} from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "react-native-paper";
import { api, ApiError } from "../src/lib/api";
import { useConfirm } from "../src/components/ConfirmDialog";
import ToggleSwitch from "../src/components/ToggleSwitch";
import { useTopInset, useBottomInset } from "../src/lib/useTopInset";
import EmptyState from "../src/components/EmptyState";

interface TemplateConfig {
  paper_size?: string;
  show_company_logo?: boolean;
  show_company_name?: boolean;
  show_company_gstin?: boolean;
  show_company_phone?: boolean;
  show_company_address?: boolean;
  show_bank_details?: boolean;
  show_upi_qr?: boolean;
  show_customer_name?: boolean;
  show_customer_gstin?: boolean;
  show_customer_phone?: boolean;
  show_customer_address?: boolean;
  show_invoice_number?: boolean;
  show_date?: boolean;
  show_due_date?: boolean;
  show_payment_mode?: boolean;
  show_hsn_code?: boolean;
  show_item_discount?: boolean;
  show_subtotal?: boolean;
  show_tax_breakup?: boolean;
  round_amount?: boolean;
  show_signature?: boolean;
  show_item_sno?: boolean;
  show_item_mrp?: boolean;
  footer_text?: string;
  primary_color?: string;
  accent_color?: string;
}

interface Template {
  id: string;
  name: string;
  module: string;
  is_default: boolean;
  config: TemplateConfig;
}

const MODULES = ["pos", "invoice", "b2b"];

const TOGGLE_GROUPS: { title: string; items: { key: keyof TemplateConfig; label: string }[] }[] = [
  {
    title: "Company Info",
    items: [
      { key: "show_company_logo", label: "Company Logo" },
      { key: "show_company_name", label: "Company Name" },
      { key: "show_company_gstin", label: "GSTIN" },
      { key: "show_company_phone", label: "Phone" },
      { key: "show_company_address", label: "Address" },
      { key: "show_bank_details", label: "Bank Details" },
      { key: "show_upi_qr", label: "UPI QR" },
    ],
  },
  {
    title: "Customer Info",
    items: [
      { key: "show_customer_name", label: "Customer Name" },
      { key: "show_customer_gstin", label: "Customer GSTIN" },
      { key: "show_customer_phone", label: "Customer Phone" },
      { key: "show_customer_address", label: "Customer Address" },
    ],
  },
  {
    title: "Invoice Details",
    items: [
      { key: "show_invoice_number", label: "Invoice Number" },
      { key: "show_date", label: "Date" },
      { key: "show_due_date", label: "Due Date" },
      { key: "show_payment_mode", label: "Payment Mode" },
    ],
  },
  {
    title: "Line Items",
    items: [
      { key: "show_hsn_code", label: "HSN Code" },
      { key: "show_item_discount", label: "Item Discount" },
      { key: "show_subtotal", label: "Subtotal" },
      { key: "show_tax_breakup", label: "Tax Breakup" },
      { key: "round_amount", label: "Round Amount" },
      { key: "show_signature", label: "Signature" },
      { key: "show_item_sno", label: "Item S.No." },
      { key: "show_item_mrp", label: "Item MRP" },
    ],
  },
];

export default function InvoiceTemplatesScreen() {
  const topInset = useTopInset();
  const bottomInset = useBottomInset();
  const confirm = useConfirm();
  const router = useRouter();
  const theme = useTheme();

  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadTrigger, setLoadTrigger] = useState(0);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Template | null>(null);
  const [formName, setFormName] = useState("");
  const [formModule, setFormModule] = useState("pos");
  const [config, setConfig] = useState<TemplateConfig>({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: Template[] }>("/invoice-templates");
      setTemplates(res.data ?? []);
    } catch (e) {
      console.error("Failed to load templates:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await load(); } finally { setRefreshing(false); }
  }, [load]);

  useEffect(() => { load(); }, [load, loadTrigger]);

  const setDefault = async (id: string) => {
    try {
      await api.post(`/invoice-templates/${id}/set-default`);
      setLoadTrigger((n) => n + 1);
      Alert.alert("Success", "Default template updated.");
    } catch (e) {
      Alert.alert("Error", e instanceof ApiError ? e.message : "Failed to set default.");
    }
  };

  const handleDelete = async (template: Template) => {
    const ok = await confirm({ title: `Delete "${template.name}"?`, message: "This cannot be undone.", confirmLabel: "Delete", destructive: true });
    if (!ok) return;
    try {
      await api.delete(`/invoice-templates/${template.id}`);
      setLoadTrigger((n) => n + 1);
    } catch (e) {
      Alert.alert("Error", e instanceof ApiError ? e.message : "Failed to delete.");
    }
  };

  const toggleConfig = (key: keyof TemplateConfig) => {
    setConfig((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    if (!formName.trim()) { Alert.alert("Required", "Name is required."); return; }
    setSaving(true);
    try {
      if (editing) {
        await api.patch(`/invoice-templates/${editing.id}`, { name: formName.trim(), config });
      } else {
        await api.post("/invoice-templates", { name: formName.trim(), module: formModule, config });
      }
      setShowForm(false);
      setEditing(null);
      setLoadTrigger((n) => n + 1);
    } catch (e) {
      Alert.alert("Error", e instanceof ApiError ? e.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  const renderTemplate = ({ item }: { item: Template }) => (
    <View className="bg-surface-container-lowest dark:bg-surface-dark p-5 rounded-2xl border border-outline-variant dark:border-outline mb-3 shadow-sm">
      <View className="flex-row items-start justify-between">
        <View className="flex-1 mr-2">
          <View className="flex-row items-center" style={{ gap: 6 }}>
            <Text className="text-base font-bold text-on-surface dark:text-text-primary-dark">{item.name}</Text>
            {item.is_default && <View className="bg-primary/10 px-2 py-0.5 rounded-full"><Text className="text-xs font-bold text-primary dark:text-primary-dark">Default</Text></View>}
          </View>
          <Text className="text-xs text-on-surface-variant dark:text-text-secondary-dark mt-0.5 capitalize">{item.module} · {item.config?.paper_size || "A4"}</Text>
        </View>
        <View className="flex-row" style={{ gap: 4 }}>
          {!item.is_default && (
            <Pressable onPress={() => setDefault(item.id)}
              className="w-9 h-9 rounded-lg bg-primary/10 items-center justify-center active:opacity-70">
              <MaterialCommunityIcons name="star-outline" size={16} color={theme.colors.primary} />
            </Pressable>
          )}
          <Pressable onPress={() => { setEditing(item); setFormName(item.name); setFormModule(item.module); setConfig(item.config || {}); setShowForm(true); }}
            className="w-9 h-9 rounded-lg bg-surface-container dark:bg-zinc-800 items-center justify-center active:opacity-70">
            <MaterialCommunityIcons name="pencil" size={16} color={theme.colors.onSurfaceVariant} />
          </Pressable>
          <Pressable onPress={() => handleDelete(item)}
            className="w-9 h-9 rounded-lg bg-red-50 items-center justify-center active:opacity-70">
            <MaterialCommunityIcons name="delete-outline" size={16} color={theme.colors.error} />
          </Pressable>
        </View>
      </View>
    </View>
  );

  return (
    <View className="flex-1 bg-background dark:bg-bg-dark" style={{ paddingTop: topInset }}>
      <View className="flex-row items-center justify-between px-6 py-4">
        <View className="flex-row items-center" style={{ gap: 8 }}>
          <Pressable onPress={() => router.back()} className="w-9 h-9 items-center justify-center active:opacity-70">
            <MaterialCommunityIcons name="arrow-left" size={22} color={theme.colors.onSurfaceVariant} />
          </Pressable>
          <Text className="text-xl font-bold text-on-surface dark:text-text-primary-dark">Invoice Templates</Text>
        </View>
        <Pressable onPress={() => { setEditing(null); setFormName(""); setFormModule("pos"); setConfig({}); setShowForm(true); }}
          className="bg-primary dark:bg-primary-dark px-4 py-2.5 rounded-xl flex-row items-center active:opacity-80" style={{ gap: 4 }}>
          <MaterialCommunityIcons name="plus" size={16} color="white" />
          <Text className="text-white font-bold text-sm">Add</Text>
        </Pressable>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center"><ActivityIndicator size="large" color={theme.colors.primary} /></View>
      ) : templates.length === 0 ? (
        <EmptyState icon="file-document-outline" title="No templates yet" description="Create invoice templates to customize printed receipts and invoices." />
      ) : (
        <FlatList data={templates} keyExtractor={(item) => item.id} renderItem={renderTemplate}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: bottomInset + 24 }} showsVerticalScrollIndicator={false} />
      )}

      <Modal visible={showForm} animationType="slide" onRequestClose={() => setShowForm(false)}>
        <SafeAreaProvider>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1">
            <ScrollView className="flex-1 bg-background dark:bg-bg-dark px-6 pb-10" style={{ paddingTop: topInset }}>
              <View className="flex-row justify-between items-center mb-6">
                <Text className="text-2xl font-bold text-on-surface dark:text-text-primary-dark">
                  {editing ? "Edit" : "Add"} Template
                </Text>
                <Pressable onPress={() => setShowForm(false)} className="w-11 h-11 items-center justify-center">
                  <MaterialCommunityIcons name="close" size={20} color={theme.colors.onSurfaceVariant} />
                </Pressable>
              </View>

              <View className="bg-surface-container-lowest dark:bg-surface-dark p-5 rounded-3xl border border-outline-variant dark:border-outline shadow-sm mb-4">
                <Text className="text-sm font-semibold text-on-surface-variant dark:text-text-secondary-dark uppercase tracking-wider mb-2">Name *</Text>
                <TextInput value={formName} onChangeText={setFormName} placeholder="e.g. My POS Receipt" placeholderTextColor="#A0A0A0" autoFocus
                  className="bg-background dark:bg-zinc-900 text-on-surface dark:text-text-primary-dark border border-outline-variant dark:border-outline rounded-xl px-4 py-3.5 font-medium" />
              </View>

              {!editing && (
                <View className="bg-surface-container-lowest dark:bg-surface-dark p-5 rounded-3xl border border-outline-variant dark:border-outline shadow-sm mb-4">
                  <Text className="text-sm font-semibold text-on-surface-variant dark:text-text-secondary-dark uppercase tracking-wider mb-3">Module</Text>
                  <View className="flex-row flex-wrap" style={{ gap: 6 }}>
                    {MODULES.map((m) => (
                      <Pressable key={m} onPress={() => setFormModule(m)}
                        className={`px-4 py-3 rounded-xl border ${formModule === m ? "bg-primary dark:bg-primary-dark border-primary dark:border-primary-dark" : "bg-surface-container-lowest dark:bg-zinc-900 border-outline-variant dark:border-outline"}`}>
                        <Text className={`text-sm font-bold ${formModule === m ? "text-white" : "text-on-surface-variant dark:text-text-secondary-dark capitalize"}`}>{m}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              )}

              {TOGGLE_GROUPS.map((group) => (
                <View key={group.title} className="bg-surface-container-lowest dark:bg-surface-dark p-5 rounded-3xl border border-outline-variant dark:border-outline shadow-sm mb-4">
                  <Text className="text-sm font-semibold text-on-surface-variant dark:text-text-secondary-dark uppercase tracking-wider mb-1">{group.title}</Text>
                  {group.items.map((t, idx) => (
                    <View key={t.key}
                      className={`flex-row items-center justify-between py-3 ${idx < group.items.length - 1 ? "border-b border-outline-variant dark:border-outline" : ""}`}>
                      <Text className="text-sm font-medium text-on-surface dark:text-text-primary-dark flex-1 mr-3">{t.label}</Text>
                      <ToggleSwitch value={!!config[t.key]} onValueChange={() => toggleConfig(t.key)} />
                    </View>
                  ))}
                </View>
              ))}

              <View className="bg-surface-container-lowest dark:bg-surface-dark p-5 rounded-3xl border border-outline-variant dark:border-outline shadow-sm mb-4">
                <Text className="text-sm font-semibold text-on-surface-variant dark:text-text-secondary-dark uppercase tracking-wider mb-2">Footer Text</Text>
                <TextInput value={config.footer_text || ""} onChangeText={(v) => setConfig((prev) => ({ ...prev, footer_text: v }))}
                  placeholder="e.g. Thank you, visit again!" placeholderTextColor="#A0A0A0" multiline numberOfLines={2}
                  className="bg-background dark:bg-zinc-900 text-on-surface dark:text-text-primary-dark border border-outline-variant dark:border-outline rounded-xl px-4 py-3 font-medium" />
              </View>

              <View className="flex-row justify-between mt-2" style={{ marginBottom: bottomInset }}>
                <Pressable onPress={() => setShowForm(false)}
                  className="border border-outline-variant dark:border-outline py-4 px-6 rounded-xl w-[48%] items-center">
                  <Text className="text-on-surface-variant dark:text-text-secondary-dark font-bold">Cancel</Text>
                </Pressable>
                <Pressable onPress={handleSave} disabled={saving}
                  className="bg-primary dark:bg-primary-dark py-4 px-6 rounded-xl w-[48%] items-center">
                  {saving ? <ActivityIndicator color="white" /> : <Text className="text-white font-bold">{editing ? "Update" : "Create"}</Text>}
                </Pressable>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaProvider>
      </Modal>
    </View>
  );
}
