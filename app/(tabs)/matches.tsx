import React, { useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, FlatList,
  TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors, Radius, Shadow } from '@/constants/theme';
import { useApp } from '@/hooks/useApp';
import { Like, Vacancy } from '@/constants/types';
import { formatDate, getInitials, nameColorFromString } from '@/services/storage';
import { dbUpsertLike, dbCheckAndCreateMatch } from '@/services/db';
import { notifyMatch } from '@/services/notifications';
import { Chip } from '@/components/ui/Chip';
import { VacancyDetailModal } from '@/components/feature/VacancyDetailModal';

// ─── Worker view ─────────────────────────────────────────────────────────────

function WorkerMatches() {
  const router = useRouter();
  const { currentUser, likes, vacancies, users, refreshAll, showToast } = useApp();
  const [loading, setLoading] = useState<string | null>(null);
  const [detailVacancy, setDetailVacancy] = useState<Vacancy | null>(null);

  if (!currentUser) return null;

  const relevant = likes.filter(
    l => l.workerId === currentUser.id && l.workerLiked && l.employerLiked
  );

  const getVacancy = (id: string) => vacancies.find(v => v.id === id);

  const confirmed = relevant.filter(l => l.isMatch);
  const pending = relevant.filter(l => !l.isMatch);

  const confirmMatch = async (like: Like) => {
    setLoading(like.vacancyId);
    const result = await dbCheckAndCreateMatch(like.vacancyId, currentUser.id);
    if (result.matched) {
      const vac = getVacancy(like.vacancyId);
      await notifyMatch({
        companyName: vac?.company ?? '',
        vacancyTitle: vac?.title ?? '',
        otherName: vac?.company ?? '',
        role: 'worker',
      });
      await refreshAll();
      showToast('🎉 Мэтч! Чат открыт', 'match');
      if (result.chatId) {
        router.push({ pathname: '/chat-room', params: { chatId: result.chatId } });
      }
    }
    setLoading(null);
  };

  const decline = async (like: Like) => {
    setLoading(like.vacancyId + '_d');
    await dbUpsertLike(like.vacancyId, currentUser.id, like.employerId, { workerLiked: false });
    await refreshAll();
    setLoading(null);
    showToast('Отклонено', 'success');
  };

  if (relevant.length === 0) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Text style={styles.title}>Мэтчи</Text>
        </View>
        <View style={styles.empty}>
          <Text style={{ fontSize: 48 }}>🤝</Text>
          <Text style={styles.emptyTitle}>Пока нет предложений</Text>
          <Text style={styles.emptySub}>
            Когда работодатель захочет взять вас на смену — предложение появится здесь
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const renderLike = ({ item: like }: { item: Like }) => {
    const vac = getVacancy(like.vacancyId);
    if (!vac) return null;
    const isLoadingConfirm = loading === like.vacancyId;
    const isLoadingDecline = loading === like.vacancyId + '_d';

    if (like.isMatch) {
      return (
        <View style={[styles.card, styles.matchedCard]}>
          <View style={styles.matchBadge}><Text style={styles.matchBadgeText}>🎉 Мэтч!</Text></View>
          <TouchableOpacity activeOpacity={0.8} onPress={() => setDetailVacancy(vac)}>
            <Text style={styles.jobTitle}>{vac.title}</Text>
            <Text style={styles.companyName}>{vac.company}</Text>
          </TouchableOpacity>
          <View style={styles.chipsRow}>
            <Chip label={`📅 ${formatDate(vac.date)}`} variant="date" />
            <Chip label={`⏰ ${vac.timeStart}–${vac.timeEnd}`} variant="time" />
            <Chip label={`💰 ${vac.salary.toLocaleString('ru')} ₽`} variant="salary" />
          </View>
          <TouchableOpacity
            style={styles.chatBtn}
            onPress={() => router.push({ pathname: '/(tabs)/chats' })}
            activeOpacity={0.8}
          >
            <Text style={styles.chatBtnText}>💬 Открыть чат</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.card}>
        <View style={styles.offerBadge}><Text style={styles.offerBadgeText}>✅ Работодатель хочет взять вас!</Text></View>
        <TouchableOpacity activeOpacity={0.8} onPress={() => setDetailVacancy(vac)}>
          <Text style={styles.jobTitle}>{vac.title}</Text>
          <Text style={styles.companyName}>{vac.company} · 🚇 {vac.metroStation}</Text>
        </TouchableOpacity>
        <View style={styles.chipsRow}>
          <Chip label={`📅 ${formatDate(vac.date)}`} variant="date" />
          <Chip label={`⏰ ${vac.timeStart}–${vac.timeEnd}`} variant="time" />
          <Chip label={`💰 ${vac.salary.toLocaleString('ru')} ₽`} variant="salary" />
        </View>
        <TouchableOpacity style={styles.detailLink} onPress={() => setDetailVacancy(vac)}>
          <Text style={styles.detailLinkTxt}>Подробнее о вакансии →</Text>
        </TouchableOpacity>
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.declineBtn, isLoadingDecline && { opacity: 0.5 }]}
            onPress={() => decline(like)}
            disabled={!!loading}
            activeOpacity={0.8}
          >
            {isLoadingDecline ? <ActivityIndicator size="small" color={Colors.red} /> : <Text style={styles.declineBtnText}>✕ Не подходит</Text>}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.acceptBtn, isLoadingConfirm && { opacity: 0.5 }]}
            onPress={() => confirmMatch(like)}
            disabled={!!loading}
            activeOpacity={0.8}
          >
            {isLoadingConfirm ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.acceptBtnText}>✅ Всё подходит!</Text>}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Мэтчи</Text>
        {pending.length > 0 ? (
          <View style={styles.badge}><Text style={styles.badgeText}>{pending.length}</Text></View>
        ) : null}
      </View>
      <FlatList
        data={[...pending, ...confirmed]}
        keyExtractor={l => l.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        renderItem={renderLike}
      />
      <VacancyDetailModal
        vacancy={detailVacancy}
        visible={!!detailVacancy}
        onClose={() => setDetailVacancy(null)}
      />
    </SafeAreaView>
  );
}

// ─── Employer view ────────────────────────────────────────────────────────────

function EmployerMatches() {
  const router = useRouter();
  const { currentUser, likes, vacancies, users, refreshAll, showToast } = useApp();
  const [loading, setLoading] = useState<string | null>(null);
  const [tab, setTab] = useState<'pending' | 'matched'>('pending');

  if (!currentUser) return null;

  const myVacIds = vacancies.filter(v => v.employerId === currentUser.id).map(v => v.id);
  const allLikes = likes.filter(l => myVacIds.includes(l.vacancyId) && l.workerLiked);

  const pending = allLikes.filter(l => !l.isMatch && !l.employerLiked);
  const approved = allLikes.filter(l => l.employerLiked && !l.isMatch);
  const matched = allLikes.filter(l => l.isMatch);

  const getVacancy = (id: string) => vacancies.find(v => v.id === id);
  const getWorker = (id: string) => users.find(u => u.id === id);

  const approve = async (like: Like) => {
    setLoading(like.id);
    await dbUpsertLike(like.vacancyId, like.workerId, currentUser.id, { employerLiked: true });
    const result = await dbCheckAndCreateMatch(like.vacancyId, like.workerId);
    await refreshAll();
    if (result.matched) {
      const vac = getVacancy(like.vacancyId);
      const worker = getWorker(like.workerId);
      const workerName = worker ? `${worker.firstName} ${worker.lastName}` : 'Работник';
      await notifyMatch({
        companyName: vac?.company ?? '',
        vacancyTitle: vac?.title ?? '',
        otherName: workerName,
        role: 'employer',
      });
      showToast(`🎉 Мэтч с ${workerName}! Чат открыт`, 'match');
      if (result.chatId) {
        router.push({ pathname: '/chat-room', params: { chatId: result.chatId } });
      }
    } else {
      showToast('Предложение отправлено работнику', 'success');
    }
    setLoading(null);
  };

  const dismiss = async (like: Like) => {
    setLoading(like.id + '_d');
    await dbUpsertLike(like.vacancyId, like.workerId, currentUser.id, { employerLiked: false, workerLiked: false });
    await refreshAll();
    setLoading(null);
    showToast('Отклонено', 'success');
  };

  const pendingAll = [...pending, ...approved];
  const shown = tab === 'pending' ? pendingAll : matched;

  const renderLike = ({ item: like }: { item: Like }) => {
    const vac = getVacancy(like.vacancyId);
    const worker = getWorker(like.workerId);
    if (!vac || !worker) return null;
    const workerName = `${worker.firstName} ${worker.lastName}`;
    const workerColor = nameColorFromString(worker.id);
    const isApproved = like.employerLiked;
    const isLoading = loading === like.id;
    const isDLoading = loading === like.id + '_d';

    if (like.isMatch) {
      return (
        <View style={[styles.card, styles.matchedCard]}>
          <View style={styles.matchBadge}><Text style={styles.matchBadgeText}>🎉 Мэтч!</Text></View>
          <View style={styles.workerRow}>
            <View style={[styles.avatar, { backgroundColor: workerColor }]}>
              <Text style={styles.avatarText}>{getInitials(workerName)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.workerName}>{workerName}</Text>
              {worker.metroStation ? <Text style={styles.metroHint}>🚇 {worker.metroStation}</Text> : null}
            </View>
            <View style={styles.phoneReveal}>
              <Text style={styles.phoneRevealText}>{worker.phone}</Text>
            </View>
          </View>
          <Text style={styles.vacLabel}>{vac.title} · {formatDate(vac.date)}</Text>
          <TouchableOpacity
            style={styles.chatBtn}
            onPress={() => router.push({ pathname: '/(tabs)/chats' })}
            activeOpacity={0.8}
          >
            <Text style={styles.chatBtnText}>💬 Открыть чат</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.card}>
        {isApproved ? (
          <View style={styles.waitingBadge}><Text style={styles.waitingBadgeText}>⏳ Ждём подтверждения работника</Text></View>
        ) : null}
        <View style={styles.workerRow}>
          <View style={[styles.avatar, { backgroundColor: workerColor }]}>
            <Text style={styles.avatarText}>{getInitials(workerName)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.workerName}>{workerName}</Text>
            {worker.age ? <Text style={styles.metroHint}>{worker.age} лет</Text> : null}
            {worker.metroStation ? <Text style={styles.metroHint}>🚇 {worker.metroStation}</Text> : null}
          </View>
          <View style={styles.hiddenPhone}>
            <Text style={styles.hiddenPhoneText}>●●●●●●</Text>
          </View>
        </View>
        <Text style={styles.vacLabel}>{vac.title} · {formatDate(vac.date)} · {vac.salary.toLocaleString('ru')} ₽</Text>

        {!isApproved ? (
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.declineBtn, isDLoading && { opacity: 0.5 }]}
              onPress={() => dismiss(like)}
              disabled={!!loading}
              activeOpacity={0.8}
            >
              {isDLoading ? <ActivityIndicator size="small" color={Colors.red} /> : <Text style={styles.declineBtnText}>✕ Пропустить</Text>}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.acceptBtn, isLoading && { opacity: 0.5 }]}
              onPress={() => approve(like)}
              disabled={!!loading}
              activeOpacity={0.8}
            >
              {isLoading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.acceptBtnText}>✅ Взять!</Text>}
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Мэтчи</Text>
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity style={styles.tabItem} onPress={() => setTab('pending')} activeOpacity={0.8}>
          <Text style={[styles.tabLabel, tab === 'pending' && styles.tabLabelActive]}>
            Отклики {pendingAll.length > 0 ? `(${pendingAll.length})` : ''}
          </Text>
          {tab === 'pending' ? <View style={styles.tabUnderline} /> : null}
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem} onPress={() => setTab('matched')} activeOpacity={0.8}>
          <Text style={[styles.tabLabel, tab === 'matched' && styles.tabLabelActive]}>
            Мэтчи {matched.length > 0 ? `(${matched.length})` : ''}
          </Text>
          {tab === 'matched' ? <View style={styles.tabUnderline} /> : null}
        </TouchableOpacity>
      </View>

      {shown.length === 0 ? (
        <View style={styles.empty}>
          <Text style={{ fontSize: 48 }}>{tab === 'pending' ? '📥' : '🤝'}</Text>
          <Text style={styles.emptyTitle}>{tab === 'pending' ? 'Нет откликов' : 'Нет мэтчей'}</Text>
          <Text style={styles.emptySub}>
            {tab === 'pending'
              ? 'Когда работники откликнутся на ваши вакансии — они появятся здесь'
              : 'Мэтчи появляются когда обе стороны подтвердили сотрудничество'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={shown}
          keyExtractor={l => l.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={renderLike}
        />
      )}
    </SafeAreaView>
  );
}

export default function MatchesScreen() {
  const { currentUser } = useApp();
  if (!currentUser) return null;
  return currentUser.role === 'worker' ? <WorkerMatches /> : <EmployerMatches />;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.divider,
  },
  title: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary, flex: 1 },
  badge: { backgroundColor: Colors.primary, borderRadius: 100, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: Colors.divider },
  tabItem: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  tabLabel: { fontSize: 14, fontWeight: '500', color: Colors.textMuted },
  tabLabelActive: { fontWeight: '700', color: Colors.textPrimary },
  tabUnderline: { position: 'absolute', bottom: 0, left: '20%', right: '20%', height: 2, backgroundColor: Colors.primary, borderRadius: 1 },
  list: { padding: 16, gap: 12, paddingBottom: 100 },
  card: { backgroundColor: Colors.bg, borderRadius: Radius.lg, padding: 16, ...Shadow.card, gap: 10 },
  matchedCard: { borderWidth: 1.5, borderColor: Colors.green },
  offerBadge: { backgroundColor: Colors.greenLight, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, alignSelf: 'flex-start' },
  offerBadgeText: { color: Colors.green, fontSize: 13, fontWeight: '700' },
  matchBadge: { backgroundColor: Colors.primaryLight, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, alignSelf: 'flex-start' },
  matchBadgeText: { color: Colors.primary, fontSize: 13, fontWeight: '700' },
  waitingBadge: { backgroundColor: '#FFF7ED', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, alignSelf: 'flex-start' },
  waitingBadgeText: { color: '#92400E', fontSize: 12, fontWeight: '600' },
  jobTitle: { fontSize: 17, fontWeight: '800', color: Colors.textPrimary, lineHeight: 22 },
  companyName: { fontSize: 13, color: Colors.textMuted, marginTop: 2 },
  workerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  workerName: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  metroHint: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  vacLabel: { fontSize: 13, color: Colors.textMuted },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  detailLink: { alignSelf: 'flex-start' },
  detailLinkTxt: { fontSize: 13, color: Colors.primary, fontWeight: '600' },
  phoneReveal: { backgroundColor: Colors.primaryLight, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  phoneRevealText: { color: Colors.primary, fontSize: 12, fontWeight: '700' },
  hiddenPhone: { backgroundColor: Colors.surface, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  hiddenPhoneText: { color: Colors.textMuted, fontSize: 13 },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  declineBtn: { flex: 1, borderWidth: 1.5, borderColor: Colors.red, borderRadius: 100, paddingVertical: 11, alignItems: 'center' },
  declineBtnText: { color: Colors.red, fontSize: 14, fontWeight: '600' },
  acceptBtn: { flex: 1, backgroundColor: Colors.primary, borderRadius: 100, paddingVertical: 11, alignItems: 'center' },
  acceptBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  chatBtn: { backgroundColor: Colors.blue, borderRadius: 100, paddingVertical: 11, alignItems: 'center' },
  chatBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingBottom: 80 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, marginTop: 12 },
  emptySub: { fontSize: 14, color: Colors.textMuted, textAlign: 'center', marginTop: 6, lineHeight: 20 },
});
