import React, { useState, useEffect, useCallback } from "react";
import { View, ScrollView, ActivityIndicator, RefreshControl, Text, Pressable, Alert, Modal, TextInput } from "react-native";
import { useTheme } from "react-native-paper";
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
    } catch { Alert.alert("Error", "Failed to save holiday."); }
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
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        contentContainerStyle={{ paddingTop: topInset + 16, paddingBottom: bottomInset + 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} />}
      >
        <View className="flex-row items-center justify-between px-4 mb-4">
          <View className="flex-row items-center" style={{ gap: 8 }}>
            <Pressable onPress={() => router.back()}>
              <MaterialCommunityIcons name="arrow-left" size={24} color={theme.colors.primary} />
            </Pressable>
            <MaterialCommunityIcons name="calendar-star" size={24} color={theme.colors.primary} />
            <Text className="text-2xl font-bold text-on-surface">Holidays</Text>
          </View>
          {canEdit && (
            <Pressable
              onPress={openCreate}
              className="bg-primary px-4 py-2.5 rounded-xl flex-row items-center active:opacity-80"
              style={{ gap: 4 }}
            >
              <MaterialCommunityIcons name="plus" size={16} color="white" />
              <Text className="text-white font-bold text-sm">Add</Text>
            </Pressable>
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
                <View className="mx-4 mb-2 bg-surface-container-lowest border border-outline-variant rounded-2xl p-4">
                  <View className="flex-row items-center" style={{ gap: 12 }}>
                    <View className="items-center w-12">
                      <Text className="text-xs text-on-surface-variant">{dayName}</Text>
                      <Text className="text-xl font-black text-on-surface">{d.getDate()}</Text>
                      <Text className="text-[10px] text-on-surface-variant">{d.toLocaleDateString("en-IN", { month: "short" })}</Text>
                    </View>
                    <View className="flex-1">
                      <Text className="text-sm font-bold text-on-surface">{h.name}</Text>
                      {h.description && <Text className="text-xs text-on-surface-variant">{h.description}</Text>}
                      <View className="flex-row items-center mt-1" style={{ gap: 6 }}>
                        {typeOpt && (
                          <View className="rounded-full px-3 py-1" style={{ backgroundColor: `${typeOpt.color}15` }}>
                            <Text className="text-xs font-bold" style={{ color: typeOpt.color, fontSize: 9 }}>{typeOpt.label}</Text>
                          </View>
                        )}
                        {h.is_open ? (
                          <View className="rounded-full px-3 py-1" style={{ backgroundColor: "#2E9E5B15" }}>
                            <Text className="text-xs font-bold" style={{ color: "#2E9E5B", fontSize: 9 }}>Shop Open</Text>
                          </View>
                        ) : (
                          <View className="rounded-full px-3 py-1" style={{ backgroundColor: "#D6454515" }}>
                            <Text className="text-xs font-bold" style={{ color: "#D64545", fontSize: 9 }}>Shop Closed</Text>
                          </View>
                        )}
                      </View>
                    </View>
                    {canEdit && (
                      <Pressable onPress={() => handleDelete(h.id)} className="p-2">
                        <MaterialCommunityIcons name="delete-outline" size={20} color={theme.colors.error} />
                      </Pressable>
                    )}
                  </View>
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>

      <Modal visible={dialog} transparent animationType="slide" onRequestClose={() => setDialog(false)}>
        <View className="flex-1 justify-end bg-black/40">
          <View className="bg-surface-container-lowest rounded-t-2xl pb-10">
            <ScrollView className="px-6 pt-6">
              <Text className="text-lg font-bold text-on-surface mb-4">
                {editing ? "Edit Holiday" : "Add Holiday"}
              </Text>
              <TextInput
                placeholder="Holiday Name"
                value={formName}
                onChangeText={setFormName}
                className="bg-surface-container-lowest text-on-surface border border-outline-variant rounded-xl px-4 py-3 font-medium mb-3"
                placeholderTextColor="#9CA3AF"
              />
              <TextInput
                placeholder="Date (YYYY-MM-DD)"
                value={formDate}
                onChangeText={setFormDate}
                placeholderTextColor="#9CA3AF"
                className="bg-surface-container-lowest text-on-surface border border-outline-variant rounded-xl px-4 py-3 font-medium mb-3"
              />
              <Text className="text-sm text-on-surface-variant mb-2">Type</Text>
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
              <TextInput
                placeholder="Description (optional)"
                value={formDesc}
                onChangeText={setFormDesc}
                className="bg-surface-container-lowest text-on-surface border border-outline-variant rounded-xl px-4 py-3 font-medium mb-3"
                placeholderTextColor="#9CA3AF"
              />
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
                <Text className="text-sm text-on-surface">Shop remains open on this day</Text>
              </Pressable>
              <View className="flex-row justify-end pt-6 pb-2 gap-3">
                <Pressable className="py-3 px-6 rounded-xl active:opacity-70" onPress={() => setDialog(false)}>
                  <Text className="text-primary font-bold text-base">Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={handleSave}
                  disabled={saving || !formName || !formDate}
                  className="bg-primary py-3 px-6 rounded-xl items-center active:opacity-80"
                >
                  <Text className="text-white font-bold text-base">
                    {saving ? "Saving..." : "Save"}
                  </Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
