import React from "react";
import { View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useTopInset } from "../../src/lib/useTopInset";
import PosDashboardPanel from "../../src/components/PosDashboardPanel";

// Standalone route wrapper around the shared POS dashboard panel — reached
// from Recent Activity / Activity Log deep-links (?openInvoiceId=...) and
// from More. The same panel is also embedded directly inside the POS tab's
// "Dashboard" mode (see pos.tsx) so the dashboard doesn't live in only one
// place.
export default function InvoiceHistoryScreen() {
  const topInset = useTopInset();
  const params = useLocalSearchParams<{ openInvoiceId?: string }>();

  return (
    <View className="flex-1 bg-background dark:bg-bg-dark" style={{ paddingTop: topInset }}>
      <PosDashboardPanel autoOpenInvoiceId={params.openInvoiceId} />
    </View>
  );
}
