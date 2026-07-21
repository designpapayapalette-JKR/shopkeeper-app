import React, { useRef, useEffect } from "react";
import { Pressable, Animated } from "react-native";
import { useTheme } from "react-native-paper";

interface ToggleSwitchProps {
 value: boolean;
 onValueChange: (value: boolean) => void;
 disabled?: boolean;
}

const TRACK_WIDTH = 48;
const TRACK_HEIGHT = 28;
const THUMB_SIZE = 22;
const THUMB_MARGIN = 3;

export default function ToggleSwitch({
 value,
 onValueChange,
 disabled,
}: ToggleSwitchProps) {
 const theme = useTheme();
 const animatedValue = useRef(new Animated.Value(value ? 1 : 0)).current;

 useEffect(() => {
 Animated.timing(animatedValue, {
 toValue: value ? 1 : 0,
 duration: 200,
 useNativeDriver: false,
 }).start();
 }, [value, animatedValue]);

 const trackColor = animatedValue.interpolate({
 inputRange: [0, 1],
 outputRange: [theme.colors.outlineVariant, theme.colors.primary],
 });

 const thumbTranslate = animatedValue.interpolate({
 inputRange: [0, 1],
 outputRange: [0, TRACK_WIDTH - THUMB_SIZE - THUMB_MARGIN * 2],
 });

 return (
 <Pressable
 onPress={() => {
 if (!disabled) onValueChange(!value);
 }}
 disabled={disabled}
 accessibilityRole="switch"
 accessibilityState={{ checked: value }}
 style={{ opacity: disabled ? 0.5 : 1 }}
 >
 <Animated.View
 style={{
 width: TRACK_WIDTH,
 height: TRACK_HEIGHT,
 borderRadius: TRACK_HEIGHT / 2,
 backgroundColor: trackColor,
 justifyContent: "center",
 paddingHorizontal: THUMB_MARGIN,
 }}
 >
 <Animated.View
 style={{
 width: THUMB_SIZE,
 height: THUMB_SIZE,
 borderRadius: THUMB_SIZE / 2,
 backgroundColor: "#FFFFFF",
 shadowColor: "#000",
 shadowOffset: { width: 0, height: 1 },
 shadowOpacity: 0.2,
 shadowRadius: 2,
 elevation: 3,
 transform: [{ translateX: thumbTranslate }],
 }}
 />
 </Animated.View>
 </Pressable>
 );
}
