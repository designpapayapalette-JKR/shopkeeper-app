import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
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

// App-wide confirmation dialog: works identically on web and native (unlike
// Alert.alert, which is a no-op on react-native-web), and returns a promise
// so call sites can `if (!(await confirm({...}))) return;` before any
// destructive action.
export function ConfirmDialogProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions>({ title: "" });
  const resolver = useRef<((value: boolean) => void) | null>(null);

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
      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => handle(false)}>
        <View className="flex-1 bg-black/40 items-center justify-center px-8">
          <View className="bg-surface-container-lowest dark:bg-surface-dark rounded-xl p-lg w-full" style={{ maxWidth: 360 }}>
            <View className="flex-row items-center" style={{ gap: 12 }}>
              {options.destructive && (
                <View className="w-10 h-10 rounded-full bg-error/10 items-center justify-center">
                  <MaterialCommunityIcons name="alert" size={20} color="#D64545" />
                </View>
              )}
              <Text className="font-headline-sm text-headline-sm text-on-surface dark:text-text-primary-dark flex-1">
                {options.title}
              </Text>
            </View>
            {options.message && (
              <Text className="font-body-md text-body-md text-on-surface-variant dark:text-text-secondary-dark mt-sm">
                {options.message}
              </Text>
            )}
            <View className="flex-row mt-lg" style={{ gap: 8 }}>
              <Pressable
                onPress={() => handle(false)}
                className="flex-1 py-3 rounded-xl items-center border border-outline-variant dark:border-outline active:bg-surface-container"
              >
                <Text className="font-label-md text-label-md text-on-surface dark:text-text-primary-dark">
                  {options.cancelLabel ?? "Cancel"}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => handle(true)}
                className={`flex-1 py-3 rounded-xl items-center active:opacity-90 ${
                  options.destructive ? "bg-error" : "bg-primary dark:bg-primary-dark"
                }`}
              >
                <Text className="font-label-md text-label-md text-white">
                  {options.confirmLabel ?? "Confirm"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
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
