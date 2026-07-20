import React, { useState, useEffect, useCallback } from "react";
import { View, ScrollView, ActivityIndicator, RefreshControl, Text, Pressable, Alert } from "react-native";
import { Card, useTheme, Button, TextInput, Dialog, Portal, Chip, Switch } from "react-native-paper";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { api } from "../src/lib/api";
import { useAuth } from "../src/lib/auth-context";
import { useTopInset, useBottomInset } from "../src/lib/useTopInset";

type ShopHour = {
  id: string;
  day_of_week: number;
  open_time: string;
  close_time: string;
  is_active: boolean;
};

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function ShopHoursScreen() {
  const { userRole } = useAuth();
  const router = useRouter();
  const theme = useTheme();
  const topInset = useTopInset();
  const bottomInset = useBottomInset();
  const canEdit = userRole === "owner" || userRole === "manager";

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hours, setHours] = useState<ShopHour[]>([]);
  const [dialog, setDialog] = useState(false);
  const [editDay, setEditDay] = useState<number>(-1);
  const [editOpen, setEditOpen] = useState("");
  const [editClose, setEditClose] = useState("");
  const [editActive, setEditActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await api.get<{ data: ShopHour[] }>("/leave-management/shop-hours");
      setHours(res.data || []);
    } catch { setHours([]); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openEdit = (dayIdx: number) => {
    const existing = hours.find((h) => h.day_of_week === dayIdx);
    setEditDay(dayIdx);
    setEditOpen(existing?.open_time || "09:00");
    setEditClose(existing?.close_time || "18:00");
    setEditActive(existing?.is_active ?? true);
    setDialog(true);
  };

  const isValidTime = (t: string) => /^([01]\d|2[0-3]):([0-5]\d)$/.test(t);

  const handleSave = async () => {
    if (!isValidTime(editOpen)) {
      Alert.alert("Invalid Time", "Open time must be in HH:MM format (e.g. 09:00).");
      return;
    }
    if (!isValidTime(editClose)) {
      Alert.alert("Invalid Time", "Close time must be in HH:MM format (e.g. 18:00).");
      return;
    }
    if (editOpen >= editClose) {
      Alert.alert("Invalid Range", "Open time must be before close time.");
      return;
    }
    setSaving(true);
    try {
      await api.put("/leave-management/shop-hours", {
        dayOfWeek: editDay,
        openTime: editOpen,
        closeTime: editClose,
        isActive: editActive,
      });
      setDialog(false);
      await fetchData();
    } catch { Alert.alert("Error", "Failed to save shop hours."); }
    finally { setSaving(false); }
  };

  const handleRemove = async (dayIdx: number) => {
    try {
      await api.delete(`/leave-management/shop-hours/${dayIdx}`);
      await fetchData();
    } catch { Alert.alert("Error", "Failed to remove shop hours."); }
  };

  const weekdays = Array.from({ length: 7 }, (_, i) => {
    const existing = hours.find((h) => h.day_of_week === i);
    return { dayIdx: i, label: DAY_NAMES[i], short: DAY_SHORT[i], data: existing || null };
  });

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
        {/* Header */}
        <View className="flex-row items-center px-4 mb-4">
          <Pressable onPress={() => router.back()} className="mr-2">
            <MaterialCommunityIcons name="arrow-left" size={24} color={theme.colors.primary} />
          </Pressable>
          <MaterialCommunityIcons name="clock-outline" size={24} color={theme.colors.primary} />
          <Text className="text-2xl font-bold text-on-surface ml-2">Shop Hours</Text>
        </View>

        {weekdays.map((day) => (
          <Pressable key={day.dayIdx} onPress={() => canEdit && openEdit(day.dayIdx)}>
            <Card mode="elevated" className="mx-4 mb-2">
              <Card.Content className="flex-row items-center justify-between">
                <View className="flex-row items-center" style={{ gap: 12 }}>
                  <View className="w-10 h-10 rounded-full items-center justify-center" style={{ backgroundColor: day.data?.is_active ? `${theme.colors.primary}15` : "#F5F5F5" }}>
                    <Text className="text-xs font-bold" style={{ color: day.data?.is_active ? theme.colors.primary : "#9E9E9E" }}>
                      {day.short}
                    </Text>
                  </View>
                  <View>
                    <Text className="text-sm font-bold text-on-surface">{day.label}</Text>
                    {day.data ? (
                      <View className="flex-row items-center mt-0.5" style={{ gap: 6 }}>
                        {day.data.is_active ? (
                          <>
                            <Text className="text-sm text-primary font-bold">{day.data.open_time}</Text>
                            <MaterialCommunityIcons name="minus" size={14} color="#6B7280" />
                            <Text className="text-sm text-primary font-bold">{day.data.close_time}</Text>
                            <Chip mode="flat" compact textStyle={{ fontSize: 9, color: "#2E9E5B" }} style={{ backgroundColor: "#2E9E5B15", height: 22 }}>
                              Active
                            </Chip>
                          </>
                        ) : (
                          <Chip mode="flat" compact textStyle={{ fontSize: 9, color: "#9E9E9E" }} style={{ backgroundColor: "#F0EDED", height: 22 }}>
                            Inactive
                          </Chip>
                        )}
                      </View>
                    ) : (
                      <Text className="text-xs text-on-surface-variant mt-0.5">Not set — tap to configure</Text>
                    )}
                  </View>
                </View>
                {canEdit && day.data && (
                  <Pressable onPress={() => handleRemove(day.dayIdx)} className="p-2">
                    <MaterialCommunityIcons name="delete-outline" size={20} color="#D64545" />
                  </Pressable>
                )}
              </Card.Content>
            </Card>
          </Pressable>
        ))}
      </ScrollView>

      {/* Edit Dialog */}
      <Portal>
        <Dialog visible={dialog} onDismiss={() => setDialog(false)}>
          <Dialog.Title>{editDay >= 0 ? DAY_NAMES[editDay] : ""}</Dialog.Title>
          <Dialog.Content>
            <TextInput
              mode="outlined"
              label="Open Time (HH:MM)"
              value={editOpen}
              onChangeText={setEditOpen}
              placeholder="09:00"
              className="mb-3"
            />
            <TextInput
              mode="outlined"
              label="Close Time (HH:MM)"
              value={editClose}
              onChangeText={setEditClose}
              placeholder="18:00"
              className="mb-3"
            />
            <View className="flex-row items-center justify-between py-2">
              <Text className="text-sm text-on-surface">Active</Text>
              <Switch value={editActive} onValueChange={setEditActive} color={theme.colors.primary} />
            </View>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDialog(false)}>Cancel</Button>
            <Button onPress={handleSave} loading={saving} disabled={saving || !editOpen || !editClose}>Save</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}
