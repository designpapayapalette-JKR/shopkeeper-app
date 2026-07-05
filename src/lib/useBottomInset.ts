import { useSafeAreaInsets } from "react-native-safe-area-context";

// Modal/form footers previously used fixed pb-10/mb-20 Tailwind classes for
// bottom spacing, which assumed a specific gesture-nav-bar height and left
// action buttons (Cancel/Save/Add) sitting behind the phone's on-screen
// navigation buttons on devices with a taller inset. This computes the same
// visual weight relative to each device's actual safe area instead of a
// constant.
export function useBottomInset(extra: number = 16): number {
  const insets = useSafeAreaInsets();
  return Math.max(insets.bottom, 0) + extra;
}
