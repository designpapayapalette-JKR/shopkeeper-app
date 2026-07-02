import { Text, View } from "react-native";

export function PlaceholderScreen({ title }: { title: string }) {
  return (
    <View className="flex-1 items-center justify-center bg-background px-6 dark:bg-background-dark">
      <Text className="text-xl font-semibold text-text-primary dark:text-text-primary-dark">
        {title}
      </Text>
      <Text className="mt-2 text-text-secondary dark:text-text-secondary-dark">
        Placeholder — built out per the phased roadmap
      </Text>
    </View>
  );
}
