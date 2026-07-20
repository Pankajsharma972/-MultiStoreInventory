import React from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  Pressable,
  View,
  type TextInputProps,
} from 'react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

type AppTextInputProps = TextInputProps & {
  label: string;
  showPasswordToggle?: boolean;
};

export function AppTextInput({
  label,
  secureTextEntry,
  showPasswordToggle,
  style,
  ...props
}: AppTextInputProps) {
  const [passwordVisible, setPasswordVisible] = React.useState(false);
  const shouldShowToggle = Boolean(showPasswordToggle || secureTextEntry);

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputWrap}>
        <TextInput
          placeholderTextColor={colors.muted}
          secureTextEntry={Boolean(secureTextEntry && !passwordVisible)}
          style={[styles.input, shouldShowToggle && styles.inputWithToggle, style]}
          {...props}
        />
        {shouldShowToggle ? (
          <Pressable
            accessibilityLabel={passwordVisible ? 'Hide password' : 'Show password'}
            accessibilityRole="button"
            hitSlop={10}
            onPress={() => setPasswordVisible(current => !current)}
            style={styles.eyeButton}>
            <Text style={styles.eyeIcon}>{passwordVisible ? 'Hide' : 'Show'}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  eyeButton: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    position: 'absolute',
    right: 10,
    top: 4,
    width: 44,
  },
  eyeIcon: {
    color: colors.primaryDark,
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.semiBold,
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    color: colors.ink,
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    minHeight: 52,
    paddingHorizontal: 16,
  },
  inputWithToggle: {
    paddingRight: 58,
  },
  inputWrap: {
    position: 'relative',
  },
  label: {
    color: colors.inkSoft,
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
    marginBottom: 8,
  },
  wrapper: {
    marginBottom: 16,
  },
});
