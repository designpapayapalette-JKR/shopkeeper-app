import { Tabs } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

function TabIcon({
  active,
  inactive,
  focused,
}: {
  active: IconName;
  inactive: IconName;
  focused: boolean;
}) {
  return (
    <MaterialCommunityIcons
      name={focused ? active : inactive}
      size={focused ? 24 : 22}
      color={focused ? "#0F7A5F" : "#9E9E9E"}
    />
  );
}

export default function TabsLayout() {
  // Fixed height/padding here assumed every device has the same gesture-nav
  // footprint, which put the tab bar behind the system nav buttons/gesture
  // bar on devices with a taller bottom inset (3-button nav, some OEM skins).
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#FFFFFF",
          borderTopWidth: 0,
          elevation: 12,
          shadowColor: "#000",
          shadowOpacity: 0.06,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: -2 },
          height: 62 + insets.bottom,
          paddingBottom: 8 + insets.bottom,
          paddingTop: 8,
        },
        tabBarActiveTintColor: "#0F7A5F",
        tabBarInactiveTintColor: "#9E9E9E",
        tabBarLabelStyle: {
          fontSize: 10.5,
          fontWeight: "700",
          marginTop: 3,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ focused }) => (
            <TabIcon active="view-dashboard" inactive="view-dashboard-outline" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="pos"
        options={{
          title: "POS",
          tabBarIcon: ({ focused }) => (
            <TabIcon active="point-of-sale" inactive="point-of-sale" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="inventory"
        options={{
          title: "Inventory",
          tabBarIcon: ({ focused }) => (
            <TabIcon active="package-variant" inactive="package-variant-closed" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="ledger"
        options={{
          title: "Party",
          tabBarIcon: ({ focused }) => (
            <TabIcon active="account-group" inactive="account-group-outline" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="agents"
        options={{
          title: "Agents",
          tabBarIcon: ({ focused }) => (
            <TabIcon active="map-marker-radius" inactive="map-marker-radius-outline" focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}
