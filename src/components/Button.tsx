import React from "react";
import { Pressable, Text, ActivityIndicator, PressableProps, ViewStyle } from "react-native";
import { useTheme } from "react-native-paper";

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";

interface ButtonProps extends PressableProps {
 title: string;
 variant?: ButtonVariant;
 loading?: boolean;
 icon?: React.ReactNode;
 size?: "sm" | "md" | "lg";
 fullWidth?: boolean;
}

const variantStyles: Record<ButtonVariant, { bg: string; text: string; border: string }> = {
 primary: {
 bg: "bg-primary",
 text: "text-white",
 border: "",
 },
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

const sizeStyles: Record<string, { py: string; text: string }> = {
 sm: { py: "py-3", text: "text-sm" },
 md: { py: "py-4", text: "text-base" },
 lg: { py: "py-5", text: "text-lg" },
};

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
 const vs = variantStyles[variant];
 const ss = sizeStyles[size];

 return (
 <Pressable
 disabled={disabled || loading}
 className={`
 ${vs.bg} ${vs.border} ${ss.py} px-6 rounded-xl items-center justify-center flex-row gap-2
 ${fullWidth ? "w-full" : ""}
 ${disabled || loading ? "opacity-50" : "active:opacity-90"}
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
