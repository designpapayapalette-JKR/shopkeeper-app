import React from "react";
import { List, Switch } from "react-native-paper";
import { useTheme } from "react-native-paper";

interface SettingsRowProps {
 title: string;
 description?: string;
 icon: string;
 /** Navigates — mutually exclusive with `switchValue` (never both on one row, §6.9) */
 onPress?: () => void;
 switchValue?: boolean;
 onSwitchChange?: (value: boolean) => void;
}

// Standard settings list row: icon + title (+ optional description) +
// trailing chevron OR switch, never both. shopkeeper-mobile-design-system.md §6.9.
export default function SettingsRow({ title, description, icon, onPress, switchValue, onSwitchChange }: SettingsRowProps) {
 const theme = useTheme();
 const isToggle = switchValue !== undefined && onSwitchChange !== undefined;

 return (
 <List.Item
 title={title}
 description={description}
 titleStyle={{ fontSize: 16, fontWeight: "600" }}
 descriptionStyle={{ fontSize: 13 }}
 descriptionNumberOfLines={2}
 left={(props) => <List.Icon {...props} icon={icon} />}
 right={(props) =>
 isToggle ? (
 <Switch value={switchValue} onValueChange={onSwitchChange} color={theme.colors.primary} />
 ) : onPress ? (
 <List.Icon {...props} icon="chevron-right" />
 ) : null
 }
 onPress={isToggle ? undefined : onPress}
 style={{ minHeight: 56 }}
 />
 );
}
