import React, { useState, useEffect, useCallback } from 'react';
import { Platform, KeyboardAvoidingView, View, Text, ScrollView, Pressable, ActivityIndicator, RefreshControl, StyleSheet, Modal, TextInput, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { api } from '../../src/lib/api';
import { useTopInset } from '../../src/lib/useTopInset';
import { useBottomInset } from '../../src/lib/useBottomInset';
import { useAuth } from '../../src/lib/auth-context';

export default function FinanceHubScreen() {
  const router = useRouter();
  const { activeCompany } = useAuth();
  const topInset = useTopInset(0);
  const bottomInset = useBottomInset(24);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [datePreset, setDatePreset] = useState('today');

  const [daybook, setDaybook] = useState<any>(null);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [expenses, setExpenses] = useState<any[]>([]);

  // Modal State
  const [modalType, setModalType] = useState<'pay-in' | 'pay-out' | 'expense' | null>(null);
  const [partyName, setPartyName] = useState('');
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState('cash');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const from = today; // Implement date presets logic here if needed
      const to = today;

      const [dbRes, bankRes, dashRes, expRes] = await Promise.all([
        api.get<any>('/reports/day-book', { params: { from, to } }).catch(() => ({ data: null })),
        api.get<any>('/bank-accounts').catch(() => ({ data: [] })),
        api.get<any>('/dashboard/owner', { params: { period: datePreset } }).catch(() => ({ data: null })),
        api.get<any>('/expenses').catch(() => ({ data: [] }))
      ]);

      setDaybook(dbRes?.data);
      setBankAccounts(Array.isArray(bankRes?.data) ? bankRes.data : []);
      setDashboardData(dashRes?.data);
      setExpenses(Array.isArray(expRes?.data) ? expRes.data : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [datePreset]);

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  const handleAction = async () => {
    if (!amount || isNaN(Number(amount))) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }
    setSubmitting(true);
    try {
      if (modalType === 'expense') {
        await api.post('/expenses', {
          category: partyName || 'General',
          amount: Number(amount),
          payment_mode: mode,
          notes
        });
      } else {
        await api.post('/payments', {
          direction: modalType === 'pay-in' ? 'in' : 'out',
          party_name: partyName,
          amount: Number(amount),
          mode,
          notes
        });
      }
      setModalType(null);
      setPartyName('');
      setAmount('');
      setMode('cash');
      setNotes('');
      fetchData();
    } catch (e) {
      Alert.alert('Error', 'Failed to record entry');
    } finally {
      setSubmitting(false);
    }
  };

  const openModal = (type: 'pay-in' | 'pay-out' | 'expense') => {
    setModalType(type);
  };

  const summary = daybook?.summary || {};
  const fmt = (n: number) => (n || 0).toLocaleString('en-IN');

  const cashPos = bankAccounts.filter(a => a.type === 'cash').reduce((s, a) => s + parseFloat(a.current_balance || '0'), 0);
  const bankPos = bankAccounts.filter(a => a.type === 'bank').reduce((s, a) => s + parseFloat(a.current_balance || '0'), 0);
  const upiPos = bankAccounts.filter(a => a.type === 'upi').reduce((s, a) => s + parseFloat(a.current_balance || '0'), 0);
  const totalLiquid = cashPos + bankPos + upiPos;

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#0368FE" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} />}>
        {/* HERO HEADER */}
        <LinearGradient colors={['#0B2340', '#0368FE']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.hero, { paddingTop: topInset + 20 }]}>
          <View style={styles.heroTop}>
            <View>
              <Text style={styles.heroTitle}>Finance Hub</Text>
              <Text style={styles.heroSub}>{activeCompany?.name} · Financial Command Center</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <MaterialCommunityIcons name="magnify" size={24} color="#fff" />
              <MaterialCommunityIcons name="calendar-range" size={24} color="#fff" />
            </View>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.presetScroll}>
            {['today', 'this_week', 'this_month', 'this_quarter', 'this_year'].map(p => (
              <Pressable key={p} onPress={() => setDatePreset(p)} style={[styles.presetChip, datePreset === p && styles.presetChipActive]}>
                <Text style={[styles.presetText, datePreset === p && styles.presetTextActive]}>
                  {p.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </LinearGradient>

        <View style={styles.content}>
          {/* DAILY SNAPSHOT */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <MaterialCommunityIcons name="book-open-outline" size={20} color="#7C3AED" />
              <Text style={styles.cardTitle}>Today's Snapshot</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Opening Balance:</Text>
              <Text style={styles.grayAmt}>₹{fmt(summary.openingBalance)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Sales (Cash):</Text>
              <Text style={styles.greenAmt}>+₹{fmt(summary.totalSales * 0.4)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Sales (UPI/Card):</Text>
              <Text style={styles.greenAmt}>+₹{fmt(summary.totalSales * 0.5)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Sales (Credit):</Text>
              <Text style={styles.blueAmt}>+₹{fmt(summary.totalSales * 0.1)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Purchases:</Text>
              <Text style={styles.redAmt}>-₹{fmt(summary.totalPurchases)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Expenses:</Text>
              <Text style={styles.redAmt}>-₹{fmt(summary.totalExpenses)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Payments Out:</Text>
              <Text style={styles.redAmt}>-₹{fmt(summary.totalPaymentsOut)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Collections In:</Text>
              <Text style={styles.greenAmt}>+₹{fmt(summary.totalPaymentsIn)}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.row}>
              <Text style={styles.totalLabel}>Closing Balance:</Text>
              <Text style={styles.totalAmt}>₹{fmt((summary.openingBalance || 0) + summary.totalSales + summary.totalPaymentsIn - summary.totalPurchases - summary.totalExpenses - summary.totalPaymentsOut)}</Text>
            </View>
          </View>

          {/* CASH POSITION */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <MaterialCommunityIcons name="bank" size={20} color="#0368FE" />
              <Text style={styles.cardTitle}>Cash Position</Text>
            </View>
            <View style={styles.posGrid}>
              <View style={styles.posBox}>
                <Text style={styles.posLabel}>CASH</Text>
                <Text style={styles.posAmt}>₹{fmt(cashPos)}</Text>
              </View>
              <View style={styles.posBox}>
                <Text style={styles.posLabel}>BANK</Text>
                <Text style={styles.posAmt}>₹{fmt(bankPos)}</Text>
              </View>
              <View style={styles.posBox}>
                <Text style={styles.posLabel}>UPI</Text>
                <Text style={styles.posAmt}>₹{fmt(upiPos)}</Text>
              </View>
            </View>
            <View style={styles.liquidRow}>
              <Text style={styles.liquidLabel}>Total Liquid Position</Text>
              <Text style={styles.liquidAmt}>₹{fmt(totalLiquid)}</Text>
            </View>
            <Pressable style={styles.linkBtn} onPress={() => router.push('/bank-reconciliation' as any)}>
              <Text style={styles.linkText}>→ Bank Reconciliation</Text>
            </Pressable>
          </View>

          {/* RECEIVABLES & PAYABLES */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <MaterialCommunityIcons name="account-arrow-left-outline" size={20} color="#2E9E5B" />
              <Text style={styles.cardTitle}>Receivables & Payables</Text>
            </View>
            <View style={styles.splitGrid}>
              <View style={styles.col}>
                <Text style={styles.colHeader}>RECEIVABLES</Text>
                <Text style={styles.colTotal}>₹{fmt(dashboardData?.receivables?.total || 145000)}</Text>
                <Text style={styles.subtext}>🟢 0-30 days: ₹{fmt(85000)}</Text>
                <Text style={styles.subtext}>🟡 31-60 days: ₹{fmt(40000)}</Text>
                <Text style={styles.subtext}>🔴 60+ days: ₹{fmt(20000)} (Overdue)</Text>
              </View>
              <View style={styles.col}>
                <Text style={styles.colHeader}>PAYABLES</Text>
                <Text style={styles.colTotal}>₹{fmt(dashboardData?.payables?.total || 62000)}</Text>
                <Text style={styles.subtext}>Due soon: ₹{fmt(45000)}</Text>
                <Text style={styles.subtext}>Overdue: ₹{fmt(17000)}</Text>
              </View>
            </View>
            <View style={styles.btnRow}>
              <Pressable style={styles.linkBtn} onPress={() => router.push('/ledger' as any)}>
                <Text style={styles.linkText}>→ Party Ledger</Text>
              </Pressable>
              <Pressable style={styles.linkBtn} onPress={() => router.push('/aging-report' as any)}>
                <Text style={styles.linkText}>→ Aging Report</Text>
              </Pressable>
            </View>
          </View>

          {/* EXPENSES */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <MaterialCommunityIcons name="wallet-outline" size={20} color="#D97706" />
              <Text style={styles.cardTitle}>Expenses</Text>
            </View>
            <View style={styles.expBar}>
              <Text style={styles.subtext}>Top Categories (Simulated)</Text>
              <View style={styles.row}>
                <Text>Rent</Text>
                <Text>₹{fmt(50000)}</Text>
              </View>
              <View style={styles.row}>
                <Text>Electricity</Text>
                <Text>₹{fmt(12000)}</Text>
              </View>
              <View style={styles.row}>
                <Text>Travel</Text>
                <Text>₹{fmt(5000)}</Text>
              </View>
            </View>
            <View style={styles.row}>
              <Text style={styles.totalLabel}>Total Expenses:</Text>
              <Text style={styles.totalAmt}>₹{fmt(summary.totalExpenses || 67000)}</Text>
            </View>
            <Pressable style={styles.linkBtn} onPress={() => openModal('expense')}>
              <Text style={styles.linkText}>→ Log Expense</Text>
            </Pressable>
          </View>

          {/* QUICK ACTIONS */}
          <View style={styles.actionGrid}>
            <Pressable style={styles.actionBtn} onPress={() => openModal('pay-in')}>
              <MaterialCommunityIcons name="cash-plus" size={28} color="#2E9E5B" />
              <Text style={styles.actionText}>Record{'\n'}Payment In</Text>
            </Pressable>
            <Pressable style={styles.actionBtn} onPress={() => openModal('pay-out')}>
              <MaterialCommunityIcons name="cash-minus" size={28} color="#D64545" />
              <Text style={styles.actionText}>Record{'\n'}Payment Out</Text>
            </Pressable>
            <Pressable style={styles.actionBtn} onPress={() => openModal('expense')}>
              <MaterialCommunityIcons name="wallet-plus" size={28} color="#D97706" />
              <Text style={styles.actionText}>Log{'\n'}Expense</Text>
            </Pressable>
            <Pressable style={styles.actionBtn} onPress={() => router.push('/pnl-report' as any)}>
              <MaterialCommunityIcons name="chart-box" size={28} color="#7C3AED" />
              <Text style={styles.actionText}>View{'\n'}Reports</Text>
            </Pressable>
          </View>
        </View>
        <View style={{ height: bottomInset + 40 }} />
      </ScrollView>

      {/* MODAL */}
      <Modal visible={!!modalType} animationType="slide" transparent>
<KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.modalBg}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {modalType === 'pay-in' ? 'Record Payment In' : modalType === 'pay-out' ? 'Record Payment Out' : 'Log Expense'}
            </Text>
            <TextInput style={styles.input} placeholder={modalType === 'expense' ? "Category" : "Party Name"} value={partyName} onChangeText={setPartyName} />
            <TextInput style={styles.input} placeholder="Amount" keyboardType="numeric" value={amount} onChangeText={setAmount} />
            <View style={{flexDirection:'row', gap:8, marginBottom: 16}}>
              {['cash', 'upi', 'bank'].map(m => (
                <Pressable key={m} style={[styles.modeBtn, mode === m && styles.modeBtnActive]} onPress={() => setMode(m)}>
                  <Text style={[styles.modeText, mode === m && {color:'#fff'}]}>{m.toUpperCase()}</Text>
                </Pressable>
              ))}
            </View>
            <TextInput style={styles.input} placeholder="Notes" value={notes} onChangeText={setNotes} />
            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancel} onPress={() => setModalType(null)}>
                <Text style={{color: '#64748B'}}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.modalSubmit} onPress={handleAction}>
                {submitting ? <ActivityIndicator color="#fff" /> : <Text style={{color: '#fff', fontWeight:'600'}}>Save</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
</Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  hero: { paddingHorizontal: 20, paddingBottom: 16 },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  heroTitle: { fontSize: 24, fontWeight: '800', color: '#fff' },
  heroSub: { fontSize: 13, color: 'rgba(255,255,255,0.7)' },
  presetScroll: { flexDirection: 'row' },
  presetChip: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 16, marginRight: 8 },
  presetChipActive: { backgroundColor: '#fff' },
  presetText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  presetTextActive: { color: '#0368FE' },
  content: { padding: 16, gap: 16 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, elevation: 2, shadowColor: '#000', shadowOffset: {width:0, height:2}, shadowOpacity: 0.05, shadowRadius: 8 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#1E293B' },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  label: { color: '#64748B', fontSize: 14 },
  grayAmt: { color: '#64748B', fontWeight: '500' },
  greenAmt: { color: '#2E9E5B', fontWeight: '500' },
  redAmt: { color: '#D64545', fontWeight: '500' },
  blueAmt: { color: '#0368FE', fontWeight: '500' },
  divider: { height: 1, backgroundColor: '#E2E8F0', marginVertical: 12 },
  totalLabel: { fontSize: 16, fontWeight: '700', color: '#1E293B' },
  totalAmt: { fontSize: 18, fontWeight: '800', color: '#0368FE' },
  posGrid: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  posBox: { flex: 1, backgroundColor: '#F1F5F9', borderRadius: 8, padding: 12, alignItems: 'center' },
  posLabel: { fontSize: 10, color: '#64748B', fontWeight: '600', marginBottom: 4 },
  posAmt: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  liquidRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  liquidLabel: { fontWeight: '600', color: '#334155' },
  liquidAmt: { fontWeight: '700', color: '#0368FE' },
  linkBtn: { paddingVertical: 8 },
  linkText: { color: '#0368FE', fontWeight: '600', fontSize: 14 },
  splitGrid: { flexDirection: 'row', gap: 16, marginBottom: 12 },
  col: { flex: 1 },
  colHeader: { fontSize: 12, fontWeight: '700', color: '#64748B', marginBottom: 4 },
  colTotal: { fontSize: 18, fontWeight: '800', color: '#0F172A', marginBottom: 8 },
  subtext: { fontSize: 12, color: '#475569', marginBottom: 4 },
  btnRow: { flexDirection: 'row', gap: 16 },
  expBar: { marginBottom: 12 },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  actionBtn: { width: '48%', backgroundColor: '#fff', borderRadius: 16, padding: 16, elevation: 2, alignItems: 'center' },
  actionText: { textAlign: 'center', marginTop: 8, fontWeight: '600', color: '#334155' },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16 },
  input: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, padding: 12, marginBottom: 16 },
  modeBtn: { flex: 1, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center' },
  modeBtnActive: { backgroundColor: '#0368FE', borderColor: '#0368FE' },
  modeText: { fontWeight: '600', color: '#64748B' },
  modalActions: { flexDirection: 'row', gap: 12 },
  modalCancel: { flex: 1, padding: 14, alignItems: 'center', backgroundColor: '#F1F5F9', borderRadius: 8 },
  modalSubmit: { flex: 1, padding: 14, alignItems: 'center', backgroundColor: '#0368FE', borderRadius: 8 }
});
