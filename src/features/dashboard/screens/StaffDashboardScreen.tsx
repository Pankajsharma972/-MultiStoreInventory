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
import { SectionHeader } from '../../../components/SectionHeader';
import { useAuth } from '../../auth/AuthProvider';
import { useAlerts } from '../../../services/useAlerts';
import { colors } from '../../../theme/colors';
import { shadows } from '../../../theme/shadows';
import { spacing } from '../../../theme/spacing';
import { typography } from '../../../theme/typography';
import { useInventoryData } from '../../../services/useInventoryData';
import type { AppStackParamList } from '../../../navigation/types';

type StaffDashboardProps = NativeStackScreenProps<AppStackParamList, 'StaffDashboard'>;

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

export function StaffDashboardScreen({ navigation }: StaffDashboardProps) {
  const { profile, user } = useAuth();
  const data = useInventoryData();
  const { width } = useWindowDimensions();
  const [alertsOpen, setAlertsOpen] = useState(false);
  const { alerts, markRead, markAllRead, clearAll } = useAlerts(user?.uid, profile);
  const displayName = profile?.name || user?.displayName || 'Operator';
  const metricWidth = '48%';
  const unreadCount = alerts.filter(a => !a.read).length;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* ── Hero ── */}
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={styles.heroLeft}>
              <Text style={styles.heroKicker}>Good morning 👋</Text>
              <Text style={styles.heroName}>Staff Account 😊</Text>
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

        <SectionHeader title="Your Stores" meta={`${data.stores.length} active`} />
        <View style={styles.storeGrid}>
          {data.stores.length === 0 ? (
            <Text style={styles.emptyInline}>No assigned stores found.</Text>
          ) : (
            data.stores.map(store => {
              const total = data.inventory
                .filter(item => item.storeId === store.id)
                .reduce((sum, item) => sum + Number(item.quantity || 0), 0);
              const maxTotal = Math.max(
                ...data.stores.map(s =>
                  data.inventory
                    .filter(i => i.storeId === s.id)
                    .reduce((sum, i) => sum + Number(i.quantity || 0), 0),
                ),
                1,
              );
              const fillPercent = Math.round((total / maxTotal) * 100);
              return (
                <View key={store.id} style={[styles.storeCard, { width: width > 720 ? '48.5%' : '100%' }]}>
                  <View style={styles.storeCardHeader}>
                    <View style={styles.storeIconWrap}>
                      <AppIcon name="store" size={16} tintColor={colors.primary} />
                    </View>
                    <Text style={styles.storeName}>{store.name}</Text>
                  </View>
                  <Text style={styles.storeUnits}>{total} units in stock</Text>
                  <View style={styles.storeBarTrack}>
                    <View style={[styles.storeBarFill, { width: `${Math.max(fillPercent, 6)}%` }]} />
                  </View>
                </View>
              );
            })
          )}
        </View>

        <SectionHeader title="Recent Activity" />
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
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  storeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  storeCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  storeCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  storeIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.cardTintGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storeName: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.sm,
    color: colors.ink,
    flex: 1,
  },
  storeUnits: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    color: colors.muted,
    marginBottom: spacing.sm,
  },
  storeBarTrack: {
    height: 6,
    backgroundColor: colors.background,
    borderRadius: 3,
    overflow: 'hidden',
  },
  storeBarFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 3,
  },
  emptyInline: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.sm,
    color: colors.muted,
    textAlign: 'center',
    paddingVertical: spacing.md,
    flex: 1,
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
    flex: 1,
  },
  activityEmptyText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.sm,
    color: colors.muted,
    marginTop: spacing.sm,
  },
});