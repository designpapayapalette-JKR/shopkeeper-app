import React from "react";
import { Text, View, Alert } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import type MapViewType from "react-native-maps";
import { safeRequireReactNativeMaps } from "../lib/isExpoGo";

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

function formatLastSeen(mins: number): string {
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  return `${h}h ${mins % 60}m ago`;
}

interface Props {
  agents: AgentMapSummary[];
  mapRef: React.RefObject<MapViewType | null>;
  selectedAgentId: string | null;
  onSelectAgent: (agentId: string) => void;
  defaultRegion: Region;
}

function ExpoGoFallback() {
  return (
    <View className="flex-1 justify-center items-center px-8 bg-background dark:bg-background-dark">
      <MaterialCommunityIcons name="map-marker-radius-outline" size={48} color="#9E9E9E" style={{ marginBottom: 16 }} />
      <Text className="text-text-primary dark:text-text-primary-dark font-bold text-center text-base">
        Live map needs the full app build
      </Text>
      <Text className="text-text-secondary text-sm text-center mt-1">
        Expo Go can't load native maps. Switch to List view above, or open a
        dev-client / installed build to see the live map.
      </Text>
    </View>
  );
}

export default function AgentMapView(props: Props) {
  const maps = safeRequireReactNativeMaps();
  if (!maps) {
    return <ExpoGoFallback />;
  }
  return <NativeAgentMapView {...props} maps={maps} />;
}

function NativeAgentMapView({
  agents,
  mapRef,
  selectedAgentId,
  onSelectAgent,
  defaultRegion,
  maps,
}: Props & { maps: NonNullable<ReturnType<typeof safeRequireReactNativeMaps>> }) {
  const {
    default: MapView,
    Marker,
    Callout,
    PROVIDER_DEFAULT,
  } = maps;

  return (
    <MapView
      ref={mapRef}
      provider={PROVIDER_DEFAULT}
      style={{ flex: 1 }}
      initialRegion={
        agents.length === 1
          ? {
              latitude: agents[0].latitude,
              longitude: agents[0].longitude,
              latitudeDelta: 0.05,
              longitudeDelta: 0.05,
            }
          : defaultRegion
      }
      showsUserLocation={false}
      showsMyLocationButton={false}
    >
      {agents.map((agent) => {
        const isSelected = selectedAgentId === agent.agent_id;
        return (
          <Marker
            key={agent.agent_id}
            coordinate={{
              latitude: agent.latitude,
              longitude: agent.longitude,
            }}
            onPress={() => onSelectAgent(agent.agent_id)}
          >
            <View
              style={{
                alignItems: "center",
                transform: [{ scale: isSelected ? 1.15 : 1 }],
              }}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: isSelected ? "#0368FE" : "#1F2937",
                  borderWidth: 3,
                  borderColor: isSelected ? "#03A8FE" : "#374151",
                  justifyContent: "center",
                  alignItems: "center",
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.3,
                  shadowRadius: 4,
                  elevation: 6,
                }}
              >
                <Text
                  style={{
                    color: "white",
                    fontWeight: "900",
                    fontSize: 14,
                  }}
                >
                  {agent.initials}
                </Text>
              </View>
              <View
                style={{
                  width: 0,
                  height: 0,
                  borderLeftWidth: 6,
                  borderRightWidth: 6,
                  borderTopWidth: 8,
                  borderLeftColor: "transparent",
                  borderRightColor: "transparent",
                  borderTopColor: isSelected ? "#0368FE" : "#1F2937",
                  marginTop: -1,
                }}
              />
            </View>

            <Callout
              tooltip={false}
              onPress={() =>
                Alert.alert(
                  agent.name,
                  `Last seen: ${formatLastSeen(agent.minutesAgo)}\nLat: ${agent.latitude.toFixed(5)}\nLng: ${agent.longitude.toFixed(5)}${agent.accuracy ? `\nAccuracy: ±${agent.accuracy.toFixed(0)}m` : ""}`
                )
              }
            >
              <View
                style={{
                  backgroundColor: "white",
                  borderRadius: 12,
                  padding: 10,
                  minWidth: 140,
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.15,
                  shadowRadius: 6,
                  elevation: 4,
                }}
              >
                <Text
                  style={{
                    fontWeight: "900",
                    fontSize: 15,
                    color: "#1A1A1A",
                  }}
                >
                  {agent.name}
                </Text>
                <Text
                  style={{
                    fontSize: 13,
                    color: "#6B6B6B",
                    marginTop: 2,
                  }}
                >
                  Last seen: {formatLastSeen(agent.minutesAgo)}
                </Text>
                {agent.accuracy && (
                  <Text style={{ fontSize: 12, color: "#9E9E9E", marginTop: 1 }}>
                    ±{agent.accuracy.toFixed(0)}m accuracy
                  </Text>
                )}
                <Text
                  style={{
                    fontSize: 12,
                    color: "#0368FE",
                    fontWeight: "700",
                    marginTop: 4,
                  }}
                >
                  Tap for details →
                </Text>
              </View>
            </Callout>
          </Marker>
        );
      })}
    </MapView>
  );
}
