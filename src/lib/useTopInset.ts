import { useSafeAreaInsets } from "react-native-safe-area-context";

// Screens previously used fixed pt-12/14/20 Tailwind classes for top
// spacing, which assumed a specific status bar/notch height and broke on
// devices where that assumption didn't hold (Dynamic Island, tall Android
// status bars, devices with no notch at all). This computes the same visual
// weight relative to each device's actual safe area instead of a constant.
export function useTopInset(extra: number = 16): number {
  const insets = useSafeAreaInsets();
  return insets.top + extra;
}
