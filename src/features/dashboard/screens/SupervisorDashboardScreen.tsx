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

type Props = NativeStackScreenProps<AppStackParamList, 'SupervisorDashboard'>;

export function SupervisorDashboardScreen({ navigation }: Props) {
  const { profile } = useAuth();
  const data = useInventoryData();
  const readyForDispatch = data.deliveries.filter(
    delivery => delivery.status === 'billed' || delivery.status === 'partially_delivered',
  ).length;
  const partialDeliveries = data.deliveries.filter(
    delivery => delivery.status === 'partially_delivered',
  ).length;
  const photoPending = data.deliveries.filter(
    delivery =>
      (delivery.status === 'billed' || delivery.status === 'partially_delivered') &&
      !delivery.truckPhotoUrl,
  ).length;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <AppBar
        title="Supervisor Dashboard"
        leftIcon="menu"
        onLeftPress={() => navigation.navigate('Operations')}
        rolePill="Supervisor"
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.greetingWrap}>
          <Text style={styles.greeting}>Welcome, {profile?.name || 'Supervisor'}</Text>
          <Text style={styles.caption}>Verify dispatch quantities and upload truck loading photos.</Text>
        </View>

        <View style={styles.statGrid}>
          <StatCard
            style={styles.statCard}
            label="Ready Dispatch"
            value={readyForDispatch}
            caption="billed orders"
            captionTone="neutral"
            onPress={() => navigation.navigate('Deliveries')}
          />
          <StatCard
            style={styles.statCard}
            label="Partial Trips"
            value={partialDeliveries}
            caption="remaining pending"
            captionTone="neutral"
            onPress={() => navigation.navigate('Deliveries')}
          />
          <StatCard
            style={styles.statCard}
            label="Photo Pending"
            value={photoPending}
            caption="truck proof needed"
            captionTone={photoPending > 0 ? 'negative' : 'positive'}
            onPress={() => navigation.navigate('Deliveries')}
          />
          <StatCard
            style={styles.statCard}
            label="Active Deliveries"
            value={data.stats.pendingDeliveries}
            caption="in workflow"
            captionTone="positive"
            onPress={() => navigation.navigate('Deliveries')}
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
