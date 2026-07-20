import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  Pressable,
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
import type { IconName } from '../theme/icons';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export type BottomSheetAction = {
  id: string;
  label: string;
  icon: IconName;
  tint?: string;
  bg?: string;
  onPress: () => void;
  destructive?: boolean;
};

type BottomSheetProps = {
  visible: boolean;
  title: string;
  subtitle?: string;
  actions: BottomSheetAction[];
  onClose: () => void;
};

export function BottomSheet({ visible, title, subtitle, actions, onClose }: BottomSheetProps) {
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          damping: 22,
          stiffness: 200,
          mass: 0.8,
        }),
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: SCREEN_HEIGHT,
          duration: 240,
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, slideAnim, backdropAnim]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent>
      {/* Backdrop */}
      <Animated.View style={[styles.backdrop, { opacity: backdropAnim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      {/* Sheet */}
      <Animated.View
        style={[
          styles.sheet,
          { paddingBottom: insets.bottom + spacing.lg },
          { transform: [{ translateY: slideAnim }] },
        ]}>
        {/* Drag handle */}
        <View style={styles.handle} />

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          {actions.map((action, index) => {
            const isLast = index === actions.length - 1;
            const tint = action.destructive ? colors.danger : action.tint ?? colors.primary;
            const bg = action.destructive ? colors.cardTintRed : action.bg ?? colors.cardTintGreen;
            return (
              <Pressable
                key={action.id}
                onPress={() => {
                  onClose();
                  // Small delay so sheet closes before action runs
                  setTimeout(action.onPress, 150);
                }}
                style={({ pressed }) => [
                  styles.actionRow,
                  !isLast && styles.actionRowBorder,
                  pressed && styles.actionRowPressed,
                ]}>
                <View style={[styles.actionIcon, { backgroundColor: bg }]}>
                  <AppIcon name={action.icon} size={18} tintColor={tint} />
                </View>
                <Text style={[styles.actionLabel, action.destructive && styles.actionLabelDanger]}>
                  {action.label}
                </Text>
                <AppIcon name="chevronRight" size={16} tintColor={colors.muted} />
              </Pressable>
            );
          })}
        </View>

        {/* Cancel */}
        <Pressable
          style={({ pressed }) => [styles.cancelBtn, pressed && styles.cancelBtnPressed]}
          onPress={onClose}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    ...shadows.lg,
    overflow: 'hidden',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.lg,
    color: colors.ink,
  },
  subtitle: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    color: colors.muted,
    marginTop: 4,
  },
  actions: {
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  actionRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  actionRowPressed: {
    backgroundColor: colors.background,
    borderRadius: 14,
    paddingHorizontal: spacing.sm,
    marginHorizontal: -spacing.sm,
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.md,
    color: colors.ink,
    flex: 1,
  },
  actionLabelDanger: {
    color: colors.danger,
  },
  cancelBtn: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.background,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelBtnPressed: {
    opacity: 0.7,
  },
  cancelText: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.md,
    color: colors.inkSoft,
  },
});

