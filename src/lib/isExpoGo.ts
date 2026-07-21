import Constants, { ExecutionEnvironment } from "expo-constants";

// Detect Expo Go robustly: `executionEnvironment` is the modern API, but
// `appOwnership` is the older/more universally-populated field across SDK
// versions — check both so a change in either API surface can't silently
// break detection and let a native-module require() through to crash the
// app. This flag alone is still only a best-effort signal, which is why
// every native-module require() using it should ALSO be wrapped in
// try/catch as a safety net (see safeRequireReactNativeMaps below).
export const isExpoGo: boolean =
 Constants.appOwnership === "expo" ||
 Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

// Metro's bundler statically analyzes require() calls and requires a
// string literal argument — a generic `require(moduleName: string)` helper
// breaks bundling entirely (not just at runtime). So each native module
// used anywhere in this app gets its own named safe-require function here,
// with the literal string inline.

export function safeRequireReactNativeMaps(): typeof import("react-native-maps") | null {
 if (isExpoGo) return null;
 try {
 return require("react-native-maps");
 } catch (e) {
 console.warn('[isExpoGo] Native module "react-native-maps" unavailable:', e);
 return null;
 }
}
