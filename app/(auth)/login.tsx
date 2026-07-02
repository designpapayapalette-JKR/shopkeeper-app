import { Text, View } from "react-native";

export default function LoginScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-background px-6 dark:bg-background-dark">
      <Text className="text-2xl font-semibold text-text-primary dark:text-text-primary-dark">
        Shopkeeper
      </Text>
      <Text className="mt-2 text-text-secondary dark:text-text-secondary-dark">
        Login screen — placeholder (Phase 1)
      </Text>
    </View>
  );
}
