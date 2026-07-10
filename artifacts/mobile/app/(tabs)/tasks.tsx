import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import { useListTasks } from '@workspace/api-client-react';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { Task } from '@workspace/api-client-react';

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
  low: 'پایین',
  medium: 'متوسط',
  high: 'بالا',
  urgent: 'فوری',
};

const STATUS_FILTERS = [
  { key: '', label: 'همه' },
  { key: 'sent', label: 'ارسال شده' },
  { key: 'in_progress', label: 'در انجام' },
  { key: 'in_review', label: 'بررسی' },
  { key: 'done', label: 'انجام شد' },
  { key: 'approved', label: 'تایید' },
];

function getPriorityColor(priority: string, colors: ReturnType<typeof useColors>) {
  switch (priority) {
    case 'urgent': return colors.destructive;
    case 'high': return colors.warning;
    case 'medium': return colors.secondary;
    default: return colors.mutedForeground;
  }
}

function getStatusColor(status: string, colors: ReturnType<typeof useColors>) {
  const map: Record<string, string> = {
    new: colors.statusNew,
    sent: colors.statusSent,
    received: colors.statusReceived,
    in_progress: colors.statusInProgress,
    in_review: colors.statusInReview,
    revision: colors.statusRevision,
    done: colors.statusDone,
    approved: colors.statusApproved,
    closed: colors.statusClosed,
  };
  return map[status] ?? colors.mutedForeground;
}

function TaskCard({ task, onPress }: { task: Task; onPress: () => void }) {
  const colors = useColors();
  const statusColor = getStatusColor(task.status, colors);
  const priorityColor = getPriorityColor(task.priority, colors);
  const progress =
    task.checklistTotal > 0 ? task.checklistDone / task.checklistTotal : 0;

  return (
    <TouchableOpacity
      style={[styles.taskCard, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={styles.taskCardTop}>
        <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
          <Text style={[styles.statusText, { color: statusColor }]}>
            {STATUS_LABELS[task.status] ?? task.status}
          </Text>
        </View>
        <Text style={[styles.taskTitle, { color: colors.foreground }]} numberOfLines={2}>
          {task.title}
        </Text>
      </View>

      <View style={styles.taskMeta}>
        <View style={styles.metaLeft}>
          {task.deadline && (
            <View style={styles.metaItem}>
              <Feather name="calendar" size={12} color={colors.mutedForeground} />
              <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                {task.deadline}
              </Text>
            </View>
          )}
          {task.messageCount > 0 && (
            <View style={styles.metaItem}>
              <Feather name="message-square" size={12} color={colors.mutedForeground} />
              <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                {task.messageCount}
              </Text>
            </View>
          )}
        </View>
        <View style={styles.metaRight}>
          <View style={[styles.priorityDot, { backgroundColor: priorityColor }]} />
          <Text style={[styles.priorityText, { color: priorityColor }]}>
            {PRIORITY_LABELS[task.priority] ?? task.priority}
          </Text>
        </View>
      </View>

      {task.checklistTotal > 0 && (
        <View style={styles.progressContainer}>
          <View style={[styles.progressBar, { backgroundColor: colors.muted }]}>
            <View
              style={[
                styles.progressFill,
                { width: `${progress * 100}%` as never, backgroundColor: colors.success },
              ]}
            />
          </View>
          <Text style={[styles.progressText, { color: colors.mutedForeground }]}>
            {task.checklistDone}/{task.checklistTotal}
          </Text>
        </View>
      )}

      {task.assignees.length > 0 && (
        <View style={styles.assignees}>
          <Text style={[styles.assigneeText, { color: colors.mutedForeground }]}>
            {task.assignees.map((a) => a.fullName).join('، ')}
          </Text>
          <Feather name="users" size={12} color={colors.mutedForeground} />
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function TasksScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [statusFilter, setStatusFilter] = useState('');

  const { data: tasks, isLoading, refetch, isFetching } = useListTasks(
    statusFilter ? { status: statusFilter } : undefined,
    { query: { enabled: !!user } },
  );

  const isManager = ['admin', 'special_manager', 'manager'].includes(user?.role ?? '');
  const bottomPad = insets.bottom + 68 + (Platform.OS === 'web' ? 34 : 0);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Filters */}
      <View style={[styles.filtersContainer, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <FlatList
          horizontal
          data={STATUS_FILTERS}
          keyExtractor={(item) => item.key}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.filterChip,
                {
                  backgroundColor:
                    statusFilter === item.key ? colors.primary : colors.background,
                  borderColor:
                    statusFilter === item.key ? colors.primary : colors.border,
                },
              ]}
              onPress={() => setStatusFilter(item.key)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.filterText,
                  {
                    color:
                      statusFilter === item.key
                        ? colors.primaryForeground
                        : colors.foreground,
                  },
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          )}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersList}
        />
      </View>

      <FlatList
        data={tasks ?? []}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <TaskCard
            task={item}
            onPress={() => router.push(`/task/${item.id}` as never)}
          />
        )}
        refreshControl={
          <RefreshControl refreshing={isFetching} onRefresh={refetch} />
        }
        contentContainerStyle={[
          styles.list,
          { paddingBottom: bottomPad },
          !(tasks?.length) && styles.emptyList,
        ]}
        scrollEnabled={!!(tasks?.length)}
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.empty}>
              <View style={[styles.skeletonCard, { backgroundColor: colors.muted }]} />
              <View style={[styles.skeletonCard, { backgroundColor: colors.muted }]} />
              <View style={[styles.skeletonCard, { backgroundColor: colors.muted }]} />
            </View>
          ) : (
            <View style={styles.empty}>
              <Feather name="check-square" size={48} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                هیچ وظیفه‌ای یافت نشد
              </Text>
            </View>
          )
        }
      />

      {isManager && (
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: colors.primary, bottom: bottomPad + 16 }]}
          onPress={() => router.push('/task/create')}
          activeOpacity={0.8}
        >
          <Feather name="plus" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  filtersContainer: {
    borderBottomWidth: 1,
    paddingVertical: 8,
    ...(Platform.OS === 'web' ? { paddingTop: 8 } : {}),
  },
  filtersList: { paddingHorizontal: 16, gap: 8 },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
  list: { padding: 16, gap: 10 },
  emptyList: { flex: 1 },
  taskCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
    gap: 10,
  },
  taskCardTop: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    gap: 10,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
  },
  taskTitle: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    textAlign: 'right',
    lineHeight: 22,
  },
  taskMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaLeft: {
    flexDirection: 'row',
    gap: 12,
  },
  metaRight: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 5,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  priorityDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  priorityText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
  progressContainer: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  progressBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    minWidth: 30,
    textAlign: 'right',
  },
  assignees: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
  },
  assigneeText: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    textAlign: 'right',
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    paddingTop: 80,
  },
  emptyText: {
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
  },
  skeletonCard: {
    width: '100%',
    height: 100,
    borderRadius: 16,
    marginBottom: 10,
  },
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
});
