import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppIcon } from '../../../components/AppIcon';
import { colors } from '../../../theme/colors';
import { shadows } from '../../../theme/shadows';
import { spacing } from '../../../theme/spacing';
import { typography } from '../../../theme/typography';

type AuthScaffoldProps = {
  children: React.ReactNode;
  subtitle?: string;
};

export function AuthScaffold({ children, subtitle }: AuthScaffoldProps) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}>
          <View style={styles.spacer} />
          <View style={styles.heroCard}>
            <View style={styles.logoWrap}>
              <AppIcon name="box" size={28} tintColor={colors.surface} />
            </View>
            <Text style={styles.title}>Multi-Store Inventory</Text>
            <Text style={styles.subtitle}>
              {subtitle || 'Enterprise inventory management for stores, warehouses, and staff.'}
            </Text>
          </View>
          <View style={styles.formCard}>{children}</View>
          <View style={styles.spacer} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.background,
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    padding: spacing.xl,
  },
  spacer: {
    flex: 1,
    minHeight: spacing.md,
  },
  heroCard: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  logoWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    ...shadows.md,
  },
  title: {
    color: colors.ink,
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.xxxl,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  subtitle: {
    color: colors.muted,
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.sm,
    lineHeight: 22,
    marginTop: spacing.sm,
    textAlign: 'center',
    maxWidth: 320,
  },
  formCard: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    ...shadows.md,
  },
});
