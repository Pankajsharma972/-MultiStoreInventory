import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { AppIcon } from './AppIcon';
import { colors } from '../theme/colors';

// Shows a product/design photo, falling back to a neutral box icon when no
// photo has been added yet.
export function ProductThumbnail({
  uri,
  size = 48,
  radius = 12,
}: {
  uri?: string;
  size?: number;
  radius?: number;
}) {
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[styles.image, { width: size, height: size, borderRadius: radius }]}
      />
    );
  }
  return (
    <View
      style={[
        styles.placeholder,
        { width: size, height: size, borderRadius: radius },
      ]}>
      <AppIcon name="box" size={size * 0.42} tintColor={colors.muted} />
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    resizeMode: 'cover',
    backgroundColor: colors.background,
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
