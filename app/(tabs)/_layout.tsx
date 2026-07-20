import React, { useState, useMemo } from "react";
import { BottomNavigation, useTheme } from "react-native-paper";
import { useAuth } from "../../src/lib/auth-context";
import { useModuleVisibility } from "../../src/lib/useModuleVisibility";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import HomeScreen from "./index";
import PosScreen from "./pos";
import GlobalSearchScreen from "../global-search";
import ProfileScreen from "../profile";

export default function TabsLayout() {
  const theme = useTheme();
  const { userRole } = useAuth();
  const { isModuleEnabled } = useModuleVisibility(userRole);
  const insets = useSafeAreaInsets();

  const showPos = isModuleEnabled("pos") && userRole !== "warehouse_manager";

  const routes = useMemo(() => {
    const items: { key: string; title: string; focusedIcon: string; unfocusedIcon: string }[] = [
      { key: "home", title: "Home", focusedIcon: "view-dashboard", unfocusedIcon: "view-dashboard-outline" },
    ];
    if (showPos) {
      items.push({ key: "pos", title: "POS", focusedIcon: "point-of-sale", unfocusedIcon: "point-of-sale" });
    }
    items.push(
      { key: "search", title: "Search", focusedIcon: "magnify", unfocusedIcon: "magnify" },
      { key: "profile", title: "Me", focusedIcon: "account", unfocusedIcon: "account-outline" }
    );
    return items;
  }, [showPos]);

  const [index, setIndex] = useState(0);

  const renderScene = BottomNavigation.SceneMap({
    home: HomeScreen,
    pos: PosScreen,
    search: GlobalSearchScreen,
    profile: ProfileScreen,
  });

  return (
    <BottomNavigation
      navigationState={{ index, routes }}
      onIndexChange={setIndex}
      renderScene={renderScene}
      activeColor={theme.colors.primary}
      inactiveColor={theme.colors.onSurfaceVariant}
      barStyle={{
        backgroundColor: theme.colors.surface,
        height: 62 + insets.bottom,
        paddingBottom: 8 + insets.bottom,
        paddingTop: 4,
        borderTopWidth: 0,
        elevation: 12,
        shadowColor: "#000",
        shadowOpacity: 0.06,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: -2 },
      }}
      labeled
    />
  );
}
