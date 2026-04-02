import React, { useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, FlatList,
  TouchableOpacity, ActivityIndicator, RefreshControl,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Colors, Radius, Shadow } from '@/constants/theme';
import { useApp } from '@/hooks/useApp';
import { Like, Vacancy } from '@/constants/types';
import { formatDate, getInitials, nameColorFromString } from '@/services/storage';
import { dbUpsertLike, dbCheckAndCreateMatch, dbSubmitRatingAndMaybeDelete } from '@/services/db';
import {
  notifyWorkerGotMatch,
  notifyEmployerGotMatch,
} from '@/services/notifications';
import { Chip } from '@/components/ui/Chip';
import { VacancyDetailModal } from '@/components/feature/VacancyDetailModal';

// ─── Worker view ─────────────────────────────────────────────────────────────

function WorkerMatches() {
  const router = useRouter();
  const { currentUser, likes, vacancies, users, refreshAll, showToast } = useApp();
  const [loading, setLoading] = useState<string | null>(null);
  const [detailVacancy, setDetailVacancy] = useState<Vacancy | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshAll();
    setRefreshing(false);
  };

  if (!currentUser) return null;

  // Relevant likes: worker liked + employer responded
  const relevant = likes.filter(
    l => l.workerId === currentUser.id && l.workerLiked && (l.employerLiked || l.isMatch)
  );

  const getVacancy = (id: string) => vacancies.find(v => v.id === id);

  // Pending: employer liked but no match yet (waiting on worker to confirm)
  const pending = relevant.filter(l => !l.isMatch && l.employerLiked);
  const matched = relevant.filter(l => l.isMatch);

  const allItems = [...pending, ...matched];

  const confirmMatch = async (like: Like) => {
    setLoading(like.vacancyId);
    try {
      const result = await dbCheckAndCreateMatch(like.vacancyId, currentUser.id);
      if (result.matched) {
        const vac = getVacancy(like.vacancyId);
        await notifyWorkerGotMatch(vac?.company ?? '', vac?.title ?? '');
        await refreshAll();
        showToast('🎉 Мэтч! Чат открыт', 'match');
        if (result.chatId) router.push({ pathname: '/match', params: { vacancyId: like.vacancyId, chatId: result.chatId } });
      }
    } catch {
      showToast('Ошибка', 'error');
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

  const goRate = (like: Like) => {
    const vac = getVacancy(like.vacancyId);
    const employer = users.find(u => u.id === like.employerId);
    if (!vac || !employer) return;
    const toName = employer.company ?? `${employer.firstName} ${employer.lastName}`;
    router.push({ pathname: '/rate', params: { likeId: like.id, toUserId: employer.id, toName, vacancyId: vac.id, role: 'worker' } });
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
    const isMatched = like.isMatch;
    const employer = users.find(u => u.id === like.employerId);
    const workerAlreadyRated = like.workerRated;

    return (
      <View style={[styles.card, isMatched ? styles.matchedCard : null]}>
        {/* Status badge */}
        {isMatched ? (
          <View style={[styles.statusBadge, { backgroundColor: '#D1FAE5' }]}>
            <Text style={[styles.statusTxt, { color: Colors.green }]}>🎉 Мэтч!</Text>
          </View>
        ) : (
          <View style={[styles.statusBadge, { backgroundColor: '#FFF7ED' }]}>
            <Text style={[styles.statusTxt, { color: '#92400E' }]}>✅ Работодатель хочет взять вас!</Text>
          </View>
        )}

        <TouchableOpacity activeOpacity={0.8} onPress={() => setDetailVacancy(vac)}>
          <Text style={styles.jobTitle}>{vac.title}</Text>
          <Text style={styles.companyName}>{vac.company} · 🚇 {vac.metroStation}</Text>
        </TouchableOpacity>

        {/* Employer profile link */}
        {employer ? (
          <TouchableOpacity
            style={styles.profileLink}
            onPress={() => router.push({ pathname: '/user-profile', params: { userId: employer.id } })}
            activeOpacity={0.8}
          >
            {employer.avatarUrl ? (
              <Image source={{ uri: employer.avatarUrl }} style={styles.profileLinkAvatar} contentFit="cover" />
            ) : (
              <View style={[styles.profileLinkAvatar, styles.profileLinkAvatarFallback, { backgroundColor: nameColorFromString(employer.id) }]}>
                <Text style={styles.profileLinkInitials}>{getInitials(employer.firstName + ' ' + employer.lastName)}</Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.profileLinkName}>{employer.company ?? `${employer.firstName} ${employer.lastName}`}</Text>
              {(employer.avgRating ?? 0) > 0 ? (
                <Text style={styles.profileLinkSub}>⭐ {(employer.avgRating ?? 0).toFixed(1)} ({employer.ratingCount} отз.)</Text>
              ) : null}
            </View>
            <Text style={styles.profileLinkArrow}>›</Text>
          </TouchableOpacity>
        ) : null}

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
        ) : (
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.chatBtn} onPress={() => router.push({ pathname: '/(tabs)/chats' })} activeOpacity={0.8}>
              <Text style={styles.chatBtnText}>💬 Чат</Text>
            </TouchableOpacity>
            {!workerAlreadyRated ? (
              <TouchableOpacity style={styles.rateBtn} onPress={() => goRate(like)} activeOpacity={0.8}>
                <Text style={styles.rateBtnTxt}>⭐ Оценить</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        )}
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
        data={allItems}
        keyExtractor={l => l.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} colors={[Colors.primary]} />}
        renderItem={renderLike}
      />
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
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshAll();
    setRefreshing(false);
  };

  if (!currentUser) return null;

  const myVacIds = vacancies.filter(v => v.employerId === currentUser.id).map(v => v.id);
  const allLikes = likes.filter(l => myVacIds.includes(l.vacancyId) && l.workerLiked);

  const pending = allLikes.filter(l => !l.isMatch);
  const matched = allLikes.filter(l => l.isMatch);

  const getVacancy = (id: string) => vacancies.find(v => v.id === id);
  const getWorker = (id: string) => users.find(u => u.id === id);

  const approve = async (like: Like) => {
    setLoading(like.id);
    try {
      await dbUpsertLike(like.vacancyId, like.workerId, currentUser.id, { employerLiked: true });
      const result = await dbCheckAndCreateMatch(like.vacancyId, like.workerId);
      await refreshAll();
      if (result.matched) {
        const vac = getVacancy(like.vacancyId);
        const worker = getWorker(like.workerId);
        const workerName = worker ? `${worker.firstName} ${worker.lastName}` : 'Работник';
        await notifyEmployerGotMatch(workerName, vac?.title ?? '');
        showToast(`🎉 Мэтч с ${workerName}! Чат открыт`, 'match');
        if (result.chatId) router.push({ pathname: '/chat-room', params: { chatId: result.chatId } });
      } else {
        showToast('Предложение отправлено работнику', 'success');
      }
    } catch {
      showToast('Ошибка', 'error');
    }
    setLoading(null);
  };

  const dismiss = async (like: Like) => {
    setLoading(like.id + '_d');
    await dbUpsertLike(like.vacancyId, like.workerId, currentUser.id, { employerLiked: false });
    await refreshAll();
    setLoading(null);
    showToast('Отклонено', 'success');
  };

  const goRate = (like: Like) => {
    const worker = getWorker(like.workerId);
    const vac = getVacancy(like.vacancyId);
    if (!worker || !vac) return;
    const toName = `${worker.firstName} ${worker.lastName}`;
    router.push({ pathname: '/rate', params: { likeId: like.id, toUserId: worker.id, toName, vacancyId: vac.id, role: 'employer' } });
  };

  const shown = tab === 'pending' ? pending : matched;

  const renderLike = ({ item: like }: { item: Like }) => {
    const vac = getVacancy(like.vacancyId);
    const worker = getWorker(like.workerId);
    if (!vac || !worker) return null;
    const workerName = `${worker.firstName} ${worker.lastName}`;
    const workerColor = nameColorFromString(worker.id);
    const isLoading = loading === like.id;
    const isDLoading = loading === like.id + '_d';
    const employerAlreadyRated = like.employerRated;
    const approvedNotMatched = like.employerLiked && !like.isMatch;

    return (
      <View style={[styles.card, like.isMatch ? styles.matchedCard : null]}>
        {approvedNotMatched ? (
          <View style={[styles.statusBadge, { backgroundColor: '#FFF7ED' }]}>
            <Text style={[styles.statusTxt, { color: '#92400E' }]}>⏳ Ждём подтверждения работника</Text>
          </View>
        ) : like.isMatch ? (
          <View style={[styles.statusBadge, { backgroundColor: '#D1FAE5' }]}>
            <Text style={[styles.statusTxt, { color: Colors.green }]}>🎉 Мэтч!</Text>
          </View>
        ) : null}

        {/* Worker profile — tappable */}
        <TouchableOpacity
          style={styles.workerRowTap}
          onPress={() => router.push({ pathname: '/user-profile', params: { userId: worker.id } })}
          activeOpacity={0.8}
        >
          {worker.avatarUrl ? (
            <Image source={{ uri: worker.avatarUrl }} style={styles.avatar} contentFit="cover" transition={150} />
          ) : (
            <View style={[styles.avatar, { backgroundColor: workerColor, alignItems: 'center', justifyContent: 'center' }]}>
              <Text style={styles.avatarText}>{getInitials(workerName)}</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.workerName}>{workerName}</Text>
            {worker.age ? <Text style={styles.metroHint}>{worker.age} лет</Text> : null}
            {worker.metroStation ? <Text style={styles.metroHint}>🚇 {worker.metroStation}</Text> : null}
            {(worker.avgRating ?? 0) > 0 ? (
              <Text style={styles.metroHint}>⭐ {(worker.avgRating ?? 0).toFixed(1)} ({worker.ratingCount} отз.)</Text>
            ) : null}
          </View>
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            {like.isMatch ? (
              <View style={styles.phoneReveal}>
                <Text style={styles.phoneRevealText}>{worker.phone}</Text>
              </View>
            ) : (
              <View style={styles.hiddenPhone}><Text style={styles.hiddenPhoneText}>●●●●●●</Text></View>
            )}
            <Text style={styles.viewProfileLink}>Профиль →</Text>
          </View>
        </TouchableOpacity>

        <Text style={styles.vacLabel}>{vac.title} · {formatDate(vac.date)}</Text>

        {like.isMatch ? (
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.chatBtn} onPress={() => router.push({ pathname: '/(tabs)/chats' })} activeOpacity={0.8}>
              <Text style={styles.chatBtnText}>💬 Чат</Text>
            </TouchableOpacity>
            {!employerAlreadyRated ? (
              <TouchableOpacity style={styles.rateBtn} onPress={() => goRate(like)} activeOpacity={0.8}>
                <Text style={styles.rateBtnTxt}>⭐ Оценить</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : !approvedNotMatched ? (
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
      <View style={styles.header}>
        <Text style={styles.title}>Мэтчи</Text>
      </View>
      <View style={styles.tabs}>
        {([
          { key: 'pending', label: `Отклики${pending.length > 0 ? ` (${pending.length})` : ''}` },
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
        <FlatList
          data={shown}
          keyExtractor={l => l.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} colors={[Colors.primary]} />}
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
  statusBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, alignSelf: 'flex-start' },
  statusTxt: { fontSize: 13, fontWeight: '700' },
  jobTitle: { fontSize: 17, fontWeight: '800', color: Colors.textPrimary, lineHeight: 22 },
  companyName: { fontSize: 13, color: Colors.textMuted, marginTop: 2 },
  profileLink: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.surface, borderRadius: 12, padding: 10,
  },
  profileLinkAvatar: { width: 36, height: 36, borderRadius: 18 },
  profileLinkAvatarFallback: { alignItems: 'center', justifyContent: 'center' },
  profileLinkInitials: { color: '#fff', fontSize: 13, fontWeight: '700' },
  profileLinkName: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  profileLinkSub: { fontSize: 12, color: Colors.textMuted, marginTop: 1 },
  profileLinkArrow: { fontSize: 20, color: Colors.textMuted },
  workerRowTap: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  workerName: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  metroHint: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  viewProfileLink: { fontSize: 11, color: Colors.primary, fontWeight: '600' },
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
  rateBtn: { flex: 1, borderWidth: 1.5, borderColor: '#FBBF24', borderRadius: 100, paddingVertical: 11, alignItems: 'center', backgroundColor: '#FFFBEB' },
  rateBtnTxt: { color: '#92400E', fontSize: 14, fontWeight: '700' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingBottom: 80 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, marginTop: 12 },
  emptySub: { fontSize: 14, color: Colors.textMuted, textAlign: 'center', marginTop: 6, lineHeight: 20 },
});
