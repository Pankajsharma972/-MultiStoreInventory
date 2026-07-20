import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ModuleCard } from '../../../components/ModuleCard';
import { useAuth } from '../../auth/AuthProvider';
import { colors } from '../../../theme/colors';
import { spacing } from '../../../theme/spacing';
import { typography } from '../../../theme/typography';
import type { AppStackParamList } from '../../../navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'Operations'>;

export function OperationsScreen({ navigation }: Props) {
  const { profile } = useAuth();
  const { width } = useWindowDimensions();

  const isAdmin = profile?.role === 'admin';

  type Module = {
    title: string;
    route: keyof AppStackParamList;
    subtitle: string;
    icon:
      | 'box'
      | 'store'
      | 'transfer'
      | 'shoppingBag'
      | 'delivery'
      | 'history'
      | 'alertCircle'
      | 'user'
      | 'report';
    iconBg: string;
    iconTint: string;
  };

  const adminModules: Module[] = [
    {
      title: 'Stores & Warehouses',
      route: 'Stores',
      subtitle: 'Manage store profiles, warehouses, and storage bins.',
      icon: 'store',
      iconBg: colors.cardTintBlue,
      iconTint: colors.accent,
    },
    {
      title: 'Stock Transfer',
      route: 'Transfer',
      subtitle: 'Transfer items between warehouses and stores.',
      icon: 'transfer',
      iconBg: colors.cardTintPurple,
      iconTint: '#7C3AED',
    },
    {
      title: 'Pending Deliveries',
      route: 'Deliveries',
      subtitle: 'Manage delivery status and customer dates.',
      icon: 'delivery',
      iconBg: colors.cardTintBlue,
      iconTint: colors.accent,
    },
    {
      title: 'Activity History',
      route: 'History',
      subtitle: 'Comprehensive audit log of system activities.',
      icon: 'history',
      iconBg: colors.cardTintGreen,
      iconTint: colors.primaryDark,
    },
    {
      title: 'Users & Roles',
      route: 'Users',
      subtitle: 'Manage user credentials and store assignments.',
      icon: 'user',
      iconBg: colors.cardTintPurple,
      iconTint: '#7C3AED',
    },
    {
      title: 'Reports',
      route: 'Reports',
      subtitle: 'Store-wise value and monthly order trends.',
      icon: 'report',
      iconBg: colors.cardTintAmber,
      iconTint: colors.warning,
    },
    {
      title: 'Profile',
      route: 'Profile',
      subtitle: 'Account details and sign out.',
      icon: 'user',
      iconBg: colors.cardTintGreen,
      iconTint: colors.primary,
    },
  ];

  const staffModules: Module[] = [
    {
      title: 'New Product',
      route: 'NewProduct',
      subtitle: 'Create a product at your store location.',
      icon: 'box',
      iconBg: colors.cardTintGreen,
      iconTint: colors.primary,
    },
    // {
    //   title: 'Stock Transfer',
    //   route: 'Transfer',
    //   subtitle: 'Transfer items between warehouses.',
    //   icon: 'transfer',
    //   iconBg: colors.cardTintPurple,
    //   iconTint: '#7C3AED',
    // },
    {
      title: 'Pending Deliveries',
      route: 'Deliveries',
      subtitle: 'View and edit active customer deliveries.',
      icon: 'delivery',
      iconBg: colors.cardTintBlue,
      iconTint: colors.accent,
    },
    {
      title: 'Activity History',
      route: 'History',
      subtitle: 'Recent inventory and order activity.',
      icon: 'history',
      iconBg: colors.cardTintGreen,
      iconTint: colors.primaryDark,
    },
    {
      title: 'Profile',
      route: 'Profile',
      subtitle: 'Account details and sign out.',
      icon: 'user',
      iconBg: colors.cardTintGreen,
      iconTint: colors.primary,
    },
  ];

  const modules = isAdmin ? adminModules : staffModules;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>More</Text>
        <Text style={styles.headerSubtitle}>
          {isAdmin ? 'All admin modules and account settings' : 'Assigned modules and account settings'}
        </Text>
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.grid}>
          {modules.map(module => (
            <View key={module.title} style={{ width: width > 720 ? '48.5%' : '100%' }}>
              <ModuleCard
                title={module.title}
                subtitle={module.subtitle}
                icon={module.icon}
                iconBg={module.iconBg}
                iconTint={module.iconTint}
                onPress={() => navigation.navigate(module.route)}
              />
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.xxl,
    color: colors.ink,
  },
  headerSubtitle: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    color: colors.muted,
    marginTop: 2,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl + spacing.lg,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
});
