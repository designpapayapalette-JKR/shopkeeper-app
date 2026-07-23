import React, { useState } from "react";
import { Modal, View, Text, Pressable, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system";

interface PrintPreviewModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  html: string;
  filename?: string;
}

export default function PrintPreviewModal({
  visible,
  onClose,
  title,
  html,
  filename = "document.pdf",
}: PrintPreviewModalProps) {
  const insets = useSafeAreaInsets();
  const [exporting, setExporting] = useState<"pdf" | "share" | null>(null);

  const handlePrint = async () => {
    setExporting("pdf");
    try {
      await Print.printAsync({ html });
    } catch {
      // user cancelled print dialog
    } finally {
      setExporting(null);
    }
  };

  const handleShare = async () => {
    const canShare = await Sharing.isAvailableAsync();
    if (!canShare) return;

    setExporting("share");
    try {
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, {
        mimeType: "application/pdf",
        dialogTitle: title,
      });
    } finally {
      setExporting(null);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-outline-variant">
          <Pressable onPress={onClose} className="p-2">
            <MaterialCommunityIcons name="close" size={24} color="#3e4944" />
          </Pressable>
          <Text className="font-headline-sm text-on-surface flex-1 text-center" numberOfLines={1}>
            {title}
          </Text>
          <View className="flex-row" style={{ gap: 4 }}>
            <Pressable
              onPress={handlePrint}
              disabled={exporting !== null}
              className="p-2 rounded-lg bg-surface-container active:bg-surface-container-high"
            >
              {exporting === "pdf" ? (
                <ActivityIndicator size="small" color="#0368FE" />
              ) : (
                <MaterialCommunityIcons name="printer" size={22} color="#0368FE" />
              )}
            </Pressable>
            <Pressable
              onPress={handleShare}
              disabled={exporting !== null}
              className="p-2 rounded-lg bg-surface-container active:bg-surface-container-high"
            >
              {exporting === "share" ? (
                <ActivityIndicator size="small" color="#0368FE" />
              ) : (
                <MaterialCommunityIcons name="share-variant" size={22} color="#0368FE" />
              )}
            </Pressable>
          </View>
        </View>

        {/* Preview */}
        <View className="flex-1 bg-surface-container-low">
          <iframe
            srcDoc={html}
            style={{ width: "100%", height: "100%", border: "none" }}
            title="Print Preview"
          />
        </View>
      </View>
    </Modal>
  );
}
