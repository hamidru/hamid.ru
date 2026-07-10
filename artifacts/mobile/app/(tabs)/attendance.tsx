import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import {
  useGetTodayAttendance,
  useCheckIn,
  useCheckOut,
  useListAttendance,
  getGetTodayAttendanceQueryKey,
  getListAttendanceQueryKey,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';

function formatTime(iso: string | null | undefined): string {
  if (!iso) return '---';
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function formatWorkHours(hours: number | null | undefined): string {
  if (hours == null) return '---';
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}ساعت ${m}دقیقه`;
}

export default function AttendanceScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [locationLoading, setLocationLoading] = useState(false);

  const { data: todayRecord, isLoading: todayLoading, refetch: refetchToday } =
    useGetTodayAttendance({ query: { enabled: !!user } });

  const currentMonth = new Date().toISOString().slice(0, 7);
  const { data: history, isLoading: historyLoading, refetch: refetchHistory } =
    useListAttendance({ month: currentMonth }, { query: { enabled: !!user } });

  const checkInMutation = useCheckIn({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetTodayAttendanceQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListAttendanceQueryKey() });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      },
    },
  });

  const checkOutMutation = useCheckOut({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetTodayAttendanceQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListAttendanceQueryKey() });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      },
    },
  });

  const handleCheckIn = async () => {
    setLocationLoading(true);
    try {
      let lat = 35.6892;
      let lng = 51.389;

      if (Platform.OS !== 'web') {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
          });
          lat = loc.coords.latitude;
          lng = loc.coords.longitude;
        }
      } else {
        await new Promise<void>((resolve) => {
          navigator.geolocation?.getCurrentPosition(
            (pos) => {
              lat = pos.coords.latitude;
              lng = pos.coords.longitude;
              resolve();
            },
            () => resolve(),
          );
        });
      }

      await checkInMutation.mutateAsync({
        data: { latitude: lat, longitude: lng, deviceInfo: Platform.OS },
      });
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'خطا در ثبت ورود';
      Alert.alert('خطا', msg);
    } finally {
      setLocationLoading(false);
    }
  };

  const handleCheckOut = async () => {
    setLocationLoading(true);
    try {
      let lat = 35.6892;
      let lng = 51.389;

      if (Platform.OS !== 'web') {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
          });
          lat = loc.coords.latitude;
          lng = loc.coords.longitude;
        }
      }

      await checkOutMutation.mutateAsync({ data: { latitude: lat, longitude: lng } });
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'خطا در ثبت خروج';
      Alert.alert('خطا', msg);
    } finally {
      setLocationLoading(false);
    }
  };

  const bottomPad = insets.bottom + 68 + (Platform.OS === 'web' ? 34 : 0);
  const hasCheckedIn = !!todayRecord?.checkInTime;
  const hasCheckedOut = !!todayRecord?.checkOutTime;
  const isActionLoading = locationLoading || checkInMutation.isPending || checkOutMutation.isPending;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: bottomPad }}
      refreshControl={
        <RefreshControl
          refreshing={todayLoading || historyLoading}
          onRefresh={() => { refetchToday(); refetchHistory(); }}
        />
      }
    >
      {/* Today's Status Card */}
      <View style={[styles.statusCard, { backgroundColor: colors.primary }]}>
        <Text style={styles.statusCardTitle}>وضعیت امروز</Text>
        <View style={styles.statusTimes}>
          <View style={styles.timeBox}>
            <Feather name="log-in" size={20} color="rgba(255,255,255,0.8)" />
            <Text style={styles.timeLabel}>ورود</Text>
            <Text style={styles.timeValue}>{formatTime(todayRecord?.checkInTime)}</Text>
            {todayRecord?.isLate && (
              <View style={styles.lateBadge}>
                <Text style={styles.lateBadgeText}>تأخیر</Text>
              </View>
            )}
          </View>
          <View style={[styles.timeDivider, { backgroundColor: 'rgba(255,255,255,0.3)' }]} />
          <View style={styles.timeBox}>
            <Feather name="log-out" size={20} color="rgba(255,255,255,0.8)" />
            <Text style={styles.timeLabel}>خروج</Text>
            <Text style={styles.timeValue}>{formatTime(todayRecord?.checkOutTime)}</Text>
            {todayRecord?.isEarlyLeave && (
              <View style={styles.earlyBadge}>
                <Text style={styles.lateBadgeText}>تعجیل</Text>
              </View>
            )}
          </View>
          <View style={[styles.timeDivider, { backgroundColor: 'rgba(255,255,255,0.3)' }]} />
          <View style={styles.timeBox}>
            <Feather name="clock" size={20} color="rgba(255,255,255,0.8)" />
            <Text style={styles.timeLabel}>کارکرد</Text>
            <Text style={styles.timeValue}>
              {formatWorkHours(todayRecord?.workHours)}
            </Text>
          </View>
        </View>
      </View>

      {/* Action Button */}
      <View style={styles.actionContainer}>
        {!hasCheckedIn ? (
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.success }]}
            onPress={handleCheckIn}
            disabled={isActionLoading}
            activeOpacity={0.8}
          >
            {isActionLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Feather name="log-in" size={28} color="#FFFFFF" />
                <Text style={styles.actionButtonText}>ثبت ورود</Text>
              </>
            )}
          </TouchableOpacity>
        ) : !hasCheckedOut ? (
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.destructive }]}
            onPress={handleCheckOut}
            disabled={isActionLoading}
            activeOpacity={0.8}
          >
            {isActionLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Feather name="log-out" size={28} color="#FFFFFF" />
                <Text style={styles.actionButtonText}>ثبت خروج</Text>
              </>
            )}
          </TouchableOpacity>
        ) : (
          <View style={[styles.doneBox, { backgroundColor: colors.success + '15', borderColor: colors.success }]}>
            <Feather name="check-circle" size={32} color={colors.success} />
            <Text style={[styles.doneText, { color: colors.success }]}>
              ورود و خروج امروز ثبت شد
            </Text>
          </View>
        )}

        {todayRecord?.checkInLat != null && (
          <View style={[styles.locationInfo, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="map-pin" size={14} color={colors.accent} />
            <Text style={[styles.locationText, { color: colors.mutedForeground }]}>
              {todayRecord.checkInLat.toFixed(4)}, {todayRecord.checkInLng?.toFixed(4)}
            </Text>
          </View>
        )}
      </View>

      {/* History */}
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
          سابقه این ماه
        </Text>
      </View>

      {history?.map((record) => {
        const wh = record.workHours;
        return (
          <View
            key={record.id || record.date}
            style={[styles.historyRow, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <View style={styles.historyLeft}>
              {record.isLate && (
                <View style={[styles.historyBadge, { backgroundColor: colors.warning + '20' }]}>
                  <Text style={[styles.historyBadgeText, { color: colors.warning }]}>تأخیر</Text>
                </View>
              )}
            </View>
            <View style={styles.historyRight}>
              <Text style={[styles.historyDate, { color: colors.foreground }]}>
                {record.date}
              </Text>
              <View style={styles.historyTimes}>
                <Text style={[styles.historyTime, { color: colors.mutedForeground }]}>
                  خروج: {formatTime(record.checkOutTime)}
                </Text>
                <Text style={[styles.historyTime, { color: colors.mutedForeground }]}>
                  ورود: {formatTime(record.checkInTime)}
                </Text>
              </View>
              {wh != null && (
                <Text style={[styles.historyWork, { color: colors.accent }]}>
                  کارکرد: {formatWorkHours(wh)}
                </Text>
              )}
            </View>
          </View>
        );
      })}

      {(!history || history.length === 0) && !historyLoading && (
        <View style={styles.empty}>
          <Feather name="calendar" size={40} color={colors.mutedForeground} />
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            سابقه‌ای برای این ماه یافت نشد
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  statusCard: {
    margin: 16,
    borderRadius: 20,
    padding: 20,
    ...(Platform.OS === 'web' ? { marginTop: 16 } : {}),
  },
  statusCardTitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    textAlign: 'right',
    marginBottom: 16,
  },
  statusTimes: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  timeBox: {
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  timeLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  timeValue: {
    color: '#FFFFFF',
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
  },
  timeDivider: {
    width: 1,
    marginVertical: 8,
  },
  lateBadge: {
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  earlyBadge: {
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  lateBadgeText: {
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
    color: '#EF4444',
  },
  actionContainer: {
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 12,
  },
  actionButton: {
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
  },
  doneBox: {
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row-reverse',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1.5,
  },
  doneText: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
  locationInfo: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    gap: 6,
  },
  locationText: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    textAlign: 'right',
  },
  historyRow: {
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  historyLeft: { alignItems: 'flex-start', gap: 4 },
  historyRight: { alignItems: 'flex-end', gap: 4 },
  historyDate: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  historyTimes: {
    flexDirection: 'row',
    gap: 16,
  },
  historyTime: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  historyWork: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
  historyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  historyBadgeText: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
  },
  empty: {
    padding: 40,
    alignItems: 'center',
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
});
