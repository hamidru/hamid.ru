import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import {
  useGetTask,
  useGetTaskMessages,
  useSendTaskMessage,
  useUpdateTaskStatus,
  getGetTaskQueryKey,
  getGetTaskMessagesQueryKey,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import type { TaskMessage } from '@workspace/api-client-react';

const STATUS_LABELS: Record<string, string> = {
  new: 'جدید',
  sent: 'ارسال شده',
  received: 'تحویل گرفته شد',
  in_progress: 'در حال انجام',
  in_review: 'در حال بررسی',
  revision: 'اصلاحیه',
  done: 'انجام شد',
  approved: 'تایید مدیر',
  closed: 'بسته شد',
};

const PRIORITY_LABELS: Record<string, string> = {
  low: 'پایین', medium: 'متوسط', high: 'بالا', urgent: 'فوری',
};

function getStatusColor(status: string, colors: ReturnType<typeof useColors>) {
  const map: Record<string, string> = {
    new: colors.statusNew, sent: colors.statusSent, received: colors.statusReceived,
    in_progress: colors.statusInProgress, in_review: colors.statusInReview,
    revision: colors.statusRevision, done: colors.statusDone,
    approved: colors.statusApproved, closed: colors.statusClosed,
  };
  return map[status] ?? colors.mutedForeground;
}

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return 'همین الان';
  if (diff < 3600) return `${Math.floor(diff / 60)} دقیقه پیش`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ساعت پیش`;
  return new Date(iso).toLocaleDateString('fa-IR');
}

function MessageBubble({ message, isOwn, colors }: {
  message: TaskMessage;
  isOwn: boolean;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={[styles.bubbleRow, isOwn ? styles.bubbleRowOwn : styles.bubbleRowOther]}>
      {!isOwn && (
        <View style={[styles.bubbleAvatar, { backgroundColor: colors.primary + '30' }]}>
          <Text style={{ fontSize: 12, color: colors.primary, fontFamily: 'Inter_600SemiBold' }}>
            {message.senderName.charAt(0)}
          </Text>
        </View>
      )}
      <View style={[
        styles.bubble,
        {
          backgroundColor: isOwn ? colors.primary : colors.card,
          borderColor: colors.border,
          alignSelf: isOwn ? 'flex-end' : 'flex-start',
        },
      ]}>
        {!isOwn && (
          <Text style={[styles.bubbleSender, { color: colors.accent }]}>
            {message.senderName}
          </Text>
        )}
        <Text style={[styles.bubbleText, { color: isOwn ? '#FFFFFF' : colors.foreground }]}>
          {message.content}
        </Text>
        <Text style={[styles.bubbleTime, { color: isOwn ? 'rgba(255,255,255,0.6)' : colors.mutedForeground }]}>
          {timeAgo(message.createdAt)}
        </Text>
      </View>
    </View>
  );
}

export default function TaskDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const taskId = parseInt(id!, 10);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [messageText, setMessageText] = useState('');
  const [showStatusModal, setShowStatusModal] = useState(false);

  const { data: task, isLoading: taskLoading } = useGetTask(taskId, {
    query: { enabled: !!taskId },
  });
  const { data: messages, isLoading: msgsLoading } = useGetTaskMessages(taskId, {
    query: { enabled: !!taskId },
  });

  const sendMutation = useSendTaskMessage({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetTaskMessagesQueryKey(taskId) });
        setMessageText('');
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      },
    },
  });

  const updateStatusMutation = useUpdateTaskStatus({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetTaskQueryKey(taskId) });
        setShowStatusModal(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      },
    },
  });

  const handleSend = () => {
    if (!messageText.trim()) return;
    sendMutation.mutate({ id: taskId, data: { content: messageText.trim() } as never });
  };

  const handleStatusChange = (status: string) => {
    updateStatusMutation.mutate({ id: taskId, data: { status: status as never } as never });
  };

  const isManager = ['admin', 'special_manager', 'manager'].includes(user?.role ?? '');
  const isAssigned = task?.assignees.some((a) => a.id === user?.id);

  // Available status transitions per role
  const availableStatuses = isManager
    ? ['sent', 'revision', 'approved', 'closed']
    : ['received', 'in_progress', 'in_review', 'done'];

  if (taskLoading) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (!task) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.foreground, fontFamily: 'Inter_400Regular' }}>وظیفه یافت نشد</Text>
      </View>
    );
  }

  const statusColor = getStatusColor(task.status, colors);
  const bottomPad = insets.bottom + (Platform.OS === 'web' ? 34 : 0);

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'web' ? 0 : 64}
    >
      {/* Task Info Header */}
      <ScrollView style={styles.infoScroll} contentContainerStyle={{ paddingBottom: 8 }}>
        <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.infoTopRow}>
            <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
              <Text style={[styles.statusText, { color: statusColor }]}>
                {STATUS_LABELS[task.status] ?? task.status}
              </Text>
            </View>
            <Text style={[styles.taskTitle, { color: colors.foreground }]}>
              {task.title}
            </Text>
          </View>

          {task.description && (
            <Text style={[styles.taskDesc, { color: colors.mutedForeground }]}>
              {task.description}
            </Text>
          )}

          <View style={styles.metaGrid}>
            {task.priority && (
              <View style={styles.metaItem}>
                <Text style={[styles.metaValue, { color: colors.foreground }]}>
                  {PRIORITY_LABELS[task.priority] ?? task.priority}
                </Text>
                <Text style={[styles.metaLabel, { color: colors.mutedForeground }]}>اولویت</Text>
              </View>
            )}
            {task.deadline && (
              <View style={styles.metaItem}>
                <Text style={[styles.metaValue, { color: colors.foreground }]}>{task.deadline}</Text>
                <Text style={[styles.metaLabel, { color: colors.mutedForeground }]}>مهلت</Text>
              </View>
            )}
            {task.project && (
              <View style={styles.metaItem}>
                <Text style={[styles.metaValue, { color: colors.foreground }]}>{task.project}</Text>
                <Text style={[styles.metaLabel, { color: colors.mutedForeground }]}>پروژه</Text>
              </View>
            )}
          </View>

          {task.assignees.length > 0 && (
            <View style={styles.assigneesRow}>
              <Feather name="users" size={14} color={colors.mutedForeground} />
              <Text style={[styles.assigneesText, { color: colors.mutedForeground }]}>
                {task.assignees.map((a) => a.fullName).join('، ')}
              </Text>
            </View>
          )}
        </View>

        {/* Status Actions */}
        {(isManager || isAssigned) && !['closed'].includes(task.status) && (
          <TouchableOpacity
            style={[styles.changeStatusBtn, { backgroundColor: colors.primary }]}
            onPress={() => setShowStatusModal(true)}
            activeOpacity={0.8}
          >
            <Feather name="refresh-cw" size={16} color="#FFFFFF" />
            <Text style={styles.changeStatusBtnText}>تغییر وضعیت</Text>
          </TouchableOpacity>
        )}

        {/* Checklist */}
        {'checklist' in task && (task as never as { checklist: { id: number; text: string; isDone: boolean }[] }).checklist?.length > 0 && (
          <View style={[styles.checklistCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.checklistTitle, { color: colors.foreground }]}>چک‌لیست</Text>
            {(task as never as { checklist: { id: number; text: string; isDone: boolean }[] }).checklist.map((item) => (
              <View key={item.id} style={styles.checklistItem}>
                <Feather
                  name={item.isDone ? 'check-circle' : 'circle'}
                  size={16}
                  color={item.isDone ? colors.success : colors.mutedForeground}
                />
                <Text style={[styles.checklistText, { color: item.isDone ? colors.mutedForeground : colors.foreground, textDecorationLine: item.isDone ? 'line-through' : 'none' }]}>
                  {item.text}
                </Text>
              </View>
            ))}
          </View>
        )}

        <Text style={[styles.messagesTitle, { color: colors.foreground }]}>
          گفتگو ({messages?.length ?? 0})
        </Text>
      </ScrollView>

      {/* Messages */}
      <FlatList
        data={messages ?? []}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <MessageBubble
            message={item}
            isOwn={item.senderId === user?.id}
            colors={colors}
          />
        )}
        contentContainerStyle={styles.messagesList}
        style={styles.messagesContainer}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          msgsLoading ? null : (
            <View style={styles.emptyMessages}>
              <Text style={[styles.emptyMessagesText, { color: colors.mutedForeground }]}>
                هنوز پیامی ارسال نشده
              </Text>
            </View>
          )
        }
      />

      {/* Message Input */}
      <View style={[styles.inputBar, {
        backgroundColor: colors.card,
        borderTopColor: colors.border,
        paddingBottom: bottomPad + 8,
      }]}>
        <TouchableOpacity
          style={[styles.sendBtn, { backgroundColor: colors.primary }]}
          onPress={handleSend}
          disabled={sendMutation.isPending || !messageText.trim()}
          activeOpacity={0.8}
        >
          {sendMutation.isPending ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Feather name="send" size={18} color="#FFFFFF" />
          )}
        </TouchableOpacity>
        <TextInput
          style={[styles.messageInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
          value={messageText}
          onChangeText={setMessageText}
          placeholder="پیام بنویسید..."
          placeholderTextColor={colors.mutedForeground}
          textAlign="right"
          multiline
          maxLength={500}
          onSubmitEditing={handleSend}
          returnKeyType="send"
        />
      </View>

      {/* Status Modal */}
      <Modal visible={showStatusModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>تغییر وضعیت</Text>
            {availableStatuses.map((s) => (
              <TouchableOpacity
                key={s}
                style={[styles.statusOption, {
                  backgroundColor: task.status === s ? colors.primary + '15' : colors.background,
                  borderColor: task.status === s ? colors.primary : colors.border,
                }]}
                onPress={() => handleStatusChange(s)}
                activeOpacity={0.7}
              >
                {updateStatusMutation.isPending ? (
                  <ActivityIndicator color={colors.primary} size="small" />
                ) : (
                  <Text style={[styles.statusOptionText, { color: task.status === s ? colors.primary : colors.foreground }]}>
                    {STATUS_LABELS[s] ?? s}
                  </Text>
                )}
              </TouchableOpacity>
            ))}
            <TouchableOpacity onPress={() => setShowStatusModal(false)} style={styles.cancelBtn}>
              <Text style={[styles.cancelBtnText, { color: colors.mutedForeground }]}>لغو</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  infoScroll: { maxHeight: 320 },
  infoCard: {
    margin: 12,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    gap: 10,
  },
  infoTopRow: { flexDirection: 'row-reverse', alignItems: 'flex-start', gap: 10 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  taskTitle: { flex: 1, fontSize: 16, fontFamily: 'Inter_700Bold', textAlign: 'right', lineHeight: 24 },
  taskDesc: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'right', lineHeight: 22 },
  metaGrid: { flexDirection: 'row-reverse', gap: 16 },
  metaItem: { alignItems: 'center', gap: 2 },
  metaLabel: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  metaValue: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  assigneesRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6 },
  assigneesText: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  changeStatusBtn: {
    marginHorizontal: 12,
    marginBottom: 10,
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  changeStatusBtnText: { color: '#FFFFFF', fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  checklistCard: {
    marginHorizontal: 12,
    marginBottom: 10,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    gap: 8,
  },
  checklistTitle: { fontSize: 14, fontFamily: 'Inter_600SemiBold', textAlign: 'right', marginBottom: 4 },
  checklistItem: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8 },
  checklistText: { flex: 1, fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'right' },
  messagesTitle: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    textAlign: 'right',
  },
  messagesContainer: { flex: 1 },
  messagesList: { paddingHorizontal: 12, paddingBottom: 8, gap: 8 },
  bubbleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  bubbleRowOwn: { flexDirection: 'row-reverse' },
  bubbleRowOther: {},
  bubbleAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bubble: {
    maxWidth: '78%',
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    gap: 4,
  },
  bubbleSender: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  bubbleText: { fontSize: 14, fontFamily: 'Inter_400Regular', lineHeight: 20 },
  bubbleTime: { fontSize: 10, fontFamily: 'Inter_400Regular', alignSelf: 'flex-end' },
  emptyMessages: { padding: 20, alignItems: 'center' },
  emptyMessagesText: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  inputBar: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    gap: 8,
  },
  messageInput: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    maxHeight: 100,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40, gap: 10 },
  modalTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', textAlign: 'right', marginBottom: 8 },
  statusOption: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'flex-end',
  },
  statusOptionText: { fontSize: 15, fontFamily: 'Inter_500Medium' },
  cancelBtn: { padding: 14, alignItems: 'center' },
  cancelBtnText: { fontSize: 15, fontFamily: 'Inter_500Medium' },
});
