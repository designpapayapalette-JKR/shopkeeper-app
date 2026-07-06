import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Text,
  View,
  Pressable,
  ActivityIndicator,
  FlatList,
  RefreshControl,
} from "react-native";
import type MapView from "react-native-maps";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "../../src/lib/auth-context";
import { api } from "../../src/lib/api";
import AgentMapView from "../../src/components/AgentMapView";
import { useTopInset } from "../../src/lib/useTopInset";

interface AgentPing {
  id: string;
  agent_id: string;
  company_id: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp: string;
  agent?: { first_name?: string; last_name?: string };
}

interface AgentSummary {
  agent_id: string;
  name: string;
  initials: string;
  latitude: number | null;
  longitude: number | null;
  accuracy?: number;
  lastSeen: string | null;  // ISO string of most recent ping, null if never checked in
  minutesAgo: number | null;
}

interface StaffMember {
  id: string;
  first_name: string;
  last_name?: string;
  role: string;
}

type ViewMode = "map" | "list";

const AUTO_REFRESH_MS = 30_000; // 30-second auto-refresh

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function minutesAgo(isoStr: string): number {
  return Math.round((Date.now() - new Date(isoStr).getTime()) / 60_000);
}

function formatLastSeen(mins: number | null): string {
  if (mins === null) return "Never checked in";
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  return `${h}h ${mins % 60}m ago`;
}

function statusColor(mins: number | null): { dot: string; text: string } {
  if (mins === null) return { dot: "bg-gray-300", text: "text-on-surface-variant" };
  if (mins < 5) return { dot: "bg-green-500", text: "text-green-600" };
  if (mins < 30) return { dot: "bg-amber-400", text: "text-amber-600" };
  return { dot: "bg-gray-400", text: "text-on-surface-variant" };
}

export default function AgentsScreen() {
  const { user, activeCompany } = useAuth();
  const router = useRouter();
  const mapRef = useRef<MapView>(null);
  const topInset = useTopInset();

  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("map");
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const refreshTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  /**
   * Fetches all recent agent_locations (latest ping per agent) AND every
   * field_agent-role staff member, then merges them. Previously this only
   * showed agents who had already sent at least one location ping, so a
   * shop that had just added a field agent (but who hadn't opened the
   * Employee App / granted location permission yet) saw an empty list and
   * no way to tell the difference between "no agents" and "no check-ins
   * yet" — a real gap the founder hit directly.
   */
  const fetchAgentLocations = useCallback(async () => {
    if (!user?.company_id) return;

    try {
      const [pingsRes, staffRes] = await Promise.all([
        api.get<{ data: AgentPing[] }>("/agent-locations/latest"),
        api.get<{ data: StaffMember[] }>("/staff").catch(() => ({ data: [] as StaffMember[] })),
      ]);
      const pings = pingsRes.data ?? [];
      const fieldAgents = (staffRes.data ?? []).filter((s) => s.role === "field_agent");

      const byId = new Map<string, AgentSummary>();

      for (const ping of pings) {
        const name =
          `${ping.agent?.first_name ?? ""} ${ping.agent?.last_name ?? ""}`.trim() ||
          `Agent ${ping.agent_id.slice(0, 6).toUpperCase()}`;
        byId.set(ping.agent_id, {
          agent_id: ping.agent_id,
          name,
          initials: getInitials(name),
          latitude: ping.latitude,
          longitude: ping.longitude,
          accuracy: ping.accuracy,
          lastSeen: ping.timestamp,
          minutesAgo: minutesAgo(ping.timestamp),
        });
      }

      // Any field agent with no location ping yet still shows up, just
      // without map coordinates — "added but hasn't checked in" instead of
      // silently missing from the list entirely.
      for (const staff of fieldAgents) {
        if (byId.has(staff.id)) continue;
        const name = `${staff.first_name} ${staff.last_name ?? ""}`.trim();
        byId.set(staff.id, {
          agent_id: staff.id,
          name,
          initials: getInitials(name),
          latitude: null,
          longitude: null,
          lastSeen: null,
          minutesAgo: null,
        });
      }

      setAgents(Array.from(byId.values()));
    } catch (e) {
      console.error("Failed to fetch agent locations:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    fetchAgentLocations();

    // Auto-refresh every 30 seconds
    refreshTimer.current = setInterval(fetchAgentLocations, AUTO_REFRESH_MS);
    return () => {
      if (refreshTimer.current) clearInterval(refreshTimer.current);
    };
  }, [fetchAgentLocations]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchAgentLocations();
  };

  const flyToAgent = (agent: AgentSummary) => {
    if (agent.latitude === null || agent.longitude === null) return;
    setSelectedAgentId(agent.agent_id);
    setViewMode("map");
    mapRef.current?.animateToRegion(
      {
        latitude: agent.latitude,
        longitude: agent.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      },
      600
    );
  };

  const agentsOnMap = agents.filter((a) => a.latitude !== null && a.longitude !== null);

  // Default region — India centre (zoomed out to show all agents)
  const defaultRegion = {
    latitude: 20.5937,
    longitude: 78.9629,
    latitudeDelta: 15,
    longitudeDelta: 15,
  };

  if (loading) {
    return (
      <View className="flex-1 bg-background dark:bg-bg-dark justify-center items-center">
        <ActivityIndicator size="large" color="#0F7A5F" />
        <Text className="text-on-surface-variant mt-3 text-sm">
          Loading agent locations…
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background dark:bg-bg-dark">
      {/* ── Custom Header ── */}
      <View
        className="bg-surface-container-lowest dark:bg-surface-dark px-6 pb-4 border-b border-outline-variant dark:border-outline"
        style={{ paddingTop: topInset }}
      >
        <View className="flex-row justify-between items-center">
          <View>
            <Text className="text-xl font-black text-on-surface dark:text-text-primary-dark">
              Field Agents
            </Text>
            <Text className="text-sm text-on-surface-variant mt-0.5">
              {agents.length} agent{agents.length !== 1 ? "s" : ""} tracked ·{" "}
              refreshes every 30s
            </Text>
          </View>

          <View className="flex-row items-center" style={{ gap: 8 }}>
            <Pressable
              onPress={() => router.push("/walkie-talkie" as any)}
              className="w-11 h-11 rounded-xl bg-primary/10 items-center justify-center"
            >
              <MaterialCommunityIcons name="radio-handheld" size={20} color="#0F7A5F" />
            </Pressable>

          {/* Map / List toggle */}
          <View className="flex-row bg-surface-container dark:bg-surface-dark rounded-xl p-1 gap-1">
            {(["map", "list"] as ViewMode[]).map((mode) => (
              <Pressable
                key={mode}
                onPress={() => setViewMode(mode)}
                className={`px-4 py-3 rounded-lg ${
                  viewMode === mode
                    ? "bg-white dark:bg-zinc-700 shadow-sm"
                    : ""
                }`}
              >
                <View className="flex-row items-center" style={{ gap: 4 }}>
                  <MaterialCommunityIcons
                    name={mode === "map" ? "map-outline" : "format-list-bulleted"}
                    size={16}
                    color={viewMode === mode ? "#005f49" : "#3e4944"}
                  />
                  <Text
                    className={`text-sm font-bold capitalize ${
                      viewMode === mode
                        ? "text-on-surface dark:text-text-primary-dark"
                        : "text-on-surface-variant"
                    }`}
                  >
                    {mode === "map" ? "Map" : "List"}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
          </View>
        </View>
      </View>

      {/* ── Map View ── */}
      {viewMode === "map" && (
        <View className="flex-1">
          {agentsOnMap.length === 0 ? (
            <View className="flex-1 justify-center items-center px-8">
              <MaterialCommunityIcons name="map-marker-off-outline" size={40} color="#6e7a74" style={{ marginBottom: 16 }} />
              <Text className="text-on-surface dark:text-text-primary-dark font-bold text-center text-base">
                {agents.length === 0 ? "No field agents added yet" : "No agents have checked in yet"}
              </Text>
              <Text className="text-on-surface-variant text-sm text-center mt-1">
                {agents.length === 0
                  ? "Add a field agent from More → Staff to start tracking their location."
                  : "Locations will appear here once your field agents open the Employee App and share their location."}
              </Text>
            </View>
          ) : (
            <AgentMapView
              mapRef={mapRef}
              agents={agentsOnMap as { agent_id: string; name: string; initials: string; latitude: number; longitude: number; accuracy?: number; minutesAgo: number }[]}
              selectedAgentId={selectedAgentId}
              onSelectAgent={setSelectedAgentId}
              defaultRegion={defaultRegion}
            />
          )}

          {/* Floating agent list pill (bottom sheet preview) — only agents
              with a real location can be flown to on the map; agents who
              haven't checked in yet appear in the List view instead. */}
          {agentsOnMap.length > 0 && (
            <View className="absolute bottom-0 left-0 right-0 bg-surface-container-lowest dark:bg-surface-dark border-t border-outline-variant dark:border-outline px-4 pt-3 pb-6 gap-2">
              <Text className="text-sm font-bold text-on-surface-variant uppercase tracking-widest mb-1">
                Active Agents
              </Text>
              <FlatList
                horizontal
                data={agentsOnMap}
                keyExtractor={(a) => a.agent_id}
                showsHorizontalScrollIndicator={false}
                renderItem={({ item }) => {
                  const sc = statusColor(item.minutesAgo);
                  const isSelected = selectedAgentId === item.agent_id;
                  return (
                    <Pressable
                      onPress={() => flyToAgent(item)}
                      className={`mr-3 px-4 py-3.5 rounded-2xl border flex-row items-center gap-2 ${
                        isSelected
                          ? "bg-primary/10 border-primary/30 dark:bg-primary-dark/10"
                          : "bg-background dark:bg-zinc-900 border-outline-variant dark:border-outline"
                      }`}
                    >
                      <View
                        className={`w-9 h-9 rounded-full justify-center items-center ${
                          isSelected ? "bg-primary dark:bg-primary-dark" : "bg-surface-container-high"
                        }`}
                      >
                        <Text
                          className={`text-sm font-black ${
                            isSelected ? "text-white" : "text-on-surface-variant"
                          }`}
                        >
                          {item.initials}
                        </Text>
                      </View>
                      <View>
                        <Text className="text-base font-bold text-on-surface dark:text-text-primary-dark">
                          {item.name}
                        </Text>
                        <Text className={`text-sm font-semibold ${sc.text}`}>
                          {formatLastSeen(item.minutesAgo)}
                        </Text>
                      </View>
                      <View className={`w-2 h-2 rounded-full ${sc.dot}`} />
                    </Pressable>
                  );
                }}
              />
            </View>
          )}
        </View>
      )}

      {/* ── List View ── */}
      {viewMode === "list" && (
        <FlatList
          data={agents}
          keyExtractor={(a) => a.agent_id}
          contentContainerStyle={{ padding: 24, gap: 12 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <View className="flex-1 py-24 items-center">
              <MaterialCommunityIcons name="account-group-outline" size={40} color="#6e7a74" style={{ marginBottom: 12 }} />
              <Text className="text-on-surface dark:text-text-primary-dark font-bold text-base text-center">
                No field agents tracked yet
              </Text>
              <Text className="text-on-surface-variant text-sm text-center mt-1 px-8">
                Agent locations will appear here once the Agent App starts
                pinging.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const sc = statusColor(item.minutesAgo);
            return (
              <Pressable
                onPress={() => flyToAgent(item)}
                className="bg-surface-container-lowest dark:bg-surface-dark rounded-2xl p-4 border border-outline-variant dark:border-outline shadow-sm flex-row items-center gap-4 active:opacity-90"
              >
                {/* Avatar */}
                <View className="w-12 h-12 rounded-full bg-primary/10 dark:bg-primary-dark/15 justify-center items-center border-2 border-primary/20">
                  <Text className="text-primary dark:text-primary-dark font-black text-base">
                    {item.initials}
                  </Text>
                </View>

                {/* Info */}
                <View className="flex-1">
                  <Text className="font-bold text-base text-on-surface dark:text-text-primary-dark">
                    {item.name}
                  </Text>
                  <Text className="text-sm text-on-surface-variant mt-0.5">
                    {item.latitude !== null && item.longitude !== null
                      ? `${item.latitude.toFixed(4)}, ${item.longitude.toFixed(4)}${item.accuracy ? `  ·  ±${item.accuracy.toFixed(0)}m` : ""}`
                      : "No location shared yet"}
                  </Text>
                </View>

                {/* Status */}
                <View className="items-end gap-1">
                  <View className="flex-row items-center gap-1.5">
                    <View className={`w-2 h-2 rounded-full ${sc.dot}`} />
                    <Text className={`text-sm font-bold ${sc.text}`}>
                      {formatLastSeen(item.minutesAgo)}
                    </Text>
                  </View>
                  <Text className="text-sm text-primary dark:text-primary-dark font-semibold">
                    View on map →
                  </Text>
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}
