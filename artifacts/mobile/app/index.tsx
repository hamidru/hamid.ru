import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Redirect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import { useLogin } from '@workspace/api-client-react';
import * as Haptics from 'expo-haptics';

export default function LoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, login, isLoading: authLoading } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const loginMutation = useLogin({
    mutation: {
      onSuccess: async (data: { user: unknown; token: string }) => {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        await login(data.user as never, data.token);
      },
      onError: (err: unknown) => {
        const msg =
          (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
          'خطا در ورود. لطفاً دوباره تلاش کنید';
        setError(msg);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      },
    },
  });

  if (authLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.primary }]}>
        <ActivityIndicator color={colors.primaryForeground} size="large" />
      </View>
    );
  }

  if (user) {
    return <Redirect href="/(tabs)" />;
  }

  const handleLogin = () => {
    if (!username.trim() || !password.trim()) {
      setError('لطفاً نام کاربری و رمز عبور را وارد کنید');
      return;
    }
    setError('');
    loginMutation.mutate({ data: { username: username.trim(), password } });
  };

  const styles2 = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.primary,
      paddingTop: insets.top,
      paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 0),
    },
    scrollContent: {
      flexGrow: 1,
      justifyContent: 'center',
      paddingHorizontal: 24,
    },
    logo: {
      width: 80,
      height: 80,
      borderRadius: 20,
      marginBottom: 16,
      alignSelf: 'center',
    },
    appName: {
      fontSize: 24,
      fontFamily: 'Inter_700Bold',
      color: '#FFFFFF',
      textAlign: 'center',
      marginBottom: 6,
    },
    appSubtitle: {
      fontSize: 14,
      fontFamily: 'Inter_400Regular',
      color: 'rgba(255,255,255,0.7)',
      textAlign: 'center',
      marginBottom: 40,
    },
    card: {
      backgroundColor: '#FFFFFF',
      borderRadius: 20,
      padding: 28,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 5,
    },
    label: {
      fontSize: 13,
      fontFamily: 'Inter_600SemiBold',
      color: colors.foreground,
      textAlign: 'right',
      marginBottom: 8,
    },
    input: {
      backgroundColor: colors.background,
      borderRadius: 12,
      paddingVertical: 14,
      paddingHorizontal: 16,
      fontSize: 15,
      fontFamily: 'Inter_400Regular',
      color: colors.foreground,
      textAlign: 'right',
      borderWidth: 1.5,
      borderColor: colors.border,
      marginBottom: 16,
    },
    inputFocused: {
      borderColor: colors.secondary,
    },
    button: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 16,
      alignItems: 'center',
      marginTop: 8,
    },
    buttonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontFamily: 'Inter_700Bold',
    },
    error: {
      backgroundColor: '#FEF2F2',
      borderRadius: 10,
      padding: 12,
      marginBottom: 16,
    },
    errorText: {
      color: colors.destructive,
      fontSize: 13,
      fontFamily: 'Inter_400Regular',
      textAlign: 'right',
    },
    hint: {
      marginTop: 20,
      padding: 12,
      backgroundColor: 'rgba(37,99,235,0.08)',
      borderRadius: 10,
    },
    hintText: {
      fontSize: 12,
      fontFamily: 'Inter_400Regular',
      color: colors.mutedForeground,
      textAlign: 'right',
    },
  });

  return (
    <KeyboardAvoidingView
      style={styles2.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles2.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Image
          source={require('../assets/images/icon.png')}
          style={styles2.logo}
          resizeMode="cover"
        />
        <Text style={styles2.appName}>سیستم مدیریت سازمانی</Text>
        <Text style={styles2.appSubtitle}>ورود به پنل کاربری</Text>

        <View style={styles2.card}>
          {!!error && (
            <View style={styles2.error}>
              <Text style={styles2.errorText}>{error}</Text>
            </View>
          )}

          <Text style={styles2.label}>نام کاربری</Text>
          <TextInput
            style={styles2.input}
            value={username}
            onChangeText={setUsername}
            placeholder="نام کاربری"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
            placeholderTextColor={colors.mutedForeground}
          />

          <Text style={styles2.label}>رمز عبور</Text>
          <TextInput
            style={styles2.input}
            value={password}
            onChangeText={setPassword}
            placeholder="رمز عبور"
            secureTextEntry
            returnKeyType="done"
            onSubmitEditing={handleLogin}
            placeholderTextColor={colors.mutedForeground}
          />

          <TouchableOpacity
            style={[styles2.button, loginMutation.isPending && { opacity: 0.7 }]}
            onPress={handleLogin}
            disabled={loginMutation.isPending}
            activeOpacity={0.8}
          >
            {loginMutation.isPending ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles2.buttonText}>ورود به سیستم</Text>
            )}
          </TouchableOpacity>

          <View style={styles2.hint}>
            <Text style={styles2.hintText}>
              نام کاربری و رمز عبور خود را از مدیر سیستم دریافت کنید
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
