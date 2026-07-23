import React, { useRef, useState } from "react";
import { View, Text, ScrollView, Dimensions, NativeSyntheticEvent, NativeScrollEvent } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

export interface KpiCarouselItem {
  value: string;
  label: string;
  color: string;
  icon: string;
  delta?: { text: string; direction: "up" | "down" };
}

const SCREEN_WIDTH = Dimensions.get("window").width;
const CARD_MARGIN = 20;
const CARD_WIDTH = SCREEN_WIDTH - CARD_MARGIN * 2;
const CARD_SPACING = 10;

function darken(hex: string, factor: number): string {
  const clean = hex.replace("#", "");
  const num = parseInt(clean, 16);
  const r = Math.max(0, Math.floor(((num >> 16) & 0xff) * factor));
  const g = Math.max(0, Math.floor(((num >> 8) & 0xff) * factor));
  const b = Math.max(0, Math.floor((num & 0xff) * factor));
  return `rgb(${r}, ${g}, ${b})`;
}

// Full-width swipeable stat cards + dot pagination, floating up over the
// header's gradient bottom edge (same "anchored card" language as
// Login/Profile) rather than sitting in a dead gap below it — per user
// feedback on spacing + card design (feedback_ui_visual_quality.md).
// Pattern from the PNB reference (data/Mobile App Ref/PNB.jpg).
export default function KpiCarousel({ items }: { items: KpiCarouselItem[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const index = Math.round(x / (CARD_WIDTH + CARD_SPACING));
    if (index !== activeIndex && index >= 0 && index < items.length) {
      setActiveIndex(index);
    }
  };

  if (items.length === 0) return null;

  return (
    <View style={{ marginTop: -32 }}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={CARD_WIDTH + CARD_SPACING}
        decelerationRate="fast"
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingHorizontal: CARD_MARGIN, gap: CARD_SPACING, paddingVertical: 4 }}
      >
        {items.map((item, i) => (
          <View
            key={i}
            style={{
              width: CARD_WIDTH,
              borderRadius: 26,
              backgroundColor: "#FFFFFF",
              padding: 20,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.1,
              shadowRadius: 20,
              elevation: 8,
            }}
          >
            <View className="flex-row items-center justify-between mb-4">
              <LinearGradient
                colors={[item.color, darken(item.color, 0.62)]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 15,
                  alignItems: "center",
                  justifyContent: "center",
                  shadowColor: item.color,
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                  elevation: 3,
                }}
              >
                <MaterialCommunityIcons name={item.icon as any} size={22} color="#FFFFFF" />
              </LinearGradient>
              {item.delta && (
                <View
                  className="flex-row items-center"
                  style={{
                    gap: 3,
                    backgroundColor: item.delta.direction === "down" ? "#FCE9E9" : "#E6F5EC",
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: 999,
                  }}
                >
                  <MaterialCommunityIcons
                    name={item.delta.direction === "down" ? "arrow-down" : "arrow-up"}
                    size={12}
                    color={item.delta.direction === "down" ? "#D64545" : "#2E9E5B"}
                  />
                  <Text style={{ fontSize: 12, fontWeight: "700", color: item.delta.direction === "down" ? "#D64545" : "#2E9E5B" }}>
                    {item.delta.text}
                  </Text>
                </View>
              )}
            </View>
            <Text style={{ fontSize: 13, fontWeight: "700", letterSpacing: 0.3, textTransform: "uppercase", color: "#6B7280" }}>
              {item.label}
            </Text>
            <Text
              style={{ fontSize: 38, fontWeight: "800", color: "#15171A", marginTop: 4 }}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.55}
            >
              {item.value}
            </Text>
          </View>
        ))}
      </ScrollView>

      {items.length > 1 && (
        <View className="flex-row items-center justify-center mt-3" style={{ gap: 6 }}>
          {items.map((_, i) => (
            <View
              key={i}
              style={{
                width: i === activeIndex ? 18 : 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: i === activeIndex ? items[activeIndex].color : "#D9D9D9",
              }}
            />
          ))}
        </View>
      )}
    </View>
  );
}
