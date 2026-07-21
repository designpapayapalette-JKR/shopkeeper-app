import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";

interface ConfirmOptions {
 title: string;
 message?: string;
 confirmLabel?: string;
 cancelLabel?: string;
 destructive?: boolean;
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmDialogContext = createContext<ConfirmFn | null>(null);

// App-wide confirmation — a bottom sheet, not a centered dialog, per
// shopkeeper-mobile-design-system.md §6.8: thumb-reachable one-handed, and
// call sites are expected to pass the specific amount/party name in
// `message` rather than a generic "Are you sure?" (a generic confirm gets
// tapped through on autopilot; a restated amount doesn't).
// Works identically on web and native (unlike Alert.alert, which is a no-op
// on react-native-web), and returns a promise so call sites can
// `if (!(await confirm({...}))) return;` before any destructive action.
export function ConfirmDialogProvider({ children }: { children: React.ReactNode }) {
 const [visible, setVisible] = useState(false);
 const [options, setOptions] = useState<ConfirmOptions>({ title: "" });
 const resolver = useRef<((value: boolean) => void) | null>(null);
 const insets = useSafeAreaInsets();

 const confirm = useCallback<ConfirmFn>((opts) => {
 setOptions(opts);
 setVisible(true);
 return new Promise<boolean>((resolve) => {
 resolver.current = resolve;
 });
 }, []);

 const handle = (result: boolean) => {
 setVisible(false);
 resolver.current?.(result);
 resolver.current = null;
 };

 return (
 <ConfirmDialogContext.Provider value={confirm}>
 {children}
 <Modal visible={visible} transparent animationType="slide" onRequestClose={() => handle(false)}>
 <Pressable
 className="flex-1 bg-black/40 justify-end"
 onPress={() => handle(false)}
 >
 <Pressable
 onPress={() => {}}
 className="bg-surface-container-lowest rounded-t-2xl px-lg pt-lg"
 style={{ paddingBottom: Math.max(insets.bottom, 16) + 16 }}
 >
 {/* Grab-handle affordance signals "this can be swiped down" even though we don't wire swipe-to-dismiss */}
 <View className="self-center rounded-full bg-outline-variant mb-lg" style={{ width: 40, height: 4 }} />

 <View className="flex-row items-center" style={{ gap: 12 }}>
 {options.destructive && (
 <View className="w-10 h-10 rounded-full bg-error/10 items-center justify-center">
 <MaterialCommunityIcons name="alert" size={20} color="#D64545" />
 </View>
 )}
 <Text className="font-headline-sm text-headline-sm text-on-surface flex-1">
 {options.title}
 </Text>
 </View>

 {options.message && (
 <Text className="font-body-lg text-body-md text-on-surface-variant mt-sm" style={{ fontSize: 16, lineHeight: 22 }}>
 {options.message}
 </Text>
 )}

 {/* Stacked, not side-by-side — same-weight buttons next to each other invite mis-taps under time pressure (§6.8) */}
 <View className="mt-lg" style={{ gap: 10 }}>
 <Pressable
 onPress={() => handle(true)}
 className={`items-center justify-center rounded-xl active:opacity-90 ${
 options.destructive ? "bg-error" : "bg-primary "
 }`}
 style={{ minHeight: 52 }}
 >
 <Text className="font-label-md text-white" style={{ fontSize: 16, fontWeight: "700" }}>
 {options.confirmLabel ?? "Confirm"}
 </Text>
 </Pressable>
 <Pressable
 onPress={() => handle(false)}
 className="items-center justify-center rounded-xl border border-outline-variant active:bg-surface-container"
 style={{ minHeight: 52 }}
 >
 <Text className="font-label-md text-on-surface " style={{ fontSize: 16, fontWeight: "600" }}>
 {options.cancelLabel ?? "Cancel"}
 </Text>
 </Pressable>
 </View>
 </Pressable>
 </Pressable>
 </Modal>
 </ConfirmDialogContext.Provider>
 );
}

export function useConfirm(): ConfirmFn {
 const ctx = useContext(ConfirmDialogContext);
 if (!ctx) {
 throw new Error("useConfirm must be used within a ConfirmDialogProvider");
 }
 return ctx;
}
