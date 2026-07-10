import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import { useGetDashboard } from '@workspace/api-client-react';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: string;
  color: string;
  onPress?: () => void;
}

function StatCard({ title, value, icon, color, onPress }: StatCardProps) {
  const colors = useColors();
  return (
    <TouchableOpacity
      style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View style={[styles.statIcon, { backgroundColor: color + '20' }]}>
        <Feather name={icon as never} size={22} color={color} />
      </View>
      <Text style={[styles.statValue, { color: colors.foreground }]}>{value}</Text>
      <Text style={[styles.statTitle, { color: colors.mutedForeground }]}>{title}</Text>
    </TouchableOpacity>
  );
}

function getRoleLabel(role: string): string {
  const labels: Record<string, string> = {
    admin: 'مدیر کل',
    special_manager: 'مدیر ویژه',
    manager: 'مدیر',
    hr: 'منابع انسانی',
    employee: 'کارمند',
  };
  return labels[role] ?? role;
}

function formatTime(iso: string | null | undefined): string {
  if (!iso) return '---';
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function DashboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const { data, isLoading, refetch, isFetching } = useGetDashboard({
    query: { enabled: !!user },
  });

  const isManager = ['admin', 'special_manager', 'manager', 'hr'].includes(user?.role ?? '');

  const bottomPad = insets.bottom + 68 + (Platform.OS === 'web' ? 34 : 0);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]}
      refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} />}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.primary, paddingTop: Platform.OS === 'web' ? 67 : 0 }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.push('/profile')} activeOpacity={0.7}>
            <View style={[styles.avatar, { backgroundColor: colors.accent }]}>
              <Text style={styles.avatarText}>
                {user?.fullName?.charAt(0) ?? '?'}
              </Text>
            </View>
          </TouchableOpacity>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerGreeting}>خوش آمدید</Text>
            <Text style={styles.headerName}>{user?.fullName}</Text>
            <Text style={styles.headerRole}>{getRoleLabel(user?.role ?? '')}</Text>
          </View>
        </View>

        {/* Attendance status */}
        <View style={styles.attendanceRow}>
          <View style={styles.attendanceItem}>
            <Feather name="log-in" size={14} color="rgba(255,255,255,0.7)" />
            <Text style={styles.attendanceLabel}>ورود</Text>
            <Text style={styles.attendanceTime}>{formatTime(data?.myCheckIn)}</Text>
          </View>
          <View style={[styles.attendanceDivider, { backgroundColor: 'rgba(255,255,255,0.3)' }]} />
          <View style={styles.attendanceItem}>
            <Feather name="log-out" size={14} color="rgba(255,255,255,0.7)" />
            <Text style={styles.attendanceLabel}>خروج</Text>
            <Text style={styles.attendanceTime}>{formatTime(data?.myCheckOut)}</Text>
          </View>
        </View>
      </View>

      {/* Stats Grid */}
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>خلاصه</Text>
      </View>

      {isLoading ? (
        <View style={styles.loadingRow}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={[styles.statCardSkeleton, { backgroundColor: colors.muted }]} />
          ))}
        </View>
      ) : (
        <View style={styles.statsGrid}>
          <StatCard
            title="وظایف امروز"
            value={data?.todayTasks ?? 0}
            icon="file-text"
            color={colors.secondary}
            onPress={() => router.push('/(tabs)/tasks')}
          />
          <StatCard
            title="در انتظار"
            value={data?.pendingTasks ?? 0}
            icon="clock"
            color={colors.warning}
            onPress={() => router.push('/(tabs)/tasks')}
          />
          <StatCard
            title="عقب‌افتاده"
            value={data?.overdueTasks ?? 0}
            icon="alert-triangle"
            color={colors.destructive}
            onPress={() => router.push('/(tabs)/tasks')}
          />
          <StatCard
            title="تکمیل‌شده"
            value={data?.completedTasks ?? 0}
            icon="check-circle"
            color={colors.success}
            onPress={() => router.push('/(tabs)/tasks')}
          />
        </View>
      )}

      {isManager && (
        <>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>حضور و غیاب امروز</Text>
          </View>
          <View style={styles.statsGrid}>
            <StatCard
              title="حاضر"
              value={data?.presentToday ?? 0}
              icon="user-check"
              color={colors.success}
              onPress={() => router.push('/(tabs)/attendance')}
            />
            <StatCard
              title="غایب"
              value={data?.absentToday ?? 0}
              icon="user-x"
              color={colors.destructive}
              onPress={() => router.push('/(tabs)/attendance')}
            />
            <StatCard
              title="تأخیر"
              value={data?.todayLate ?? 0}
              icon="alert-circle"
              color={colors.warning}
              onPress={() => router.push('/(tabs)/attendance')}
            />
            <StatCard
              title="درخواست مرخصی"
              value={data?.pendingLeaves ?? 0}
              icon="calendar"
              color={colors.accent}
              onPress={() => router.push('/(tabs)/leave')}
            />
          </View>
        </>
      )}

      {/* Quick actions */}
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>دسترسی سریع</Text>
      </View>
      <View style={styles.quickActions}>
        <TouchableOpacity
          style={[styles.quickAction, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => router.push('/(tabs)/attendance')}
          activeOpacity={0.7}
        >
          <Feather name="clock" size={24} color={colors.primary} />
          <Text style={[styles.quickActionText, { color: colors.foreground }]}>حضور و غیاب</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.quickAction, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => router.push('/(tabs)/leave')}
          activeOpacity={0.7}
        >
          <Feather name="umbrella" size={24} color={colors.primary} />
          <Text style={[styles.quickActionText, { color: colors.foreground }]}>
            مرخصی ({data?.leaveBalance?.toFixed(1) ?? '...'} روز)
          </Text>
        </TouchableOpacity>
        {isManager && (
          <TouchableOpacity
            style={[styles.quickAction, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => router.push('/task/create')}
            activeOpacity={0.7}
          >
            <Feather name="plus-circle" size={24} color={colors.primary} />
            <Text style={[styles.quickActionText, { color: colors.foreground }]}>وظیفه جدید</Text>
          </TouchableOpacity>
        )}
        {user?.role === 'admin' && (
          <TouchableOpacity
            style={[styles.quickAction, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => router.push('/admin')}
            activeOpacity={0.7}
          >
            <Feather name="users" size={24} color={colors.primary} />
            <Text style={[styles.quickActionText, { color: colors.foreground }]}>مدیریت کاربران</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingBottom: 100 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingTop: 16,
    marginBottom: 16,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
  },
  headerTextContainer: {
    flex: 1,
    alignItems: 'flex-end',
    marginRight: 12,
  },
  headerGreeting: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    fontFamily: 'Inter_400Regular',
  },
  headerName: {
    fontSize: 18,
    color: '#FFFFFF',
    fontFamily: 'Inter_700Bold',
    marginTop: 2,
  },
  headerRole: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    fontFamily: 'Inter_400Regular',
    marginTop: 2,
  },
  attendanceRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
    padding: 12,
  },
  attendanceItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  attendanceDivider: {
    width: 1,
    marginVertical: 4,
  },
  attendanceLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    fontFamily: 'Inter_400Regular',
  },
  attendanceTime: {
    fontSize: 16,
    color: '#FFFFFF',
    fontFamily: 'Inter_700Bold',
  },
  sectionHeader: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    textAlign: 'right',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    gap: 8,
  },
  statCard: {
    width: '47%',
    marginHorizontal: '1.5%',
    borderRadius: 16,
    padding: 16,
    alignItems: 'flex-end',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statCardSkeleton: {
    width: '47%',
    marginHorizontal: '1.5%',
    height: 100,
    borderRadius: 16,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  statValue: {
    fontSize: 26,
    fontFamily: 'Inter_700Bold',
    marginBottom: 4,
  },
  statTitle: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    textAlign: 'right',
  },
  loadingRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    gap: 8,
  },
  quickActions: {
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 16,
  },
  quickAction: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  quickActionText: {
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
  },
});
