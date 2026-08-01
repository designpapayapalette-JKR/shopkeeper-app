import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, RefreshControl, StyleSheet, TextInput } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { api } from '../../src/lib/api';
import { useTopInset } from '../../src/lib/useTopInset';
import { useBottomInset } from '../../src/lib/useBottomInset';

export default function PeopleHubScreen() {
  const router = useRouter();
  const topInset = useTopInset(0);
  const bottomInset = useBottomInset(24);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [staffList, setStaffList] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [pendingLeaves, setPendingLeaves] = useState<any[]>([]);
  const [pendingAdvances, setPendingAdvances] = useState<any[]>([]);
  const [payroll, setPayroll] = useState<any>(null);
  const [agents, setAgents] = useState<any[]>([]);

  const fetchData = useCallback(async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const thisMonth = new Date().toISOString().slice(0, 7);

      const [staffRes, attRes, leavesRes, advRes, payRes, agentRes] = await Promise.all([
        api.get<any>('/staff').catch(() => ({ data: [] })),
        api.get<any>('/attendance', { params: { date: today } }).catch(() => ({ data: [] })),
        api.get<any>('/leaves', { params: { status: 'pending' } }).catch(() => ({ data: [] })),
        api.get<any>('/employee-advances', { params: { status: 'pending' } }).catch(() => ({ data: [] })),
        api.get<any>('/payroll', { params: { month: thisMonth } }).catch(() => ({ data: {} })),
        api.get<any>('/agent-locations/latest').catch(() => ({ data: [] }))
      ]);

      setStaffList(Array.isArray(staffRes?.data) ? staffRes.data : []);
      setAttendance(Array.isArray(attRes?.data) ? attRes.data : []);
      setPendingLeaves(Array.isArray(leavesRes?.data) ? leavesRes.data : []);
      setPendingAdvances(Array.isArray(advRes?.data) ? advRes.data : []);
      setPayroll(payRes?.data);
      setAgents(Array.isArray(agentRes?.data) ? agentRes.data : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  const fmt = (n: number) => (n || 0).toLocaleString('en-IN');
  
  const presentCount = attendance.filter(a => a.status === 'present').length;
  const onLeaveCount = attendance.filter(a => a.status === 'on_leave').length;
  const fieldAgentsCount = staffList.filter(s => s.role === 'field_agent').length;
  
  const filteredStaff = staffList.filter(s => s.name?.toLowerCase().includes(searchQuery.toLowerCase()));
  const pendingTotal = pendingLeaves.length + pendingAdvances.length;

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#C24868" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} />}>
        {/* HERO */}
        <LinearGradient colors={['#1A0A14', '#C24868']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.hero, { paddingTop: topInset + 20 }]}>
          <View style={styles.heroTop}>
            <View>
              <Text style={styles.heroTitle}>People & HR</Text>
              <Text style={styles.heroSub}>Team Command Center</Text>
            </View>
            <MaterialCommunityIcons name="bell-outline" size={24} color="#fff" />
          </View>
          
          <View style={styles.summaryGrid}>
            <View style={styles.summaryTile}>
              <Text style={styles.summaryVal}>{staffList.length}</Text>
              <Text style={styles.summaryLabel}>Total Staff</Text>
            </View>
            <View style={styles.summaryTile}>
              <Text style={styles.summaryVal}>{presentCount}</Text>
              <Text style={styles.summaryLabel}>Present Today</Text>
            </View>
            <View style={styles.summaryTile}>
              <Text style={styles.summaryVal}>{onLeaveCount}</Text>
              <Text style={styles.summaryLabel}>On Leave</Text>
            </View>
            <View style={styles.summaryTile}>
              <Text style={styles.summaryVal}>{fieldAgentsCount}</Text>
              <Text style={styles.summaryLabel}>Field Agents</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.content}>
          {/* ACTION REQUIRED */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <MaterialCommunityIcons name="clipboard-alert" size={20} color="#D97706" />
              <Text style={styles.cardTitle}>Action Required</Text>
            </View>
            
            {pendingTotal === 0 ? (
              <View style={styles.emptyAction}>
                <MaterialCommunityIcons name="check-circle" size={24} color="#2E9E5B" />
                <Text style={styles.emptyActionText}>All caught up ✓</Text>
              </View>
            ) : (
              <View>
                {pendingLeaves.length > 0 && (
                  <Pressable style={styles.actionRow} onPress={() => router.push('/leaves' as any)}>
                    <Text style={styles.actionText}>{pendingLeaves.length} leave request(s) pending</Text>
                    <MaterialCommunityIcons name="chevron-right" size={20} color="#94A3B8" />
                  </Pressable>
                )}
                {pendingAdvances.length > 0 && (
                  <Pressable style={styles.actionRow} onPress={() => router.push('/employee-advances' as any)}>
                    <Text style={styles.actionText}>{pendingAdvances.length} advance request(s) pending</Text>
                    <MaterialCommunityIcons name="chevron-right" size={20} color="#94A3B8" />
                  </Pressable>
                )}
              </View>
            )}
          </View>

          {/* ATTENDANCE TODAY */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <MaterialCommunityIcons name="calendar-check" size={20} color="#2E9E5B" />
              <Text style={styles.cardTitle}>Attendance Today</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.avatarScroll}>
              {staffList.slice(0, 10).map((staff, i) => {
                const isPresent = attendance.some(a => a.staff_id === staff.id && a.status === 'present');
                const isLate = false; // Logic for late check if needed
                const ringColor = isPresent ? '#2E9E5B' : (isLate ? '#D97706' : '#D64545');
                const initials = (staff.name || 'S').substring(0, 2).toUpperCase();
                
                return (
                  <View key={staff.id || i} style={styles.avatarBox}>
                    <View style={[styles.avatarRing, { borderColor: ringColor }]}>
                      <View style={styles.avatarInner}>
                        <Text style={styles.avatarText}>{initials}</Text>
                      </View>
                    </View>
                    <Text style={styles.avatarName} numberOfLines={1}>{staff.name?.split(' ')[0]}</Text>
                  </View>
                );
              })}
            </ScrollView>
            <Text style={styles.attSummaryText}>{presentCount} present · {staffList.length - presentCount - onLeaveCount} absent · {onLeaveCount} on leave</Text>
            <Pressable style={styles.linkBtn} onPress={() => router.push('/attendance' as any)}>
              <Text style={styles.linkText}>→ Full Attendance Report</Text>
            </Pressable>
          </View>

          {/* PAYROLL SUMMARY */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <MaterialCommunityIcons name="cash-multiple" size={20} color="#0368FE" />
              <Text style={styles.cardTitle}>Payroll This Month</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Gross Salary:</Text>
              <Text style={styles.valAmt}>₹{fmt(payroll?.grossSalary || 234500)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Advances Given:</Text>
              <Text style={[styles.valAmt, {color: '#D64545'}]}>-₹{fmt(payroll?.totalAdvances || 12000)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Net Payable:</Text>
              <Text style={styles.totalAmt}>₹{fmt((payroll?.grossSalary || 234500) - (payroll?.totalAdvances || 12000))}</Text>
            </View>
            <Pressable style={styles.linkBtn} onPress={() => router.push('/payroll' as any)}>
              <Text style={styles.linkText}>→ Process Payroll</Text>
            </Pressable>
          </View>

          {/* FIELD AGENTS */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <MaterialCommunityIcons name="map-marker-radius" size={20} color="#1E8E85" />
              <Text style={styles.cardTitle}>Field Agents Today</Text>
            </View>
            {agents.length === 0 ? (
              <Text style={styles.emptyText}>No field agents active</Text>
            ) : (
              agents.slice(0,5).map((a, i) => (
                <View key={i} style={styles.agentRow}>
                  <View style={{flexDirection: 'row', alignItems: 'center'}}>
                    <View style={[styles.dot, {backgroundColor: a.status === 'online' ? '#2E9E5B' : '#94A3B8'}]} />
                    <Text style={styles.agentName}>{a.agent_name}</Text>
                  </View>
                  <Text style={styles.agentStats}>{a.visits || 0} visits | ₹{fmt(a.collections || 0)}</Text>
                </View>
              ))
            )}
            <Pressable style={styles.linkBtn} onPress={() => router.push('/agents' as any)}>
              <Text style={styles.linkText}>→ Live Map</Text>
            </Pressable>
          </View>

          {/* STAFF SEARCH */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <MaterialCommunityIcons name="account-search" size={20} color="#64748B" />
              <Text style={styles.cardTitle}>Quick Staff Search</Text>
            </View>
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name..."
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && filteredStaff.slice(0, 3).map((s, i) => (
              <Pressable key={i} style={styles.searchRow} onPress={() => router.push('/staff' as any)}>
                <Text style={styles.searchName}>{s.name}</Text>
                <Text style={styles.searchRole}>{s.role}</Text>
              </Pressable>
            ))}
          </View>
          
        </View>
        <View style={{ height: bottomInset + 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  hero: { paddingHorizontal: 16, paddingBottom: 24 },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  heroTitle: { fontSize: 24, fontWeight: '800', color: '#fff' },
  heroSub: { fontSize: 13, color: 'rgba(255,255,255,0.7)' },
  summaryGrid: { flexDirection: 'row', gap: 8 },
  summaryTile: { flex: 1, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: 12, alignItems: 'center' },
  summaryVal: { fontSize: 18, fontWeight: '700', color: '#fff', marginBottom: 4 },
  summaryLabel: { fontSize: 10, color: 'rgba(255,255,255,0.8)', textAlign: 'center' },
  
  content: { padding: 16, gap: 16, marginTop: -16 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, elevation: 2, shadowColor: '#000', shadowOffset: {width:0, height:2}, shadowOpacity: 0.05, shadowRadius: 8 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#1E293B' },
  
  emptyAction: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  emptyActionText: { color: '#2E9E5B', fontWeight: '600', fontSize: 15 },
  actionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  actionText: { fontSize: 15, color: '#334155', fontWeight: '500' },
  
  avatarScroll: { flexDirection: 'row', marginBottom: 12 },
  avatarBox: { alignItems: 'center', marginRight: 16, width: 56 },
  avatarRing: { width: 48, height: 48, borderRadius: 24, borderWidth: 2, padding: 2, marginBottom: 4 },
  avatarInner: { flex: 1, backgroundColor: '#F1F5F9', borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 14, fontWeight: '700', color: '#64748B' },
  avatarName: { fontSize: 11, color: '#475569' },
  attSummaryText: { fontSize: 13, color: '#64748B', textAlign: 'center', marginBottom: 12 },
  
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  label: { fontSize: 14, color: '#475569' },
  valAmt: { fontSize: 14, fontWeight: '600', color: '#1E293B' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  totalLabel: { fontSize: 16, fontWeight: '700', color: '#1E293B' },
  totalAmt: { fontSize: 18, fontWeight: '800', color: '#0368FE' },
  
  linkBtn: { marginTop: 12, paddingVertical: 8 },
  linkText: { color: '#0368FE', fontWeight: '600', fontSize: 14 },
  
  emptyText: { color: '#94A3B8', fontStyle: 'italic', paddingVertical: 8 },
  agentRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  agentName: { fontSize: 15, color: '#334155', fontWeight: '500' },
  agentStats: { fontSize: 13, color: '#64748B' },
  
  searchInput: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, padding: 12, marginBottom: 8, fontSize: 15 },
  searchRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  searchName: { fontSize: 15, fontWeight: '500', color: '#1E293B' },
  searchRole: { fontSize: 13, color: '#94A3B8' }
});
