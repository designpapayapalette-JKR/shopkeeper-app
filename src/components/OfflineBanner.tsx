import React, { useEffect, useState } from "react";
import { View, Text } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getIsConnected, subscribeToConnectivity } from "../lib/connectivity";

// Persistent (not dismissible) banner shown app-wide while offline. Calm,
// not alarming — for this audience, patchy network is normal and expected,
// not an error. See shopkeeper-mobile-design-system.md §6.13 / §7.7.
export default function OfflineBanner() {
 const [connected, setConnected] = useState(getIsConnected());
 const insets = useSafeAreaInsets();

 useEffect(() => subscribeToConnectivity(setConnected), []);

 if (connected) return null;

 return (
 <View
 className="flex-row items-center justify-center bg-surface-container-high"
 style={{ paddingTop: insets.top + 8, paddingBottom: 8, paddingHorizontal: 12, gap: 8 }}
 >
 <MaterialCommunityIcons name="wifi-off" size={16} color="#3e4944" />
 <Text className="font-body-md text-on-surface-variant text-center" style={{ fontSize: 13 }}>
 No internet. Your work is saved on this phone.
 </Text>
 </View>
 );
}
