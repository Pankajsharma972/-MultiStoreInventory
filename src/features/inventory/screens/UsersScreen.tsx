import React, { useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppButton } from '../../../components/AppButton';
import { AppIcon } from '../../../components/AppIcon';
import { AppTextInput } from '../../../components/AppTextInput';
import { BottomSheet } from '../../../components/BottomSheet';
import { ScreenShell } from '../../../components/ScreenShell';
import { SectionHeader } from '../../../components/SectionHeader';
import { StatusBadge } from '../../../components/StatusBadge';
import { updateUserAccess } from '../../../services/inventoryRepository';
import { useInventoryData } from '../../../services/useInventoryData';
import { colors } from '../../../theme/colors';
import { shadows } from '../../../theme/shadows';
import { spacing } from '../../../theme/spacing';
import { typography } from '../../../theme/typography';
import { useAuth } from '../../auth/AuthProvider';
import { getAuthErrorMessage } from '../../auth/authErrors';
import type { AppStackParamList } from '../../../navigation/types';
import type { UserProfile, UserRole } from '../../../types/models';

// Rename Props to UsersScreenProps to avoid conflicts
type UsersScreenProps = NativeStackScreenProps<AppStackParamList, 'Users'>;

export function UsersScreen({ navigation }: UsersScreenProps) {
  const { createUser, profile } = useAuth();

  if (profile?.role !== 'admin') {
    return null;
  }

  const data = useInventoryData();
  const insets = useSafeAreaInsets();

  // Create user form
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('staff');
  const [assignedStoreIds, setAssignedStoreIds] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  // Bottom sheet state
  const [sheetUser, setSheetUser] = useState<UserProfile | null>(null);

  // Assign store modal
  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [assignTargetUser, setAssignTargetUser] = useState<UserProfile | null>(null);

  const toggleNewUserStore = (storeId: string) => {
    setAssignedStoreIds(cur =>
      cur.includes(storeId) ? cur.filter(id => id !== storeId) : [...cur, storeId],
    );
  };

  const submitNewUser = async () => {
    setFormError('');
    setFormSuccess('');
    setCreating(true);
    try {
      await createUser({
        name,
        email,
        password,
        role,
        assignedStoreIds: role === 'admin' ? [] : assignedStoreIds,
      });
      setFormSuccess(`${name.trim()} can now sign in.`);
      setName('');
      setEmail('');
      setPassword('');
      setRole('staff');
      setAssignedStoreIds([]);
    } catch (error) {
      setFormError(getAuthErrorMessage(error));
    } finally {
      setCreating(false);
    }
  };

  const toggleStore = async (targetUser: UserProfile, storeId: string) => {
    const assigned = new Set(targetUser.assignedStoreIds || []);
    if (assigned.has(storeId)) assigned.delete(storeId);
    else assigned.add(storeId);
    try {
      await updateUserAccess(
        targetUser,
        { role: targetUser.role, assignedStoreIds: Array.from(assigned) },
        profile,
      );
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Could not update user.');
    }
  };

  const changeRole = async (targetUser: UserProfile, nextRole: UserRole) => {
    try {
      await updateUserAccess(
        targetUser,
        { role: nextRole, assignedStoreIds: targetUser.assignedStoreIds || [] },
        profile,
      );
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Could not update role.');
    }
  };

  const openAssignModal = (user: UserProfile) => {
    setAssignTargetUser(user);
    setAssignModalVisible(true);
  };

  const confirmDeleteUser = (user: UserProfile) => {
    Alert.alert(
      'Remove User',
      `Remove "${user.name}" from all stores? (Note: only store assignments are cleared — Firebase Auth deletion requires backend function.)`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove Access',
          style: 'destructive',
          onPress: async () => {
            try {
              await updateUserAccess(user, { role: 'staff', assignedStoreIds: [] }, profile);
              Alert.alert('Done', `${user.name}'s store access has been revoked.`);
            } catch (err) {
              Alert.alert('Error', 'Could not remove user access.');
            }
          },
        },
      ],
    );
  };

  return (
    <>
      <ScreenShell
        onBack={navigation.goBack}
        subtitle="Create users, assign stores, and manage role-based access."
        title="User Access">

        {/* ── Create user form ── */}
        <View style={styles.createCard}>
          <View style={styles.createHeader}>
            <View style={styles.createIconWrap}>
              <AppIcon name="user" size={18} tintColor="#7C3AED" />
            </View>
            <Text style={styles.createTitle}>Create User</Text>
          </View>

          <AppTextInput label="Full Name" onChangeText={setName} placeholder="Staff or admin name" value={name} />
          <AppTextInput
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            label="Email"
            onChangeText={setEmail}
            placeholder="name@company.com"
            value={email}
          />
          <AppTextInput
            label="Temporary Password"
            onChangeText={setPassword}
            placeholder="Minimum 6 characters"
            secureTextEntry
            showPasswordToggle
            value={password}
          />

          {/* Role chips */}
          <Text style={styles.chipGroupLabel}>Role</Text>
          <View style={styles.chipRow}>
            {(['staff', 'admin'] as UserRole[]).map(r => (
              <Pressable
                key={r}
                onPress={() => setRole(r)}
                style={[styles.chip, role === r && styles.chipActive]}>
                <Text style={[styles.chipText, role === r && styles.chipTextActive]}>
                  {r.charAt(0).toUpperCase() + r.slice(1)}
                </Text>
              </Pressable>
            ))}
          </View>

          {role === 'staff' && data.stores.length > 0 && (
            <View style={styles.storePickerSection}>
              <Text style={styles.chipGroupLabel}>Assign Stores</Text>
              <View style={styles.chipRow}>
                {data.stores.map(store => {
                  const assigned = assignedStoreIds.includes(store.id);
                  return (
                    <Pressable
                      key={store.id}
                      onPress={() => toggleNewUserStore(store.id)}
                      style={[styles.chip, assigned && styles.chipActive]}>
                      <Text style={[styles.chipText, assigned && styles.chipTextActive]}>
                        {store.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {formError ? <Text style={styles.error}>{formError}</Text> : null}
          {formSuccess ? <Text style={styles.success}>{formSuccess}</Text> : null}
          <AppButton
            disabled={!name.trim() || !email.trim() || password.length < 6}
            loading={creating}
            onPress={submitNewUser}
            title="Create User"
          />
        </View>

        {/* ── Team members ── */}
        <SectionHeader title="Team Members" meta={`${data.users.length} users`} />
        <Text style={styles.longPressHint}>Long press a user to manage access</Text>

        {data.users.map(user => (
          <Pressable
            key={user.uid}
            onLongPress={() => setSheetUser(user)}
            delayLongPress={400}
            style={({ pressed }) => [styles.userCard, pressed && styles.userCardPressed]}>
            <View style={styles.userHeader}>
              <View style={[styles.avatar, user.role === 'admin' && styles.avatarAdmin]}>
                <Text style={styles.avatarText}>{user.name.charAt(0).toUpperCase()}</Text>
              </View>
              <View style={styles.userInfo}>
                <Text style={styles.userName}>{user.name}</Text>
                <Text style={styles.userEmail}>{user.email}</Text>
              </View>
              <View style={styles.userRight}>
                <StatusBadge label={user.role} tone={user.role === 'admin' ? 'info' : 'success'} />
                <View style={styles.moreHint}>
                  <AppIcon name="menu" size={14} tintColor={colors.muted} />
                </View>
              </View>
            </View>

            {user.role === 'staff' && (
              <View style={styles.storesRow}>
                <AppIcon name="store" size={12} tintColor={colors.muted} />
                <Text style={styles.storesText}>
                  {(user.assignedStoreIds || []).length === 0
                    ? 'No stores assigned'
                    : (user.assignedStoreIds || [])
                        .map(id => data.stores.find(s => s.id === id)?.name || id)
                        .join(', ')}
                </Text>
              </View>
            )}
          </Pressable>
        ))}
      </ScreenShell>

      {/* ── User bottom sheet ── */}
      <BottomSheet
        visible={sheetUser !== null}
        title={sheetUser?.name ?? ''}
        subtitle={sheetUser?.email}
        onClose={() => setSheetUser(null)}
        actions={[
          {
            id: 'assign',
            label: 'Assign Store',
            icon: 'store',
            tint: colors.primary,
            bg: colors.cardTintGreen,
            onPress: () => sheetUser && openAssignModal(sheetUser),
          },
          {
            id: 'role',
            label: sheetUser?.role === 'admin' ? 'Change to Staff' : 'Change to Admin',
            icon: 'user',
            tint: '#7C3AED',
            bg: colors.cardTintPurple,
            onPress: () =>
              sheetUser &&
              changeRole(sheetUser, sheetUser.role === 'admin' ? 'staff' : 'admin'),
          },
          {
            id: 'delete',
            label: 'Remove Access',
            icon: 'trash',
            destructive: true,
            onPress: () => sheetUser && confirmDeleteUser(sheetUser),
          },
        ]}
      />

      {/* ── Assign store modal ── */}
      <Modal
        visible={assignModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAssignModalVisible(false)}
        statusBarTranslucent>
        <View style={styles.modalBackdrop}>
          <View style={[styles.assignModal, { paddingBottom: insets.bottom + spacing.lg }]}>
            <View style={styles.assignModalHandle} />
            <Text style={styles.assignTitle}>Assign Stores</Text>
            {assignTargetUser ? (
              <Text style={styles.assignSub}>{assignTargetUser.name}</Text>
            ) : null}

            <ScrollView style={styles.assignScroll} showsVerticalScrollIndicator={false}>
              {data.stores.map(store => {
                const assigned = (assignTargetUser?.assignedStoreIds || []).includes(store.id);
                return (
                  <Pressable
                    key={store.id}
                    onPress={() => assignTargetUser && toggleStore(assignTargetUser, store.id)}
                    style={[styles.assignStoreRow, assigned && styles.assignStoreRowActive]}>
                    <View style={[styles.assignStoreIcon, assigned && styles.assignStoreIconActive]}>
                      <AppIcon
                        name="store"
                        size={16}
                        tintColor={assigned ? colors.surface : colors.primary}
                      />
                    </View>
                    <Text style={[styles.assignStoreName, assigned && styles.assignStoreNameActive]}>
                      {store.name}
                    </Text>
                    {assigned && (
                      <AppIcon name="check" size={16} tintColor={colors.primary} />
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>

            <AppButton
              onPress={() => setAssignModalVisible(false)}
              title="Done"
              style={styles.assignDoneBtn}
            />
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  createCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  createHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  createIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.cardTintPurple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createTitle: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.md,
    color: colors.ink,
  },
  chipGroupLabel: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.xs,
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
    marginTop: spacing.xs,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.xs,
    color: colors.inkSoft,
  },
  chipTextActive: {
    color: colors.surface,
  },
  storePickerSection: {
    marginBottom: spacing.sm,
  },
  error: {
    fontFamily: typography.fontFamily.regular,
    color: colors.danger,
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.sm,
  },
  success: {
    fontFamily: typography.fontFamily.medium,
    color: colors.success,
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.sm,
  },
  longPressHint: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    color: colors.muted,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  userCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  userCardPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.985 }],
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarAdmin: {
    backgroundColor: '#7C3AED',
  },
  avatarText: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.lg,
    color: colors.surface,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.md,
    color: colors.ink,
  },
  userEmail: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    color: colors.muted,
    marginTop: 2,
  },
  userRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  moreHint: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  storesText: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    color: colors.muted,
    flex: 1,
  },
  // ── Assign modal ──
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  assignModal: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: spacing.xl,
    maxHeight: '75%',
    ...shadows.lg,
  },
  assignModalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: spacing.lg,
  },
  assignTitle: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.xl,
    color: colors.ink,
    marginBottom: spacing.xs,
  },
  assignSub: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.sm,
    color: colors.muted,
    marginBottom: spacing.lg,
  },
  assignScroll: {
    maxHeight: 260,
    marginBottom: spacing.md,
  },
  assignStoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: 14,
    marginBottom: spacing.xs,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  assignStoreRowActive: {
    backgroundColor: colors.cardTintGreen,
    borderColor: colors.primaryLight,
  },
  assignStoreIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  assignStoreIconActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  assignStoreName: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.sm,
    color: colors.ink,
    flex: 1,
  },
  assignStoreNameActive: {
    fontFamily: typography.fontFamily.semiBold,
    color: colors.primaryDark,
  },
  assignDoneBtn: {
    marginTop: spacing.xs,
  },
});