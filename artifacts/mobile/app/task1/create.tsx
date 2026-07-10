import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import {
  useCreateTask,
  useListUsers,
  getListTasksQueryKey,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';

const PRIORITIES = [
  { key: 'low', label: 'پایین' },
  { key: 'medium', label: 'متوسط' },
  { key: 'high', label: 'بالا' },
  { key: 'urgent', label: 'فوری' },
];

export default function CreateTaskScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [deadline, setDeadline] = useState('');
  const [project, setProject] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [checklistText, setChecklistText] = useState('');
  const [checklist, setChecklist] = useState<string[]>([]);

  const { data: users } = useListUsers({ query: { enabled: !!user } });
  const employees = users?.filter((u) => u.role === 'employee' && u.isActive && u.id !== user?.id) ?? [];

  const createMutation = useCreateTask({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.back();
      },
      onError: (err: unknown) => {
        const msg =
          (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
          'خطا در ایجاد وظیفه';
        Alert.alert('خطا', msg);
      },
    },
  });

  const handleAddChecklist = () => {
    if (checklistText.trim()) {
      setChecklist((prev) => [...prev, checklistText.trim()]);
      setChecklistText('');
    }
  };

  const handleSubmit = () => {
    if (!title.trim()) {
      Alert.alert('خطا', 'عنوان وظیفه الزامی است');
      return;
    }
    if (selectedUserIds.length === 0) {
      Alert.alert('خطا', 'حداقل یک کارمند انتخاب کنید');
      return;
    }

    createMutation.mutate({
      data: {
        title: title.trim(),
        description: description.trim() || undefined,
        priority: priority as never,
        deadline: deadline.trim() || undefined,
        project: project.trim() || undefined,
        assigneeIds: selectedUserIds,
        checklist: checklist.length > 0 ? checklist : undefined,
      },
    });
  };

  const toggleUser = (id: number) => {
    setSelectedUserIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const bottomPad = insets.bottom + (Platform.OS === 'web' ? 34 : 0);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 24 }]}
      keyboardShouldPersistTaps="handled"
    >
      {/* Title */}
      <Text style={[styles.label, { color: colors.foreground }]}>عنوان وظیفه *</Text>
      <TextInput
        style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
        value={title}
        onChangeText={setTitle}
        placeholder="عنوان وظیفه را وارد کنید"
        placeholderTextColor={colors.mutedForeground}
        textAlign="right"
      />

      {/* Description */}
      <Text style={[styles.label, { color: colors.foreground }]}>توضیحات</Text>
      <TextInput
        style={[styles.inputMulti, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
        value={description}
        onChangeText={setDescription}
        placeholder="توضیحات وظیفه..."
        placeholderTextColor={colors.mutedForeground}
        multiline
        numberOfLines={4}
        textAlign="right"
        textAlignVertical="top"
      />

      {/* Priority */}
      <Text style={[styles.label, { color: colors.foreground }]}>اولویت</Text>
      <View style={styles.chipRow}>
        {PRIORITIES.map((p) => (
          <TouchableOpacity
            key={p.key}
            style={[
              styles.chip,
              {
                backgroundColor: priority === p.key ? colors.primary : colors.card,
                borderColor: priority === p.key ? colors.primary : colors.border,
              },
            ]}
            onPress={() => setPriority(p.key)}
            activeOpacity={0.7}
          >
            <Text style={[styles.chipText, { color: priority === p.key ? '#FFFFFF' : colors.foreground }]}>
              {p.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Deadline */}
      <Text style={[styles.label, { color: colors.foreground }]}>مهلت (YYYY-MM-DD)</Text>
      <TextInput
        style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
        value={deadline}
        onChangeText={setDeadline}
        placeholder="مثال: 1403-03-10"
        placeholderTextColor={colors.mutedForeground}
        textAlign="right"
      />

      {/* Project */}
      <Text style={[styles.label, { color: colors.foreground }]}>پروژه</Text>
      <TextInput
        style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
        value={project}
        onChangeText={setProject}
        placeholder="نام پروژه"
        placeholderTextColor={colors.mutedForeground}
        textAlign="right"
      />

      {/* Assignees */}
      <Text style={[styles.label, { color: colors.foreground }]}>مسئول وظیفه *</Text>
      {employees.length === 0 ? (
        <View style={[styles.emptyAssignees, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            هیچ کارمندی یافت نشد
          </Text>
        </View>
      ) : (
        employees.map((u) => (
          <TouchableOpacity
            key={u.id}
            style={[
              styles.userRow,
              {
                backgroundColor: selectedUserIds.includes(u.id) ? colors.primary + '10' : colors.card,
                borderColor: selectedUserIds.includes(u.id) ? colors.primary : colors.border,
              },
            ]}
            onPress={() => toggleUser(u.id)}
            activeOpacity={0.7}
          >
            <Feather
              name={selectedUserIds.includes(u.id) ? 'check-square' : 'square'}
              size={20}
              color={selectedUserIds.includes(u.id) ? colors.primary : colors.mutedForeground}
            />
            <View style={styles.userInfo}>
              <Text style={[styles.userName, { color: colors.foreground }]}>{u.fullName}</Text>
              <Text style={[styles.userDept, { color: colors.mutedForeground }]}>
                {u.department ?? 'بدون دپارتمان'}
              </Text>
            </View>
          </TouchableOpacity>
        ))
      )}

      {/* Checklist */}
      <Text style={[styles.label, { color: colors.foreground }]}>چک‌لیست</Text>
      <View style={styles.checklistInput}>
        <TouchableOpacity onPress={handleAddChecklist} style={[styles.addBtn, { backgroundColor: colors.primary }]}>
          <Feather name="plus" size={18} color="#FFFFFF" />
        </TouchableOpacity>
        <TextInput
          style={[styles.checklistTextInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
          value={checklistText}
          onChangeText={setChecklistText}
          placeholder="مورد جدید..."
          placeholderTextColor={colors.mutedForeground}
          textAlign="right"
          onSubmitEditing={handleAddChecklist}
          returnKeyType="done"
        />
      </View>
      {checklist.map((item, i) => (
        <View key={i} style={[styles.checklistItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TouchableOpacity onPress={() => setChecklist((prev) => prev.filter((_, idx) => idx !== i))}>
            <Feather name="x" size={16} color={colors.destructive} />
          </TouchableOpacity>
          <Text style={[styles.checklistText, { color: colors.foreground }]}>{item}</Text>
          <Feather name="circle" size={14} color={colors.mutedForeground} />
        </View>
      ))}

      {/* Submit */}
      <TouchableOpacity
        style={[styles.submitBtn, { backgroundColor: colors.primary, marginTop: 24 }]}
        onPress={handleSubmit}
        disabled={createMutation.isPending}
        activeOpacity={0.8}
      >
        {createMutation.isPending ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.submitBtnText}>ایجاد وظیفه</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 0 },
  label: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    textAlign: 'right',
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    marginBottom: 4,
  },
  inputMulti: {
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    minHeight: 90,
    marginBottom: 4,
  },
  chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 4 },
  chip: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20, borderWidth: 1.5 },
  chipText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  userRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    marginBottom: 6,
    gap: 10,
  },
  userInfo: { flex: 1, alignItems: 'flex-end' },
  userName: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  userDept: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  emptyAssignees: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: 4,
  },
  emptyText: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  checklistInput: { flexDirection: 'row-reverse', gap: 8, marginBottom: 8 },
  checklistTextInput: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checklistItem: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 6,
    gap: 8,
  },
  checklistText: { flex: 1, fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'right' },
  submitBtn: {
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
  },
  submitBtnText: { color: '#FFFFFF', fontSize: 16, fontFamily: 'Inter_700Bold' },
});
