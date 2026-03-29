import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  SafeAreaView, KeyboardAvoidingView, Platform, ActivityIndicator, TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors, Radius } from '@/constants/theme';
import { AppInput } from '@/components/ui/AppInput';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { PhoneInput } from '@/components/feature/PhoneInput';
import { useApp } from '@/hooks/useApp';
import { uid, nowISO, isPhoneComplete, extractPhoneDigits } from '@/services/storage';
import { dbUpsertUser, dbGetUsers } from '@/services/db';

const TOTAL = 5;

function generateOTP(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

export default function RegisterEmployer() {
  const router = useRouter();
  const { setCurrentUser, refreshUsers, showToast } = useApp();

  const [step, setStep] = useState(1);
  const [phone, setPhone] = useState('+7 ');
  const [lastName, setLastName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [company, setCompany] = useState('');
  const [checking, setChecking] = useState(false);
  const [phoneError, setPhoneError] = useState('');

  // OTP state
  const [generatedOTP, setGeneratedOTP] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [otpError, setOtpError] = useState('');

  const back = () => { if (step === 1) router.back(); else setStep(s => s - 1); };

  const continueFromPhone = async () => {
    setPhoneError('');
    setChecking(true);
    const digits = extractPhoneDigits(phone);
    const allUsers = await dbGetUsers();
    const exists = allUsers.find(u => u.phone === digits);
    setChecking(false);
    if (exists) {
      setPhoneError('Аккаунт с этим номером уже существует. Войдите в систему.');
      return;
    }
    // Generate OTP and move to OTP step
    const code = generateOTP();
    setGeneratedOTP(code);
    setOtpInput('');
    setOtpError('');
    setStep(2);
  };

  const confirmOTP = () => {
    if (otpInput !== generatedOTP) {
      setOtpError('Неверный код. Проверьте и попробуйте снова.');
      return;
    }
    setOtpError('');
    setStep(3);
  };

  const next = () => setStep(s => s + 1);

  const finish = async () => {
    const user = {
      id: uid(),
      role: 'employer' as const,
      phone: extractPhoneDigits(phone),
      lastName,
      firstName,
      company,
      createdAt: nowISO(),
    };
    await dbUpsertUser(user);
    await refreshUsers();
    await setCurrentUser(user);
    showToast('Добро пожаловать! 👋', 'success');
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={back}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.stepLabel}>{step} из {TOTAL}</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.progress}>
        <View style={[styles.progressFill, { width: `${(step / TOTAL) * 100}%` }]} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">

          {/* Step 1: Phone */}
          {step === 1 && (
            <View style={styles.stepContent}>
              <Text style={styles.title}>Введи номер телефона</Text>
              <Text style={styles.subtitle}>Работник увидит его только после мэтча</Text>
              <View style={styles.demoBanner}>
                <Text style={styles.demoBannerText}>⚠️ Демо-режим: SMS и Telegram не подключены. Код подтверждения будет показан на следующем экране.</Text>
              </View>
              <PhoneInput value={phone} onChange={v => { setPhone(v); setPhoneError(''); }} />
              {phoneError ? <Text style={styles.fieldError}>{phoneError}</Text> : null}
              <View style={{ marginTop: 28 }}>
                {checking ? (
                  <ActivityIndicator size="small" color={Colors.primary} />
                ) : (
                  <PrimaryButton label="Получить код →" onPress={continueFromPhone} disabled={!isPhoneComplete(phone)} />
                )}
              </View>
              <TouchableOpacity style={styles.loginHint} onPress={() => router.push('/login')}>
                <Text style={styles.loginHintTxt}>Уже есть аккаунт? <Text style={{ color: Colors.primary, fontWeight: '700' }}>Войти →</Text></Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Step 2: OTP */}
          {step === 2 && (
            <View style={styles.stepContent}>
              <Text style={styles.title}>Подтверждение</Text>
              <Text style={styles.subtitle}>Введите код подтверждения</Text>

              {/* Demo OTP display */}
              <View style={styles.otpDemoBox}>
                <Text style={styles.otpDemoLabel}>Ваш код (демо):</Text>
                <Text style={styles.otpDemoCode}>{generatedOTP}</Text>
                <Text style={styles.otpDemoNote}>В боевой версии код придёт по SMS или в Telegram</Text>
              </View>

              <View style={styles.otpRow}>
                {[0, 1, 2, 3].map(i => (
                  <View key={i} style={[styles.otpBox, otpInput.length > i && styles.otpBoxFilled]}>
                    <Text style={styles.otpDigit}>{otpInput[i] ?? ''}</Text>
                  </View>
                ))}
              </View>

              <TextInput
                style={styles.hiddenInput}
                value={otpInput}
                onChangeText={v => { setOtpInput(v.replace(/\D/g, '').slice(0, 4)); setOtpError(''); }}
                keyboardType="number-pad"
                maxLength={4}
                autoFocus
              />

              {otpError ? <Text style={styles.fieldError}>{otpError}</Text> : null}

              <PrimaryButton label="Подтвердить →" onPress={confirmOTP} disabled={otpInput.length < 4} />

              <TouchableOpacity style={styles.loginHint} onPress={() => setStep(1)}>
                <Text style={styles.loginHintTxt}>← Изменить номер</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Step 3: Name */}
          {step === 3 && (
            <View style={styles.stepContent}>
              <Text style={styles.title}>Как тебя зовут?</Text>
              <AppInput value={lastName} onChangeText={setLastName} placeholder="Иванов" label="Фамилия" autoFocus />
              <AppInput value={firstName} onChangeText={setFirstName} placeholder="Дмитрий" label="Имя" />
              <View style={{ marginTop: 12 }}>
                <PrimaryButton label="Продолжить →" onPress={next} disabled={!lastName.trim() || !firstName.trim()} />
              </View>
            </View>
          )}

          {/* Step 4: Legal consent */}
          {step === 4 && (
            <View style={styles.stepContent}>
              <Text style={styles.title}>Согласие</Text>
              <Text style={styles.subtitle}>Для завершения регистрации</Text>

              <TouchableOpacity style={styles.checkRow} onPress={() => setAgreed(v => !v)} activeOpacity={0.8}>
                <View style={[styles.checkbox, agreed && styles.checkboxActive]}>
                  {agreed ? <Text style={styles.checkmark}>✓</Text> : null}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.checkLabel}>
                    Ставя галочку, я подтверждаю, что ознакомлен(а) и согласен(на) с{' '}
                    <Text style={styles.link} onPress={() => router.push({ pathname: '/legal', params: { doc: 'terms' } })}>
                      Пользовательским соглашением
                    </Text>
                    {', '}
                    <Text style={styles.link} onPress={() => router.push({ pathname: '/legal', params: { doc: 'privacy' } })}>
                      Политикой конфиденциальности
                    </Text>
                    {' и '}
                    <Text style={styles.link} onPress={() => router.push({ pathname: '/legal', params: { doc: 'consent' } })}>
                      Согласием на обработку персональных данных
                    </Text>
                    .
                  </Text>
                </View>
              </TouchableOpacity>

              <View style={{ marginTop: 16 }}>
                <PrimaryButton label="Продолжить →" onPress={next} disabled={!agreed} />
              </View>
            </View>
          )}

          {/* Step 5: Company */}
          {step === 5 && (
            <View style={styles.stepContent}>
              <Text style={styles.title}>Название компании</Text>
              <Text style={styles.subtitle}>Будет отображаться в вакансиях</Text>
              <AppInput value={company} onChangeText={setCompany} placeholder="ООО МегаСклад" autoFocus />
              <View style={{ marginTop: 28 }}>
                <PrimaryButton label="Начать работу →" onPress={finish} disabled={!company.trim()} />
              </View>
            </View>
          )}

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 18, color: Colors.textSecondary },
  stepLabel: { fontSize: 13, color: Colors.textMuted },
  progress: { height: 3, backgroundColor: Colors.divider },
  progressFill: { height: 3, backgroundColor: Colors.primary },
  body: { padding: 24, paddingBottom: 40 },
  stepContent: { gap: 16 },
  title: { fontSize: 24, fontWeight: '700', color: Colors.textPrimary },
  subtitle: { fontSize: 14, color: Colors.textMuted, marginTop: -8, lineHeight: 20 },
  fieldError: { fontSize: 13, color: Colors.red, lineHeight: 18 },
  loginHint: { marginTop: 16, alignItems: 'center' },
  loginHintTxt: { fontSize: 14, color: Colors.textMuted },
  demoBanner: {
    backgroundColor: '#FFF3CD', borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: '#F59E0B',
  },
  demoBannerText: { fontSize: 12, color: '#92400E', lineHeight: 17 },
  otpDemoBox: {
    backgroundColor: Colors.primaryLight, borderRadius: 14, padding: 18,
    alignItems: 'center', borderWidth: 1.5, borderColor: Colors.primary,
  },
  otpDemoLabel: { fontSize: 12, color: Colors.primary, fontWeight: '600', marginBottom: 4 },
  otpDemoCode: { fontSize: 42, fontWeight: '900', color: Colors.primary, letterSpacing: 10, marginVertical: 4 },
  otpDemoNote: { fontSize: 11, color: Colors.primary, opacity: 0.7, textAlign: 'center', marginTop: 4 },
  otpRow: { flexDirection: 'row', gap: 12, justifyContent: 'center', marginTop: 8 },
  otpBox: {
    width: 56, height: 64, borderRadius: Radius.md,
    borderWidth: 2, borderColor: Colors.inputBorder,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  otpBoxFilled: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  otpDigit: { fontSize: 28, fontWeight: '800', color: Colors.textPrimary },
  hiddenInput: { position: 'absolute', opacity: 0, width: 1, height: 1 },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, paddingVertical: 8 },
  checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 1.5, borderColor: Colors.inputBorder, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center', marginTop: 2, flexShrink: 0 },
  checkboxActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  checkmark: { color: '#fff', fontWeight: '700', fontSize: 14 },
  checkLabel: { fontSize: 14, color: Colors.textPrimary, lineHeight: 22, flex: 1 },
  link: { color: Colors.primary, fontWeight: '600', textDecorationLine: 'underline' },
});
