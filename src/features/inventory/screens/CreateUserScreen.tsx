import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View, ScrollView } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppButton } from '../../../components/AppButton';
import { AppIcon } from '../../../components/AppIcon';
import { AppTextInput } from '../../../components/AppTextInput';
import { ScreenShell } from '../../../components/ScreenShell';
import { updateUserDetails } from '../../../services/inventoryRepository';
import { useInventoryData } from '../../../services/useInventoryData';
import { colors } from '../../../theme/colors';
import { shadows } from '../../../theme/shadows';
import { spacing } from '../../../theme/spacing';
import { typography } from '../../../theme/typography';
import { useAuth } from '../../auth/AuthProvider';
import { getAuthErrorMessage } from '../../auth/authErrors';
import type { AppStackParamList } from '../../../navigation/types';
import type { UserProfile, UserRole } from '../../../types/models';

type Props = NativeStackScreenProps<AppStackParamList, 'CreateUser'>;

export function CreateUserScreen({ navigation, route }: Props) {
  const { createUser, profile } = useAuth();
  const data = useInventoryData();

  const editUserId = route.params?.userId;
  const editUser = useMemo<UserProfile | null>(
    () => (editUserId ? data.users.find(u => u.uid === editUserId) ?? null : null),
    [data.users, editUserId],
  );
  const isEditing = Boolean(editUserId);

  const [name, setName] = useState(editUser?.name ?? '');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>(editUser?.role ?? 'staff');
  const [assignedStoreIds, setAssignedStoreIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const [showStoreDropdown, setShowStoreDropdown] = useState(false);

  const needsStoreAccess = role !== 'admin';

  // Role options
  const roleOptions: UserRole[] = ['staff', 'supervisor', 'accountant', 'admin'];

  // Get role display name
  const getRoleDisplayName = (role: UserRole) => {
    return role.charAt(0).toUpperCase() + role.slice(1);
  };

  // Get store owner info - only for staff role
  const getStoreOwner = useMemo(() => {
    const map = new Map<string, { name: string; role: UserRole }>();
    data.users.forEach(u => {
      if (u.role !== 'staff') return;
      (u.assignedStoreIds || []).forEach(id => {
        if (!map.has(id)) {
          map.set(id, { name: u.name, role: u.role });
        }
      });
    });
    return map;
  }, [data.users]);

  // Check if store can be assigned to current role
  const canAssignStore = (storeId: string) => {
    const owner = getStoreOwner.get(storeId);
    
    if (owner) {
      if (role === 'staff') {
        return false;
      }
      if (role === 'accountant' || role === 'supervisor') {
        return true;
      }
    }
    
    return true;
  };

  // Toggle store selection
  const toggleStore = (storeId: string) => {
    setFormError('');
    const alreadySelected = assignedStoreIds.includes(storeId);
    
    if (alreadySelected) {
      setAssignedStoreIds(cur => cur.filter(id => id !== storeId));
      return;
    }
    
    if (!canAssignStore(storeId)) {
      const owner = getStoreOwner.get(storeId);
      setFormError(`This store is already assigned to staff member: ${owner?.name}`);
      return;
    }
    
    setAssignedStoreIds(cur => [...cur, storeId]);
  };

  // Get currently selected store names
  const selectedStoreNames = useMemo(() => {
    if (assignedStoreIds.length === 0) return 'Select stores...';
    return data.stores
      .filter(store => assignedStoreIds.includes(store.id))
      .map(store => store.name)
      .join(', ');
  }, [assignedStoreIds, data.stores]);

  const submit = async () => {
    setFormError('');
    setSubmitting(true);
    try {
      if (isEditing && editUser) {
        await updateUserDetails(editUser, { name, role }, profile);
      } else {
        await createUser({
          name,
          email,
          password,
          role,
          assignedStoreIds: role === 'admin' ? [] : assignedStoreIds,
        });
      }
      navigation.goBack();
    } catch (error) {
      setFormError(getAuthErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const disabled = isEditing
    ? !name.trim()
    : !name.trim() || !email.trim() || password.length < 6;

  return (
    <ScreenShell
      onBack={navigation.canGoBack() ? navigation.goBack : undefined}
      subtitle={
        isEditing
          ? 'Update the name and role for this team member.'
          : 'Add a new admin, accounts, supervisor, or store staff member.'
      }
      title={isEditing ? 'Edit User' : 'Create User'}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.iconWrap}>
              <AppIcon name="user" size={18} tintColor="#7C3AED" />
            </View>
            <Text style={styles.cardTitle}>{isEditing ? 'User Details' : 'New User'}</Text>
          </View>

          <AppTextInput
            label="Full Name"
            onChangeText={setName}
            placeholder="Team member name"
            value={name}
          />

          {!isEditing && (
            <>
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
            </>
          )}

          {/* Role Dropdown */}
          <Text style={styles.groupLabel}>Role</Text>
          <View style={[styles.dropdownWrapper, styles.roleDropdown]}>
            <Pressable
              style={styles.dropdownButton}
              onPress={() => {
                setShowRoleDropdown(!showRoleDropdown);
                if (showStoreDropdown) setShowStoreDropdown(false);
              }}>
              <Text style={styles.dropdownButtonText}>
                {getRoleDisplayName(role)}
              </Text>
              <AppIcon 
                name="chevronDown" 
                size={20} 
                tintColor={colors.muted} 
              />
            </Pressable>

            {showRoleDropdown && (
              <View style={[styles.dropdownMenu, styles.roleDropdownMenu]}>
                {roleOptions.map((r) => (
                  <Pressable
                    key={r}
                    style={[
                      styles.dropdownItem,
                      role === r && styles.dropdownItemActive,
                    ]}
                    onPress={() => {
                      setRole(r);
                      setShowRoleDropdown(false);
                      if (r === 'admin') {
                        setAssignedStoreIds([]);
                      }
                    }}>
                    <Text
                      style={[
                        styles.dropdownItemText,
                        role === r && styles.dropdownItemTextActive,
                      ]}>
                      {getRoleDisplayName(r)}
                    </Text>
                    {role === r && (
                      <View style={styles.checkmarkCircle}>
                        <AppIcon name="check" size={14} tintColor={colors.surface} />
                      </View>
                    )}
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          {/* Store Dropdown - Only show for non-admin roles */}
          {!isEditing && needsStoreAccess && data.stores.length > 0 && (
            <View style={styles.storeSection}>
              <Text style={styles.groupLabel}>Assign Stores</Text>
              
              <View style={[styles.dropdownWrapper, styles.storeDropdown]}>
                <Pressable
                  style={styles.dropdownButton}
                  onPress={() => {
                    setShowStoreDropdown(!showStoreDropdown);
                    if (showRoleDropdown) setShowRoleDropdown(false);
                  }}>
                  <Text
                    style={[
                      styles.dropdownButtonText,
                      assignedStoreIds.length === 0 && styles.placeholderText,
                    ]}>
                    {selectedStoreNames}
                  </Text>
                  <View style={styles.dropdownRight}>
                    {assignedStoreIds.length > 0 && (
                      <View style={styles.selectedCount}>
                        <Text style={styles.selectedCountText}>{assignedStoreIds.length}</Text>
                      </View>
                    )}
                    <AppIcon 
                      name="chevronDown" 
                      size={20} 
                      tintColor={colors.muted} 
                    />
                  </View>
                </Pressable>

                {showStoreDropdown && (
                  <View style={[styles.dropdownMenu, styles.storeDropdownMenu]}>
                    {data.stores.map((store) => {
                      const selected = assignedStoreIds.includes(store.id);
                      const owner = getStoreOwner.get(store.id);
                      const isStaffStore = Boolean(owner);
                      const canAssign = canAssignStore(store.id);
                      const isDisabled = !canAssign && role === 'staff';
                      
                      return (
                        <Pressable
                          key={store.id}
                          style={[
                            styles.dropdownItem,
                            selected && styles.dropdownItemActive,
                            isDisabled && styles.dropdownItemDisabled,
                          ]}
                          onPress={() => toggleStore(store.id)}>
                          <View style={styles.dropdownItemLeft}>
                            <View style={[
                              styles.storeCheckbox,
                              selected && styles.storeCheckboxSelected,
                              isDisabled && styles.storeCheckboxDisabled,
                            ]}>
                              {selected && (
                                <AppIcon name="check" size={12} tintColor={colors.surface} />
                              )}
                            </View>
                            <View>
                              <Text
                                style={[
                                  styles.dropdownItemText,
                                  selected && styles.dropdownItemTextActive,
                                  isDisabled && styles.dropdownItemTextDisabled,
                                ]}>
                                {store.name}
                              </Text>
                              {isStaffStore && (
                                <Text style={styles.storeOwnerTag}>
                                  Assigned to: {owner?.name}
                                </Text>
                              )}
                            </View>
                          </View>
                          {isDisabled && (
                            <Text style={styles.disabledTag}>Locked</Text>
                          )}
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </View>

              <View style={styles.hintContainer}>
                <View style={styles.hintRow}>
                  <View style={[styles.hintDot, { backgroundColor: '#6366F1' }]} />
                  <Text style={styles.hint}>Staff: One store only</Text>
                </View>
                <View style={styles.hintRow}>
                  <View style={[styles.hintDot, { backgroundColor: '#8B5CF6' }]} />
                  <Text style={styles.hint}>Accountant & Supervisor: Multiple stores</Text>
                </View>
              </View>
            </View>
          )}

          {isEditing && needsStoreAccess ? (
            <Text style={styles.hint}>
              Use "Assign Store" on the User Access screen to change store access.
            </Text>
          ) : null}

          {formError ? <Text style={styles.error}>{formError}</Text> : null}

          <AppButton
            disabled={disabled}
            loading={submitting}
            onPress={submit}
            title={isEditing ? 'Save Changes' : 'Create User'}
          />
        </View>
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.xl,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    ...shadows.sm,
    marginBottom: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.cardTintPurple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.md,
    color: colors.ink,
  },
  groupLabel: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.xs,
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
    marginTop: spacing.xs,
  },
  dropdownWrapper: {
    marginBottom: spacing.md,
    position: 'relative',
  },
  roleDropdown: {
    zIndex: 10,
  },
  storeDropdown: {
    zIndex: 5,
  },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 52,
  },
  dropdownButtonText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.sm,
    color: colors.ink,
    flex: 1,
  },
  placeholderText: {
    color: colors.muted,
    fontFamily: typography.fontFamily.regular,
  },
  dropdownRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  selectedCount: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  selectedCountText: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.xs,
    color: colors.surface,
  },
  dropdownMenu: {
    position: 'absolute',
    top: 56,
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    ...shadows.md,
    maxHeight: 280,
    overflow: 'hidden',
  },
  roleDropdownMenu: {
    zIndex: 20,
  },
  storeDropdownMenu: {
    zIndex: 15,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    minHeight: 48,
  },
  dropdownItemActive: {
    backgroundColor: '#8B5CF610',
  },
  dropdownItemDisabled: {
    opacity: 0.5,
  },
  dropdownItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  dropdownItemText: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.sm,
    color: colors.ink,
  },
  dropdownItemTextActive: {
    color: colors.primary,
    fontFamily: typography.fontFamily.semiBold,
  },
  dropdownItemTextDisabled: {
    color: colors.muted,
  },
  checkmarkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storeCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storeCheckboxSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  storeCheckboxDisabled: {
    borderColor: colors.muted,
  },
  storeOwnerTag: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    color: colors.muted,
    marginTop: 1,
  },
  disabledTag: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.xs,
    color: colors.danger,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  storeSection: {
    marginBottom: spacing.sm,
  },
  hintContainer: {
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: spacing.sm,
    marginBottom: spacing.md,
    gap: 4,
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  hintDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  hint: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    color: colors.muted,
    lineHeight: 18,
  },
  error: {
    fontFamily: typography.fontFamily.regular,
    color: colors.danger,
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.sm,
  },
});