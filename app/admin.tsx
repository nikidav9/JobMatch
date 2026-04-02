import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity,
  FlatList, Alert, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors, Radius, Shadow } from '@/constants/theme';
import { getSupabaseClient } from '@/template';
import { formatDate } from '@/services/storage';

const sb = () => getSupabaseClient();

const ADMIN_PHONE = '89933431523';

interface Complaint {
  id: string;
  reporter_id: string;
  reporter_phone: string;
  reporter_company?: string;
  target_id: string;
  target_phone: string;
  target_company?: string;
  complaint_type: string;
  description?: string;
  created_at: string;
}

interface AdminUser {
  id: string;
  phone: string;
  first_name: string;
  last_name: string;
  role: string;
  company?: string;
  is_blocked: boolean;
  password?: string;
}

interface AdminVacancy {
  id: string;
  title: string;
  company: string;
  status: string;
  employer_id: string;
  created_at: string;
}

type Tab = 'worker-complaints' | 'employer-complaints' | 'users' | 'vacancies';

export default function AdminScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('worker-complaints');
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [vacancies, setVacancies] = useState<AdminVacancy[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    const [{ data: c }, { data: u }, { data: v }] = await Promise.all([
      sb().from('jm_complaints').select('*').order('created_at', { ascending: false }),
      sb().from('jm_users').select('id,phone,first_name,last_name,role,company,is_blocked,password').order('created_at', { ascending: false }),
      sb().from('jm_vacancies').select('id,title,company,status,employer_id,created_at').order('created_at', { ascending: false }),
    ]);
    setComplaints((c ?? []) as Complaint[]);
    setUsers((u ?? []) as AdminUser[]);
    setVacancies((v ?? []) as AdminVacancy[]);
    setLoading(false);
  };

  const blockUser = async (userId: string, block: boolean) => {
    await sb().from('jm_users').update({ is_blocked: block }).eq('id', userId);
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_blocked: block } : u));
  };

  const deleteUser = async (userId: string) => {
    Alert.alert(
      'Удалить пользователя',
      'Это действие нельзя отменить. Удалить пользователя?',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: async () => {
            await sb().from('jm_users').delete().eq('id', userId);
            setUsers(prev => prev.filter(u => u.id !== userId));
          },
        },
      ]
    );
  };

  const deleteAllUsersExceptAdmin = async () => {
    const nonAdminUsers = users.filter(u => u.phone !== ADMIN_PHONE);
    if (nonAdminUsers.length === 0) {
      Alert.alert('Нет пользователей для удаления');
      return;
    }
    Alert.alert(
      'Удалить всех пользователей кроме админа',
      `Будет удалено ${nonAdminUsers.length} пользователей. Это действие нельзя отменить.`,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить всех',
          style: 'destructive',
          onPress: async () => {
            const ids = nonAdminUsers.map(u => u.id);
            await sb().from('jm_users').delete().in('id', ids);
            setUsers(prev => prev.filter(u => u.phone === ADMIN_PHONE));
          },
        },
      ]
    );
  };

  const deleteVacancy = async (id: string) => {
    await sb().from('jm_vacancies').update({ status: 'closed' }).eq('id', id);
    setVacancies(prev => prev.map(v => v.id === id ? { ...v, status: 'closed' } : v));
  };

  const workerComplaints = complaints.filter(c => c.complaint_type === 'worker');
  const employerComplaints = complaints.filter(c => c.complaint_type === 'employer');

  const renderComplaint = ({ item }: { item: Complaint }) => (
    <View style={styles.card}>
      <View style={styles.cardRow}>
        <Text style={styles.cardLabel}>От:</Text>
        <Text style={styles.cardVal}>{item.reporter_phone}{item.reporter_company ? ` · ${item.reporter_company}` : ''}</Text>
      </View>
      <View style={styles.cardRow}>
        <Text style={styles.cardLabel}>На:</Text>
        <Text style={styles.cardVal}>{item.target_phone}{item.target_company ? ` · ${item.target_company}` : ''}</Text>
      </View>
      {item.description ? (
        <View style={styles.cardRow}>
          <Text style={styles.cardLabel}>Причина:</Text>
          <Text style={[styles.cardVal, { flex: 1 }]}>{item.description}</Text>
        </View>
      ) : null}
      <Text style={styles.cardDate}>{new Date(item.created_at).toLocaleDateString('ru-RU')}</Text>
    </View>
  );

  const renderUser = ({ item }: { item: AdminUser }) => (
    <View style={[styles.card, item.is_blocked && styles.blockedCard]}>
      <View style={styles.cardRow}>
        <Text style={styles.cardLabel}>{item.role === 'worker' ? '👷' : '🏢'}</Text>
        <Text style={styles.cardVal}>{item.first_name} {item.last_name}</Text>
        {item.is_blocked ? <View style={styles.blockedBadge}><Text style={styles.blockedBadgeTxt}>Заблокирован</Text></View> : null}
      </View>
      <View style={styles.cardRow}>
        <Text style={styles.cardLabel}>Тел:</Text>
        <Text style={styles.cardVal}>{item.phone}</Text>
      </View>
      {item.password ? (
        <View style={styles.cardRow}>
          <Text style={styles.cardLabel}>Пароль:</Text>
          <Text style={[styles.cardVal, { fontFamily: 'monospace', color: Colors.primary }]}>{item.password}</Text>
        </View>
      ) : null}
      {item.company ? (
        <View style={styles.cardRow}>
          <Text style={styles.cardLabel}>Компания:</Text>
          <Text style={styles.cardVal}>{item.company}</Text>
        </View>
      ) : null}
      <TouchableOpacity
        style={[styles.actionBtn, item.is_blocked ? styles.unblockBtn : styles.blockBtn]}
        onPress={() => blockUser(item.id, !item.is_blocked)}
      >
        <Text style={[styles.actionBtnTxt, item.is_blocked ? { color: Colors.green } : { color: Colors.red }]}>
          {item.is_blocked ? 'Разблокировать' : 'Заблокировать'}
        </Text>
      </TouchableOpacity>
      {item.phone !== ADMIN_PHONE && (
        <TouchableOpacity
          style={[styles.actionBtn, styles.deleteBtn]}
          onPress={() => deleteUser(item.id)}
        >
          <Text style={[styles.actionBtnTxt, { color: Colors.red }]}>Удалить</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const formatDateTime = (iso: string) => {
    const d = new Date(iso);
    const date = d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const time = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    return `${date} в ${time}`;
  };

  const renderVacancy = ({ item }: { item: AdminVacancy }) => (
    <View style={styles.card}>
      <View style={styles.cardRow}>
        <Text style={styles.cardLabel}>Вакансия:</Text>
        <Text style={[styles.cardVal, { flex: 1 }]}>{item.title}</Text>
      </View>
      <View style={styles.cardRow}>
        <Text style={styles.cardLabel}>Компания:</Text>
        <Text style={styles.cardVal}>{item.company}</Text>
      </View>
      <View style={styles.cardRow}>
        <Text style={styles.cardLabel}>Статус:</Text>
        <Text style={[styles.cardVal, { color: item.status === 'open' ? Colors.green : Colors.textMuted }]}>
          {item.status === 'open' ? '● Открыта' : '○ Закрыта'}
        </Text>
      </View>
      <View style={styles.cardRow}>
        <Text style={styles.cardLabel}>Опубл.:</Text>
        <Text style={[styles.cardVal, { color: Colors.textMuted, fontSize: 12 }]}>{formatDateTime(item.created_at)}</Text>
      </View>
      {item.status === 'open' ? (
        <TouchableOpacity style={[styles.actionBtn, styles.blockBtn]} onPress={() => deleteVacancy(item.id)}>
          <Text style={[styles.actionBtnTxt, { color: Colors.red }]}>Закрыть вакансию</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );

  const tabData = tab === 'worker-complaints' ? workerComplaints
    : tab === 'employer-complaints' ? employerComplaints
    : [];

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backTxt}>← Назад</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Администрирование</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBar} contentContainerStyle={styles.tabBarContent}>
        {([
          { key: 'worker-complaints', label: `Жалобы работников (${workerComplaints.length})` },
          { key: 'employer-complaints', label: `Жалобы работодателей (${employerComplaints.length})` },
          { key: 'users', label: `Пользователи (${users.length})` },
          { key: 'vacancies', label: `Вакансии (${vacancies.length})` },
        ] as { key: Tab; label: string }[]).map(t => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tabBtn, tab === t.key && styles.tabBtnActive]}
            onPress={() => setTab(t.key)}
          >
            <Text style={[styles.tabBtnTxt, tab === t.key && styles.tabBtnTxtActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View>
      ) : (
        <>
          {(tab === 'worker-complaints' || tab === 'employer-complaints') ? (
            <FlatList
              data={tabData}
              keyExtractor={i => i.id}
              contentContainerStyle={styles.list}
              showsVerticalScrollIndicator={false}
              renderItem={renderComplaint}
              ListEmptyComponent={<View style={styles.center}><Text style={styles.emptyTxt}>Жалоб нет</Text></View>}
            />
          ) : tab === 'users' ? (
            <>
              <View style={styles.bulkActions}>
                <TouchableOpacity style={styles.bulkBtn} onPress={deleteAllUsersExceptAdmin}>
                  <Text style={styles.bulkBtnTxt}>Удалить всех кроме админа</Text>
                </TouchableOpacity>
              </View>
              <FlatList
                data={users}
                keyExtractor={u => u.id}
                contentContainerStyle={styles.list}
                showsVerticalScrollIndicator={false}
                renderItem={renderUser}
              />
            </>
          ) : (
            <FlatList
              data={vacancies}
              keyExtractor={v => v.id}
              contentContainerStyle={styles.list}
              showsVerticalScrollIndicator={false}
              renderItem={renderVacancy}
            />
          )}
        </>
      )}
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
  backTxt: { fontSize: 15, color: Colors.textSecondary, fontWeight: '500', width: 60 },
  headerTitle: { fontSize: 16, fontWeight: '800', color: Colors.textPrimary },
  tabBar: { borderBottomWidth: 1, borderBottomColor: Colors.divider, flexGrow: 0 },
  tabBarContent: { paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  tabBtn: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 100,
    backgroundColor: Colors.surface,
  },
  tabBtnActive: { backgroundColor: Colors.primary },
  tabBtnTxt: { fontSize: 13, color: Colors.textMuted, fontWeight: '500' },
  tabBtnTxtActive: { color: '#fff', fontWeight: '700' },
  list: { padding: 16, gap: 10, paddingBottom: 100 },
  card: { backgroundColor: Colors.bg, borderRadius: Radius.lg, padding: 14, ...Shadow.card, gap: 8 },
  blockedCard: { borderWidth: 1.5, borderColor: Colors.red, opacity: 0.8 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardLabel: { fontSize: 12, color: Colors.textMuted, fontWeight: '500', minWidth: 60 },
  cardVal: { fontSize: 13, color: Colors.textPrimary, fontWeight: '500' },
  cardDate: { fontSize: 11, color: Colors.textMuted, marginTop: 4 },
  blockedBadge: { backgroundColor: '#FEE2E2', borderRadius: 100, paddingHorizontal: 8, paddingVertical: 2 },
  blockedBadgeTxt: { fontSize: 11, color: Colors.red, fontWeight: '600' },
  actionBtn: {
    marginTop: 6, borderWidth: 1.5, borderRadius: 100,
    paddingVertical: 8, alignItems: 'center',
  },
  blockBtn: { borderColor: Colors.red },
  unblockBtn: { borderColor: Colors.green },
  deleteBtn: { borderColor: Colors.red, marginTop: 8 },
  actionBtnTxt: { fontSize: 13, fontWeight: '600' },
  bulkActions: { padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.divider },
  bulkBtn: { backgroundColor: Colors.red, paddingHorizontal: 16, paddingVertical: 10, borderRadius: Radius.md },
  bulkBtnTxt: { color: 'white', fontSize: 14, fontWeight: '600' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyTxt: { fontSize: 15, color: Colors.textMuted, textAlign: 'center' },
});
