import React, { useState } from "react";
import { View, Text, ScrollView, Pressable, Modal } from "react-native";
import { useTranslation } from "react-i18next";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useOutlet, Outlet } from "../lib/outlet-context";

const LOCATION_ICONS: Record<string, string> = {
  all: "domain",
  shop: "store",
  showroom: "store-cog",
  branch: "office-building",
  warehouse_only: "warehouse",
  office: "briefcase-outline",
};

export default function LocationSelectorBar({
  onLocationChange,
}: {
  onLocationChange?: (outletId: string | null) => void;
}) {
  const { t } = useTranslation();
  const { outlets, selectedOutletId, setSelectedOutletId, locationLabel } = useOutlet();
  const [modalVisible, setModalVisible] = useState(false);

  const handleSelect = (id: string | null) => {
    setSelectedOutletId(id);
    onLocationChange?.(id);
    setModalVisible(false);
  };

  return (
    <View className="px-5 my-2">
      {/* Location Filter Selector Capsule */}
      <Pressable
        onPress={() => setModalVisible(true)}
        className="flex-row items-center justify-between bg-surface-container-lowest border border-outline-variant rounded-2xl px-4 py-2.5 shadow-sm"
      >
        <View className="flex-row items-center" style={{ gap: 8 }}>
          <View className="w-8 h-8 rounded-full bg-primary/10 items-center justify-center">
            <MaterialCommunityIcons
              name={(selectedOutletId ? LOCATION_ICONS[outlets.find((o) => o.id === selectedOutletId)?.type || "shop"] : "domain") as any}
              size={18}
              color="#0368FE"
            />
          </View>
          <View>
            <Text className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">
              {t("common.location", "Location")}
            </Text>
            <Text className="text-sm font-bold text-on-surface" numberOfLines={1}>
              {locationLabel}
            </Text>
          </View>
        </View>

        <View className="flex-row items-center bg-surface-container-high px-2.5 py-1 rounded-full" style={{ gap: 4 }}>
          <Text className="text-xs font-semibold text-primary">
            {selectedOutletId ? t("common.filter", "Filter") : t("common.allLocations", "All Locations")}
          </Text>
          <MaterialCommunityIcons name="chevron-down" size={16} color="#0368FE" />
        </View>
      </Pressable>

      {/* Location Selector Bottom Sheet Modal */}
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <Pressable className="flex-1 bg-black/40 justify-end" onPress={() => setModalVisible(false)}>
          <Pressable className="bg-surface-container-lowest rounded-t-3xl p-5 max-h-[80%]" onPress={() => {}}>
            <View className="w-10 h-1 bg-outline-variant rounded-full align-self-center mb-4 self-center" />
            <Text className="text-lg font-bold text-on-surface mb-1">
              {t("common.selectLocation", "Select Business Location")}
            </Text>
            <Text className="text-xs text-on-surface-variant mb-4">
              {t("dashboard.locationFilterHint", "Filter metrics by individual branch, shop, or warehouse")}
            </Text>

            <ScrollView className="mb-4">
              {/* Option: All Locations */}
              <Pressable
                onPress={() => handleSelect(null)}
                className={`flex-row items-center justify-between p-3.5 rounded-2xl mb-2 border ${
                  selectedOutletId === null ? "bg-primary/10 border-primary" : "bg-surface-container-low border-outline-variant"
                }`}
              >
                <View className="flex-row items-center" style={{ gap: 12 }}>
                  <View className="w-9 h-9 rounded-xl bg-primary/20 items-center justify-center">
                    <MaterialCommunityIcons name="domain" size={20} color="#0368FE" />
                  </View>
                  <View>
                    <Text className="text-sm font-bold text-on-surface">
                      {t("common.allLocations", "All Locations")}
                    </Text>
                    <Text className="text-xs text-on-surface-variant">
                      Consolidated business overview across all outlets
                    </Text>
                  </View>
                </View>
                {selectedOutletId === null && (
                  <MaterialCommunityIcons name="check-circle" size={20} color="#0368FE" />
                )}
              </Pressable>

              {/* Individual Outlets / Warehouses / Branches */}
              {outlets.map((item: Outlet) => {
                const isSelected = selectedOutletId === item.id;
                const iconName = LOCATION_ICONS[item.type] || "store";
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => handleSelect(item.id)}
                    className={`flex-row items-center justify-between p-3.5 rounded-2xl mb-2 border ${
                      isSelected ? "bg-primary/10 border-primary" : "bg-surface-container-low border-outline-variant"
                    }`}
                  >
                    <View className="flex-row items-center" style={{ gap: 12 }}>
                      <View className="w-9 h-9 rounded-xl bg-primary/15 items-center justify-center">
                        <MaterialCommunityIcons name={iconName as any} size={20} color="#0368FE" />
                      </View>
                      <View>
                        <Text className="text-sm font-bold text-on-surface">{item.name}</Text>
                        <Text className="text-xs text-on-surface-variant capitalize">
                          {item.type.replace("_", " ")} {item.code ? `• ${item.code}` : ""}
                        </Text>
                      </View>
                    </View>
                    {isSelected && (
                      <MaterialCommunityIcons name="check-circle" size={20} color="#0368FE" />
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>

            <Pressable
              onPress={() => setModalVisible(false)}
              className="bg-surface-container-high py-3 rounded-2xl items-center"
            >
              <Text className="text-sm font-bold text-on-surface">{t("common.cancel", "Cancel")}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
