import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppButton } from '../../../components/AppButton';
import { AppIcon } from '../../../components/AppIcon';
import { useInventoryData } from '../../../services/useInventoryData';
import { useAuth } from '../../auth/AuthProvider';
import { colors } from '../../../theme/colors';
import { shadows } from '../../../theme/shadows';
import { spacing } from '../../../theme/spacing';
import { typography } from '../../../theme/typography';

export function ProfileScreen() {
  const { profile, user, signOut } = useAuth();
  const data = useInventoryData();
  const displayName = profile?.name || user?.displayName || 'User';
  const roleLabels = {
    admin: 'Administrator',
    accounts: 'Accounts',
    supervisor: 'Supervisor',
    staff: 'Store Staff',
  } as const;
  const role = profile?.role ? roleLabels[profile.role] : 'Store Staff';

  const assignedStoreNames = data.stores.map(store => store.name).join(', ');
  const storeAccessValue =
    profile?.role === 'admin'
      ? 'All Stores'
      : assignedStoreNames || 'No store assigned';

  const infoRows = [
    { label: 'Email', value: user?.email || '—', icon: 'user' as const },
    {
      label: 'Store Access',
      value: storeAccessValue,
      icon: 'store' as const,
    },
    { label: 'Role', value: role, icon: 'layout' as const },
  ];

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerCard}>
          <View style={styles.avatarWrap}>
            <Text style={styles.avatarText}>{displayName.charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={styles.name}>{displayName}</Text>
          <View style={styles.roleBadge}>
            <AppIcon name="user" size={14} tintColor={colors.primaryDark} />
            <Text style={styles.role}>{role}</Text>
          </View>
        </View>

        <View style={styles.infoCard}>
          {infoRows.map((row, index) => (
            <View
              key={row.label}
              style={[styles.infoRow, index < infoRows.length - 1 && styles.infoRowBorder]}>
              <View style={styles.infoIconWrap}>
                <AppIcon name={row.icon} size={16} tintColor={colors.primary} />
              </View>
              <View style={styles.infoTextWrap}>
                <Text style={styles.label}>{row.label}</Text>
                <Text style={styles.value}>{row.value}</Text>
              </View>
            </View>
          ))}
        </View>

        <AppButton onPress={signOut} title="Sign Out" variant="ghost" style={styles.signOutBtn} />
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
    paddingBottom: spacing.xxl,
  },
  headerCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    marginBottom: spacing.lg,
    ...shadows.md,
  },
  avatarWrap: {
    width: 88,
    height: 88,
    borderRadius: 28,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  avatarText: {
    fontFamily: typography.fontFamily.bold,
    fontSize: 36,
    color: colors.surface,
  },
  name: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.xxl,
    color: colors.ink,
    marginBottom: spacing.sm,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.cardTintGreen,
    borderRadius: 20,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  role: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.sm,
    color: colors.primaryDark,
  },
  infoCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    marginBottom: spacing.xl,
    ...shadows.sm,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
  infoRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  infoIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.cardTintGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoTextWrap: {
    flex: 1,
  },
  label: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.xs,
    color: colors.muted,
    marginBottom: 2,
  },
  value: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.md,
    color: colors.ink,
  },
  signOutBtn: {
    marginTop: spacing.sm,
  },
});
