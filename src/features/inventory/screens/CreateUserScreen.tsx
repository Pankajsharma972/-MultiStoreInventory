import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
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

  // Map of storeId -> staff user who already owns it (for one-store-one-staff rule).
  const storeOwners = useMemo(() => {
    const map = new Map<string, UserProfile>();
    data.users.forEach(u => {
      if (u.role !== 'staff') return;
      (u.assignedStoreIds || []).forEach(id => {
        if (!map.has(id)) map.set(id, u);
      });
    });
    return map;
  }, [data.users]);

  const toggleStore = (storeId: string) => {
    setFormError('');
    const owner = storeOwners.get(storeId);
    const alreadySelected = assignedStoreIds.includes(storeId);
    if (!alreadySelected && owner) {
      setFormError(`Already assigned to: ${owner.name}`);
      return;
    }
    setAssignedStoreIds(cur =>
      cur.includes(storeId) ? cur.filter(id => id !== storeId) : [...cur, storeId],
    );
  };

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
          : 'Add a new admin or store staff member.'
      }
      title={isEditing ? 'Edit User' : 'Create User'}>
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
          placeholder="Staff or admin name"
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

        <Text style={styles.groupLabel}>Role</Text>
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

        {!isEditing && role === 'staff' && data.stores.length > 0 && (
          <View style={styles.storeSection}>
            <Text style={styles.groupLabel}>Assign Stores</Text>
            <View style={styles.chipRow}>
              {data.stores.map(store => {
                const owner = storeOwners.get(store.id);
                const selected = assignedStoreIds.includes(store.id);
                const takenByOther = Boolean(owner) && !selected;
                return (
                  <Pressable
                    key={store.id}
                    disabled={takenByOther}
                    onPress={() => toggleStore(store.id)}
                    style={[
                      styles.chip,
                      selected && styles.chipActive,
                      takenByOther && styles.chipDisabled,
                    ]}>
                    <Text
                      style={[
                        styles.chipText,
                        selected && styles.chipTextActive,
                        takenByOther && styles.chipTextDisabled,
                      ]}>
                      {store.name}
                      {takenByOther ? ` · ${owner?.name}` : ''}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.hint}>
              Stores already assigned to another staff member are unavailable.
            </Text>
          </View>
        )}

        {isEditing && role === 'staff' ? (
          <Text style={styles.hint}>
            Use “Assign Store” on the User Access screen to change store access.
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
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    ...shadows.sm,
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
  chipDisabled: {
    opacity: 0.5,
  },
  chipText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.xs,
    color: colors.inkSoft,
  },
  chipTextActive: {
    color: colors.surface,
  },
  chipTextDisabled: {
    color: colors.muted,
  },
  storeSection: {
    marginBottom: spacing.sm,
  },
  hint: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    color: colors.muted,
    marginBottom: spacing.md,
  },
  error: {
    fontFamily: typography.fontFamily.regular,
    color: colors.danger,
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.sm,
  },
});
