import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  TextInput,
} from "react-native";
import { PermissionsAndroid, Platform } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  scanBluetoothPrinters,
  scanUsbPrinters,
  connectToPrinter,
  addPrinter,
  removePrinter,
  setDefaultPrinter,
  getSavedPrinters,
  SavedPrinter,
  PrinterConnectionType,
  PaperWidth,
} from "../src/lib/thermalPrinter";
import { useTopInset } from "../src/lib/useTopInset";
import { useBottomInset } from "../src/lib/useBottomInset";

const TABS: { key: PrinterConnectionType; label: string }[] = [
  { key: "bluetooth", label: "Bluetooth" },
  { key: "usb", label: "USB" },
  { key: "wifi", label: "Wi-Fi / LAN" },
];

async function ensureBluetoothPermissions(): Promise<boolean> {
  if (Platform.OS !== "android") return true;
  // Android 12+ (API 31+) requires runtime BLUETOOTH_SCAN/CONNECT permissions
  // separate from the older ACCESS_FINE_LOCATION-based BLE scan permission
  // used on older Android versions — request both so scanning works across
  // the range of Android versions shopkeeper-app is installed on.
  const permissions = [
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
  ].filter(Boolean) as any[];
  const results = await PermissionsAndroid.requestMultiple(permissions);
  return Object.values(results).every((r) => r === PermissionsAndroid.RESULTS.GRANTED);
}

export default function PrinterSettingsScreen() {
  const topInset = useTopInset();
  const bottomInset = useBottomInset();
  const [activeTab, setActiveTab] = useState<PrinterConnectionType>("bluetooth");
  const [printers, setPrinters] = useState<SavedPrinter[]>([]);
  const [scanning, setScanning] = useState(false);
  const [bleDevices, setBleDevices] = useState<{ device_name: string; inner_mac_address: string }[]>([]);
  const [usbDevices, setUsbDevices] = useState<{ device_name: string; vendor_id: string; product_id: string }[]>([]);
  const [connectingKey, setConnectingKey] = useState<string | null>(null);
  const [wifiHost, setWifiHost] = useState("");
  const [wifiPort, setWifiPort] = useState("9100");

  // Paper width is asked once per new printer being added, not a global
  // setting — a shop with both a 58mm counter printer and an 80mm godown
  // printer needs each remembered separately.
  const [pendingPaperWidth, setPendingPaperWidth] = useState<PaperWidth>("58");

  const loadSaved = useCallback(async () => {
    setPrinters(await getSavedPrinters());
  }, []);

  useEffect(() => {
    loadSaved();
  }, [loadSaved]);

  const handleScanBluetooth = async () => {
    const granted = await ensureBluetoothPermissions();
    if (!granted) {
      Alert.alert("Permission Needed", "Bluetooth and location permissions are required to scan for printers.");
      return;
    }
    setScanning(true);
    try {
      const devices = await scanBluetoothPrinters();
      setBleDevices(devices);
      if (devices.length === 0) {
        Alert.alert("No Printers Found", "Make sure your thermal printer is powered on and paired in Android Bluetooth settings first.");
      }
    } catch (e: any) {
      Alert.alert("Scan Failed", e?.message || "Could not scan for Bluetooth printers.");
    } finally {
      setScanning(false);
    }
  };

  const handleScanUsb = async () => {
    setScanning(true);
    try {
      const devices = await scanUsbPrinters();
      setUsbDevices(devices);
      if (devices.length === 0) {
        Alert.alert("No Printers Found", "Connect your USB thermal printer via an OTG cable and try again.");
      }
    } catch (e: any) {
      Alert.alert("Scan Failed", e?.message || "Could not scan for USB printers.");
    } finally {
      setScanning(false);
    }
  };

  const handleAddPrinter = async (printer: Omit<SavedPrinter, "id" | "isDefault">, key: string) => {
    setConnectingKey(key);
    try {
      const withDefault = { ...printer, isDefault: printers.length === 0 };
      await connectToPrinter(withDefault as SavedPrinter);
      await addPrinter(withDefault);
      await loadSaved();
      Alert.alert("Printer Added", `${printer.name} (${printer.paperWidth}mm) has been saved.`);
    } catch (e: any) {
      Alert.alert("Connection Failed", e?.message || "Could not connect to this printer.");
    } finally {
      setConnectingKey(null);
    }
  };

  const handleAddNetworkPrinter = async () => {
    if (!wifiHost.trim()) {
      Alert.alert("Required Field", "Enter the printer's IP address.");
      return;
    }
    const port = parseInt(wifiPort, 10) || 9100;
    const address = `${wifiHost.trim()}:${port}`;
    await handleAddPrinter({ type: "wifi", name: address, address, paperWidth: pendingPaperWidth }, address);
  };

  const handleRemove = async (printer: SavedPrinter) => {
    await removePrinter(printer.id);
    await loadSaved();
  };

  const handleSetDefault = async (printer: SavedPrinter) => {
    await setDefaultPrinter(printer.id);
    await loadSaved();
  };

  const PaperWidthPicker = () => (
    <View className="mb-4">
      <Text className="text-sm font-semibold text-on-surface-variant dark:text-text-secondary-dark uppercase tracking-wider mb-2">
        Paper Width
      </Text>
      <View className="flex-row" style={{ gap: 8 }}>
        {(["58", "80"] as const).map((w) => (
          <Pressable
            key={w}
            onPress={() => setPendingPaperWidth(w)}
            className={`flex-1 py-3 rounded-xl border items-center ${
              pendingPaperWidth === w
                ? "bg-primary border-primary dark:bg-primary-dark"
                : "bg-surface-container-lowest dark:bg-surface-dark border-outline-variant dark:border-outline"
            }`}
          >
            <Text className={`text-sm font-bold ${pendingPaperWidth === w ? "text-white" : "text-on-surface dark:text-text-primary-dark"}`}>
              {w}mm
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );

  return (
    <ScrollView className="flex-1 bg-background dark:bg-bg-dark px-6" style={{ paddingTop: topInset }} contentContainerStyle={{ paddingBottom: 40 + bottomInset }}>
      <Text className="text-2xl font-bold text-on-surface dark:text-text-primary-dark mb-1">
        Printer Settings
      </Text>
      <Text className="text-sm text-on-surface-variant dark:text-text-secondary-dark mb-6">
        Pair one or more thermal receipt printers over Bluetooth, USB, or Wi-Fi/LAN — useful if you print from more than one counter or roll width.
      </Text>

      {printers.length > 0 && (
        <View className="mb-6" style={{ gap: 8 }}>
          <Text className="text-sm font-bold text-on-surface-variant dark:text-text-secondary-dark uppercase tracking-widest">
            Saved Printers
          </Text>
          {printers.map((p) => (
            <View
              key={p.id}
              className={`rounded-2xl p-4 border flex-row justify-between items-center ${
                p.isDefault ? "bg-primary/10 dark:bg-primary-dark/15 border-primary/20" : "bg-surface-container-lowest dark:bg-surface-dark border-outline-variant dark:border-outline"
              }`}
            >
              <View className="flex-1 mr-2">
                <View className="flex-row items-center" style={{ gap: 6 }}>
                  <Text className="text-base font-bold text-on-surface dark:text-text-primary-dark" numberOfLines={1}>
                    {p.name}
                  </Text>
                  {p.isDefault && (
                    <View className="bg-primary px-2 py-0.5 rounded-md">
                      <Text className="text-white text-xs font-bold uppercase">Default</Text>
                    </View>
                  )}
                </View>
                <Text className="text-sm text-on-surface-variant dark:text-text-secondary-dark uppercase mt-0.5">
                  {p.type} · {p.paperWidth}mm
                </Text>
              </View>
              <View className="flex-row items-center" style={{ gap: 8 }}>
                {!p.isDefault && (
                  <Pressable onPress={() => handleSetDefault(p)} className="px-3 py-2 rounded-xl bg-primary/10">
                    <Text className="text-primary font-bold text-xs uppercase">Set Default</Text>
                  </Pressable>
                )}
                <Pressable onPress={() => handleRemove(p)} className="w-9 h-9 rounded-full bg-error/10 items-center justify-center">
                  <MaterialCommunityIcons name="trash-can-outline" size={16} color="#D64545" />
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      )}

      <Text className="text-sm font-bold text-on-surface-variant dark:text-text-secondary-dark uppercase tracking-widest mb-3">
        Add a Printer
      </Text>

      <View className="flex-row mb-6" style={{ gap: 8 }}>
        {TABS.map((tab) => (
          <Pressable
            key={tab.key}
            onPress={() => setActiveTab(tab.key)}
            className={`flex-1 py-3 rounded-xl border items-center ${
              activeTab === tab.key
                ? "bg-primary border-primary dark:bg-primary-dark"
                : "bg-surface-container-lowest dark:bg-surface-dark border-outline-variant dark:border-outline"
            }`}
          >
            <Text
              className={`text-sm font-bold ${
                activeTab === tab.key ? "text-white" : "text-on-surface dark:text-text-primary-dark"
              }`}
            >
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <PaperWidthPicker />

      {activeTab === "bluetooth" && (
        <View>
          <Pressable
            onPress={handleScanBluetooth}
            disabled={scanning}
            className="bg-surface-container-lowest dark:bg-surface-dark border border-outline-variant dark:border-outline rounded-xl py-3.5 items-center mb-4"
          >
            {scanning ? <ActivityIndicator color="#0F7A5F" /> : <Text className="text-primary font-bold text-base">Scan for Bluetooth Printers</Text>}
          </Pressable>
          <Text className="text-sm text-on-surface-variant dark:text-text-secondary-dark mb-3">
            Note: the printer must already be paired in your phone's Android Bluetooth settings before it will show up here.
          </Text>
          {bleDevices.map((d) => (
            <Pressable
              key={d.inner_mac_address}
              onPress={() =>
                handleAddPrinter(
                  { type: "bluetooth", name: d.device_name || d.inner_mac_address, address: d.inner_mac_address, paperWidth: pendingPaperWidth },
                  d.inner_mac_address
                )
              }
              disabled={connectingKey === d.inner_mac_address}
              className="bg-surface dark:bg-surface-dark p-4 rounded-xl border border-gray-100 dark:border-zinc-800 mb-2 flex-row justify-between items-center"
            >
              <View>
                <Text className="font-bold text-on-surface dark:text-text-primary-dark">{d.device_name || "Unnamed Printer"}</Text>
                <Text className="text-sm text-on-surface-variant dark:text-text-secondary-dark">{d.inner_mac_address}</Text>
              </View>
              {connectingKey === d.inner_mac_address ? <ActivityIndicator size="small" color="#0F7A5F" /> : <Text className="text-primary font-bold">Add</Text>}
            </Pressable>
          ))}
        </View>
      )}

      {activeTab === "usb" && (
        <View>
          <Pressable
            onPress={handleScanUsb}
            disabled={scanning}
            className="bg-surface-container-lowest dark:bg-surface-dark border border-outline-variant dark:border-outline rounded-xl py-3.5 items-center mb-4"
          >
            {scanning ? <ActivityIndicator color="#0F7A5F" /> : <Text className="text-primary font-bold text-base">Scan for USB Printers</Text>}
          </Pressable>
          <Text className="text-sm text-on-surface-variant dark:text-text-secondary-dark mb-3">
            Connect your printer via a USB-OTG cable before scanning.
          </Text>
          {usbDevices.map((d) => {
            const key = `${d.vendor_id}:${d.product_id}`;
            return (
              <Pressable
                key={key}
                onPress={() =>
                  handleAddPrinter(
                    { type: "usb", name: d.device_name || `USB Printer (${key})`, address: key, paperWidth: pendingPaperWidth },
                    key
                  )
                }
                disabled={connectingKey === key}
                className="bg-surface dark:bg-surface-dark p-4 rounded-xl border border-gray-100 dark:border-zinc-800 mb-2 flex-row justify-between items-center"
              >
                <View>
                  <Text className="font-bold text-on-surface dark:text-text-primary-dark">{d.device_name || "USB Printer"}</Text>
                  <Text className="text-sm text-on-surface-variant dark:text-text-secondary-dark">Vendor {d.vendor_id} · Product {d.product_id}</Text>
                </View>
                {connectingKey === key ? <ActivityIndicator size="small" color="#0F7A5F" /> : <Text className="text-primary font-bold">Add</Text>}
              </Pressable>
            );
          })}
        </View>
      )}

      {activeTab === "wifi" && (
        <View>
          <Text className="text-sm font-semibold text-on-surface-variant dark:text-text-secondary-dark uppercase tracking-wider mb-2">
            Printer IP Address
          </Text>
          <TextInput
            value={wifiHost}
            onChangeText={setWifiHost}
            placeholder="e.g. 192.168.1.50"
            placeholderTextColor="#A0A0A0"
            keyboardType="numbers-and-punctuation"
            className="bg-surface-container-lowest dark:bg-surface-dark text-on-surface dark:text-text-primary-dark border border-outline-variant dark:border-outline rounded-xl px-4 py-4 text-base font-medium mb-4"
          />
          <Text className="text-sm font-semibold text-on-surface-variant dark:text-text-secondary-dark uppercase tracking-wider mb-2">
            Port
          </Text>
          <TextInput
            value={wifiPort}
            onChangeText={setWifiPort}
            placeholder="9100"
            placeholderTextColor="#A0A0A0"
            keyboardType="numeric"
            className="bg-surface-container-lowest dark:bg-surface-dark text-on-surface dark:text-text-primary-dark border border-outline-variant dark:border-outline rounded-xl px-4 py-4 text-base font-medium mb-4"
          />
          <Pressable
            onPress={handleAddNetworkPrinter}
            disabled={connectingKey !== null}
            className="bg-primary dark:bg-primary-dark py-4 rounded-xl items-center"
          >
            {connectingKey ? <ActivityIndicator color="white" /> : <Text className="text-white font-bold text-base">Connect & Save</Text>}
          </Pressable>
          <Text className="text-sm text-on-surface-variant dark:text-text-secondary-dark mt-3">
            Most network thermal printers listen on port 9100 by default.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

