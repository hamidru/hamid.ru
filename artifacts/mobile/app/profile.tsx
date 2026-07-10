import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';

const ROLE_LABELS: Record<string, string> = {
  admin: 'مدیر کل',
  special_manager: 'مدیر ویژه',
  manager: 'مدیر',
  hr: 'منابع انسانی',
  employee: 'کارمند',
};

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    Alert.alert(
      'خروج از سیستم',
      'آیا مطمئن هستید که می‌خواهید خارج شوید؟',
      [
        { text: 'لغو', style: 'cancel' },
        {
          text: 'خروج',
          style: 'destructive',
          onPress: async () => {
            await logout();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            router.replace('/');
          },
        },
      ],
    );
  };

  const bottomPad = insets.bottom + (Platform.OS === 'web' ? 34 : 0);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 24 }]}
    >
      {/* Avatar Card */}
      <View style={[styles.avatarCard, { backgroundColor: colors.primary }]}>
        <View style={[styles.avatar, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
          <Text style={styles.avatarText}>{user?.fullName?.charAt(0) ?? '?'}</Text>
        </View>
        <Text style={styles.userName}>{user?.fullName}</Text>
        <View style={[styles.roleBadge, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
          <Text style={styles.roleText}>{ROLE_LABELS[user?.role ?? ''] ?? user?.role}</Text>
        </View>
      </View>

      {/* Info Card */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.foreground }]}>اطلاعات کاربری</Text>

        <View style={[styles.infoRow, { borderBottomColor: colors.border }]}>
          <Text style={[styles.infoValue, { color: colors.foreground }]}>{user?.username}</Text>
          <View style={styles.infoLeft}>
            <Feather name="user" size={16} color={colors.primary} />
            <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>نام کاربری</Text>
          </View>
        </View>

        {user?.department && (
          <View style={[styles.infoRow, { borderBottomColor: colors.border }]}>
            <Text style={[styles.infoValue, { color: colors.foreground }]}>{user.department}</Text>
            <View style={styles.infoLeft}>
              <Feather name="briefcase" size={16} color={colors.primary} />
              <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>دپارتمان</Text>
            </View>
          </View>
        )}

        {user?.email && (
          <View style={[styles.infoRow, { borderBottomColor: colors.border }]}>
            <Text style={[styles.infoValue, { color: colors.foreground }]}>{user.email}</Text>
            <View style={styles.infoLeft}>
              <Feather name="mail" size={16} color={colors.primary} />
              <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>ایمیل</Text>
            </View>
          </View>
        )}

        {user?.phone && (
          <View style={styles.infoRow}>
            <Text style={[styles.infoValue, { color: colors.foreground }]}>{user.phone}</Text>
            <View style={styles.infoLeft}>
              <Feather name="phone" size={16} color={colors.primary} />
              <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>شماره تماس</Text>
            </View>
          </View>
        )}
      </View>

      {/* Quick Links */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.foreground }]}>دسترسی سریع</Text>

        <TouchableOpacity
          style={styles.linkRow}
          onPress={() => router.push('/(tabs)/attendance')}
          activeOpacity={0.7}
        >
          <Feather name="chevron-left" size={18} color={colors.mutedForeground} />
          <View style={styles.linkContent}>
            <Text style={[styles.linkText, { color: colors.foreground }]}>حضور و غیاب</Text>
            <View style={[styles.linkIcon, { backgroundColor: colors.primary + '15' }]}>
              <Feather name="clock" size={16} color={colors.primary} />
            </View>
          </View>
        </TouchableOpacity>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        <TouchableOpacity
          style={styles.linkRow}
          onPress={() => router.push('/(tabs)/leave')}
          activeOpacity={0.7}
        >
          <Feather name="chevron-left" size={18} color={colors.mutedForeground} />
          <View style={styles.linkContent}>
            <Text style={[styles.linkText, { color: colors.foreground }]}>مرخصی‌های من</Text>
            <View style={[styles.linkIcon, { backgroundColor: colors.accent + '15' }]}>
              <Feather name="calendar" size={16} color={colors.accent} />
            </View>
          </View>
        </TouchableOpacity>

        {user?.role === 'admin' && (
          <>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <TouchableOpacity
              style={styles.linkRow}
              onPress={() => router.push('/admin')}
              activeOpacity={0.7}
            >
              <Feather name="chevron-left" size={18} color={colors.mutedForeground} />
              <View style={styles.linkContent}>
                <Text style={[styles.linkText, { color: colors.foreground }]}>مدیریت کاربران</Text>
                <View style={[styles.linkIcon, { backgroundColor: colors.success + '15' }]}>
                  <Feather name="users" size={16} color={colors.success} />
                </View>
              </View>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Logout */}
      <TouchableOpacity
        style={[styles.logoutBtn, { backgroundColor: colors.destructive + '10', borderColor: colors.destructive }]}
        onPress={handleLogout}
        activeOpacity={0.7}
      >
        <Text style={[styles.logoutText, { color: colors.destructive }]}>خروج از سیستم</Text>
        <Feather name="log-out" size={18} color={colors.destructive} />
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 12 },
  avatarCard: {
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    gap: 10,
    ...(Platform.OS === 'web' ? { paddingTop: 24 } : {}),
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { color: '#FFFFFF', fontSize: 28, fontFamily: 'Inter_700Bold' },
  userName: { color: '#FFFFFF', fontSize: 20, fontFamily: 'Inter_700Bold' },
  roleBadge: { paddingHorizontal: 14, paddingVertical: 5, borderRadius: 20 },
  roleText: { color: '#FFFFFF', fontSize: 13, fontFamily: 'Inter_500Medium' },
  card: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    gap: 2,
  },
  cardTitle: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
    textAlign: 'right',
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  infoLeft: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6 },
  infoLabel: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  infoValue: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  linkContent: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10, flex: 1 },
  linkIcon: { width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  linkText: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  divider: { height: 1 },
  logoutBtn: {
    flexDirection: 'row-reverse',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    gap: 10,
    marginTop: 4,
  },
  logoutText: { fontSize: 16, fontFamily: 'Inter_700Bold' },
});
