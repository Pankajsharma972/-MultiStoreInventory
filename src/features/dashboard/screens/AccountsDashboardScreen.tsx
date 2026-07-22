import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppBar } from '../../../components/AppBar';
import { StatCard } from '../../../components/StatCard';
import { ActivityTimeline } from '../../../components/ActivityTimeline';
import { colors } from '../../../theme/colors';
import { spacing } from '../../../theme/spacing';
import { typography } from '../../../theme/typography';
import { useInventoryData } from '../../../services/useInventoryData';
import { useAuth } from '../../auth/AuthProvider';
import type { AppStackParamList } from '../../../navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'AccountsDashboard'>;

export function AccountsDashboardScreen({ navigation }: Props) {
  const { profile } = useAuth();
  const data = useInventoryData();
  const billingQueue = data.orders.filter(order => order.status === 'ordered').length;
  const finalApprovalQueue = data.deliveries.filter(
    delivery => delivery.status === 'out_for_delivery' && Number(delivery.pendingQuantity || 0) === 0,
  ).length;
  const cancelledQueue = data.orders.filter(order => order.status === 'cancelled').length;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <AppBar
        title="Accounts Dashboard"
        leftIcon="menu"
        onLeftPress={() => navigation.navigate('Operations')}
        rolePill="Accounts"
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.greetingWrap}>
          <Text style={styles.greeting}>Welcome, {profile?.name || 'Accounts'}</Text>
          <Text style={styles.caption}>Approve billing, final delivery, and cancelled order restocking.</Text>
        </View>

        <View style={styles.statGrid}>
          <StatCard
            style={styles.statCard}
            label="Billing Approval"
            value={billingQueue}
            caption="Order Created"
            captionTone="neutral"
            onPress={() => navigation.navigate('Orders')}
          />
          <StatCard
            style={styles.statCard}
            label="Final Approval"
            value={finalApprovalQueue}
            caption="Delivery completed"
            captionTone="positive"
            onPress={() => navigation.navigate('Deliveries')}
          />
          <StatCard
            style={styles.statCard}
            label="Open Orders"
            value={data.stats.pendingOrders}
            caption="pending lifecycle"
            captionTone="neutral"
            onPress={() => navigation.navigate('Orders')}
          />
          <StatCard
            style={styles.statCard}
            label="Cancelled"
            value={cancelledQueue}
            caption="stock returned when pending"
            captionTone="negative"
          />
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
  greeting: {
    color: colors.ink,
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.xxl,
  },
  caption: {
    color: colors.muted,
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.sm,
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  statCard: {
    width: '47.5%',
    flexGrow: 1,
  },
});
