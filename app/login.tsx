import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView,
  KeyboardAvoidingView, Platform, ActivityIndicator, Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors, Radius } from '@/constants/theme';
import { PhoneInput } from '@/components/feature/PhoneInput';
import { AppInput } from '@/components/ui/AppInput';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { useApp } from '@/hooks/useApp';
import { isPhoneComplete, extractPhoneDigits } from '@/services/storage';

// Admin phone digits (without +7 prefix)
const ADMIN_PHONE_DIGITS = '9933431523';
const ADMIN_PASSWORD = 'admin1234';
const SUPPORT_EMAIL = 'zpouches@yandex.ru';

export default function Login() {
  const router = useRouter();
  const { users, setCurrentUser, refreshChats, refreshSaved, showToast } = useApp();

  const [phone, setPhone] = useState('+7 ');
  const [password, setPassword] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [passError, setPassError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setPhoneError('');
    setPassError('');

    if (!password.trim()) {
      setPassError('Введите пароль');
      return;
    }

    const digits = extractPhoneDigits(phone).replace(/\D/g, '').slice(-10);

    setLoading(true);

    // Admin check
    if (digits === ADMIN_PHONE_DIGITS) {
      if (password !== ADMIN_PASSWORD) {
        setPassError('Неверный пароль');
        setLoading(false);
        return;
      }
      router.replace('/admin');
      setLoading(false);
      return;
    }

    // Regular user
    const user = users.find(u => {
      const uDigits = u.phone.replace(/\D/g, '').slice(-10);
      return uDigits === digits;
    });

    if (!user) {
      setPhoneError('Пользователь с таким номером не найден');
      setLoading(false);
      return;
    }

    if (user.password !== password) {
      setPassError('Неверный пароль');
      setLoading(false);
      return;
    }

    await setCurrentUser(user);
    await Promise.all([refreshChats(user), refreshSaved(user)]);
    showToast('Добро пожаловать! 👋', 'success');
    router.replace('/(tabs)');
    setLoading(false);
  };

  const openSupport = () => {
    Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=Восстановление пароля JobToo`);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.sheet} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.handle} />

        <Text style={styles.title}>Войти</Text>
        <Text style={styles.subtitle}>Номер телефона и пароль</Text>

        <PhoneInput
          value={phone}
          onChange={v => { setPhone(v); setPhoneError(''); }}
          error={phoneError}
        />

        <AppInput
          label="Пароль"
          value={password}
          onChangeText={v => { setPassword(v); setPassError(''); }}
          secureTextEntry
          placeholder="Минимум 6 символов"
        />
        {passError ? <Text style={styles.errText}>{passError}</Text> : null}

        {/* Forgot password */}
        <TouchableOpacity style={styles.forgotRow} onPress={openSupport} activeOpacity={0.8}>
          <View style={styles.forgotBanner}>
            <Text style={styles.forgotText}>
              Забыли пароль?{' '}
              <Text style={styles.forgotLink}>Обращайтесь на {SUPPORT_EMAIL}</Text>
            </Text>
          </View>
        </TouchableOpacity>

        <View style={{ marginTop: 8 }}>
          {loading ? (
            <ActivityIndicator color={Colors.primary} />
          ) : (
            <PrimaryButton
              label="Войти →"
              onPress={handleLogin}
              disabled={!isPhoneComplete(phone) || !password.trim()}
            />
          )}
        </View>

        <TouchableOpacity style={styles.cancel} onPress={() => router.back()}>
          <Text style={styles.cancelText}>Отмена</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: 'transparent', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    gap: 14,
  },
  handle: {
    width: 36, height: 4, backgroundColor: Colors.inputBorder,
    borderRadius: 2, alignSelf: 'center', marginBottom: 8,
  },
  title: { fontSize: 22, fontWeight: '700', color: Colors.textPrimary },
  subtitle: { fontSize: 14, color: Colors.textMuted, marginTop: -6, lineHeight: 20 },
  errText: { fontSize: 13, color: Colors.red, marginTop: -6 },
  forgotRow: { marginTop: -4 },
  forgotBanner: {
    backgroundColor: '#F0F4FF', borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: '#BFCBF5',
  },
  forgotText: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },
  forgotLink: { color: Colors.primary, fontWeight: '600' },
  cancel: { alignItems: 'center', marginTop: 4 },
  cancelText: { fontSize: 15, color: Colors.textMuted, fontWeight: '500' },
});
