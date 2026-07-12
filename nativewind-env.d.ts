/**
 * NativeWind 4.2.6 (the version installed here) does not ship a `nativewind/types`
 * export that augments React Native's prop types with `className`, despite that
 * being the commonly-documented setup step for other NativeWind versions. Without
 * this file, every `className="..."` prop across the app fails `tsc --noEmit`
 * with "Property 'className' does not exist on type '...Props'".
 *
 * This augments React Native's own prop interfaces directly instead.
 */
import "react-native";

declare module "react-native" {
  interface ViewProps {
    className?: string;
  }
  interface TextProps {
    className?: string;
  }
  interface ScrollViewProps {
    className?: string;
    contentContainerClassName?: string;
  }
  interface PressableProps {
    className?: string;
  }
  interface TextInputProps {
    className?: string;
  }
  interface KeyboardAvoidingViewProps {
    className?: string;
  }
  interface ActivityIndicatorProps {
    className?: string;
  }
  interface RefreshControlProps {
    className?: string;
  }
  interface SwitchProps {
    className?: string;
  }
  interface FlatListProps<ItemT> {
    className?: string;
    contentContainerClassName?: string;
  }
  interface ImageProps {
    className?: string;
  }
}
