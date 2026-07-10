import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  FlatList,
  RefreshControl,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import {
  useListLeaveRequests,
  useGetLeaveBalance,
  useCreateLeaveRequest,
  useUpdateLeaveStatus,
  getListLeaveRequestsQueryKey,
  getGetLeaveBalanceQueryKey,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Feather } from '@expo/vector-icons';
import type { LeaveRequest } from '@workspace/api-client-react';
import * as Haptics from 'expo-haptics';

const LEAVE_TYPES = [
  { key: 'annual', label: 'استحقاقی' },
  { key: 'hourly', label: 'ساعتی' },
  { key: 'unpaid', label: 'بدون حقوق' },
  { key: 'medical', label: 'استعلاجی' },
  { key: 'mission', label: 'ماموریت' },
];

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: 'در انتظار', color: '#F59E0B' },
  approved: { label: 'تایید شد', color: '#10B981' },
  rejected: { label: 'رد شد', color: '#EF4444' },
};

function LeaveCard({
  leave,
  isManager,
  onApprove,
  onReject,
}: {
  leave: LeaveRequest;
  isManager: boolean;
  onApprove?: () => void;
  onReject?: () => void;
}) {
  const colors = useColors();
  const statusInfo = STATUS_LABELS[leave.status] ?? { label: leave.status, color: colors.mutedForeground };
  const typeLabel = LEAVE_TYPES.find((t) => t.key === leave.type)?.label ?? leave.type;

  return (
    <View style={[styles.leaveCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.leaveCardTop}>
        <View style={[styles.statusBadge, { backgroundColor: statusInfo.color + '20' }]}>
          <Text style={[styles.statusText, { color: statusInfo.color }]}>
            {statusInfo.label}
          </Text>
        </View>
        <View style={styles.leaveCardRight}>
          {isManager && (
            <Text style={[styles.leaveUser, { color: colors.accent }]}>{leave.userName}</Text>
          )}
          <Text style={[styles.leaveType, { color: colors.foreground }]}>{typeLabel}</Text>
          <Text style={[styles.leaveDates, { color: colors.mutedForeground }]}>
            {leave.startDate}
            {leave.endDate && leave.endDate !== leave.startDate && ` تا ${leave.endDate}`}
            {leave.hours != null && ` - ${leave.hours} ساعت`}
          </Text>
        </View>
      </View>

      {leave.reason && (
        <Text style={[styles.leaveReason, { color: colors.mutedForeground }]} numberOfLines={2}>
          {leave.reason}
        </Text>
      )}

      {leave.managerNote && (
        <View style={[styles.noteBox, { backgroundColor: colors.muted }]}>
          <Text style={[styles.noteText, { color: colors.mutedForeground }]}>
            {leave.managerNote}
          </Text>
        </View>
      )}

      {isManager && leave.status === 'pending' && (
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.destructive + '15', borderColor: colors.destructive }]}
            onPress={onReject}
            activeOpacity={0.7}
          >
            <Feather name="x" size={16} color={colors.destructive} />
            <Text style={[styles.actionBtnText, { color: colors.destructive }]}>رد</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.success + '15', borderColor: colors.success }]}
            onPress={onApprove}
            activeOpacity={0.7}
          >
            <Feather name="check" size={16} color={colors.success} />
            <Text style={[styles.actionBtnText, { color: colors.success }]}>تایید</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

export default function LeaveScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isManager = ['admin', 'manager', 'special_manager', 'hr'].includes(user?.role ?? '');

  const { data: balance, refetch: refetchBalance } = useGetLeaveBalance({ query: { enabled: !!user } });
  const { data: requests, isLoading, refetch, isFetching } = useListLeaveRequests(
    undefined,
    { query: { enabled: !!user } },
  );

  const [showModal, setShowModal] = useState(false);
  const [leaveType, setLeaveType] = useState('annual');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');

  const createMutation = useCreateLeaveRequest({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListLeaveRequestsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetLeaveBalanceQueryKey() });
        setShowModal(false);
        setReason('');
        setStartDate('');
        setEndDate('');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      },
      onError: (err: unknown) => {
        const msg =
          (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
          'خطا در ثبت درخواست';
        Alert.alert('خطا', msg);
      },
    },
  });

  const updateStatusMutation = useUpdateLeaveStatus({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListLeaveRequestsQueryKey() });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      },
    },
  });

  const handleSubmit = () => {
    if (!startDate || !reason) {
      Alert.alert('خطا', 'تاریخ شروع و دلیل الزامی است');
      return;
    }
    createMutation.mutate({
      data: {
        type: leaveType as never,
        startDate,
        endDate: endDate || undefined,
        reason,
      },
    });
  };

  const handleApprove = (id: number) => {
    updateStatusMutation.mutate({ id, data: { status: 'approved' as never } });
  };

  const handleReject = (id: number) => {
    Alert.prompt
      ? Alert.prompt('رد درخواست', 'دلیل رد (اختیاری):', (note) => {
          updateStatusMutation.mutate({ id, data: { status: 'rejected' as never, managerNote: note || undefined } });
        })
      : updateStatusMutation.mutate({ id, data: { status: 'rejected' as never } });
  };

  const bottomPad = insets.bottom + 68 + (Platform.OS === 'web' ? 34 : 0);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: bottomPad }}
        refreshControl={<RefreshControl refreshing={isFetching} onRefresh={() => { refetch(); refetchBalance(); }} />}
      >
        {/* Balance Card - only for employees */}
        {!isManager && balance && (
          <View style={[styles.balanceCard, { backgroundColor: colors.primary }]}>
            <Text style={styles.balanceTitle}>موجودی مرخصی</Text>
            <View style={styles.balanceRow}>
              <View style={styles.balanceItem}>
                <Text style={styles.balanceValue}>{balance.remainingDays.toFixed(1)}</Text>
                <Text style={styles.balanceLabel}>مانده</Text>
              </View>
              <View style={[styles.balanceDivider, { backgroundColor: 'rgba(255,255,255,0.3)' }]} />
              <View style={styles.balanceItem}>
                <Text style={styles.balanceValue}>{balance.usedDays.toFixed(1)}</Text>
                <Text style={styles.balanceLabel}>استفاده شده</Text>
              </View>
              <View style={[styles.balanceDivider, { backgroundColor: 'rgba(255,255,255,0.3)' }]} />
              <View style={styles.balanceItem}>
                <Text style={styles.balanceValue}>{balance.totalDays}</Text>
                <Text style={styles.balanceLabel}>کل</Text>
              </View>
            </View>
          </View>
        )}

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            {isManager ? 'درخواست‌های مرخصی' : 'درخواست‌های من'}
          </Text>
        </View>

        {isLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : requests?.length === 0 ? (
          <View style={styles.empty}>
            <Feather name="calendar" size={48} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              هیچ درخواست مرخصی‌ای وجود ندارد
            </Text>
          </View>
        ) : (
          requests?.map((leave) => (
            <LeaveCard
              key={leave.id}
              leave={leave}
              isManager={isManager}
              onApprove={() => handleApprove(leave.id)}
              onReject={() => handleReject(leave.id)}
            />
          ))
        )}
      </ScrollView>

      {/* FAB for employees */}
      {!isManager && (
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: colors.primary, bottom: bottomPad + 16 }]}
          onPress={() => setShowModal(true)}
          activeOpacity={0.8}
        >
          <Feather name="plus" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      )}

      {/* Create Leave Modal */}
      <Modal visible={showModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Feather name="x" size={22} color={colors.foreground} />
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>
                درخواست مرخصی
              </Text>
            </View>

            <Text style={[styles.fieldLabel, { color: colors.foreground }]}>نوع مرخصی</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeScroll}>
              <View style={styles.typeRow}>
                {LEAVE_TYPES.map((t) => (
                  <TouchableOpacity
                    key={t.key}
                    style={[
                      styles.typeChip,
                      {
                        backgroundColor: leaveType === t.key ? colors.primary : colors.background,
                        borderColor: leaveType === t.key ? colors.primary : colors.border,
                      },
                    ]}
                    onPress={() => setLeaveType(t.key)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.typeChipText, { color: leaveType === t.key ? '#FFFFFF' : colors.foreground }]}>
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <Text style={[styles.fieldLabel, { color: colors.foreground }]}>تاریخ شروع (YYYY-MM-DD)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
              value={startDate}
              onChangeText={setStartDate}
              placeholder="مثال: 1403-01-15"
              placeholderTextColor={colors.mutedForeground}
              textAlign="right"
            />

            <Text style={[styles.fieldLabel, { color: colors.foreground }]}>تاریخ پایان (اختیاری)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
              value={endDate}
              onChangeText={setEndDate}
              placeholder="مثال: 1403-01-20"
              placeholderTextColor={colors.mutedForeground}
              textAlign="right"
            />

            <Text style={[styles.fieldLabel, { color: colors.foreground }]}>دلیل</Text>
            <TextInput
              style={[styles.inputMulti, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
              value={reason}
              onChangeText={setReason}
              placeholder="توضیح دهید..."
              placeholderTextColor={colors.mutedForeground}
              multiline
              numberOfLines={3}
              textAlign="right"
              textAlignVertical="top"
            />

            <TouchableOpacity
              style={[styles.submitBtn, { backgroundColor: colors.primary }]}
              onPress={handleSubmit}
              disabled={createMutation.isPending}
              activeOpacity={0.8}
            >
              {createMutation.isPending ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitBtnText}>ثبت درخواست</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  balanceCard: {
    margin: 16,
    borderRadius: 20,
    padding: 20,
    ...(Platform.OS === 'web' ? { marginTop: 16 } : {}),
  },
  balanceTitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    textAlign: 'right',
    marginBottom: 16,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  balanceItem: { alignItems: 'center', gap: 4 },
  balanceDivider: { width: 1, marginVertical: 4 },
  balanceValue: { color: '#FFFFFF', fontSize: 24, fontFamily: 'Inter_700Bold' },
  balanceLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontFamily: 'Inter_400Regular' },
  sectionHeader: { paddingHorizontal: 16, paddingBottom: 8 },
  sectionTitle: { fontSize: 16, fontFamily: 'Inter_700Bold', textAlign: 'right' },
  leaveCard: {
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    gap: 8,
  },
  leaveCardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  leaveCardRight: { alignItems: 'flex-end', flex: 1, gap: 3 },
  leaveUser: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  leaveType: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  leaveDates: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  leaveReason: { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'right' },
  noteBox: { borderRadius: 8, padding: 8 },
  noteText: { fontSize: 12, fontFamily: 'Inter_400Regular', textAlign: 'right' },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    gap: 6,
  },
  actionBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  fab: {
    position: 'absolute',
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  loading: { padding: 40, alignItems: 'center' },
  empty: { padding: 40, alignItems: 'center', gap: 12 },
  emptyText: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  fieldLabel: { fontSize: 13, fontFamily: 'Inter_600SemiBold', textAlign: 'right', marginBottom: 8 },
  typeScroll: { marginBottom: 14 },
  typeRow: { flexDirection: 'row', gap: 8 },
  typeChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  typeChipText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  input: {
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    marginBottom: 14,
  },
  inputMulti: {
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    marginBottom: 16,
    minHeight: 80,
  },
  submitBtn: {
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  submitBtnText: { color: '#FFFFFF', fontSize: 16, fontFamily: 'Inter_700Bold' },
});
