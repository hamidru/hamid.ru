import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import {
  useListUsers,
  useCreateUser,
  useUpdateUser,
  useDeleteUser,
  getListUsersQueryKey,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Feather } from '@expo/vector-icons';
import type { User } from '@workspace/api-client-react';
import { Redirect } from 'expo-router';
import * as Haptics from 'expo-haptics';

const ROLES = [
  { key: 'employee', label: 'کارمند' },
  { key: 'manager', label: 'مدیر' },
  { key: 'hr', label: 'منابع انسانی' },
  { key: 'special_manager', label: 'مدیر ویژه' },
  { key: 'admin', label: 'مدیر کل' },
];

const ROLE_LABELS: Record<string, string> = {
  employee: 'کارمند', manager: 'مدیر', hr: 'منابع انسانی',
  special_manager: 'مدیر ویژه', admin: 'مدیر کل',
};

function UserCard({ u, onEdit, onToggle }: { u: User; onEdit: () => void; onToggle: () => void }) {
  const colors = useColors();
  return (
    <View style={[styles.userCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.userCardLeft}>
        <TouchableOpacity onPress={onToggle} style={[styles.toggleBtn, { backgroundColor: u.isActive ? colors.success + '15' : colors.muted }]}>
          <Feather name={u.isActive ? 'toggle-right' : 'toggle-left'} size={20} color={u.isActive ? colors.success : colors.mutedForeground} />
        </TouchableOpacity>
        <TouchableOpacity onPress={onEdit} style={[styles.editBtn, { backgroundColor: colors.primary + '15' }]}>
          <Feather name="edit-2" size={16} color={colors.primary} />
        </TouchableOpacity>
      </View>
      <View style={styles.userCardRight}>
        <View style={styles.userCardTop}>
          <View style={[styles.roleBadge, { backgroundColor: colors.primary + '15' }]}>
            <Text style={[styles.roleBadgeText, { color: colors.primary }]}>
              {ROLE_LABELS[u.role] ?? u.role}
            </Text>
          </View>
          <Text style={[styles.userCardName, { color: u.isActive ? colors.foreground : colors.mutedForeground }]}>
            {u.fullName}
          </Text>
        </View>
        <Text style={[styles.userCardUsername, { color: colors.mutedForeground }]}>
          @{u.username}
          {u.department ? `  •  ${u.department}` : ''}
        </Text>
        {!u.isActive && (
          <Text style={[styles.inactiveText, { color: colors.destructive }]}>غیرفعال</Text>
        )}
      </View>
    </View>
  );
}

export default function AdminScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  if (user?.role !== 'admin') return <Redirect href="/(tabs)" />;

  const { data: users, isLoading, refetch, isFetching } = useListUsers({ query: { enabled: !!user } });

  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [form, setForm] = useState({
    username: '', password: '', fullName: '', role: 'employee', department: '',
  });

  const createMutation = useCreateUser({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
        setShowModal(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      },
      onError: (err: unknown) => {
        const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'خطا';
        Alert.alert('خطا', msg);
      },
    },
  });

  const updateMutation = useUpdateUser({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
        setShowModal(false);
        setEditUser(null);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      },
    },
  });

  const deleteMutation = useDeleteUser({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
      },
    },
  });

  const openCreate = () => {
    setEditUser(null);
    setForm({ username: '', password: '', fullName: '', role: 'employee', department: '' });
    setShowModal(true);
  };

  const openEdit = (u: User) => {
    setEditUser(u);
    setForm({ username: u.username, password: '', fullName: u.fullName, role: u.role, department: u.department ?? '' });
    setShowModal(true);
  };

  const handleSubmit = () => {
    if (!form.fullName) {
      Alert.alert('خطا', 'نام الزامی است');
      return;
    }
    if (editUser) {
      updateMutation.mutate({
        id: editUser.id,
        data: {
          fullName: form.fullName,
          role: form.role as never,
          department: form.department || undefined,
          password: form.password || undefined,
        } as never,
      });
    } else {
      if (!form.username || !form.password) {
        Alert.alert('خطا', 'نام کاربری و رمز عبور الزامی است');
        return;
      }
      createMutation.mutate({
        data: {
          username: form.username,
          password: form.password,
          fullName: form.fullName,
          role: form.role as never,
          department: form.department || undefined,
        } as never,
      });
    }
  };

  const handleToggle = (u: User) => {
    updateMutation.mutate({ id: u.id, data: { isActive: !u.isActive } as never });
  };

  const bottomPad = insets.bottom + (Platform.OS === 'web' ? 34 : 0);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={users ?? []}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <UserCard u={item} onEdit={() => openEdit(item)} onToggle={() => handleToggle(item)} />
        )}
        refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} />}
        contentContainerStyle={[styles.list, { paddingBottom: bottomPad + 80 }, !users?.length && styles.emptyList]}
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.loading}><ActivityIndicator color={colors.primary} /></View>
          ) : (
            <View style={styles.empty}>
              <Feather name="users" size={48} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>هیچ کاربری وجود ندارد</Text>
            </View>
          )
        }
      />

      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.primary, bottom: bottomPad + 16 }]}
        onPress={openCreate}
        activeOpacity={0.8}
      >
        <Feather name="user-plus" size={22} color="#FFFFFF" />
      </TouchableOpacity>

      <Modal visible={showModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Feather name="x" size={22} color={colors.foreground} />
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>
                {editUser ? 'ویرایش کاربر' : 'کاربر جدید'}
              </Text>
            </View>

            {!editUser && (
              <>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                  value={form.username}
                  onChangeText={(v) => setForm((f) => ({ ...f, username: v }))}
                  placeholder="نام کاربری"
                  placeholderTextColor={colors.mutedForeground}
                  textAlign="right"
                  autoCapitalize="none"
                />
                <TextInput
                  style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                  value={form.password}
                  onChangeText={(v) => setForm((f) => ({ ...f, password: v }))}
                  placeholder="رمز عبور"
                  placeholderTextColor={colors.mutedForeground}
                  textAlign="right"
                  secureTextEntry
                />
              </>
            )}

            {editUser && (
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                value={form.password}
                onChangeText={(v) => setForm((f) => ({ ...f, password: v }))}
                placeholder="رمز عبور جدید (اختیاری)"
                placeholderTextColor={colors.mutedForeground}
                textAlign="right"
                secureTextEntry
              />
            )}

            <TextInput
              style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
              value={form.fullName}
              onChangeText={(v) => setForm((f) => ({ ...f, fullName: v }))}
              placeholder="نام کامل"
              placeholderTextColor={colors.mutedForeground}
              textAlign="right"
            />

            <TextInput
              style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
              value={form.department}
              onChangeText={(v) => setForm((f) => ({ ...f, department: v }))}
              placeholder="دپارتمان (اختیاری)"
              placeholderTextColor={colors.mutedForeground}
              textAlign="right"
            />

            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.roleRow}>
                {ROLES.map((r) => (
                  <TouchableOpacity
                    key={r.key}
                    style={[styles.roleChip, {
                      backgroundColor: form.role === r.key ? colors.primary : colors.background,
                      borderColor: form.role === r.key ? colors.primary : colors.border,
                    }]}
                    onPress={() => setForm((f) => ({ ...f, role: r.key }))}
                  >
                    <Text style={[styles.roleChipText, { color: form.role === r.key ? '#FFFFFF' : colors.foreground }]}>
                      {r.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <TouchableOpacity
              style={[styles.submitBtn, { backgroundColor: colors.primary, marginTop: 16 }]}
              onPress={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
              activeOpacity={0.8}
            >
              {(createMutation.isPending || updateMutation.isPending) ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitBtnText}>{editUser ? 'ذخیره' : 'ایجاد کاربر'}</Text>
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
  list: { padding: 16, gap: 8 },
  emptyList: { flex: 1 },
  userCard: {
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  userCardLeft: { gap: 6 },
  editBtn: { width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  toggleBtn: { width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  userCardRight: { flex: 1, gap: 3, alignItems: 'flex-end' },
  userCardTop: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8 },
  roleBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  roleBadgeText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  userCardName: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  userCardUsername: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  inactiveText: { fontSize: 11, fontFamily: 'Inter_500Medium' },
  loading: { padding: 40, alignItems: 'center' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, paddingTop: 80 },
  emptyText: { fontSize: 14, fontFamily: 'Inter_400Regular' },
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
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40, gap: 10 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalTitle: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  input: {
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
  roleRow: { flexDirection: 'row', gap: 8, paddingBottom: 4 },
  roleChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  roleChipText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  submitBtn: { borderRadius: 12, padding: 16, alignItems: 'center' },
  submitBtnText: { color: '#FFFFFF', fontSize: 16, fontFamily: 'Inter_700Bold' },
});
