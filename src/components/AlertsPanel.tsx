import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
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
import type { AppAlert } from '../services/useAlerts';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const PANEL_HEIGHT = SCREEN_HEIGHT * 0.72;

type AlertsPanelProps = {
  visible: boolean;
  alerts: AppAlert[];
  onClose: () => void;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onClearAll: () => void;
};

function formatTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(ts).toLocaleDateString();
}

function AlertRow({
  alert,
  onMarkRead,
}: {
  alert: AppAlert;
  onMarkRead: (id: string) => void;
}) {
  const isNewStore = alert.type === 'new_store_assigned';
  const iconName = isNewStore ? 'store' : ('alertCircle' as const);
  const accentColor = isNewStore ? colors.accent : colors.danger;
  const bgColor = isNewStore ? colors.cardTintBlue : colors.cardTintRed;
  const borderColor = isNewStore ? '#BFDBFE' : '#FECACA';

  return (
    <Pressable
      onPress={() => onMarkRead(alert.id)}
      style={[
        styles.alertRow,
        { borderColor, backgroundColor: alert.read ? colors.surface : bgColor },
      ]}>
      {!alert.read && <View style={[styles.unreadDot, { backgroundColor: accentColor }]} />}
      <View style={[styles.alertIcon, { backgroundColor: `${accentColor}20` }]}>
        <AppIcon name={iconName} size={18} tintColor={accentColor} />
      </View>
      <View style={styles.alertBody}>
        <View style={styles.alertTitleRow}>
          <Text
            style={[styles.alertTitle, !alert.read && styles.alertTitleUnread]}
            numberOfLines={1}>
            {alert.title}
          </Text>
          <Text style={styles.alertTime}>{formatTime(alert.timestamp)}</Text>
        </View>
        <Text style={styles.alertSubtitle} numberOfLines={2}>
          {alert.subtitle}
        </Text>
      </View>
    </Pressable>
  );
}

export function AlertsPanel({
  visible,
  alerts,
  onClose,
  onMarkRead,
  onMarkAllRead,
  onClearAll,
}: AlertsPanelProps) {
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(PANEL_HEIGHT)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          damping: 20,
          stiffness: 180,
        }),
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: PANEL_HEIGHT,
          duration: 260,
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, slideAnim, backdropAnim]);

  const unread = alerts.filter(a => !a.read).length;
  const lowStockAlerts = alerts.filter(a => a.type === 'low_stock');
  const storeAlerts = alerts.filter(a => a.type === 'new_store_assigned');

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent>
      <Animated.View
        style={[styles.backdrop, { opacity: backdropAnim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      <Animated.View
        style={[
          styles.panel,
          { paddingBottom: insets.bottom + spacing.lg },
          { transform: [{ translateY: slideAnim }] },
        ]}>
        <View style={styles.handle} />

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.bellWrap}>
              <AppIcon name="bell" size={20} tintColor={colors.primary} />
              {unread > 0 && (
                <View style={styles.headerBadge}>
                  <Text style={styles.headerBadgeText}>{unread > 99 ? '99+' : unread}</Text>
                </View>
              )}
            </View>
            <View>
              <Text style={styles.headerTitle}>Notifications</Text>
              <Text style={styles.headerSub}>
                {alerts.length === 0
                  ? 'All clear — no active alerts'
                  : `${unread} unread · ${alerts.length} total`}
              </Text>
            </View>
          </View>
          <View style={styles.headerActions}>
            {unread > 0 && (
              <Pressable style={styles.actionBtn} onPress={onMarkAllRead}>
                <Text style={styles.actionBtnText}>Mark all read</Text>
              </Pressable>
            )}
            {alerts.length > 0 && (
              <Pressable style={[styles.actionBtn, styles.clearBtn]} onPress={onClearAll}>
                <Text style={[styles.actionBtnText, styles.clearBtnText]}>Clear</Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* List */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}>
          {alerts.length === 0 ? (
            <View style={styles.emptyWrap}>
              <View style={styles.emptyIcon}>
                <AppIcon name="check" size={28} tintColor={colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>All caught up!</Text>
              <Text style={styles.emptySub}>
                No alerts right now. Stock levels look healthy.
              </Text>
            </View>
          ) : (
            <>
              {storeAlerts.length > 0 && (
                <>
                  <View style={styles.sectionLabel}>
                    <AppIcon name="store" size={12} tintColor={colors.accent} />
                    <Text style={[styles.sectionLabelText, { color: colors.accent }]}>
                      Store Assignments
                    </Text>
                  </View>
                  {storeAlerts.map(alert => (
                    <AlertRow key={alert.id} alert={alert} onMarkRead={onMarkRead} />
                  ))}
                </>
              )}
              {lowStockAlerts.length > 0 && (
                <>
                  <View style={styles.sectionLabel}>
                    <AppIcon name="alertCircle" size={12} tintColor={colors.danger} />
                    <Text style={[styles.sectionLabelText, { color: colors.danger }]}>
                      Stock Alerts ({lowStockAlerts.length})
                    </Text>
                  </View>
                  {lowStockAlerts.map(alert => (
                    <AlertRow key={alert.id} alert={alert} onMarkRead={onMarkRead} />
                  ))}
                </>
              )}
            </>
          )}
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  panel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: PANEL_HEIGHT,
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    ...shadows.md,
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  bellWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.cardTintGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: colors.danger,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: colors.surface,
  },
  headerBadgeText: {
    fontFamily: typography.fontFamily.bold,
    fontSize: 9,
    color: colors.surface,
  },
  headerTitle: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.lg,
    color: colors.ink,
  },
  headerSub: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    color: colors.muted,
    marginTop: 1,
  },
  headerActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: colors.cardTintGreen,
    borderWidth: 1,
    borderColor: colors.primaryLight,
  },
  actionBtnText: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: 11,
    color: colors.primaryDark,
  },
  clearBtn: {
    backgroundColor: colors.cardTintRed,
    borderColor: '#FECACA',
  },
  clearBtnText: {
    color: colors.danger,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  sectionLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  sectionLabelText: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 14,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.sm,
    position: 'relative',
    ...shadows.sm,
  },
  unreadDot: {
    position: 'absolute',
    top: 14,
    right: spacing.md,
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  alertIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  alertBody: {
    flex: 1,
  },
  alertTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: 3,
  },
  alertTitle: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.sm,
    color: colors.inkSoft,
    flex: 1,
  },
  alertTitleUnread: {
    fontFamily: typography.fontFamily.semiBold,
    color: colors.ink,
  },
  alertTime: {
    fontFamily: typography.fontFamily.regular,
    fontSize: 10,
    color: colors.muted,
  },
  alertSubtitle: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    color: colors.muted,
    lineHeight: 17,
  },
  emptyWrap: {
    alignItems: 'center',
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xxl,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: colors.cardTintGreen,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.xl,
    color: colors.ink,
    marginBottom: spacing.sm,
  },
  emptySub: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.sm,
    color: colors.muted,
    textAlign: 'center',
    maxWidth: 260,
    lineHeight: 20,
  },
});

