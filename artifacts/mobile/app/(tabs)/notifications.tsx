import React from 'react';
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
import {
  useListNotifications,
  useMarkAllNotificationsRead,
  getListNotificationsQueryKey,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Feather } from '@expo/vector-icons';
import type { Notification } from '@workspace/api-client-react';
import * as Haptics from 'expo-haptics';

function getNotificationIcon(type: string): string {
  switch (type) {
    case 'task': return 'check-square';
    case 'leave': return 'calendar';
    case 'attendance': return 'clock';
    default: return 'bell';
  }
}

function getNotificationColor(type: string, colors: ReturnType<typeof useColors>) {
  switch (type) {
    case 'task': return colors.secondary;
    case 'leave': return colors.accent;
    case 'attendance': return colors.warning;
    default: return colors.primary;
  }
}

function timeAgo(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return 'همین الان';
  if (diff < 3600) return `${Math.floor(diff / 60)} دقیقه پیش`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ساعت پیش`;
  return `${Math.floor(diff / 86400)} روز پیش`;
}

function NotificationItem({ item, colors }: { item: Notification; colors: ReturnType<typeof useColors> }) {
  const icon = getNotificationIcon(item.type);
  const iconColor = getNotificationColor(item.type, colors);

  return (
    <View
      style={[
        styles.notifCard,
        {
          backgroundColor: item.isRead ? colors.card : colors.primary + '08',
          borderColor: item.isRead ? colors.border : colors.primary + '30',
        },
      ]}
    >
      <View style={styles.notifLeft}>
        <Text style={[styles.notifTime, { color: colors.mutedForeground }]}>
          {timeAgo(item.createdAt)}
        </Text>
        {!item.isRead && (
          <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />
        )}
      </View>
      <View style={styles.notifRight}>
        <View style={styles.notifHeader}>
          <Text style={[styles.notifTitle, { color: colors.foreground }]}>
            {item.title}
          </Text>
          <View style={[styles.notifIcon, { backgroundColor: iconColor + '15' }]}>
            <Feather name={icon as never} size={14} color={iconColor} />
          </View>
        </View>
        <Text style={[styles.notifBody, { color: colors.mutedForeground }]} numberOfLines={2}>
          {item.body}
        </Text>
      </View>
    </View>
  );
}

export default function NotificationsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: notifications, isLoading, refetch, isFetching } = useListNotifications({
    query: { enabled: !!user },
  });

  const markAllMutation = useMarkAllNotificationsRead({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey() });
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      },
    },
  });

  const unreadCount = notifications?.filter((n) => !n.isRead).length ?? 0;
  const bottomPad = insets.bottom + 68 + (Platform.OS === 'web' ? 34 : 0);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {unreadCount > 0 && (
        <View style={[styles.markAllBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <TouchableOpacity
            onPress={() => markAllMutation.mutate(undefined)}
            disabled={markAllMutation.isPending}
            activeOpacity={0.7}
          >
            <Text style={[styles.markAllText, { color: colors.primary }]}>
              علامت‌گذاری همه به عنوان خوانده شده ({unreadCount})
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={notifications ?? []}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <NotificationItem item={item} colors={colors} />
        )}
        refreshControl={
          <RefreshControl refreshing={isFetching} onRefresh={refetch} />
        }
        contentContainerStyle={[
          styles.list,
          { paddingBottom: bottomPad },
          !notifications?.length && styles.emptyList,
        ]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="bell-off" size={48} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              اعلانی وجود ندارد
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
              تمام اعلان‌های جدید اینجا نمایش داده می‌شوند
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  markAllBar: {
    padding: 14,
    borderBottomWidth: 1,
    alignItems: 'flex-end',
    ...(Platform.OS === 'web' ? { paddingTop: 14 } : {}),
  },
  markAllText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  list: { padding: 12, gap: 8 },
  emptyList: { flex: 1 },
  notifCard: {
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  notifLeft: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 4,
    gap: 6,
    minWidth: 60,
  },
  notifTime: { fontSize: 11, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  unreadDot: { width: 8, height: 8, borderRadius: 4 },
  notifRight: { flex: 1, gap: 4 },
  notifHeader: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'flex-start', gap: 8 },
  notifIcon: { width: 28, height: 28, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  notifTitle: { flex: 1, fontSize: 14, fontFamily: 'Inter_600SemiBold', textAlign: 'right' },
  notifBody: { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'right', lineHeight: 19 },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80,
    gap: 12,
  },
  emptyTitle: { fontSize: 18, fontFamily: 'Inter_600SemiBold' },
  emptySubtitle: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center', paddingHorizontal: 40 },
});
