import React, { useMemo, useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import firestore from '@react-native-firebase/firestore';
import { AppIcon } from '../../../components/AppIcon';
import { AppTextInput } from '../../../components/AppTextInput';
import { EmptyState } from '../../../components/EmptyState';
import { FilterChips } from '../../../components/FilterChips';
import { ScreenShell } from '../../../components/ScreenShell';
import { readableDate } from '../../../services/inventoryRepository';
import { useInventoryData } from '../../../services/useInventoryData';
import { useAuth } from '../../auth/AuthProvider';
import { collections, db } from '../../../services/firebase';
import { colors } from '../../../theme/colors';
import { shadows } from '../../../theme/shadows';
import { spacing } from '../../../theme/spacing';
import { typography } from '../../../theme/typography';
import type { AppStackParamList } from '../../../navigation/types';
import type { ActivityAction } from '../../../types/models';

type Props = NativeStackScreenProps<AppStackParamList, 'History'>;

const ALL = '__all__';
const actionFilters: Array<{ label: string; value: ActivityAction | typeof ALL }> = [
  { label: 'All Actions', value: ALL },
  { label: 'Product Created', value: 'Product Created' },
  { label: 'Stock Added', value: 'Stock Added' },
  { label: 'Stock Updated', value: 'Stock Updated' },
  { label: 'Stock Removed', value: 'Stock Removed' },
  { label: 'Stock Returned', value: 'Stock Returned' },
  { label: 'Stock Transfer', value: 'Stock Transfer' },
  { label: 'Stock Moved', value: 'Stock Moved' },
  { label: 'Order Created', value: 'Order Created' },
  { label: 'Order Updated', value: 'Order Updated' },
  { label: 'Delivery Completed', value: 'Delivery Completed' },
  { label: 'Delivery Updated', value: 'Delivery Updated' },
  { label: 'Dispatch Approved', value: 'Dispatch Approved' },
  { label: 'Order Restocked', value: 'Order Restocked' },
];

function actionIcon(action: string): 'box' | 'transfer' | 'shoppingBag' | 'delivery' | 'activity' {
  if (action.includes('Transfer') || action.includes('Moved')) return 'transfer';
  if (action.includes('Order')) return 'shoppingBag';
  if (action.includes('Delivery')) return 'delivery';
  if (action.includes('Product') || action.includes('Stock')) return 'box';
  return 'activity';
}

export function HistoryScreen({ navigation }: Props) {
  const { profile } = useAuth();
  const data = useInventoryData();
  const [query, setQuery] = useState('');
  const [actionFilter, setActionFilter] = useState<ActivityAction | typeof ALL>(ALL);
  const [storeFilter, setStoreFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Check if user is Admin
  const isAdmin = useMemo(() => profile?.role === 'admin', [profile]);

  // ✅ SAFE: Get activity array with fallback
  const activityList = useMemo(() => {
    if (!data || !data.activity || !Array.isArray(data.activity)) {
      return [];
    }
    return data.activity;
  }, [data]);

  // ✅ SAFE: Get stores array with fallback
  const storesList = useMemo(() => {
    if (!data || !data.stores || !Array.isArray(data.stores)) {
      return [];
    }
    return data.stores;
  }, [data]);

  // ✅ SAFE: Filtered activity with null checks
  const filteredActivity = useMemo(() => {
    if (activityList.length === 0) {
      return [];
    }
    
    const text = query.trim().toLowerCase();
    return activityList.filter(log => {
      if (!log) return false;
      
      const matchesText =
        !text ||
        [log.action, log.detail, log.createdBy]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(text);
      const matchesAction = actionFilter === ALL || log.action === actionFilter;
      const matchesStore = !storeFilter || log.storeId === storeFilter;
      return matchesText && matchesAction && matchesStore;
    });
  }, [actionFilter, activityList, query, storeFilter]);

  // Check if all filtered items are selected
  const isAllSelected = useMemo(() => {
    if (filteredActivity.length === 0) return false;
    return filteredActivity.every(log => selectedIds.has(log.id));
  }, [filteredActivity, selectedIds]);

  // Toggle select all
  const toggleSelectAll = useCallback(() => {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      const allIds = filteredActivity.map(log => log.id);
      setSelectedIds(new Set(allIds));
    }
  }, [isAllSelected, filteredActivity]);

  // ✅ ONLY ADMIN CAN DELETE - Single entry delete
  const deleteSingleEntry = useCallback(async (logId: string) => {
    if (!isAdmin) {
      Alert.alert('Access Denied', 'Only Admin can delete activity entries.');
      return;
    }

    Alert.alert(
      'Delete Entry',
      'Are you sure you want to delete this entry? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsDeleting(true);
              await db.collection(collections.activityLogs).doc(logId).delete();
              if (data && typeof data.refreshActivity === 'function') {
                data.refreshActivity();
              }
              Alert.alert('Success', 'Entry deleted successfully.');
            } catch (error) {
              Alert.alert('Error', 'Could not delete entry.');
            } finally {
              setIsDeleting(false);
            }
          }
        }
      ]
    );
  }, [isAdmin, data]);

  // ✅ ONLY ADMIN CAN DELETE - Delete selected entries
  const deleteSelected = useCallback(async () => {
    if (!isAdmin) {
      Alert.alert('Access Denied', 'Only Admin can delete activity entries.');
      return;
    }

    if (selectedIds.size === 0) {
      Alert.alert('Info', 'No entries selected to delete.');
      return;
    }

    Alert.alert(
      'Delete Selected',
      `Are you sure you want to delete ${selectedIds.size} selected entries? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsDeleting(true);
              const batch = db.batch();
              selectedIds.forEach(id => {
                const ref = db.collection(collections.activityLogs).doc(id);
                batch.delete(ref);
              });
              await batch.commit();
              
              setSelectedIds(new Set());
              setIsSelectMode(false);
              if (data && typeof data.refreshActivity === 'function') {
                data.refreshActivity();
              }
              Alert.alert('Success', `${selectedIds.size} entries deleted successfully.`);
            } catch (error) {
              Alert.alert('Error', 'Could not delete selected entries.');
            } finally {
              setIsDeleting(false);
            }
          }
        }
      ]
    );
  }, [isAdmin, selectedIds, data]);

  // ✅ ONLY ADMIN CAN DELETE - Delete all entries
  const deleteAll = useCallback(async () => {
    if (!isAdmin) {
      Alert.alert('Access Denied', 'Only Admin can delete activity entries.');
      return;
    }

    if (filteredActivity.length === 0) {
      Alert.alert('Info', 'No entries to delete.');
      return;
    }

    Alert.alert(
      'Delete All',
      `Are you sure you want to delete all ${filteredActivity.length} entries? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsDeleting(true);
              const batch = db.batch();
              filteredActivity.forEach(log => {
                const ref = db.collection(collections.activityLogs).doc(log.id);
                batch.delete(ref);
              });
              await batch.commit();
              
              setSelectedIds(new Set());
              setIsSelectMode(false);
              if (data && typeof data.refreshActivity === 'function') {
                data.refreshActivity();
              }
              Alert.alert('Success', `${filteredActivity.length} entries deleted successfully.`);
            } catch (error) {
              Alert.alert('Error', 'Could not delete entries.');
            } finally {
              setIsDeleting(false);
            }
          }
        }
      ]
    );
  }, [isAdmin, filteredActivity, data]);

  // Toggle selection for multi-select
  const toggleSelection = useCallback((logId: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(logId)) {
        newSet.delete(logId);
      } else {
        newSet.add(logId);
      }
      return newSet;
    });
  }, []);

  // Long press to enter select mode
  const handleLongPress = useCallback((logId: string) => {
    setIsSelectMode(true);
    toggleSelection(logId);
  }, [toggleSelection]);

  // Exit select mode
  const exitSelectMode = useCallback(() => {
    setSelectedIds(new Set());
    setIsSelectMode(false);
  }, []);

  // Check if user has access
  if (!profile || !['admin', 'accountant', 'supervisor'].includes(profile.role)) {
    return (
      <ScreenShell
        onBack={navigation.canGoBack() ? navigation.goBack : undefined}
        subtitle="This section is available to authorized workflow roles only."
        title="Activity History">
        <EmptyState
          icon="history"
          title="Access restricted"
          subtitle="Only Admin, Accountant, and Supervisor can view workflow history."
        />
      </ScreenShell>
    );
  }

  // ✅ Loading state
  if (!data || !data.activity) {
    return (
      <ScreenShell
        onBack={navigation.goBack}
        subtitle="Loading activity history..."
        title="Activity History">
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading entries...</Text>
        </View>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      onBack={navigation.goBack}
      subtitle="Every product, stock, transfer, order, and delivery action is logged for traceability."
      title="Activity History">
      
      {/* Loading overlay for delete operations */}
      {isDeleting && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Deleting entries...</Text>
        </View>
      )}

      {/* Header with actions */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Text style={styles.resultCount}>
            {filteredActivity.length} entries
          </Text>
        </View>
        <View style={styles.headerRight}>
          {isSelectMode ? (
            <>
              <Pressable onPress={exitSelectMode} style={styles.headerBtn}>
                <Text style={styles.headerBtnText}>Cancel</Text>
              </Pressable>
              {/* ✅ Delete button only for Admin in select mode */}
              {isAdmin && selectedIds.size > 0 && (
                <Pressable onPress={deleteSelected} style={[styles.headerBtn, styles.headerBtnDanger]}>
                  <AppIcon name="trash" size={16} tintColor={colors.danger} />
                  <Text style={styles.headerBtnDangerText}>Delete</Text>
                </Pressable>
              )}
            </>
          ) : (
            <>
              {filteredActivity.length > 0 && (
                <>
                  <Pressable onPress={() => setIsSelectMode(true)} style={styles.headerBtn}>
                    <AppIcon name="check" size={16} tintColor={colors.primary} />
                    <Text style={styles.headerBtnText}>Select</Text>
                  </Pressable>
                  {/* ✅ Delete All button only for Admin */}
                  {isAdmin && (
                    <Pressable onPress={deleteAll} style={[styles.headerBtn, styles.headerBtnDanger]}>
                      <AppIcon name="trash" size={16} tintColor={colors.danger} />
                      <Text style={styles.headerBtnDangerText}>Delete All</Text>
                    </Pressable>
                  )}
                </>
              )}
            </>
          )}
        </View>
      </View>

      {/* Select All bar - only in select mode */}
      {isSelectMode && filteredActivity.length > 0 && isAdmin && (
        <View style={styles.selectAllBar}>
          <Pressable onPress={toggleSelectAll} style={styles.selectAllBtn}>
            <View style={[
              styles.selectAllCheckbox,
              isAllSelected && styles.selectAllCheckboxActive,
            ]}>
              {isAllSelected && (
                <AppIcon name="check" size={12} tintColor={colors.surface} />
              )}
            </View>
            <Text style={styles.selectAllText}>
              {isAllSelected ? 'Deselect All' : 'Select All'} ({filteredActivity.length})
            </Text>
          </Pressable>
          {selectedIds.size > 0 && (
            <Text style={styles.selectedCount}>
              {selectedIds.size} selected
            </Text>
          )}
        </View>
      )}

      <View style={styles.searchWrap}>
        <AppIcon name="search" size={18} tintColor={colors.muted} style={styles.searchIcon} />
        <AppTextInput
          label="Search History"
          onChangeText={setQuery}
          placeholder="Product, action, user..."
          value={query}
        />
      </View>

      <FilterChips
        label="Store Filter"
        onChange={value => setStoreFilter(value === ALL ? '' : value)}
        options={[
          { label: 'All Stores', value: ALL },
          ...(storesList.length > 0 ? storesList.map(store => ({ label: store.name, value: store.id })) : []),
        ]}
        value={storeFilter || ALL}
      />
      <FilterChips
        label="Action Filter"
        onChange={value => setActionFilter(value as ActivityAction | typeof ALL)}
        options={actionFilters.map(filter => ({ label: filter.label, value: filter.value }))}
        value={actionFilter}
      />

      {filteredActivity.length === 0 ? (
        <EmptyState icon="history" title="No activity found" subtitle="Try adjusting your search or filters." />
      ) : (
        <ScrollView style={styles.listContainer} showsVerticalScrollIndicator={false}>
          {filteredActivity.map((log) => {
            const isSelected = selectedIds.has(log.id);
            
            return (
              <Pressable
                key={log.id}
                onLongPress={() => {
                  if (isAdmin) {
                    handleLongPress(log.id);
                  }
                }}
                onPress={() => {
                  if (isSelectMode && isAdmin) {
                    toggleSelection(log.id);
                  }
                }}
                style={({ pressed }) => [
                  styles.timelineRow,
                  pressed && styles.pressed,
                  isSelected && styles.selectedRow,
                ]}>
                <View style={styles.timelineLine}>
                  <View style={styles.timelineDot} />
                </View>
                <View style={[
                  styles.logCard,
                  isSelected && styles.logCardSelected,
                ]}>
                  <View style={styles.logHeader}>
                    {isSelectMode && isAdmin && (
                      <View style={[
                        styles.selectCheckbox,
                        isSelected && styles.selectCheckboxActive,
                      ]}>
                        {isSelected && (
                          <AppIcon name="check" size={12} tintColor={colors.surface} />
                        )}
                      </View>
                    )}
                    <View style={styles.logIconWrap}>
                      <AppIcon name={actionIcon(log.action)} size={16} tintColor={colors.accent} />
                    </View>
                    <Text style={styles.logAction}>
                      {log.action}
                    </Text>
                  </View>
                  <Text style={styles.logDetail}>{log.detail}</Text>
                  <View style={styles.logMeta}>
                    <AppIcon name="user" size={12} tintColor={colors.muted} />
                    <Text style={styles.logMetaText}>
                      {log.createdBy || 'System'} · {readableDate(log.createdAt)}
                    </Text>
                  </View>
                  
                  {/* ✅ Delete button only for Admin - Individual delete */}
                  {!isSelectMode && isAdmin && (
                    <View style={styles.logActions}>
                      <Pressable 
                        onPress={() => deleteSingleEntry(log.id)}
                        style={[styles.logActionBtn, styles.logActionBtnDanger]}>
                        <AppIcon name="trash" size={12} tintColor={colors.danger} />
                        <Text style={styles.logActionBtnDangerText}>Delete</Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  searchWrap: {
    position: 'relative',
  },
  searchIcon: {
    position: 'absolute',
    right: 16,
    top: 38,
    zIndex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    borderRadius: 8,
  },
  headerBtnDanger: {
    backgroundColor: '#FEE2E2',
  },
  headerBtnText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.xs,
    color: colors.primary,
  },
  headerBtnDangerText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.xs,
    color: colors.danger,
  },
  resultCount: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.xs,
    color: colors.muted,
  },
  selectAllBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 12,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  selectAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  selectAllCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectAllCheckboxActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  selectAllText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.sm,
    color: colors.ink,
  },
  selectedCount: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.xs,
    color: colors.muted,
  },
  timelineRow: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
    borderRadius: 14,
  },
  pressed: {
    opacity: 0.8,
  },
  selectedRow: {
    backgroundColor: colors.primaryLight + '30',
    borderRadius: 14,
  },
  timelineLine: {
    width: 24,
    alignItems: 'center',
    paddingTop: 18,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  logCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    ...shadows.sm,
  },
  logCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight + '20',
  },
  logHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  selectCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectCheckboxActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  logIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.cardTintBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logAction: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.sm,
    color: colors.ink,
    flex: 1,
  },
  logDetail: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    color: colors.muted,
    lineHeight: 18,
    marginBottom: spacing.sm,
  },
  logMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  logMetaText: {
    fontFamily: typography.fontFamily.regular,
    fontSize: 11,
    color: colors.muted,
  },
  logActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  logActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    borderRadius: 6,
    backgroundColor: '#FEE2E2',
    alignSelf: 'flex-start',
  },
  logActionBtnDanger: {
    backgroundColor: '#FEE2E2',
  },
  logActionBtnDangerText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: 10,
    color: colors.danger,
  },
  listContainer: {
    flex: 1,
    marginBottom: spacing.lg,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
    borderRadius: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  loadingText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.md,
    color: colors.muted,
    marginTop: spacing.md,
  },
});