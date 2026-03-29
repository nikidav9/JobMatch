import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView,
  KeyboardAvoidingView, Platform, TextInput, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors, Radius } from '@/constants/theme';
import { PhoneInput } from '@/components/feature/PhoneInput';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { useApp } from '@/hooks/useApp';
import { isPhoneComplete, extractPhoneDigits } from '@/services/storage';

// Admin phone digits (without +7 prefix)
const ADMIN_PHONE_DIGITS = '9933431523';

// Generate a mock 4-digit OTP (demo — no real SMS provider)
function generateOTP(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

type Step = 'phone' | 'otp';

export default function Login() {
  const router = useRouter();
  const { users, setCurrentUser, refreshChats, refreshSaved, showToast } = useApp();

  const [phone, setPhone] = useState('+7 ');
  const [error, setError] = useState('');
  const [step, setStep] = useState<Step>('phone');
  const [generatedOTP, setGeneratedOTP] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [otpError, setOtpError] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(false);

  const sendOTP = async () => {
    setError('');
    const digits = extractPhoneDigits(phone).replace(/\D/g, '').slice(-10);

    if (digits === ADMIN_PHONE_DIGITS) {
      // Admin flow
      const code = generateOTP();
      setGeneratedOTP(code);
      setIsAdmin(true);
      setStep('otp');
      // In demo mode: show code in toast since no real SMS
      showToast(`Код подтверждения: ${code}`, 'success');
      return;
    }

    // Regular user flow
    const user = users.find(u => {
      const uDigits = u.phone.replace(/\D/g, '').slice(-10);
      return uDigits === digits;
    });

    if (!user) {
      setError('Пользователь не найден. Зарегистрируйтесь.');
      return;
    }

    setLoading(true);
    const code = generateOTP();
    setGeneratedOTP(code);
    setIsAdmin(false);
    setStep('otp');
    // Demo: show OTP in toast
    showToast(`Код подтверждения: ${code}`, 'success');
    setLoading(false);
  };

  const confirmOTP = async () => {
    if (otpInput !== generatedOTP) {
      setOtpError('Неверный код. Попробуйте снова.');
      return;
    }
    setOtpError('');
    setLoading(true);

    if (isAdmin) {
      // Navigate to admin panel
      router.replace('/admin');
      setLoading(false);
      return;
    }

    const digits = extractPhoneDigits(phone).replace(/\D/g, '').slice(-10);
    const user = users.find(u => u.phone.replace(/\D/g, '').slice(-10) === digits);
    if (user) {
      await setCurrentUser(user);
      await Promise.all([refreshChats(user), refreshSaved(user)]);
      showToast('Добро пожаловать! 👋', 'success');
      router.replace('/(tabs)');
    }
    setLoading(false);
  };

  const resetPhone = () => {
    setStep('phone');
    setOtpInput('');
    setOtpError('');
    setGeneratedOTP('');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.sheet} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.handle} />

        {step === 'phone' ? (
          <>
            <Text style={styles.title}>Войти</Text>
            <Text style={styles.subtitle}>Введите номер телефона — вам придёт код</Text>
        <View style={styles.demoBanner}>
          <Text style={styles.demoBannerText}>⚠️ Демо-режим: SMS и Telegram не подключены. Код отображается на экране.</Text>
        </View>
            <PhoneInput value={phone} onChange={v => { setPhone(v); setError(''); }} error={error} />
            <View style={{ marginTop: 20 }}>
              {loading ? (
                <ActivityIndicator color={Colors.primary} />
              ) : (
                <PrimaryButton label="Получить код →" onPress={sendOTP} disabled={!isPhoneComplete(phone)} />
              )}
            </View>
            <TouchableOpacity style={styles.cancel} onPress={() => router.back()}>
              <Text style={styles.cancelText}>Отмена</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.title}>Введите код</Text>
            <Text style={styles.subtitle}>Код отправлен (демо-режим)</Text>
            {/* Demo OTP display — remove when real SMS/Telegram connected */}
            <View style={styles.otpDemoBox}>
              <Text style={styles.otpDemoLabel}>Ваш код (демо):</Text>
              <Text style={styles.otpDemoCode}>{generatedOTP}</Text>
            </View>

            <View style={styles.otpRow}>
              {[0, 1, 2, 3].map(i => (
                <View key={i} style={[styles.otpBox, otpInput.length > i && styles.otpBoxFilled]}>
                  <Text style={styles.otpDigit}>{otpInput[i] ?? ''}</Text>
                </View>
              ))}
            </View>

            {/* Hidden input to capture keyboard */}
            <TextInput
              style={styles.hiddenInput}
              value={otpInput}
              onChangeText={v => { setOtpInput(v.replace(/\D/g, '').slice(0, 4)); setOtpError(''); }}
              keyboardType="number-pad"
              maxLength={4}
              autoFocus
            />

            {otpError ? <Text style={styles.errText}>{otpError}</Text> : null}

            <View style={{ marginTop: 20 }}>
              {loading ? (
                <ActivityIndicator color={Colors.primary} />
              ) : (
                <PrimaryButton label="Подтвердить →" onPress={confirmOTP} disabled={otpInput.length < 4} />
              )}
            </View>

            <TouchableOpacity style={styles.cancel} onPress={resetPhone}>
              <Text style={styles.cancelText}>← Изменить номер</Text>
            </TouchableOpacity>
          </>
        )}
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
    gap: 16,
  },
  handle: {
    width: 36, height: 4, backgroundColor: Colors.inputBorder,
    borderRadius: 2, alignSelf: 'center', marginBottom: 8,
  },
  title: { fontSize: 22, fontWeight: '700', color: Colors.textPrimary },
  subtitle: { fontSize: 14, color: Colors.textMuted, marginTop: -8, lineHeight: 20 },
  cancel: { alignItems: 'center', marginTop: 8 },
  cancelText: { fontSize: 15, color: Colors.textMuted, fontWeight: '500' },
  otpRow: { flexDirection: 'row', gap: 12, justifyContent: 'center', marginTop: 8 },
  otpBox: {
    width: 56, height: 64, borderRadius: Radius.md,
    borderWidth: 2, borderColor: Colors.inputBorder,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  otpBoxFilled: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  otpDigit: { fontSize: 28, fontWeight: '800', color: Colors.textPrimary },
  hiddenInput: {
    position: 'absolute', opacity: 0, width: 1, height: 1,
  },
  errText: { fontSize: 13, color: Colors.red, textAlign: 'center' },
  demoBanner: {
    backgroundColor: '#FFF3CD', borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: '#F59E0B',
  },
  demoBannerText: { fontSize: 12, color: '#92400E', lineHeight: 17 },
  otpDemoBox: {
    backgroundColor: Colors.primaryLight, borderRadius: 12, padding: 16,
    alignItems: 'center', borderWidth: 1.5, borderColor: Colors.primary,
  },
  otpDemoLabel: { fontSize: 12, color: Colors.primary, fontWeight: '600', marginBottom: 4 },
  otpDemoCode: { fontSize: 36, fontWeight: '900', color: Colors.primary, letterSpacing: 8 },
});
