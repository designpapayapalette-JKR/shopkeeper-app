import React, { ReactNode } from "react";
import {
 KeyboardAvoidingView,
 Platform,
 ScrollView,
 View,
 Keyboard,
 TouchableWithoutFeedback,
 StatusBar,
 StyleSheet,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface ScreenShellProps {
 children: ReactNode;
 /** Avoid keyboard when TextInput is focused (default: true) */
 avoidKeyboard?: boolean;
 /** Enable scroll when content overflows (default: true) */
 scrollable?: boolean;
 /** Extra bottom padding for absolute-positioned buttons */
 bottomPadding?: number;
 /** Extra top padding (default: uses safe area inset) */
 topPadding?: number;
 /** Background color */
 bg?: string;
}

export default function ScreenShell({
 children,
 avoidKeyboard = true,
 scrollable = true,
 bottomPadding = 0,
 topPadding,
 bg = "bg-background",
}: ScreenShellProps) {
 const insets = useSafeAreaInsets();

 const content = (
 <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
 <View
 className={`flex-1 ${bg}`}
 // Use safe-area insets + a minimum padding to avoid keyboard
 // overlap on small devices.
 style={{
 paddingTop: topPadding ?? insets.top,
 paddingBottom: Math.max(insets.bottom, 16) + bottomPadding,
 paddingLeft: Math.max(insets.left, 16),
 paddingRight: Math.max(insets.right, 16),
 }}
 >
 {scrollable ? (
 <ScrollView
 keyboardShouldPersistTaps="handled"
 showsVerticalScrollIndicator={false}
 contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}
 >
 {children}
 </ScrollView>
 ) : (
 children
 )}
 </View>
 </TouchableWithoutFeedback>
 );

 if (avoidKeyboard) {
 return (
 <KeyboardAvoidingView
 className="flex-1"
 behavior={Platform.OS === "ios" ? "padding" : undefined}
 keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
 // On Android we rely on ScrollView + keyboardShouldPersistTaps,
 // but this prop helps with some manufacturers' keyboard overlays.
 style={{ flex: 1 }}
 >
 {content}
 </KeyboardAvoidingView>
 );
 }

 return content;
}
