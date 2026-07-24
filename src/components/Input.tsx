import React from "react";
import { Text, TextInput, TextInputProps, View } from "react-native";
import { useTheme } from "react-native-paper";

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  required?: boolean;
}

export default function Input({
  label,
  error,
  required,
  className = "",
  placeholderTextColor,
  ...props
}: InputProps) {
  const theme = useTheme();

  return (
    <View className="mb-4">
      {label && (
        <Text className="text-sm font-semibold text-on-surface-variant mb-1.5">
          {label}
          {required && <Text className="text-error"> *</Text>}
        </Text>
      )}
      <TextInput
        placeholderTextColor={placeholderTextColor || theme.colors.onSurfaceVariant}
        className={`
          bg-surface-container-lowest
          text-on-surface
          border border-outline-variant
          rounded-xl px-4 py-4 text-base font-medium
          ${error ? "border-error" : ""}
          min-h-[48px]
          ${className}
        `}
        {...props}
      />
      {error && (
        <Text className="text-error text-xs font-semibold mt-1 ml-1">{error}</Text>
      )}
    </View>
  );
}
