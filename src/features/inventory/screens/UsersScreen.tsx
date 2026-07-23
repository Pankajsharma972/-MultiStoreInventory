import React, { useMemo, useState } from 'react';
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
import { EmptyState } from '../../../components/EmptyState';
import { ScreenShell } from '../../../components/ScreenShell';
import { SectionHeader } from '../../../components/SectionHeader';
import { StatusBadge } from '../../../components/StatusBadge';
import {
  deleteUserAccount,
  setUserStoreAssignment,
} from '../../../services/inventoryRepository';
import { useInventoryData } from '../../../services/useInventoryData';
import { colors } from '../../../theme/colors';
import { shadows } from '../../../theme/shadows';
import { spacing } from '../../../theme/spacing';
import { typography } from '../../../theme/typography';
import { useAuth } from '../../auth/AuthProvider';
import type { AppStackParamList } from '../../../navigation/types';
import type { UserProfile } from '../../../types/models';
import { BottomSheet } from '../../../components/BottomSheet';
type UsersScreenProps = NativeStackScreenProps<AppStackParamList, 'Users'>;

export function UsersScreen({ navigation }: UsersScreenProps) {
  const { profile } = useAuth();
  const data = useInventoryData();
  const insets = useSafeAreaInsets();

  const [sheetUser, setSheetUser] = useState<UserProfile | null>(null);
  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [assignTargetId, setAssignTargetId] = useState<string | null>(null);

  // Live target so the assign modal reflects real-time Firestore updates.
  const assignTarget = useMemo(
    () => data.users.find(u => u.uid === assignTargetId) ?? null,
    [data.users, assignTargetId],
  );

  // storeId -> staff user currently holding it (one store, one staff).
const storeOwners = useMemo(() => {
  const map = new Map<string, UserProfile>();
  data.users.forEach(u => {
    // ✅ Accounts aur supervisor ko bhi include karo
    if (u.role !== 'staff' && u.role !== 'accountant' && u.role !== 'supervisor') return;
    (u.assignedStoreIds || []).forEach(id => {
      if (!map.has(id)) map.set(id, u);
    });
  });
  return map;
}, [data.users]);

  const toggleStore = async (targetUser: UserProfile, storeId: string) => {
    const assign = !(targetUser.assignedStoreIds || []).includes(storeId);
    try {
      await setUserStoreAssignment(targetUser, storeId, assign, data.users, profile);
      setSheetUser(null);
    } catch (error) {
      Alert.alert(
        'Store unavailable',
        error instanceof Error ? error.message : 'Could not update store assignment.',
      );
    }
  };

  const openAssignModal = (user: UserProfile) => {
    setAssignTargetId(user.uid);
    setAssignModalVisible(true);
  };

  const confirmDeleteUser = (user: UserProfile) => {
    // Prevent deleting the currently logged‑in admin
    if (profile?.uid === user.uid) {
      Alert.alert('Error', 'You cannot delete your own account.');
      return;
    }
    Alert.alert(
      'Delete User',
      `Delete "${user.name}" permanently?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { authRemoved } = await deleteUserAccount(user, profile);
              Alert.alert(
                'Done',
                authRemoved
                  ? `${user.name} has been permanently deleted.`
                  : `${user.name} was removed from the app. Their Firebase Authentication login will be removed once the deleteUser Cloud Function is deployed.`,
              );
            } catch (error) {
              Alert.alert('Error', error instanceof Error ? error.message : 'Deletion failed');
            }
          },
        },
      ],
    );
  };


  if (profile?.role !== 'admin') {
    return (
      <ScreenShell
        onBack={navigation.canGoBack() ? navigation.goBack : undefined}
        subtitle="This section is available to administrators only."
        title="User Access">
        <EmptyState
          icon="user"
          title="Access restricted"
          subtitle="Only administrators can manage users and roles."
        />
      </ScreenShell>
    );
  }

  return (
    <>
      <ScreenShell
       onBack={navigation.canGoBack() ? navigation.goBack : undefined}
  title="User Access">
        <SectionHeader title="Team Members" meta={`${data.users.length} users`} />
        <Text style={styles.longPressHint}>Long press a user to manage access</Text>

        {data.users.length === 0 ? (
          <EmptyState
            icon="user"
            title="No users yet"
            subtitle="Tap the + button to create your first user."
          />
        ) : (
          data.users.map(user => (
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

              {user.role !== 'admin' && (
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
          ))
        )}
      </ScreenShell>

      {/* Add user FAB */}
      <Pressable
        onPress={() => navigation.navigate('CreateUser')}
        style={[styles.fab, { bottom: insets.bottom + spacing.lg }]}>
        <AppIcon name="plus" size={24} tintColor="#FFFFFF" />
      </Pressable>

      {/* User actions */}
      <BottomSheet
        visible={sheetUser !== null}
        title={sheetUser?.name ?? ''}
        subtitle={sheetUser?.email}
        onClose={() => setSheetUser(null)}
        actions={[
          {
            id: 'edit',
            label: 'Edit User',
            icon: 'edit',
            tint: colors.primary,
            bg: colors.cardTintGreen,
            onPress: () =>
              sheetUser && navigation.navigate('CreateUser', { userId: sheetUser.uid }),
          },
         ...(sheetUser && sheetUser.role !== 'admin'
  ? [
      {
        id: 'assign',
        label: 'Assign Store',
        icon: 'store' as const,
        tint: '#7C3AED',
        bg: colors.cardTintPurple,
        onPress: () => sheetUser && openAssignModal(sheetUser),
      },
    ]
  : []),
          {
            id: 'delete',
            label: 'Delete User',
            icon: 'trash',
            destructive: true,
            onPress: () => sheetUser && confirmDeleteUser(sheetUser),
          },
        ]}
      />
{/* Assign store modal */}
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
      {assignTarget ? <Text style={styles.assignSub}>{assignTarget.name}</Text> : null}

      <ScrollView style={styles.assignScroll} showsVerticalScrollIndicator={false}>
        {data.stores.map(store => {
          const assigned = (assignTarget?.assignedStoreIds || []).includes(store.id);
          // ✅ Show all users assigned to this store
          const assignedUsers = data.users.filter(u => 
            (u.assignedStoreIds || []).includes(store.id)
          );
          
          return (
            <Pressable
              key={store.id}
              // ✅ No disabled prop - multiple users allowed
              onPress={() => assignTarget && toggleStore(assignTarget, store.id)}
              style={[
                styles.assignStoreRow,
                assigned && styles.assignStoreRowActive,
              ]}>
              <View style={[styles.assignStoreIcon, assigned && styles.assignStoreIconActive]}>
                <AppIcon
                  name="store"
                  size={16}
                  tintColor={assigned ? colors.surface : colors.primary}
                />
              </View>
              <View style={styles.assignStoreTextWrap}>
                <Text
                  style={[styles.assignStoreName, assigned && styles.assignStoreNameActive]}>
                  {store.name}
                </Text>
                <Text style={styles.assignStoreAssignedTo}>
                  👥 {assignedUsers.length > 0 
                    ? assignedUsers.map(u => u.name).join(', ') 
                    : 'No one assigned'}
                </Text>
              </View>
              {assigned && <AppIcon name="check" size={16} tintColor={colors.primary} />}
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
  assignStoreAssignedTo: {
  fontFamily: typography.fontFamily.regular,
  fontSize: 11,
  color: colors.muted,
  marginTop: 2,
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
  fab: {
    position: 'absolute',
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.lg,
    elevation: 8,
  },
  // Assign modal
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
    maxHeight: 320,
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
  assignStoreRowDisabled: {
    opacity: 0.55,
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
  assignStoreTextWrap: {
    flex: 1,
  },
  assignStoreName: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.sm,
    color: colors.ink,
  },
  assignStoreNameActive: {
    fontFamily: typography.fontFamily.semiBold,
    color: colors.primaryDark,
  },
  assignStoreTaken: {
    fontFamily: typography.fontFamily.regular,
    fontSize: 11,
    color: colors.danger,
    marginTop: 2,
  },
  assignDoneBtn: {
    marginTop: spacing.xs,
  },
});
