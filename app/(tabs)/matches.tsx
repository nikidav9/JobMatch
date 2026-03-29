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
import { dbUpsertLike, dbCheckAndCreateMatch, dbConfirmShift, dbSubmitRatingAndMaybeDelete } from '@/services/db';
import { notifyMatch, notifyShiftConfirmed } from '@/services/notifications';
import { Chip } from '@/components/ui/Chip';
import { VacancyDetailModal } from '@/components/feature/VacancyDetailModal';

function MatchStatus({ like }: { like: Like }) {
  if (like.shiftCompleted) {
    return <View style={[styles.statusBadge, { backgroundColor: '#D1FAE5' }]}><Text style={[styles.statusTxt, { color: Colors.green }]}>✅ Смена подтверждена</Text></View>;
  }
  if (like.isMatch) {
    if (like.workerConfirmed && !like.employerConfirmed) return <View style={[styles.statusBadge, { backgroundColor: '#FFF7ED' }]}><Text style={[styles.statusTxt, { color: '#92400E' }]}>⏳ Ожидает работодателя</Text></View>;
    if (like.employerConfirmed && !like.workerConfirmed) return <View style={[styles.statusBadge, { backgroundColor: '#FFF7ED' }]}><Text style={[styles.statusTxt, { color: '#92400E' }]}>⏳ Ожидает подтверждения</Text></View>;
    return <View style={[styles.statusBadge, { backgroundColor: Colors.primaryLight }]}><Text style={[styles.statusTxt, { color: Colors.primary }]}>🎉 Мэтч!</Text></View>;
  }
  if (like.employerLiked && !like.isMatch) return <View style={[styles.statusBadge, { backgroundColor: '#D1FAE5' }]}><Text style={[styles.statusTxt, { color: Colors.green }]}>✅ Работодатель хочет взять вас!</Text></View>;
  return <View style={[styles.statusBadge, { backgroundColor: Colors.surface }]}><Text style={[styles.statusTxt, { color: Colors.textMuted }]}>⏳ Ожидает ответа</Text></View>;
}

// ─── Worker view ─────────────────────────────────────────────────────────────

function WorkerMatches() {
  const router = useRouter();
  const { currentUser, likes, vacancies, users, refreshAll, showToast } = useApp();
  const [loading, setLoading] = useState<string | null>(null);
  const [detailVacancy, setDetailVacancy] = useState<Vacancy | null>(null);

  if (!currentUser) return null;

  const relevant = likes.filter(
    l => l.workerId === currentUser.id && l.workerLiked && (l.employerLiked || l.isMatch)
  );

  const getVacancy = (id: string) => vacancies.find(v => v.id === id);

  const pending = relevant.filter(l => !l.isMatch && l.employerLiked);
  const matched = relevant.filter(l => l.isMatch && !l.shiftCompleted);
  const completed = relevant.filter(l => l.shiftCompleted);
  const allItems = [...pending, ...matched, ...completed];

  const confirmMatch = async (like: Like) => {
    setLoading(like.vacancyId);
    const result = await dbCheckAndCreateMatch(like.vacancyId, currentUser.id);
    if (result.matched) {
      const vac = getVacancy(like.vacancyId);
      await notifyMatch({ companyName: vac?.company ?? '', vacancyTitle: vac?.title ?? '', otherName: vac?.company ?? '', role: 'worker' });
      await refreshAll();
      showToast('🎉 Мэтч! Чат открыт', 'match');
      if (result.chatId) router.push({ pathname: '/chat-room', params: { chatId: result.chatId } });
    }
    setLoading(null);
  };

  const confirmShift = async (like: Like) => {
    setLoading(like.id + '_shift');
    const { bothConfirmed } = await dbConfirmShift(like.id, 'worker');
    await refreshAll();
    if (bothConfirmed) {
      const vac = getVacancy(like.vacancyId);
      const employer = users.find(u => u.id === like.employerId);
      const employerName = employer ? (employer.company ?? `${employer.firstName} ${employer.lastName}`) : 'Работодатель';

      // Notify employer
      await notifyShiftConfirmed({ role: 'employer', otherName: `${currentUser.firstName} ${currentUser.lastName}`, vacancyTitle: vac?.title ?? '' });

      showToast('Смена подтверждена! Оцените работодателя 🌟', 'success');
      if (employer && vac) {
        router.push({
          pathname: '/rate',
          params: { likeId: like.id, toUserId: employer.id, toName: employerName, vacancyId: vac.id, role: 'worker' },
        });
      }
    } else {
      showToast('Выход подтверждён! Ждём работодателя', 'success');
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

  if (allItems.length === 0) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}><Text style={styles.title}>Мэтчи</Text></View>
        <View style={styles.empty}>
          <Text style={{ fontSize: 48 }}>🤝</Text>
          <Text style={styles.emptyTitle}>Пока нет предложений</Text>
          <Text style={styles.emptySub}>Когда работодатель захочет взять вас на смену — появится здесь</Text>
        </View>
      </SafeAreaView>
    );
  }

  const renderLike = ({ item: like }: { item: Like }) => {
    const vac = getVacancy(like.vacancyId);
    if (!vac) return null;
    const isLoadingConfirm = loading === like.vacancyId;
    const isLoadingDecline = loading === like.vacancyId + '_d';
    const isLoadingShift = loading === like.id + '_shift';
    const isMatched = like.isMatch;
    const isCompleted = like.shiftCompleted;
    const workerAlreadyConfirmed = like.workerConfirmed;

    return (
      <View style={[styles.card, isMatched && !isCompleted && styles.matchedCard, isCompleted && styles.completedCard]}>
        <MatchStatus like={like} />

        <TouchableOpacity activeOpacity={0.8} onPress={() => setDetailVacancy(vac)}>
          <Text style={styles.jobTitle}>{vac.title}</Text>
          <Text style={styles.companyName}>{vac.company} · 🚇 {vac.metroStation}</Text>
        </TouchableOpacity>

        <View style={styles.chipsRow}>
          <Chip label={`📅 ${formatDate(vac.date)}`} variant="date" />
          <Chip label={`⏰ ${vac.timeStart}–${vac.timeEnd}`} variant="time" />
        </View>

        {!isMatched ? (
          <View style={styles.actionRow}>
            <TouchableOpacity style={[styles.declineBtn, isLoadingDecline && { opacity: 0.5 }]} onPress={() => decline(like)} disabled={!!loading} activeOpacity={0.8}>
              {isLoadingDecline ? <ActivityIndicator size="small" color={Colors.red} /> : <Text style={styles.declineBtnText}>✕ Не подходит</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={[styles.acceptBtn, isLoadingConfirm && { opacity: 0.5 }]} onPress={() => confirmMatch(like)} disabled={!!loading} activeOpacity={0.8}>
              {isLoadingConfirm ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.acceptBtnText}>✅ Всё подходит!</Text>}
            </TouchableOpacity>
          </View>
        ) : !isCompleted ? (
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.chatBtn} onPress={() => router.push({ pathname: '/(tabs)/chats' })} activeOpacity={0.8}>
              <Text style={styles.chatBtnText}>💬 Чат</Text>
            </TouchableOpacity>
            {!workerAlreadyConfirmed ? (
              <TouchableOpacity style={[styles.confirmShiftBtn, isLoadingShift && { opacity: 0.5 }]} onPress={() => confirmShift(like)} disabled={!!loading} activeOpacity={0.8}>
                {isLoadingShift ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.confirmShiftBtnTxt}>✔ Подтверждаю выход</Text>}
              </TouchableOpacity>
            ) : (
              <View style={styles.waitingShiftBtn}><Text style={styles.waitingShiftTxt}>⏳ Ждём работодателя</Text></View>
            )}
          </View>
        ) : (
          <TouchableOpacity style={styles.chatBtn} onPress={() => router.push({ pathname: '/(tabs)/chats' })} activeOpacity={0.8}>
            <Text style={styles.chatBtnText}>💬 Открыть чат</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Мэтчи</Text>
        {pending.length > 0 ? <View style={styles.badge}><Text style={styles.badgeText}>{pending.length}</Text></View> : null}
      </View>
      <FlatList data={allItems} keyExtractor={l => l.id} contentContainerStyle={styles.list} showsVerticalScrollIndicator={false} renderItem={renderLike} />
      <VacancyDetailModal vacancy={detailVacancy} visible={!!detailVacancy} onClose={() => setDetailVacancy(null)} />
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
      await notifyMatch({ companyName: vac?.company ?? '', vacancyTitle: vac?.title ?? '', otherName: workerName, role: 'employer' });
      showToast(`🎉 Мэтч с ${workerName}! Чат открыт`, 'match');
      if (result.chatId) router.push({ pathname: '/chat-room', params: { chatId: result.chatId } });
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

  const confirmShift = async (like: Like) => {
    setLoading(like.id + '_shift');
    const { bothConfirmed } = await dbConfirmShift(like.id, 'employer');
    await refreshAll();
    if (bothConfirmed) {
      const worker = getWorker(like.workerId);
      const vac = getVacancy(like.vacancyId);
      const workerName = worker ? `${worker.firstName} ${worker.lastName}` : 'Работник';

      // Notify worker
      await notifyShiftConfirmed({ role: 'worker', otherName: workerName, vacancyTitle: vac?.title ?? '' });

      showToast('Смена подтверждена! Оцените работника 🌟', 'success');
      if (worker && vac) {
        router.push({
          pathname: '/rate',
          params: { likeId: like.id, toUserId: worker.id, toName: workerName, vacancyId: vac.id, role: 'employer' },
        });
      }
    } else {
      showToast('Подтверждено! Ждём работника', 'success');
    }
    setLoading(null);
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
    const isShiftLoading = loading === like.id + '_shift';
    const employerAlreadyConfirmed = like.employerConfirmed;

    if (like.isMatch) {
      return (
        <View style={[styles.card, like.shiftCompleted ? styles.completedCard : styles.matchedCard]}>
          <MatchStatus like={like} />
          <View style={styles.workerRow}>
            <View style={[styles.avatar, { backgroundColor: workerColor }]}>
              <Text style={styles.avatarText}>{getInitials(workerName)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.workerName}>{workerName}</Text>
              {worker.age ? <Text style={styles.metroHint}>{worker.age} лет</Text> : null}
              {worker.metroStation ? <Text style={styles.metroHint}>🚇 {worker.metroStation}</Text> : null}
              {(worker.avgRating ?? 0) > 0 ? <Text style={styles.metroHint}>⭐ {(worker.avgRating ?? 0).toFixed(1)} ({worker.ratingCount} отз.)</Text> : null}
            </View>
            <View style={styles.phoneReveal}>
              <Text style={styles.phoneRevealText}>{worker.phone}</Text>
            </View>
          </View>
          <Text style={styles.vacLabel}>{vac.title} · {formatDate(vac.date)}</Text>
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.chatBtn} onPress={() => router.push({ pathname: '/(tabs)/chats' })} activeOpacity={0.8}>
              <Text style={styles.chatBtnText}>💬 Чат</Text>
            </TouchableOpacity>
            {!like.shiftCompleted && !employerAlreadyConfirmed ? (
              <TouchableOpacity style={[styles.confirmShiftBtn, isShiftLoading && { opacity: 0.5 }]} onPress={() => confirmShift(like)} disabled={!!loading} activeOpacity={0.8}>
                {isShiftLoading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.confirmShiftBtnTxt}>✔ Подтверждаю</Text>}
              </TouchableOpacity>
            ) : !like.shiftCompleted ? (
              <View style={styles.waitingShiftBtn}><Text style={styles.waitingShiftTxt}>⏳ Ждём работника</Text></View>
            ) : null}
          </View>
        </View>
      );
    }

    return (
      <View style={styles.card}>
        {isApproved ? <View style={[styles.statusBadge, { backgroundColor: '#FFF7ED' }]}><Text style={[styles.statusTxt, { color: '#92400E' }]}>⏳ Ждём подтверждения работника</Text></View> : null}
        <View style={styles.workerRow}>
          <View style={[styles.avatar, { backgroundColor: workerColor }]}>
            <Text style={styles.avatarText}>{getInitials(workerName)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.workerName}>{workerName}</Text>
            {worker.age ? <Text style={styles.metroHint}>{worker.age} лет</Text> : null}
            {worker.metroStation ? <Text style={styles.metroHint}>🚇 {worker.metroStation}</Text> : null}
          </View>
          <View style={styles.hiddenPhone}><Text style={styles.hiddenPhoneText}>●●●●●●</Text></View>
        </View>
        <Text style={styles.vacLabel}>{vac.title} · {formatDate(vac.date)}</Text>

        {!isApproved ? (
          <View style={styles.actionRow}>
            <TouchableOpacity style={[styles.declineBtn, isDLoading && { opacity: 0.5 }]} onPress={() => dismiss(like)} disabled={!!loading} activeOpacity={0.8}>
              {isDLoading ? <ActivityIndicator size="small" color={Colors.red} /> : <Text style={styles.declineBtnText}>✕ Пропустить</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={[styles.acceptBtn, isLoading && { opacity: 0.5 }]} onPress={() => approve(like)} disabled={!!loading} activeOpacity={0.8}>
              {isLoading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.acceptBtnText}>✅ Взять!</Text>}
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}><Text style={styles.title}>Мэтчи</Text></View>
      <View style={styles.tabs}>
        {([
          { key: 'pending', label: `Отклики${pendingAll.length > 0 ? ` (${pendingAll.length})` : ''}` },
          { key: 'matched', label: `Мэтчи${matched.length > 0 ? ` (${matched.length})` : ''}` },
        ] as { key: 'pending' | 'matched'; label: string }[]).map(t => (
          <TouchableOpacity key={t.key} style={styles.tabItem} onPress={() => setTab(t.key)} activeOpacity={0.8}>
            <Text style={[styles.tabLabel, tab === t.key && styles.tabLabelActive]}>{t.label}</Text>
            {tab === t.key ? <View style={styles.tabUnderline} /> : null}
          </TouchableOpacity>
        ))}
      </View>

      {shown.length === 0 ? (
        <View style={styles.empty}>
          <Text style={{ fontSize: 48 }}>{tab === 'pending' ? '📥' : '🤝'}</Text>
          <Text style={styles.emptyTitle}>{tab === 'pending' ? 'Нет откликов' : 'Нет мэтчей'}</Text>
          <Text style={styles.emptySub}>{tab === 'pending' ? 'Когда работники откликнутся — они появятся здесь' : 'Мэтчи появятся после взаимного подтверждения'}</Text>
        </View>
      ) : (
        <FlatList data={shown} keyExtractor={l => l.id} contentContainerStyle={styles.list} showsVerticalScrollIndicator={false} renderItem={renderLike} />
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
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: Colors.divider },
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
  completedCard: { borderWidth: 1.5, borderColor: Colors.blue, opacity: 0.8 },
  statusBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, alignSelf: 'flex-start' },
  statusTxt: { fontSize: 13, fontWeight: '700' },
  jobTitle: { fontSize: 17, fontWeight: '800', color: Colors.textPrimary, lineHeight: 22 },
  companyName: { fontSize: 13, color: Colors.textMuted, marginTop: 2 },
  workerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  workerName: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  metroHint: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  vacLabel: { fontSize: 13, color: Colors.textMuted },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  phoneReveal: { backgroundColor: Colors.primaryLight, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  phoneRevealText: { color: Colors.primary, fontSize: 12, fontWeight: '700' },
  hiddenPhone: { backgroundColor: Colors.surface, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  hiddenPhoneText: { color: Colors.textMuted, fontSize: 13 },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  declineBtn: { flex: 1, borderWidth: 1.5, borderColor: Colors.red, borderRadius: 100, paddingVertical: 11, alignItems: 'center' },
  declineBtnText: { color: Colors.red, fontSize: 14, fontWeight: '600' },
  acceptBtn: { flex: 1, backgroundColor: Colors.primary, borderRadius: 100, paddingVertical: 11, alignItems: 'center' },
  acceptBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  chatBtn: { flex: 1, backgroundColor: Colors.blue, borderRadius: 100, paddingVertical: 11, alignItems: 'center' },
  chatBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  confirmShiftBtn: { flex: 2, backgroundColor: Colors.green, borderRadius: 100, paddingVertical: 11, alignItems: 'center' },
  confirmShiftBtnTxt: { color: '#fff', fontSize: 14, fontWeight: '700' },
  waitingShiftBtn: { flex: 2, backgroundColor: Colors.surface, borderRadius: 100, paddingVertical: 11, alignItems: 'center', borderWidth: 1, borderColor: Colors.inputBorder },
  waitingShiftTxt: { color: Colors.textMuted, fontSize: 13, fontWeight: '500' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingBottom: 80 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, marginTop: 12 },
  emptySub: { fontSize: 14, color: Colors.textMuted, textAlign: 'center', marginTop: 6, lineHeight: 20 },
});
