import React, { useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, Modal, KeyboardAvoidingView, Platform,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Colors, Radius, Shadow } from '@/constants/theme';
import { useApp } from '@/hooks/useApp';
import { getInitials, nameColorFromString } from '@/services/storage';
import { dbUpsertUser } from '@/services/db';
import { getSupabaseClient } from '@/template';
import { AppInput } from '@/components/ui/AppInput';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { MetroPicker } from '@/components/feature/MetroPicker';
import { WorkTypeSelector } from '@/components/feature/WorkTypeSelector';
import { WorkType } from '@/constants/types';
import { METRO_LINES } from '@/constants/metro';

type EditSection = 'personal' | 'metro' | 'worktypes' | 'company' | null;

function StarRating({ rating, count }: { rating: number; count: number }) {
  return (
    <View style={rS.row}>
      {[1, 2, 3, 4, 5].map(s => (
        <Text key={s} style={[rS.star, rating >= s - 0.5 ? rS.starFilled : rS.starEmpty]}>★</Text>
      ))}
      <Text style={rS.count}>
        {count > 0 ? `${rating.toFixed(1)} (${count} отз.)` : 'Нет оценок'}
      </Text>
    </View>
  );
}

const rS = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 6 },
  star: { fontSize: 18 },
  starFilled: { color: '#FBBF24' },
  starEmpty: { color: '#E5E7EB' },
  count: { fontSize: 13, color: Colors.textMuted, marginLeft: 4 },
});

export default function ProfileScreen() {
  const router = useRouter();
  const { currentUser, setCurrentUser, users, refreshUsers, showToast } = useApp();
  const [editSection, setEditSection] = useState<EditSection>(null);
  const [showConfirmLogout, setShowConfirmLogout] = useState(false);
  const [metroPicker, setMetroPicker] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const [editPhone, setEditPhone] = useState('');
  const [editLast, setEditLast] = useState('');
  const [editFirst, setEditFirst] = useState('');
  const [editMetroLineId, setEditMetroLineId] = useState('');
  const [editMetroLineName, setEditMetroLineName] = useState('');
  const [editMetroStation, setEditMetroStation] = useState('');
  const [editWorkTypes, setEditWorkTypes] = useState<WorkType[]>([]);
  const [editCompany, setEditCompany] = useState('');

  if (!currentUser) return null;

  const initials = getInitials(`${currentUser.firstName} ${currentUser.lastName}`);
  const avatarColor = nameColorFromString(currentUser.id);
  const line = METRO_LINES.find(l => l.id === currentUser.metroLineId);

  const openEdit = (section: EditSection) => {
    setEditSection(section);
    setEditPhone(currentUser.phone);
    setEditLast(currentUser.lastName);
    setEditFirst(currentUser.firstName);
    setEditMetroLineId(currentUser.metroLineId ?? '');
    setEditMetroStation(currentUser.metroStation ?? '');
    setEditMetroLineName(line?.name ?? '');
    setEditWorkTypes((currentUser.workTypes ?? []) as WorkType[]);
    setEditCompany(currentUser.company ?? '');
  };

  const saveEdit = async () => {
    const updated = { ...currentUser };
    if (editSection === 'personal') { updated.phone = editPhone; updated.lastName = editLast; updated.firstName = editFirst; }
    if (editSection === 'metro') { updated.metroLineId = editMetroLineId; updated.metroStation = editMetroStation; }
    if (editSection === 'worktypes') updated.workTypes = editWorkTypes;
    if (editSection === 'company') updated.company = editCompany;
    await dbUpsertUser(updated);
    await refreshUsers();
    await setCurrentUser(updated);
    showToast('Сохранено', 'success');
    setEditSection(null);
  };

  const pickAndUploadPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showToast('Нет доступа к галерее', 'error');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: true,
    });

    if (result.canceled || !result.assets[0]) return;

    setUploadingPhoto(true);
    try {
      const asset = result.assets[0];
      const base64 = asset.base64!;
      const extension = asset.uri.split('.').pop()?.toLowerCase() ?? 'jpg';
      const mimeType = extension === 'png' ? 'image/png' : 'image/jpeg';
      const fileName = `avatar_${currentUser.id}.${extension}`;

      const sb = getSupabaseClient();

      // Convert base64 to Uint8Array for upload
      const byteChars = atob(base64);
      const byteArr = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) {
        byteArr[i] = byteChars.charCodeAt(i);
      }

      const { error: uploadError } = await sb.storage
        .from('avatars')
        .upload(fileName, byteArr, {
          contentType: mimeType,
          upsert: true,
        });

      if (uploadError) {
        showToast('Ошибка загрузки фото', 'error');
        console.error('upload error', uploadError);
        return;
      }

      const { data: urlData } = sb.storage.from('avatars').getPublicUrl(fileName);
      const avatarUrl = urlData.publicUrl;

      const updated = { ...currentUser, avatarUrl };
      await dbUpsertUser(updated);
      await refreshUsers();
      await setCurrentUser(updated);
      showToast('Фото обновлено 📷', 'success');
    } catch (e) {
      console.error('photo upload', e);
      showToast('Не удалось загрузить фото', 'error');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const logout = async () => {
    setShowConfirmLogout(false);
    // Clear state first — AuthGuard in _layout.tsx will detect null user and redirect to '/'
    await setCurrentUser(null);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.pageTitle}>Профиль</Text>

        <View style={styles.topCard}>
          {/* Avatar — tappable to change photo */}
          <TouchableOpacity onPress={pickAndUploadPhoto} activeOpacity={0.8} style={styles.avatarWrapper}>
            {currentUser.avatarUrl ? (
              <Image
                source={{ uri: currentUser.avatarUrl }}
                style={styles.bigAvatarImg}
                contentFit="cover"
                transition={200}
              />
            ) : (
              <View style={[styles.bigAvatar, { backgroundColor: avatarColor }]}>
                <Text style={styles.bigAvatarText}>{initials}</Text>
              </View>
            )}
            {uploadingPhoto ? (
              <View style={styles.avatarOverlay}>
                <ActivityIndicator size="small" color="#fff" />
              </View>
            ) : (
              <View style={styles.avatarCameraBtn}>
                <Text style={styles.avatarCameraIcon}>📷</Text>
              </View>
            )}
          </TouchableOpacity>

          <Text style={styles.fullName}>{currentUser.firstName} {currentUser.lastName}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>{currentUser.role === 'worker' ? 'Работник' : 'Работодатель'}</Text>
          </View>
          <Text style={styles.phone}>{currentUser.phone}</Text>
          <StarRating rating={currentUser.avgRating ?? 0} count={currentUser.ratingCount ?? 0} />
        </View>

        {currentUser.role === 'worker' ? (
          <>
            <SectionCard icon="👤" title="Личные данные" onEdit={() => openEdit('personal')}
              rows={[
                { label: 'Телефон', value: currentUser.phone },
                { label: 'Фамилия', value: currentUser.lastName },
                { label: 'Имя', value: currentUser.firstName },
              ]}
            />
            <SectionCard icon="🚇" title="Метро" onEdit={() => openEdit('metro')}
              rows={[
                { label: 'Линия', value: line?.name ?? '—', lineColor: line?.color },
                { label: 'Станция', value: currentUser.metroStation ?? '—' },
              ]}
            />
            <SectionCard icon="💼" title="Специализация" onEdit={() => openEdit('worktypes')} rows={[]} chips={['📦 Кладовщик']} />
          </>
        ) : (
          <>
            <SectionCard icon="👤" title="Личные данные" onEdit={() => openEdit('personal')}
              rows={[
                { label: 'Телефон', value: currentUser.phone },
                { label: 'Фамилия', value: currentUser.lastName },
                { label: 'Имя', value: currentUser.firstName },
              ]}
            />
            <SectionCard icon="🏢" title="Компания" onEdit={() => openEdit('company')} rows={[{ label: 'Название', value: currentUser.company ?? '—' }]} />
          </>
        )}

        <TouchableOpacity style={styles.logoutBtn} onPress={() => setShowConfirmLogout(true)}>
          <Text style={styles.logoutText}>Выйти из аккаунта</Text>
        </TouchableOpacity>

        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Edit modal */}
      <Modal visible={!!editSection} animationType="slide" transparent>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.modalSheet}>
            <View style={styles.handle} />
            <Text style={styles.modalTitle}>Изменить</Text>

            {editSection === 'personal' && (
              <View style={{ gap: 12 }}>
                <AppInput label="Телефон" value={editPhone} onChangeText={setEditPhone} keyboardType="phone-pad" />
                <AppInput label="Фамилия" value={editLast} onChangeText={setEditLast} />
                <AppInput label="Имя" value={editFirst} onChangeText={setEditFirst} />
              </View>
            )}
            {editSection === 'metro' && (
              <View style={{ gap: 12 }}>
                {editMetroStation ? (
                  <View style={styles.metroRow}>
                    <View style={[styles.dot, { backgroundColor: METRO_LINES.find(l => l.id === editMetroLineId)?.color }]} />
                    <Text style={styles.metroVal}>{editMetroStation}</Text>
                    <TouchableOpacity onPress={() => setMetroPicker(true)}>
                      <Text style={{ color: Colors.primary, fontWeight: '600' }}>Изменить</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.metroPickBtn} onPress={() => setMetroPicker(true)}>
                    <Text style={{ color: Colors.textPrimary }}>🚇 Выбрать станцию</Text>
                    <Text style={{ color: Colors.textMuted }}>›</Text>
                  </TouchableOpacity>
                )}
                <MetroPicker
                  visible={metroPicker}
                  onClose={() => setMetroPicker(false)}
                  onSelect={(lid, lname, st) => { setEditMetroLineId(lid); setEditMetroLineName(lname); setEditMetroStation(st); setMetroPicker(false); }}
                  selectedLineId={editMetroLineId}
                  selectedStation={editMetroStation}
                />
              </View>
            )}
            {editSection === 'worktypes' && (
              <WorkTypeSelector selected={editWorkTypes} onToggle={t => setEditWorkTypes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])} />
            )}
            {editSection === 'company' && (
              <AppInput label="Название компании" value={editCompany} onChangeText={setEditCompany} placeholder="ООО МегаСклад" />
            )}

            <View style={{ marginTop: 20, gap: 10 }}>
              <PrimaryButton label="Сохранить" onPress={saveEdit} />
              <PrimaryButton label="Отмена" onPress={() => setEditSection(null)} secondary />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Confirm logout */}
      {showConfirmLogout ? (
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>Выйти из аккаунта?</Text>
            <Text style={styles.confirmBody}>Вы сможете войти снова по номеру телефона</Text>
            <View style={styles.confirmBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowConfirmLogout(false)}>
                <Text style={styles.cancelText}>Отмена</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.logoutConfirmBtn} onPress={logout}>
                <Text style={styles.logoutConfirmText}>Выйти</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

function SectionCard({ icon, title, onEdit, rows, chips }: {
  icon: string; title: string; onEdit: () => void;
  rows: { label: string; value: string; lineColor?: string }[];
  chips?: string[];
}) {
  return (
    <View style={sS.card}>
      <View style={sS.header}>
        <Text style={sS.title}>{icon} {title}</Text>
        <TouchableOpacity onPress={onEdit}><Text style={sS.editLink}>Изменить</Text></TouchableOpacity>
      </View>
      {rows.map((r, i) => (
        <View key={i} style={sS.row}>
          <Text style={sS.label}>{r.label}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {r.lineColor ? <View style={[sS.dot, { backgroundColor: r.lineColor }]} /> : null}
            <Text style={sS.value}>{r.value}</Text>
          </View>
        </View>
      ))}
      {chips && chips.length > 0 ? (
        <View style={sS.chipsRow}>
          {chips.map((c, i) => <View key={i} style={sS.chip}><Text style={sS.chipText}>{c}</Text></View>)}
        </View>
      ) : null}
    </View>
  );
}

const sS = StyleSheet.create({
  card: { backgroundColor: Colors.bg, borderRadius: Radius.lg, padding: 16, ...Shadow.card, marginBottom: 12 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  editLink: { fontSize: 13, fontWeight: '600', color: Colors.primary },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderTopWidth: 1, borderTopColor: Colors.divider },
  label: { fontSize: 13, color: Colors.textMuted },
  value: { fontSize: 14, fontWeight: '500', color: Colors.textPrimary },
  dot: { width: 10, height: 10, borderRadius: 5 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  chip: { backgroundColor: Colors.primaryLight, borderRadius: 100, paddingHorizontal: 14, paddingVertical: 6 },
  chipText: { fontSize: 13, fontWeight: '600', color: Colors.primary },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.outerBg ?? Colors.bg },
  scroll: { padding: 16, paddingBottom: 100, gap: 12 },
  pageTitle: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary, marginBottom: 4 },
  topCard: { backgroundColor: Colors.bg, borderRadius: Radius.xl, padding: 24, alignItems: 'center', ...Shadow.card },
  avatarWrapper: { position: 'relative', marginBottom: 0 },
  bigAvatarImg: { width: 88, height: 88, borderRadius: 44 },
  bigAvatar: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center' },
  bigAvatarText: { color: '#fff', fontSize: 30, fontWeight: '800' },
  avatarOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: 44, backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarCameraBtn: {
    position: 'absolute', bottom: 0, right: 0,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.bg,
  },
  avatarCameraIcon: { fontSize: 13 },
  fullName: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary, marginTop: 12 },
  roleBadge: { backgroundColor: Colors.primary, borderRadius: 100, paddingHorizontal: 14, paddingVertical: 4, marginTop: 8 },
  roleText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  phone: { fontSize: 14, color: Colors.textMuted, marginTop: 6 },
  logoutBtn: { alignItems: 'center', paddingVertical: 16, marginTop: 8 },
  logoutText: { color: Colors.red, fontSize: 14, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: Colors.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40, gap: 12 },
  handle: { width: 36, height: 4, backgroundColor: Colors.inputBorder, borderRadius: 2, alignSelf: 'center', marginBottom: 8 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  metroRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderWidth: 1.5, borderColor: Colors.primary, borderRadius: 12 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  metroVal: { flex: 1, fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  metroPickBtn: { flexDirection: 'row', justifyContent: 'space-between', padding: 14, borderWidth: 1.5, borderColor: Colors.inputBorder, borderRadius: 12 },
  confirmOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  confirmCard: { backgroundColor: Colors.bg, borderRadius: Radius.xl, padding: 28, width: '100%', gap: 12 },
  confirmTitle: { fontSize: 18, fontWeight: '700', textAlign: 'center', color: Colors.textPrimary },
  confirmBody: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center' },
  confirmBtns: { flexDirection: 'row', gap: 12, marginTop: 8 },
  cancelBtn: { flex: 1, borderWidth: 1.5, borderColor: Colors.inputBorder, borderRadius: 100, paddingVertical: 14, alignItems: 'center' },
  cancelText: { fontSize: 15, fontWeight: '600', color: Colors.textSecondary },
  logoutConfirmBtn: { flex: 1, backgroundColor: Colors.red, borderRadius: 100, paddingVertical: 14, alignItems: 'center' },
  logoutConfirmText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
