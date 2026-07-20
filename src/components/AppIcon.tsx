import React from 'react';
import { Image, StyleSheet, type ImageStyle, type StyleProp } from 'react-native';
import { icons, type IconName } from '../theme/icons';

type AppIconProps = {
  name: IconName;
  size?: number;
  tintColor?: string;
  style?: StyleProp<ImageStyle>;
};

export function AppIcon({ name, size = 20, tintColor, style }: AppIconProps) {
  return (
    <Image
      source={icons[name]}
      style={[styles.icon, { width: size, height: size, tintColor }, style]}
    />
  );
}

const styles = StyleSheet.create({
  icon: {
    resizeMode: 'contain',
  },
});
