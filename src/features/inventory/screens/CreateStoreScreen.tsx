import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppButton } from '../../../components/AppButton';
import { AppIcon } from '../../../components/AppIcon';
import { AppTextInput } from '../../../components/AppTextInput';
import { EmptyState } from '../../../components/EmptyState';
import { ScreenShell } from '../../../components/ScreenShell';
import { addActivity, saveStore } from '../../../services/inventoryRepository';
import { useAuth } from '../../auth/AuthProvider';
import { colors } from '../../../theme/colors';
import { shadows } from '../../../theme/shadows';
import { spacing } from '../../../theme/spacing';
import { typography } from '../../../theme/typography';
import type { AppStackParamList } from '../../../navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'CreateStore'>;

export function CreateStoreScreen({ navigation }: Props) {
  const { profile } = useAuth();
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!name.trim()) {
      return;
    }
    setError('');
    setSaving(true);
    try {
      await saveStore({ name, location });
      await addActivity({ action: 'Store Created', detail: `${name.trim()} created`, user: profile });
      navigation.goBack();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create store.');
    } finally {
      setSaving(false);
    }
  };

  if (profile?.role !== 'admin') {
    return (
      <ScreenShell
        onBack={navigation.canGoBack() ? navigation.goBack : undefined}
        subtitle="This section is available to administrators only."
        title="Create Store">
        <EmptyState
          icon="store"
          title="Access restricted"
          subtitle="Only administrators can create stores."
        />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      onBack={navigation.canGoBack() ? navigation.goBack : undefined}
      subtitle="Add a new store to your multi-store network."
      title="Create Store">
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.iconWrap}>
            <AppIcon name="store" size={18} tintColor={colors.primary} />
          </View>
          <Text style={styles.cardTitle}>Store Details</Text>
        </View>

        <AppTextInput
          label="Store Name"
          onChangeText={setName}
          placeholder="e.g. Store 1"
          value={name}
        />
        <AppTextInput
          label="Address / Area"
          onChangeText={setLocation}
          placeholder="Market, city"
          value={location}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <AppButton
          disabled={!name.trim() || saving}
          loading={saving}
          onPress={submit}
          title="Create Store"
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
    backgroundColor: colors.cardTintGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.md,
    color: colors.ink,
  },
  error: {
    fontFamily: typography.fontFamily.regular,
    color: colors.danger,
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.sm,
  },
});
