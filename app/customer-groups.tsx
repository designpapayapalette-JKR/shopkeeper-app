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
import { api, ApiError } from "../src/lib/api";
import { useConfirm } from "../src/components/ConfirmDialog";
import { useTopInset } from "../src/lib/useTopInset";
import { useBottomInset } from "../src/lib/useBottomInset";
import { useTheme } from "react-native-paper";

interface Group {
  id: string;
  name: string;
}

interface PartyMember {
  party_id: string;
  party: { id: string; name: string; phone: string | null };
}

interface Party {
  id: string;
  name: string;
  phone: string | null;
}

export default function CustomerGroupsScreen() {
  const topInset = useTopInset();
  const bottomInset = useBottomInset();
  const confirm = useConfirm();
  const router = useRouter();
  const theme = useTheme();

  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadTrigger, setLoadTrigger] = useState(0);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Group | null>(null);
  const [formName, setFormName] = useState("");
  const [saving, setSaving] = useState(false);

  // Members state
  const [activeGroup, setActiveGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<PartyMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [parties, setParties] = useState<Party[]>([]);
  const [selectedPartyId, setSelectedPartyId] = useState("");
  const [partySearch, setPartySearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: Group[] }>("/customer-groups");
      setGroups(res.data ?? []);
    } catch (e) {
      console.error("Failed to load groups:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await load(); } finally { setRefreshing(false); }
  }, [load]);

  useEffect(() => { load(); }, [load, loadTrigger]);

  const loadMembers = useCallback(async (groupId: string) => {
    setMembersLoading(true);
    try {
      const res = await api.get<{ data: PartyMember[] }>(`/customer-groups/${groupId}/members`);
      setMembers(res.data ?? []);
    } catch {
      Alert.alert("Error", "Failed to load members.");
    } finally {
      setMembersLoading(false);
    }
  }, []);

  const loadParties = useCallback(async () => {
    try {
      const res = await api.get<{ data: Party[] }>("/parties", { params: { type: "customer" } });
      setParties(res.data ?? []);
    } catch { Alert.alert("Error", "Could not load parties."); }
  }, []);

  const openMembers = (group: Group) => {
    setActiveGroup(group);
    loadMembers(group.id);
  };

  const handleSave = async () => {
    if (!formName.trim()) { Alert.alert("Required", "Name is required."); return; }
    setSaving(true);
    try {
      if (editing) {
        await api.patch(`/customer-groups/${editing.id}`, { name: formName.trim() });
      } else {
        await api.post("/customer-groups", { name: formName.trim() });
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

  const handleDelete = async (group: Group) => {
    const ok = await confirm({ title: `Delete "${group.name}"?`, message: "This group will be permanently removed.", confirmLabel: "Delete", destructive: true });
    if (!ok) return;
    try {
      await api.delete(`/customer-groups/${group.id}`);
      setLoadTrigger((n) => n + 1);
    } catch (e) {
      Alert.alert("Error", e instanceof ApiError ? e.message : "Failed to delete.");
    }
  };

  const handleAddMember = async () => {
    if (!selectedPartyId) { Alert.alert("Required", "Select a customer."); return; }
    try {
      await api.post(`/customer-groups/${activeGroup!.id}/members`, { partyIds: [selectedPartyId] });
      setShowAddMember(false);
      setSelectedPartyId("");
      setPartySearch("");
      loadMembers(activeGroup!.id);
    } catch (e) {
      Alert.alert("Error", e instanceof ApiError ? e.message : "Failed to add member.");
    }
  };

  const handleRemoveMember = async (partyId: string) => {
    const ok = await confirm({ title: "Remove member?", message: "", confirmLabel: "Remove", destructive: true });
    if (!ok) return;
    try {
      await api.delete(`/customer-groups/${activeGroup!.id}/members/${partyId}`);
      loadMembers(activeGroup!.id);
    } catch (e) {
      Alert.alert("Error", e instanceof ApiError ? e.message : "Failed to remove member.");
    }
  };

  const filteredParties = parties.filter(
    (p) => !partySearch || p.name.toLowerCase().includes(partySearch.toLowerCase())
  );

  const renderGroup = ({ item }: { item: Group }) => (
    <View className="bg-surface-container-lowest dark:bg-surface-dark p-5 rounded-2xl border border-outline-variant dark:border-outline mb-3 shadow-sm">
      <View className="flex-row items-start justify-between">
        <Pressable onPress={() => openMembers(item)} className="flex-1 mr-2 active:opacity-70">
          <Text className="text-base font-bold text-on-surface dark:text-text-primary-dark">{item.name}</Text>
        </Pressable>
        <View className="flex-row" style={{ gap: 4 }}>
          <Pressable onPress={() => { setEditing(item); setFormName(item.name); setShowForm(true); }}
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
            <MaterialCommunityIcons name="arrow-left" size={22} color={theme.colors.primary} />
          </Pressable>
          <Text className="text-xl font-bold text-on-surface dark:text-text-primary-dark">Customer Groups</Text>
        </View>
        <Pressable onPress={() => { setEditing(null); setFormName(""); setShowForm(true); }}
          className="bg-primary px-4 py-2.5 rounded-xl flex-row items-center active:opacity-80" style={{ gap: 4 }}>
          <MaterialCommunityIcons name="plus" size={16} color="white" />
          <Text className="text-white font-bold text-sm">Add</Text>
        </Pressable>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center"><ActivityIndicator size="large" color={theme.colors.primary} /></View>
      ) : groups.length === 0 ? (
        <View className="flex-1 items-center justify-center pb-20 px-6">
          <MaterialCommunityIcons name="account-group-outline" size={48} color={theme.colors.outlineVariant} />
          <Text className="text-base font-bold text-on-surface-variant dark:text-text-secondary-dark mt-4">No groups yet</Text>
          <Text className="text-sm text-on-surface-variant dark:text-text-secondary-dark mt-1 text-center">Create groups to organize your customers for price lists.</Text>
        </View>
      ) : (
        <FlatList data={groups} keyExtractor={(item) => item.id} renderItem={renderGroup}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: bottomInset + 24 }} showsVerticalScrollIndicator={false} />
      )}

      {/* Add/Edit Modal */}
      <Modal visible={showForm} animationType="slide" onRequestClose={() => setShowForm(false)}>
        <SafeAreaProvider>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1">
            <ScrollView className="flex-1 bg-background dark:bg-bg-dark px-6 pb-10" style={{ paddingTop: topInset }}>
              <View className="flex-row justify-between items-center mb-6">
                <Text className="text-2xl font-bold text-on-surface dark:text-text-primary-dark">
                  {editing ? "Edit" : "Add"} Group
                </Text>
                <Pressable onPress={() => setShowForm(false)} className="w-11 h-11 items-center justify-center">
                  <MaterialCommunityIcons name="close" size={20} color={theme.colors.onSurfaceVariant} />
                </Pressable>
              </View>
              <Text className="text-sm font-semibold text-on-surface-variant dark:text-text-secondary-dark uppercase tracking-wider mb-2">Name *</Text>
              <TextInput value={formName} onChangeText={setFormName} placeholder="e.g. Wholesale, Premium" placeholderTextColor={theme.colors.onSurfaceVariant} autoFocus
                className="bg-surface-container-lowest dark:bg-zinc-900 text-on-surface dark:text-text-primary-dark border border-outline-variant dark:border-zinc-800 rounded-xl px-4 py-3.5 font-medium" />
              <View className="flex-row justify-between mt-10" style={{ marginBottom: bottomInset }}>
                <Pressable onPress={() => setShowForm(false)}
                  className="border border-outline-variant dark:border-zinc-800 py-4 px-6 rounded-xl w-[48%] items-center">
                  <Text className="text-on-surface-variant dark:text-text-secondary-dark font-bold">Cancel</Text>
                </Pressable>
                <Pressable onPress={handleSave} disabled={saving}
                  className="bg-primary py-4 px-6 rounded-xl w-[48%] items-center">
                  {saving ? <ActivityIndicator color="white" /> : <Text className="text-white font-bold">{editing ? "Update" : "Create"}</Text>}
                </Pressable>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaProvider>
      </Modal>

      {/* Members Modal */}
      <Modal visible={!!activeGroup} animationType="slide" onRequestClose={() => setActiveGroup(null)}>
        <SafeAreaProvider>
          <View className="flex-1 bg-background dark:bg-bg-dark" style={{ paddingTop: topInset }}>
            <View className="flex-row items-center justify-between px-6 py-4">
              <View className="flex-row items-center" style={{ gap: 8 }}>
                <Pressable onPress={() => setActiveGroup(null)} className="w-9 h-9 items-center justify-center active:opacity-70">
                  <MaterialCommunityIcons name="arrow-left" size={22} color={theme.colors.primary} />
                </Pressable>
                <Text className="text-xl font-bold text-on-surface dark:text-text-primary-dark">{activeGroup?.name}</Text>
              </View>
              <Pressable onPress={() => { loadParties(); setSelectedPartyId(""); setPartySearch(""); setShowAddMember(true); }}
                className="bg-primary px-4 py-2.5 rounded-xl flex-row items-center active:opacity-80" style={{ gap: 4 }}>
                <MaterialCommunityIcons name="plus" size={16} color="white" />
                <Text className="text-white font-bold text-sm">Add</Text>
              </Pressable>
            </View>

            {membersLoading ? (
              <View className="flex-1 items-center justify-center"><ActivityIndicator size="large" color={theme.colors.primary} /></View>
            ) : members.length === 0 ? (
              <View className="flex-1 items-center justify-center px-6">
                <Text className="text-sm font-bold text-on-surface-variant dark:text-text-secondary-dark">No members yet</Text>
              </View>
            ) : (
              <FlatList data={members} keyExtractor={(item) => item.party_id} showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: bottomInset + 24 }}
                renderItem={({ item }) => (
                  <View className="bg-surface-container-lowest dark:bg-surface-dark p-4 rounded-2xl border border-outline-variant dark:border-outline mb-2 flex-row items-center">
                    <View className="flex-1">
                      <Text className="text-sm font-bold text-on-surface dark:text-text-primary-dark">{item.party.name}</Text>
                      {item.party.phone && <Text className="text-xs text-on-surface-variant dark:text-text-secondary-dark">{item.party.phone}</Text>}
                    </View>
                    <Pressable onPress={() => handleRemoveMember(item.party_id)}
                      className="w-8 h-8 rounded-lg bg-red-50 items-center justify-center">
                      <MaterialCommunityIcons name="delete-outline" size={14} color={theme.colors.error} />
                    </Pressable>
                  </View>
                )} />
            )}
          </View>
        </SafeAreaProvider>
      </Modal>

      {/* Add Member Modal */}
      <Modal visible={showAddMember} animationType="slide" onRequestClose={() => setShowAddMember(false)}>
        <SafeAreaProvider>
          <View className="flex-1 bg-background dark:bg-bg-dark" style={{ paddingTop: topInset }}>
            <View className="flex-row items-center justify-between px-6 py-4">
              <Text className="text-xl font-bold text-on-surface dark:text-text-primary-dark">Add Member</Text>
              <Pressable onPress={() => setShowAddMember(false)} className="w-11 h-11 items-center justify-center">
                <MaterialCommunityIcons name="close" size={20} color={theme.colors.onSurfaceVariant} />
              </Pressable>
            </View>
            <View className="px-6">
              <TextInput value={partySearch} onChangeText={setPartySearch} placeholder="Search customers..." placeholderTextColor={theme.colors.onSurfaceVariant}
                className="bg-surface-container-lowest dark:bg-zinc-900 text-on-surface dark:text-text-primary-dark border border-outline-variant dark:border-zinc-800 rounded-xl px-4 py-3.5 font-medium mb-4" />
              <ScrollView className="max-h-72">
                <View className="flex-row flex-wrap" style={{ gap: 6 }}>
                  {filteredParties.slice(0, 30).map((p) => (
                    <Pressable key={p.id} onPress={() => setSelectedPartyId(p.id)}
                      className={`px-3.5 py-2.5 rounded-xl border ${selectedPartyId === p.id ? "bg-primary border-primary" : "bg-surface-container-lowest dark:bg-zinc-900 border-outline-variant dark:border-zinc-800"}`}>
                      <Text className={`text-sm font-bold ${selectedPartyId === p.id ? "text-white" : "text-on-surface-variant dark:text-text-secondary-dark"}`}>{p.name}</Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
              <Pressable onPress={handleAddMember} disabled={!selectedPartyId}
                className="bg-primary py-4 rounded-xl items-center mt-6 opacity-100 disabled:opacity-50">
                <Text className="text-white font-bold">Add to Group</Text>
              </Pressable>
            </View>
          </View>
        </SafeAreaProvider>
      </Modal>
    </View>
  );
}
