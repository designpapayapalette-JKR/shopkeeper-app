import React from "react";
import { Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import type MapView from "react-native-maps";

export interface AgentMapSummary {
  agent_id: string;
  name: string;
  initials: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  minutesAgo: number;
}

interface Region {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

interface Props {
  agents: AgentMapSummary[];
  mapRef: React.RefObject<MapView>;
  selectedAgentId: string | null;
  onSelectAgent: (agentId: string) => void;
  defaultRegion: Region;
}

// react-native-maps is native-only; the web build shows a friendly stand-in
// instead of pulling in the native map renderer.
export default function AgentMapView(_props: Props) {
  return (
    <View className="flex-1 justify-center items-center px-8 bg-background dark:bg-background-dark">
      <MaterialCommunityIcons name="map-marker-radius-outline" size={48} color="#9E9E9E" style={{ marginBottom: 16 }} />
      <Text className="text-text-primary dark:text-text-primary-dark font-bold text-center text-base">
        Map view is available in the mobile app
      </Text>
      <Text className="text-text-secondary text-sm text-center mt-1">
        Switch to List view above to see agent locations here on web.
      </Text>
    </View>
  );
}
