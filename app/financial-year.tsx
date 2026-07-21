import React, { useState, useEffect } from "react";
import { Text, View, ScrollView, Pressable, ActivityIndicator, Alert } from "react-native";
import { useTheme } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { api, ApiError } from "../src/lib/api";
import { useConfirm } from "../src/components/ConfirmDialog";
import { useTopInset } from "../src/lib/useTopInset";

interface Closure {
 id: string;
 fyLabel: string;
 closedAt: string;
}

export default function FinancialYearScreen() {
 const theme = useTheme();
 const topInset = useTopInset();
 const confirm = useConfirm();
 const [currentFyLabel, setCurrentFyLabel] = useState("");
 const [closures, setClosures] = useState<Closure[]>([]);
 const [loading, setLoading] = useState(true);
 const [closing, setClosing] = useState(false);

 const load = async () => {
 setLoading(true);
 try {
 const res = await api.get<{ data: { currentFyLabel: string; closures: Closure[] } }>("/financial-year");
 setCurrentFyLabel(res.data.currentFyLabel);
 setClosures(res.data.closures || []);
 } catch {
 Alert.alert("Error", "Could not load financial year data.");
 } finally {
 setLoading(false);
 }
 };
 useEffect(() => { load(); }, []);

 const priorFyLabel = (() => {
 if (!currentFyLabel) return "";
 const [startYear] = currentFyLabel.split("-").map(Number);
 const prevStart = startYear - 1;
 return `${prevStart}-${String((prevStart + 1) % 100).padStart(2, "0")}`;
 })();

 const closeFy = async (fyLabel: string) => {
 const ok = await confirm({
 title: `Close FY ${fyLabel}?`,
 message: "New transactions can no longer be backdated into this year. Existing data is never deleted or modified.",
 confirmLabel: "Close Year",
 destructive: true,
 });
 if (!ok) return;
 setClosing(true);
 try {
 await api.post("/financial-year/close", { fyLabel });
 load();
 } catch (e) {
 Alert.alert("Error", e instanceof ApiError ? e.message : "Failed to close financial year.");
 } finally {
 setClosing(false);
 }
 };

 if (loading) {
 return (
 <View className="flex-1 items-center justify-center bg-background ">
 <ActivityIndicator color={theme.colors.primary} />
 </View>
 );
 }

 return (
 <View className="flex-1 bg-background " style={{ paddingTop: topInset + 8 }}>
 <ScrollView className="flex-1 px-4">
 <Text className="text-xl font-black text-on-surface mb-1">Financial Year Closing</Text>
 <Text className="text-sm text-on-surface-variant mb-4">
 India&apos;s financial year runs April–March. Closing a past year blocks new backdated transactions — it never deletes or alters existing records.
 </Text>

 <View className="bg-surface-container-lowest p-4 rounded-xl border border-outline-variant mb-4">
 <Text className="text-sm text-on-surface-variant ">Current financial year</Text>
 <Text className="text-lg font-black text-on-surface mt-0.5">{currentFyLabel} (open)</Text>
 </View>

 {closures.map((c) => (
 <View key={c.id} className="flex-row items-center justify-between py-3 border-b border-outline-variant ">
 <View className="flex-row items-center" style={{ gap: 6 }}>
 <MaterialCommunityIcons name="lock-outline" size={16} color={theme.colors.onSurfaceVariant} />
 <Text className="font-bold text-on-surface ">FY {c.fyLabel}</Text>
 </View>
 <Text className="text-xs text-on-surface-variant ">Closed {new Date(c.closedAt).toLocaleDateString("en-IN")}</Text>
 </View>
 ))}

 {priorFyLabel && !closures.some((c) => c.fyLabel === priorFyLabel) && (
 <Pressable
 onPress={() => closeFy(priorFyLabel)}
 disabled={closing}
 className="border border-primary py-3.5 rounded-xl items-center flex-row justify-center mt-5"
 style={{ gap: 6, opacity: closing ? 0.5 : 1 }}
 >
 {closing ? <ActivityIndicator color={theme.colors.primary} size="small" /> : (
 <>
 <MaterialCommunityIcons name="lock-outline" size={16} color={theme.colors.primary} />
 <Text className="text-primary font-bold">Close FY {priorFyLabel}</Text>
 </>
 )}
 </Pressable>
 )}
 </ScrollView>
 </View>
 );
}
