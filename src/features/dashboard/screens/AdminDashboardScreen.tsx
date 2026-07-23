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
import { StatusBadge } from '../../../components/StatusBadge';
import { colors } from '../../../theme/colors';
import { spacing } from '../../../theme/spacing';
import { typography } from '../../../theme/typography';
import { useInventoryData } from '../../../services/useInventoryData';
import type { AppStackParamList } from '../../../navigation/types';
import { useAuth } from '../../auth/AuthProvider';
type Props = NativeStackScreenProps<AppStackParamList, 'AdminDashboard'>;

function getGreeting() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'Good morning';
  if (hour >= 12 && hour < 17) return 'Good afternoon';
  if (hour >= 17 && hour < 21) return 'Good evening';
  return 'Good night';
}

export function AdminDashboardScreen({ navigation }: Props) {
  const data = useInventoryData();
const { profile } = useAuth();
  const totalUnits = useMemo(
    () => data.inventory.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
    [data.inventory],
  );

  const storeRows = useMemo(() => {
    return data.stores
      .map(store => {
        const units = data.inventory
          .filter(item => item.storeId === store.id)
          .reduce((sum, item) => sum + Number(item.quantity || 0), 0);
        return {
          id: store.id,
          label: store.name,
          units,
          percent: totalUnits > 0 ? Math.round((units / totalUnits) * 100) : 0,
        };
      })
      .sort((a, b) => b.units - a.units);
  }, [data.stores, data.inventory, totalUnits]);

  const orderCounts = useMemo(() => ({
    total: data.orders.length,
    pending: data.orders.filter(order => order.status === 'ordered').length,
    billed: data.orders.filter(order => order.status === 'billed').length,
    outForDelivery: data.orders.filter(order => order.status === 'out_for_delivery').length,
    partial: data.orders.filter(order => order.status === 'partially_delivered').length,
    delivered: data.orders.filter(order => order.status === 'delivered').length,
    cancelled: data.orders.filter(order => order.status === 'cancelled').length,
  }), [data.orders]);

  const inventoryValue = useMemo(
    () => data.inventory.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
    [data.inventory],
  );

  const recentDispatches = useMemo(
    () =>
      data.deliveries
        .filter(delivery => delivery.truckPhotoUrl || delivery.dispatchedAt)
        .slice(0, 5),
    [data.deliveries],
  );

  const cancelledOrders = useMemo(
    () => data.orders.filter(order => order.status === 'cancelled').slice(0, 5),
    [data.orders],
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <AppBar
        title="Dashboard"
        leftIcon="menu"
        onLeftPress={() => navigation.navigate('Operations')}
        rolePill="Admin"
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
     

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
         <Text style={styles.greeting}>
  {getGreeting()}, {profile?.name || 'Admin'} 👋
</Text>
        </View>

        {data.loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={colors.primary} size="large" />
          </View>
        ) : null}

        <View style={styles.statGrid}>
          <StatCard
            style={styles.statCard}
            label="Total Orders"
            value={orderCounts.total}
            caption="all stores"
            captionTone="positive"
          />
          <StatCard
            style={styles.statCard}
            label="Pending Orders"
            value={orderCounts.pending}
            caption="created"
            captionTone="neutral"
            onPress={() => navigation.navigate('Orders')}
          />
          <StatCard
            style={styles.statCard}
            label="Billed Orders"
            value={orderCounts.billed}
            caption="accounts approved"
            captionTone="neutral"
            onPress={() => navigation.navigate('Orders')}
          />
          <StatCard
            style={styles.statCard}
            label="Out for Delivery"
            value={orderCounts.outForDelivery}
            caption="dispatched"
            captionTone="positive"
            onPress={() => navigation.navigate('Deliveries')}
          />
          <StatCard
            style={styles.statCard}
            label="Partially Delivered"
            value={orderCounts.partial}
            caption="pending balance"
            captionTone="neutral"
            onPress={() => navigation.navigate('Deliveries')}
          />
          <StatCard
            style={styles.statCard}
            label="Fully Delivered"
            value={orderCounts.delivered}
            caption="completed"
            captionTone="positive"
            onPress={() => navigation.navigate('Orders')}
          />
          <StatCard
            style={styles.statCard}
            label="Cancelled"
            value={orderCounts.cancelled}
            caption="stock restored"
            captionTone="negative"
            onPress={() => navigation.navigate('Orders')}
          />
          <StatCard
            style={styles.statCard}
            label="Inventory Units"
            value={inventoryValue.toLocaleString()}
            caption={`${data.stats.productCount} products`}
            captionTone="positive"
          />
          <StatCard
            style={styles.statCard}
            label="Low Stock"
            value={data.lowStockItems.length}
            caption={data.lowStockItems.length > 0 ? 'review' : 'all clear'}
            captionTone={data.lowStockItems.length > 0 ? 'negative' : 'positive'}
            onPress={() => navigation.navigate('LowStock')}
          />
          <StatCard
            style={styles.statCard}
            label="Out of Stock"
            value={data.stats.outOfStock}
            caption="needs attention"
            captionTone={data.stats.outOfStock > 0 ? 'negative' : 'positive'}
            onPress={() => navigation.navigate('LowStock')}
          />
        </View>

        <BarListCard
          title="Store-wise Inventory"
          rows={storeRows}
          emptyText="No inventory data yet."
        />

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Recent Dispatches</Text>
          {recentDispatches.length === 0 ? (
            <Text style={styles.emptyText}>No dispatches yet.</Text>
          ) : (
            recentDispatches.map(delivery => (
              <View key={delivery.id} style={styles.row}>
                <View style={styles.rowTextWrap}>
                  <Text style={styles.rowTitle}>{delivery.customerName}</Text>
                  <Text style={styles.rowSub}>
                    {delivery.productName} · {delivery.deliveredQuantity || 0} dispatched · {data.stores.find(store => store.id === delivery.storeId)?.name || 'Store'}
                  </Text>
                </View>
                <StatusBadge label={delivery.status.replace(/_/g, ' ')} tone="processing" />
              </View>
            ))
          )}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Cancelled Orders</Text>
          {cancelledOrders.length === 0 ? (
            <Text style={styles.emptyText}>No cancelled orders.</Text>
          ) : (
            cancelledOrders.map(order => (
              <View key={order.id} style={styles.row}>
                <View style={styles.rowTextWrap}>
                  <Text style={styles.rowTitle}>{order.customerName}</Text>
                  <Text style={styles.rowSub}>
                    Returned {order.items?.reduce((sum, item) => sum + Number(item.stockReturned || 0), 0) || 0} units · {order.stockRestored ? 'stock restored' : 'pending restore'}
                  </Text>
                </View>
                <StatusBadge label="Cancelled" tone="cancelled" />
              </View>
            ))
          )}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Store Teams</Text>
          {data.stores.map(store => {
            const users = data.users.filter(user => (user.assignedStoreIds || []).includes(store.id));
            const staff = users.filter(user => user.role === 'staff').map(user => user.name);
            const accounts = users.filter(user => user.role === 'accountant').map(user => user.name);
            const supervisors = users.filter(user => user.role === 'supervisor').map(user => user.name);
            return (
              <View key={store.id} style={styles.teamBlock}>
                <Text style={styles.rowTitle}>{store.name}</Text>
                <Text style={styles.rowSub}>Staff ({staff.length}): {staff.join(', ') || 'None'}</Text>
                <Text style={styles.rowSub}>Accountant ({accounts.length}): {accounts.join(', ') || 'None'}</Text>
                <Text style={styles.rowSub}>Supervisor ({supervisors.length}): {supervisors.join(', ') || 'None'}</Text>
              </View>
            );
          })}
        </View>

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
  sectionCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  sectionTitle: {
    color: colors.ink,
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.md,
    marginBottom: spacing.xs,
  },
  emptyText: {
    color: colors.muted,
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.sm,
  },
  row: {
    alignItems: 'center',
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.sm,
    paddingTop: spacing.sm,
  },
  rowTextWrap: {
    flex: 1,
  },
  rowTitle: {
    color: colors.ink,
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.sm,
  },
  rowSub: {
    color: colors.muted,
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    marginTop: 2,
  },
  teamBlock: {
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.sm,
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
