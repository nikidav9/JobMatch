import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Colors, Radius, Shadow } from '@/constants/theme';
import { useApp } from '@/hooks/useApp';
import { Like, Vacancy } from '@/constants/types';
import { formatDate, getInitials, nameColorFromString } from '@/services/storage';
import { dbUpsertLike, dbCheckAndCreateMatch, dbConfirmShift } from '@/services/db';
import {
  notifyWorkerGotMatch,
  notifyWorkerConfirmedShift,
  notifyEmployerGotMatch,
  notifyEmployerConfirmedShift,
} from '@/services/notifications';
import { Chip } from '@/components/ui/Chip';
import { VacancyDetailModal } from '@/components/feature/VacancyDetailModal';

// ─── Status badge ─────────────────────────────────────────────────────────────
function MatchStatus({ like, isWorker }: { like: Like; isWorker: boolean }) {
  if (like.shiftCompleted) {
    return <View style={[s.statusBadge, { backgroundColor: '#D1FAE5' }]}><Text style={[s.statusTxt, { color: Colors.green }]}>✅ Смена завершена</Text></View>;
  }
  if (like.isMatch) {
    if (isWorker) {
      if (like.workerConfirmed && !like.employerConfirmed)
        return <View style={[s.statusBadge, { backgroundColor: '#FFF7ED' }]}><Text style={[s.statusTxt, { color: '#92400E' }]}>⏳ Ждём подтверждения работодателя</Text></View>;
      if (like.employerConfirmed && !like.workerConfirmed)
        return <View style={[s.statusBadge, { backgroundColor: '#FFF7ED' }]}><Text style={[s.statusTxt, { color: '#92400E' }]}>⏰ Подтвердите выход!</Text></View>;
    } else {
      if (like.employerConfirmed && !like.workerConfirmed)
        return <View style={[s.statusBadge, { backgroundColor: '#FFF7ED' }]}><Text style={[s.statusTxt, { color: '#92400E' }]}>⏳ Ждём подтверждения работника</Text></View>;
      if (like.workerConfirmed && !like.employerConfirmed)
        return <View style={[s.statusBadge, { backgroundColor: '#FFF7ED' }]}><Text style={[s.statusTxt, { color: '#92400E' }]}>⏰ Подтвердите смену!</Text></View>;
    }
    return <View style={[s.statusBadge, { backgroundColor: Colors.primaryLight }]}><Text style={[s.statusTxt, { color: Colors.primary }]}>🎉 Мэтч!</Text></View>;
  }
  if (like.employerLiked === false) {
    return <View style={[s.statusBadge, { backgroundColor: '#FEE2E2' }]}><Text style={[s.statusTxt, { color: Colors.red }]}>✕ Отказ</Text></View>;
  }
  // Intermediate status: employer has seen it (null = pending, we treat null as "на рассмотрении")
  return <View style={[s.statusBadge, { backgroundColor: Colors.surface }]}><Text style={[s.statusTxt, { color: Colors.textMuted }]}>⏳ На рассмотрении</Text></View>;
}

// ─── Confirm shift banner ─────────────────────────────────────────────────────
function ConfirmBanner({ onConfirm, loading }: { onConfirm: () => void; loading: boolean }) {
  return (
    <View style={s.confirmBanner}>
      <Text style={s.confirmBannerIcon}>⏰</Text>
      <View style={{ flex: 1 }}>
        <Text style={s.confirmBannerTitle}>Подтвердите выход на смену</Text>
        <Text style={s.confirmBannerSub}>Нажмите кнопку ниже</Text>
      </View>
      <TouchableOpacity style={s.confirmBannerBtn} onPress={onConfirm} disabled={loading} activeOpacity={0.8}>
        {loading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.confirmBannerBtnTxt}>✔</Text>}
      </TouchableOpacity>
    </View>
  );
}

// ─────────────────────────────────────────────────
// WORKER VIEW
// ─────────────────────────────────────────────────
function WorkerMatches() {
  const router = useRouter();
  const { currentUser, likes, vacancies, users, refreshAll, showToast } = useApp();
  const [actionLoading, setLoading] = useState<string | null>(null);
  const [detailVacancy, setDetailVacancy] = useState<Vacancy | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<'active' | 'rejected' | 'completed'>('active');

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshAll();
    setRefreshing(false);
  };

  if (!currentUser) return <View style={{ flex: 1, backgroundColor: '#FFFFFF' }} />;

  const myLikes = likes.filter(l => l.workerId === currentUser.id && l.workerLiked);

  const getVacancy = (id: string) => vacancies.find(v => v.id === id);

  // Bucket by tab
  const activeItems = myLikes.filter(l => !l.shiftCompleted && l.employerLiked !== false);
  const rejectedItems = myLikes.filter(l => l.employerLiked === false);
  const completedItems = myLikes.filter(l => l.shiftCompleted);

  const shownItems =
    tab === 'active' ? activeItems :
    tab === 'rejected' ? rejectedItems :
    completedItems;

  const needsConfirm = activeItems.filter(l => l.isMatch && !l.workerConfirmed && !l.shiftCompleted).length;

  const confirmShift = async (like: Like) => {
    const key = like.id + '_shift';
    setLoading(key);
    try {
      const { bothConfirmed } = await dbConfirmShift(like.id, 'worker');
      await refreshAll();
      const vac = getVacancy(like.vacancyId);
      if (bothConfirmed) {
        await notifyWorkerConfirmedShift(vac?.title ?? '', true);
        showToast('Смена подтверждена! Оцените работодателя 🌟', 'success');
        const employer = users.find(u => u.id === like.employerId);
        if (employer && vac) {
          router.push({
            pathname: '/rate',
            params: { likeId: like.id, toUserId: employer.id, toName: employer.company ?? `${employer.firstName} ${employer.lastName}`, vacancyId: vac.id, role: 'worker' },
          });
        }
      } else {
        await notifyWorkerConfirmedShift(vac?.title ?? '', false);
        showToast('Выход подтверждён! Ждём работодателя', 'success');
      }
    } catch {
      showToast('Ошибка', 'error');
    } finally {
      setLoading(null);
    }
  };

  const renderItem = ({ item: like }: { item: Like }) => {
    const vac = getVacancy(like.vacancyId);
    if (!vac) return null;
    const employer = users.find(u => u.id === like.employerId);
    const isMatch = like.isMatch;
    const isCompleted = like.shiftCompleted;
    const shiftKey = like.id + '_shift';

    return (
      <View style={[s.card, isMatch && !isCompleted && s.matchedCard, isCompleted && s.completedCard]}>
        <MatchStatus like={like} isWorker={true} />

        {/* Confirm banner */}
        {isMatch && !isCompleted && !like.workerConfirmed ? (
          <ConfirmBanner onConfirm={() => confirmShift(like)} loading={actionLoading === shiftKey} />
        ) : null}

        <TouchableOpacity activeOpacity={0.8} onPress={() => setDetailVacancy(vac)}>
          <Text style={s.jobTitle}>{vac.title}</Text>
          <Text style={s.subText}>{vac.company} · 🚇 {vac.metroStation}</Text>
        </TouchableOpacity>

        <View style={s.chipsRow}>
          <Chip label={`📅 ${formatDate(vac.date)}`} variant="date" />
          <Chip label={`⏰ ${vac.timeStart}–${vac.timeEnd}`} variant="time" />
        </View>

        {/* Employer info */}
        {employer ? (
          <TouchableOpacity
            style={s.profileRow}
            onPress={() => router.push({ pathname: '/user-profile', params: { userId: employer.id } })}
            activeOpacity={0.8}
          >
            {employer.avatarUrl ? (
              <Image source={{ uri: employer.avatarUrl }} style={s.profileAvatar} contentFit="cover" />
            ) : (
              <View style={[s.profileAvatar, s.profileAvatarFallback, { backgroundColor: nameColorFromString(employer.id) }]}>
                <Text style={s.profileAvatarInitials}>{getInitials(`${employer.firstName} ${employer.lastName}`)}</Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={s.profileName}>{employer.company ?? `${employer.firstName} ${employer.lastName}`}</Text>
              {(employer.avgRating ?? 0) > 0 ? (
                <Text style={s.profileSub}>⭐ {(employer.avgRating ?? 0).toFixed(1)} ({employer.ratingCount} отз.)</Text>
              ) : null}
            </View>
            <Text style={s.profileArrow}>Профиль ›</Text>
          </TouchableOpacity>
        ) : null}

        {/* Actions */}
        {isMatch && !isCompleted ? (
          <View style={s.actionRow}>
            <TouchableOpacity style={s.chatBtn} onPress={() => router.push({ pathname: '/(tabs)/chats' })} activeOpacity={0.8}>
              <Text style={s.chatBtnTxt}>💬 Чат</Text>
            </TouchableOpacity>
            {!like.workerConfirmed ? (
              <TouchableOpacity
                style={[s.confirmBtn, actionLoading === shiftKey && { opacity: 0.5 }]}
                onPress={() => confirmShift(like)}
                disabled={actionLoading === shiftKey}
                activeOpacity={0.8}
              >
                {actionLoading === shiftKey ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.confirmBtnTxt}>✔ Подтверждаю выход</Text>}
              </TouchableOpacity>
            ) : (
              <View style={s.waitBtn}><Text style={s.waitBtnTxt}>⏳ Ждём работодателя</Text></View>
            )}
          </View>
        ) : isCompleted ? (
          <TouchableOpacity style={s.chatBtn} onPress={() => router.push({ pathname: '/(tabs)/chats' })} activeOpacity={0.8}>
            <Text style={s.chatBtnTxt}>💬 Открыть чат</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  };

  const TABS = [
    { key: 'active',    label: 'Активные',  count: activeItems.length },
    { key: 'rejected',  label: 'Отказ',      count: rejectedItems.length },
    { key: 'completed', label: 'Завершено',  count: completedItems.length },
  ] as const;

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Text style={s.title}>Мои отклики</Text>
        {needsConfirm > 0 ? (
          <View style={s.urgentBadge}>
            <Text style={s.urgentBadgeTxt}>⏰ {needsConfirm} ждут</Text>
          </View>
        ) : null}
      </View>

      {/* Tab strip */}
      <View style={s.tabStrip}>
        {TABS.map(t => (
          <TouchableOpacity key={t.key} style={s.tabItem} onPress={() => setTab(t.key)} activeOpacity={0.8}>
            <Text style={[s.tabLabel, tab === t.key && s.tabLabelActive]}>
              {t.label}
              {t.count > 0 ? ` (${t.count})` : ''}
            </Text>
            {tab === t.key ? <View style={s.tabUnderline} /> : null}
          </TouchableOpacity>
        ))}
      </View>

      {shownItems.length === 0 ? (
        <View style={s.empty}>
          <Text style={{ fontSize: 48 }}>{tab === 'active' ? '📋' : tab === 'rejected' ? '😔' : '🏁'}</Text>
          <Text style={s.emptyTitle}>
            {tab === 'active' ? 'Нет активных заявок' : tab === 'rejected' ? 'Нет отказов' : 'Нет завершённых смен'}
          </Text>
          <Text style={s.emptySub}>
            {tab === 'active' ? 'Откликайтесь на вакансии — они появятся здесь' : tab === 'rejected' ? 'Это хорошо! Продолжайте откликаться' : 'Завершённые смены появятся здесь'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={shownItems}
          keyExtractor={l => l.id}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} colors={[Colors.primary]} />}
          renderItem={renderItem}
        />
      )}

      <VacancyDetailModal vacancy={detailVacancy} visible={!!detailVacancy} onClose={() => setDetailVacancy(null)} />
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────
// EMPLOYER VIEW
// ─────────────────────────────────────────────────
function EmployerMatches() {
  const router = useRouter();
  const { currentUser, likes, vacancies, users, refreshAll, showToast } = useApp();
  const [actionLoading, setLoading] = useState<string | null>(null);
  const [tab, setTab] = useState<'pending' | 'matched'>('pending');
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshAll();
    setRefreshing(false);
  };

  if (!currentUser) return <View style={{ flex: 1, backgroundColor: '#FFFFFF' }} />;

  const myVacIds = vacancies.filter(v => v.employerId === currentUser.id).map(v => v.id);
  const allLikes = likes.filter(l => myVacIds.includes(l.vacancyId) && l.workerLiked);

  // pending = not yet matched, not rejected
  const pending = allLikes.filter(l => !l.isMatch && l.employerLiked !== false);
  const matched = allLikes
    .filter(l => l.isMatch)
    .sort((a, b) => {
      if (a.shiftCompleted && !b.shiftCompleted) return 1;
      if (!a.shiftCompleted && b.shiftCompleted) return -1;
      return 0;
    });

  const needsConfirm = matched.filter(l => !l.employerConfirmed && !l.shiftCompleted).length;
  const shown = tab === 'pending' ? pending : matched;

  const getVacancy = (id: string) => vacancies.find(v => v.id === id);
  const getWorker = (id: string) => users.find(u => u.id === id);

  const approve = async (like: Like) => {
    setLoading(like.id);
    try {
      await dbUpsertLike(like.vacancyId, like.workerId, currentUser.id, { employerLiked: true });
      const result = await dbCheckAndCreateMatch(like.vacancyId, like.workerId);
      await refreshAll();
      const vac = getVacancy(like.vacancyId);
      const worker = getWorker(like.workerId);
      const workerName = worker ? `${worker.firstName} ${worker.lastName}` : 'Работник';
      await notifyEmployerGotMatch(workerName, vac?.title ?? '');
      showToast(`🎉 Мэтч с ${workerName}!`, 'match');
      // Always open chat immediately — worker already confirmed by liking
      const chatId = result.chatId ?? like.id;
      if (result.chatId) {
        router.push({ pathname: '/chat-room', params: { chatId: result.chatId } });
      } else {
        router.push({ pathname: '/(tabs)/chats' });
      }
    } catch {
      showToast('Ошибка', 'error');
    } finally {
      setLoading(null);
    }
  };

  const dismiss = async (like: Like) => {
    const key = like.id + '_d';
    setLoading(key);
    try {
      await dbUpsertLike(like.vacancyId, like.workerId, currentUser.id, { employerLiked: false });
      await refreshAll();
      showToast('Отклонено', 'success');
    } catch {
      showToast('Ошибка', 'error');
    } finally {
      setLoading(null);
    }
  };

  const confirmShift = async (like: Like) => {
    const key = like.id + '_shift';
    setLoading(key);
    try {
      const { bothConfirmed } = await dbConfirmShift(like.id, 'employer');
      await refreshAll();
      const worker = getWorker(like.workerId);
      const vac = getVacancy(like.vacancyId);
      const workerName = worker ? `${worker.firstName} ${worker.lastName}` : 'Работник';
      if (bothConfirmed) {
        await notifyEmployerConfirmedShift(workerName, vac?.title ?? '', true);
        showToast('Смена подтверждена! Оцените работника 🌟', 'success');
        if (worker && vac) {
          router.push({
            pathname: '/rate',
            params: { likeId: like.id, toUserId: worker.id, toName: workerName, vacancyId: vac.id, role: 'employer' },
          });
        }
      } else {
        await notifyEmployerConfirmedShift(workerName, vac?.title ?? '', false);
        showToast('Подтверждено! Ждём работника', 'success');
      }
    } catch {
      showToast('Ошибка', 'error');
    } finally {
      setLoading(null);
    }
  };

  const renderItem = ({ item: like }: { item: Like }) => {
    const vac = getVacancy(like.vacancyId);
    const worker = getWorker(like.workerId);
    if (!vac || !worker) return null;
    const workerName = `${worker.firstName} ${worker.lastName}`;
    const workerColor = nameColorFromString(worker.id);
    const isLoading = actionLoading === like.id;
    const isDLoading = actionLoading === like.id + '_d';
    const isShiftLoading = actionLoading === like.id + '_shift';

    if (like.isMatch) {
      return (
        <View style={[s.card, like.shiftCompleted ? s.completedCard : s.matchedCard]}>
          <MatchStatus like={like} isWorker={false} />

          {!like.shiftCompleted && !like.employerConfirmed ? (
            <ConfirmBanner onConfirm={() => confirmShift(like)} loading={isShiftLoading} />
          ) : null}

          <TouchableOpacity
            style={s.workerRow}
            onPress={() => router.push({ pathname: '/user-profile', params: { userId: worker.id } })}
            activeOpacity={0.8}
          >
            {worker.avatarUrl ? (
              <Image source={{ uri: worker.avatarUrl }} style={s.avatar} contentFit="cover" transition={150} />
            ) : (
              <View style={[s.avatar, { backgroundColor: workerColor, alignItems: 'center', justifyContent: 'center' }]}>
                <Text style={s.avatarTxt}>{getInitials(workerName)}</Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={s.workerName}>{workerName}</Text>
              {worker.metroStation ? <Text style={s.profileSub}>🚇 {worker.metroStation}</Text> : null}
              {(worker.avgRating ?? 0) > 0 ? <Text style={s.profileSub}>⭐ {(worker.avgRating ?? 0).toFixed(1)} ({worker.ratingCount} отз.)</Text> : null}
            </View>
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              <View style={s.phoneTag}><Text style={s.phoneTxt}>{worker.phone}</Text></View>
              <Text style={s.profileArrow}>Профиль ›</Text>
            </View>
          </TouchableOpacity>

          <Text style={s.vacLabel}>{vac.title} · {formatDate(vac.date)}</Text>

          <View style={s.actionRow}>
            <TouchableOpacity style={s.chatBtn} onPress={() => router.push({ pathname: '/(tabs)/chats' })} activeOpacity={0.8}>
              <Text style={s.chatBtnTxt}>💬 Чат</Text>
            </TouchableOpacity>
            {!like.shiftCompleted && !like.employerConfirmed ? (
              <TouchableOpacity
                style={[s.confirmBtn, isShiftLoading && { opacity: 0.5 }]}
                onPress={() => confirmShift(like)}
                disabled={isShiftLoading}
                activeOpacity={0.8}
              >
                {isShiftLoading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.confirmBtnTxt}>✔ Подтверждаю</Text>}
              </TouchableOpacity>
            ) : !like.shiftCompleted ? (
              <View style={s.waitBtn}><Text style={s.waitBtnTxt}>⏳ Ждём работника</Text></View>
            ) : null}
          </View>
        </View>
      );
    }

    // Pending applicant card
    return (
      <View style={s.card}>
        <MatchStatus like={like} isWorker={false} />

        <TouchableOpacity
          style={s.workerRow}
          onPress={() => router.push({ pathname: '/user-profile', params: { userId: worker.id } })}
          activeOpacity={0.8}
        >
          {worker.avatarUrl ? (
            <Image source={{ uri: worker.avatarUrl }} style={s.avatar} contentFit="cover" transition={150} />
          ) : (
            <View style={[s.avatar, { backgroundColor: workerColor, alignItems: 'center', justifyContent: 'center' }]}>
              <Text style={s.avatarTxt}>{getInitials(workerName)}</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={s.workerName}>{workerName}</Text>
            {worker.age ? <Text style={s.profileSub}>{worker.age} лет</Text> : null}
            {worker.metroStation ? <Text style={s.profileSub}>🚇 {worker.metroStation}</Text> : null}
          </View>
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            <View style={s.hiddenPhone}><Text style={s.hiddenPhoneTxt}>●●● ●●●</Text></View>
            <Text style={s.profileArrow}>Профиль ›</Text>
          </View>
        </TouchableOpacity>

        <Text style={s.vacLabel}>{vac.title} · {formatDate(vac.date)}</Text>

        {/* Employer decision buttons */}
        <View style={s.actionRow}>
          <TouchableOpacity
            style={[s.rejectBtn, isDLoading && { opacity: 0.5 }]}
            onPress={() => dismiss(like)}
            disabled={!!actionLoading}
            activeOpacity={0.8}
          >
            {isDLoading ? <ActivityIndicator size="small" color={Colors.red} /> : <Text style={s.rejectBtnTxt}>✕ Не подходит</Text>}
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.acceptBtn, isLoading && { opacity: 0.5 }]}
            onPress={() => approve(like)}
            disabled={!!actionLoading}
            activeOpacity={0.8}
          >
            {isLoading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.acceptBtnTxt}>✅ Подходит!</Text>}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Text style={s.title}>Мэтчи</Text>
        {needsConfirm > 0 ? (
          <View style={s.urgentBadge}>
            <Text style={s.urgentBadgeTxt}>⏰ {needsConfirm} ждут</Text>
          </View>
        ) : null}
      </View>

      <View style={s.tabStrip}>
        {([
          { key: 'pending', label: 'Отклики', count: pending.length },
          { key: 'matched', label: 'Мэтчи',   count: matched.length },
        ] as const).map(t => (
          <TouchableOpacity key={t.key} style={s.tabItem} onPress={() => setTab(t.key)} activeOpacity={0.8}>
            <Text style={[s.tabLabel, tab === t.key && s.tabLabelActive]}>
              {t.label}{t.count > 0 ? ` (${t.count})` : ''}
            </Text>
            {tab === t.key ? <View style={s.tabUnderline} /> : null}
          </TouchableOpacity>
        ))}
      </View>

      {shown.length === 0 ? (
        <View style={s.empty}>
          <Text style={{ fontSize: 48 }}>{tab === 'pending' ? '📥' : '🤝'}</Text>
          <Text style={s.emptyTitle}>{tab === 'pending' ? 'Нет откликов' : 'Нет мэтчей'}</Text>
          <Text style={s.emptySub}>{tab === 'pending' ? 'Когда работники откликнутся — они появятся здесь' : 'Мэтчи появятся после взаимного подтверждения'}</Text>
        </View>
      ) : (
        <FlatList
          data={shown}
          keyExtractor={l => l.id}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} colors={[Colors.primary]} />}
          renderItem={renderItem}
        />
      )}
    </SafeAreaView>
  );
}

export default function MatchesScreen() {
  const { currentUser } = useApp();
  if (!currentUser) return <View style={{ flex: 1, backgroundColor: '#FFFFFF' }} />;
  return currentUser.role === 'worker' ? <WorkerMatches /> : <EmployerMatches />;
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.divider,
  },
  title: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary, flex: 1 },
  urgentBadge: { backgroundColor: '#FEF3C7', borderRadius: 100, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: '#F59E0B' },
  urgentBadgeTxt: { color: '#92400E', fontSize: 12, fontWeight: '700' },
  tabStrip: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: Colors.divider },
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
  statusBadge2: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, alignSelf: 'stretch' },
  statusTxt2: { fontSize: 12, fontWeight: '600', textAlign: 'center' },
  jobTitle: { fontSize: 17, fontWeight: '800', color: Colors.textPrimary, lineHeight: 22 },
  subText: { fontSize: 13, color: Colors.textMuted, marginTop: 2 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  // Profile row (worker sees employer)
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.surface, borderRadius: 12, padding: 10 },
  profileAvatar: { width: 36, height: 36, borderRadius: 18 },
  profileAvatarFallback: { alignItems: 'center', justifyContent: 'center' },
  profileAvatarInitials: { color: '#fff', fontSize: 13, fontWeight: '700' },
  profileName: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  profileSub: { fontSize: 12, color: Colors.textMuted, marginTop: 1 },
  profileArrow: { fontSize: 12, color: Colors.primary, fontWeight: '600' },
  // Worker row (employer sees worker)
  workerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
  workerName: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  phoneTag: { backgroundColor: Colors.primaryLight, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  phoneTxt: { color: Colors.primary, fontSize: 12, fontWeight: '700' },
  hiddenPhone: { backgroundColor: Colors.surface, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  hiddenPhoneTxt: { color: Colors.textMuted, fontSize: 13 },
  vacLabel: { fontSize: 13, color: Colors.textMuted },
  // Action row
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  rejectBtn: { flex: 1, borderWidth: 1.5, borderColor: Colors.red, borderRadius: 100, paddingVertical: 11, alignItems: 'center' },
  rejectBtnTxt: { color: Colors.red, fontSize: 14, fontWeight: '600' },
  acceptBtn: { flex: 1, backgroundColor: Colors.primary, borderRadius: 100, paddingVertical: 11, alignItems: 'center' },
  acceptBtnTxt: { color: '#fff', fontSize: 14, fontWeight: '700' },
  chatBtn: { flex: 1, backgroundColor: Colors.blue, borderRadius: 100, paddingVertical: 11, alignItems: 'center' },
  chatBtnTxt: { color: '#fff', fontSize: 14, fontWeight: '700' },
  confirmBtn: { flex: 2, backgroundColor: Colors.green, borderRadius: 100, paddingVertical: 11, alignItems: 'center' },
  confirmBtnTxt: { color: '#fff', fontSize: 14, fontWeight: '700' },
  waitBtn: { flex: 2, backgroundColor: Colors.surface, borderRadius: 100, paddingVertical: 11, alignItems: 'center', borderWidth: 1, borderColor: Colors.inputBorder },
  waitBtnTxt: { color: Colors.textMuted, fontSize: 13, fontWeight: '500' },
  // Confirm banner
  confirmBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#FEF3C7', borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: '#F59E0B',
  },
  confirmBannerIcon: { fontSize: 22 },
  confirmBannerTitle: { fontSize: 13, fontWeight: '700', color: '#92400E' },
  confirmBannerSub: { fontSize: 11, color: '#B45309', marginTop: 2 },
  confirmBannerBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.green, alignItems: 'center', justifyContent: 'center' },
  confirmBannerBtnTxt: { fontSize: 16, color: '#fff', fontWeight: '700' },
  // Empty
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingBottom: 80 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, marginTop: 12 },
  emptySub: { fontSize: 14, color: Colors.textMuted, textAlign: 'center', marginTop: 6, lineHeight: 20 },
});
