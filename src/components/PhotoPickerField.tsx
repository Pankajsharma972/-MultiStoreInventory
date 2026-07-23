import React, { useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, StyleSheet, Text, View, PermissionsAndroid, Platform } from 'react-native';
import {
  launchCamera,
  launchImageLibrary,
  type ImagePickerResponse,
} from 'react-native-image-picker';
import ImageResizer from 'react-native-image-resizer';
import { AppIcon } from './AppIcon';
import { uploadProductPhoto } from '../services/inventoryRepository';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

// Request camera permission with proper handling
const requestCameraPermission = async (): Promise<boolean> => {
  try {
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.CAMERA,
        {
          title: 'Camera Permission',
          message: 'App needs access to your camera to take photos.',
          buttonPositive: 'OK',
          buttonNegative: 'Cancel',
        },
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    }
    return true;
  } catch (err) {
    console.warn('Camera permission error:', err);
    return false;
  }
};

// Request gallery permission for Android 13+
const requestGalleryPermission = async (): Promise<boolean> => {
  try {
    if (Platform.OS === 'android') {
      if (Platform.Version >= 33) {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES,
          {
            title: 'Gallery Permission',
            message: 'App needs access to your photos.',
            buttonPositive: 'OK',
            buttonNegative: 'Cancel',
          },
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } else {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
          {
            title: 'Storage Permission',
            message: 'App needs access to your photos.',
            buttonPositive: 'OK',
            buttonNegative: 'Cancel',
          },
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      }
    }
    return true;
  } catch (err) {
    console.warn('Gallery permission error:', err);
    return false;
  }
};

// Compress image before upload
const compressImage = async (uri: string): Promise<string> => {
  try {
    const response = await ImageResizer.createResizedImage(
      uri,
      800,
      800,
      'JPEG',
      70,
      0,
      undefined,
    );
    return response.uri;
  } catch (error) {
    console.warn('Image compression failed, using original:', error);
    return uri;
  }
};

export function PhotoPickerField({
  label = 'Design Photo',
  value,
  onChange,
  required,
}: {
  label?: string;
  value?: string;
  onChange: (url: string) => void;
  required?: boolean;
}) {
  const [uploading, setUploading] = useState(false);

  const handleResponse = async (response: ImagePickerResponse) => {
    if (response.didCancel) {
      return;
    }
    if (response.errorCode) {
      Alert.alert('Photo error', response.errorMessage || 'Could not open the camera or gallery.');
      return;
    }
    const asset = response.assets?.[0];
    if (!asset?.uri) {
      return;
    }
    
    setUploading(true);
    try {
      const compressedUri = await compressImage(asset.uri);
      const url = await uploadProductPhoto(compressedUri);
      onChange(url);
    } catch (error) {
      Alert.alert('Upload failed', (error as Error).message || 'Could not upload photo.');
    } finally {
      setUploading(false);
    }
  };

  const pickFromCamera = async () => {
    try {
      // Request permission first
      const hasPermission = await requestCameraPermission();
      if (!hasPermission) {
        Alert.alert('Permission Denied', 'Camera permission is required to take photos.');
        return;
      }

      launchCamera(
        { 
          mediaType: 'photo', 
          quality: 0.7,
          maxWidth: 800,
          maxHeight: 800,
          includeBase64: false,
          saveToPhotos: false,
        }, 
        handleResponse
      );
    } catch (err: any) {
      console.warn('Camera error:', err);
      Alert.alert('Error', 'Could not open camera. Please check permissions.');
    }
  };

  const pickFromGallery = async () => {
    try {
      // Request permission first
      const hasPermission = await requestGalleryPermission();
      if (!hasPermission) {
        Alert.alert('Permission Denied', 'Gallery permission is required to select photos.');
        return;
      }

      launchImageLibrary(
        { 
          mediaType: 'photo', 
          quality: 0.7,
          maxWidth: 800,
          maxHeight: 800,
          includeBase64: false,
        }, 
        handleResponse
      );
    } catch (err: any) {
      console.warn('Gallery error:', err);
      Alert.alert('Error', 'Could not open gallery. Please check permissions.');
    }
  };

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>
        {label}
        {required ? ' *' : ''}
      </Text>
      <View style={styles.row}>
        <View style={styles.previewWrap}>
          {value ? (
            <Image source={{ uri: value }} style={styles.preview} />
          ) : (
            <View style={[styles.preview, styles.previewEmpty]}>
              <AppIcon name="box" size={26} tintColor={colors.muted} />
            </View>
          )}
          {uploading ? (
            <View style={styles.previewOverlay}>
              <ActivityIndicator color={colors.surface} />
            </View>
          ) : null}
        </View>

        <View style={styles.actions}>
          <Pressable
            disabled={uploading}
            onPress={pickFromCamera}
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}>
            <AppIcon name="camera" size={14} tintColor={colors.primary} />
            <Text style={styles.buttonText}>Take Photo</Text>
          </Pressable>
          <Pressable
            disabled={uploading}
            onPress={pickFromGallery}
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}>
            <AppIcon name="image" size={14} tintColor={colors.primary} />
            <Text style={styles.buttonText}>Choose from Gallery</Text>
          </Pressable>
          {value ? (
            <Pressable
              disabled={uploading}
              onPress={() => onChange('')}
              style={({ pressed }) => [styles.removeBtn, pressed && styles.buttonPressed]}>
              <Text style={styles.removeText}>Remove photo</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
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
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  previewWrap: {
    width: 88,
    height: 88,
  },
  preview: {
    width: 88,
    height: 88,
    borderRadius: 14,
    resizeMode: 'cover',
    backgroundColor: colors.background,
  },
  previewEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  previewOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15,23,42,0.45)',
  },
  actions: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.sm,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonText: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.xs,
    color: colors.primary,
  },
  removeBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  removeText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.xs,
    color: colors.danger,
  },
});