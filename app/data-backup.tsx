import React, { useEffect, useState } from "react";
import { View, Text, Pressable, ActivityIndicator, Alert, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "react-native-paper";
import { useTopInset, useBottomInset } from "../src/lib/useTopInset";
import {
  getBackupStatus,
  autoSyncDeviceBackup,
  exportBackupFile,
  importBackupFile,
  readLocalBackup,
  BackupStatus,
} from "../src/lib/localBackup";

export default function DataBackupScreen() {
  const router = useRouter();
  const theme = useTheme();
  const topInset = useTopInset();
  const bottomInset = useBottomInset();
  const [status, setStatus] = useState<BackupStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const loadStatus = async () => {
    setLoading(true);
    try {
      const current = await getBackupStatus();
      setStatus(current);
    } catch (err) {
      console.error("[DataBackupScreen] Error reading backup status:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const handleSyncBackup = async () => {
    setSyncing(true);
    setActionMessage(null);
    try {
      const updated = await autoSyncDeviceBackup();
      setStatus(updated);
      setActionMessage("Local device backup saved successfully!");
    } catch (err: unknown) {
      Alert.alert("Backup Failed", err instanceof Error ? err.message : "Could not complete backup sync.");
    } finally {
      setSyncing(false);
    }
  };

  const handleExport = async () => {
    setActionMessage(null);
    const success = await exportBackupFile();
    if (success) {
      setActionMessage("Backup file shared/exported.");
    } else {
      Alert.alert("Export Error", "Sharing backup file is not supported on this device.");
    }
  };

  const handleImport = async () => {
    setActionMessage(null);
    const res = await importBackupFile();
    if (res.success) {
      Alert.alert("Import Complete", res.message);
      await loadStatus();
    } else if (res.message !== "Import cancelled.") {
      Alert.alert("Import Failed", res.message);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background, paddingTop: topInset, paddingBottom: bottomInset }}>
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.outlineVariant }}>
        <Pressable onPress={() => router.back()} style={{ padding: 8, marginRight: 8 }}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={theme.colors.onBackground} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 18, fontWeight: "700", color: theme.colors.onBackground }}>Data Backup & Local Recovery</Text>
          <Text style={{ fontSize: 12, color: theme.colors.onSurfaceVariant }}>Saved persistent device backup</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        {/* Main Status Card */}
        <View style={{ backgroundColor: theme.colors.surface, borderRadius: 12, padding: 16, borderBottomWidth: 1, borderColor: theme.colors.outlineVariant }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(3,104,254,0.1)", alignItems: "center", justifyContent: "center" }}>
              <MaterialCommunityIcons name="shield-check" size={24} color={theme.colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: "600", color: theme.colors.onSurface }}>
                {status?.exists ? "Device Data Backup Active" : "No Local Backup Found"}
              </Text>
              <Text style={{ fontSize: 12, color: theme.colors.onSurfaceVariant, marginTop: 2 }}>
                {status?.timestamp ? `Last updated: ${new Date(status.timestamp).toLocaleString()}` : "Not backed up yet"}
              </Text>
            </View>
          </View>

          {loading ? (
            <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginVertical: 12 }} />
          ) : (
            <View style={{ flexDirection: "row", justifyContent: "space-around", backgroundColor: theme.colors.surfaceVariant, borderRadius: 8, padding: 12, marginTop: 8 }}>
              <View style={{ alignItems: "center" }}>
                <Text style={{ fontSize: 16, fontWeight: "700", color: theme.colors.primary }}>{status?.productCount ?? 0}</Text>
                <Text style={{ fontSize: 11, color: theme.colors.onSurfaceVariant }}>Products</Text>
              </View>
              <View style={{ alignItems: "center" }}>
                <Text style={{ fontSize: 16, fontWeight: "700", color: theme.colors.primary }}>{status?.partyCount ?? 0}</Text>
                <Text style={{ fontSize: 11, color: theme.colors.onSurfaceVariant }}>Parties</Text>
              </View>
              <View style={{ alignItems: "center" }}>
                <Text style={{ fontSize: 16, fontWeight: "700", color: theme.colors.primary }}>{status?.invoiceCount ?? 0}</Text>
                <Text style={{ fontSize: 11, color: theme.colors.onSurfaceVariant }}>Invoices</Text>
              </View>
              <View style={{ alignItems: "center" }}>
                <Text style={{ fontSize: 16, fontWeight: "700", color: theme.colors.primary }}>{formatSize(status?.fileSizeBytes ?? 0)}</Text>
                <Text style={{ fontSize: 11, color: theme.colors.onSurfaceVariant }}>Size</Text>
              </View>
            </View>
          )}

          {actionMessage && (
            <Text style={{ fontSize: 12, color: "#16a34a", textAlign: "center", marginTop: 12, fontWeight: "500" }}>
              {actionMessage}
            </Text>
          )}
        </View>

        {/* Info Box */}
        <View style={{ backgroundColor: "rgba(3,104,254,0.06)", borderRadius: 12, padding: 14, flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
          <MaterialCommunityIcons name="information" size={20} color={theme.colors.primary} style={{ marginTop: 2 }} />
          <Text style={{ flex: 1, fontSize: 14, color: theme.colors.onSurface, lineHeight: 20 }}>
            Your catalog, customer records, stock, and invoice history are automatically saved to your phone’s persistent storage. If you reinstall or switch apps, your data remains safely stored on this device.
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={{ gap: 12 }}>
          <Pressable
            onPress={handleSyncBackup}
            disabled={syncing}
            style={{
              backgroundColor: theme.colors.primary,
              borderRadius: 10,
              paddingVertical: 14,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              opacity: syncing ? 0.7 : 1,
            }}
          >
            {syncing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <MaterialCommunityIcons name="cloud-sync" size={20} color="#fff" />
            )}
            <Text style={{ color: "#fff", fontSize: 15, fontWeight: "600" }}>
              {syncing ? "Backing Up Device Data..." : "Back Up Device Data Now"}
            </Text>
          </Pressable>

          <View style={{ flexDirection: "row", gap: 12 }}>
            <Pressable
              onPress={handleExport}
              style={{
                flex: 1,
                backgroundColor: theme.colors.surface,
                borderWidth: 1,
                borderColor: theme.colors.outlineVariant,
                borderRadius: 10,
                paddingVertical: 12,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
            >
              <MaterialCommunityIcons name="export" size={18} color={theme.colors.onSurface} />
              <Text style={{ color: theme.colors.onSurface, fontSize: 13, fontWeight: "600" }}>Export File</Text>
            </Pressable>

            <Pressable
              onPress={handleImport}
              style={{
                flex: 1,
                backgroundColor: theme.colors.surface,
                borderWidth: 1,
                borderColor: theme.colors.outlineVariant,
                borderRadius: 10,
                paddingVertical: 12,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
            >
              <MaterialCommunityIcons name="import" size={18} color={theme.colors.onSurface} />
              <Text style={{ color: theme.colors.onSurface, fontSize: 13, fontWeight: "600" }}>Import File</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
