import React, { useState, useEffect, useCallback } from "react";
import { View, ScrollView, ActivityIndicator, RefreshControl, Text, Pressable, Alert } from "react-native";
import { Card, useTheme, Button, TextInput, Dialog, Portal, Chip, Snackbar } from "react-native-paper";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { api } from "../src/lib/api";
import { useAuth } from "../src/lib/auth-context";
import { useTopInset, useBottomInset } from "../src/lib/useTopInset";
import { useConfirm } from "../src/components/ConfirmDialog";
import EmptyState from "../src/components/EmptyState";

type Holiday = {
  id: string;
  name: string;
  date: string;
  type: "public" | "optional" | "company";
  description: string | null;
  is_open: boolean;
};

const TYPE_OPTIONS = [
  { value: "public", label: "Public", color: "#0368FE" },
  { value: "optional", label: "Optional", color: "#F0AE4E" },
  { value: "company", label: "Company", color: "#2E9E5B" },
];

export default function HolidaysScreen() {
  const { userRole } = useAuth();
  const router = useRouter();
  const theme = useTheme();
  const topInset = useTopInset();
  const bottomInset = useBottomInset();
  const confirm = useConfirm();
  const canEdit = userRole === "owner" || userRole === "manager";

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [dialog, setDialog] = useState(false);
  const [editing, setEditing] = useState<Holiday | null>(null);
  const [formName, setFormName] = useState("");
  const [formDate, setFormDate] = useState("");
  const [formType, setFormType] = useState<"public" | "optional" | "company">("public");
  const [formDesc, setFormDesc] = useState("");
  const [formIsOpen, setFormIsOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState({ visible: false, message: "" });

  const fetchData = useCallback(async () => {
    try {
      const res = await api.get<{ data: Holiday[] }>("/leave-management/holidays");
      setHolidays(res.data || []);
    } catch { setHolidays([]); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openCreate = () => {
    setEditing(null);
    setFormName("");
    setFormDate("");
    setFormType("public");
    setFormDesc("");
    setFormIsOpen(false);
    setDialog(true);
  };

  const openEdit = (h: Holiday) => {
    setEditing(h);
    setFormName(h.name);
    setFormDate(h.date ? h.date.split("T")[0] : "");
    setFormType(h.type);
    setFormDesc(h.description || "");
    setFormIsOpen(h.is_open);
    setDialog(true);
  };

  const handleSave = async () => {
    if (!formName || !formDate) return;
    setSaving(true);
    try {
      const body = { name: formName, date: formDate, type: formType, description: formDesc || undefined, isOpen: formIsOpen };
      if (editing) {
        await api.patch(`/leave-management/holidays/${editing.id}`, body);
      } else {
        await api.post("/leave-management/holidays", body);
      }
      setDialog(false);
      await fetchData();
    } catch { setSnackbar({ visible: true, message: "Failed to save holiday." }); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm({ title: "Delete Holiday?", message: "Are you sure you want to delete this holiday?", confirmLabel: "Delete", destructive: true });
    if (!ok) return;
    try {
      await api.delete(`/leave-management/holidays/${id}`);
      await fetchData();
    } catch { Alert.alert("Error", "Failed to delete holiday."); }
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background dark:bg-bg-dark">
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background dark:bg-bg-dark">
      <ScrollView
        contentContainerStyle={{ paddingTop: topInset + 16, paddingBottom: bottomInset + 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} />}
      >
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 mb-4">
          <View className="flex-row items-center" style={{ gap: 8 }}>
            <Pressable onPress={() => router.back()}>
              <MaterialCommunityIcons name="arrow-left" size={24} color={theme.colors.primary} />
            </Pressable>
            <MaterialCommunityIcons name="calendar-star" size={24} color={theme.colors.primary} />
            <Text className="text-2xl font-bold text-on-surface dark:text-text-primary-dark">Holidays</Text>
          </View>
          {canEdit && (
            <Button mode="contained" compact onPress={openCreate} icon="plus">
              Add
            </Button>
          )}
        </View>

        {holidays.length === 0 ? (
          <EmptyState
            icon="calendar-blank"
            title="No holidays set"
            description={canEdit ? 'Tap "Add" above to create one.' : undefined}
          />
        ) : (
          holidays.map((h) => {
            const typeOpt = TYPE_OPTIONS.find((t) => t.value === h.type);
            const d = new Date(h.date);
            const dayName = d.toLocaleDateString("en-IN", { weekday: "short" });
            const dateStr = d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
            return (
              <Pressable key={h.id} onPress={() => canEdit && openEdit(h)}>
                <Card mode="elevated" className="mx-4 mb-2">
                  <Card.Content className="flex-row items-center" style={{ gap: 12 }}>
                    <View className="items-center w-12">
                      <Text className="text-xs text-on-surface-variant dark:text-text-secondary-dark">{dayName}</Text>
                      <Text className="text-xl font-black text-on-surface dark:text-text-primary-dark">{d.getDate()}</Text>
                      <Text className="text-[10px] text-on-surface-variant dark:text-text-secondary-dark">{d.toLocaleDateString("en-IN", { month: "short" })}</Text>
                    </View>
                    <View className="flex-1">
                      <Text className="text-sm font-bold text-on-surface dark:text-text-primary-dark">{h.name}</Text>
                      {h.description && <Text className="text-xs text-on-surface-variant dark:text-text-secondary-dark">{h.description}</Text>}
                      <View className="flex-row items-center mt-1" style={{ gap: 6 }}>
                        {typeOpt && (
                          <Chip mode="flat" compact textStyle={{ fontSize: 9, color: typeOpt.color }} style={{ backgroundColor: `${typeOpt.color}15` }}>
                            {typeOpt.label}
                          </Chip>
                        )}
                        {h.is_open ? (
                          <Chip mode="flat" compact textStyle={{ fontSize: 9, color: "#2E9E5B" }} style={{ backgroundColor: "#2E9E5B15" }}>
                            Shop Open
                          </Chip>
                        ) : (
                          <Chip mode="flat" compact textStyle={{ fontSize: 9, color: "#D64545" }} style={{ backgroundColor: "#D6454515" }}>
                            Shop Closed
                          </Chip>
                        )}
                      </View>
                    </View>
                    {canEdit && (
                      <Pressable onPress={() => handleDelete(h.id)} className="p-2">
                        <MaterialCommunityIcons name="delete-outline" size={20} color={theme.colors.error} />
                      </Pressable>
                    )}
                  </Card.Content>
                </Card>
              </Pressable>
            );
          })
        )}
      </ScrollView>

      {/* Create/Edit Dialog */}
      <Portal>
        <Dialog visible={dialog} onDismiss={() => setDialog(false)}>
          <Dialog.Title>{editing ? "Edit Holiday" : "Add Holiday"}</Dialog.Title>
          <Dialog.Content>
            <TextInput mode="outlined" label="Holiday Name" value={formName} onChangeText={setFormName} className="mb-3" />
            <TextInput mode="outlined" label="Date (YYYY-MM-DD)" value={formDate} onChangeText={setFormDate} placeholder="2025-01-26" className="mb-3" />
            <Text className="text-sm text-on-surface-variant dark:text-text-secondary-dark mb-2">Type</Text>
            <View className="flex-row flex-wrap mb-3" style={{ gap: 8 }}>
              {TYPE_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.value}
                  onPress={() => setFormType(opt.value as any)}
                  className={`px-3 py-1.5 rounded-full border ${formType === opt.value ? "border-0" : "border-outline-variant"}`}
                  style={{ backgroundColor: formType === opt.value ? opt.color : "transparent" }}
                >
                  <Text className={`text-xs font-bold ${formType === opt.value ? "text-white" : ""}`} style={formType === opt.value ? {} : { color: opt.color }}>
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            <TextInput mode="outlined" label="Description (optional)" value={formDesc} onChangeText={setFormDesc} className="mb-3" />
            <Pressable
              onPress={() => setFormIsOpen(!formIsOpen)}
              className="flex-row items-center py-2"
              style={{ gap: 8 }}
            >
              <MaterialCommunityIcons
                name={formIsOpen ? "checkbox-marked" : "checkbox-blank-outline"}
                size={20}
                color={formIsOpen ? theme.colors.primary : theme.colors.onSurfaceVariant}
              />
              <Text className="text-sm text-on-surface dark:text-text-primary-dark">Shop remains open on this day</Text>
            </Pressable>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDialog(false)}>Cancel</Button>
            <Button onPress={handleSave} loading={saving} disabled={saving || !formName || !formDate}>Save</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Snackbar visible={snackbar.visible} onDismiss={() => setSnackbar({ visible: false, message: "" })} duration={2000}>
        {snackbar.message}
      </Snackbar>
    </View>
  );
}
