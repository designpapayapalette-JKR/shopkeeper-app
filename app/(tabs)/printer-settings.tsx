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
import {
  scanBluetoothPrinters,
  scanUsbPrinters,
  connectToPrinter,
  savePrinter,
  clearSavedPrinter,
  getSavedPrinter,
  SavedPrinter,
  PrinterConnectionType,
} from "../../src/lib/thermalPrinter";
import { useTopInset } from "../../src/lib/useTopInset";

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
  const [activeTab, setActiveTab] = useState<PrinterConnectionType>("bluetooth");
  const [savedPrinter, setSavedPrinter] = useState<SavedPrinter | null>(null);
  const [scanning, setScanning] = useState(false);
  const [bleDevices, setBleDevices] = useState<{ device_name: string; inner_mac_address: string }[]>([]);
  const [usbDevices, setUsbDevices] = useState<{ device_name: string; vendor_id: string; product_id: string }[]>([]);
  const [connectingKey, setConnectingKey] = useState<string | null>(null);
  const [wifiHost, setWifiHost] = useState("");
  const [wifiPort, setWifiPort] = useState("9100");

  const loadSaved = useCallback(async () => {
    setSavedPrinter(await getSavedPrinter());
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

  const handleSelectPrinter = async (printer: SavedPrinter, key: string) => {
    setConnectingKey(key);
    try {
      await connectToPrinter(printer);
      await savePrinter(printer);
      setSavedPrinter(printer);
      Alert.alert("Printer Paired", `${printer.name} is now your default receipt printer.`);
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
    const printer: SavedPrinter = {
      type: "wifi",
      name: `${wifiHost.trim()}:${port}`,
      address: `${wifiHost.trim()}:${port}`,
    };
    await handleSelectPrinter(printer, printer.address);
  };

  const handleForget = async () => {
    await clearSavedPrinter();
    setSavedPrinter(null);
  };

  return (
    <ScrollView className="flex-1 bg-background dark:bg-bg-dark px-6" style={{ paddingTop: topInset }} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text className="text-2xl font-bold text-on-surface dark:text-text-primary-dark mb-1">
        Printer Settings
      </Text>
      <Text className="text-sm text-on-surface-variant dark:text-text-secondary-dark mb-6">
        Pair a thermal receipt printer over Bluetooth, USB, or Wi-Fi/LAN.
      </Text>

      {savedPrinter && (
        <View className="bg-primary/10 dark:bg-primary-dark/15 rounded-2xl p-4 mb-6 border border-primary/20 flex-row justify-between items-center">
          <View className="flex-1 mr-2">
            <Text className="text-sm font-bold text-primary uppercase tracking-wider mb-1">
              Currently Paired
            </Text>
            <Text className="text-base font-bold text-on-surface dark:text-text-primary-dark">
              {savedPrinter.name}
            </Text>
            <Text className="text-sm text-on-surface-variant dark:text-text-secondary-dark uppercase mt-0.5">
              {savedPrinter.type}
            </Text>
          </View>
          <Pressable onPress={handleForget} className="px-4 py-2 rounded-xl bg-error/10">
            <Text className="text-error font-bold text-sm">Forget</Text>
          </Pressable>
        </View>
      )}

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
                handleSelectPrinter(
                  { type: "bluetooth", name: d.device_name || d.inner_mac_address, address: d.inner_mac_address },
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
              {connectingKey === d.inner_mac_address ? <ActivityIndicator size="small" color="#0F7A5F" /> : <Text className="text-primary font-bold">Connect</Text>}
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
                  handleSelectPrinter(
                    { type: "usb", name: d.device_name || `USB Printer (${key})`, address: key },
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
                {connectingKey === key ? <ActivityIndicator size="small" color="#0F7A5F" /> : <Text className="text-primary font-bold">Connect</Text>}
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
