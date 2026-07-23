import React from "react";
import { Pressable, Text, ActivityIndicator, PressableProps, View } from "react-native";
import { useTheme } from "react-native-paper";
import { LinearGradient } from "expo-linear-gradient";

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";

interface ButtonProps extends PressableProps {
 title: string;
 variant?: ButtonVariant;
 loading?: boolean;
 icon?: React.ReactNode;
 size?: "sm" | "md" | "lg";
 fullWidth?: boolean;
}

const flatVariantStyles: Partial<Record<ButtonVariant, { bg: string; text: string; border: string }>> = {
 secondary: {
 bg: "bg-primary-container",
 text: "text-white",
 border: "",
 },
 outline: {
 bg: "bg-transparent",
 text: "text-primary",
 border: "border border-primary",
 },
 ghost: {
 bg: "bg-transparent",
 text: "text-primary",
 border: "",
 },
 danger: {
 bg: "bg-error",
 text: "text-white",
 border: "",
 },
};

const sizeStyles: Record<string, { py: string; text: string; pad: number }> = {
 sm: { py: "py-3", text: "text-sm", pad: 12 },
 md: { py: "py-4", text: "text-base", pad: 16 },
 lg: { py: "py-5", text: "text-lg", pad: 20 },
};

// "primary" renders as a gradient-filled pill with a soft glow shadow — the
// same treatment used on Login/Dashboard's CTAs — instead of a flat
// single-color fill, per user feedback that flat buttons read as boring
// (see memory feedback_ui_visual_quality.md). Every other variant keeps its
// existing flat treatment (secondary/outline/ghost/danger are all
// lower-emphasis by design, so they don't need the same visual weight).
export default function Button({
 title,
 variant = "primary",
 loading = false,
 icon,
 size = "md",
 fullWidth = false,
 disabled,
 className = "",
 ...props
}: ButtonProps) {
 const theme = useTheme();
 const ss = sizeStyles[size];
 const isDisabled = disabled || loading;

 if (variant === "primary") {
 return (
 <Pressable disabled={isDisabled} className={`${fullWidth ? "w-full" : ""} ${className}`} {...props}>
 {({ pressed }) => (
 <LinearGradient
 colors={isDisabled ? ["#B9CFFB", "#B9CFFB"] : ["#0368FE", "#03A8FE"]}
 start={{ x: 0, y: 0 }}
 end={{ x: 1, y: 0 }}
 style={{
 paddingVertical: ss.pad,
 paddingHorizontal: 24,
 borderRadius: 14,
 alignItems: "center",
 justifyContent: "center",
 flexDirection: "row",
 gap: 8,
 opacity: pressed ? 0.9 : 1,
 minHeight: 44,
 shadowColor: "#0368FE",
 shadowOffset: { width: 0, height: 6 },
 shadowOpacity: isDisabled ? 0 : 0.3,
 shadowRadius: 10,
 elevation: isDisabled ? 0 : 5,
 }}
 >
 {loading ? (
 <ActivityIndicator color="white" size="small" />
 ) : (
 <>
 {icon}
 <Text className={`text-white font-bold ${ss.text}`}>{title}</Text>
 </>
 )}
 </LinearGradient>
 )}
 </Pressable>
 );
 }

 const vs = flatVariantStyles[variant]!;

 return (
 <Pressable
 disabled={isDisabled}
 className={`
 ${vs.bg} ${vs.border} ${ss.py} px-6 rounded-xl items-center justify-center flex-row gap-2
 ${fullWidth ? "w-full" : ""}
 ${isDisabled ? "opacity-50" : "active:opacity-90"}
 min-h-[44px]
 ${className}
 `}
 {...props}
 >
 {loading ? (
 <ActivityIndicator color={variant === "outline" || variant === "ghost" ? theme.colors.primary : "white"} size="small" />
 ) : (
 <>
 {icon && icon}
 <Text className={`${vs.text} font-bold ${ss.text}`}>{title}</Text>
 </>
 )}
 </Pressable>
 );
}
