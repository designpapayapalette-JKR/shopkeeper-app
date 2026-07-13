import React from "react";
import { Text, TextInput, TextInputProps, View } from "react-native";

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
  placeholderTextColor = "#A0A0A0",
  ...props
}: InputProps) {
  return (
    <View className="mb-4">
      {label && (
        <Text className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
          {label}
          {required && <Text className="text-error"> *</Text>}
        </Text>
      )}
      <TextInput
        placeholderTextColor={placeholderTextColor}
        className={`
          bg-white dark:bg-zinc-800
          text-gray-900 dark:text-gray-100
          border border-gray-200 dark:border-zinc-700
          rounded-xl px-4 py-4 text-base font-medium
          ${error ? "border-error" : "focus:border-primary"}
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
