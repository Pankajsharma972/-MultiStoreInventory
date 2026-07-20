import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AlertsPanel } from '../../../components/AlertsPanel';
import { AppIcon } from '../../../components/AppIcon';
import { MetricCard } from '../../../components/MetricCard';
import { ModuleCard } from '../../../components/ModuleCard';
import { SectionHeader } from '../../../components/SectionHeader';
import { useAuth } from '../../auth/AuthProvider';
import { useAlerts } from '../../../services/useAlerts';
import { colors } from '../../../theme/colors';
import { shadows } from '../../../theme/shadows';
import { spacing } from '../../../theme/spacing';
import { typography } from '../../../theme/typography';
import { useInventoryData } from '../../../services/useInventoryData';
import type { AppStackParamList } from '../../../navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'AdminDashboard'>;

const ALL_STORES = '__all__';

const adminModules: Array<{
  title: string;
  route: keyof AppStackParamList;
  subtitle: string;
  icon: 'box' | 'store' | 'transfer' | 'shoppingBag' | 'delivery' | 'history' | 'alertCircle';
  iconBg: string;
  iconTint: string;
}> = [
  {
    title: 'Inventory Search',
    route: 'Inventory',
    subtitle: 'Search, update quantities, and create products.',
    icon: 'box',
    iconBg: colors.cardTintGreen,
    iconTint: colors.primary,
  },
  {
    title: 'Stores & Warehouses',
    route: 'Stores',
    subtitle: 'Manage stores, warehouses, and locations.',
    icon: 'store',
    iconBg: colors.cardTintBlue,
    iconTint: colors.accent,
  },
  {
    title: 'Stock Transfer',
    route: 'Transfer',
    subtitle: 'Move stock between stores and warehouses.',
    icon: 'transfer',
    iconBg: colors.cardTintPurple,
    iconTint: '#7C3AED',
  },
  {
    title: 'Order Booking',
    route: 'Orders',
    subtitle: 'Book orders and track statuses.',
    icon: 'shoppingBag',
    iconBg: colors.cardTintAmber,
    iconTint: colors.warning,
  },
  {
    title: 'Pending Deliveries',
    route: 'Deliveries',
    subtitle: 'Manage delivery dates and status.',
    icon: 'delivery',
    iconBg: colors.cardTintBlue,
    iconTint: colors.accent,
  },
  {
    title: 'Low Stock Alerts',
    route: 'LowStock',
    subtitle: 'Review critical and out-of-stock items.',
    icon: 'alertCircle',
    iconBg: colors.cardTintRed,
    iconTint: colors.danger,
  },
  {
    title: 'Activity History',
    route: 'History',
    subtitle: 'Full audit log of inventory actions.',
    icon: 'history',
    iconBg: colors.cardTintGreen,
    iconTint: colors.primaryDark,
  },
];

function getGreeting() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'Good Morning';
  if (hour >= 12 && hour < 17) return 'Good Afternoon';
  if (hour >= 17 && hour < 21) return 'Good Evening';
  return 'Good Night';
}

function formatActivityTime(value?: unknown) {
  const maybeTimestamp = value as { toDate?: () => Date } | undefined;
  const date = maybeTimestamp?.toDate?.();
  if (!date) return 'Recently';
  const diff = Date.now() - date.getTime();
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return date.toLocaleDateString();
}

export function AdminDashboardScreen({ navigation }: Props) {
  const { profile, user } = useAuth();
  const data = useInventoryData();
  const { width } = useWindowDimensions();
  const [alertsOpen, setAlertsOpen] = useState(false);
  const { alerts, markRead, markAllRead, clearAll } = useAlerts(user?.uid, profile);
  const displayName = profile?.name || user?.displayName || 'Administrator';
  const metricWidth = '48%';
  const unreadCount = alerts.filter(a => !a.read).length;

  const storeBreakdown = useMemo(() => {
    const total = data.inventory.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    return data.stores
      .map(store => {
        const units = data.inventory
          .filter(item => item.storeId === store.id)
          .reduce((sum, item) => sum + Number(item.quantity || 0), 0);
        return {
          id: store.id,
          name: store.name,
          units,
          percent: total > 0 ? Math.round((units / total) * 100) : 0,
        };
      })
      .sort((a, b) => b.units - a.units);
  }, [data.stores, data.inventory]);

  const barColors = [colors.primary, colors.accent, colors.warning, '#7C3AED', '#EC4899'];

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* ── Hero ── */}
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={styles.heroLeft}>
              <Text style={styles.heroKicker}>Good morning 👋</Text>
              <Text style={styles.heroName}>Admin Account 😊</Text>
            </View>
            <View style={styles.heroActions}>
              <View style={styles.syncBadge}>
                <View style={styles.syncDot} />
                <Text style={styles.syncText}>Live</Text>
              </View>
              <Pressable
                style={styles.iconButton}
                onPress={() => setAlertsOpen(true)}>
                <AppIcon name="bell" size={18} tintColor="#FFFFFF" />
                {unreadCount > 0 && (
                  <View style={styles.bellBadge}>
                    <Text style={styles.bellBadgeText}>
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </Text>
                  </View>
                )}
              </Pressable>
            </View>
          </View>
        </View>

        {data.error ? (
          <View style={styles.errorBox}>
            <AppIcon name="alertCircle" size={18} tintColor={colors.danger} />
            <View style={styles.errorTextWrap}>
              <Text style={styles.errorTitle}>Sync Issue</Text>
              <Text style={styles.errorText}>{data.error}</Text>
            </View>
          </View>
        ) : null}

        {data.loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={colors.primary} size="large" />
          </View>
        ) : null}

        <View style={styles.metricGrid}>
          <MetricCard
            style={{ width: metricWidth }}
            label="Total Inventory"
            value={data.inventory.reduce((s, i) => s + Number(i.quantity || 0), 0)}
            icon="box"
            iconBg={colors.cardTintGreen}
            iconTint={colors.primary}
          />
          <MetricCard
            style={{ width: metricWidth }}
            label="Low Stock"
            value={data.lowStockItems.length}
            icon="alertCircle"
            iconBg={colors.cardTintRed}
            iconTint={colors.danger}
            onPress={() => navigation.navigate('LowStock')}
          />
          <MetricCard
            style={{ width: metricWidth }}
            label="Pending Orders"
            value={data.stats.pendingOrders}
            icon="shoppingBag"
            iconBg={colors.cardTintAmber}
            iconTint={colors.warning}
            onPress={() => navigation.navigate('Orders')}
          />
          <MetricCard
            style={{ width: metricWidth }}
            label="Pending Deliveries"
            value={data.stats.pendingDeliveries}
            icon="delivery"
            iconBg={colors.cardTintBlue}
            iconTint={colors.accent}
            onPress={() => navigation.navigate('Deliveries')}
          />
        </View>

        <SectionHeader title="Store Summary" meta={`${storeBreakdown.length} stores`} />
        <View style={styles.distributionCard}>
          {storeBreakdown.length === 0 ? (
            <Text style={styles.emptyInline}>No inventory data yet.</Text>
          ) : (
            storeBreakdown.map((store, index) => (
              <View key={store.id} style={styles.barRow}>
                <View style={styles.barLabelRow}>
                  <Text style={styles.barLabel}>{store.name}</Text>
                  <Text style={styles.barValue}>
                    {store.units} units · {store.percent}%
                  </Text>
                </View>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      {
                        width: `${Math.max(store.percent, 4)}%`,
                        backgroundColor: barColors[index % barColors.length],
                      },
                    ]}
                  />
                </View>
              </View>
            ))
          )}
        </View>

        <SectionHeader
          title="Recent Activity"
          actionLabel="View All"
          onAction={() => navigation.navigate('History')}
        />
        {data.activity.length === 0 ? (
          <View style={styles.activityEmpty}>
            <AppIcon name="history" size={24} tintColor={colors.muted} />
            <Text style={styles.activityEmptyText}>No recent activity logs.</Text>
          </View>
        ) : (
          data.activity.slice(0, 5).map(log => (
            <View key={log.id} style={styles.activityRow}>
              <View style={[styles.activityIcon, { backgroundColor: log.action.includes('Transfer') ? '#F5F3FF' : log.action.includes('Order') ? colors.cardTintAmber : log.action.includes('Delivery') ? colors.cardTintBlue : log.action.includes('Alert') || log.action.includes('Removed') ? colors.cardTintRed : colors.cardTintGreen }]}>
                <AppIcon
                  name={
                    log.action.includes('Transfer')
                      ? 'transfer'
                      : log.action.includes('Order')
                        ? 'shoppingBag'
                        : log.action.includes('Delivery')
                          ? 'delivery'
                          : log.action.includes('Alert') || log.action.includes('Removed')
                            ? 'alertCircle'
                            : 'box'
                  }
                  size={16}
                  tintColor={
                    log.action.includes('Transfer')
                      ? '#7C3AED'
                      : log.action.includes('Order')
                        ? colors.warning
                        : log.action.includes('Delivery')
                          ? colors.accent
                          : log.action.includes('Alert') || log.action.includes('Removed')
                            ? colors.danger
                            : colors.primary
                  }
                />
              </View>
              <View style={styles.activityBody}>
                <Text style={styles.activityAction}>{log.action}</Text>
                <Text style={styles.activityDetail} numberOfLines={2}>
                  {log.detail}
                </Text>
                <Text style={styles.activityMeta}>
                  {log.createdBy || 'System'} · {formatActivityTime(log.createdAt)}
                </Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Alerts panel */}
      <AlertsPanel
        visible={alertsOpen}
        alerts={alerts}
        onClose={() => setAlertsOpen(false)}
        onMarkRead={markRead}
        onMarkAllRead={markAllRead}
        onClearAll={clearAll}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl + spacing.lg,
    gap: spacing.md,
  },
  hero: {
    backgroundColor: colors.heroDark,
    borderRadius: 24,
    padding: spacing.xl,
    ...shadows.lg,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroLeft: {
    flex: 1,
  },
  heroKicker: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: 11,
    color: colors.primaryLight,
    letterSpacing: 1.2,
    marginBottom: spacing.xs,
  },
  heroName: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.xxl,
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  heroActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  syncBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(22,163,74,0.2)',
    borderRadius: 20,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    gap: 6,
  },
  syncDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primaryLight,
  },
  syncText: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: 10,
    color: colors.primaryLight,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    backgroundColor: colors.danger,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: colors.heroDark,
  },
  bellBadgeText: {
    fontFamily: typography.fontFamily.bold,
    fontSize: 9,
    color: colors.surface,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.cardTintRed,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FECACA',
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  errorTextWrap: {
    flex: 1,
  },
  errorTitle: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.sm,
    color: colors.danger,
  },
  errorText: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    color: colors.danger,
    marginTop: 2,
  },
  loadingWrap: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  storeFilterRow: {
    marginBottom: spacing.lg,
    marginHorizontal: -spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  storeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginRight: spacing.sm,
  },
  storeChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  storeChipText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.xs,
    color: colors.inkSoft,
  },
  storeChipTextActive: {
    color: colors.surface,
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  distributionCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    ...shadows.sm,
  },
  barRow: {
    marginBottom: spacing.md,
  },
  barLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  barLabel: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.sm,
    color: colors.ink,
  },
  barValue: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    color: colors.muted,
  },
  barTrack: {
    height: 8,
    backgroundColor: colors.background,
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },
  emptyInline: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.sm,
    color: colors.muted,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
  moduleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  activityRow: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.sm,
    ...shadows.sm,
  },
  activityIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.cardTintBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityBody: {
    flex: 1,
  },
  activityAction: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.sm,
    color: colors.ink,
  },
  activityDetail: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    color: colors.muted,
    marginTop: 2,
    lineHeight: 16,
  },
  activityMeta: {
    fontFamily: typography.fontFamily.regular,
    fontSize: 11,
    color: colors.muted,
    marginTop: spacing.xs,
  },
  activityEmpty: {
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  activityEmptyText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.sm,
    color: colors.muted,
    marginTop: spacing.sm,
  },
});
