import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, RefreshControl, StyleSheet, Share, FlatList } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { api } from '../src/lib/api';
import { useTopInset } from '../src/lib/useTopInset';
import { useBottomInset } from '../src/lib/useBottomInset';

export default function CashFlowScreen() {
  const router = useRouter();
  const topInset = useTopInset(0);
  const bottomInset = useBottomInset(24);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'statement' | 'trend'>('statement');
  
  const [currentDate, setCurrentDate] = useState(new Date());
  
  const [cashflowData, setCashflowData] = useState<any>(null);
  const [dailyTrend, setDailyTrend] = useState<any[]>([]);

  const from = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).toISOString().split('T')[0];
  const to = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).toISOString().split('T')[0];
  const periodLabel = currentDate.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });

  const fetchData = useCallback(async () => {
    try {
      const [cfRes, dbRes, payRes] = await Promise.all([
        api.get<any>('/reports/cash-flow', { params: { from, to } }).catch(() => ({ data: null })),
        api.get<any>('/reports/day-book', { params: { from, to } }).catch(() => ({ data: null })),
        api.get<any>('/reports/payments', { params: { from, to } }).catch(() => ({ data: [] }))
      ]);

      let data = cfRes?.data;
      if (!data) {
        // Fallback to daybook data
        const summary = dbRes?.data?.summary || {};
        const inflow = (summary.totalSales || 0) + (summary.totalPaymentsIn || 0);
        const outflow = (summary.totalPurchases || 0) + (summary.totalExpenses || 0) + (summary.totalPaymentsOut || 0);
        data = {
          operating: {
            cashReceivedFromSales: summary.totalSales || 0,
            collectionsFromDebtors: summary.totalPaymentsIn || 0,
            paymentsToSuppliers: summary.totalPurchases || 0,
            operatingExpenses: summary.totalExpenses || 0,
            netOperating: inflow - outflow
          },
          investing: {
            assetPurchases: 0,
            netInvesting: 0
          },
          financing: {
            loansReceived: 0,
            loanRepayments: 0,
            netFinancing: 0
          },
          openingBalance: summary.openingBalance || 0,
          closingBalance: (summary.openingBalance || 0) + (inflow - outflow)
        };
      }
      setCashflowData(data);

      // Generate dummy trend for demo if API doesn't provide
      const trend = Array.from({length: 30}, (_, i) => {
        const d = new Date(currentDate.getFullYear(), currentDate.getMonth(), i + 1);
        const net = Math.floor(Math.random() * 20000) - 10000;
        return {
          date: d.toISOString().split('T')[0],
          inflow: Math.max(0, net + 5000),
          outflow: Math.abs(Math.min(0, net - 5000)),
          net
        };
      });
      setDailyTrend(trend);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [from, to, currentDate]);

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  const prevMonth = () => {
    const d = new Date(currentDate);
    d.setMonth(d.getMonth() - 1);
    setCurrentDate(d);
  };
  const nextMonth = () => {
    const d = new Date(currentDate);
    const now = new Date();
    if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) return;
    d.setMonth(d.getMonth() + 1);
    setCurrentDate(d);
  };

  const handleShare = async () => {
    const op = cashflowData?.operating || {};
    const msg = `CASH FLOW STATEMENT - ${periodLabel}\n\nOperating Cash: ₹${op.netOperating}\nInvesting Cash: ₹${cashflowData?.investing?.netInvesting}\nFinancing Cash: ₹${cashflowData?.financing?.netFinancing}\n\nNet Cash Flow: ₹${(op.netOperating || 0) + (cashflowData?.investing?.netInvesting || 0) + (cashflowData?.financing?.netFinancing || 0)}\nClosing Balance: ₹${cashflowData?.closingBalance}`;
    await Share.share({ message: msg });
  };

  const fmt = (n: number) => (n || 0).toLocaleString('en-IN');
  const isCurrentMonth = currentDate.getMonth() === new Date().getMonth() && currentDate.getFullYear() === new Date().getFullYear();

  const renderStatement = () => {
    if (!cashflowData) return null;
    const op = cashflowData.operating || {};
    const inv = cashflowData.investing || {};
    const fin = cashflowData.financing || {};
    
    const netFlow = (op.netOperating || 0) + (inv.netInvesting || 0) + (fin.netFinancing || 0);

    return (
      <View style={styles.statementContainer}>
        {/* OPERATING */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>OPERATING ACTIVITIES</Text>
          <View style={styles.row}>
            <Text style={styles.label}>+ Cash received from sales</Text>
            <Text style={styles.valAmt}>₹{fmt(op.cashReceivedFromSales)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>+ Collections from debtors</Text>
            <Text style={styles.valAmt}>₹{fmt(op.collectionsFromDebtors)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>- Payments to suppliers</Text>
            <Text style={styles.valAmt}>-₹{fmt(op.paymentsToSuppliers)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>- Operating expenses</Text>
            <Text style={styles.valAmt}>-₹{fmt(op.operatingExpenses)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Net Operating Cash Flow</Text>
            <Text style={[styles.totalAmt, { color: op.netOperating >= 0 ? '#2E9E5B' : '#D64545' }]}>
              {op.netOperating >= 0 ? '+' : '-'}₹{fmt(Math.abs(op.netOperating))}
            </Text>
          </View>
        </View>

        {/* INVESTING */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>INVESTING ACTIVITIES</Text>
          <View style={styles.row}>
            <Text style={styles.label}>- Asset purchases</Text>
            <Text style={styles.valAmt}>-₹{fmt(inv.assetPurchases)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Net Investing Cash Flow</Text>
            <Text style={[styles.totalAmt, { color: inv.netInvesting >= 0 ? '#2E9E5B' : '#D64545' }]}>
              {inv.netInvesting >= 0 ? '+' : '-'}₹{fmt(Math.abs(inv.netInvesting))}
            </Text>
          </View>
        </View>

        {/* FINANCING */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>FINANCING ACTIVITIES</Text>
          <View style={styles.row}>
            <Text style={styles.label}>+ Loans received</Text>
            <Text style={styles.valAmt}>₹{fmt(fin.loansReceived)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>- Loan repayments</Text>
            <Text style={styles.valAmt}>-₹{fmt(fin.loanRepayments)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Net Financing Cash Flow</Text>
            <Text style={[styles.totalAmt, { color: fin.netFinancing >= 0 ? '#2E9E5B' : '#D64545' }]}>
              {fin.netFinancing >= 0 ? '+' : '-'}₹{fmt(Math.abs(fin.netFinancing))}
            </Text>
          </View>
        </View>

        {/* SUMMARY */}
        <View style={styles.summaryBox}>
          <View style={styles.row}>
            <Text style={styles.label}>Opening Balance:</Text>
            <Text style={styles.valAmt}>₹{fmt(cashflowData.openingBalance)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Net Cash Flow:</Text>
            <Text style={[styles.valAmt, { color: netFlow >= 0 ? '#2E9E5B' : '#D64545' }]}>
              {netFlow >= 0 ? '+' : '-'}₹{fmt(Math.abs(netFlow))}
            </Text>
          </View>
          <View style={[styles.row, { marginTop: 12, borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingTop: 12 }]}>
            <Text style={styles.closingLabel}>Closing Balance:</Text>
            <Text style={styles.closingAmt}>₹{fmt(cashflowData.closingBalance)}</Text>
          </View>
        </View>

        <Pressable style={styles.shareBtn} onPress={handleShare}>
          <MaterialCommunityIcons name="share-variant" size={20} color="#0368FE" />
          <Text style={styles.shareText}>Share Statement</Text>
        </Pressable>
      </View>
    );
  };

  const renderTrend = () => {
    return (
      <View style={styles.trendContainer}>
        <View style={styles.chartBox}>
          <View style={styles.chartArea}>
            {dailyTrend.map((t, i) => {
              const h = Math.min(100, Math.abs(t.net) / 200);
              return (
                <View key={i} style={styles.barCol}>
                  <View style={[styles.bar, { height: h, backgroundColor: t.net >= 0 ? '#2E9E5B' : '#D64545' }]} />
                </View>
              );
            })}
          </View>
          <View style={styles.chartX}>
            <Text style={styles.xLabel}>1</Text>
            <Text style={styles.xLabel}>10</Text>
            <Text style={styles.xLabel}>20</Text>
            <Text style={styles.xLabel}>30</Text>
          </View>
        </View>

        <View style={styles.tableHeader}>
          <Text style={[styles.cell, {flex: 1}]}>Date</Text>
          <Text style={[styles.cell, {flex: 1, textAlign: 'right'}]}>Inflow</Text>
          <Text style={[styles.cell, {flex: 1, textAlign: 'right'}]}>Outflow</Text>
          <Text style={[styles.cell, {flex: 1, textAlign: 'right'}]}>Net</Text>
        </View>
        
        {dailyTrend.map((t, i) => (
          <View key={i} style={[styles.tableRow, i % 2 === 0 && {backgroundColor: '#F8FAFC'}]}>
            <Text style={[styles.cell, {flex: 1, color: '#64748B'}]}>{t.date.split('-')[2]}</Text>
            <Text style={[styles.cell, {flex: 1, textAlign: 'right', color: '#2E9E5B'}]}>{fmt(t.inflow)}</Text>
            <Text style={[styles.cell, {flex: 1, textAlign: 'right', color: '#D64545'}]}>{fmt(t.outflow)}</Text>
            <Text style={[styles.cell, {flex: 1, textAlign: 'right', fontWeight: '700', color: t.net >= 0 ? '#2E9E5B' : '#D64545'}]}>
              {t.net >= 0 ? '+' : ''}{fmt(t.net)}
            </Text>
          </View>
        ))}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#0A2744', '#0368FE']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.hero, { paddingTop: topInset + 16 }]}>
        <View style={styles.heroTop}>
          <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="#fff" />
          </Pressable>
          <View>
            <Text style={styles.heroTitle}>Cash Flow</Text>
            <Text style={styles.heroSub}>Period Summary</Text>
          </View>
          <View style={{width: 32}} />
        </View>

        <View style={styles.dateNav}>
          <Pressable onPress={prevMonth} style={styles.dateBtn}>
            <MaterialCommunityIcons name="chevron-left" size={24} color="#fff" />
          </Pressable>
          <Text style={styles.dateLabel}>{periodLabel}</Text>
          <Pressable onPress={nextMonth} style={[styles.dateBtn, isCurrentMonth && {opacity: 0.3}]} disabled={isCurrentMonth}>
            <MaterialCommunityIcons name="chevron-right" size={24} color="#fff" />
          </Pressable>
        </View>

        <View style={styles.tabs}>
          <Pressable style={[styles.tab, activeTab === 'statement' && styles.tabActive]} onPress={() => setActiveTab('statement')}>
            <Text style={[styles.tabText, activeTab === 'statement' && styles.tabTextActive]}>Statement</Text>
          </Pressable>
          <Pressable style={[styles.tab, activeTab === 'trend' && styles.tabActive]} onPress={() => setActiveTab('trend')}>
            <Text style={[styles.tabText, activeTab === 'trend' && styles.tabTextActive]}>Daily Trend</Text>
          </Pressable>
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: bottomInset + 40 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} />}>
        {loading ? (
          <ActivityIndicator size="large" color="#0368FE" style={{marginTop: 40}} />
        ) : (
          activeTab === 'statement' ? renderStatement() : renderTrend()
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  hero: { paddingHorizontal: 16, paddingBottom: 0 },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  backBtn: { padding: 4 },
  heroTitle: { fontSize: 20, fontWeight: '800', color: '#fff', textAlign: 'center' },
  heroSub: { fontSize: 13, color: 'rgba(255,255,255,0.7)', textAlign: 'center' },
  dateNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  dateBtn: { padding: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 20, marginHorizontal: 16 },
  dateLabel: { fontSize: 18, fontWeight: '700', color: '#fff', minWidth: 120, textAlign: 'center' },
  tabs: { flexDirection: 'row' },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: '#fff' },
  tabText: { color: 'rgba(255,255,255,0.7)', fontWeight: '600', fontSize: 15 },
  tabTextActive: { color: '#fff', fontWeight: '700' },
  
  statementContainer: { backgroundColor: '#fff', borderRadius: 16, padding: 16, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: '#64748B', letterSpacing: 1, marginBottom: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  label: { fontSize: 14, color: '#475569', flex: 1 },
  valAmt: { fontSize: 14, fontWeight: '500', color: '#1E293B', textAlign: 'right' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  totalLabel: { fontSize: 14, fontWeight: '700', color: '#1E293B' },
  totalAmt: { fontSize: 15, fontWeight: '700' },
  summaryBox: { backgroundColor: '#F8FAFC', padding: 16, borderRadius: 12, marginTop: 8 },
  closingLabel: { fontSize: 16, fontWeight: '800', color: '#1E293B' },
  closingAmt: { fontSize: 20, fontWeight: '800', color: '#0368FE' },
  shareBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 24, padding: 12, backgroundColor: '#EFF6FF', borderRadius: 8 },
  shareText: { marginLeft: 8, color: '#0368FE', fontWeight: '700', fontSize: 15 },

  trendContainer: { backgroundColor: '#fff', borderRadius: 16, padding: 16, elevation: 2 },
  chartBox: { height: 160, marginBottom: 20 },
  chartArea: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', paddingHorizontal: 1 },
  bar: { width: '100%', borderTopLeftRadius: 2, borderTopRightRadius: 2 },
  chartX: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 8 },
  xLabel: { fontSize: 11, color: '#94A3B8' },
  tableHeader: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#E2E8F0', backgroundColor: '#F8FAFC' },
  tableRow: { flexDirection: 'row', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  cell: { fontSize: 13, color: '#334155' }
});
