import React, { useState } from "react";
import { View, ScrollView, Text } from "react-native";
import { Card, Button, List, Divider, Avatar, Dialog, Portal, useTheme } from "react-native-paper";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAuth } from "../src/lib/auth-context";
import { useTopInset, useBottomInset } from "../src/lib/useTopInset";

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  manager: "Store Manager",
  staff: "Cashier",
  warehouse_manager: "Warehouse Manager",
  field_agent: "Field Agent",
};

const ROLE_COLORS: Record<string, string> = {
  owner: "#0368FE",
  manager: "#835400",
  staff: "#2E9E5B",
  warehouse_manager: "#873D34",
  field_agent: "#6B7280",
};

export default function ProfileScreen() {
  const theme = useTheme();
  const { user, userRole, activeCompany, activeBrand, logout } = useAuth();
  const router = useRouter();
  const topInset = useTopInset();
  const bottomInset = useBottomInset(0);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);

  const initials = [user?.firstName, user?.lastName].filter(Boolean).map((s: string) => s[0]).join("").toUpperCase() || "U";
  const roleLabel = ROLE_LABELS[userRole || ""] || "User";
  const roleColor = ROLE_COLORS[userRole || ""] || "#6B7280";
  const outletName = user?.outlet?.name || activeCompany?.name || "Main Store";

  return (
    <ScrollView
      className="flex-1 bg-background dark:bg-bg-dark"
      contentContainerStyle={{ paddingTop: topInset + 16, paddingBottom: bottomInset + 24 }}
    >
      {/* Avatar + Name */}
      <View className="items-center px-4 mb-6">
        <Avatar.Text
          size={72}
          label={initials}
          color="#FFFFFF"
          style={{ backgroundColor: roleColor, marginBottom: 12 }}
        />
        <Text className="text-2xl font-bold text-on-surface dark:text-text-primary-dark text-center">
          {[user?.firstName, user?.lastName].filter(Boolean).join(" ") || "User"}
        </Text>
        <View className="flex-row items-center mt-1" style={{ gap: 6 }}>
          <MaterialCommunityIcons name="store" size={14} color={theme.colors.onSurfaceVariant} />
          <Text className="text-sm text-on-surface-variant dark:text-text-secondary-dark">{outletName}</Text>
        </View>
        <View className="flex-row items-center mt-2" style={{ gap: 4 }}>
          <MaterialCommunityIcons name="badge-account" size={14} color={roleColor} />
          <Text className="text-xs font-bold" style={{ color: roleColor }}>{roleLabel}</Text>
        </View>
      </View>

      {/* Preferences */}
      <Card mode="elevated" className="mx-4 mb-4">
        <List.Item
          title="Outlet / Brand"
          description={activeBrand?.name || "All Brands"}
          left={(props) => <List.Icon {...props} icon="store" />}
        />
        <Divider />
        <List.Item
          title="Printer Settings"
          left={(props) => <List.Icon {...props} icon="printer" />}
          onPress={() => router.push("/printer-settings" as any)}
        />
      </Card>

      {/* Account */}
      <Card mode="elevated" className="mx-4 mb-4">
        <List.Item
          title="Account Security"
          left={(props) => <List.Icon {...props} icon="shield-lock" />}
          onPress={() => router.push("/account-security" as any)}
        />
        <Divider />
        <List.Item
          title="Language"
          left={(props) => <List.Icon {...props} icon="translate" />}
        />
      </Card>

      {/* Logout */}
      <View className="px-4 mt-4">
        <Button
          mode="contained"
          buttonColor={theme.colors.error}
          textColor="#FFFFFF"
          icon="logout"
          onPress={() => setShowLogoutDialog(true)}
          className="mb-3"
        >
          Sign Out
        </Button>
        <Text className="text-xs text-center text-on-surface-variant dark:text-text-secondary-dark">MMC User v1.0</Text>
      </View>

      {/* Logout Confirmation */}
      <Portal>
        <Dialog visible={showLogoutDialog} onDismiss={() => setShowLogoutDialog(false)}>
          <Dialog.Title>Sign Out</Dialog.Title>
          <Dialog.Content>
            <Text className="text-sm text-on-surface dark:text-text-primary-dark">Are you sure you want to sign out?</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowLogoutDialog(false)}>Cancel</Button>
            <Button textColor={theme.colors.error} onPress={() => { setShowLogoutDialog(false); logout(); }}>Sign Out</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </ScrollView>
  );
}
