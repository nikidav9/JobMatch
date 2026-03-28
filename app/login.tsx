import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/theme';
import { PhoneInput } from '@/components/feature/PhoneInput';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { useApp } from '@/hooks/useApp';
import { isPhoneComplete, extractPhoneDigits } from '@/services/storage';

export default function Login() {
  const router = useRouter();
  const { users, setCurrentUser, refreshChats, refreshSaved, showToast } = useApp();
  const [phone, setPhone] = useState('+7 ');
  const [error, setError] = useState('');

  const handleLogin = async () => {
    const digits = extractPhoneDigits(phone);
    const user = users.find(u => {
      const uDigits = u.phone.replace(/\D/g, '');
      const inputDigits = digits.replace(/\D/g, '');
      return uDigits.slice(-10) === inputDigits.slice(-10);
    });
    if (user) {
      await setCurrentUser(user);
      await Promise.all([refreshChats(user), refreshSaved(user)]);
      showToast('Добро пожаловать! 👋', 'success');
      router.replace('/(tabs)');
    } else {
      setError('Пользователь не найден');
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.sheet} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.handle} />
        <Text style={styles.title}>Войти</Text>
        <Text style={styles.subtitle}>Введи номер, указанный при регистрации</Text>
        <PhoneInput value={phone} onChange={v => { setPhone(v); setError(''); }} error={error} />
        <View style={{ marginTop: 20 }}>
          <PrimaryButton label="Войти →" onPress={handleLogin} disabled={!isPhoneComplete(phone)} />
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
  sheet: { backgroundColor: Colors.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40, gap: 16 },
  handle: { width: 36, height: 4, backgroundColor: Colors.inputBorder, borderRadius: 2, alignSelf: 'center', marginBottom: 8 },
  title: { fontSize: 22, fontWeight: '700', color: Colors.textPrimary },
  subtitle: { fontSize: 14, color: Colors.textMuted, marginTop: -8 },
  cancel: { alignItems: 'center', marginTop: 8 },
  cancelText: { fontSize: 15, color: Colors.textMuted, fontWeight: '500' },
});
