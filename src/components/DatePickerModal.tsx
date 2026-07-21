import React, { useState, useMemo } from "react";
import { View, Text, Pressable, ScrollView, Platform } from "react-native";
import { Dialog, Portal, useTheme, Button } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";

const DAY_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

interface DatePickerModalProps {
 visible: boolean;
 onDismiss: () => void;
 onConfirm: (date: Date) => void;
 initialDate?: Date;
 title?: string;
}

function buildCalendarGrid(year: number, month: number): (number | null)[] {
 const firstDay = new Date(year, month, 1).getDay();
 const daysInMonth = new Date(year, month + 1, 0).getDate();
 const grid: (number | null)[] = [];
 for (let i = 0; i < firstDay; i++) grid.push(null);
 for (let d = 1; d <= daysInMonth; d++) grid.push(d);
 while (grid.length % 7 !== 0) grid.push(null);
 return grid;
}

export default function DatePickerModal({ visible, onDismiss, onConfirm, initialDate, title }: DatePickerModalProps) {
 const theme = useTheme();
 const today = new Date();
 const [viewYear, setViewYear] = useState(initialDate?.getFullYear() ?? today.getFullYear());
 const [viewMonth, setViewMonth] = useState(initialDate?.getMonth() ?? today.getMonth());
 const [selectedDate, setSelectedDate] = useState<Date>(initialDate ?? today);

 const grid = useMemo(() => buildCalendarGrid(viewYear, viewMonth), [viewYear, viewMonth]);

 const navigate = (delta: number) => {
 const d = new Date(viewYear, viewMonth + delta, 1);
 setViewYear(d.getFullYear());
 setViewMonth(d.getMonth());
 };

 const isToday = (day: number) => {
 return day === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear();
 };

 const isSelected = (day: number) => {
 return day === selectedDate.getDate() && viewMonth === selectedDate.getMonth() && viewYear === selectedDate.getFullYear();
 };

 const handleDayPress = (day: number) => {
 const d = new Date(viewYear, viewMonth, day);
 setSelectedDate(d);
 };

 const handleConfirm = () => {
 onConfirm(selectedDate);
 onDismiss();
 };

 return (
 <Portal>
 <Dialog visible={visible} onDismiss={onDismiss} style={{ maxWidth: 380, alignSelf: "center", width: "100%" }}>
 <Dialog.Title>{title || "Select Date"}</Dialog.Title>
 <Dialog.ScrollArea style={{ paddingHorizontal: 6, maxHeight: 420 }}>
 <ScrollView>
 <View>
 <View className="flex-row items-center justify-between px-2 mb-3">
 <Pressable onPress={() => navigate(-1)} className="w-10 h-10 items-center justify-center rounded-full active:opacity-60">
 <MaterialCommunityIcons name="chevron-left" size={24} color={theme.colors.primary} />
 </Pressable>
 <Text className="text-base font-bold" style={{ color: theme.colors.onSurface }}>
 {MONTHS[viewMonth]} {viewYear}
 </Text>
 <Pressable onPress={() => navigate(1)} className="w-10 h-10 items-center justify-center rounded-full active:opacity-60">
 <MaterialCommunityIcons name="chevron-right" size={24} color={theme.colors.primary} />
 </Pressable>
 </View>

 <View className="flex-row" style={{ gap: 2 }}>
 {DAY_HEADERS.map((h) => (
 <View key={h} className="flex-1 items-center py-1.5">
 <Text className="text-xs font-bold uppercase tracking-wider" style={{ color: theme.colors.onSurfaceVariant }}>{h}</Text>
 </View>
 ))}
 </View>

 {Array.from({ length: Math.ceil(grid.length / 7) }, (_, weekIdx) => {
 const week = grid.slice(weekIdx * 7, (weekIdx + 1) * 7);
 return (
 <View key={weekIdx} className="flex-row" style={{ gap: 2 }}>
 {week.map((day, dayIdx) => (
 <View key={dayIdx} className="flex-1 aspect-square items-center justify-center">
 {day !== null && (
 <Pressable
 onPress={() => handleDayPress(day)}
 className="w-9 h-9 items-center justify-center rounded-full"
 style={{
 backgroundColor: isSelected(day) ? theme.colors.primary : isToday(day) ? theme.colors.primaryContainer : "transparent",
 }}
 >
 <Text
 className="text-sm font-semibold"
 style={{
 color: isSelected(day)
 ? theme.colors.onPrimary
 : isToday(day)
 ? theme.colors.onPrimaryContainer
 : theme.colors.onSurface,
 }}
 >
 {day}
 </Text>
 </Pressable>
 )}
 </View>
 ))}
 </View>
 );
 })}
 </View>
 </ScrollView>
 </Dialog.ScrollArea>
 <Dialog.Actions>
 <Button onPress={onDismiss}>Cancel</Button>
 <Button onPress={handleConfirm}>OK</Button>
 </Dialog.Actions>
 </Dialog>
 </Portal>
 );
}
