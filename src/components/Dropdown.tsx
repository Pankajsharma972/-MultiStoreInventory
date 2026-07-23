import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon } from './AppIcon';
import { colors } from '../theme/colors';
import { shadows } from '../theme/shadows';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

export type DropdownOption = {
  label: string;
  value: string;
};

export function Dropdown({
  label,
  placeholder = 'Select an option',
  value,
  options,
  onChange,
  disabled,
  emptyText = 'No options available',
}: {
  label?: string;
  placeholder?: string;
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  emptyText?: string;
}) {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);

  const selected = options.find(option => option.value === value);
  const isDisabled = Boolean(disabled);

  const handleSelect = (next: string) => {
    onChange(next);
    setOpen(false);
  };

  return (
    <View style={styles.wrapper}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Pressable
        accessibilityRole="button"
        disabled={isDisabled}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          styles.field,
          pressed && styles.fieldPressed,
          isDisabled && styles.fieldDisabled,
        ]}>
        <Text
          numberOfLines={1}
          style={[styles.fieldText, !selected && styles.placeholder]}>
          {options.length === 0 ? emptyText : selected?.label || placeholder}
        </Text>
        <AppIcon name="chevronDown" size={18} tintColor={colors.muted} />
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
        statusBarTranslucent>
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} />
          <View
            style={[styles.sheet, { paddingBottom: insets.bottom + spacing.md }]}>
            <View style={styles.sheetHandle} />
            {label ? <Text style={styles.sheetTitle}>{label}</Text> : null}
            <ScrollView
              style={styles.list}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.listContent}>
              {options.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>{emptyText}</Text>
                </View>
              ) : (
                options.map(option => {
                  const active = option.value === value;
                  return (
                    <Pressable
                      key={option.value}
                      onPress={() => handleSelect(option.value)}
                      style={({ pressed }) => [
                        styles.option,
                        active && styles.optionActive,
                        pressed && styles.optionPressed,
                      ]}>
                      <Text
                        style={[styles.optionText, active && styles.optionTextActive]}>
                        {option.label}
                      </Text>
                      {active ? (
                        <AppIcon name="check" size={18} tintColor={colors.primary} />
                      ) : null}
                    </Pressable>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 16,
  },
  label: {
    color: colors.inkSoft,
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
    marginBottom: 8,
  },
  field: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 52,
    paddingHorizontal: 16,
  },
  fieldPressed: {
    opacity: 0.85,
  },
  fieldDisabled: {
    backgroundColor: colors.background,
    opacity: 0.7,
  },
  fieldText: {
    color: colors.ink,
    flex: 1,
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    marginRight: spacing.sm,
  },
  placeholder: {
    color: colors.muted,
  },
  backdrop: {
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    maxHeight: '70%',
    ...shadows.lg,
  },
  sheetHandle: {
    alignSelf: 'center',
    backgroundColor: colors.border,
    borderRadius: 3,
    height: 5,
    marginBottom: spacing.md,
    width: 44,
  },
  sheetTitle: {
    color: colors.ink,
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.md,
    marginBottom: spacing.sm,
  },
  list: {
    flexGrow: 0,
  },
  listContent: {
    paddingBottom: spacing.sm,
  },
  option: {
    alignItems: 'center',
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
  },
  optionActive: {
    backgroundColor: colors.cardTintGreen,
  },
  optionPressed: {
    opacity: 0.7,
  },
  optionText: {
    color: colors.inkSoft,
    flex: 1,
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
    marginRight: spacing.sm,
  },
  optionTextActive: {
    color: colors.primary,
    fontFamily: typography.fontFamily.semiBold,
  },
  emptyContainer: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: colors.muted,
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.sm,
    textAlign: 'center',
  },
});
