import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  SafeAreaView, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors, Radius } from '@/constants/theme';
import { AppInput } from '@/components/ui/AppInput';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { PhoneInput } from '@/components/feature/PhoneInput';
import { useApp } from '@/hooks/useApp';
import { uid, nowISO, isPhoneComplete, extractPhoneDigits } from '@/services/storage';
import { dbUpsertUser, dbGetUsers } from '@/services/db';

const TOTAL = 4;

export default function RegisterEmployer() {
  const router = useRouter();
  const { setCurrentUser, refreshUsers, showToast } = useApp();

  const [step, setStep] = useState(1);
  const [phone, setPhone] = useState('+7 ');
  const [lastName, setLastName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [age, setAge] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [company, setCompany] = useState('');
  const [checking, setChecking] = useState(false);
  const [phoneError, setPhoneError] = useState('');

  const ageNum = parseInt(age, 10);
  const ageValid = !isNaN(ageNum) && ageNum >= 18 && ageNum <= 65;

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
    setStep(2);
  };

  const next = () => setStep(s => s + 1);

  const finish = async () => {
    const user = {
      id: uid(),
      role: 'employer' as const,
      phone: extractPhoneDigits(phone),
      lastName,
      firstName,
      age: ageNum,
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

          {step === 1 && (
            <View style={styles.stepContent}>
              <Text style={styles.title}>Введи номер телефона</Text>
              <Text style={styles.subtitle}>Работник увидит его только после мэтча</Text>
              <PhoneInput value={phone} onChange={v => { setPhone(v); setPhoneError(''); }} />
              {phoneError ? <Text style={styles.fieldError}>{phoneError}</Text> : null}
              <View style={{ marginTop: 28 }}>
                {checking ? (
                  <ActivityIndicator size="small" color={Colors.primary} />
                ) : (
                  <PrimaryButton label="Продолжить →" onPress={continueFromPhone} disabled={!isPhoneComplete(phone)} />
                )}
              </View>
              <TouchableOpacity style={styles.loginHint} onPress={() => router.push('/login')}>
                <Text style={styles.loginHintTxt}>Уже есть аккаунт? <Text style={{ color: Colors.primary, fontWeight: '700' }}>Войти →</Text></Text>
              </TouchableOpacity>
            </View>
          )}

          {step === 2 && (
            <View style={styles.stepContent}>
              <Text style={styles.title}>Как тебя зовут?</Text>
              <AppInput value={lastName} onChangeText={setLastName} placeholder="Иванов" label="Фамилия" autoFocus />
              <AppInput value={firstName} onChangeText={setFirstName} placeholder="Дмитрий" label="Имя" />
              <View style={{ marginTop: 12 }}>
                <PrimaryButton label="Продолжить →" onPress={next} disabled={!lastName.trim() || !firstName.trim()} />
              </View>
            </View>
          )}

          {step === 3 && (
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

          {step === 4 && (
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
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, paddingVertical: 8 },
  checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 1.5, borderColor: Colors.inputBorder, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center', marginTop: 2, flexShrink: 0 },
  checkboxActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  checkmark: { color: '#fff', fontWeight: '700', fontSize: 14 },
  checkLabel: { fontSize: 14, color: Colors.textPrimary, lineHeight: 22, flex: 1 },
  link: { color: Colors.primary, fontWeight: '600', textDecorationLine: 'underline' },
});
