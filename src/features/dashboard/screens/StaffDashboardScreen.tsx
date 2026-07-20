import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppBar } from '../../../components/AppBar';
import { AppIcon } from '../../../components/AppIcon';
import { ActivityTimeline } from '../../../components/ActivityTimeline';
import { BarListCard } from '../../../components/BarListCard';
import { StatCard } from '../../../components/StatCard';
import { StoreFilterPill } from '../../../components/StoreFilterPill';
import { colors } from '../../../theme/colors';
import { spacing } from '../../../theme/spacing';
import { typography } from '../../../theme/typography';
import { useInventoryData } from '../../../services/useInventoryData';
import type { AppStackParamList } from '../../../navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'StaffDashboard'>;

function getGreeting() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'Good morning';
  if (hour >= 12 && hour < 17) return 'Good afternoon';
  if (hour >= 17 && hour < 21) return 'Good evening';
  return 'Good night';
}

export function StaffDashboardScreen({ navigation }: Props) {
  const data = useInventoryData();

  const totalUnits = useMemo(
    () => data.inventory.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
    [data.inventory],
  );

  const storeLabel = useMemo(() => {
    if (data.stores.length === 0) return 'No store assigned';
    if (data.stores.length === 1) return data.stores[0].name;
    return `${data.stores.length} stores assigned`;
  }, [data.stores]);

  const warehouseRows = useMemo(() => {
    return data.warehouses
      .map(warehouse => {
        const units = data.inventory
          .filter(item => item.warehouseId === warehouse.id)
          .reduce((sum, item) => sum + Number(item.quantity || 0), 0);
        return {
          id: warehouse.id,
          label: warehouse.name,
          units,
          percent: totalUnits > 0 ? Math.round((units / totalUnits) * 100) : 0,
        };
      })
      .sort((a, b) => b.units - a.units)
      .slice(0, 5);
  }, [data.warehouses, data.inventory, totalUnits]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <AppBar
        title="Dashboard"
        leftIcon="menu"
        onLeftPress={() => navigation.navigate('Operations')}
        rolePill="Staff"
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <StoreFilterPill label={storeLabel} />

        {data.error ? (
          <View style={styles.errorBox}>
            <AppIcon name="alertCircle" size={18} tintColor={colors.danger} />
            <View style={styles.errorTextWrap}>
              <Text style={styles.errorTitle}>Sync Issue</Text>
              <Text style={styles.errorText}>{data.error}</Text>
            </View>
          </View>
        ) : null}

        <View style={styles.greetingWrap}>
          <Text style={styles.overline}>TODAY AT YOUR STORE</Text>
          <Text style={styles.greeting}>{getGreeting()} 👋</Text>
        </View>

        {data.loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={colors.primary} size="large" />
          </View>
        ) : null}

        <View style={styles.statGrid}>
          <StatCard
            style={styles.statCard}
            label="Inventory"
            value={totalUnits.toLocaleString()}
            caption={`${data.stats.productCount} products`}
            captionTone="positive"
          />
          <StatCard
            style={styles.statCard}
            label="Pending Orders"
            value={data.stats.pendingOrders}
            caption="stable"
            captionTone="neutral"
            onPress={() => navigation.navigate('Orders')}
          />
          <StatCard
            style={styles.statCard}
            label="Deliveries"
            value={data.stats.pendingDeliveries}
            caption="on track"
            captionTone="neutral"
            onPress={() => navigation.navigate('Deliveries')}
          />
          <StatCard
            style={styles.statCard}
            label="Low Stock"
            value={data.lowStockItems.length}
            caption={data.lowStockItems.length > 0 ? 'review' : 'all clear'}
            captionTone={data.lowStockItems.length > 0 ? 'negative' : 'positive'}
            onPress={() => navigation.navigate('LowStock')}
          />
        </View>

        <BarListCard
          title="Warehouse-wise"
          rows={warehouseRows}
          emptyText="No warehouse data yet."
        />

        <ActivityTimeline
          activity={data.activity}
          onSeeAll={() => navigation.navigate('History')}
        />
      </ScrollView>
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
    gap: spacing.lg,
  },
  greetingWrap: {
    gap: spacing.xs,
  },
  overline: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: 11,
    letterSpacing: 1,
    color: colors.muted,
  },
  greeting: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.xxl,
    color: colors.ink,
    letterSpacing: -0.3,
  },
  loadingWrap: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  statCard: {
    width: '47.5%',
    flexGrow: 1,
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
});
