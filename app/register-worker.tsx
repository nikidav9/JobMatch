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
import { MetroPicker } from '@/components/feature/MetroPicker';
import { WorkTypeSelector } from '@/components/feature/WorkTypeSelector';
import { useApp } from '@/hooks/useApp';
import { uid, nowISO, isPhoneComplete, extractPhoneDigits } from '@/services/storage';
import { dbUpsertUser, dbGetUsers } from '@/services/db';
import { WorkType } from '@/constants/types';
import { METRO_LINES } from '@/constants/metro';

const TOTAL = 5;

export default function RegisterWorker() {
  const router = useRouter();
  const { setCurrentUser, refreshUsers, showToast } = useApp();

  const [step, setStep] = useState(1);
  const [phone, setPhone] = useState('+7 ');
  const [lastName, setLastName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [metroLineId, setMetroLineId] = useState('');
  const [metroLineName, setMetroLineName] = useState('');
  const [metroStation, setMetroStation] = useState('');
  const [workTypes, setWorkTypes] = useState<WorkType[]>([]);
  const [metroPicker, setMetroPicker] = useState(false);
  const [checking, setChecking] = useState(false);
  const [phoneError, setPhoneError] = useState('');
  const [agreed, setAgreed] = useState(false);

  const toggleWork = (t: WorkType) => {
    setWorkTypes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  };

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
      role: 'worker' as const,
      phone: extractPhoneDigits(phone),
      lastName,
      firstName,
      metroLineId,
      metroStation,
      workTypes,
      createdAt: nowISO(),
    };
    await dbUpsertUser(user);
    await refreshUsers();
    await setCurrentUser(user);
    showToast('Добро пожаловать! 👋', 'success');
    router.replace('/(tabs)');
  };

  const line = METRO_LINES.find(l => l.id === metroLineId);

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
              <Text style={styles.subtitle}>Работодатель увидит его только после мэтча</Text>
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
              <AppInput value={lastName} onChangeText={setLastName} placeholder="Романов" label="Фамилия" autoFocus />
              <AppInput value={firstName} onChangeText={setFirstName} placeholder="Алексей" label="Имя" />
              <View style={{ marginTop: 12 }}>
                <PrimaryButton label="Продолжить →" onPress={next} disabled={!lastName.trim() || !firstName.trim()} />
              </View>
            </View>
          )}

          {step === 3 && (
            <View style={styles.stepContent}>
              <Text style={styles.title}>Согласие</Text>
              <Text style={styles.subtitle}>Для использования сервиса</Text>

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
              <Text style={styles.title}>📍 Ближайшее метро</Text>
              <Text style={styles.subtitle}>Покажем смены рядом с тобой</Text>
              {metroStation ? (
                <View style={styles.metroSelected}>
                  <View style={[styles.metroLineDot, { backgroundColor: line?.color ?? Colors.blue }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.metroLineName}>{metroLineName}</Text>
                    <Text style={styles.metroStName}>{metroStation}</Text>
                  </View>
                  <TouchableOpacity onPress={() => setMetroPicker(true)}>
                    <Text style={styles.changeLink}>Изменить</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={styles.metroField} onPress={() => setMetroPicker(true)} activeOpacity={0.8}>
                  <Text style={styles.metroFieldText}>🚇 Выбрать станцию</Text>
                  <Text style={styles.arrow}>›</Text>
                </TouchableOpacity>
              )}
              <View style={{ marginTop: 28 }}>
                <PrimaryButton label="Продолжить →" onPress={next} disabled={!metroStation} />
              </View>
              <MetroPicker
                visible={metroPicker}
                onClose={() => setMetroPicker(false)}
                onSelect={(lid, lname, st) => { setMetroLineId(lid); setMetroLineName(lname); setMetroStation(st); setMetroPicker(false); }}
                selectedLineId={metroLineId}
                selectedStation={metroStation}
              />
            </View>
          )}

          {step === 5 && (
            <View style={styles.stepContent}>
              <Text style={styles.title}>Какую работу рассматриваешь?</Text>
              <Text style={styles.subtitle}>Выбери специализацию</Text>
              <WorkTypeSelector selected={workTypes} onToggle={toggleWork} />
              <View style={{ marginTop: 28 }}>
                <PrimaryButton label="Начать поиск →" onPress={finish} disabled={workTypes.length === 0} />
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
  metroField: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1.5, borderColor: Colors.inputBorder, borderRadius: Radius.md, padding: 16 },
  metroFieldText: { fontSize: 15, color: Colors.textPrimary },
  arrow: { fontSize: 20, color: Colors.textMuted },
  metroSelected: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1.5, borderColor: Colors.primary, borderRadius: Radius.md, padding: 16, backgroundColor: Colors.primaryLight },
  metroLineDot: { width: 12, height: 12, borderRadius: 6 },
  metroLineName: { fontSize: 12, color: Colors.textMuted },
  metroStName: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary, marginTop: 2 },
  changeLink: { color: Colors.primary, fontSize: 13, fontWeight: '600' },
});
