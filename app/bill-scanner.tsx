import React, { useRef, useState } from "react";
import { View, Text, Pressable, Image, ActivityIndicator, Alert, StyleSheet } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useTheme } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTopInset } from "../src/lib/useTopInset";
import { useBottomInset } from "../src/lib/useBottomInset";
import { saveScan, ScanCategory } from "../src/lib/scanCapture";

const CATEGORY_META: Record<ScanCategory, { title: string; destination: (uri: string) => string }> = {
  purchase: {
    title: "Photograph the purchase bill",
    destination: (uri) => `/more?openPurchase=1&billPhotoUri=${encodeURIComponent(uri)}`,
  },
  product: {
    title: "Photograph the product",
    destination: (uri) => `/inventory?openAddProduct=1&photoUri=${encodeURIComponent(uri)}`,
  },
  expense: {
    title: "Photograph the expense receipt",
    destination: (uri) => `/more?openExpense=1&billPhotoUri=${encodeURIComponent(uri)}`,
  },
  transfer: {
    title: "Photograph the transfer receipt",
    destination: (uri) => `/more?openTransfer=1&transferPhotoUri=${encodeURIComponent(uri)}`,
  },
};

// Captures a photo (purchase bill / product / expense receipt), saves it
// permanently to the local Scanned Documents log, then hands the file off
// to whichever form actually uses it next. This does not read the image
// automatically (no OCR/line-item extraction) — it's a faster on-ramp into
// manual entry, and a permanent record you can find again later.
export default function BillScannerScreen() {
  const theme = useTheme();
  const router = useRouter();
  const topInset = useTopInset();
  const bottomInset = useBottomInset(0);
  const params = useLocalSearchParams<{ category?: ScanCategory }>();
  const category: ScanCategory = params.category && CATEGORY_META[params.category] ? params.category : "purchase";
  const meta = CATEGORY_META[category];

  const [permission, requestPermission] = useCameraPermissions();
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const cameraRef = useRef<CameraView | null>(null);

  const handleCapture = async () => {
    if (!cameraRef.current) return;
    setCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.6 });
      if (!photo) throw new Error("No photo returned");
      setCapturedUri(photo.uri);
    } catch (e: any) {
      Alert.alert("Capture Failed", e?.message || "Could not capture the photo.");
    } finally {
      setCapturing(false);
    }
  };

  const handleUsePhoto = async () => {
    if (!capturedUri) return;
    try {
      const saved = await saveScan(capturedUri, category);
      router.replace(meta.destination(saved.uri) as any);
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Could not save the photo.");
    }
  };

  if (!permission) {
    return (
      <View className="flex-1 items-center justify-center bg-black">
        <ActivityIndicator color="white" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View className="flex-1 items-center justify-center bg-background dark:bg-bg-dark px-8" style={{ paddingTop: topInset }}>
        <MaterialCommunityIcons name="camera-off-outline" size={48} color={theme.colors.onSurfaceVariant} style={{ marginBottom: 16 }} />
        <Text className="text-on-surface dark:text-text-primary-dark font-bold text-base text-center mb-4">
          Camera access is needed to {meta.title.toLowerCase()}.
        </Text>
        <Pressable onPress={requestPermission} className="bg-primary dark:bg-primary-dark px-6 py-3.5 rounded-2xl">
          <Text className="text-white font-bold text-sm">Grant Camera Access</Text>
        </Pressable>
        <Pressable onPress={() => router.back()} className="mt-4">
          <Text className="text-on-surface-variant dark:text-text-secondary-dark font-bold text-sm">Cancel</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-black">
      {capturedUri ? (
        <>
          <Image source={{ uri: capturedUri }} style={StyleSheet.absoluteFill} resizeMode="contain" />
          <View
            className="absolute left-0 right-0 bottom-0 flex-row px-6 pt-4 bg-black/60"
            style={{ paddingBottom: 32 + bottomInset, gap: 12 }}
          >
            <Pressable
              onPress={() => setCapturedUri(null)}
              className="flex-1 border border-white py-4 rounded-2xl items-center"
            >
              <Text className="text-white font-bold text-sm">Retake</Text>
            </Pressable>
            <Pressable
              onPress={handleUsePhoto}
              className="flex-1 bg-primary dark:bg-primary-dark py-4 rounded-2xl items-center"
            >
              <Text className="text-white font-bold text-sm">Use This Photo</Text>
            </Pressable>
          </View>
        </>
      ) : (
        <>
          <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />
          <View className="absolute left-0 right-0 flex-row justify-between items-center px-6" style={{ top: topInset + 8 }}>
            <Pressable onPress={() => router.back()} className="w-11 h-11 rounded-full bg-black/40 items-center justify-center">
              <MaterialCommunityIcons name="close" size={22} color="white" />
            </Pressable>
            <Text className="text-white font-bold text-sm bg-black/40 px-3 py-1.5 rounded-full">
              {meta.title}
            </Text>
          </View>
          <View className="absolute left-0 right-0 items-center" style={{ bottom: 40 + bottomInset }}>
            <Pressable
              onPress={handleCapture}
              disabled={capturing}
              className="w-20 h-20 rounded-full bg-white items-center justify-center border-4 border-white/40"
            >
              {capturing ? <ActivityIndicator color={theme.colors.primary} /> : <View className="w-16 h-16 rounded-full bg-primary" />}
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}

