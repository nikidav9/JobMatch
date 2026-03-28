import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, Switch, TextInput,
  KeyboardAvoidingView, Platform, Modal, ActivityIndicator,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors, Radius } from '@/constants/theme';
import { AppInput } from '@/components/ui/AppInput';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { MetroPicker } from '@/components/feature/MetroPicker';
import { useApp } from '@/hooks/useApp';
import { uid, nowISO } from '@/services/storage';
import { dbUpsertVacancy } from '@/services/db';
import { Vacancy } from '@/constants/types';
import { METRO_LINES } from '@/constants/metro';

function pad2(n: number) { return n.toString().padStart(2, '0'); }

function formatDisplayDate(d: Date) {
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`;
}
function formatISODate(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function formatTime(d: Date) {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
function parseISOToDate(iso: string): Date {
  // iso = "YYYY-MM-DD"
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date();
  dt.setFullYear(y, m - 1, d);
  dt.setHours(0, 0, 0, 0);
  return dt;
}
function parseTimeToDate(time: string): Date {
  const [h, min] = time.split(':').map(Number);
  const d = new Date();
  d.setHours(h, min, 0, 0);
  return d;
}

type PickerMode = 'date' | 'timeStart' | 'timeEnd' | null;

export default function CreateVacancy() {
  const router = useRouter();
  const { editId } = useLocalSearchParams<{ editId?: string }>();
  const { currentUser, vacancies, refreshVacancies, showToast } = useApp();

  // If editId provided, find existing vacancy to prefill
  const existing = editId ? vacancies.find(v => v.id === editId) : undefined;
  const isEdit = !!existing;

  const [loadingInit, setLoadingInit] = useState(isEdit);

  const [title, setTitle] = useState('');
  const [metroLineId, setMetroLineId] = useState('');
  const [metroLineName, setMetroLineName] = useState('');
  const [metroStation, setMetroStation] = useState('');

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedTimeStart, setSelectedTimeStart] = useState<Date>(() => { const d = new Date(); d.setHours(8, 0, 0, 0); return d; });
  const [selectedTimeEnd, setSelectedTimeEnd] = useState<Date>(() => { const d = new Date(); d.setHours(17, 0, 0, 0); return d; });

  const [pickerMode, setPickerMode] = useState<PickerMode>(null);
  const [iosPickerVisible, setIosPickerVisible] = useState(false);
  const [tempDate, setTempDate] = useState<Date>(new Date());

  const [salary, setSalary] = useState('');
  const [normsAndPay, setNormsAndPay] = useState('');
  const [workersNeeded, setWorkersNeeded] = useState(1);
  const [isUrgent, setIsUrgent] = useState(false);
  const [noExp, setNoExp] = useState(true);
  const [conditions, setConditions] = useState('');
  const [metroPicker, setMetroPicker] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Prefill from existing vacancy
  useEffect(() => {
    if (!existing) { setLoadingInit(false); return; }
    setTitle(existing.title);
    setMetroLineId(existing.metroLineId ?? '');
    setMetroStation(existing.metroStation ?? '');
    const line = METRO_LINES.find(l => l.id === existing.metroLineId);
    setMetroLineName(line?.name ?? '');
    if (existing.date) setSelectedDate(parseISOToDate(existing.date));
    if (existing.timeStart) setSelectedTimeStart(parseTimeToDate(existing.timeStart));
    if (existing.timeEnd) setSelectedTimeEnd(parseTimeToDate(existing.timeEnd));
    setSalary(existing.salary > 0 ? existing.salary.toString() : '');
    setNormsAndPay(existing.normsAndPay ?? '');
    setWorkersNeeded(existing.workersNeeded);
    setIsUrgent(existing.isUrgent);
    setNoExp(existing.noExperienceNeeded);
    setConditions(existing.conditions ?? '');
    setLoadingInit(false);
  }, [existing?.id]);

  const line = METRO_LINES.find(l => l.id === metroLineId);

  // ── Picker helpers ─────────────────────────────────────────────────────────

  const openPicker = (mode: PickerMode) => {
    if (!mode) return;
    if (mode === 'date') setTempDate(selectedDate);
    else if (mode === 'timeStart') setTempDate(selectedTimeStart);
    else setTempDate(selectedTimeEnd);

    if (Platform.OS === 'ios') {
      setPickerMode(mode);
      setIosPickerVisible(true);
    } else {
      setPickerMode(mode);
    }
  };

  const onAndroidChange = (event: DateTimePickerEvent, date?: Date) => {
    setPickerMode(null);
    if (event.type === 'dismissed' || !date) return;
    applyDate(pickerMode, date);
  };

  const onIOSChange = (_: DateTimePickerEvent, date?: Date) => {
    if (date) setTempDate(date);
  };

  const confirmIOS = () => {
    applyDate(pickerMode, tempDate);
    setIosPickerVisible(false);
    setPickerMode(null);
  };

  const applyDate = (mode: PickerMode, date: Date) => {
    if (mode === 'date') setSelectedDate(date);
    else if (mode === 'timeStart') setSelectedTimeStart(date);
    else if (mode === 'timeEnd') setSelectedTimeEnd(date);
  };

  const pickerDateValue = pickerMode === 'date' ? (Platform.OS === 'ios' ? tempDate : selectedDate)
    : pickerMode === 'timeStart' ? (Platform.OS === 'ios' ? tempDate : selectedTimeStart)
    : (Platform.OS === 'ios' ? tempDate : selectedTimeEnd);

  // ── Validation ─────────────────────────────────────────────────────────────

  const validate = () => {
    const e: Record<string, string> = {};
    if (!title.trim()) e.title = 'Введите название';
    if (!metroStation) e.metro = 'Выберите станцию метро';
    if (!salary || isNaN(Number(salary)) || Number(salary) <= 0) e.salary = 'Укажите корректную оплату';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async () => {
    if (!validate() || !currentUser) return;
    const vac: Vacancy = {
      id: existing?.id ?? uid(),
      employerId: existing?.employerId ?? currentUser.id,
      company: existing?.company ?? (currentUser.company ?? `${currentUser.firstName} ${currentUser.lastName}`),
      title,
      workType: 'stocker',
      workTypeLabel: 'Кладовщик',
      metroLineId,
      metroStation,
      date: formatISODate(selectedDate),
      timeStart: formatTime(selectedTimeStart),
      timeEnd: formatTime(selectedTimeEnd),
      salary: Number(salary),
      normsAndPay,
      workersNeeded,
      workersFound: existing?.workersFound ?? 0,
      isUrgent,
      noExperienceNeeded: noExp,
      conditions,
      status: existing?.status ?? 'open',
      createdAt: existing?.createdAt ?? nowISO(),
    };
    await dbUpsertVacancy(vac);
    await refreshVacancies();
    showToast(isEdit ? 'Вакансия обновлена ✅' : 'Вакансия опубликована ✅', 'success');
    router.back();
  };

  if (loadingInit) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>← Назад</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isEdit ? 'Редактировать' : 'Новая вакансия'}</Text>
        <View style={{ width: 70 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* Work type badge */}
          <View style={styles.typeRow}>
            <Text style={styles.typeLabel}>Тип вакансии</Text>
            <View style={styles.typeBadge}>
              <Text style={styles.typeBadgeText}>📦 Кладовщик</Text>
            </View>
          </View>

          <AppInput label="Название вакансии" value={title} onChangeText={setTitle} placeholder="Кладовщик на склад WB" error={errors.title} />

          {/* Metro */}
          <View style={styles.fieldGroup}>
            <Text style={styles.sectionLabel}>Метро</Text>
            {metroStation ? (
              <View style={styles.metroSelected}>
                <View style={[styles.dot, { backgroundColor: line?.color ?? Colors.blue }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.metroLineTxt}>{metroLineName}</Text>
                  <Text style={styles.metroStTxt}>{metroStation}</Text>
                </View>
                <TouchableOpacity onPress={() => setMetroPicker(true)}>
                  <Text style={styles.changeLink}>Изменить</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.metroField} onPress={() => setMetroPicker(true)}>
                <Text style={styles.metroFieldTxt}>🚇 Выбрать станцию</Text>
                <Text style={{ color: Colors.textMuted, fontSize: 20 }}>›</Text>
              </TouchableOpacity>
            )}
            {errors.metro ? <Text style={styles.errMsg}>{errors.metro}</Text> : null}
            <MetroPicker
              visible={metroPicker}
              onClose={() => setMetroPicker(false)}
              onSelect={(lid, lname, st) => { setMetroLineId(lid); setMetroLineName(lname); setMetroStation(st); setMetroPicker(false); }}
              selectedLineId={metroLineId}
              selectedStation={metroStation}
            />
          </View>

          {/* Date picker */}
          <View style={styles.fieldGroup}>
            <Text style={styles.sectionLabel}>Дата смены</Text>
            <TouchableOpacity style={styles.pickerField} onPress={() => openPicker('date')} activeOpacity={0.8}>
              <Text style={styles.pickerIcon}>📅</Text>
              <Text style={styles.pickerValue}>{formatDisplayDate(selectedDate)}</Text>
              <Text style={styles.pickerArrow}>›</Text>
            </TouchableOpacity>
            {Platform.OS !== 'ios' && pickerMode === 'date' ? (
              <DateTimePicker
                value={selectedDate}
                mode="date"
                display="calendar"
                minimumDate={new Date()}
                onChange={onAndroidChange}
              />
            ) : null}
          </View>

          {/* Time pickers */}
          <View style={styles.fieldGroup}>
            <Text style={styles.sectionLabel}>Время смены</Text>
            <View style={styles.timeRow}>
              <TouchableOpacity style={[styles.pickerField, { flex: 1 }]} onPress={() => openPicker('timeStart')} activeOpacity={0.8}>
                <Text style={styles.pickerIcon}>⏰</Text>
                <Text style={styles.pickerValue}>{formatTime(selectedTimeStart)}</Text>
              </TouchableOpacity>
              <Text style={styles.timeSep}>–</Text>
              <TouchableOpacity style={[styles.pickerField, { flex: 1 }]} onPress={() => openPicker('timeEnd')} activeOpacity={0.8}>
                <Text style={styles.pickerIcon}>⏰</Text>
                <Text style={styles.pickerValue}>{formatTime(selectedTimeEnd)}</Text>
              </TouchableOpacity>
            </View>
            {Platform.OS !== 'ios' && pickerMode === 'timeStart' ? (
              <DateTimePicker value={selectedTimeStart} mode="time" display="spinner" is24Hour onChange={onAndroidChange} />
            ) : null}
            {Platform.OS !== 'ios' && pickerMode === 'timeEnd' ? (
              <DateTimePicker value={selectedTimeEnd} mode="time" display="spinner" is24Hour onChange={onAndroidChange} />
            ) : null}
          </View>

          <AppInput label="Оплата за смену ₽" value={salary} onChangeText={setSalary} placeholder="2000" keyboardType="numeric" error={errors.salary} />

          <View style={styles.fieldGroup}>
            <Text style={styles.sectionLabel}>Нормативы и оплата</Text>
            <Text style={styles.hint}>Например: 1200 строк — 2500₽, превышение нормы — 50₽/10 строк</Text>
            <TextInput
              style={styles.textarea}
              multiline
              numberOfLines={3}
              value={normsAndPay}
              onChangeText={setNormsAndPay}
              placeholder={'1200 строк — 2500₽\n500 паллет — 3000₽'}
              placeholderTextColor={Colors.textMuted}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.sectionLabel}>Количество мест</Text>
            <View style={styles.stepperRow}>
              <TouchableOpacity style={styles.stepBtn} onPress={() => setWorkersNeeded(n => Math.max(1, n - 1))}>
                <Text style={styles.stepBtnText}>−</Text>
              </TouchableOpacity>
              <Text style={styles.stepNum}>{workersNeeded}</Text>
              <TouchableOpacity style={styles.stepBtn} onPress={() => setWorkersNeeded(n => n + 1)}>
                <Text style={styles.stepBtnText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>🔥 Срочная вакансия</Text>
            <Switch value={isUrgent} onValueChange={setIsUrgent} trackColor={{ false: Colors.inputBorder, true: Colors.primary }} thumbColor="#fff" />
          </View>

          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>🎓 Опыт не требуется</Text>
            <Switch value={noExp} onValueChange={setNoExp} trackColor={{ false: Colors.inputBorder, true: Colors.primary }} thumbColor="#fff" />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.sectionLabel}>Условия работы</Text>
            <TextInput
              style={styles.textarea}
              multiline
              numberOfLines={4}
              value={conditions}
              onChangeText={setConditions}
              placeholder={'Разгрузка и сортировка товаров\nФорма предоставляется\nОплата в конце смены'}
              placeholderTextColor={Colors.textMuted}
            />
          </View>

          <View style={{ marginBottom: 40 }}>
            <PrimaryButton label={isEdit ? '💾 Сохранить изменения' : '📋 Опубликовать вакансию'} onPress={submit} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* iOS Modal picker */}
      {Platform.OS === 'ios' ? (
        <Modal visible={iosPickerVisible} transparent animationType="slide">
          <View style={styles.iosOverlay}>
            <View style={styles.iosSheet}>
              <View style={styles.iosSheetHeader}>
                <TouchableOpacity onPress={() => { setIosPickerVisible(false); setPickerMode(null); }}>
                  <Text style={styles.iosCancelText}>Отмена</Text>
                </TouchableOpacity>
                <Text style={styles.iosSheetTitle}>
                  {pickerMode === 'date' ? 'Дата смены' : pickerMode === 'timeStart' ? 'Начало смены' : 'Конец смены'}
                </Text>
                <TouchableOpacity onPress={confirmIOS}>
                  <Text style={styles.iosDoneText}>Готово</Text>
                </TouchableOpacity>
              </View>
              {pickerMode ? (
                <View style={styles.iosPickerWrap}>
                  <DateTimePicker
                    value={pickerDateValue ?? new Date()}
                    mode={pickerMode === 'date' ? 'date' : 'time'}
                    display="spinner"
                    is24Hour
                    minimumDate={pickerMode === 'date' ? new Date() : undefined}
                    onChange={onIOSChange}
                    style={styles.iosPicker}
                    textColor="#111111"
                  />
                </View>
              ) : null}
            </View>
          </View>
        </Modal>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.divider,
  },
  backText: { fontSize: 15, color: Colors.textSecondary, fontWeight: '500' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  body: { padding: 20, gap: 18, paddingBottom: 20 },
  typeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  typeLabel: { fontSize: 13, color: Colors.textMuted, fontWeight: '500' },
  typeBadge: { backgroundColor: Colors.primaryLight, borderRadius: 100, paddingHorizontal: 14, paddingVertical: 6 },
  typeBadgeText: { fontSize: 13, fontWeight: '700', color: Colors.primary },
  fieldGroup: { gap: 8 },
  sectionLabel: { fontSize: 13, color: Colors.textMuted, fontWeight: '500' },
  hint: { fontSize: 12, color: Colors.textMuted, fontStyle: 'italic', lineHeight: 16 },
  errMsg: { color: Colors.red, fontSize: 12 },
  metroField: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1.5, borderColor: Colors.inputBorder, borderRadius: 12, padding: 16,
  },
  metroFieldTxt: { fontSize: 15, color: Colors.textPrimary },
  metroSelected: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1.5, borderColor: Colors.primary, borderRadius: 12, padding: 14,
    backgroundColor: Colors.primaryLight,
  },
  dot: { width: 12, height: 12, borderRadius: 6 },
  metroLineTxt: { fontSize: 11, color: Colors.textMuted },
  metroStTxt: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary, marginTop: 2 },
  changeLink: { color: Colors.primary, fontSize: 13, fontWeight: '600' },
  pickerField: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1.5, borderColor: Colors.inputBorder, borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14, backgroundColor: Colors.bg,
  },
  pickerIcon: { fontSize: 18 },
  pickerValue: { flex: 1, fontSize: 16, fontWeight: '600', color: Colors.textPrimary },
  pickerArrow: { fontSize: 20, color: Colors.textMuted },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timeSep: { fontSize: 20, color: Colors.textMuted, fontWeight: '600', paddingBottom: 4 },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  stepBtn: {
    width: 44, height: 44, borderRadius: 100, backgroundColor: Colors.surface,
    borderWidth: 1.5, borderColor: Colors.inputBorder, alignItems: 'center', justifyContent: 'center',
  },
  stepBtnText: { fontSize: 22, color: Colors.textPrimary, fontWeight: '600' },
  stepNum: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary, minWidth: 32, textAlign: 'center' },
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.divider,
  },
  toggleLabel: { fontSize: 15, fontWeight: '500', color: Colors.textPrimary },
  textarea: {
    backgroundColor: Colors.bg, borderWidth: 1.5, borderColor: Colors.inputBorder,
    borderRadius: 12, padding: 14, fontSize: 15, color: Colors.textPrimary,
    textAlignVertical: 'top', lineHeight: 22,
  },
  iosOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  iosSheet: { backgroundColor: Colors.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 32 },
  iosPickerWrap: { backgroundColor: '#FFFFFF', width: '100%' },
  iosPicker: { width: '100%', height: 200, backgroundColor: '#FFFFFF' },
  iosSheetHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: Colors.divider,
  },
  iosSheetTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  iosCancelText: { fontSize: 15, color: Colors.textSecondary, fontWeight: '500' },
  iosDoneText: { fontSize: 15, color: Colors.primary, fontWeight: '700' },
});
