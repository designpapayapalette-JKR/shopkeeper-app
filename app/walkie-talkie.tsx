import React, { useState, useRef, useEffect } from "react";
import { Text, View, ScrollView, Pressable, Alert, Animated } from "react-native";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAuth } from "../src/lib/auth-context";
import { useTopInset } from "../src/lib/useTopInset";
import { WalkieChannel, WalkiePeer } from "../src/lib/walkieRtc";

// Owner/manager side of the same push-to-talk feature the Employee App
// already has — previously only field staff could use walkie-talkie among
// themselves, with no way for the shop owner to join in. Same signaling
// server, same companyId-scoped rooms, so an owner and their team land in
// the same channel automatically without any extra setup.
type ConnectionState = "disconnected" | "connecting" | "connected" | "error";

interface Channel {
  id: string;
  name: string;
  description: string;
  icon: string;
}

// A single unified channel for the whole company — owner, managers, staff,
// and field agents all land in the same room (there used to be a second
// "Field Ops" channel, which actually split the team instead of connecting
// it, defeating the point of a shared walkie-talkie).
const TEAM_CHANNEL: Channel = {
  id: "company-main",
  name: "Team Channel",
  description: "Everyone in your company — staff, field agents & you",
  icon: "radio-tower",
};

const CONNECTION_META: Record<ConnectionState, { label: string; color: string; dot: string }> = {
  disconnected: { label: "Disconnected", color: "text-on-surface-variant", dot: "bg-gray-400" },
  connecting: { label: "Connecting…", color: "text-amber-600", dot: "bg-amber-400" },
  connected: { label: "Connected", color: "text-green-600", dot: "bg-green-500" },
  error: { label: "Connection Error", color: "text-error", dot: "bg-red-500" },
};

function getInitials(name: string) {
  return name.split(" ").map((w) => w[0] ?? "").join("").toUpperCase().slice(0, 2);
}

export default function WalkieTalkieScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const topInset = useTopInset();

  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>("disconnected");
  const [isTransmitting, setIsTransmitting] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [participants, setParticipants] = useState<WalkiePeer[]>([]);
  const channelRef = useRef<WalkieChannel | null>(null);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isTransmitting) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.08, duration: 300, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        ])
      ).start();
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(glowAnim, { toValue: 0.3, duration: 400, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.stopAnimation();
      glowAnim.stopAnimation();
      Animated.timing(pulseAnim, { toValue: 1, duration: 150, useNativeDriver: true }).start();
      Animated.timing(glowAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start();
    }
  }, [isTransmitting]);

  const handleJoinChannel = async (channel: Channel) => {
    setConnectionState("connecting");
    setActiveChannel(channel);

    const userName = `${user?.first_name ?? ""} ${user?.last_name ?? ""}`.trim() || "Owner";
    const walkie = new WalkieChannel(channel.id, userName, {
      onParticipantsChanged: setParticipants,
      onConnectionStateChanged: (state) => {
        setConnectionState(state);
        if (state === "disconnected" || state === "error") setIsTransmitting(false);
      },
    });
    channelRef.current = walkie;

    try {
      await walkie.connect();
    } catch (e: any) {
      setConnectionState("error");
      setActiveChannel(null);
      channelRef.current = null;
      Alert.alert("Connection Failed", e?.message ?? "Could not join the channel. Check your connection and try again.");
    }
  };

  const handleLeaveChannel = () => {
    channelRef.current?.disconnect();
    channelRef.current = null;
    setIsTransmitting(false);
    setConnectionState("disconnected");
    setActiveChannel(null);
    setParticipants([]);
  };

  useEffect(() => {
    return () => {
      channelRef.current?.disconnect();
    };
  }, []);

  const handlePttPressIn = () => {
    if (connectionState !== "connected") {
      Alert.alert("Not Connected", "Join a channel first to start transmitting.");
      return;
    }
    if (isMuted) {
      Alert.alert("Microphone Muted", "Unmute to transmit.");
      return;
    }
    setIsTransmitting(true);
    channelRef.current?.setTransmitting(true);
  };

  const handlePttPressOut = () => {
    setIsTransmitting(false);
    channelRef.current?.setTransmitting(false);
  };

  const connMeta = CONNECTION_META[connectionState];

  return (
    <ScrollView className="flex-1 bg-background dark:bg-bg-dark" showsVerticalScrollIndicator={false}>
      <View className="px-6 pb-4 flex-row items-center" style={{ paddingTop: topInset, gap: 12 }}>
        <Pressable onPress={() => router.back()} className="w-10 h-10 items-center justify-center -ml-2">
          <MaterialCommunityIcons name="arrow-left" size={22} color="#0F7A5F" />
        </Pressable>
        <View>
          <Text className="text-2xl font-black text-on-surface dark:text-text-primary-dark">Walkie-Talkie</Text>
          <Text className="text-sm text-on-surface-variant dark:text-text-secondary-dark mt-0.5">
            Push-to-talk with your team
          </Text>
        </View>
      </View>

      <View className="mx-6 mb-5 bg-surface-container-lowest dark:bg-surface-dark border border-outline-variant dark:border-outline rounded-2xl px-4 py-3 flex-row items-center">
        <View className={`w-2 h-2 rounded-full mr-2.5 ${connMeta.dot}`} />
        <Text className={`text-sm font-bold flex-1 ${connMeta.color}`}>
          {connMeta.label}
          {activeChannel ? `  ·  ${activeChannel.name}` : ""}
        </Text>
        {connectionState === "connected" && (
          <Pressable onPress={handleLeaveChannel} className="bg-red-500/10 border border-red-500/30 px-4 py-2.5 rounded-xl active:opacity-80">
            <Text className="text-error text-sm font-bold">Leave</Text>
          </Pressable>
        )}
      </View>

      <View className="px-6 mb-6">
        {(() => {
          const ch = TEAM_CHANNEL;
          const isActive = activeChannel?.id === ch.id;
          return (
            <Pressable
              onPress={() => (isActive ? handleLeaveChannel() : handleJoinChannel(ch))}
              disabled={connectionState === "connecting"}
              className={`rounded-2xl p-4 border flex-row items-center ${
                isActive ? "bg-green-500/10 border-green-500/30" : "bg-surface-container-lowest dark:bg-surface-dark border-outline-variant dark:border-outline"
              } active:opacity-80`}
            >
              <View className={`w-11 h-11 rounded-2xl justify-center items-center mr-3 ${isActive ? "bg-green-500/20" : "bg-primary/10"}`}>
                <MaterialCommunityIcons name={ch.icon as any} size={22} color={isActive ? "#16A34A" : "#0F7A5F"} />
              </View>
              <View className="flex-1">
                <Text className={`font-bold text-base ${isActive ? "text-green-700 dark:text-green-400" : "text-on-surface dark:text-text-primary-dark"}`}>
                  {ch.name}
                </Text>
                <Text className="text-on-surface-variant dark:text-text-secondary-dark text-sm mt-0.5">{ch.description}</Text>
              </View>
              {isActive && connectionState === "connecting" ? (
                <View className="bg-amber-400/20 px-2 py-1 rounded-lg">
                  <Text className="text-amber-600 text-sm font-bold">Joining…</Text>
                </View>
              ) : isActive ? (
                <View className="bg-green-500/20 px-2 py-1 rounded-lg">
                  <Text className="text-green-700 dark:text-green-400 text-sm font-bold">● LIVE</Text>
                </View>
              ) : (
                <Text className="text-primary dark:text-primary-dark text-sm font-semibold">Join →</Text>
              )}
            </Pressable>
          );
        })()}
      </View>

      <View className="px-6 items-center mb-8">
        <Text className="text-on-surface-variant dark:text-text-secondary-dark text-sm font-bold uppercase tracking-widest mb-5">
          Push to Talk
        </Text>

        <Animated.View
          style={{ opacity: glowAnim, transform: [{ scale: pulseAnim }] }}
          className="absolute w-48 h-48 rounded-full bg-green-500/20"
        />
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <Pressable
            onPressIn={handlePttPressIn}
            onPressOut={handlePttPressOut}
            disabled={connectionState !== "connected"}
            className={`w-44 h-44 rounded-full justify-center items-center border-4 ${
              isTransmitting
                ? "bg-green-500 border-green-300 shadow-lg"
                : connectionState === "connected"
                ? "bg-primary/10 border-primary/30 active:bg-green-500/20"
                : "bg-surface-container dark:bg-surface-dark border-outline-variant dark:border-outline"
            }`}
          >
            <MaterialCommunityIcons
              name={isTransmitting ? "microphone" : "radio-handheld"}
              size={48}
              color={isTransmitting ? "#FFFFFF" : connectionState === "connected" ? "#0F7A5F" : "#9CA3AF"}
              style={{ marginBottom: 4 }}
            />
            <Text
              className={`text-sm font-black uppercase tracking-widest ${
                isTransmitting ? "text-white" : connectionState === "connected" ? "text-primary dark:text-primary-dark" : "text-on-surface-variant"
              }`}
            >
              {isTransmitting ? "TRANSMITTING" : connectionState === "connected" ? "HOLD TO TALK" : "JOIN A CHANNEL"}
            </Text>
          </Pressable>
        </Animated.View>

        {connectionState === "connected" && (
          <Pressable
            onPress={() => {
              const next = !isMuted;
              setIsMuted(next);
              channelRef.current?.setMuted(next);
              if (next) setIsTransmitting(false);
            }}
            className={`mt-6 flex-row items-center gap-2 px-5 py-3.5 rounded-2xl border ${
              isMuted ? "bg-red-500/10 border-red-500/30" : "bg-surface-container-lowest dark:bg-surface-dark border-outline-variant dark:border-outline"
            } active:opacity-80`}
          >
            <MaterialCommunityIcons name={isMuted ? "volume-off" : "volume-high"} size={18} color={isMuted ? "#D64545" : "#6e7a74"} />
            <Text className={`text-sm font-bold ${isMuted ? "text-error" : "text-on-surface-variant dark:text-text-secondary-dark"}`}>
              {isMuted ? "Microphone Muted" : "Mic Active"}
            </Text>
          </Pressable>
        )}
      </View>

      {connectionState === "connected" && (
        <View className="px-6 mb-8">
          <Text className="text-on-surface-variant dark:text-text-secondary-dark text-sm font-bold uppercase tracking-widest mb-3">
            In This Channel
          </Text>
          <View className="bg-surface-container-lowest dark:bg-surface-dark border border-outline-variant dark:border-outline rounded-2xl p-4" style={{ gap: 12 }}>
            <View className="flex-row items-center" style={{ gap: 12 }}>
              <View className="w-9 h-9 rounded-full bg-green-500/20 border border-green-500/30 justify-center items-center">
                <Text className="text-green-700 dark:text-green-400 font-black text-sm">{getInitials(user?.first_name ?? "Me")}</Text>
              </View>
              <View className="flex-1">
                <Text className="text-on-surface dark:text-text-primary-dark font-bold text-sm">
                  {user?.first_name} {user?.last_name} <Text className="text-green-700 dark:text-green-400 text-sm font-bold">(You)</Text>
                </Text>
              </View>
              <View className={`w-2 h-2 rounded-full ${isTransmitting ? "bg-green-500" : "bg-outline-variant"}`} />
            </View>

            {participants.map((peer) => (
              <View key={peer.userId} className="flex-row items-center" style={{ gap: 12 }}>
                <View className="w-9 h-9 rounded-full bg-primary/10 justify-center items-center">
                  <Text className="text-primary dark:text-primary-dark font-black text-sm">{getInitials(peer.userName)}</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-on-surface dark:text-text-primary-dark font-semibold text-sm">{peer.userName}</Text>
                </View>
                <View className="w-2 h-2 rounded-full bg-green-500/60" />
              </View>
            ))}
            {participants.length === 0 && (
              <Text className="text-on-surface-variant dark:text-text-secondary-dark text-sm">No one else has joined this channel yet.</Text>
            )}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

