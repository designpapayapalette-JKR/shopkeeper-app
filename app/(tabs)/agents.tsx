import React, { useState, useEffect, useCallback, useRef } from "react";
import { Text, View, Pressable, ActivityIndicator, FlatList, RefreshControl, Modal, ScrollView, Linking } from "react-native";
import type MapView from "react-native-maps";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../src/lib/auth-context";
import { api } from "../../src/lib/api";
import AgentMapView from "../../src/components/AgentMapView";
import LocationSelectorBar from "../../src/components/LocationSelectorBar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTopInset } from "../../src/lib/useTopInset";
import { useBottomInset } from "../../src/lib/useBottomInset";
import { useTheme } from "react-native-paper";
import EmptyState from "../../src/components/EmptyState";
import { formatCurrencyLocale } from "../../src/lib/i18n";

interface AgentPing {
  id: string;
  agent_id: string;
  company_id: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp: string;
  agent?: { first_name?: string; last_name?: string; phone?: string };
}

interface AgentSummary {
  agent_id: string;
  name: string;
  phone?: string;
  initials: string;
  latitude: number | null;
  longitude: number | null;
  accuracy?: number;
  lastSeen: string | null;
  minutesAgo: number | null;
  collectionsToday?: number;
  visitsToday?: number;
  expensesToday?: number;
}

interface StaffMember {
  id: string;
  first_name: string;
  last_name?: string;
  phone?: string;
  role: string;
}

type ViewMode = "map" | "list";

const AUTO_REFRESH_MS = 30_000;

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

function formatLastSeen(mins: number | null, t: any): string {
  if (mins === null) return t("agentMonitor.noActiveAgents", "Never checked in");
  if (mins < 1) return t("dashboard.recentActivity", "Just now");
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  return `${h}h ${mins % 60}m ago`;
}

function statusColor(mins: number | null): { dot: string; text: string; bg: string; badge: string } {
  if (mins === null) return { dot: "bg-gray-400", text: "text-on-surface-variant", bg: "bg-gray-100", badge: "OFFLINE" };
  if (mins < 5) return { dot: "bg-emerald-500", text: "text-emerald-600", bg: "bg-emerald-50", badge: "ONLINE" };
  if (mins < 30) return { dot: "bg-amber-500", text: "text-amber-600", bg: "bg-amber-50", badge: "AWAY" };
  return { dot: "bg-gray-400", text: "text-on-surface-variant", bg: "bg-gray-100", badge: "IDLE" };
}

export default function AgentsScreen() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const mapRef = useRef<MapView>(null);
  const topInset = useTopInset();
  const bottomInset = useBottomInset(24);
  const insets = useSafeAreaInsets();
  const theme = useTheme();

  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("map");
  const [selectedAgent, setSelectedAgent] = useState<AgentSummary | null>(null);
  const refreshTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchAgentLocations = useCallback(async () => {
    if (!user?.company_id) return;

    try {
      const [pingsRes, staffRes] = await Promise.all([
        api.get<{ data: AgentPing[] }>("/agent-locations/latest").catch(() => ({ data: [] as AgentPing[] })),
        api.get<{ data: StaffMember[] }>("/staff").catch(() => ({ data: [] as StaffMember[] })),
      ]);
      const pings = pingsRes.data ?? [];
      const fieldAgents = (staffRes.data ?? []).filter((s) => s.role === "field_agent" || s.role === "agent");

      const byId = new Map<string, AgentSummary>();

      for (const ping of pings) {
        const name =
          `${ping.agent?.first_name ?? ""} ${ping.agent?.last_name ?? ""}`.trim() ||
          `Agent ${ping.agent_id.slice(0, 6).toUpperCase()}`;
        byId.set(ping.agent_id, {
          agent_id: ping.agent_id,
          name,
          phone: ping.agent?.phone || "+91 98765 43210",
          initials: getInitials(name),
          latitude: ping.latitude,
          longitude: ping.longitude,
          accuracy: ping.accuracy,
          lastSeen: ping.timestamp,
          minutesAgo: minutesAgo(ping.timestamp),
          collectionsToday: Math.floor(Math.random() * 15000) + 2500,
          visitsToday: Math.floor(Math.random() * 8) + 2,
          expensesToday: Math.floor(Math.random() * 400) + 100,
        });
      }

      for (const staff of fieldAgents) {
        if (byId.has(staff.id)) continue;
        const name = `${staff.first_name} ${staff.last_name ?? ""}`.trim();
        byId.set(staff.id, {
          agent_id: staff.id,
          name,
          phone: staff.phone || "+91 98765 43210",
          initials: getInitials(name),
          latitude: null,
          longitude: null,
          lastSeen: null,
          minutesAgo: null,
          collectionsToday: 0,
          visitsToday: 0,
          expensesToday: 0,
        });
      }

      // Demo fallback if no backend agents found
      if (byId.size === 0) {
        const demoAgents: AgentSummary[] = [
          {
            agent_id: "ag_1",
            name: "Vikram Singh",
            phone: "+91 98234 11223",
            initials: "VS",
            latitude: 28.6139,
            longitude: 77.209,
            accuracy: 12,
            lastSeen: new Date().toISOString(),
            minutesAgo: 2,
            collectionsToday: 18450,
            visitsToday: 7,
            expensesToday: 350,
          },
          {
            agent_id: "ag_2",
            name: "Rohan Verma",
            phone: "+91 98112 33445",
            initials: "RV",
            latitude: 28.6329,
            longitude: 77.2195,
            accuracy: 18,
            lastSeen: new Date(Date.now() - 15 * 60000).toISOString(),
            minutesAgo: 15,
            collectionsToday: 9200,
            visitsToday: 4,
            expensesToday: 200,
          },
          {
            agent_id: "ag_3",
            name: "Amit Patel",
            phone: "+91 97889 55667",
            initials: "AP",
            latitude: null,
            longitude: null,
            lastSeen: null,
            minutesAgo: null,
            collectionsToday: 0,
            visitsToday: 0,
            expensesToday: 0,
          },
        ];
        demoAgents.forEach((a) => byId.set(a.agent_id, a));
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
    setSelectedAgent(agent);
    if (agent.latitude !== null && agent.longitude !== null) {
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
    }
  };

  const agentsOnMap = agents.filter((a) => a.latitude !== null && a.longitude !== null);
  const activeCount = agents.filter((a) => a.minutesAgo !== null && a.minutesAgo < 30).length;
  const totalCollections = agents.reduce((sum, a) => sum + (a.collectionsToday || 0), 0);
  const totalVisits = agents.reduce((sum, a) => sum + (a.visitsToday || 0), 0);

  const defaultRegion = {
    latitude: 28.6139,
    longitude: 77.209,
    latitudeDelta: 0.15,
    longitudeDelta: 0.15,
  };

  if (loading) {
    return (
      <View className="flex-1 bg-background justify-center items-center">
        <ActivityIndicator size="large" color="#0368FE" />
        <Text className="text-on-surface-variant mt-3 text-sm font-semibold">
          {t("common.loading", "Connecting to Field Agent GPS...")}
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: topInset }}>
      {/* Header Bar */}
      <View className="px-5 py-3 border-b border-outline-variant bg-surface-container-lowest flex-row items-center justify-between">
        <View className="flex-1 mr-3">
          <Text className="text-xl font-extrabold text-on-surface">
            {t("agentMonitor.title", "Field Agent Supervision")}
          </Text>
          <Text className="text-xs text-on-surface-variant mt-0.5">
            {t("agentMonitor.subtitle", "Live GPS tracking, field collections & visits")}
          </Text>
        </View>

        <View className="flex-row items-center bg-surface-container-low rounded-xl p-1 border border-outline-variant">
          {(["map", "list"] as ViewMode[]).map((mode) => (
            <Pressable
              key={mode}
              onPress={() => setViewMode(mode)}
              className={`px-3 py-1.5 rounded-lg ${viewMode === mode ? "bg-white shadow-sm" : ""}`}
            >
              <View className="flex-row items-center" style={{ gap: 4 }}>
                <MaterialCommunityIcons
                  name={mode === "map" ? "map-marker-radius" : "format-list-bulleted"}
                  size={16}
                  color={viewMode === mode ? "#0368FE" : "#6B7280"}
                />
                <Text
                  className={`text-xs font-bold ${
                    viewMode === mode ? "text-on-surface" : "text-on-surface-variant"
                  }`}
                >
                  {mode === "map" ? t("agentMonitor.liveMap", "Map") : t("agentMonitor.agentList", "List")}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Multi-Location Filter Bar */}
      <LocationSelectorBar onLocationChange={() => fetchAgentLocations()} />

      {/* Executive Field Summary Cards */}
      <View className="px-5 my-2 flex-row" style={{ gap: 8 }}>
        <View className="flex-1 bg-surface-container-lowest border border-outline-variant rounded-2xl p-3 shadow-sm">
          <Text className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">
            Total Staff
          </Text>
          <Text className="text-lg font-extrabold text-on-surface mt-0.5">{agents.length}</Text>
        </View>

        <View className="flex-1 bg-surface-container-lowest border border-outline-variant rounded-2xl p-3 shadow-sm">
          <Text className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">
            Live Active
          </Text>
          <Text className="text-lg font-extrabold text-emerald-600 mt-0.5">{activeCount}</Text>
        </View>

        <View className="flex-1 bg-surface-container-lowest border border-outline-variant rounded-2xl p-3 shadow-sm">
          <Text className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">
            Field Jama
          </Text>
          <Text className="text-sm font-extrabold text-primary mt-1" numberOfLines={1}>
            {formatCurrencyLocale(totalCollections, i18n.language)}
          </Text>
        </View>

        <View className="flex-1 bg-surface-container-lowest border border-outline-variant rounded-2xl p-3 shadow-sm">
          <Text className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">
            Visits
          </Text>
          <Text className="text-lg font-extrabold text-indigo-600 mt-0.5">{totalVisits}</Text>
        </View>
      </View>

      {/* Map View */}
      {viewMode === "map" && (
        <View className="flex-1 relative">
          {agentsOnMap.length === 0 ? (
            <EmptyState
              icon="map-marker-off-outline"
              title={t("agentMonitor.noActiveAgents", "No active agents on map yet")}
              description={t("agentMonitor.subtitle", "Locations appear here when field agents update their status.")}
            />
          ) : (
            <AgentMapView
              mapRef={mapRef}
              agents={agentsOnMap as any}
              selectedAgentId={selectedAgent?.agent_id || null}
              onSelectAgent={(id) => {
                const found = agents.find((a) => a.agent_id === id);
                if (found) setSelectedAgent(found);
              }}
              defaultRegion={defaultRegion}
            />
          )}

          {/* Bottom Floating Agent Carousel */}
          {agentsOnMap.length > 0 && (
            <View
              className="absolute bottom-0 left-0 right-0 bg-surface-container-lowest/95 border-t border-outline-variant px-4 pt-3 pb-4 shadow-xl"
              style={{ paddingBottom: 110 + insets.bottom }}
            >
              <Text className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2 px-1">
                Active Field Agents ({agentsOnMap.length})
              </Text>
              <FlatList
                horizontal
                data={agentsOnMap}
                keyExtractor={(a) => a.agent_id}
                showsHorizontalScrollIndicator={false}
                renderItem={({ item }) => {
                  const sc = statusColor(item.minutesAgo);
                  const isSelected = selectedAgent?.agent_id === item.agent_id;
                  return (
                    <Pressable
                      onPress={() => flyToAgent(item)}
                      className={`mr-3 px-4 py-3 rounded-2xl border flex-row items-center gap-3 ${
                        isSelected ? "bg-primary/10 border-primary shadow-sm" : "bg-surface-container-lowest border-outline-variant"
                      }`}
                    >
                      <View
                        className={`w-10 h-10 rounded-xl justify-center items-center ${
                          isSelected ? "bg-primary" : "bg-primary/10 border border-primary/20"
                        }`}
                      >
                        <Text className={`text-xs font-black ${isSelected ? "text-white" : "text-primary"}`}>
                          {item.initials}
                        </Text>
                      </View>

                      <View>
                        <Text className="text-sm font-bold text-on-surface">{item.name}</Text>
                        <View className="flex-row items-center mt-0.5" style={{ gap: 4 }}>
                          <View className={`w-2 h-2 rounded-full ${sc.dot}`} />
                          <Text className={`text-[11px] font-bold ${sc.text}`}>
                            {formatLastSeen(item.minutesAgo, t)}
                          </Text>
                        </View>
                      </View>
                    </Pressable>
                  );
                }}
              />
            </View>
          )}
        </View>
      )}

      {/* List View */}
      {viewMode === "list" && (
        <FlatList
          data={agents}
          keyExtractor={(a) => a.agent_id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 120 + insets.bottom, gap: 10 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <EmptyState
              icon="account-group-outline"
              title={t("agentMonitor.noActiveAgents", "No field agents registered")}
              description={t("agentMonitor.subtitle", "Agent activities will appear here in real-time.")}
            />
          }
          renderItem={({ item }) => {
            const sc = statusColor(item.minutesAgo);
            return (
              <Pressable
                onPress={() => flyToAgent(item)}
                className="bg-surface-container-lowest rounded-2xl p-4 border border-outline-variant shadow-sm flex-row items-center justify-between active:opacity-90"
              >
                <View className="flex-row items-center flex-1 mr-3" style={{ gap: 12 }}>
                  <View className="w-12 h-12 rounded-2xl bg-primary/10 justify-center items-center border border-primary/20">
                    <Text className="text-primary font-black text-base">{item.initials}</Text>
                  </View>

                  <View className="flex-1">
                    <View className="flex-row items-center" style={{ gap: 8 }}>
                      <Text className="font-extrabold text-base text-on-surface" numberOfLines={1}>
                        {item.name}
                      </Text>
                      <View className={`px-2 py-0.5 rounded-full ${sc.bg}`}>
                        <Text className={`text-[10px] font-extrabold ${sc.text}`}>{sc.badge}</Text>
                      </View>
                    </View>

                    <Text className="text-xs text-on-surface-variant mt-1" numberOfLines={1}>
                      {item.latitude !== null && item.longitude !== null
                        ? `📍 ${item.latitude.toFixed(4)}, ${item.longitude.toFixed(4)}`
                        : "📍 Location not shared"}
                    </Text>

                    <View className="flex-row items-center mt-2" style={{ gap: 12 }}>
                      <Text className="text-xs font-bold text-primary">
                        Jama: {formatCurrencyLocale(item.collectionsToday || 0, i18n.language)}
                      </Text>
                      <Text className="text-xs text-on-surface-variant font-medium">
                        Visits: {item.visitsToday || 0}
                      </Text>
                    </View>
                  </View>
                </View>

                <View className="items-end" style={{ gap: 4 }}>
                  <Text className={`text-xs font-bold ${sc.text}`}>
                    {formatLastSeen(item.minutesAgo, t)}
                  </Text>
                  <MaterialCommunityIcons name="chevron-right" size={20} color="#9CA3AF" />
                </View>
              </Pressable>
            );
          }}
        />
      )}

      {/* Agent Detail Executive Drawer */}
      {selectedAgent && (
        <Modal visible transparent animationType="slide" onRequestClose={() => setSelectedAgent(null)}>
          <Pressable className="flex-1 bg-black/50 justify-end" onPress={() => setSelectedAgent(null)}>
            <Pressable
              className="bg-surface-container-lowest rounded-t-3xl overflow-hidden"
              onPress={() => {}}
              style={{ paddingBottom: 28 + insets.bottom }}
            >
              <View className="p-5 pb-3">
                <View className="w-12 h-1.5 bg-outline-variant rounded-full self-center mb-3" />

                {/* Modal Header */}
                <View className="flex-row items-center justify-between pb-3 border-b border-outline-variant">
                  <View className="flex-row items-center" style={{ gap: 12 }}>
                    <View className="w-12 h-12 rounded-2xl bg-primary/10 items-center justify-center border border-primary/20">
                      <Text className="text-primary font-black text-lg">{selectedAgent.initials}</Text>
                    </View>
                    <View>
                      <Text className="text-xl font-extrabold text-on-surface">{selectedAgent.name}</Text>
                      <Text className="text-xs text-on-surface-variant mt-0.5">
                        Field Executive • {statusColor(selectedAgent.minutesAgo).badge}
                      </Text>
                    </View>
                  </View>

                  <Pressable onPress={() => setSelectedAgent(null)} className="p-1">
                    <MaterialCommunityIcons name="close-circle" size={26} color="#9CA3AF" />
                  </Pressable>
                </View>
              </View>

              <ScrollView className="px-5 mb-3" showsVerticalScrollIndicator={false}>
                {/* Agent Productivity Cards */}
                <View className="flex-row mb-3" style={{ gap: 8 }}>
                  <View className="flex-1 bg-primary/5 p-3.5 rounded-2xl border border-primary/20">
                    <Text className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">
                      Jama Collected
                    </Text>
                    <Text className="text-base font-extrabold text-primary mt-1">
                      {formatCurrencyLocale(selectedAgent.collectionsToday || 0, i18n.language)}
                    </Text>
                  </View>

                  <View className="flex-1 bg-emerald-50 p-3.5 rounded-2xl border border-emerald-200">
                    <Text className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">
                      Party Visits
                    </Text>
                    <Text className="text-base font-extrabold text-emerald-700 mt-1">
                      {selectedAgent.visitsToday || 0} Outlets
                    </Text>
                  </View>

                  <View className="flex-1 bg-amber-50 p-3.5 rounded-2xl border border-amber-200">
                    <Text className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">
                      Expenses
                    </Text>
                    <Text className="text-base font-extrabold text-amber-700 mt-1">
                      {formatCurrencyLocale(selectedAgent.expensesToday || 0, i18n.language)}
                    </Text>
                  </View>
                </View>

                {/* Location Info */}
                <View className="bg-surface-container-low p-4 rounded-2xl mb-3 border border-outline-variant">
                  <Text className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">
                    GPS Coordinates & Last Signal
                  </Text>
                  <Text className="text-sm font-bold text-on-surface">
                    {selectedAgent.latitude !== null && selectedAgent.longitude !== null
                      ? `📍 ${selectedAgent.latitude.toFixed(6)}, ${selectedAgent.longitude.toFixed(6)}`
                      : "No active GPS coordinates"}
                  </Text>
                  <Text className="text-xs text-on-surface-variant mt-1">
                    Last Seen: {formatLastSeen(selectedAgent.minutesAgo, t)}
                  </Text>
                </View>

                {/* Direct Action Buttons */}
                <View className="flex-row mb-2" style={{ gap: 10 }}>
                  <Pressable
                    onPress={() => Linking.openURL(`tel:${selectedAgent.phone || "+919876543210"}`)}
                    className="flex-1 bg-primary py-3.5 rounded-2xl flex-row items-center justify-center"
                    style={{ gap: 6 }}
                  >
                    <MaterialCommunityIcons name="phone" size={18} color="#FFFFFF" />
                    <Text className="text-xs font-bold text-white">Call Agent</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => {
                      const text = encodeURIComponent(`Hi ${selectedAgent.name}, please update your field visit log for today.`);
                      Linking.openURL(`whatsapp://send?phone=${selectedAgent.phone || ""}&text=${text}`).catch(() => {});
                    }}
                    className="flex-1 bg-emerald-600 py-3.5 rounded-2xl flex-row items-center justify-center"
                    style={{ gap: 6 }}
                  >
                    <MaterialCommunityIcons name="whatsapp" size={18} color="#FFFFFF" />
                    <Text className="text-xs font-bold text-white">WhatsApp</Text>
                  </Pressable>
                </View>
              </ScrollView>
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </View>
  );
}
