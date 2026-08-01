import React, { useState, useEffect, useRef } from "react";
import { View, Text, ActivityIndicator, Animated, Easing, StyleSheet, Dimensions } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "../lib/auth-context";
import { getIsConnected } from "../lib/connectivity";
import { syncQueuedSales } from "../lib/offlineQueue";
import { setCachedEntity, getLastSyncTime, setLastSyncTime } from "../lib/readCache";
import { api } from "../lib/api";

const { width } = Dimensions.get('window');

export function SyncGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, activeCompany } = useAuth();
  const [ready, setReady] = useState(false);
  const [statusText, setStatusText] = useState("Syncing latest data…");
  const ranRef = useRef(false);

  // Animations
  const spinValue = useRef(new Animated.Value(0)).current;
  const pulseValue = useRef(new Animated.Value(1)).current;
  const fadeValue = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(spinValue, { toValue: 1, duration: 3000, easing: Easing.linear, useNativeDriver: true })
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseValue, { toValue: 1.1, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseValue, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true })
      ])
    ).start();
  }, []);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  });

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      ranRef.current = false;
      setReady(true);
      return;
    }

    if (ranRef.current) return;
    ranRef.current = true;

    async function runSyncGate() {
      const maxTimer = setTimeout(() => {
        finishGate();
      }, 1500);

      try {
        const connected = getIsConnected();
        if (connected) {
          setStatusText("Syncing pending sales…");
          try { await syncQueuedSales(); } catch (e) { console.warn(e); }

          setStatusText("Updating offline cache…");
          try {
            const lastSync = await getLastSyncTime();
            const res = await api.get<{
              data?: { since: string; serverTime: string; products?: unknown[]; parties?: unknown[]; invoices?: unknown[]; purchases?: unknown[]; payments?: unknown[]; expenses?: unknown[]; stockMovements?: unknown[]; };
            }>(`/sync/pull`, { params: { since: lastSync } });

            if (res?.data) {
              const data = res.data;
              if (Array.isArray(data.products)) await setCachedEntity("products", data.products);
              if (Array.isArray(data.parties)) await setCachedEntity("parties", data.parties);
              if (Array.isArray(data.invoices)) await setCachedEntity("invoices", data.invoices);
              if (Array.isArray(data.purchases)) await setCachedEntity("purchases", data.purchases);
              if (Array.isArray(data.payments)) await setCachedEntity("payments", data.payments);
              if (Array.isArray(data.expenses)) await setCachedEntity("expenses", data.expenses);
              if (Array.isArray(data.stockMovements)) await setCachedEntity("stockMovements", data.stockMovements);
              if (data.serverTime) await setLastSyncTime(data.serverTime);
            }
          } catch (e) { console.warn(e); }
        }
      } catch (err) {
        console.error(err);
      } finally {
        clearTimeout(maxTimer);
        finishGate();
      }
    }

    const finishGate = () => {
      Animated.timing(fadeValue, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => setReady(true));
    };

    runSyncGate();
  }, [isAuthenticated, isLoading]);

  return (
    <View style={{ flex: 1 }}>
      {children}
      {!ready && isAuthenticated && (
        <Animated.View style={[styles.overlay, { opacity: fadeValue }]}>
          <LinearGradient
            colors={['#F8FAFC', '#F1F5F9', '#FFFFFF']}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
          
          <Animated.View style={[styles.iconContainer, { transform: [{ scale: pulseValue }] }]}>
            <LinearGradient
              colors={['rgba(3, 104, 254, 0.15)', 'rgba(3, 104, 254, 0.02)']}
              style={styles.iconBg}
            >
              <Animated.View style={{ transform: [{ rotate: spin }] }}>
                <MaterialCommunityIcons name="loading" size={48} color="#0368FE" />
              </Animated.View>
            </LinearGradient>
          </Animated.View>

          <Text style={styles.title}>Setting up your workspace</Text>
          <Text style={styles.companyName}>{activeCompany?.name || 'Manage My Counter'}</Text>
          
          <View style={styles.statusBox}>
            <ActivityIndicator size="small" color="#0368FE" style={{ marginRight: 8 }} />
            <Text style={styles.statusText}>{statusText}</Text>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0, bottom: 0, left: 0, right: 0,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 99999,
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 36,
    borderWidth: 2,
    borderColor: 'rgba(3, 104, 254, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    shadowColor: '#0368FE',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  iconBg: {
    width: '100%',
    height: '100%',
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  companyName: {
    fontSize: 16,
    color: "#64748B",
    marginBottom: 44,
    fontWeight: "600",
  },
  statusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#94A3B8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  statusText: {
    fontSize: 14,
    color: "#334155",
    fontWeight: "700",
  }
});
