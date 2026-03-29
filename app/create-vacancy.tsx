import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, Switch, TextInput,
  KeyboardAvoidingView, Platform, Modal, ActivityIndicator,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors, Radius } from '@/constants/theme';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { MetroPicker } from '@/components/feature/MetroPicker';
import { useApp } from '@/hooks/useApp';
import { uid, nowISO } from '@/services/storage';
import { dbUpsertVacancy } from '@/services/db';
import { Vacancy } from '@/constants/types';
import { METRO_LINES } from '@/constants/metro';

function pad2(n: number) { return n.toString().padStart(2, '0'); }
function formatDisplayDate(d: Date) { return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`; }
function formatISODate(d: Date) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
function formatTime(d: Date) { return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; }
function parseISOToDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(); dt.setFullYear(y, m - 1, d); dt.setHours(0, 0, 0, 0); return dt;
}
function parseTimeToDate(time: string): Date {
  const [h, min] = time.split(':').map(Number);
  const d = new Date(); d.setHours(h, min, 0, 0); return d;
}

// Norm fields — НПО allows 1–999, others 0–20 with decimals
const NORM_FIELDS = [
  { key: 'sborka',      label: 'Сборка товара',          max: 20  },
  { key: 'razmTovara',  label: 'Размещение товара',       max: 20  },
  { key: 'razmMaketa',  label: 'Размещение макета',       max: 20  },
  { key: 'razmMoroza',  label: 'Размещение мороза',       max: 20  },
  { key: 'razmMulti',   label: 'Размещение многоштучки',  max: 20  },
  { key: 'npo',         label: 'НПО',                    max: 999 },
] as const;

type NormKey = typeof NORM_FIELDS[number]['key'];
type Norms = Record<NormKey, string>;

const DEFAULT_NORMS: Norms = { sborka: '', razmTovara: '', razmMaketa: '', razmMoroza: '', razmMulti: '', npo: '' };

function buildNormsText(address: string, norms: Norms): string {
  const lines = NORM_FIELDS.map(f => `— ${f.label}: ${norms[f.key] || '0'} ₽`).join('\n');
  return `📍 Адрес: ${address}\nНормативы:\n${lines}`;
}

type PickerMode = 'date' | 'timeStart' | 'timeEnd' | null;

export default function CreateVacancy() {
  const router = useRouter();
  const { editId } = useLocalSearchParams<{ editId?: string }>();
  const { currentUser, vacancies, refreshVacancies, showToast } = useApp();

  const existing = editId ? vacancies.find(v => v.id === editId) : undefined;
  const isEdit = !!existing;

  const [loadingInit, setLoadingInit] = useState(isEdit);
  const [title, setTitle] = useState('Кладовщик');
  const [address, setAddress] = useState('');
  const [metroLineId, setMetroLineId] = useState('');
  const [metroLineName, setMetroLineName] = useState('');
  const [metroStation, setMetroStation] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedTimeStart, setSelectedTimeStart] = useState<Date>(() => { const d = new Date(); d.setHours(8, 0, 0, 0); return d; });
  const [selectedTimeEnd, setSelectedTimeEnd] = useState<Date>(() => { const d = new Date(); d.setHours(17, 0, 0, 0); return d; });
  const [pickerMode, setPickerMode] = useState<PickerMode>(null);
  const [iosPickerVisible, setIosPickerVisible] = useState(false);
  const [tempDate, setTempDate] = useState<Date>(new Date());
  const [norms, setNorms] = useState<Norms>(DEFAULT_NORMS);
  const [workersNeeded, setWorkersNeeded] = useState(1);
  const [isUrgent, setIsUrgent] = useState(false);
  const [noExp, setNoExp] = useState(true);
  const [metroPicker, setMetroPicker] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!existing) { setLoadingInit(false); return; }
    setTitle(existing.title);
    setAddress(existing.address ?? '');
    setMetroLineId(existing.metroLineId ?? '');
    setMetroStation(existing.metroStation ?? '');
    const ln = METRO_LINES.find(l => l.id === existing.metroLineId);
    setMetroLineName(ln?.name ?? '');
    if (existing.date) setSelectedDate(parseISOToDate(existing.date));
    if (existing.timeStart) setSelectedTimeStart(parseTimeToDate(existing.timeStart));
    if (existing.timeEnd) setSelectedTimeEnd(parseTimeToDate(existing.timeEnd));
    setWorkersNeeded(existing.workersNeeded);
    setIsUrgent(existing.isUrgent);
    setNoExp(existing.noExperienceNeeded);
    setLoadingInit(false);
  }, [existing?.id]);

  const line = METRO_LINES.find(l => l.id === metroLineId);

  const openPicker = (mode: PickerMode) => {
    if (!mode) return;
    setTempDate(mode === 'date' ? selectedDate : mode === 'timeStart' ? selectedTimeStart : selectedTimeEnd);
    if (Platform.OS === 'ios') { setPickerMode(mode); setIosPickerVisible(true); }
    else setPickerMode(mode);
  };

  const onAndroidChange = (event: DateTimePickerEvent, date?: Date) => {
    setPickerMode(null);
    if (event.type === 'dismissed' || !date) return;
    applyDate(pickerMode, date);
  };

  const onIOSChange = (_: DateTimePickerEvent, date?: Date) => { if (date) setTempDate(date); };
  const confirmIOS = () => { applyDate(pickerMode, tempDate); setIosPickerVisible(false); setPickerMode(null); };

  const applyDate = (mode: PickerMode, date: Date) => {
    if (mode === 'date') setSelectedDate(date);
    else if (mode === 'timeStart') setSelectedTimeStart(date);
    else if (mode === 'timeEnd') setSelectedTimeEnd(date);
  };

  const pickerDateValue = pickerMode === 'date'
    ? (Platform.OS === 'ios' ? tempDate : selectedDate)
    : pickerMode === 'timeStart'
    ? (Platform.OS === 'ios' ? tempDate : selectedTimeStart)
    : (Platform.OS === 'ios' ? tempDate : selectedTimeEnd);

  const setNormVal = (key: NormKey, val: string) => {
    // Replace comma with dot (iOS decimal-pad uses locale comma)
    const normalized = val.replace(',', '.');
    // Allow digits and one decimal point only
    const cleaned = normalized.replace(/[^0-9.]/g, '');
    // Prevent multiple dots
    const parts = cleaned.split('.');
    const sanitized = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : cleaned;
    setNorms(prev => ({ ...prev, [key]: sanitized }));
  };

  const normFieldValid = (key: NormKey): boolean => {
    const field = NORM_FIELDS.find(f => f.key === key)!;
    const v = norms[key];
    if (v === '') return false;
    const num = parseFloat(v);
    return !isNaN(num) && num >= 0 && num <= field.max;
  };

  const normsValid = NORM_FIELDS.every(f => normFieldValid(f.key));

  const validate = () => {
    const e: Record<string, string> = {};
    if (!address.trim()) e.address = 'Введите адрес склада';
    if (!metroStation) e.metro = 'Выберите станцию метро';
    if (!normsValid) e.norms = 'Проверьте нормативы (0–20 ₽, НПО: 1–999)';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async () => {
    if (!validate() || !currentUser || saving) return;
    setSaving(true);
    const normsText = buildNormsText(address, norms);
    const vac: Vacancy = {
      id: existing?.id ?? uid(),
      employerId: existing?.employerId ?? currentUser.id,
      company: existing?.company ?? (currentUser.company ?? `${currentUser.firstName} ${currentUser.lastName}`),
      title,
      workType: 'stocker',
      workTypeLabel: 'Кладовщик',
      metroLineId,
      metroStation,
      address,
      date: formatISODate(selectedDate),
      timeStart: formatTime(selectedTimeStart),
      timeEnd: formatTime(selectedTimeEnd),
      salary: 0,
      normsAndPay: normsText,
      workersNeeded,
      workersFound: existing?.workersFound ?? 0,
      isUrgent,
      noExperienceNeeded: noExp,
      conditions: normsText,
      status: existing?.status ?? 'open',
      createdAt: existing?.createdAt ?? nowISO(),
    };
    await dbUpsertVacancy(vac);
    await refreshVacancies();
    showToast(isEdit ? 'Вакансия обновлена ✅' : 'Вакансия опубликована ✅', 'success');
    router.back();
    setSaving(false);
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
            <View style={styles.typeBadge}><Text style={styles.typeBadgeText}>📦 Кладовщик</Text></View>
          </View>

          {/* Address */}
          <View style={styles.fieldGroup}>
            <Text style={styles.sectionLabel}>Адрес склада *</Text>
            <TextInput
              style={[styles.input, errors.address ? styles.inputError : null]}
              value={address}
              onChangeText={setAddress}
              placeholder="ул. Складская, д. 5, Москва"
              placeholderTextColor={Colors.textMuted}
            />
            {errors.address ? <Text style={styles.errMsg}>{errors.address}</Text> : null}
          </View>

          {/* Metro */}
          <View style={styles.fieldGroup}>
            <Text style={styles.sectionLabel}>Метро *</Text>
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

          {/* Date */}
          <View style={styles.fieldGroup}>
            <Text style={styles.sectionLabel}>Дата смены</Text>
            <TouchableOpacity style={styles.pickerField} onPress={() => openPicker('date')} activeOpacity={0.8}>
              <Text style={styles.pickerIcon}>📅</Text>
              <Text style={styles.pickerValue}>{formatDisplayDate(selectedDate)}</Text>
              <Text style={styles.pickerArrow}>›</Text>
            </TouchableOpacity>
            {Platform.OS !== 'ios' && pickerMode === 'date' ? (
              <DateTimePicker value={selectedDate} mode="date" display="calendar" minimumDate={new Date()} onChange={onAndroidChange} />
            ) : null}
          </View>

          {/* Time */}
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

          {/* Norms */}
          <View style={styles.fieldGroup}>
            <Text style={styles.sectionLabel}>Нормативы (₽ за единицу) *</Text>
            <Text style={styles.normHint}>Сборка/размещение: 0–20 ₽ (дробные значения допустимы) · НПО: 1–999</Text>
            {errors.norms ? <Text style={styles.errMsg}>{errors.norms}</Text> : null}
            {NORM_FIELDS.map(f => {
              const v = norms[f.key];
              const num = parseFloat(v);
              const invalid = v !== '' && (isNaN(num) || num < 0 || num > f.max);
              return (
                <View key={f.key} style={styles.normRow}>
                  <Text style={styles.normLabel}>{f.label}</Text>
                  <TextInput
                    style={[styles.normInput, invalid ? styles.inputError : null]}
                    value={v}
                    onChangeText={val => setNormVal(f.key, val)}
                    placeholder={f.key === 'npo' ? '1' : '0'}
                    keyboardType="decimal-pad"
                    placeholderTextColor={Colors.textMuted}
                  />
                  <Text style={styles.normUnit}>₽</Text>
                </View>
              );
            })}
          </View>

          {/* Workers needed */}
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

          {/* Preview */}
          {address.trim() ? (
            <View style={styles.previewBox}>
              <Text style={styles.previewTitle}>Предпросмотр описания</Text>
              <Text style={styles.previewText}>{buildNormsText(address, norms)}</Text>
            </View>
          ) : null}

          <View style={{ marginBottom: 40 }}>
            <TouchableOpacity
              style={[styles.submitBtn, saving && { opacity: 0.6 }]}
              onPress={submit}
              disabled={saving}
              activeOpacity={0.85}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.submitBtnTxt}>
                  {isEdit ? '💾 Сохранить изменения' : '📋 Опубликовать вакансию'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* iOS date/time picker modal */}
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
  sectionLabel: { fontSize: 13, color: Colors.textMuted, fontWeight: '600' },
  normHint: { fontSize: 11, color: Colors.textMuted, lineHeight: 16 },
  errMsg: { color: Colors.red, fontSize: 12 },
  input: {
    borderWidth: 1.5, borderColor: Colors.inputBorder, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 13,
    fontSize: 15, color: Colors.textPrimary, backgroundColor: Colors.bg,
  },
  inputError: { borderColor: Colors.red },
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
  normRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.divider,
  },
  normLabel: { flex: 1, fontSize: 14, color: Colors.textPrimary },
  normInput: {
    width: 72, borderWidth: 1.5, borderColor: Colors.inputBorder, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 8,
    fontSize: 15, fontWeight: '600', color: Colors.textPrimary, textAlign: 'center',
  },
  normUnit: { fontSize: 14, color: Colors.textMuted, width: 16 },
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
  previewBox: {
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    padding: 14, borderWidth: 1, borderColor: Colors.inputBorder,
  },
  previewTitle: { fontSize: 12, color: Colors.textMuted, fontWeight: '600', marginBottom: 8 },
  previewText: { fontSize: 13, color: Colors.textPrimary, lineHeight: 20 },
  submitBtn: {
    backgroundColor: Colors.primary, borderRadius: 100,
    paddingVertical: 16, alignItems: 'center',
  },
  submitBtnTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
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
