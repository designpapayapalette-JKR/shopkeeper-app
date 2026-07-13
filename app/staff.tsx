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
  Platform,
  Linking,
  KeyboardAvoidingView,
} from "react-native";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { api, ApiError } from "../src/lib/api";
import { useConfirm } from "../src/components/ConfirmDialog";
import { useTopInset } from "../src/lib/useTopInset";
import { useBottomInset } from "../src/lib/useBottomInset";
import { useAuth } from "../src/lib/auth-context";

const AGENT_APP_DOWNLOAD_URL =
  "https://github.com/designpapayapalette-JKR/agent-app/releases/download/beta-latest/agent-app-latest.apk";
const APP_DOWNLOAD_URL =
  "https://github.com/designpapayapalette-JKR/shopkeeper-app/releases/download/beta-latest/shopkeeper-app-latest.apk";

const STAFF_ROLES = [
  { id: "manager", name: "Manager" },
  { id: "staff", name: "Staff" },
  { id: "field_agent", name: "Field Agent" },
];

interface StaffMember {
  id: string;
  first_name: string;
  last_name?: string;
  name?: string;
  email: string;
  phone?: string;
  role: string;
}

function staffDisplayName(m: StaffMember) {
  if (m.first_name) return `${m.first_name}${m.last_name ? " " + m.last_name : ""}`;
  return m.name || m.email;
}

function randomTempPassword(): string {
  return Math.random().toString(36).slice(-8) + "!1";
}

function roleLabel(role: string) {
  return (
    { owner: "Owner", manager: "Manager", staff: "Staff", field_agent: "Field Agent" }[role] ?? role
  );
}

export default function StaffScreen() {
  const topInset = useTopInset();
  const bottomInset = useBottomInset();
  const confirm = useConfirm();
  const router = useRouter();
  const { activeCompany } = useAuth();

  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);

  // Add Modal
  const [isAdding, setIsAdding] = useState(false);
  const [addFirstName, setAddFirstName] = useState("");
  const [addLastName, setAddLastName] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addPhone, setAddPhone] = useState("");
  const [addPassword, setAddPassword] = useState("");
  const [addRole, setAddRole] = useState("staff");
  const [addSubmitting, setAddSubmitting] = useState(false);

  // Edit Modal
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editRole, setEditRole] = useState("staff");
  const [editSubmitting, setEditSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: StaffMember[] }>("/staff");
      const list = res.data ?? [];
      const normalized = list.map((m: any) => {
        if (m.name && !m.first_name) {
          const parts = m.name.split(" ");
          return { ...m, first_name: parts[0] || "", last_name: parts.slice(1).join(" ") || "" };
        }
        return m;
      });
      setStaff(normalized);
    } catch (e) {
      console.error("Failed to load staff:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const resetAddForm = () => {
    setAddFirstName("");
    setAddLastName("");
    setAddEmail("");
    setAddPhone("");
    setAddPassword("");
    setAddRole("staff");
  };

  const closeAdd = async () => {
    const hasChanges =
      addFirstName.trim() !== "" ||
      addLastName.trim() !== "" ||
      addEmail.trim() !== "" ||
      addPhone.trim() !== "" ||
      addPassword.trim() !== "";
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
    if (!addFirstName.trim() || !addEmail.trim() || !addPassword.trim()) {
      Alert.alert("Required Fields", "First name, email, and password are required.");
      return;
    }
    setAddSubmitting(true);
    try {
      await api.post("/staff", {
        first_name: addFirstName.trim(),
        last_name: addLastName.trim() || undefined,
        email: addEmail.trim(),
        phone: addPhone.trim() || undefined,
        password: addPassword,
        role: addRole,
      });
      const createdPhone = addPhone.trim();
      const createdName = `${addFirstName.trim()}${addLastName.trim() ? " " + addLastName.trim() : ""}`;
      const createdEmail = addEmail.trim();
      const createdPassword = addPassword;
      const createdRole = addRole;
      setIsAdding(false);
      resetAddForm();
      load();

      if (createdPhone) {
        const ok = await confirm({
          title: "Employee Created",
          message: `Send ${createdName}'s login to them over WhatsApp now?`,
          confirmLabel: "Send via WhatsApp",
        });
        if (ok) {
          const isFieldRole = createdRole === "staff" || createdRole === "field_agent";
          const appName = isFieldRole ? "Employee App" : "Shopkeeper App";
          const downloadUrl = isFieldRole ? AGENT_APP_DOWNLOAD_URL : APP_DOWNLOAD_URL;
          const message = `Hi ${createdName}! You've been added to ${activeCompany?.name ?? "our team"} on the ${appName}.\n\n1. Download the app: ${downloadUrl}\n2. Log in with:\nEmail: ${createdEmail}\nPassword: ${createdPassword}\n\nPlease change your password after logging in.`;
          const url = `whatsapp://send?text=${encodeURIComponent(message)}&phone=+91${createdPhone.replace(/\D/g, "")}`;
          const supported = await Linking.canOpenURL(url);
          if (supported) await Linking.openURL(url);
          else Alert.alert("WhatsApp Not Installed", "Could not open WhatsApp on this device.");
        }
      } else {
        Alert.alert("Success", "Employee created successfully.");
      }
    } catch (e) {
      Alert.alert("Error", e instanceof ApiError ? e.message : "Failed to create staff member.");
    } finally {
      setAddSubmitting(false);
    }
  };

  const startEdit = (member: StaffMember) => {
    setEditingStaff(member);
    setEditFirstName(member.first_name || "");
    setEditLastName(member.last_name || "");
    setEditEmail(member.email);
    setEditPhone(member.phone || "");
    setEditRole(member.role === "owner" ? "staff" : member.role);
  };

  const closeEdit = async () => {
    const hasChanges =
      editFirstName !== (editingStaff?.first_name ?? "") ||
      editLastName !== (editingStaff?.last_name ?? "") ||
      editEmail !== editingStaff?.email ||
      editPhone !== (editingStaff?.phone ?? "") ||
      editRole !== (editingStaff?.role === "owner" ? "staff" : editingStaff?.role);
    if (hasChanges) {
      const ok = await confirm({
        title: "Discard changes?",
        message: "You have unsaved changes. Are you sure you want to go back?",
        confirmLabel: "Discard",
        destructive: true,
      });
      if (!ok) return;
    }
    setEditingStaff(null);
  };

  const handleEditSave = async () => {
    if (!editingStaff) return;
    setEditSubmitting(true);
    try {
      await api.patch(`/staff/${editingStaff.id}`, {
        firstName: editFirstName.trim(),
        lastName: editLastName.trim() || undefined,
        email: editEmail.trim(),
        phone: editPhone.trim() || undefined,
        role: editRole,
      });
      setEditingStaff(null);
      load();
    } catch (e) {
      Alert.alert("Error", e instanceof ApiError ? e.message : "Failed to save changes.");
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleDelete = async (member: StaffMember) => {
    const ok = await confirm({
      title: `Remove ${staffDisplayName(member)}?`,
      message:
        "All their attendance records, salary, and tasks will be permanently removed. This cannot be undone.",
      confirmLabel: "Remove",
      destructive: true,
    });
    if (!ok) return;
    try {
      await api.delete(`/staff/${member.id}`);
      load();
    } catch (e) {
      Alert.alert("Error", e instanceof ApiError ? e.message : "Failed to delete staff member.");
    }
  };

  const renderStaffItem = ({ item }: { item: StaffMember }) => (
    <View className="bg-surface dark:bg-surface-dark p-5 rounded-2xl border border-gray-100 dark:border-zinc-800 mb-3 shadow-sm">
      <View className="flex-row items-start justify-between">
        <View className="flex-1 mr-3">
          <Text className="text-base font-bold text-text-primary dark:text-text-primary-dark">
            {staffDisplayName(item)}
          </Text>
          <Text className="text-sm text-text-secondary mt-0.5">{item.email}</Text>
          <View className="flex-row items-center mt-2" style={{ gap: 8 }}>
            <View className="bg-primary/10 px-2.5 py-1 rounded-full">
              <Text className="text-xs font-bold text-primary">{roleLabel(item.role)}</Text>
            </View>
          </View>
        </View>
        {item.role !== "owner" && (
          <View className="flex-row" style={{ gap: 4 }}>
            <Pressable
              onPress={() => startEdit(item)}
              className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-zinc-800 items-center justify-center active:opacity-70"
            >
              <MaterialCommunityIcons name="pencil" size={16} color="#6B7280" />
            </Pressable>
            <Pressable
              onPress={() => handleDelete(item)}
              className="w-9 h-9 rounded-lg bg-red-50 items-center justify-center active:opacity-70"
            >
              <MaterialCommunityIcons name="delete-outline" size={16} color="#D64545" />
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );

  return (
    <View className="flex-1 bg-background dark:bg-background-dark" style={{ paddingTop: topInset }}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-6 py-4">
        <View className="flex-row items-center" style={{ gap: 8 }}>
          <Pressable onPress={() => router.back()} className="w-9 h-9 items-center justify-center active:opacity-70">
            <MaterialCommunityIcons name="arrow-left" size={22} color="#6B7280" />
          </Pressable>
          <Text className="text-xl font-bold text-text-primary dark:text-text-primary-dark">
            Staff & Employees
          </Text>
        </View>
        <Pressable
          onPress={() => {
            resetAddForm();
            setIsAdding(true);
          }}
          className="bg-primary px-4 py-2.5 rounded-xl flex-row items-center active:opacity-80"
          style={{ gap: 4 }}
        >
          <MaterialCommunityIcons name="plus" size={16} color="white" />
          <Text className="text-white font-bold text-sm">Add</Text>
        </Pressable>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center pb-20">
          <ActivityIndicator size="large" color="#0F7A5F" />
        </View>
      ) : staff.length === 0 ? (
        <View className="flex-1 items-center justify-center pb-20 px-6">
          <MaterialCommunityIcons name="account-group-outline" size={48} color="#D1D5DB" />
          <Text className="text-base font-bold text-text-secondary mt-4">No team members yet</Text>
          <Text className="text-sm text-text-secondary mt-1 text-center">
            Tap the Add button to invite your first employee.
          </Text>
        </View>
      ) : (
        <FlatList
          data={staff}
          keyExtractor={(item) => item.id}
          renderItem={renderStaffItem}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: bottomInset + 24 }}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Add Modal */}
      <Modal visible={isAdding} animationType="slide" onRequestClose={closeAdd}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          className="flex-1"
        >
          <ScrollView
            className="flex-1 bg-background dark:bg-background-dark px-6 pb-10"
            style={{ paddingTop: topInset }}
          >
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-2xl font-bold text-text-primary dark:text-text-primary-dark">
                New Employee
              </Text>
              <Pressable onPress={closeAdd} className="w-11 h-11 items-center justify-center">
                <MaterialCommunityIcons name="close" size={20} color="#6B7280" />
              </Pressable>
            </View>

            <View className="space-y-4">
              <View>
                <Text className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-2">
                  First Name *
                </Text>
                <TextInput
                  value={addFirstName}
                  onChangeText={setAddFirstName}
                  placeholder="e.g. Rajesh"
                  placeholderTextColor="#A0A0A0"
                  className="bg-surface dark:bg-zinc-900 text-text-primary border border-gray-200 dark:border-zinc-800 rounded-xl px-4 py-3.5 font-medium"
                />
              </View>
              <View>
                <Text className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-2">
                  Last Name
                </Text>
                <TextInput
                  value={addLastName}
                  onChangeText={setAddLastName}
                  placeholder="e.g. Kumar"
                  placeholderTextColor="#A0A0A0"
                  className="bg-surface dark:bg-zinc-900 text-text-primary border border-gray-200 dark:border-zinc-800 rounded-xl px-4 py-3.5 font-medium"
                />
              </View>
              <View>
                <Text className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-2">
                  Email *
                </Text>
                <TextInput
                  value={addEmail}
                  onChangeText={setAddEmail}
                  placeholder="e.g. rajesh@example.com"
                  placeholderTextColor="#A0A0A0"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  className="bg-surface dark:bg-zinc-900 text-text-primary border border-gray-200 dark:border-zinc-800 rounded-xl px-4 py-3.5 font-medium"
                />
              </View>
              <View>
                <Text className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-2">
                  Phone
                </Text>
                <TextInput
                  value={addPhone}
                  onChangeText={setAddPhone}
                  placeholder="e.g. 9876543210"
                  placeholderTextColor="#A0A0A0"
                  keyboardType="phone-pad"
                  className="bg-surface dark:bg-zinc-900 text-text-primary border border-gray-200 dark:border-zinc-800 rounded-xl px-4 py-3.5 font-medium"
                />
              </View>
              <View>
                <Text className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-2">
                  Role
                </Text>
                <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                  {STAFF_ROLES.map((r) => (
                    <Pressable
                      key={r.id}
                      onPress={() => setAddRole(r.id)}
                      className={`px-4 py-3 rounded-xl border ${
                        addRole === r.id
                          ? "bg-primary border-primary"
                          : "bg-surface dark:bg-zinc-900 border-gray-200 dark:border-zinc-800"
                      }`}
                    >
                      <Text
                        className={`text-sm font-bold ${addRole === r.id ? "text-white" : "text-text-secondary"}`}
                      >
                        {r.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              <View>
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-sm font-semibold text-text-secondary uppercase tracking-wider">
                    Temporary Password *
                  </Text>
                  <Pressable onPress={() => setAddPassword(randomTempPassword())}>
                    <Text className="text-sm font-bold text-primary">Auto-Generate</Text>
                  </Pressable>
                </View>
                <TextInput
                  value={addPassword}
                  onChangeText={setAddPassword}
                  placeholder="Enter a password"
                  placeholderTextColor="#A0A0A0"
                  className="bg-surface dark:bg-zinc-900 text-text-primary border border-gray-200 dark:border-zinc-800 rounded-xl px-4 py-3.5 font-mono"
                />
              </View>
            </View>

            <View className="flex-row justify-between mt-10" style={{ marginBottom: bottomInset }}>
              <Pressable
                onPress={closeAdd}
                className="border border-gray-200 dark:border-zinc-800 py-4 px-6 rounded-xl w-[48%] items-center"
              >
                <Text className="text-text-secondary font-bold">Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleAdd}
                disabled={addSubmitting}
                className="bg-primary py-4 px-6 rounded-xl w-[48%] items-center"
              >
                {addSubmitting ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-white font-bold">Create Employee</Text>
                )}
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Edit Modal */}
      <Modal visible={!!editingStaff} animationType="slide" onRequestClose={closeEdit}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          className="flex-1"
        >
          <ScrollView
            className="flex-1 bg-background dark:bg-background-dark px-6 pb-10"
            style={{ paddingTop: topInset }}
          >
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-2xl font-bold text-text-primary dark:text-text-primary-dark">
                Edit Employee
              </Text>
              <Pressable onPress={closeEdit} className="w-11 h-11 items-center justify-center">
                <MaterialCommunityIcons name="close" size={20} color="#6B7280" />
              </Pressable>
            </View>

            <View className="space-y-4">
              <View>
                <Text className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-2">
                  First Name *
                </Text>
                <TextInput
                  value={editFirstName}
                  onChangeText={setEditFirstName}
                  placeholder="First name"
                  placeholderTextColor="#A0A0A0"
                  className="bg-surface dark:bg-zinc-900 text-text-primary border border-gray-200 dark:border-zinc-800 rounded-xl px-4 py-3.5 font-medium"
                />
              </View>
              <View>
                <Text className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-2">
                  Last Name
                </Text>
                <TextInput
                  value={editLastName}
                  onChangeText={setEditLastName}
                  placeholder="Last name"
                  placeholderTextColor="#A0A0A0"
                  className="bg-surface dark:bg-zinc-900 text-text-primary border border-gray-200 dark:border-zinc-800 rounded-xl px-4 py-3.5 font-medium"
                />
              </View>
              <View>
                <Text className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-2">
                  Email *
                </Text>
                <TextInput
                  value={editEmail}
                  onChangeText={setEditEmail}
                  placeholder="Email"
                  placeholderTextColor="#A0A0A0"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  className="bg-surface dark:bg-zinc-900 text-text-primary border border-gray-200 dark:border-zinc-800 rounded-xl px-4 py-3.5 font-medium"
                />
              </View>
              <View>
                <Text className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-2">
                  Phone
                </Text>
                <TextInput
                  value={editPhone}
                  onChangeText={setEditPhone}
                  placeholder="Phone"
                  placeholderTextColor="#A0A0A0"
                  keyboardType="phone-pad"
                  className="bg-surface dark:bg-zinc-900 text-text-primary border border-gray-200 dark:border-zinc-800 rounded-xl px-4 py-3.5 font-medium"
                />
              </View>
              <View>
                <Text className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-2">
                  Role
                </Text>
                <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                  {STAFF_ROLES.map((r) => (
                    <Pressable
                      key={r.id}
                      onPress={() => setEditRole(r.id)}
                      className={`px-4 py-3 rounded-xl border ${
                        editRole === r.id
                          ? "bg-primary border-primary"
                          : "bg-surface dark:bg-zinc-900 border-gray-200 dark:border-zinc-800"
                      }`}
                    >
                      <Text
                        className={`text-sm font-bold ${editRole === r.id ? "text-white" : "text-text-secondary"}`}
                      >
                        {r.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>

            <Pressable
              onPress={handleEditSave}
              disabled={editSubmitting}
              className="bg-primary py-4 rounded-xl items-center mt-8"
              style={{ marginBottom: bottomInset }}
            >
              {editSubmitting ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white font-bold text-base">Save Changes</Text>
              )}
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
